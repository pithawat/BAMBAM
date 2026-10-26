// Package settings is ตั้งค่าระบบ: administration of roles, permissions, users, audit and master data.
// It has no tables of its own; it orchestrates platform services and repair's settings interface
// (D-048). Every route needs a fixed `settings.*` permission (BR-ALL-1, CR-001).
package settings

import (
	"github.com/pithawat/BAMBAM/backend/internal/platform/permissions"
	"github.com/pithawat/BAMBAM/backend/internal/platform/users"
)

// The 7 fixed settings permissions (settings 04-api-contract.md → Permission keys, D-111). They are
// granted from the role key in code, never stored in platform.role_permissions.
const (
	PermLocations       = "settings.locations.manage"
	PermAssets          = "settings.assets.manage"
	PermCategories      = "settings.categories.manage"
	PermContractorTypes = "settings.contractor_types.manage"
	PermUsers           = "settings.users.manage"
	PermRoles           = "settings.roles.manage"
	PermAudit           = "settings.audit.view"
)

var (
	adminAndSuper = []string{users.RoleAdmin, users.RoleSuperAdmin}
	superOnly     = []string{users.RoleSuperAdmin}
)

// Permissions is the "ตั้งค่าระบบ" system: one fixed group, shown ticked and locked in S24.
var Permissions = permissions.System{
	Key:  "settings",
	Name: "ตั้งค่าระบบ",
	Groups: []permissions.Group{{Key: "settings", Name: "ตั้งค่าระบบ", Fixed: true, Permissions: []permissions.Permission{
		{Key: PermLocations, Label: "อาคารและห้อง", Description: "แก้ชื่ออาคารและห้องตามผังอาคาร", FixedRoles: adminAndSuper},
		{Key: PermAssets, Label: "อุปกรณ์และประเภทอุปกรณ์", Description: "เพิ่ม ย้าย แก้ไขอุปกรณ์ในห้องและประเภทอุปกรณ์ รวมการจัดวางใน dashboard", FixedRoles: adminAndSuper},
		{Key: PermCategories, Label: "หมวดงานและอาการ", Description: "ตั้งค่าหมวดงาน อาการ และความเร่งด่วน", FixedRoles: adminAndSuper},
		{Key: PermContractorTypes, Label: "ประเภทผู้รับเหมา", Description: "ตั้งค่าประเภทผู้รับเหมา", FixedRoles: superOnly},
		{Key: PermUsers, Label: "ผู้ใช้", Description: "ค้นหาผู้ใช้และเปลี่ยน role", FixedRoles: superOnly},
		{Key: PermRoles, Label: "Role และสิทธิ์", Description: "เพิ่ม แก้ ลบ role และติ๊กสิทธิ์", FixedRoles: superOnly},
		{Key: PermAudit, Label: "ประวัติการเปลี่ยนแปลง", Description: "ดูว่าใครเปลี่ยนอะไรในตั้งค่าระบบ", FixedRoles: superOnly},
	}}},
}
