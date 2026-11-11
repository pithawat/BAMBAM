package repair

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/pithawat/BAMBAM/backend/internal/platform/apperr"
	"github.com/pithawat/BAMBAM/backend/internal/platform/users"
)

// Stage 4: F03 duplicates + follow, F04 team handled, F05 hand over.

// report creates a ticket in f.room (the shared "same place") as v.
func (f *fixture) report(t *testing.T, v Viewer) TicketDetail {
	t.Helper()
	in := f.input(f.upload(t, v))
	in.RoomID = &f.room
	d, err := f.svc.CreateTicket(context.Background(), v, in)
	if err != nil {
		t.Fatalf("report: %v", err)
	}
	return d
}

// another adds an open ticket by someone else in f.room without the duplicate check (as if it was
// reported before a match existed).
func (f *fixture) another(t *testing.T) TicketDetail {
	t.Helper()
	v := employee()
	d, err := f.svc.CreateTicket(context.Background(), v, f.input(f.upload(t, v)))
	if err != nil {
		t.Fatal(err)
	}
	f.repo.tickets[d.ID].Room = &Ref{ID: f.room}
	return d
}

func (f *fixture) setStatus(id uuid.UUID, status string) {
	f.repo.tickets[id].Status = status
	if status == StatusClosed {
		r := "confirmed"
		f.repo.tickets[id].ClosedReason = &r
	}
}

func employee() Viewer { return viewerAs(users.RoleEmployee, uuid.New()) }

// ---- F03: BR-F03-1 matching, BR-F03-2 refusal, BR-F03-4 own ticket ----

func TestCreateRefusesDuplicate(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	first := f.report(t, f.reporter)
	other := employee()

	in := f.input(f.upload(t, other))
	in.RoomID = &f.room
	_, err := f.svc.CreateTicket(ctx, other, in)
	var dup *DuplicateFoundError
	if !errors.As(err, &dup) || len(dup.Tickets) != 1 || dup.Tickets[0].ID != first.ID {
		t.Fatalf("err = %v, want DUPLICATE_FOUND with %s", err, first.TicketNo)
	}
	if d := dup.Tickets[0]; d.ViewerRelation != RelationNone || d.Contractor != nil {
		t.Fatalf("match not decorated for the caller: relation=%s", d.ViewerRelation)
	}
	if len(f.repo.inserted) != 1 || f.repo.counters[2026] != 1 {
		t.Fatal("a refused duplicate was inserted or used a ticket number")
	}
	if len(f.repo.dupLocks) != 2 || f.repo.dupLocks[1] != (DuplicateKey{CategoryID: f.cat, FloorID: f.floor, RoomID: f.room, Spot: "ฝั่งหน้าต่าง"}) {
		t.Fatalf("duplicate key not locked: %v", f.repo.dupLocks)
	}

	// Another room on the same floor, or another category, is a new problem (CR-009 follow-up answer).
	if _, err := f.svc.CreateTicket(ctx, other, f.input(f.upload(t, other))); err != nil {
		t.Fatalf("other room: %v", err)
	}
	in = f.input(f.upload(t, other))
	in.RoomID, in.CategoryID, in.SymptomIDs = &f.room, &f.other, []uuid.UUID{f.otherSym}
	if _, err := f.svc.CreateTicket(ctx, other, in); err != nil {
		t.Fatalf("other category: %v", err)
	}

	// Resolved still counts as open; a closed ticket no longer blocks.
	f.setStatus(first.ID, StatusResolved)
	in = f.input(f.upload(t, other))
	in.RoomID = &f.room
	if _, err := f.svc.CreateTicket(ctx, other, in); !errors.As(err, &dup) {
		t.Fatalf("resolved match: err = %v", err)
	}
	f.setStatus(first.ID, StatusClosed)
	if _, err := f.svc.CreateTicket(ctx, other, in); err != nil {
		t.Fatalf("closed match must not block: %v", err)
	}
}

