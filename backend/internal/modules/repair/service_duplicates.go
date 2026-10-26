package repair

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"

	"github.com/pithawat/BAMBAM/backend/internal/platform/apperr"
	"github.com/pithawat/BAMBAM/backend/internal/platform/users"
)

// Stage 4: duplicate check + follow (F03), hand over a team-handled job (F05).
// Team-handled records themselves are created by CreateTicket (F04).

// Duplicates implements endpoint #22: open tickets on the same category + floor + room (BR-F03-1),
// the ones that block the report first (same or no extra spot, CR-020), then newest first, for the
// S03 duplicate card. Every role may ask (the reporter has not sent anything yet).
func (s *Service) Duplicates(ctx context.Context, v Viewer, k DuplicateKey) ([]Duplicate, error) {
	k.Spot = normalizeSpot(k.Spot)
	matches, err := s.repo.DuplicateTickets(ctx, k)
	if err != nil {
		return nil, err
	}
	ids := make([]uuid.UUID, 0, len(matches))
	blocks := make(map[uuid.UUID]bool, len(matches))
	for _, m := range matches {
		ids = append(ids, m.ID)
		blocks[m.ID] = m.BlocksReport
	}
	details, err := s.duplicateDetails(ctx, v, ids)
	if err != nil {
		return nil, err
	}
	out := make([]Duplicate, 0, len(details))
	for _, d := range details {
		out = append(out, Duplicate{TicketDetail: d, BlocksReport: blocks[d.ID]})
	}
	return out, nil
}

// duplicateDetails loads the matches as the viewer sees them on S04 (summary + subscriber count).
func (s *Service) duplicateDetails(ctx context.Context, v Viewer, ids []uuid.UUID) ([]TicketDetail, error) {
	out := make([]TicketDetail, 0, len(ids))
	for _, id := range ids {
		d, err := s.repo.GetTicket(ctx, id, v.ID)
		if errors.Is(err, ErrTicketNotFound) {
			continue
		}
		if err != nil {
			return nil, err
		}
		decorate(v, &d.TicketSummary)
		out = append(out, d)
	}
	return out, nil
}

// checkDuplicates refuses a report that duplicates an open ticket (BR-F03-2, CR-009: the server
// enforces it, there is no "report anyway"). CR-020: only matches that block count — a different
// extra spot in the same room is allowed. The caller's own ticket waiting for ประเมินตรวจงาน wins over
// the other matches (BR-F03-4). Runs inside the create transaction, under a lock on category + floor + room.
func checkDuplicates(ctx context.Context, tx TxRepository, v Viewer, k DuplicateKey) error {
	if err := tx.LockDuplicateKey(ctx, k); err != nil {
		return err
	}
	matches, err := tx.DuplicateTickets(ctx, k)
	if err != nil || len(matches) == 0 {
		return err
	}
	ids := make([]uuid.UUID, 0, len(matches))
	for _, m := range matches {
		if !m.BlocksReport {
			continue
		}
		if m.ReporterID == v.ID && m.Status == StatusResolved {
			return &OwnTicketAwaitingRatingError{TicketID: m.ID}
		}
		ids = append(ids, m.ID)
	}
	if len(ids) == 0 {
		return nil
	}
	return &DuplicateFoundError{IDs: ids}
}

// withDuplicates fills a DuplicateFoundError with the matches, read after the transaction ended.
func (s *Service) withDuplicates(ctx context.Context, v Viewer, err error) error {
	var dup *DuplicateFoundError
	if !errors.As(err, &dup) {
		return err
	}
	tickets, loadErr := s.duplicateDetails(ctx, v, dup.IDs)
	if loadErr != nil {
		return loadErr
	}
	dup.Tickets = tickets
	return dup
}

// Follow implements endpoint #23: the caller becomes a subscriber of an open ticket; their note and
// photos are added to its timeline as a `subscribed` event (F03). Subscribers see the ticket in S06
// and get the reporter's notifications, but never rate it (BR-F03-3).
func (s *Service) Follow(ctx context.Context, v Viewer, id uuid.UUID, note string, photoIDs []uuid.UUID) (TicketDetail, error) {
	note = strings.TrimSpace(note)
	photoIDs = uniqueIDs(photoIDs)
	fields := map[string]string{}
	checkText(fields, "note", note, MaxNoteChars, false)
	checkPhotos(fields, "photoIds", photoIDs, 0)
	if len(fields) > 0 {
		return TicketDetail{}, apperr.Validation(fields)
	}
	now := s.now()
	err := s.repo.InTx(ctx, func(tx TxRepository) error {
		t, err := tx.LockTicket(ctx, id)
		if err != nil {
			return err
		}
		if t.Status == StatusClosed {
			return ErrTicketClosed
		}
		if t.ReporterID == v.ID {
			return ErrAlreadyFollowing
		}
		added, err := tx.InsertSubscriber(ctx, id, v.ID, now)
		if err != nil {
			return err
		}
		if !added {
			return ErrAlreadyFollowing
		}
		if err := lockPhotos(ctx, tx, v.ID, photoIDs, now); err != nil {
			return err
		}
		return tx.InsertEvent(ctx, NewEvent{ID: uuid.New(), TicketID: id, Type: EventSubscribed, ActorID: &v.ID, At: now,
			Note: optional(note), Data: []byte("{}"), PhotoKind: PhotoKindFollow, PhotoIDs: photoIDs})
	})
	if err != nil {
		return TicketDetail{}, err
	}
	return s.Ticket(ctx, v, id)
}

// HandOver implements endpoint #24: a team-handled ticket goes back to the technician as the same
// ticket, `in_progress` waiting for the assessment (BR-F05-1/3, CR-005). Only the lead who recorded
// it, or admin (BR-F05-2); the reason is required.
func (s *Service) HandOver(ctx context.Context, v Viewer, id uuid.UUID, reason string) (TicketDetail, error) {
	if v.Role != users.RoleAdmin && !isLead(v.Role) {
		return TicketDetail{}, apperr.ErrForbidden
	}
	reason = strings.TrimSpace(reason)
	fields := map[string]string{}
	checkText(fields, "reason", reason, MaxNoteChars, true)
	if len(fields) > 0 {
		return TicketDetail{}, apperr.Validation(fields)
	}
	now := s.now()
	err := s.repo.InTx(ctx, func(tx TxRepository) error {
		t, err := tx.LockTicket(ctx, id)
		if err != nil {
			return err
		}
		if v.Role != users.RoleAdmin && t.ReporterID != v.ID {
			return apperr.ErrForbidden
		}
		if t.Status != StatusClosed || t.ClosedReason != ClosedReasonTeamHandled {
			return ErrNotTeamHandled
		}
		if err := tx.HandOverTicket(ctx, id, now); err != nil {
			return err
		}
		return tx.InsertEvent(ctx, NewEvent{ID: uuid.New(), TicketID: id, Type: EventHandedOver, ActorID: &v.ID, At: now,
			Note: &reason, Data: []byte("{}")})
	})
	if err != nil {
		return TicketDetail{}, err
	}
	return s.Ticket(ctx, v, id)
}
