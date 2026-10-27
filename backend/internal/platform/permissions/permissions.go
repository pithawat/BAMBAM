// Package permissions is the catalog of action-level permission keys (settings F29, BR-F29-1).
// Each module declares its own System with Thai labels; main.go builds one Registry from them.
//
// Base permissions every role always has (log in, profile, report / scan QR / follow, see own and
// followed tickets) are not keys: they need no check (settings 01-users.md → Permission catalog).
package permissions

import (
	"fmt"
	"slices"
)

// SuperAdminRole always has every key of every system (BR-F25-1); its stored rows are ignored.
const SuperAdminRole = "super_admin"

// Permission is one key with the copy S24 shows.
type Permission struct {
	Key         string
	Label       string
	Description string
	// Defaults are the role keys that have it in the seeded matrix (01-users.md); the migration
	// seeds the same rows. Unused for fixed permissions.
	Defaults []string
	// FixedRoles: for a permission in a fixed group, the role keys it is granted to in code.
	// Fixed permissions are never stored, edited or copied (settings CR-001, D-111).
	FixedRoles []string
}

type Group struct {
	Key         string
	Name        string
	Fixed       bool
	Permissions []Permission
}

// System is one module's permissions, e.g. "ระบบแจ้งซ่อม".
type System struct {
	Key    string
	Name   string
	Groups []Group
}

type Registry struct {
	systems []System
	order   []string // every key in display order
	byKey   map[string]entry
}

type entry struct {
	Permission
	fixed bool
}

// NewRegistry aggregates the systems in display order. Keys must be unique.
func NewRegistry(systems ...System) (*Registry, error) {
	r := &Registry{systems: systems, byKey: map[string]entry{}}
	for _, s := range systems {
		for _, g := range s.Groups {
			for _, p := range g.Permissions {
				if _, dup := r.byKey[p.Key]; dup || p.Key == "" {
					return nil, fmt.Errorf("permission key %q is empty or registered twice", p.Key)
				}
				r.byKey[p.Key] = entry{Permission: p, fixed: g.Fixed}
				r.order = append(r.order, p.Key)
			}
		}
	}
	return r, nil
}

// MustRegistry is NewRegistry for wiring code: a bad catalog is a programming error.
func MustRegistry(systems ...System) *Registry {
	r, err := NewRegistry(systems...)
	if err != nil {
		panic(err)
	}
	return r
}

func (r *Registry) Systems() []System { return r.systems }

// Known reports whether key is in the catalog (fixed keys included).
func (r *Registry) Known(key string) bool {
	_, ok := r.byKey[key]
	return ok
}

// IsFixed reports whether key belongs to a fixed group (not editable in the matrix).
func (r *Registry) IsFixed(key string) bool {
	return r.byKey[key].fixed
}

// Label is the Thai label of key (audit rows store labels, settings F30); "" for an unknown key.
func (r *Registry) Label(key string) string {
	return r.byKey[key].Label
}

// Ordered returns keys in catalog order, dropping unknown ones and duplicates.
func (r *Registry) Ordered(keys []string) []string {
	out := []string{}
	for _, k := range r.order {
		if slices.Contains(keys, k) {
			out = append(out, k)
		}
	}
	return out
}

// Effective is what a role may do: super_admin gets every key; any other role gets its stored keys
// that are still in the catalog and not fixed, plus the fixed keys granted to its key. The result
// is in catalog order.
func (r *Registry) Effective(roleKey string, stored []string) []string {
	out := make([]string, 0, len(r.order))
	for _, k := range r.order {
		e := r.byKey[k]
		switch {
		case roleKey == SuperAdminRole:
		case e.fixed:
			if !slices.Contains(e.FixedRoles, roleKey) {
				continue
			}
		case !slices.Contains(stored, k):
			continue
		}
		out = append(out, k)
	}
	return out
}

// Defaults is the effective set of a seeded role before anyone edits the matrix.
func (r *Registry) Defaults(roleKey string) []string {
	var stored []string
	for _, k := range r.order {
		if slices.Contains(r.byKey[k].Defaults, roleKey) {
			stored = append(stored, k)
		}
	}
	return r.Effective(roleKey, stored)
}

// StoredDefaults are the rows the migration seeds into platform.role_permissions for a role.
func (r *Registry) StoredDefaults(roleKey string) []string {
	out := []string{}
	for _, k := range r.order {
		e := r.byKey[k]
		if !e.fixed && (roleKey == SuperAdminRole || slices.Contains(e.Defaults, roleKey)) {
			out = append(out, k)
		}
	}
	return out
}
