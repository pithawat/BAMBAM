package users

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/google/uuid"

	"github.com/pithawat/BAMBAM/backend/internal/platform/audit"
)

// F15 rules (settings Stage 3): not yourself, not an env-defined Superadmin, same role = no-op without
// an audit row, a deleted role = ROLE_NOT_FOUND, the audit row holds the name only (PDPA).

type fakeAdminRepo struct {
	people  map[uuid.UUID]Summary
	roles   map[uuid.UUID]RoleRef
	audits  []audit.Entry
	lastQ   *SearchInput
	setRole map[string]uuid.UUID
}

func (f *fakeAdminRepo) Search(_ context.Context, in SearchInput) ([]Summary, int64, error) {
	f.lastQ = &in
	out := []Summary{}
	for _, s := range f.people {
		out = append(out, s)
	}
	return out, int64(len(out)), nil
}

func (f *fakeAdminRepo) GetSummary(_ context.Context, id uuid.UUID) (Summary, error) {
	s, ok := f.people[id]
	if !ok {
		return Summary{}, ErrUserNotFound
	}
	if r, changed := f.setRole[s.EmployeeCode]; changed {
		s.RoleRef = f.roles[r]
	}
	return s, nil
}

func (f *fakeAdminRepo) InTx(ctx context.Context, fn func(tx AdminTx) error) error {
	// commit only on success, like db.WithTx
	staged := &fakeAdminTx{repo: f}
	if err := fn(staged); err != nil {
		return err
	}
	for code, id := range staged.set {
		f.setRole[code] = id
	}
	f.audits = append(f.audits, staged.audits...)
	return nil
}

type fakeAdminTx struct {
	repo   *fakeAdminRepo
	set    map[string]uuid.UUID
	audits []audit.Entry
}

func (t *fakeAdminTx) LockRole(_ context.Context, id uuid.UUID) (RoleRef, error) {
	r, ok := t.repo.roles[id]
	if !ok {
		return RoleRef{}, ErrTargetRoleNotFound
	}
	return r, nil
}

func (t *fakeAdminTx) SetRole(_ context.Context, code string, id uuid.UUID) error {
	if t.set == nil {
		t.set = map[string]uuid.UUID{}
	}
	t.set[code] = id
	return nil
}

func (t *fakeAdminTx) Audit(_ context.Context, e audit.Entry) error {
	t.audits = append(t.audits, e)
	return nil
}

type envCodes []string

func (e envCodes) IsEnvSuperAdmin(code string) bool {
	for _, c := range e {
		if c == code {
			return true
		}
	}
	return false
}

func str(s string) *string { return &s }

func adminFixture() (*Admin, *fakeAdminRepo, map[string]uuid.UUID) {
	employee := RoleRef{ID: uuid.New(), Key: RoleEmployee, Name: "พนักงานทั่วไป"}
	housekeeper := RoleRef{ID: uuid.New(), Key: RoleHousekeeperLead, Name: "หัวหน้าแม่บ้าน"}
	super := RoleRef{ID: uuid.New(), Key: RoleSuperAdmin, Name: "Superadmin"}
	ids := map[string]uuid.UUID{"me": uuid.New(), "wanna": uuid.New(), "env": uuid.New(), "housekeeper": housekeeper.ID, "employee": employee.ID, "super": super.ID}
	repo := &fakeAdminRepo{
		people: map[uuid.UUID]Summary{
			ids["me"]:    {User: User{ID: ids["me"], EmployeeCode: "EMP0120"}, RoleRef: super},
			ids["wanna"]: {User: User{ID: ids["wanna"], EmployeeCode: "EMP0412", FirstNameTH: str("วรรณา"), LastNameTH: str("สุขประเสริฐ"), Email: str("wanna.s@example.co.th")}, RoleRef: employee},
			ids["env"]:   {User: User{ID: ids["env"], EmployeeCode: "EMP0105"}, RoleRef: super},
		},
		roles:   map[uuid.UUID]RoleRef{employee.ID: employee, housekeeper.ID: housekeeper, super.ID: super},
		setRole: map[string]uuid.UUID{},
	}
	return NewAdmin(repo, envCodes{"EMP0105"}), repo, ids
}

