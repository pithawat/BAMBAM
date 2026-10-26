package repair

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"github.com/pithawat/BAMBAM/backend/internal/platform/apperr"
	"github.com/pithawat/BAMBAM/backend/internal/platform/users"
)

// assertNameTaken checks a 409 CONTRACTOR_NAME_TAKEN pointing at the contractor that has the name (CR-023).
func assertNameTaken(t *testing.T, err error, owner uuid.UUID, active bool) {
	t.Helper()
	e, ok := apperr.As(err)
	if !ok || e.Code != "CONTRACTOR_NAME_TAKEN" || e.Kind != apperr.KindConflict {
		t.Fatalf("err = %v, want 409 CONTRACTOR_NAME_TAKEN", err)
	}
	d, _ := e.Details.(map[string]any)
	if d["contractorId"] != owner || d["isActive"] != active {
		t.Fatalf("details = %v, want contractorId %s isActive %v", e.Details, owner, active)
	}
}

// BR-F24-6 (CR-023): shop names are unique ignoring case and repeated spaces, deactivated ones included;
// a branch goes in the name.
func TestContractorNameUnique(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	tech := Viewer{ID: uuid.New(), Role: users.RoleTechnician}
	types := []uuid.UUID{uuid.New()}
	create := func(name string) (Contractor, error) {
		return f.svc.CreateContractor(ctx, tech, ContractorInput{Name: name, TypeIDs: types})
	}

	cool, err := create("  Cool   Air Service ")
	if err != nil {
		t.Fatal(err)
	}
	if cool.Name != "Cool Air Service" {
		t.Fatalf("name = %q, want trimmed and spaces collapsed", cool.Name)
	}
	_, err = create("cool air  SERVICE")
	assertNameTaken(t, err, cool.ID, true)
	if _, err := create("Cool Air Service สาขาบางนา"); err != nil {
		t.Fatalf("branch in the name: %v", err)
	}

	// Editing keeps its own name; renaming onto another contractor's name is refused.
	other, err := create("ร้านแอร์เย็นฉ่ำ")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := f.svc.UpdateContractor(ctx, tech, other.ID, ContractorInput{Name: "ร้านแอร์เย็นฉ่ำ", TypeIDs: types, IsActive: true}); err != nil {
		t.Fatalf("same name on itself: %v", err)
	}
	_, err = f.svc.UpdateContractor(ctx, tech, other.ID, ContractorInput{Name: "COOL AIR SERVICE", TypeIDs: types, IsActive: true})
	assertNameTaken(t, err, cool.ID, true)

	// A deactivated shop still owns its name: re-activate it instead of adding a copy.
	if _, err := f.svc.UpdateContractor(ctx, tech, other.ID, ContractorInput{Name: "ร้านแอร์เย็นฉ่ำ", TypeIDs: types, IsActive: false}); err != nil {
		t.Fatal(err)
	}
	_, err = create("ร้านแอร์เย็นฉ่ำ")
	assertNameTaken(t, err, other.ID, false)
}
