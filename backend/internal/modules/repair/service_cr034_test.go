package repair

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/pithawat/BAMBAM/backend/internal/platform/apperr"
	"github.com/pithawat/BAMBAM/backend/internal/platform/users"
)

// CR-034 rules on #9 assess, #35 and #36.

func fieldOf(err error, name string) string {
	if e, ok := apperr.As(err); ok {
		return e.Fields[name]
	}
	return ""
}

func (f *fixture) technician() Viewer {
	v := viewerAs(users.RoleTechnician, uuid.New())
	f.repo.techs[v.ID] = true
	return v
}

func (f *fixture) inHouse(day time.Time, assignee *uuid.UUID, reason string) AssessInput {
	return AssessInput{ExpectedDoneOn: &day, WorkBy: WorkByInHouse, AssigneeID: assignee, Reason: reason}
}

// BR (CR-034): an in-house job has one responsible technician who can work on repairs.
func TestAssessInHouseNeedsValidAssignee(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	tech := f.technician()
	d := f.create(t)
	day := time.Date(2026, 10, 20, 0, 0, 0, 0, time.UTC)

	if _, err := f.svc.Assess(ctx, tech, d.ID, f.inHouse(day, nil, "")); fieldOf(err, "assigneeId") != "REQUIRED" {
		t.Fatalf("missing assignee: %v", err)
	}
	employeeID := uuid.New()
	if _, err := f.svc.Assess(ctx, tech, d.ID, f.inHouse(day, &employeeID, "")); code(err) != "ASSIGNEE_INVALID" {
		t.Fatalf("assignee without work permission: %v", err)
	}
	other := f.technician()
	if _, err := f.svc.Assess(ctx, tech, d.ID, f.inHouse(day, &other.ID, "")); err != nil {
		t.Fatalf("valid assignee: %v", err)
	}
	if a := f.repo.tickets[d.ID].Assignee; a == nil || a.ID != other.ID {
		t.Fatalf("assignee = %v, want %s", a, other.ID)
	}

	// A contractor job has no assignee, even if one is sent.
	contractor := uuid.New()
	in := AssessInput{ExpectedDoneOn: &day, WorkBy: WorkByContractor, ContractorID: &contractor, AssigneeID: &other.ID}
	if _, err := f.svc.Assess(ctx, tech, d.ID, in); err != nil {
		t.Fatalf("contractor: %v", err)
	}
	if a := f.repo.tickets[d.ID].Assignee; a != nil {
		t.Fatalf("contractor job keeps assignee %v", a)
	}
}

// BR (CR-034): moving the expected date needs a reason; the first assessment, an unchanged date and the
// re-accept after a send back do not.
func TestRescheduleNeedsReason(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	tech := f.technician()
	d := f.create(t)
	day := time.Date(2026, 10, 20, 0, 0, 0, 0, time.UTC)
	later := day.AddDate(0, 0, 3)

	if _, err := f.svc.Assess(ctx, tech, d.ID, f.inHouse(day, &tech.ID, "")); err != nil {
		t.Fatalf("first assessment without reason: %v", err)
	}
	if _, err := f.svc.Assess(ctx, tech, d.ID, f.inHouse(day, &tech.ID, "")); err != nil {
		t.Fatalf("same date without reason: %v", err)
	}
	if _, err := f.svc.Assess(ctx, tech, d.ID, f.inHouse(later, &tech.ID, "  ")); fieldOf(err, "reason") != "REQUIRED" {
		t.Fatalf("reschedule without reason: %v", err)
	}
	if got := *f.repo.tickets[d.ID].ExpectedDoneOn; !got.Equal(day) {
		t.Fatalf("date changed to %s on a refused reschedule", got)
	}
	if _, err := f.svc.Assess(ctx, tech, d.ID, f.inHouse(later, &tech.ID, "รออะไหล่")); err != nil {
		t.Fatalf("reschedule with reason: %v", err)
	}

	f.repo.tickets[d.ID].SendBackCount = 1 // reworking: the re-accept
	if _, err := f.svc.Assess(ctx, tech, d.ID, f.inHouse(later.AddDate(0, 0, 2), &tech.ID, "")); err != nil {
		t.Fatalf("re-accept without reason: %v", err)
	}
}

// BR (CR-034): tracking (#35) needs `repair.ticket.report`; #36 needs `repair.ticket.work`.
func TestTrackingAndTechnicianListPermissions(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	tech := viewerAs(users.RoleTechnician, uuid.New())
	if _, _, err := f.svc.MyTickets(ctx, tech, TicketFilter{}); code(err) != "FORBIDDEN" {
		t.Fatalf("technician #35: %v", err)
	}
	if _, _, err := f.svc.MyTickets(ctx, f.reporter, TicketFilter{}); err != nil {
		t.Fatalf("employee #35: %v", err)
	}
	if _, err := f.svc.Technicians(ctx, f.reporter); code(err) != "NOT_TECHNICIAN" {
		t.Fatalf("employee #36: %v", err)
	}
	if _, err := f.svc.Technicians(ctx, tech); err != nil {
		t.Fatalf("technician #36: %v", err)
	}
}
