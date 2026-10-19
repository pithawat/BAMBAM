package repair

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/pithawat/BAMBAM/backend/internal/platform/apperr"
	"github.com/pithawat/BAMBAM/backend/internal/platform/users"
)

// Repository is the data layer the service needs (implemented by PgRepository).
type Repository interface {
	ListCategories(ctx context.Context) ([]Category, error)
	ListBuildings(ctx context.Context) ([]Building, error)
	CountCategories(ctx context.Context) (int64, error)
	InsertMasterData(ctx context.Context, cats []Category, buildings []Building) error
	// RefreshSampleData applies newer sample values by id (dev / UAT only, CR-008): category defaults
	// and symptom priorities still at `medium`, and building names still at their first sample name.
	RefreshSampleData(ctx context.Context, cats []Category, renames []SampleRename) error
	ListRecentPlaces(ctx context.Context, reporterID uuid.UUID) ([]RecentPlace, error)

	InsertPhoto(ctx context.Context, p NewPhoto) error
	GetPhoto(ctx context.Context, id uuid.UUID) (Photo, error)
	DeleteUnattachedPhotos(ctx context.Context, olderThan time.Time) ([]string, error)

	GetTicketAccess(ctx context.Context, id, viewerID uuid.UUID) (ticketAccess, error)
	GetTicket(ctx context.Context, id, viewerID uuid.UUID) (TicketDetail, error)
	ListTickets(ctx context.Context, viewerID uuid.UUID, f TicketFilter) ([]TicketSummary, int64, error)
	CountTickets(ctx context.Context, viewerID uuid.UUID, f TicketFilter) (TicketCounts, error)
	// AutoCloseDue closes resolved tickets whose auto_close_at has passed and writes their events.
	AutoCloseDue(ctx context.Context, now time.Time) (int, error)

	ListContractorTypes(ctx context.Context) ([]Ref, error)
	// EnsureContractorType returns the type with this name (case-insensitive), creating it when missing.
	EnsureContractorType(ctx context.Context, name string, by uuid.UUID) (Ref, error)
	ListContractors(ctx context.Context, f ContractorFilter) ([]Contractor, int64, error)
	GetContractor(ctx context.Context, id uuid.UUID) (Contractor, error)
	ListContractorJobs(ctx context.Context, id uuid.UUID, page, pageSize int) ([]ContractorJob, int64, error)

	// InTx runs fn in one transaction with a repository bound to it.
	InTx(ctx context.Context, fn func(tx TxRepository) error) error
}

// TxRepository is used inside write transactions.
type TxRepository interface {
	// LockActiveCategory returns the category's default priority (CR-008); ok is false when it is inactive or missing.
	LockActiveCategory(ctx context.Context, id uuid.UUID) (defaultPriority string, ok bool, err error)
	// ActiveSymptomPriorities returns the priorities of the given symptoms that are active in the category.
	ActiveSymptomPriorities(ctx context.Context, categoryID uuid.UUID, ids []uuid.UUID) ([]string, error)
	ActiveFloorInBuilding(ctx context.Context, floorID, buildingID uuid.UUID) (bool, error)
	LockAttachablePhotos(ctx context.Context, uploaderID uuid.UUID, ids []uuid.UUID, notBefore time.Time) (int, error)
	TicketNumberFormat(ctx context.Context) (TicketNumberFormat, error)
	NextTicketCounter(ctx context.Context, year int) (int64, error)
	// InsertTicket writes the ticket, its symptoms, attaches the photos and writes the `created` event.
	InsertTicket(ctx context.Context, t NewTicket) error

	LockTicket(ctx context.Context, id uuid.UUID) (LockedTicket, error)
	AssessTicket(ctx context.Context, id, technicianID uuid.UUID, in AssessInput, now time.Time) error
	ResolveTicket(ctx context.Context, id, technicianID uuid.UUID, in ResolveInput, now, autoCloseAt time.Time) error
	ConfirmTicket(ctx context.Context, id uuid.UUID, rating int16, comment *string, now time.Time) error
	SendBackTicket(ctx context.Context, id uuid.UUID, now time.Time) error
	// InsertEvent writes a timeline event and attaches its photos.
	InsertEvent(ctx context.Context, e NewEvent) error
	ActiveContractorExists(ctx context.Context, id uuid.UUID) (bool, error)

	CountContractorTypes(ctx context.Context, ids []uuid.UUID) (int, error)
	InsertContractor(ctx context.Context, id uuid.UUID, in ContractorInput, by uuid.UUID) error
	// UpdateContractor returns false when the contractor does not exist.
	UpdateContractor(ctx context.Context, id uuid.UUID, in ContractorInput) (bool, error)
	SetContractorTypes(ctx context.Context, id uuid.UUID, typeIDs []uuid.UUID) error
}

