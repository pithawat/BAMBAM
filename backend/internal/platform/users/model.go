// Package users owns platform users, their single global role (D-003, D-004),
// the audit log and the dev/UAT demo users (D-005).
package users

import (
	"strings"

	"github.com/google/uuid"
)

const (
	RoleEmployee        = "employee"
	RoleHousekeeperLead = "housekeeper_lead"
	RoleSecurityLead    = "security_lead"
	RoleTechnician      = "technician"
	RoleAdmin           = "admin"
	RoleExecutive       = "executive"
)

// Roles in display order (role switcher list).
var Roles = []string{RoleEmployee, RoleHousekeeperLead, RoleSecurityLead, RoleTechnician, RoleAdmin, RoleExecutive}

func ValidRole(r string) bool {
	for _, v := range Roles {
		if v == r {
			return true
		}
	}
	return false
}

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
	Role         string
}

// DisplayName is the Thai full name, falling back to English, then the employee code.
func (u User) DisplayName() string {
	if n := joinName(u.FirstNameTH, u.LastNameTH); n != "" {
		return n
	}
	if n := joinName(u.FirstNameEN, u.LastNameEN); n != "" {
		return n
	}
	return u.EmployeeCode
}

func joinName(first, last *string) string {
	var parts []string
	for _, p := range []*string{first, last} {
		if p != nil && strings.TrimSpace(*p) != "" {
			parts = append(parts, strings.TrimSpace(*p))
		}
	}
	return strings.Join(parts, " ")
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

// demoUser is one seeded user per role for the role switcher. Names from
// docs/modules/repair/ui/screens/_common.md §8 (fictional).
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
	{"DEMO-EXECUTIVE", RoleExecutive, "ประเสริฐ", "วงศ์ไทย", "ผู้อำนวยการฝ่ายอาคารสถานที่", ""},
}
