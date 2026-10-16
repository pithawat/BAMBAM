package repair

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	repairdb "github.com/pithawat/BAMBAM/backend/internal/modules/repair/db"
	"github.com/pithawat/BAMBAM/backend/internal/platform/db"
)

type PgRepository struct {
	pool *pgxpool.Pool
	q    *repairdb.Queries
}

func NewRepository(pool *pgxpool.Pool) *PgRepository {
	return &PgRepository{pool: pool, q: repairdb.New(pool)}
}

func (r *PgRepository) InTx(ctx context.Context, fn func(tx TxRepository) error) error {
	return db.WithTx(ctx, r.pool, func(tx pgx.Tx) error {
		return fn(&pgTxRepository{q: repairdb.New(tx)})
	})
}

// ---- master data ----

func (r *PgRepository) ListCategories(ctx context.Context) ([]Category, error) {
	cats, err := r.q.ListActiveCategories(ctx)
	if err != nil {
		return nil, err
	}
	syms, err := r.q.ListActiveSymptoms(ctx)
	if err != nil {
		return nil, err
	}
	byCat := map[uuid.UUID][]Ref{}
	for _, s := range syms {
		byCat[s.CategoryID] = append(byCat[s.CategoryID], Ref{ID: s.ID, Name: s.Name})
	}
	out := make([]Category, 0, len(cats))
	for _, c := range cats {
		out = append(out, Category{ID: c.ID, Name: c.Name, Icon: c.Icon, Symptoms: nonNil(byCat[c.ID])})
	}
	return out, nil
}

func (r *PgRepository) ListBuildings(ctx context.Context) ([]Building, error) {
	blds, err := r.q.ListActiveBuildings(ctx)
	if err != nil {
		return nil, err
	}
	floors, err := r.q.ListActiveFloors(ctx)
	if err != nil {
		return nil, err
	}
	byBld := map[uuid.UUID][]Floor{}
	for _, f := range floors {
		byBld[f.BuildingID] = append(byBld[f.BuildingID], Floor{ID: f.ID, Name: f.Name, Level: f.Level})
	}
	out := make([]Building, 0, len(blds))
	for _, b := range blds {
		out = append(out, Building{ID: b.ID, Name: b.Name, Floors: nonNil(byBld[b.ID])})
	}
	return out, nil
}

func (r *PgRepository) CountCategories(ctx context.Context) (int64, error) {
	return r.q.CountCategories(ctx)
}

func (r *PgRepository) InsertMasterData(ctx context.Context, cats []Category, buildings []Building) error {
	return db.WithTx(ctx, r.pool, func(tx pgx.Tx) error {
		q := repairdb.New(tx)
		for i, c := range cats {
			if err := q.InsertCategory(ctx, repairdb.InsertCategoryParams{ID: c.ID, Name: c.Name, Icon: c.Icon, SortOrder: int32(i)}); err != nil { // #nosec G115 -- small list
				return err
			}
			for j, s := range c.Symptoms {
				if err := q.InsertSymptom(ctx, repairdb.InsertSymptomParams{ID: s.ID, CategoryID: c.ID, Name: s.Name, SortOrder: int32(j)}); err != nil { // #nosec G115 -- small list
					return err
				}
			}
		}
		for i, b := range buildings {
			if err := q.InsertBuilding(ctx, repairdb.InsertBuildingParams{ID: b.ID, Name: b.Name, SortOrder: int32(i)}); err != nil { // #nosec G115 -- small list
				return err
			}
			for _, f := range b.Floors {
				if err := q.InsertFloor(ctx, repairdb.InsertFloorParams{ID: f.ID, BuildingID: b.ID, Name: f.Name, Level: f.Level}); err != nil {
					return err
				}
			}
		}
		return nil
	})
}

// ---- photos ----

func (r *PgRepository) InsertPhoto(ctx context.Context, p NewPhoto) error {
	return r.q.InsertPhoto(ctx, repairdb.InsertPhotoParams{
		ID: p.ID, UploaderID: p.UploaderID, ContentType: p.ContentType, SizeBytes: p.SizeBytes,
		StorageKey: p.StorageKey, ThumbKey: p.ThumbKey, ThumbContentType: p.ThumbContentType,
	})
}

