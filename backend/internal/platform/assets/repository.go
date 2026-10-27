package assets

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/pithawat/BAMBAM/backend/internal/platform/audit"
	"github.com/pithawat/BAMBAM/backend/internal/platform/db"
	"github.com/pithawat/BAMBAM/backend/internal/platform/people"
	"github.com/pithawat/BAMBAM/backend/internal/platform/platformdb"
)

type PgRepository struct {
	pool *pgxpool.Pool
	q    *platformdb.Queries
}

func NewRepository(pool *pgxpool.Pool) *PgRepository {
	return &PgRepository{pool: pool, q: platformdb.New(pool)}
}

func (r *PgRepository) RoomAssets(ctx context.Context, in ListInput) ([]Asset, error) {
	var q *string
	if in.Q != "" {
		q = &in.Q
	}
	rows, err := r.q.ListRoomAssets(ctx, platformdb.ListRoomAssetsParams{RoomID: in.RoomID, IncludeInactive: in.IncludeInactive, AssetTypeID: in.AssetTypeID, Q: q})
	if err != nil {
		return nil, err
	}
	out := make([]Asset, 0, len(rows))
	for _, x := range rows {
		out = append(out, Asset{ID: x.ID, Code: x.Code, Name: x.Name, IsActive: x.IsActive, RoomID: x.RoomID, Placed: x.Placed, UpdatedAt: x.UpdatedAt,
			Type:      TypeRef{ID: x.TypeID, Key: x.TypeKey, Name: x.TypeName, Icon: x.TypeIcon},
			UpdatedBy: people.NewRef(x.UpdatedByUserID, x.UpdatedByEmployeeCode, x.UpdatedByFirstNameTh, x.UpdatedByLastNameTh, x.UpdatedByFirstNameEn, x.UpdatedByLastNameEn, x.UpdatedByDepartment)})
	}
	return out, nil
}

func (r *PgRepository) Asset(ctx context.Context, id uuid.UUID) (Asset, error) {
	x, err := r.q.GetAssetAdmin(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return Asset{}, ErrAssetNotFound
	}
	if err != nil {
		return Asset{}, err
	}
	return Asset{ID: x.ID, Code: x.Code, Name: x.Name, IsActive: x.IsActive, RoomID: x.RoomID, Placed: x.Placed, UpdatedAt: x.UpdatedAt,
		Type:      TypeRef{ID: x.TypeID, Key: x.TypeKey, Name: x.TypeName, Icon: x.TypeIcon},
		UpdatedBy: people.NewRef(x.UpdatedByUserID, x.UpdatedByEmployeeCode, x.UpdatedByFirstNameTh, x.UpdatedByLastNameTh, x.UpdatedByFirstNameEn, x.UpdatedByLastNameEn, x.UpdatedByDepartment)}, nil
}

func (r *PgRepository) Types(ctx context.Context) ([]AssetType, error) {
	rows, err := r.q.ListAssetTypesAdmin(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]AssetType, 0, len(rows))
	for _, x := range rows {
		out = append(out, AssetType{ID: x.ID, Key: x.Key, Name: x.Name, CodePrefix: x.CodePrefix, Icon: x.Icon, Mount: x.Mount,
			SortOrder: x.SortOrder, ActiveAssetCount: x.ActiveAssetCount, UpdatedAt: x.UpdatedAt,
			UpdatedBy: people.NewRef(x.UpdatedByUserID, x.UpdatedByEmployeeCode, x.UpdatedByFirstNameTh, x.UpdatedByLastNameTh, x.UpdatedByFirstNameEn, x.UpdatedByLastNameEn, x.UpdatedByDepartment)})
	}
	return out, nil
}

func (r *PgRepository) ActiveType(ctx context.Context, id uuid.UUID) (AssetType, bool, error) {
	x, err := r.q.GetActiveAssetType(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return AssetType{}, false, nil
	}
	if err != nil {
		return AssetType{}, false, err
	}
	return AssetType{ID: x.ID, Key: x.Key, Name: x.Name, CodePrefix: x.CodePrefix, Icon: x.Icon, Mount: x.Mount, UpdatedAt: x.UpdatedAt}, true, nil
}

func (r *PgRepository) CodesStartingWith(ctx context.Context, prefix string) ([]string, error) {
	return r.q.AssetCodesStartingWith(ctx, prefix)
}