// photoTTL: unattached uploads older than this are deleted and cannot be attached (D-022).
const photoTTL = 24 * time.Hour

type Service struct {
	repo  Repository
	store PhotoStore
	now   func() time.Time
}

func NewService(repo Repository, store PhotoStore) *Service {
	return &Service{repo: repo, store: store, now: time.Now}
}

// ---- master data ----

func (s *Service) Categories(ctx context.Context) ([]Category, error) {
	return s.repo.ListCategories(ctx)
}

func (s *Service) Buildings(ctx context.Context) ([]Building, error) {
	return s.repo.ListBuildings(ctx)
}

// EnsureSampleData inserts the sample master data (seed.go) when no category exists yet, and
// otherwise refreshes the sample values added later (CR-008 priorities and building names).
// main.go calls it only in dev/UAT (D-032); real seed files replace it.
func (s *Service) EnsureSampleData(ctx context.Context) (bool, error) {
	n, err := s.repo.CountCategories(ctx)
	if err != nil {
		return false, err
	}
	if n > 0 {
		if err := s.repo.RefreshSampleData(ctx, sampleCategories(), sampleBuildingRenames()); err != nil {
			return false, fmt.Errorf("refresh sample master data: %w", err)
		}
		return false, nil
	}
	if err := s.repo.InsertMasterData(ctx, sampleCategories(), sampleBuildings()); err != nil {
		return false, fmt.Errorf("insert sample master data: %w", err)
	}
	return true, nil
}

// ---- photos ----

// UploadPhoto stores one image (endpoint #3) and returns its id. It stays unattached
// until a ticket uses it.
func (s *Service) UploadPhoto(ctx context.Context, v Viewer, data []byte) (uuid.UUID, error) {
	if len(data) > MaxPhotoBytes {
		return uuid.Nil, ErrPhotoTooLarge
	}
	ct := detectImageType(data)
	if ct == "" {
		return uuid.Nil, ErrPhotoTypeNotAllowed
	}
	thumb, hasThumb, err := makeThumbnail(data, ct)
	if err != nil {
		return uuid.Nil, err
	}

	id := uuid.New()
	dir := s.now().UTC().Format("2006/01")
	p := NewPhoto{
		ID: id, UploaderID: v.ID, ContentType: ct, SizeBytes: int64(len(data)),
		StorageKey: dir + "/" + id.String() + photoExt[ct],
	}
	p.ThumbKey, p.ThumbContentType = p.StorageKey, ct
	if hasThumb {
		p.ThumbKey, p.ThumbContentType = dir+"/"+id.String()+"_thumb.jpg", "image/jpeg"
	}

	if err := s.store.Put(ctx, p.StorageKey, data); err != nil {
		return uuid.Nil, fmt.Errorf("store photo: %w", err)
	}
	if hasThumb {
		if err := s.store.Put(ctx, p.ThumbKey, thumb); err != nil {
			s.deleteFiles(ctx, p.StorageKey)
			return uuid.Nil, fmt.Errorf("store thumbnail: %w", err)
		}
	}
	if err := s.repo.InsertPhoto(ctx, p); err != nil {
		s.deleteFiles(ctx, p.StorageKey, p.ThumbKey)
		return uuid.Nil, fmt.Errorf("insert photo: %w", err)
	}
	return id, nil
}

// OpenPhoto returns the file for endpoint #4. Attached photos follow the ticket's
// visibility; unattached ones are visible to their uploader only.
func (s *Service) OpenPhoto(ctx context.Context, v Viewer, id uuid.UUID, thumb bool) (io.ReadCloser, string, error) {
	p, err := s.repo.GetPhoto(ctx, id)
	if err != nil {
		return nil, "", err
	}
	if p.TicketID == nil {
		if p.UploaderID != v.ID {
			return nil, "", apperr.ErrForbidden
		}
	} else {
		acc, err := s.repo.GetTicketAccess(ctx, *p.TicketID, v.ID)
		if err != nil {
			return nil, "", err
		}
		if !canView(v, acc) {
			return nil, "", apperr.ErrForbidden
		}
	}
	key, ct := p.StorageKey, p.ContentType
	if thumb {
		key, ct = p.ThumbKey, p.ThumbContentType
	}
	f, err := s.store.Open(ctx, key)
	if err != nil {
		return nil, "", fmt.Errorf("open photo %s: %w", id, err)
	}
	return f, ct, nil
}