func (r *PgRepository) GetPhoto(ctx context.Context, id uuid.UUID) (Photo, error) {
	row, err := r.q.GetPhoto(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return Photo{}, ErrPhotoNotFound
	}
	if err != nil {
		return Photo{}, err
	}
	return Photo{
		ID: row.ID, UploaderID: row.UploaderID, ContentType: row.ContentType, StorageKey: row.StorageKey,
		ThumbKey: row.ThumbKey, ThumbContentType: row.ThumbContentType, TicketID: row.TicketID,
	}, nil
}

func (r *PgRepository) DeleteUnattachedPhotos(ctx context.Context, olderThan time.Time) ([]string, error) {
	rows, err := r.q.DeleteUnattachedPhotos(ctx, olderThan)
	if err != nil {
		return nil, err
	}
	keys := make([]string, 0, len(rows)*2)
	for _, row := range rows {
		keys = append(keys, row.StorageKey, row.ThumbKey)
	}
	return keys, nil
}

// ---- tickets ----

func (r *PgRepository) GetTicketAccess(ctx context.Context, id, viewerID uuid.UUID) (ticketAccess, error) {
	row, err := r.q.GetTicketAccess(ctx, repairdb.GetTicketAccessParams{ID: id, ViewerID: viewerID})
	if errors.Is(err, pgx.ErrNoRows) {
		return ticketAccess{}, ErrTicketNotFound
	}
	if err != nil {
		return ticketAccess{}, err
	}
	return ticketAccess{ReporterID: row.ReporterID, HolderID: row.HolderID, ViewerSubscribed: row.ViewerSubscribed}, nil
}

func (r *PgRepository) GetTicket(ctx context.Context, id, viewerID uuid.UUID) (TicketDetail, error) {
	row, err := r.q.GetTicket(ctx, repairdb.GetTicketParams{ID: id, ViewerID: viewerID})
	if errors.Is(err, pgx.ErrNoRows) {
		return TicketDetail{}, ErrTicketNotFound
	}
	if err != nil {
		return TicketDetail{}, err
	}
	d := TicketDetail{
		TicketSummary: TicketSummary{
			ID: row.ID, TicketNo: row.TicketNo, Status: row.Status, ClosedReason: row.ClosedReason, Priority: row.Priority,
			Category:         Ref{ID: row.CategoryID, Name: row.CategoryName},
			Building:         Ref{ID: row.BuildingID, Name: row.BuildingName},
			Floor:            Ref{ID: row.FloorID, Name: row.FloorName},
			LocationDetail:   row.LocationDetail,
			Reporter:         Person{ID: row.ReporterID, Name: row.ReporterName, Department: row.ReporterDepartment},
			Technician:       person(row.HolderID, row.HolderName, row.HolderDepartment),
			ViewerSubscribed: row.ViewerSubscribed,
			SendBackCount:    row.SendBackCount, Rating: row.Rating,
			ExpectedDoneOn: dateOf(row.ExpectedDoneOn), AssessedAt: row.AssessedAt, WorkBy: row.WorkBy,
			Contractor: ref(row.ContractorID, row.ContractorName), AutoCloseAt: row.AutoCloseAt,
			CreatedAt: row.CreatedAt, ResolvedAt: row.ResolvedAt, ClosedAt: row.ClosedAt, UpdatedAt: row.UpdatedAt,
		},
		Details: row.Details, AssetCode: row.AssetCode, SubscriberCount: row.SubscriberCount, RatingComment: row.RatingComment,
	}
	if err := r.fillContractorTypes(ctx, []*TicketSummary{&d.TicketSummary}); err != nil {
		return TicketDetail{}, err
	}

	syms, err := r.q.ListSymptomsForTickets(ctx, []uuid.UUID{id})
	if err != nil {
		return TicketDetail{}, err
	}
	d.Symptoms = []Ref{}
	for _, s := range syms {
		d.Symptoms = append(d.Symptoms, Ref{ID: s.ID, Name: s.Name})
	}

	photos, err := r.q.ListTicketPhotos(ctx, id)
	if err != nil {
		return TicketDetail{}, err
	}
	d.Photos = []uuid.UUID{}
	byEvent := map[uuid.UUID][]uuid.UUID{}
	for _, p := range photos {
		switch {
		case p.Kind == PhotoKindReport:
			d.Photos = append(d.Photos, p.PhotoID)
		case p.EventID != nil:
			byEvent[*p.EventID] = append(byEvent[*p.EventID], p.PhotoID)
		}
	}
	if len(d.Photos) > 0 {
		d.ThumbPhotoID = &d.Photos[0]
	}

	events, err := r.q.ListTicketEvents(ctx, id)
	if err != nil {
		return TicketDetail{}, err
	}
	d.Timeline = make([]TimelineEvent, 0, len(events))
	var lastResolved *uuid.UUID
	for _, e := range events {
		if e.Type == EventResolved && lastResolved == nil {
			lastResolved = &e.ID // newest first
		}
		d.Timeline = append(d.Timeline, TimelineEvent{
			ID: e.ID, Type: e.Type, Actor: person(e.ActorID, e.ActorName, e.ActorDepartment),
			At: e.CreatedAt, Note: e.Note, Photos: nonNil(byEvent[e.ID]), Data: e.Data,
		})
	}
	if row.ResultNote != nil {
		// The result card shows the latest resolution; earlier ones stay in the timeline.
		res := &TicketResult{
			Note: *row.ResultNote, Photos: []uuid.UUID{},
			By: person(row.ResolvedByID, row.ResolvedByName, row.ResolvedByDepartment), At: row.ResolvedAt,
			ContractorRating: row.ContractorRating, ContractorRatingComment: row.ContractorRatingComment,
		}
		if lastResolved != nil {
			res.Photos = nonNil(byEvent[*lastResolved])
		}
		d.Result = res
	}
	return d, nil
}

