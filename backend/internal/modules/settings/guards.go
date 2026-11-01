package settings

import (
	"slices"

	"github.com/pithawat/BAMBAM/backend/internal/platform/apperr"
	"github.com/pithawat/BAMBAM/backend/internal/platform/permissions"
	"github.com/pithawat/BAMBAM/backend/internal/platform/roles"
)

// Guard rules of settings CR-006 (code, not matrix). They apply to everyone but Superadmin:
//   - G1 OWN_ROLE: not their own role in the matrix (edit, rename, delete) — their own role change is
//     CANNOT_CHANGE_SELF as before;
//   - G2 SUPER_ADMIN: never the super_admin role, never give or take super_admin;
//   - G3 ESCALATION: tick / untick only keys they hold, copy or assign only a role whose
//     permissions are all within their own.
//
// G4 (every change audited) is the roles / users services' job.
const (
	RuleOwnRole    = "OWN_ROLE"
	RuleSuperAdmin = "SUPER_ADMIN"
	RuleEscalation = "ESCALATION"
)

// guardError is `403 PERMISSION_GUARD` with `details.rule`.
func guardError(rule string) error {
	return &apperr.Error{Kind: apperr.KindForbidden, Code: "PERMISSION_GUARD", Message: "refused by guard rule " + rule,
		Details: map[string]string{"rule": rule}}
}

func (v Viewer) isSuperAdmin() bool { return v.RoleKey == permissions.SuperAdminRole }

// roleGuard is the G1 / G2 rule that stops v from touching the role with key roleKey ("" = allowed).
func roleGuard(v Viewer, roleKey string) string {
	switch {
	case v.isSuperAdmin():
		return ""
	case roleKey == permissions.SuperAdminRole:
		return RuleSuperAdmin
	case roleKey == v.RoleKey:
		return RuleOwnRole
	}
	return ""
}

// holdsAll is G3: v holds every key (Superadmin holds all).
func holdsAll(v Viewer, keys []string) bool {
	if v.isSuperAdmin() {
		return true
	}
	for _, k := range keys {
		if !v.Can(k) {
			return false
		}
	}
	return true
}

// grantable is what v may tick or untick in the matrix, in catalog order.
func grantable(v Viewer, catalog []string) []string {
	return slices.DeleteFunc(slices.Clone(catalog), func(k string) bool { return !holdsAll(v, []string{k}) })
}

// assignGuard is G2 / G3 for giving a role to someone ("" = allowed).
func assignGuard(v Viewer, target roles.MatrixRole) string {
	switch {
	case v.isSuperAdmin():
		return ""
	case target.Key == permissions.SuperAdminRole:
		return RuleSuperAdmin
	case !holdsAll(v, target.Permissions):
		return RuleEscalation
	}
	return ""
}

// matrixGuard checks every cell of a matrix save against G1–G3. Unknown roles and keys pass: the
// roles service answers ROLE_NOT_FOUND / UNKNOWN_PERMISSION.
func matrixGuard(v Viewer, m roles.Matrix, changes []roles.Change) error {
	known := catalogKeys(m)
	for _, c := range changes {
		r, ok := matrixRole(m, c.RoleID.String())
		if !ok || !slices.Contains(known, c.Permission) {
			continue
		}
		if rule := roleGuard(v, r.Key); rule != "" {
			return guardError(rule)
		}
		if !holdsAll(v, []string{c.Permission}) {
			return guardError(RuleEscalation)
		}
	}
	return nil
}

// catalogKeys is every key of the matrix's systems, in catalog order.
func catalogKeys(m roles.Matrix) []string {
	var out []string
	for _, s := range m.Systems {
		for _, g := range s.Groups {
			for _, p := range g.Permissions {
				out = append(out, p.Key)
			}
		}
	}
	return out
}

func matrixRole(m roles.Matrix, id string) (roles.MatrixRole, bool) {
	for _, r := range m.Roles {
		if r.ID.String() == id {
			return r, true
		}
	}
	return roles.MatrixRole{}, false
}
