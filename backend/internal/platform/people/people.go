// Package people holds the person helpers shared by platform packages (users, roles, audit).
package people

import (
	"strings"

	"github.com/google/uuid"
)

// Ref is the contract's `PersonRef`: { id, name, department }.
type Ref struct {
	ID         uuid.UUID `json:"id"`
	Name       string    `json:"name"`
	Department *string   `json:"department"`
}

// DisplayName is the Thai full name, falling back to English, then the employee code.
func DisplayName(employeeCode string, firstTH, lastTH, firstEN, lastEN *string) string {
	if n := joinName(firstTH, lastTH); n != "" {
		return n
	}
	if n := joinName(firstEN, lastEN); n != "" {
		return n
	}
	return employeeCode
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

// NewRef builds a Ref from the joined `updated_by_*` / `actor_*` columns of a query; nil id = no person.
func NewRef(id *uuid.UUID, code, firstTH, lastTH, firstEN, lastEN, department *string) *Ref {
	if id == nil {
		return nil
	}
	c := ""
	if code != nil {
		c = *code
	}
	return &Ref{ID: *id, Name: DisplayName(c, firstTH, lastTH, firstEN, lastEN), Department: department}
}
