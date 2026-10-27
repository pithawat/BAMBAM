package repair

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	repairdb "github.com/pithawat/BAMBAM/backend/internal/modules/repair/db"

	"github.com/pithawat/BAMBAM/backend/internal/platform/apperr"
)

// Runs when TEST_DATABASE_URL points at a migrated database: settings F27 / F28 rules on repair's master data —
// names unique (category globally, symptom per category, type case-insensitive), versions, delete only unused,
// the "อื่น ๆ" category always active, order with version, the repair form hides a category without active symptoms,
// and a technician typing an inactive type name re-activates it.
func TestSettingsAdminMaster(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	tag := uuid.NewString()[:5]
	var actor uuid.UUID
	if err := pool.QueryRow(ctx, `INSERT INTO platform.users (employee_code, first_name_th) VALUES ($1, 'ทดสอบ') RETURNING id`, "ITSA"+tag).Scan(&actor); err != nil {
		t.Fatal(err)
	}
	a := NewSettingsAdmin(pool)
	repo := NewRepository(pool)
	str := func(s string) *string { return &s }
	f := false

	name := "ลิฟต์ " + tag
	cat, err := a.CreateCategory(ctx, actor, CategoryInput{Name: str(name), Icon: str("door-open"), DefaultPriority: str("high"), AreaTypes: &[]string{"common_area"}})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `DELETE FROM repair.symptoms WHERE category_id = $1`, cat.ID)
		_, _ = pool.Exec(ctx, `DELETE FROM repair.category_area_types WHERE category_id = $1`, cat.ID)
		_, _ = pool.Exec(ctx, `DELETE FROM repair.categories WHERE id = $1`, cat.ID)
		_, _ = pool.Exec(ctx, `DELETE FROM repair.contractor_types WHERE name LIKE $1`, "%"+tag)
		_, _ = pool.Exec(ctx, `DELETE FROM platform.audit_log WHERE actor_user_id = $1`, actor)
		_, _ = pool.Exec(ctx, `DELETE FROM platform.users WHERE id = $1`, actor)
	})
	if len(cat.AreaTypes) != 1 || cat.DefaultPriority != "high" || cat.UpdatedBy == nil {
		t.Errorf("created = %+v", cat)
	}
	var fe *apperr.Error
	if _, err := a.CreateCategory(ctx, actor, CategoryInput{Name: str(name), Icon: str("snow"), DefaultPriority: str("x")}); !errors.As(err, &fe) || fe.Fields["icon"] != "INVALID" || fe.Fields["defaultPriority"] != "INVALID" {
		t.Errorf("validation: %v", err)
	}
	if _, err := a.CreateCategory(ctx, actor, CategoryInput{Name: str(name), Icon: str("wrench"), DefaultPriority: str("low")}); !errors.Is(err, ErrMasterNameTaken) {
		t.Errorf("duplicate category: %v", err)
	}

	// no active symptom → not offered in the repair form
	listed := func() bool {
		cats, err := repo.ListCategories(ctx)
		if err != nil {
			t.Fatal(err)
		}
		for _, c := range cats {
			if c.ID == cat.ID {
				return true
			}
		}
		return false
	}
	if listed() {
		t.Errorf("category without symptoms is offered")
	}
	s1, err := a.CreateSymptom(ctx, actor, cat.ID, SymptomInput{Name: str("ลิฟต์ค้าง"), Priority: str("critical")})
	if err != nil {
		t.Fatal(err)
	}
	s2, err := a.CreateSymptom(ctx, actor, cat.ID, SymptomInput{Name: str("ประตูลิฟต์ไม่ปิด"), Priority: str("high")})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := a.CreateSymptom(ctx, actor, cat.ID, SymptomInput{Name: str("ลิฟต์ค้าง"), Priority: str("low")}); !errors.Is(err, ErrMasterNameTaken) {
		t.Errorf("duplicate symptom: %v", err)
	}
	if !listed() {
		t.Errorf("category with symptoms is not offered")
	}

	// order: stale version refused; fresh version applies
	syms, _ := a.Symptoms(ctx, cat.ID)
	cur := latestOf(syms)
	if _, err := a.ReorderSymptoms(ctx, actor, cat.ID, []uuid.UUID{s2.ID, s1.ID}, cur.Add(-1)); !errors.Is(err, ErrMasterVersionChanged) {
		t.Errorf("stale order: %v", err)
	}
	reordered, err := a.ReorderSymptoms(ctx, actor, cat.ID, []uuid.UUID{s2.ID, s1.ID}, cur)
	if err != nil || reordered[0].ID != s2.ID {
		t.Fatalf("reorder = %+v, %v", reordered, err)
	}

	// deactivate both symptoms → hidden again; stale update refused
	got2, err := a.UpdateSymptom(ctx, actor, s2.ID, SymptomInput{IsActive: &f, UpdatedAt: reordered[0].UpdatedAt})
	if err != nil || got2.IsActive {
		t.Fatalf("deactivate s2 = %+v, %v", got2, err)
	}
	if _, err := a.UpdateSymptom(ctx, actor, s2.ID, SymptomInput{Name: str("x"), UpdatedAt: reordered[0].UpdatedAt}); !errors.Is(err, ErrMasterVersionChanged) {
		t.Errorf("stale symptom: %v", err)
	}
	if _, err := a.UpdateSymptom(ctx, actor, s1.ID, SymptomInput{IsActive: &f, UpdatedAt: reordered[1].UpdatedAt}); err != nil {
		t.Fatal(err)
	}
	if listed() {
		t.Errorf("category with only inactive symptoms is offered")
	}
	if err := a.DeleteSymptom(ctx, actor, s1.ID); err != nil {
		t.Errorf("delete unused symptom: %v", err)
	}

	// the "อื่น ๆ" category cannot be deactivated or deleted
	var other uuid.UUID
	if err := pool.QueryRow(ctx, `SELECT id FROM repair.categories WHERE is_other`).Scan(&other); err == nil {
		all, _ := a.Categories(ctx)
		for _, c := range all {
			if c.ID == other {
				if _, err := a.UpdateCategory(ctx, actor, other, CategoryInput{IsActive: &f, UpdatedAt: c.UpdatedAt}); !errors.As(err, &fe) || fe.Fields["isActive"] != "INVALID" {
					t.Errorf("deactivate other: %v", err)
				}
				if err := a.DeleteCategory(ctx, actor, other); !errors.Is(err, ErrMasterInUse) {
					t.Errorf("delete other: %v", err)
				}
			}
		}
	}

	// contractor types: case-insensitive names, deactivate, the technician's name re-activates it
	typ, err := a.CreateContractorType(ctx, actor, ContractorTypeInput{Name: str("Aircon " + tag)})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := a.CreateContractorType(ctx, actor, ContractorTypeInput{Name: str("AIRCON " + tag)}); !errors.Is(err, ErrMasterNameTaken) {
		t.Errorf("duplicate type: %v", err)
	}
	off, err := a.UpdateContractorType(ctx, actor, typ.ID, ContractorTypeInput{IsActive: &f, UpdatedAt: typ.UpdatedAt})
	if err != nil || off.IsActive {
		t.Fatalf("deactivate type = %+v, %v", off, err)
	}
	if offered, _ := repo.q.ListContractorTypes(ctx); containsType(offered, typ.ID) {
		t.Errorf("inactive type still offered")
	}
	back, err := repo.EnsureContractorType(ctx, "aircon "+tag, actor)
	if err != nil || back.ID != typ.ID {
		t.Fatalf("ensure = %+v, %v", back, err)
	}
	if offered, _ := repo.q.ListContractorTypes(ctx); !containsType(offered, typ.ID) {
		t.Errorf("re-activated type not offered")
	}
	var n int
	_ = pool.QueryRow(ctx, `SELECT count(*) FROM platform.audit_log WHERE target_id = $1 AND action = 'activate'`, typ.ID.String()).Scan(&n)
	if n != 1 {
		t.Errorf("re-activate audit rows = %d", n)
	}
	if err := a.DeleteContractorType(ctx, actor, typ.ID); err != nil {
		t.Errorf("delete unused type: %v", err)
	}
	if err := a.DeleteCategory(ctx, actor, cat.ID); err != nil {
		t.Errorf("delete unused category: %v", err)
	}
}

func latestOf(list []SymptomAdmin) time.Time {
	times := make([]time.Time, 0, len(list))
	for _, s := range list {
		times = append(times, s.UpdatedAt)
	}
	return latest(times)
}

func containsType(rows []repairdb.ListContractorTypesRow, id uuid.UUID) bool {
	for _, r := range rows {
		if r.ID == id {
			return true
		}
	}
	return false
}