func (r *PgRepository) InTx(ctx context.Context, fn func(tx TxRepository) error) error {
	return db.WithTx(ctx, r.pool, func(tx pgx.Tx) error {
		return fn(&pgTx{tx: tx, q: platformdb.New(tx)})
	})
}

type pgTx struct {
	tx pgx.Tx
	q  *platformdb.Queries
}

func (t *pgTx) LockAsset(ctx context.Context, id uuid.UUID) (LockedAsset, error) {
	x, err := t.q.LockAssetAdmin(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return LockedAsset{}, ErrAssetNotFound
	}
	if err != nil {
		return LockedAsset{}, err
	}
	return LockedAsset{ID: x.ID, AssetTypeID: x.AssetTypeID, RoomID: x.RoomID, Code: x.Code, Name: x.Name, IsActive: x.IsActive, UpdatedAt: x.UpdatedAt}, nil
}

func (t *pgTx) CodeTaken(ctx context.Context, code string, self uuid.UUID) (bool, error) {
	return t.q.AssetCodeInUse(ctx, platformdb.AssetCodeInUseParams{Code: code, SelfID: self})
}

func (t *pgTx) InsertAsset(ctx context.Context, a LockedAsset, actor uuid.UUID) error {
	return uniqueCode(t.q.InsertAssetAdmin(ctx, platformdb.InsertAssetAdminParams{ID: a.ID, Code: a.Code, Name: a.Name, AssetTypeID: a.AssetTypeID, RoomID: a.RoomID, ActorID: &actor}))
}

func (t *pgTx) UpdateAsset(ctx context.Context, a LockedAsset, actor uuid.UUID) error {
	return uniqueCode(t.q.UpdateAssetAdmin(ctx, platformdb.UpdateAssetAdminParams{ID: a.ID, Code: a.Code, Name: a.Name, IsActive: a.IsActive, RoomID: a.RoomID, ActorID: &actor}))
}

func (t *pgTx) LockType(ctx context.Context, id uuid.UUID) (AssetType, error) {
	x, err := t.q.LockAssetType(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return AssetType{}, ErrAssetTypeNotFound
	}
	if err != nil {
		return AssetType{}, err
	}
	return AssetType{ID: x.ID, Key: x.Key, Name: x.Name, CodePrefix: x.CodePrefix, Icon: x.Icon, Mount: x.Mount, UpdatedAt: x.UpdatedAt}, nil
}

func (t *pgTx) TypeNameTaken(ctx context.Context, name string, self uuid.UUID) (bool, error) {
	return t.q.AssetTypeNameInUse(ctx, platformdb.AssetTypeNameInUseParams{Name: name, SelfID: self})
}

func (t *pgTx) PrefixTaken(ctx context.Context, prefix string, self uuid.UUID) (bool, error) {
	return t.q.AssetTypePrefixInUse(ctx, platformdb.AssetTypePrefixInUseParams{CodePrefix: prefix, SelfID: self})
}

func (t *pgTx) InsertType(ctx context.Context, a AssetType, actor uuid.UUID) error {
	return uniqueType(t.q.InsertAssetType(ctx, platformdb.InsertAssetTypeParams{ID: a.ID, Key: a.Key, Name: a.Name, CodePrefix: a.CodePrefix, Icon: a.Icon, Mount: a.Mount, ActorID: &actor}))
}

func (t *pgTx) UpdateType(ctx context.Context, a AssetType, actor uuid.UUID) error {
	return uniqueType(t.q.UpdateAssetType(ctx, platformdb.UpdateAssetTypeParams{ID: a.ID, Name: a.Name, CodePrefix: a.CodePrefix, Icon: a.Icon, Mount: a.Mount, ActorID: &actor}))
}

func (t *pgTx) Audit(ctx context.Context, e audit.Entry) error { return audit.Write(ctx, t.tx, e) }

// uniqueCode / uniqueType map a race on the unique indexes to the same errors as the service checks.
func uniqueCode(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" && pgErr.ConstraintName == "assets_code_key" {
		return ErrCodeTaken
	}
	return err
}

func uniqueType(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		switch pgErr.ConstraintName {
		case "asset_types_name_key":
			return ErrNameTaken
		case "asset_types_code_prefix_key":
			return ErrPrefixTaken
		}
	}
	return err
}
