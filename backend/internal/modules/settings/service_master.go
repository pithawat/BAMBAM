package settings

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/pithawat/BAMBAM/backend/internal/modules/repair"
	"github.com/pithawat/BAMBAM/backend/internal/platform/apperr"
)

// Stage 5 (F27, F28): categories and symptoms (#32–#41, Admin + Superadmin) and contractor types (#42–#45,
// Superadmin). Repair owns the rows and rules; this is its SettingsAdmin as settings uses it (D-048).

// RepairMaster is repair's SettingsAdmin for master data.
type RepairMaster interface {
	Categories(ctx context.Context) ([]repair.CategoryAdmin, error)
	CreateCategory(ctx context.Context, actor uuid.UUID, in repair.CategoryInput) (repair.CategoryAdmin, error)
	UpdateCategory(ctx context.Context, actor, id uuid.UUID, in repair.CategoryInput) (repair.CategoryAdmin, error)
	DeleteCategory(ctx context.Context, actor, id uuid.UUID) error
	ReorderCategories(ctx context.Context, actor uuid.UUID, ids []uuid.UUID, version time.Time) ([]repair.CategoryAdmin, error)
	Symptoms(ctx context.Context, categoryID uuid.UUID) ([]repair.SymptomAdmin, error)
	CreateSymptom(ctx context.Context, actor, categoryID uuid.UUID, in repair.SymptomInput) (repair.SymptomAdmin, error)
	UpdateSymptom(ctx context.Context, actor, id uuid.UUID, in repair.SymptomInput) (repair.SymptomAdmin, error)
	DeleteSymptom(ctx context.Context, actor, id uuid.UUID) error
	ReorderSymptoms(ctx context.Context, actor, categoryID uuid.UUID, ids []uuid.UUID, version time.Time) ([]repair.SymptomAdmin, error)
	ContractorTypes(ctx context.Context) ([]repair.ContractorTypeAdmin, error)
	CreateContractorType(ctx context.Context, actor uuid.UUID, in repair.ContractorTypeInput) (repair.ContractorTypeAdmin, error)
	UpdateContractorType(ctx context.Context, actor, id uuid.UUID, in repair.ContractorTypeInput) (repair.ContractorTypeAdmin, error)
	DeleteContractorType(ctx context.Context, actor, id uuid.UUID) error
}

func (s *Service) need(v Viewer, perm string) error {
	if !v.Can(perm) {
		return apperr.ErrForbidden
	}
	return nil
}

// Categories implements #32.
func (s *Service) Categories(ctx context.Context, v Viewer) ([]repair.CategoryAdmin, error) {
	if err := s.need(v, PermCategories); err != nil {
		return nil, err
	}
	return s.master.Categories(ctx)
}

// CreateCategory implements #33.
func (s *Service) CreateCategory(ctx context.Context, v Viewer, in repair.CategoryInput) (repair.CategoryAdmin, error) {
	if err := s.need(v, PermCategories); err != nil {
		return repair.CategoryAdmin{}, err
	}
	return s.master.CreateCategory(ctx, v.ID, in)
}

// UpdateCategory implements #34.
func (s *Service) UpdateCategory(ctx context.Context, v Viewer, id uuid.UUID, in repair.CategoryInput) (repair.CategoryAdmin, error) {
	if err := s.need(v, PermCategories); err != nil {
		return repair.CategoryAdmin{}, err
	}
	return s.master.UpdateCategory(ctx, v.ID, id, in)
}

// DeleteCategory implements #35.
func (s *Service) DeleteCategory(ctx context.Context, v Viewer, id uuid.UUID) error {
	if err := s.need(v, PermCategories); err != nil {
		return err
	}
	return s.master.DeleteCategory(ctx, v.ID, id)
}

// ReorderCategories implements #36.
func (s *Service) ReorderCategories(ctx context.Context, v Viewer, ids []uuid.UUID, version time.Time) ([]repair.CategoryAdmin, error) {
	if err := s.need(v, PermCategories); err != nil {
		return nil, err
	}
	return s.master.ReorderCategories(ctx, v.ID, ids, version)
}

// Symptoms implements #37.
func (s *Service) Symptoms(ctx context.Context, v Viewer, categoryID uuid.UUID) ([]repair.SymptomAdmin, error) {
	if err := s.need(v, PermCategories); err != nil {
		return nil, err
	}
	return s.master.Symptoms(ctx, categoryID)
}

// CreateSymptom implements #38.
func (s *Service) CreateSymptom(ctx context.Context, v Viewer, categoryID uuid.UUID, in repair.SymptomInput) (repair.SymptomAdmin, error) {
	if err := s.need(v, PermCategories); err != nil {
		return repair.SymptomAdmin{}, err
	}
	return s.master.CreateSymptom(ctx, v.ID, categoryID, in)
}

// UpdateSymptom implements #39.
func (s *Service) UpdateSymptom(ctx context.Context, v Viewer, id uuid.UUID, in repair.SymptomInput) (repair.SymptomAdmin, error) {
	if err := s.need(v, PermCategories); err != nil {
		return repair.SymptomAdmin{}, err
	}
	return s.master.UpdateSymptom(ctx, v.ID, id, in)
}

// DeleteSymptom implements #40.
func (s *Service) DeleteSymptom(ctx context.Context, v Viewer, id uuid.UUID) error {
	if err := s.need(v, PermCategories); err != nil {
		return err
	}
	return s.master.DeleteSymptom(ctx, v.ID, id)
}

// ReorderSymptoms implements #41.
func (s *Service) ReorderSymptoms(ctx context.Context, v Viewer, categoryID uuid.UUID, ids []uuid.UUID, version time.Time) ([]repair.SymptomAdmin, error) {
	if err := s.need(v, PermCategories); err != nil {
		return nil, err
	}
	return s.master.ReorderSymptoms(ctx, v.ID, categoryID, ids, version)
}

// ContractorTypes implements #42.
func (s *Service) ContractorTypes(ctx context.Context, v Viewer) ([]repair.ContractorTypeAdmin, error) {
	if err := s.need(v, PermContractorTypes); err != nil {
		return nil, err
	}
	return s.master.ContractorTypes(ctx)
}

// CreateContractorType implements #43.
func (s *Service) CreateContractorType(ctx context.Context, v Viewer, in repair.ContractorTypeInput) (repair.ContractorTypeAdmin, error) {
	if err := s.need(v, PermContractorTypes); err != nil {
		return repair.ContractorTypeAdmin{}, err
	}
	return s.master.CreateContractorType(ctx, v.ID, in)
}

// UpdateContractorType implements #44.
func (s *Service) UpdateContractorType(ctx context.Context, v Viewer, id uuid.UUID, in repair.ContractorTypeInput) (repair.ContractorTypeAdmin, error) {
	if err := s.need(v, PermContractorTypes); err != nil {
		return repair.ContractorTypeAdmin{}, err
	}
	return s.master.UpdateContractorType(ctx, v.ID, id, in)
}

// DeleteContractorType implements #45.
func (s *Service) DeleteContractorType(ctx context.Context, v Viewer, id uuid.UUID) error {
	if err := s.need(v, PermContractorTypes); err != nil {
		return err
	}
	return s.master.DeleteContractorType(ctx, v.ID, id)
}
