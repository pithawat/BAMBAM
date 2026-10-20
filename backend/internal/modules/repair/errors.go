package repair

import "github.com/pithawat/BAMBAM/backend/internal/platform/apperr"

// Codes are fixed in docs/modules/repair/04-api-contract.md "Error codes".
var (
	ErrTicketNotFound        = apperr.New(apperr.KindNotFound, "TICKET_NOT_FOUND", "ticket not found")
	ErrPhotoNotFound         = apperr.New(apperr.KindNotFound, "PHOTO_NOT_FOUND", "photo not found")
	ErrPhotoNotAttachable    = apperr.New(apperr.KindBusinessRule, "PHOTO_NOT_FOUND", "photo unknown, expired or not the caller's")
	ErrPhotoTypeNotAllowed   = apperr.New(apperr.KindInvalid, "PHOTO_TYPE_NOT_ALLOWED", "only image files are allowed")
	ErrPhotoTooLarge         = apperr.New(apperr.KindInvalid, "PHOTO_TOO_LARGE", "photo exceeds the size limit")
	ErrMasterDataChanged     = apperr.New(apperr.KindBusinessRule, "MASTER_DATA_CHANGED", "category, symptom, floor or room inactive or mismatched")
	ErrTeamHandledNotAllowed = apperr.New(apperr.KindForbidden, "TEAM_HANDLED_NOT_ALLOWED", "team handled tickets are not available to this user")

	ErrNotTechnician        = apperr.New(apperr.KindForbidden, "NOT_TECHNICIAN", "only the technician can do this")
	ErrNotReporter          = apperr.New(apperr.KindForbidden, "NOT_REPORTER", "only the reporter can do this")
	ErrTicketClosed         = apperr.New(apperr.KindConflict, "TICKET_CLOSED", "ticket is closed")
	ErrInvalidState         = apperr.New(apperr.KindConflict, "INVALID_STATE", "ticket is not in the required status")
	ErrAssessmentRequired   = apperr.New(apperr.KindBusinessRule, "ASSESSMENT_REQUIRED", "assess the ticket before resolving it")
	ErrContractorNotFound   = apperr.New(apperr.KindNotFound, "CONTRACTOR_NOT_FOUND", "contractor not found")
	ErrContractorInactive   = apperr.New(apperr.KindBusinessRule, "CONTRACTOR_NOT_FOUND", "contractor unknown or inactive")
	ErrContractorTypeAbsent = apperr.New(apperr.KindBusinessRule, "CONTRACTOR_TYPE_NOT_FOUND", "a contractor type does not exist")
)

// CR-016 equipment and floor plans.
var (
	ErrAssetNotFound    = apperr.New(apperr.KindNotFound, "ASSET_NOT_FOUND", "asset not found or inactive")
	ErrAssetCodeTaken   = apperr.New(apperr.KindConflict, "ASSET_CODE_TAKEN", "asset code used by another asset")
	ErrPointOutsideRoom = apperr.New(apperr.KindBusinessRule, "POINT_OUTSIDE_ROOM", "point is not inside the room outline")
	ErrFloorNotFound    = apperr.New(apperr.KindNotFound, "FLOOR_NOT_FOUND", "floor not found")
)
