package repair

import (
	"github.com/gin-gonic/gin"

	"github.com/pithawat/BAMBAM/backend/internal/platform/httpx"
)

// Stage 5 QR (F13-B).

// Asset handles #25 GET /repair/assets/{code}.
func (ctl *Controller) Asset(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	a, err := ctl.svc.LookupAsset(c.Request.Context(), v, c.Param("code"))
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, toAssetLookupDTO(a))
}