// PurgeUnattachedPhotos deletes uploads never attached within photoTTL (D-022).
func (s *Service) PurgeUnattachedPhotos(ctx context.Context) (int, error) {
	keys, err := s.repo.DeleteUnattachedPhotos(ctx, s.now().Add(-photoTTL))
	if err != nil {
		return 0, err
	}
	s.deleteFiles(ctx, keys...)
	return len(keys), nil
}

func (s *Service) deleteFiles(ctx context.Context, keys ...string) {
	seen := map[string]bool{}
	for _, k := range keys {
		if k == "" || seen[k] {
			continue
		}
		seen[k] = true
		if err := s.store.Delete(ctx, k); err != nil {
			slog.ErrorContext(ctx, "delete photo file", "key", k, "err", err)
		}
	}
}

// ---- tickets ----

// CreateTicket implements endpoint #5. The ticket starts `in_progress`, waiting for the
// technician's assessment (CR-005); team handled comes in Stage 4.
func (s *Service) CreateTicket(ctx context.Context, v Viewer, in CreateTicketInput) (TicketDetail, error) {
	if in.TeamHandled {
		return TicketDetail{}, ErrTeamHandledNotAllowed
	}
	in, fields := validateCreate(in)
	if len(fields) > 0 {
		return TicketDetail{}, apperr.Validation(fields)
	}

	now := s.now()
	t := NewTicket{
		ID: uuid.New(), CategoryID: in.CategoryID,
		CategoryOther: optional(in.CategoryOther), SymptomOther: optional(in.SymptomOther),
		BuildingID: *in.BuildingID, FloorID: *in.FloorID,
		LocationDetail: optional(in.LocationDetail), Details: optional(in.Details), AssetCode: optional(in.AssetCode),
		ReporterID: v.ID, SymptomIDs: in.SymptomIDs, PhotoIDs: in.PhotoIDs,
		CreatedAt: now, CreatedEventID: uuid.New(),
	}

	err := s.repo.InTx(ctx, func(tx TxRepository) error {
		var symptomPriorities []string
		categoryDefault := ""
		if t.CategoryID != nil {
			def, ok, err := tx.LockActiveCategory(ctx, *t.CategoryID)
			if err != nil {
				return err
			}
			if !ok {
				return ErrMasterDataChanged
			}
			categoryDefault = def
			if len(t.SymptomIDs) > 0 {
				if symptomPriorities, err = tx.ActiveSymptomPriorities(ctx, *t.CategoryID, t.SymptomIDs); err != nil {
					return err
				}
				if len(symptomPriorities) != len(t.SymptomIDs) {
					return ErrMasterDataChanged
				}
			}
		}
		// BR-F02-2 (CR-008): the system sets the priority.
		t.Priority, t.PrioritySource = ticketPriority(symptomPriorities, categoryDefault, t.CategoryID == nil)
		if ok, err := tx.ActiveFloorInBuilding(ctx, t.FloorID, t.BuildingID); err != nil {
			return err
		} else if !ok {
			return ErrMasterDataChanged
		}
		if err := lockPhotos(ctx, tx, v.ID, t.PhotoIDs, now); err != nil {
			return err
		}

		format, err := tx.TicketNumberFormat(ctx)
		if err != nil {
			return err
		}
		year := ticketYear(now)
		seq, err := tx.NextTicketCounter(ctx, year)
		if err != nil {
			return err
		}
		if t.TicketNo, err = FormatTicketNo(format, year, seq); err != nil {
			return err
		}
		return tx.InsertTicket(ctx, t)
	})
	if err != nil {
		return TicketDetail{}, err
	}
	return s.Ticket(ctx, v, t.ID)
}

func lockPhotos(ctx context.Context, tx TxRepository, uploader uuid.UUID, ids []uuid.UUID, now time.Time) error {
	if len(ids) == 0 {
		return nil
	}
	n, err := tx.LockAttachablePhotos(ctx, uploader, ids, now.Add(-photoTTL))
	if err != nil {
		return err
	}
	if n != len(ids) {
		return ErrPhotoNotAttachable
	}
	return nil
}

// RecentPlaces implements endpoint #28 (CR-008): the caller's last distinct places.
func (s *Service) RecentPlaces(ctx context.Context, v Viewer) ([]RecentPlace, error) {
	return s.repo.ListRecentPlaces(ctx, v.ID)
}