func TestDuplicateOwnTicketAwaitingRating(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	first := f.report(t, f.reporter)

	// Own ticket still in progress → DUPLICATE_FOUND (S04 shows "ดูงานของคุณ").
	in := f.input(f.upload(t, f.reporter))
	in.RoomID = &f.room
	var dup *DuplicateFoundError
	if _, err := f.svc.CreateTicket(ctx, f.reporter, in); !errors.As(err, &dup) || dup.Tickets[0].ViewerRelation != RelationReporter {
		t.Fatalf("own open ticket: err = %v", err)
	}

	// Own ticket waiting for ประเมินตรวจงาน → OWN_TICKET_AWAITING_RATING, even with other matches (BR-F03-4).
	f.another(t)
	f.repo.tickets[first.ID].Status = StatusResolved
	var own *OwnTicketAwaitingRatingError
	if _, err := f.svc.CreateTicket(ctx, f.reporter, in); !errors.As(err, &own) || own.TicketID != first.ID {
		t.Fatalf("err = %v, want OWN_TICKET_AWAITING_RATING %s", err, first.ID)
	}
	// For someone else the same ticket is an ordinary duplicate.
	other := employee()
	in = f.input(f.upload(t, other))
	in.RoomID = &f.room
	if _, err := f.svc.CreateTicket(ctx, other, in); !errors.As(err, &dup) || len(dup.Tickets) != 2 {
		t.Fatalf("other user: err = %v", err)
	}
}

func TestDuplicatesEndpoint(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	older := f.report(t, f.reporter)
	f.setStatus(older.ID, StatusResolved)
	newer := f.another(t)
	k := DuplicateKey{CategoryID: f.cat, FloorID: f.floor, RoomID: f.room}

	list, err := f.svc.Duplicates(ctx, f.reporter, k)
	if err != nil || len(list) != 2 || list[0].ID != newer.ID || list[1].ID != older.ID {
		t.Fatalf("list = %v err=%v, want newest first", list, err)
	}
	if list[1].ViewerRelation != RelationReporter || !list[1].AwaitingMyConfirmation {
		t.Fatalf("own ticket not marked: %+v", list[1].TicketSummary)
	}
	k.RoomID = uuid.New()
	if list, _ := f.svc.Duplicates(ctx, f.reporter, k); len(list) != 0 {
		t.Fatalf("other room matched: %v", list)
	}
}

// ---- F03: follow ----

func TestFollow(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	d := f.report(t, f.reporter)
	follower := employee()
	photo := f.upload(t, follower)

	got, err := f.svc.Follow(ctx, follower, d.ID, "  น้ำหยดใส่โต๊ะประชุม ", []uuid.UUID{photo, photo})
	if err != nil || got.ViewerRelation != RelationSubscriber {
		t.Fatalf("follow: relation=%s err=%v", got.ViewerRelation, err)
	}
	e := f.repo.events[len(f.repo.events)-1]
	if e.Type != EventSubscribed || *e.Note != "น้ำหยดใส่โต๊ะประชุม" || e.PhotoKind != PhotoKindFollow || len(e.PhotoIDs) != 1 || *e.ActorID != follower.ID {
		t.Fatalf("event = %+v", e)
	}
	if list, _, _ := f.svc.Tickets(ctx, follower, TicketFilter{Relation: "all"}); len(list) != 1 || list[0].ViewerRelation != RelationSubscriber {
		t.Fatalf("followed ticket missing from mine: %v", list)
	}
	// A follower cannot rate (BR-F03-3).
	f.repo.tickets[d.ID].Status = StatusResolved
	if got, _ := f.svc.Ticket(ctx, follower, d.ID); len(got.AllowedActions) != 0 {
		t.Fatalf("follower actions: %v", got.AllowedActions)
	}
	f.repo.tickets[d.ID].Status = StatusInProgress

	cases := []struct {
		name string
		v    Viewer
		note string
		pics []uuid.UUID
		code string
	}{
		{"again", follower, "", nil, "ALREADY_FOLLOWING"},
		{"reporter", f.reporter, "", nil, "ALREADY_FOLLOWING"},
		{"note too long", employee(), strings.Repeat("ก", 501), nil, "VALIDATION_FAILED"},
		{"six photos", employee(), "", []uuid.UUID{uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New()}, "VALIDATION_FAILED"},
		{"someone else's photo", employee(), "", []uuid.UUID{f.upload(t, follower)}, "PHOTO_NOT_FOUND"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := f.svc.Follow(ctx, tc.v, d.ID, tc.note, tc.pics); code(err) != tc.code {
				t.Fatalf("err = %v, want %s", err, tc.code)
			}
		})
	}

	// Note and photos are optional.
	if _, err := f.svc.Follow(ctx, employee(), d.ID, "", nil); err != nil {
		t.Fatalf("follow without note: %v", err)
	}
	f.setStatus(d.ID, StatusClosed)
	if _, err := f.svc.Follow(ctx, employee(), d.ID, "", nil); code(err) != "TICKET_CLOSED" {
		t.Fatalf("closed meanwhile: err = %v", err)
	}
	if _, err := f.svc.Follow(ctx, employee(), uuid.New(), "", nil); code(err) != "TICKET_NOT_FOUND" {
		t.Fatalf("unknown: err = %v", err)
	}
}