func (r *PgRepository) ListTickets(ctx context.Context, viewerID uuid.UUID, f TicketFilter) ([]TicketSummary, int64, error) {
	rows, err := r.q.ListTickets(ctx, repairdb.ListTicketsParams{
		ViewerID: viewerID, ScopeAll: f.ScopeAll, Relation: f.Relation, Statuses: nonNil(f.Statuses), Steps: nonNil(f.Steps),
		ClosedReason: f.ClosedReason, Q: f.Q, CreatedFrom: f.CreatedFrom, CreatedTo: f.CreatedTo,
		CategoryID: f.CategoryID, BuildingID: f.BuildingID, FloorID: f.FloorID, Priority: f.Priority,
		AwaitingFirst: !f.ScopeAll, Sort: f.Sort,
		PageLimit: int32(f.PageSize), PageOffset: int32((f.Page - 1) * f.PageSize), // #nosec G115 -- page size ≤ 100, page bounded by the controller
	})
	if err != nil {
		return nil, 0, err
	}
	total, err := r.q.CountTickets(ctx, repairdb.CountTicketsParams{
		ViewerID: viewerID, ScopeAll: f.ScopeAll, Relation: f.Relation, Statuses: nonNil(f.Statuses), Steps: nonNil(f.Steps),
		ClosedReason: f.ClosedReason, Q: f.Q, CreatedFrom: f.CreatedFrom, CreatedTo: f.CreatedTo,
		CategoryID: f.CategoryID, BuildingID: f.BuildingID, FloorID: f.FloorID, Priority: f.Priority,
	})
	if err != nil {
		return nil, 0, err
	}

	ids := make([]uuid.UUID, 0, len(rows))
	for _, row := range rows {
		ids = append(ids, row.ID)
	}
	syms, err := r.q.ListSymptomsForTickets(ctx, ids)
	if err != nil {
		return nil, 0, err
	}
	symsBy := map[uuid.UUID][]Ref{}
	for _, s := range syms {
		symsBy[s.TicketID] = append(symsBy[s.TicketID], Ref{ID: s.ID, Name: s.Name})
	}
	thumbs, err := r.q.FirstReportPhotos(ctx, ids)
	if err != nil {
		return nil, 0, err
	}
	thumbBy := map[uuid.UUID]uuid.UUID{}
	for _, t := range thumbs {
		thumbBy[t.TicketID] = t.PhotoID
	}

	out := make([]TicketSummary, 0, len(rows))
	for _, row := range rows {
		s := TicketSummary{
			ID: row.ID, TicketNo: row.TicketNo, Status: row.Status, ClosedReason: row.ClosedReason, Priority: row.Priority,
			Category:         Ref{ID: row.CategoryID, Name: row.CategoryName},
			Symptoms:         nonNil(symsBy[row.ID]),
			Building:         Ref{ID: row.BuildingID, Name: row.BuildingName},
			Floor:            Ref{ID: row.FloorID, Name: row.FloorName},
			LocationDetail:   row.LocationDetail,
			Reporter:         Person{ID: row.ReporterID, Name: row.ReporterName, Department: row.ReporterDepartment},
			Technician:       person(row.HolderID, row.HolderName, row.HolderDepartment),
			ViewerSubscribed: row.ViewerSubscribed,
			SendBackCount:    row.SendBackCount, Rating: row.Rating,
			ExpectedDoneOn: dateOf(row.ExpectedDoneOn), AssessedAt: row.AssessedAt, WorkBy: row.WorkBy,
			Contractor: ref(row.ContractorID, row.ContractorName), AutoCloseAt: row.AutoCloseAt,
			CreatedAt: row.CreatedAt, ResolvedAt: row.ResolvedAt, ClosedAt: row.ClosedAt, UpdatedAt: row.UpdatedAt,
		}
		if p, ok := thumbBy[row.ID]; ok {
			s.ThumbPhotoID = &p
		}
		out = append(out, s)
	}
	ptrs := make([]*TicketSummary, len(out))
	for i := range out {
		ptrs[i] = &out[i]
	}
	if err := r.fillContractorTypes(ctx, ptrs); err != nil {
		return nil, 0, err
	}
	return out, total, nil
}

