// Package settings is ตั้งค่าระบบ: administration of roles, permissions, users, audit and master data.
// It has no tables of its own; it orchestrates platform services and repair's settings interface
// (D-048). Every route needs a `settings.*` permission (BR-ALL-1, CR-001, CR-006).
package settings

import (
	"github.com/pithawat/BAMBAM/backend/internal/platform/permissions"
	"github.com/pithawat/BAMBAM/backend/internal/platform/users"
)

// The settings permissions (settings 04-api-contract.md → Permission keys). Stored and tickable
// since CR-006 (before: fixed by role key, D-111); default admin has all, super_admin always.
const (
	PermLocations       = "settings.locations.manage"
	PermAssets          = "settings.assets.manage"
	PermCategories      = "settings.categories.manage"
	PermContractorTypes = "settings.contractor_types.manage"
	PermUsersView       = "settings.users.view"
	PermUsers           = "settings.users.manage"
	PermRoles           = "settings.roles.manage"
	PermAudit           = "settings.audit.view"
)

var adminOnly = []string{users.RoleAdmin}

// Permissions is the "ตั้งค่าระบบ" system (CR-006: no longer fixed). Who may tick what is limited by
// the guard rules G1–G3 (guards.go), not by the catalog.
var Permissions = permissions.System{
	Key:  "settings",
	Name: "ตั้งค่าระบบ",
	Groups: []permissions.Group{{Key: "settings", Name: "ตั้งค่าระบบ", Permissions: []permissions.Permission{
		{Key: PermLocations, Label: "อาคารและห้อง", Description: "แก้ชื่ออาคาร ห้อง และประเภทอาคาร", Defaults: adminOnly},
		{Key: PermAssets, Label: "อุปกรณ์และประเภทอุปกรณ์", Description: "เพิ่ม ย้าย แก้ไขอุปกรณ์ในห้องและประเภทอุปกรณ์ รวมการจัดวางใน dashboard", Defaults: adminOnly},
		{Key: PermCategories, Label: "หมวดงานและอาการ", Description: "ตั้งค่าหมวดงาน อาการ และความเร่งด่วน", Defaults: adminOnly},
		{Key: PermContractorTypes, Label: "ประเภทผู้รับเหมา", Description: "ตั้งค่าประเภทผู้รับเหมา", Defaults: adminOnly},
		{Key: PermUsersView, Label: "ดูรายชื่อผู้ใช้", Description: "ดูรายชื่อผู้ใช้และ role ของแต่ละคน (อ่านอย่างเดียว)", Defaults: adminOnly},
		{Key: PermUsers, Label: "เปลี่ยน role ผู้ใช้", Description: "เปลี่ยน role ของผู้ใช้ (รวมการดูรายชื่อ)", Defaults: adminOnly},
		{Key: PermRoles, Label: "Role และสิทธิ์", Description: "เพิ่ม แก้ ลบ role และติ๊กสิทธิ์", Defaults: adminOnly},
		{Key: PermAudit, Label: "ประวัติการเปลี่ยนแปลง", Description: "ดูว่าใครเปลี่ยนอะไรในตั้งค่าระบบ", Defaults: adminOnly},
	}}},
}
