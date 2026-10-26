// Package users owns platform users, their single global role (D-003, D-004),
// the audit log and the dev/UAT demo users (D-005).
package users

import (
	"github.com/google/uuid"

	"github.com/pithawat/BAMBAM/backend/internal/platform/people"
	"github.com/pithawat/BAMBAM/backend/internal/platform/permissions"
)

// Keys of the seeded roles (glossary). Roles are data (settings Stage 1): other keys exist too.
// repair CR-024: there is no `executive` role.
const (
	RoleSuperAdmin      = permissions.SuperAdminRole
	RoleEmployee        = "employee"
	RoleHousekeeperLead = "housekeeper_lead"
	RoleSecurityLead    = "security_lead"
	RoleTechnician      = "technician"
	RoleAdmin           = "admin"
)

type User struct {
	ID           uuid.UUID
	EmployeeCode string
	FirstNameTH  *string
	LastNameTH   *string
	FirstNameEN  *string
	LastNameEN   *string
	Email        *string
	Department   *string
	Division     *string
	PositionTH   *string
	IsDemo       bool
	Role         string // role key
	RoleName     string
	// Permissions is the effective set: stored + fixed keys of the role (super_admin = all).
	Permissions []string
}

// DisplayName is the Thai full name, falling back to English, then the employee code.
func (u User) DisplayName() string {
	return people.DisplayName(u.EmployeeCode, u.FirstNameTH, u.LastNameTH, u.FirstNameEN, u.LastNameEN)
}

// SSOClaims are the RMC SSO claims BAMBAM stores (docs/shared/integrations/sso.md "Claims → app user").
// LINE_USER_ID is deliberately not stored.
type SSOClaims struct {
	Subject      string
	EmployeeCode string // USER
	FirstNameTH  string
	LastNameTH   string
	FirstNameEN  string
	LastNameEN   string
	Email        string
	Department   string
	Division     string
	PositionTH   string
}

// Ref is { id, name } as used across the API contract.
type Ref struct {
	ID   uuid.UUID `json:"id"`
	Name string    `json:"name"`
}

// demoUser is one seeded user per seeded role for the role switcher. Names from
// docs/modules/repair/ui/screens/_common.md §8 (fictional). Other roles get a generated demo user
// on the first switch (settings P3).
type demoUser struct {
	EmployeeCode string
	Role         string
	FirstNameTH  string
	LastNameTH   string
	Department   string
	PositionTH   string
}

var demoUsers = []demoUser{
	{"DEMO-EMPLOYEE", RoleEmployee, "วรรณา", "สุขประเสริฐ", "ฝ่ายบัญชี", "พนักงานบัญชีอาวุโส"},
	{"DEMO-HOUSEKEEPER-LEAD", RoleHousekeeperLead, "มาลี", "ทองดี", "ฝ่ายอาคารสถานที่", ""},
	{"DEMO-SECURITY-LEAD", RoleSecurityLead, "สมศักดิ์", "แก้วกล้า", "ฝ่ายอาคารสถานที่", ""},
	{"DEMO-TECHNICIAN", RoleTechnician, "ธนากร", "พึ่งบุญ", "ฝ่ายอาคารสถานที่", ""},
	{"DEMO-ADMIN", RoleAdmin, "ปวีณา", "ศรีสุข", "ศูนย์จัดการงานอาคาร", ""},
	{"DEMO-SUPER-ADMIN", RoleSuperAdmin, "ณัฐพล", "อินทรวงศ์", "ฝ่ายเทคโนโลยีสารสนเทศ", "เจ้าหน้าที่ระบบ"},
}
