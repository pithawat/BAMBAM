package repair

import "github.com/gin-gonic/gin"

// RegisterRoutes mounts the module on /api/v1/repair (behind the auth guard).
func RegisterRoutes(rg *gin.RouterGroup, c *Controller) {
	rg.GET("/categories", c.Categories)
	rg.GET("/buildings", c.Buildings)
	rg.GET("/me/recent-places", c.RecentPlaces)
	rg.POST("/photos", c.UploadPhoto)
	rg.GET("/photos/:id", c.Photo)
	rg.POST("/tickets", c.CreateTicket)
	rg.GET("/tickets", c.Tickets)
	rg.GET("/tickets/counts", c.TicketCounts)
	rg.GET("/tickets/:id", c.Ticket)
	rg.POST("/tickets/:id/assess", c.Assess)
	rg.POST("/tickets/:id/resolve", c.Resolve)
	rg.POST("/tickets/:id/confirm", c.Confirm)
	rg.POST("/tickets/:id/send-back", c.SendBack)
	rg.POST("/tickets/:id/close", c.Close)
	rg.GET("/contractor-types", c.ContractorTypes)
	rg.POST("/contractor-types", c.CreateContractorType)
	rg.GET("/contractors", c.Contractors)
	rg.POST("/contractors", c.CreateContractor)
	rg.GET("/contractors/:id", c.Contractor)
	rg.PUT("/contractors/:id", c.UpdateContractor)
	rg.GET("/contractors/:id/jobs", c.ContractorJobs)
	// CR-016 (Stage 3D)
	rg.GET("/admin/overview", c.Overview)
	rg.GET("/asset-types", c.AssetTypes)
	rg.GET("/floors/:id/plan", c.FloorPlan)
	rg.GET("/assets/suggest-code", c.SuggestAssetCode)
	rg.POST("/assets", c.CreateAsset)
	rg.PUT("/assets/:id", c.UpdateAsset)
	rg.POST("/assets/:id/deactivate", c.DeactivateAsset)
}
