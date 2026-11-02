package repair

import (
	"context"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/pithawat/BAMBAM/backend/internal/platform/users"
)

// Stage 5 (F13-B): #25 on the real SQL — code ignoring case, the current room after a move
// (BR-F13B-3, AC6), the prefilled category, inactive = not found — and the S07 asset line (AC4).
func TestPgAssetLookupAndTicketLink(t *testing.T) {
	p := newPgFixture(t)
	ctx := context.Background()
	admin := p.user(t, users.RoleAdmin)
	reporter := p.user(t, users.RoleEmployee)
	t.Cleanup(func() {
		for _, q := range []string{
			`UPDATE repair.tickets SET asset_id = NULL WHERE asset_id IN (SELECT id FROM platform.assets WHERE created_by = $1)`,
			`DELETE FROM platform.audit_log WHERE actor_user_id = $1`,
			`DELETE FROM platform.assets WHERE created_by = $1`,
		} {
			if _, err := p.pool.Exec(context.Background(), q, admin.ID); err != nil {
				t.Errorf("cleanup: %v", err)
			}
		}
	})

	code1 := "TQR-" + uuid.NewString()[:6]
	a, err := p.svc.CreateAsset(ctx, admin, AssetInput{AssetTypeID: acType, Code: code1, Name: "แอร์ทดสอบ QR", RoomID: b1HR3})
	if err != nil {
		t.Fatal(err)
	}

	got, err := p.svc.LookupAsset(ctx, reporter, strings.ToLower(code1))
	if err != nil {
		t.Fatalf("lookup: %v", err)
	}
	if got.Code != code1 || got.Name != "แอร์ทดสอบ QR" || got.Room.ID != b1HR3 || got.Floor.ID != b1Floor1 || got.Building.ID != b1Building {
		t.Fatalf("lookup = %+v", got)
	}
	// แอร์ → ระบบปรับอากาศ, used in office buildings (CR-025)
	if got.Category == nil || got.Category.Name != "ระบบปรับอากาศ" {
		t.Fatalf("category = %+v", got.Category)
	}

	if _, err := p.svc.UpdateAsset(ctx, admin, a.ID, AssetInput{Code: code1, Name: "แอร์ทดสอบ QR", RoomID: b1WC}); err != nil {
		t.Fatal(err)
	}
	if moved, err := p.svc.LookupAsset(ctx, reporter, code1); err != nil || moved.Room.ID != b1WC {
		t.Fatalf("after move: %+v %v", moved, err)
	}

	photo, err := p.svc.UploadPhoto(ctx, reporter, p.png)
	if err != nil {
		t.Fatal(err)
	}
	b, f, r := b1Building, b1Floor1, b1WC
	d, err := p.svc.CreateTicket(ctx, reporter, CreateTicketInput{CategoryID: &got.Category.ID, SymptomOther: "แอร์ไม่เย็น",
		BuildingID: &b, FloorID: &f, RoomID: &r, PhotoIDs: []uuid.UUID{photo}, AssetCode: strings.ToLower(code1)})
	if err != nil {
		t.Fatal(err)
	}
	detail, err := p.svc.Ticket(ctx, reporter, d.ID)
	if err != nil {
		t.Fatal(err)
	}
	if detail.Asset == nil || detail.Asset.Code != code1 || detail.Asset.Name != "แอร์ทดสอบ QR" {
		t.Fatalf("ticket asset = %+v", detail.Asset)
	}

	if err := p.svc.DeactivateAsset(ctx, admin, a.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := p.svc.LookupAsset(ctx, reporter, code1); code(err) != "ASSET_NOT_FOUND" {
		t.Fatalf("inactive asset: %v", err)
	}
	// the ticket keeps its asset line after the asset is removed (BR-F31-4)
	if detail, err = p.svc.Ticket(ctx, reporter, d.ID); err != nil || detail.Asset == nil {
		t.Fatalf("ticket after deactivate: %+v %v", detail.Asset, err)
	}
}