// D-098: report photos of an open ticket are visible to every reporter (S04); other kinds are not.
func TestOpenPhotoOfOpenDuplicate(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	d := f.report(t, f.reporter)
	stranger := employee()
	if _, _, err := f.svc.OpenPhoto(ctx, stranger, d.Photos[0], true); err != nil {
		t.Fatalf("report photo of an open ticket: %v", err)
	}
	follower := employee()
	followPhoto := f.upload(t, follower)
	if _, err := f.svc.Follow(ctx, follower, d.ID, "", []uuid.UUID{followPhoto}); err != nil {
		t.Fatal(err)
	}
	if _, _, err := f.svc.OpenPhoto(ctx, stranger, followPhoto, true); !errors.Is(err, apperr.ErrForbidden) {
		t.Fatalf("follow photo: err = %v", err)
	}
	f.setStatus(d.ID, StatusClosed)
	if _, _, err := f.svc.OpenPhoto(ctx, stranger, d.Photos[0], true); !errors.Is(err, apperr.ErrForbidden) {
		t.Fatalf("report photo of a closed ticket: err = %v", err)
	}
}

// ---- F04: team handled ----

func (f *fixture) teamInput(t *testing.T, v Viewer) CreateTicketInput {
	t.Helper()
	in := f.input(f.upload(t, v))
	in.TeamHandled = &TeamHandledInput{Note: " เช็ดพื้นและวางป้ายระวังลื่นแล้ว ", PhotoIDs: []uuid.UUID{f.upload(t, v)}}
	return in
}

func TestTeamHandledRoles(t *testing.T) {
	ctx := context.Background()
	for _, role := range []string{users.RoleEmployee, users.RoleTechnician, users.RoleAdmin} {
		t.Run(role, func(t *testing.T) {
			f := newFixture(t)
			v := viewerAs(role, uuid.New())
			if _, err := f.svc.CreateTicket(ctx, v, f.teamInput(t, v)); code(err) != "TEAM_HANDLED_NOT_ALLOWED" {
				t.Fatalf("err = %v", err)
			}
			if len(f.repo.inserted) != 0 {
				t.Fatal("inserted")
			}
		})
	}
	for _, role := range []string{users.RoleHousekeeperLead, users.RoleSecurityLead, users.RoleSuperAdmin} {
		t.Run(role, func(t *testing.T) {
			f := newFixture(t)
			v := viewerAs(role, uuid.New())
			in := f.teamInput(t, v)
			d, err := f.svc.CreateTicket(ctx, v, in)
			if err != nil {
				t.Fatal(err)
			}
			// BR-F04-3: closed at once, never waiting for the technician.
			if d.Status != StatusClosed || *d.ClosedReason != ClosedReasonTeamHandled || d.Step() != StepClosed || !f.repo.inserted[0].TeamHandled {
				t.Fatalf("status=%s reason=%v", d.Status, d.ClosedReason)
			}
			e := f.repo.events[len(f.repo.events)-1]
			if e.Type != EventTeamHandled || *e.Note != "เช็ดพื้นและวางป้ายระวังลื่นแล้ว" || e.PhotoKind != PhotoKindTeam ||
				len(e.PhotoIDs) != 1 || !e.At.After(f.now) {
				t.Fatalf("team event = %+v", e)
			}
			if f.repo.kinds[in.PhotoIDs[0]] != PhotoKindReport || f.repo.kinds[in.TeamHandled.PhotoIDs[0]] != PhotoKindTeam {
				t.Fatal("photo kinds")
			}
		})
	}
}

