package permissions

import (
	"slices"
	"testing"
)

var testSystems = []System{
	{Key: "repair", Name: "ระบบแจ้งซ่อม", Groups: []Group{{Key: "repair.ticket", Name: "งานแจ้งซ่อม", Permissions: []Permission{
		{Key: "repair.ticket.view_all", Defaults: []string{"technician", "admin"}},
		{Key: "repair.ticket.work", Defaults: []string{"technician"}},
	}}}},
	{Key: "settings", Name: "ตั้งค่าระบบ", Groups: []Group{{Key: "settings", Name: "ตั้งค่าระบบ", Fixed: true, Permissions: []Permission{
		{Key: "settings.assets.manage", FixedRoles: []string{"admin", SuperAdminRole}},
		{Key: "settings.users.manage", FixedRoles: []string{SuperAdminRole}},
	}}}},
}

func TestEffective(t *testing.T) {
	r := MustRegistry(testSystems...)
	cases := []struct {
		name, role string
		stored     []string
		want       []string
	}{
		{"super_admin has every key whatever is stored", SuperAdminRole, nil,
			[]string{"repair.ticket.view_all", "repair.ticket.work", "settings.assets.manage", "settings.users.manage"}},
		{"admin: stored + fixed for its key", "admin", []string{"repair.ticket.view_all"},
			[]string{"repair.ticket.view_all", "settings.assets.manage"}},
		{"a stored fixed key is ignored (BR-F29-8)", "technician", []string{"repair.ticket.work", "settings.users.manage"},
			[]string{"repair.ticket.work"}},
		{"unknown stored keys are dropped", "employee", []string{"repair.ticket.set_priority"}, []string{}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := r.Effective(c.role, c.stored); !slices.Equal(got, c.want) {
				t.Fatalf("got %v, want %v", got, c.want)
			}
		})
	}
}

func TestDefaultsAndStoredDefaults(t *testing.T) {
	r := MustRegistry(testSystems...)
	if got := r.Defaults("admin"); !slices.Equal(got, []string{"repair.ticket.view_all", "settings.assets.manage"}) {
		t.Fatalf("admin defaults = %v", got)
	}
	if got := r.StoredDefaults(SuperAdminRole); !slices.Equal(got, []string{"repair.ticket.view_all", "repair.ticket.work"}) {
		t.Fatalf("super_admin stored = %v (fixed keys are never stored)", got)
	}
	if !r.IsFixed("settings.users.manage") || r.IsFixed("repair.ticket.work") || !r.Known("repair.ticket.work") || r.Known("x") {
		t.Fatal("IsFixed / Known wrong")
	}
}

func TestDuplicateKeyRejected(t *testing.T) {
	dup := System{Key: "x", Groups: []Group{{Permissions: []Permission{{Key: "repair.ticket.work"}}}}}
	if _, err := NewRegistry(append(slices.Clone(testSystems), dup)...); err == nil {
		t.Fatal("want error for a duplicate key")
	}
}

// settings CR-006: a key may require another (S24 greys it out); the required key must exist.
func TestRequiresMustBeKnown(t *testing.T) {
	bad := System{Key: "x", Groups: []Group{{Permissions: []Permission{{Key: "x.child", Requires: "x.parent"}}}}}
	if _, err := NewRegistry(bad); err == nil {
		t.Fatal("want error for an unknown required key")
	}
	ok := System{Key: "x", Groups: []Group{{Permissions: []Permission{{Key: "x.parent"}, {Key: "x.child", Requires: "x.parent"}}}}}
	if r, err := NewRegistry(ok); err != nil || !slices.Equal(r.Keys(), []string{"x.parent", "x.child"}) {
		t.Fatalf("registry %v, err %v", r, err)
	}
}
