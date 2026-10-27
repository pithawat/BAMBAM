package repair

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	repairdb "github.com/pithawat/BAMBAM/backend/internal/modules/repair/db"
)

// SettingsAdmin is what the settings module may use of repair's data (D-048, wired in cmd/api/main.go):
// usage counts for platform data (Stage 4) and, from Stage 5, categories, symptoms and contractor types.
type SettingsAdmin struct {
	pool *pgxpool.Pool
	q    *repairdb.Queries
}

func NewSettingsAdmin(pool *pgxpool.Pool) *SettingsAdmin {
	return &SettingsAdmin{pool: pool, q: repairdb.New(pool)}
}

// OpenTicketCounts: tickets not closed per asset (settings #46 `openTicketCount`); missing ids have none.
func (a *SettingsAdmin) OpenTicketCounts(ctx context.Context, assetIDs []uuid.UUID) (map[uuid.UUID]int64, error) {
	out := make(map[uuid.UUID]int64, len(assetIDs))
	if len(assetIDs) == 0 {
		return out, nil
	}
	rows, err := a.q.CountOpenTicketsByAsset(ctx, assetIDs)
	if err != nil {
		return nil, err
	}
	for _, r := range rows {
		out[r.AssetID] = r.OpenCount
	}
	return out, nil
}