func TestTeamHandledValidation(t *testing.T) {
	ctx := context.Background()
	lead := viewerAs(users.RoleHousekeeperLead, uuid.New())
	cases := []struct {
		name  string
		edit  func(f *fixture, in *CreateTicketInput)
		field string
		code  string
	}{
		{"no note", func(_ *fixture, in *CreateTicketInput) { in.TeamHandled.Note = "  " }, "teamHandled.note", "REQUIRED"},
		{"long note", func(_ *fixture, in *CreateTicketInput) { in.TeamHandled.Note = strings.Repeat("ก", 501) }, "teamHandled.note", "TOO_LONG"},
		{"no after photo", func(_ *fixture, in *CreateTicketInput) { in.TeamHandled.PhotoIDs = nil }, "teamHandled.photoIds", "MIN_ITEMS"},
		{"same photo twice", func(_ *fixture, in *CreateTicketInput) { in.TeamHandled.PhotoIDs = in.PhotoIDs }, "teamHandled.photoIds", "INVALID"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f := newFixture(t)
			in := f.teamInput(t, lead)
			tc.edit(f, &in)
			_, err := f.svc.CreateTicket(ctx, lead, in)
			if e, ok := apperr.As(err); !ok || e.Fields[tc.field] != tc.code {
				t.Fatalf("err = %v, want %s=%s", err, tc.field, tc.code)
			}
		})
	}
	// A team record goes through the duplicate check too (BR-F04-3).
	f := newFixture(t)
	f.report(t, f.reporter)
	in := f.teamInput(t, lead)
	in.RoomID = &f.room
	var dup *DuplicateFoundError
	if _, err := f.svc.CreateTicket(ctx, lead, in); !errors.As(err, &dup) {
		t.Fatalf("team duplicate: err = %v", err)
	}
	// After photos must be the lead's own, unattached uploads.
	in = f.teamInput(t, lead)
	in.TeamHandled.PhotoIDs = []uuid.UUID{f.upload(t, f.reporter)}
	if _, err := f.svc.CreateTicket(ctx, lead, in); code(err) != "PHOTO_NOT_FOUND" {
		t.Fatalf("other's after photo: err = %v", err)
	}
}

// ---- F05: hand over, BR-F05-1/2/3 ----

func TestHandOverPermissionMatrix(t *testing.T) {
	ctx := context.Background()
	lead := viewerAs(users.RoleHousekeeperLead, uuid.New())
	cases := []struct {
		name string
		v    Viewer
		code string
	}{
		{"recording lead", lead, ""},
		{"admin", viewerAs(users.RoleAdmin, uuid.New()), ""},
		{"other lead", viewerAs(users.RoleHousekeeperLead, uuid.New()), "FORBIDDEN"},
		{"other team's lead", viewerAs(users.RoleSecurityLead, uuid.New()), "FORBIDDEN"},
		{"employee", employee(), "FORBIDDEN"},
		{"technician", viewerAs(users.RoleTechnician, uuid.New()), "FORBIDDEN"},
		{"super_admin", viewerAs(users.RoleSuperAdmin, uuid.New()), ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f := newFixture(t)
			team, err := f.svc.CreateTicket(ctx, lead, f.teamInput(t, lead))
			if err != nil {
				t.Fatal(err)
			}
			view, _ := f.svc.Ticket(ctx, tc.v, team.ID)
			hasAction := false
			for _, a := range view.AllowedActions {
				hasAction = hasAction || a == ActionHandover
			}
			if hasAction != (tc.code == "") {
				t.Fatalf("allowedActions = %v", view.AllowedActions)
			}

			d, err := f.svc.HandOver(ctx, tc.v, team.ID, " ทีมเช็ดแล้วแต่ยังมีน้ำซึมจากฝ้า ")
			if code(err) != tc.code {
				t.Fatalf("err = %v, want %q", err, tc.code)
			}
			if tc.code != "" {
				if f.repo.tickets[team.ID].Status != StatusClosed {
					t.Fatal("a refused hand over changed the ticket")
				}
				return
			}
			// Same ticket, back to the technician waiting for the assessment (BR-F05-3, CR-005).
			if d.ID != team.ID || d.TicketNo != team.TicketNo || d.Status != StatusInProgress || d.ClosedReason != nil ||
				d.Step() != StepAwaitingAssessment {
				t.Fatalf("after hand over: %+v", d.TicketSummary)
			}
			e := f.repo.events[len(f.repo.events)-1]
			if e.Type != EventHandedOver || *e.Note != "ทีมเช็ดแล้วแต่ยังมีน้ำซึมจากฝ้า" || *e.ActorID != tc.v.ID {
				t.Fatalf("event = %+v", e)
			}
			if _, err := f.svc.HandOver(ctx, tc.v, team.ID, "อีกครั้ง"); code(err) != "NOT_TEAM_HANDLED" {
				t.Fatalf("second hand over: err = %v", err)
			}
		})
	}
}