// fillContractorTypes sets ContractorTypes (type names) on tickets done by a contractor.
func (r *PgRepository) fillContractorTypes(ctx context.Context, list []*TicketSummary) error {
	var ids []uuid.UUID
	for _, s := range list {
		s.ContractorTypes = []string{}
		if s.Contractor != nil {
			ids = append(ids, s.Contractor.ID)
		}
	}
	if len(ids) == 0 {
		return nil
	}
	types, err := r.typesFor(ctx, ids)
	if err != nil {
		return err
	}
	for _, s := range list {
		if s.Contractor != nil {
			for _, t := range types[s.Contractor.ID] {
				s.ContractorTypes = append(s.ContractorTypes, t.Name)
			}
		}
	}
	return nil
}

func (r *PgRepository) CountTickets(ctx context.Context, viewerID uuid.UUID, f TicketFilter) (TicketCounts, error) {
	row, err := r.q.CountTicketsByStatus(ctx, repairdb.CountTicketsByStatusParams{
		ViewerID: viewerID, ScopeAll: f.ScopeAll, Relation: f.Relation,
		ClosedReason: f.ClosedReason, Q: f.Q, CreatedFrom: f.CreatedFrom, CreatedTo: f.CreatedTo,
		CategoryID: f.CategoryID, BuildingID: f.BuildingID, FloorID: f.FloorID, Priority: f.Priority,
	})
	if err != nil {
		return TicketCounts{}, err
	}
	return TicketCounts{
		InProgress: row.InProgressCount, Resolved: row.ResolvedCount, Closed: row.ClosedCount,
		AwaitingAssessment: row.AwaitingAssessmentCount, InRepair: row.InRepairCount,
		AwaitingMyConfirmation: row.AwaitingMyConfirmationCount,
	}, nil
}

func (r *PgRepository) AutoCloseDue(ctx context.Context, now time.Time) (int, error) {
	n := 0
	err := db.WithTx(ctx, r.pool, func(tx pgx.Tx) error {
		q := repairdb.New(tx)
		ids, err := q.AutoCloseDueTickets(ctx, &now)
		if err != nil || len(ids) == 0 {
			return err
		}
		n = len(ids)
		return q.InsertAutoClosedEvents(ctx, repairdb.InsertAutoClosedEventsParams{TicketIds: ids, Now: now})
	})
	return n, err
}

// ---- contractors ----

func (r *PgRepository) ListContractorTypes(ctx context.Context) ([]Ref, error) {
	rows, err := r.q.ListContractorTypes(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]Ref, 0, len(rows))
	for _, row := range rows {
		out = append(out, Ref{ID: row.ID, Name: row.Name})
	}
	return out, nil
}