// Ticket implements endpoint #8.
func (s *Service) Ticket(ctx context.Context, v Viewer, id uuid.UUID) (TicketDetail, error) {
	d, err := s.repo.GetTicket(ctx, id, v.ID)
	if err != nil {
		return TicketDetail{}, err
	}
	acc := ticketAccess{ReporterID: d.Reporter.ID, ViewerSubscribed: d.ViewerSubscribed}
	if d.Technician != nil {
		acc.HolderID = &d.Technician.ID
	}
	if !canView(v, acc) {
		return TicketDetail{}, apperr.ErrForbidden
	}
	decorate(v, &d.TicketSummary)
	if !isStaff(v.Role) && d.Result != nil {
		// The contractor's score is internal (BR-F24-4).
		r := *d.Result
		r.ContractorRating, r.ContractorRatingComment = nil, nil
		d.Result = &r
	}
	d.AllowedActions, d.BlockedActions = allowedActions(v, d)
	return d, nil
}

// Tickets implements endpoint #6.
func (s *Service) Tickets(ctx context.Context, v Viewer, f TicketFilter) ([]TicketSummary, int64, error) {
	if err := s.checkScope(v, f); err != nil {
		return nil, 0, err
	}
	list, total, err := s.repo.ListTickets(ctx, v.ID, f)
	if err != nil {
		return nil, 0, err
	}
	for i := range list {
		decorate(v, &list[i])
	}
	return list, total, nil
}

// TicketCounts implements endpoint #7.
func (s *Service) TicketCounts(ctx context.Context, v Viewer, f TicketFilter) (TicketCounts, error) {
	if err := s.checkScope(v, f); err != nil {
		return TicketCounts{}, err
	}
	return s.repo.CountTickets(ctx, v.ID, f)
}

// checkScope: scope=all is for the technician, admin and executive (BR-F06-1, CR-005).
func (s *Service) checkScope(v Viewer, f TicketFilter) error {
	if f.ScopeAll && !seesAllTickets(v.Role) {
		return apperr.ErrForbidden
	}
	return nil
}

// lockOpen locks the ticket and checks it is in `want`; a closed ticket → TICKET_CLOSED.
func lockOpen(ctx context.Context, tx TxRepository, id uuid.UUID, want string) (LockedTicket, error) {
	t, err := tx.LockTicket(ctx, id)
	if err != nil {
		return LockedTicket{}, err
	}
	return t, checkState(t, want)
}

func checkState(t LockedTicket, want string) error {
	switch {
	case t.Status == StatusClosed:
		return ErrTicketClosed
	case t.Status != want:
		return ErrInvalidState
	}
	return nil
}

// Assess implements endpoint #9: the technician sets (or changes) the expected finish date and
// who does the work — in house or a contractor (BR-F21-2, CR-006).
func (s *Service) Assess(ctx context.Context, v Viewer, id uuid.UUID, in AssessInput) (TicketDetail, error) {
	if v.Role != users.RoleTechnician {
		return TicketDetail{}, ErrNotTechnician
	}
	now := s.now()
	if fields := validateAssess(in, bangkokDate(now)); len(fields) > 0 {
		return TicketDetail{}, apperr.Validation(fields)
	}
	if in.WorkBy == WorkByInHouse {
		in.ContractorID = nil
	}
	in.Reason = strings.TrimSpace(in.Reason)
	data := map[string]string{"expectedDoneOn": in.ExpectedDoneOn.Format(time.DateOnly), "workBy": in.WorkBy}
	err := s.repo.InTx(ctx, func(tx TxRepository) error {
		t, err := lockOpen(ctx, tx, id, StatusInProgress)
		if err != nil {
			return err
		}
		// CR-008: the reason is kept only when the assessment changes; the reporter sees it.
		if t.Assessed && in.Reason != "" {
			data["reason"] = in.Reason
		}
		if in.ContractorID != nil {
			ok, err := tx.ActiveContractorExists(ctx, *in.ContractorID)
			if err != nil {
				return err
			}
			if !ok {
				return ErrContractorInactive
			}
		}
		if err := tx.AssessTicket(ctx, id, v.ID, in, now); err != nil {
			return err
		}
		typ := EventAssessed
		if t.Assessed {
			typ = EventAssessmentChanged
		}
		return tx.InsertEvent(ctx, NewEvent{ID: uuid.New(), TicketID: id, Type: typ, ActorID: &v.ID, At: now, Data: mustJSON(data)})
	})
	if err != nil {
		return TicketDetail{}, err
	}
	return s.Ticket(ctx, v, id)
}