func TestHandOverRules(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	lead := viewerAs(users.RoleSecurityLead, uuid.New())
	admin := viewerAs(users.RoleAdmin, uuid.New())

	// BR-F05-1: only closed / team_handled tickets.
	normal := f.report(t, lead)
	if _, err := f.svc.HandOver(ctx, lead, normal.ID, "เหตุผล"); code(err) != "NOT_TEAM_HANDLED" {
		t.Fatalf("open ticket: err = %v", err)
	}
	f.setStatus(normal.ID, StatusClosed)
	if _, err := f.svc.HandOver(ctx, admin, normal.ID, "เหตุผล"); code(err) != "NOT_TEAM_HANDLED" {
		t.Fatalf("closed by rating: err = %v", err)
	}
	team, err := f.svc.CreateTicket(ctx, lead, f.teamInput(t, lead))
	if err != nil {
		t.Fatal(err)
	}
	for name, reason := range map[string]string{"empty": "  ", "too long": strings.Repeat("ก", 501)} {
		if _, err := f.svc.HandOver(ctx, lead, team.ID, reason); code(err) != "VALIDATION_FAILED" {
			t.Fatalf("%s reason: err = %v", name, err)
		}
	}
	if _, err := f.svc.HandOver(ctx, lead, uuid.New(), "เหตุผล"); code(err) != "TICKET_NOT_FOUND" {
		t.Fatalf("unknown: err = %v", err)
	}
}

// ---- CR-020: a different extra spot in the same room is similar, not a duplicate ----

func TestDuplicateSpotRule(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	first := f.report(t, f.reporter) // spot "ฝั่งหน้าต่าง"
	other := employee()
	in := func(spot string) CreateTicketInput {
		x := f.input(f.upload(t, other))
		x.RoomID, x.LocationDetail = &f.room, spot
		return x
	}
	var dup *DuplicateFoundError
	for name, spot := range map[string]string{"no spot": "  ", "same spot, extra spaces": "  ฝั่งหน้าต่าง   "} {
		if _, err := f.svc.CreateTicket(ctx, other, in(spot)); !errors.As(err, &dup) {
			t.Fatalf("%s: err = %v, want DUPLICATE_FOUND", name, err)
		}
	}
	k := DuplicateKey{CategoryID: f.cat, FloorID: f.floor, RoomID: f.room, Spot: " แอร์ตัวหน้าห้อง "}
	list, err := f.svc.Duplicates(ctx, other, k)
	if err != nil || len(list) != 1 || list[0].ID != first.ID || list[0].BlocksReport {
		t.Fatalf("#22 other spot: %+v err=%v, want similar (not blocking)", list, err)
	}
	second, err := f.svc.CreateTicket(ctx, other, in("แอร์ตัวหน้าห้อง"))
	if err != nil {
		t.Fatalf("other spot must be allowed: %v", err)
	}
	// Now both spots are open: no spot blocks on both; each spot blocks only on its own ticket.
	k.Spot = ""
	if list, _ := f.svc.Duplicates(ctx, other, k); len(list) != 2 || !list[0].BlocksReport || !list[1].BlocksReport {
		t.Fatalf("#22 no spot: %+v", list)
	}
	k.Spot = "แอร์ตัวหน้าห้อง"
	if list, _ := f.svc.Duplicates(ctx, other, k); len(list) != 2 || list[0].ID != second.ID || !list[0].BlocksReport || list[1].BlocksReport {
		t.Fatalf("#22 blocking first: %+v", list)
	}
	// The own-ticket rule only looks at blocking matches.
	f.repo.tickets[first.ID].Status = StatusResolved
	if _, err := f.svc.CreateTicket(ctx, f.reporter, func() CreateTicketInput {
		x := f.input(f.upload(t, f.reporter))
		x.RoomID, x.LocationDetail = &f.room, "อีกตัวหนึ่ง"
		return x
	}()); err != nil {
		t.Fatalf("own resolved ticket on another spot must not block: %v", err)
	}
}
