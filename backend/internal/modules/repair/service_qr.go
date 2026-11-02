package repair

import (
	"context"
	"strings"

	"github.com/pithawat/BAMBAM/backend/internal/platform/apperr"
)

// LookupAsset implements #25 (F13-B): the asset behind a QR or a typed code, with its current place
// (BR-F13B-3: the QR holds the code only, so a moved asset prefills its new room) and the category to
// prefill. Whoever may report — or record a team job — may look an asset up (settings CR-006).
func (s *Service) LookupAsset(ctx context.Context, v Viewer, code string) (AssetLookup, error) {
	if !reports(v) && !isLead(v) {
		return AssetLookup{}, apperr.ErrForbidden
	}
	code = strings.TrimSpace(code)
	// a code that can never exist (BR-F31-1) is simply not found: S03 / S16 show "not found"
	if len(code) > MaxAssetCodeChars || !validAssetCode(code) {
		return AssetLookup{}, ErrAssetNotFound
	}
	a, err := s.repo.LookupAsset(ctx, code)
	if err != nil {
		return AssetLookup{}, err
	}
	cats, err := s.repo.AssetTypeCategories(ctx, a.TypeID, a.Building.ID)
	if err != nil {
		return AssetLookup{}, err
	}
	a.Category = prefillCategory(cats)
	return a, nil
}