// Resolve implements endpoint #10: result note + photos and, for a contractor job, the contractor
// rating (BR-F21-4, BR-F24-3). Who did the work was set by the assessment (CR-006).
func (s *Service) Resolve(ctx context.Context, v Viewer, id uuid.UUID, in ResolveInput) (TicketDetail, error) {
	if v.Role != users.RoleTechnician {
		return TicketDetail{}, ErrNotTechnician
	}
	now := s.now()
	err := s.repo.InTx(ctx, func(tx TxRepository) error {
		t, err := lockOpen(ctx, tx, id, StatusInProgress)
		if err != nil {
			return err
		}
		if !t.Assessed {
			return ErrAssessmentRequired
		}
		var fields map[string]string
		in, fields = validateResolve(in, t.WorkBy == WorkByContractor, !t.Rated)
		if len(fields) > 0 {
			return apperr.Validation(fields)
		}
		if err := lockPhotos(ctx, tx, v.ID, in.PhotoIDs, now); err != nil {
			return err
		}
		if err := tx.ResolveTicket(ctx, id, v.ID, in, now, now.Add(AutoCloseAfter)); err != nil {
			return err
		}
		note := in.Note
		return tx.InsertEvent(ctx, NewEvent{ID: uuid.New(), TicketID: id, Type: EventResolved, ActorID: &v.ID, At: now,
			Note: &note, Data: []byte("{}"), PhotoKind: PhotoKindResult, PhotoIDs: in.PhotoIDs})
	})
	if err != nil {
		return TicketDetail{}, err
	}
	return s.Ticket(ctx, v, id)
}

// Confirm implements endpoint #11: the reporter rates the work 1–5 (required, BR-F07-2) → closed.
func (s *Service) Confirm(ctx context.Context, v Viewer, id uuid.UUID, rating *int, comment string) (TicketDetail, error) {
	comment = strings.TrimSpace(comment)
	fields := map[string]string{}
	switch {
	case rating == nil:
		fields["rating"] = "REQUIRED"
	case *rating < 1 || *rating > 5:
		fields["rating"] = "INVALID"
	}
	checkText(fields, "comment", comment, MaxCommentChars, false)
	if len(fields) > 0 {
		return TicketDetail{}, apperr.Validation(fields)
	}
	now := s.now()
	err := s.repo.InTx(ctx, func(tx TxRepository) error {
		t, err := tx.LockTicket(ctx, id)
		if err != nil {
			return err
		}
		if t.ReporterID != v.ID {
			return ErrNotReporter
		}
		if err := checkState(t, StatusResolved); err != nil {
			return err
		}
		r := int16(*rating) // #nosec G115 -- validated 1–5
		if err := tx.ConfirmTicket(ctx, id, r, optional(comment), now); err != nil {
			return err
		}
		return tx.InsertEvent(ctx, NewEvent{ID: uuid.New(), TicketID: id, Type: EventConfirmed, ActorID: &v.ID, At: now,
			Note: optional(comment), Data: mustJSON(map[string]int{"rating": *rating})})
	})
	if err != nil {
		return TicketDetail{}, err
	}
	return s.Ticket(ctx, v, id)
}

// SendBack implements endpoint #12: the reporter returns the work with a reason. The ticket
// moves on to the "reworking" step with the same technician (BR-F07-3, CR-005).
func (s *Service) SendBack(ctx context.Context, v Viewer, id uuid.UUID, reason string, photoIDs []uuid.UUID) (TicketDetail, error) {
	reason = strings.TrimSpace(reason)
	photoIDs = uniqueIDs(photoIDs)
	fields := map[string]string{}
	checkText(fields, "reason", reason, MaxNoteChars, true)
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
		if t.ReporterID != v.ID {
			return ErrNotReporter
		}
		if err := checkState(t, StatusResolved); err != nil {
			return err
		}
		if err := lockPhotos(ctx, tx, v.ID, photoIDs, now); err != nil {
			return err
		}
		if err := tx.SendBackTicket(ctx, id, now); err != nil {
			return err
		}
		return tx.InsertEvent(ctx, NewEvent{ID: uuid.New(), TicketID: id, Type: EventSentBack, ActorID: &v.ID, At: now,
			Note: &reason, Data: []byte("{}"), PhotoKind: PhotoKindSendBack, PhotoIDs: photoIDs})
	})
	if err != nil {
		return TicketDetail{}, err
	}
	return s.Ticket(ctx, v, id)
}