func TestChangeRole(t *testing.T) {
	ctx := context.Background()
	a, repo, ids := adminFixture()

	got, err := a.ChangeRole(ctx, ids["me"], ids["wanna"], ids["housekeeper"])
	if err != nil || got.RoleRef.Key != RoleHousekeeperLead {
		t.Fatalf("change = %+v, %v", got.RoleRef, err)
	}
	if len(repo.audits) != 1 {
		t.Fatalf("audits = %d, want 1", len(repo.audits))
	}
	e := repo.audits[0]
	b, _ := json.Marshal(e.Data)
	want := `{"entityName":"วรรณา สุขประเสริฐ","changes":[{"field":"role","before":"พนักงานทั่วไป","after":"หัวหน้าแม่บ้าน"}]}`
	if e.Action != "role_change" || e.TargetType != "user" || e.TargetID != ids["wanna"].String() || *e.ActorID != ids["me"] || string(b) != want {
		t.Errorf("audit = %+v %s", e, b)
	}

	// same role again: no-op, no audit row
	if _, err := a.ChangeRole(ctx, ids["me"], ids["wanna"], ids["housekeeper"]); err != nil || len(repo.audits) != 1 {
		t.Errorf("same role: err %v, audits %d", err, len(repo.audits))
	}
}

func TestChangeRoleRefused(t *testing.T) {
	ctx := context.Background()
	a, repo, ids := adminFixture()
	cases := []struct {
		name        string
		actor, user uuid.UUID
		role        uuid.UUID
		want        error
	}{
		{"self", ids["me"], ids["me"], ids["employee"], ErrCannotChangeSelf},
		{"env-defined Superadmin", ids["me"], ids["env"], ids["employee"], ErrRoleLocked},
		{"role deleted meanwhile", ids["me"], ids["wanna"], uuid.New(), ErrTargetRoleNotFound},
		{"unknown user", ids["me"], uuid.New(), ids["employee"], ErrUserNotFound},
	}
	for _, tc := range cases {
		if _, err := a.ChangeRole(ctx, tc.actor, tc.user, tc.role); !errors.Is(err, tc.want) {
			t.Errorf("%s: err = %v, want %v", tc.name, err, tc.want)
		}
	}
	if len(repo.audits) != 0 || len(repo.setRole) != 0 {
		t.Errorf("refused changes wrote: audits %d, roles %d", len(repo.audits), len(repo.setRole))
	}
}

func TestGetLockReason(t *testing.T) {
	ctx := context.Background()
	a, _, ids := adminFixture()
	for who, want := range map[string]string{"me": ReasonSelf, "env": ReasonLockedByEnv, "wanna": ""} {
		s, reason, err := a.Get(ctx, ids["me"], ids[who])
		if err != nil || reason != want {
			t.Errorf("%s: reason %q, want %q (%v)", who, reason, want, err)
		}
		if who == "env" && !s.RoleLockedByEnv {
			t.Errorf("env: RoleLockedByEnv false")
		}
	}
}

func TestSearchIgnoresOneLetter(t *testing.T) {
	a, repo, _ := adminFixture()
	list, _, err := a.Search(context.Background(), SearchInput{Q: " ก ", Page: 1, PageSize: 20})
	if err != nil || repo.lastQ.Q != "" {
		t.Fatalf("q = %q, err %v", repo.lastQ.Q, err)
	}
	for _, s := range list {
		if s.EmployeeCode == "EMP0105" && !s.RoleLockedByEnv {
			t.Errorf("env-defined Superadmin not flagged in search")
		}
	}
	if _, _, _ = a.Search(context.Background(), SearchInput{Q: "EMP0231", Page: 1, PageSize: 20}); repo.lastQ.Q != "EMP0231" {
		t.Errorf("q = %q", repo.lastQ.Q)
	}
}