func (r *PgRepository) EnsureContractorType(ctx context.Context, name string, by uuid.UUID) (Ref, error) {
	row, err := r.q.InsertContractorType(ctx, repairdb.InsertContractorTypeParams{Name: name, CreatedByID: &by})
	if err == nil {
		return Ref{ID: row.ID, Name: row.Name}, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return Ref{}, err
	}
	existing, err := r.q.GetContractorTypeByName(ctx, name)
	if err != nil {
		return Ref{}, err
	}
	return Ref{ID: existing.ID, Name: existing.Name}, nil
}

func (r *PgRepository) ListContractors(ctx context.Context, f ContractorFilter) ([]Contractor, int64, error) {
	rows, err := r.q.ListContractors(ctx, repairdb.ListContractorsParams{
		IncludeInactive: f.IncludeInactive, Q: f.Q, TypeID: f.TypeID,
		PageLimit: int32(f.PageSize), PageOffset: int32((f.Page - 1) * f.PageSize), // #nosec G115 -- bounded by the controller
	})
	if err != nil {
		return nil, 0, err
	}
	total, err := r.q.CountContractors(ctx, repairdb.CountContractorsParams{IncludeInactive: f.IncludeInactive, Q: f.Q, TypeID: f.TypeID})
	if err != nil {
		return nil, 0, err
	}
	ids := make([]uuid.UUID, 0, len(rows))
	for _, row := range rows {
		ids = append(ids, row.ID)
	}
	types, err := r.typesFor(ctx, ids)
	if err != nil {
		return nil, 0, err
	}
	out := make([]Contractor, 0, len(rows))
	for _, row := range rows {
		out = append(out, Contractor{
			ID: row.ID, Name: row.Name, Types: nonNil(types[row.ID]), ContactName: row.ContactName, Phone: row.Phone, Note: row.Note,
			IsActive: row.IsActive, JobCount: row.JobCount, RatedCount: row.RatedCount, AvgRating: row.AvgRating,
			CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
		})
	}
	return out, total, nil
}

func (r *PgRepository) GetContractor(ctx context.Context, id uuid.UUID) (Contractor, error) {
	row, err := r.q.GetContractor(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return Contractor{}, ErrContractorNotFound
	}
	if err != nil {
		return Contractor{}, err
	}
	types, err := r.typesFor(ctx, []uuid.UUID{id})
	if err != nil {
		return Contractor{}, err
	}
	return Contractor{
		ID: row.ID, Name: row.Name, Types: nonNil(types[id]), ContactName: row.ContactName, Phone: row.Phone, Note: row.Note,
		IsActive: row.IsActive, JobCount: row.JobCount, RatedCount: row.RatedCount, AvgRating: row.AvgRating,
		CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
	}, nil
}

func (r *PgRepository) ListContractorJobs(ctx context.Context, id uuid.UUID, page, pageSize int) ([]ContractorJob, int64, error) {
	rows, err := r.q.ListContractorJobs(ctx, repairdb.ListContractorJobsParams{
		ContractorID: &id, PageLimit: int32(pageSize), PageOffset: int32((page - 1) * pageSize), // #nosec G115 -- bounded by the controller
	})
	if err != nil {
		return nil, 0, err
	}
	total, err := r.q.CountContractorJobs(ctx, &id)
	if err != nil {
		return nil, 0, err
	}
	out := make([]ContractorJob, 0, len(rows))
	for _, row := range rows {
		out = append(out, ContractorJob{
			TicketID: row.ID, TicketNo: row.TicketNo, Status: row.Status, Category: Ref{ID: row.CategoryID, Name: row.CategoryName},
			ResolvedAt: row.ResolvedAt, ContractorRating: row.ContractorRating, ContractorRatingComment: row.ContractorRatingComment,
			ReporterRating: row.Rating,
		})
	}
	return out, total, nil
}

func (r *PgRepository) typesFor(ctx context.Context, contractorIDs []uuid.UUID) (map[uuid.UUID][]Ref, error) {
	out := map[uuid.UUID][]Ref{}
	if len(contractorIDs) == 0 {
		return out, nil
	}
	rows, err := r.q.ListTypesForContractors(ctx, contractorIDs)
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		out[row.ContractorID] = append(out[row.ContractorID], Ref{ID: row.ID, Name: row.Name})
	}
	return out, nil
}

// ---- transaction ----

type pgTxRepository struct {
	q *repairdb.Queries
}

