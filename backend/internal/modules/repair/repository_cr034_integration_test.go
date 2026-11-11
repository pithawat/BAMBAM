package repair

import (
	"context"
	"slices"
	"testing"
	"time"

	"github.com/pithawat/BAMBAM/backend/internal/platform/users"
)

// CR-034 against Postgres: the assignee is stored and shown with its role name, #36 lists only users
// whose role has `repair.ticket.work`, and an assignee without it is refused.
func TestPgAssigneeAndTechnicians(t *testing.T) {
	p := newPgFixture(t)
	ctx := context.Background()
	tech := p.user(t, users.RoleTechnician)
	if _, err := p.pool.Exec(ctx, `INSERT INTO platform.user_roles (employee_code, role_id)
		SELECT u.employee_code, r.id FROM platform.users u, platform.roles r WHERE u.id = $1 AND r.key = 'technician'`, tech.ID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = p.pool.Exec(context.Background(),
			`DELETE FROM platform.user_roles WHERE employee_code = (SELECT employee_code FROM platform.users WHERE id = $1)`, tech.ID)
	})
	reporter := p.user(t, users.RoleEmployee) // cleaned first: its tickets go before the technician

	list, err := p.svc.Technicians(ctx, tech)
	if err != nil {
		t.Fatal(err)
	}
	ids := make([]string, 0, len(list))
	for _, s := range list {
		ids = append(ids, s.ID.String())
	}
	if !slices.Contains(ids, tech.ID.String()) || slices.Contains(ids, reporter.ID.String()) {
		t.Fatalf("technicians %v: want %s, not %s", ids, tech.ID, reporter.ID)
	}

	d, err := p.create(reporter, "")
	if err != nil {
		t.Fatal(err)
	}
	day := time.Now().UTC().AddDate(0, 0, 3).Truncate(24 * time.Hour)
	in := AssessInput{ExpectedDoneOn: &day, WorkBy: WorkByInHouse, AssigneeID: &reporter.ID}
	if _, err := p.svc.Assess(ctx, tech, d.ID, in); code(err) != "ASSIGNEE_INVALID" {
		t.Fatalf("employee as assignee: %v", err)
	}
	in.AssigneeID = &tech.ID
	got, err := p.svc.Assess(ctx, tech, d.ID, in)
	if err != nil {
		t.Fatal(err)
	}
	if got.Assignee == nil || got.Assignee.ID != tech.ID || got.Assignee.RoleName != "ช่างเทคนิค" || got.Assignee.Name == "" {
		t.Fatalf("assignee = %+v", got.Assignee)
	}

	// A reschedule without a reason is refused; with one it is kept.
	later := day.AddDate(0, 0, 2)
	in.ExpectedDoneOn = &later
	if _, err := p.svc.Assess(ctx, tech, d.ID, in); fieldOf(err, "reason") != "REQUIRED" {
		t.Fatalf("reschedule without reason: %v", err)
	}
	in.Reason = "รออะไหล่"
	if _, err := p.svc.Assess(ctx, tech, d.ID, in); err != nil {
		t.Fatal(err)
	}
	mine, _, err := p.svc.MyTickets(ctx, reporter, TicketFilter{Relation: "all", Page: 1, PageSize: 10, Sort: "updatedAt:desc"})
	if err != nil || len(mine) != 1 || mine[0].Assignee == nil || mine[0].Assignee.ID != tech.ID {
		t.Fatalf("#35 assignee: %v %+v", err, mine)
	}
}
