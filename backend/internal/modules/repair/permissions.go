package repair

import "github.com/pithawat/BAMBAM/backend/internal/platform/permissions"

// Permission keys of the repair system (settings 04-api-contract.md → Permission keys, repair CR-007).
// `repair.ticket.set_priority` does not exist (repair CR-015). `report` and `building3d.view` come
// from settings CR-006.
const (
	PermReport           = "repair.ticket.report"
	PermViewAll          = "repair.ticket.view_all"
	PermWork             = "repair.ticket.work"
	PermCloseAny         = "repair.ticket.close_any"
	PermTeamHandle       = "repair.ticket.team_handle"
	PermHandoverAny      = "repair.ticket.handover_any"
	PermContractorManage = "repair.contractor.manage"
	PermOverviewView     = "repair.overview.view"
	PermBuilding3D       = "repair.building3d.view"

	// permAssetsManage is registered by the settings module (default admin; super_admin always);
	// repair asset writes #31–#34 check it (settings CR-001, CR-006).
	permAssetsManage = "settings.assets.manage"
)

// Permissions is the repair catalog with the S24 copy and the seeded defaults
// (settings 01-users.md → Permission catalog; the platform_roles migration seeds the same rows).
var Permissions = permissions.System{
	Key:  "repair",
	Name: "ระบบแจ้งซ่อม",
	Groups: []permissions.Group{
		// settings CR-006: reporting is no longer a base right; every seeded role but technician has it.
		{Key: "repair.access", Name: "การใช้บริการแจ้งซ่อม", Permissions: []permissions.Permission{
			{Key: PermReport, Label: "แจ้งซ่อม", Description: "แจ้งงานใหม่ สแกน QR แจ้ง และติดตามเคสเดิม",
				Defaults: []string{"employee", "housekeeper_lead", "security_lead", "admin"}},
		}},
		{Key: "repair.ticket", Name: "งานแจ้งซ่อม", Permissions: []permissions.Permission{
			{Key: PermViewAll, Label: "ดูทุกงาน", Description: "เห็นงานซ่อมทุกงาน รวมชื่อและคะแนนช่างภายนอก",
				Defaults: []string{"technician", "admin"}},
			{Key: PermWork, Label: "ดำเนินการและบันทึกผลซ่อม", Description: "งานซ่อมทุกงานส่งถึง role นี้ ประเมินวันคาดว่าเสร็จ และบันทึกผลซ่อม",
				Defaults: []string{"technician"}},
			{Key: PermCloseAny, Label: "ปิดงานใดก็ได้", Description: "ปิดงานได้โดยไม่ต้องรอผู้แจ้งตรวจรับ",
				Defaults: []string{"admin"}},
		}},
		{Key: "repair.team", Name: "งานทีม ช่างภายนอก และภาพรวมอาคาร", Permissions: []permissions.Permission{
			{Key: PermTeamHandle, Label: "บันทึกงานทีมทำเอง", Description: "บันทึกงานที่ทีมทำเอง และส่งต่องานที่ตัวเองบันทึกให้ช่าง",
				Defaults: []string{"housekeeper_lead", "security_lead"}},
			{Key: PermHandoverAny, Label: "ส่งต่องานทีมทุกงาน", Description: "ส่งต่องานทีมทำเองของทุกคนให้ช่าง",
				Defaults: []string{"admin"}},
			{Key: PermContractorManage, Label: "จัดการช่างภายนอก", Description: "เพิ่มและแก้ไขข้อมูลช่างภายนอก",
				Defaults: []string{"technician"}},
			{Key: PermOverviewView, Label: "ดูภาพรวมอาคาร", Description: "ดู dashboard อาคารและงานที่ยังไม่ปิด",
				Defaults: []string{"admin"}},
			{Key: PermBuilding3D, Label: "ดูโมเดล 3D อาคาร", Description: "ดูโมเดล 3 มิติของอาคารและภาพรวมพื้นที่ใน dashboard (ต้องมีสิทธิ์ดูภาพรวมอาคาร)",
				Defaults: []string{"admin"}, Requires: PermOverviewView},
		}},
	},
}