func (r *pgTxRepository) LockActiveCategory(ctx context.Context, id uuid.UUID) (bool, error) {
	_, err := r.q.LockActiveCategory(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	return err == nil, err
}

func (r *pgTxRepository) CountActiveSymptoms(ctx context.Context, categoryID uuid.UUID, ids []uuid.UUID) (int, error) {
	n, err := r.q.CountActiveSymptomsInCategory(ctx, repairdb.CountActiveSymptomsInCategoryParams{Ids: ids, CategoryID: categoryID})
	return int(n), err
}

func (r *pgTxRepository) ActiveFloorInBuilding(ctx context.Context, floorID, buildingID uuid.UUID) (bool, error) {
	return r.q.ActiveFloorInBuilding(ctx, repairdb.ActiveFloorInBuildingParams{FloorID: floorID, BuildingID: buildingID})
}

func (r *pgTxRepository) LockAttachablePhotos(ctx context.Context, uploaderID uuid.UUID, ids []uuid.UUID, notBefore time.Time) (int, error) {
	rows, err := r.q.LockAttachablePhotos(ctx, repairdb.LockAttachablePhotosParams{Ids: ids, UploaderID: uploaderID, NotBefore: notBefore})
	return len(rows), err
}

func (r *pgTxRepository) TicketNumberFormat(ctx context.Context) (TicketNumberFormat, error) {
	row, err := r.q.GetSettings(ctx)
	if err != nil {
		return TicketNumberFormat{}, err
	}
	return TicketNumberFormat{Prefix: row.TicketPrefix, YearFormat: row.TicketYearFormat, Digits: int(row.TicketDigits)}, nil
}

func (r *pgTxRepository) NextTicketCounter(ctx context.Context, year int) (int64, error) {
	return r.q.NextTicketCounter(ctx, int32(year)) // #nosec G115 -- calendar year
}

func (r *pgTxRepository) InsertTicket(ctx context.Context, t NewTicket) error {
	if err := r.q.InsertTicket(ctx, repairdb.InsertTicketParams{
		ID: t.ID, TicketNo: t.TicketNo, Priority: t.Priority, CategoryID: t.CategoryID, BuildingID: t.BuildingID,
		FloorID: t.FloorID, LocationDetail: t.LocationDetail, Details: t.Details, AssetCode: t.AssetCode,
		ReporterID: t.ReporterID,
	}); err != nil {
		return err
	}
	if err := r.q.InsertTicketSymptoms(ctx, repairdb.InsertTicketSymptomsParams{TicketID: t.ID, SymptomIds: t.SymptomIDs}); err != nil {
		return err
	}
	if err := r.q.InsertTicketPhotos(ctx, repairdb.InsertTicketPhotosParams{TicketID: t.ID, Kind: PhotoKindReport, PhotoIds: t.PhotoIDs}); err != nil {
		return err
	}
	if err := r.q.MarkPhotosAttached(ctx, t.PhotoIDs); err != nil {
		return err
	}
	reporter := t.ReporterID
	return r.q.InsertTicketEvent(ctx, repairdb.InsertTicketEventParams{
		ID: t.CreatedEventID, TicketID: t.ID, Type: EventCreated, ActorID: &reporter, Data: []byte("{}"), CreatedAt: t.CreatedAt,
	})
}

func (r *pgTxRepository) LockTicket(ctx context.Context, id uuid.UUID) (LockedTicket, error) {
	row, err := r.q.LockTicket(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return LockedTicket{}, ErrTicketNotFound
	}
	if err != nil {
		return LockedTicket{}, err
	}
	t := LockedTicket{
		ID: row.ID, Status: row.Status, ReporterID: row.ReporterID, ContractorID: row.ContractorID,
		Assessed: row.ExpectedDoneOn.Valid && row.WorkBy != nil, Rated: row.ContractorRating != nil,
	}
	if row.WorkBy != nil {
		t.WorkBy = *row.WorkBy
	}
	return t, nil
}

func (r *pgTxRepository) AssessTicket(ctx context.Context, id, technicianID uuid.UUID, in AssessInput, now time.Time) error {
	return r.q.AssessTicket(ctx, repairdb.AssessTicketParams{
		ID: id, TechnicianID: &technicianID, Now: now, ExpectedDoneOn: pgtype.Date{Time: *in.ExpectedDoneOn, Valid: true},
		WorkBy: &in.WorkBy, ContractorID: in.ContractorID,
	})
}

func (r *pgTxRepository) ResolveTicket(ctx context.Context, id, technicianID uuid.UUID, in ResolveInput, now, autoCloseAt time.Time) error {
	p := repairdb.ResolveTicketParams{
		ID: id, Note: &in.Note, TechnicianID: &technicianID,
		ContractorRatingComment: optional(in.ContractorRatingComment), Now: &now, AutoCloseAt: &autoCloseAt,
	}
	if in.ContractorRating != nil {
		r := int16(*in.ContractorRating) // #nosec G115 -- validated 1–5
		p.ContractorRating = &r
	}
	return r.q.ResolveTicket(ctx, p)
}

func (r *pgTxRepository) ConfirmTicket(ctx context.Context, id uuid.UUID, rating int16, comment *string, now time.Time) error {
	return r.q.ConfirmTicket(ctx, repairdb.ConfirmTicketParams{ID: id, Rating: &rating, RatingComment: comment, Now: &now})
}

func (r *pgTxRepository) SendBackTicket(ctx context.Context, id uuid.UUID, now time.Time) error {
	return r.q.SendBackTicket(ctx, repairdb.SendBackTicketParams{ID: id, Now: now})
}

func (r *pgTxRepository) InsertEvent(ctx context.Context, e NewEvent) error {
	if err := r.q.InsertTicketEvent(ctx, repairdb.InsertTicketEventParams{
		ID: e.ID, TicketID: e.TicketID, Type: e.Type, ActorID: e.ActorID, Note: e.Note, Data: e.Data, CreatedAt: e.At,
	}); err != nil {
		return err
	}
	if len(e.PhotoIDs) == 0 {
		return nil
	}
	eventID := e.ID
	if err := r.q.InsertTicketPhotos(ctx, repairdb.InsertTicketPhotosParams{TicketID: e.TicketID, Kind: e.PhotoKind, EventID: &eventID, PhotoIds: e.PhotoIDs}); err != nil {
		return err
	}
	return r.q.MarkPhotosAttached(ctx, e.PhotoIDs)
}

func (r *pgTxRepository) ActiveContractorExists(ctx context.Context, id uuid.UUID) (bool, error) {
	return r.q.ActiveContractorExists(ctx, id)
}

func (r *pgTxRepository) CountContractorTypes(ctx context.Context, ids []uuid.UUID) (int, error) {
	n, err := r.q.CountContractorTypes(ctx, ids)
	return int(n), err
}

func (r *pgTxRepository) InsertContractor(ctx context.Context, id uuid.UUID, in ContractorInput, by uuid.UUID) error {
	return r.q.InsertContractor(ctx, repairdb.InsertContractorParams{
		ID: id, Name: in.Name, ContactName: optional(in.ContactName), Phone: optional(in.Phone), Note: optional(in.Note), CreatedByID: &by,
	})
}

func (r *pgTxRepository) UpdateContractor(ctx context.Context, id uuid.UUID, in ContractorInput) (bool, error) {
	n, err := r.q.UpdateContractor(ctx, repairdb.UpdateContractorParams{
		ID: id, Name: in.Name, ContactName: optional(in.ContactName), Phone: optional(in.Phone), Note: optional(in.Note), IsActive: in.IsActive,
	})
	return n > 0, err
}

func (r *pgTxRepository) SetContractorTypes(ctx context.Context, id uuid.UUID, typeIDs []uuid.UUID) error {
	if err := r.q.DeleteContractorTypeLinks(ctx, id); err != nil {
		return err
	}
	return r.q.InsertContractorTypeLinks(ctx, repairdb.InsertContractorTypeLinksParams{ContractorID: id, TypeIds: typeIDs})
}

func person(id *uuid.UUID, name, department *string) *Person {
	if id == nil {
		return nil
	}
	p := &Person{ID: *id, Department: department}
	if name != nil {
		p.Name = *name
	}
	return p
}

func ref(id *uuid.UUID, name *string) *Ref {
	if id == nil {
		return nil
	}
	r := &Ref{ID: *id}
	if name != nil {
		r.Name = *name
	}
	return r
}

func dateOf(d pgtype.Date) *time.Time {
	if !d.Valid {
		return nil
	}
	t := d.Time
	return &t
}

func nonNil[T any](s []T) []T {
	if s == nil {
		return []T{}
	}
	return s
}