// AutoClose closes resolved tickets nobody rated within 3 days (BR-F07-4). main.go runs it periodically.
func (s *Service) AutoClose(ctx context.Context) (int, error) {
	return s.repo.AutoCloseDue(ctx, s.now())
}

// ---- contractors (F24) ----

func checkStaff(v Viewer) error {
	if !isStaff(v.Role) {
		return apperr.ErrForbidden
	}
	return nil
}

// ContractorTypes implements endpoint #13.
func (s *Service) ContractorTypes(ctx context.Context, v Viewer) ([]Ref, error) {
	if err := checkStaff(v); err != nil {
		return nil, err
	}
	return s.repo.ListContractorTypes(ctx)
}

// CreateContractorType implements endpoint #14: an existing name (any case) returns that type (BR-F24-2).
func (s *Service) CreateContractorType(ctx context.Context, v Viewer, name string) (Ref, error) {
	if v.Role != users.RoleTechnician {
		return Ref{}, ErrNotTechnician
	}
	name = strings.Join(strings.Fields(name), " ")
	fields := map[string]string{}
	checkText(fields, "name", name, MaxTypeNameChars, true)
	if len(fields) > 0 {
		return Ref{}, apperr.Validation(fields)
	}
	return s.repo.EnsureContractorType(ctx, name, v.ID)
}

// Contractors implements endpoint #15.
func (s *Service) Contractors(ctx context.Context, v Viewer, f ContractorFilter) ([]Contractor, int64, error) {
	if err := checkStaff(v); err != nil {
		return nil, 0, err
	}
	return s.repo.ListContractors(ctx, f)
}

// Contractor implements endpoint #17.
func (s *Service) Contractor(ctx context.Context, v Viewer, id uuid.UUID) (Contractor, error) {
	if err := checkStaff(v); err != nil {
		return Contractor{}, err
	}
	return s.repo.GetContractor(ctx, id)
}

// ContractorJobs implements endpoint #19 (S18 history).
func (s *Service) ContractorJobs(ctx context.Context, v Viewer, id uuid.UUID, page, pageSize int) ([]ContractorJob, int64, error) {
	if err := checkStaff(v); err != nil {
		return nil, 0, err
	}
	if _, err := s.repo.GetContractor(ctx, id); err != nil {
		return nil, 0, err
	}
	return s.repo.ListContractorJobs(ctx, id, page, pageSize)
}

// CreateContractor implements endpoint #16 (technician only, BR-F24-1).
func (s *Service) CreateContractor(ctx context.Context, v Viewer, in ContractorInput) (Contractor, error) {
	id := uuid.New()
	in.IsActive = true
	if err := s.saveContractor(ctx, v, in, func(tx TxRepository, in ContractorInput) error {
		return tx.InsertContractor(ctx, id, in, v.ID)
	}, id); err != nil {
		return Contractor{}, err
	}
	return s.repo.GetContractor(ctx, id)
}

// UpdateContractor implements endpoint #18 (technician only; deactivate instead of delete).
func (s *Service) UpdateContractor(ctx context.Context, v Viewer, id uuid.UUID, in ContractorInput) (Contractor, error) {
	if err := s.saveContractor(ctx, v, in, func(tx TxRepository, in ContractorInput) error {
		found, err := tx.UpdateContractor(ctx, id, in)
		if err == nil && !found {
			return ErrContractorNotFound
		}
		return err
	}, id); err != nil {
		return Contractor{}, err
	}
	return s.repo.GetContractor(ctx, id)
}

func (s *Service) saveContractor(ctx context.Context, v Viewer, in ContractorInput, write func(TxRepository, ContractorInput) error, id uuid.UUID) error {
	if v.Role != users.RoleTechnician {
		return ErrNotTechnician
	}
	in, fields := validateContractor(in)
	if len(fields) > 0 {
		return apperr.Validation(fields)
	}
	return s.repo.InTx(ctx, func(tx TxRepository) error {
		n, err := tx.CountContractorTypes(ctx, in.TypeIDs)
		if err != nil {
			return err
		}
		if n != len(in.TypeIDs) {
			return ErrContractorTypeAbsent
		}
		if err := write(tx, in); err != nil {
			return err
		}
		return tx.SetContractorTypes(ctx, id, in.TypeIDs)
	})
}

func mustJSON(v any) []byte {
	b, err := json.Marshal(v)
	if err != nil {
		panic(err) // only plain maps of strings / ints are passed
	}
	return b
}
