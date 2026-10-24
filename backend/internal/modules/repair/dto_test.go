package repair

import (
	"testing"

	"github.com/google/uuid"
)

// CR-019: the list carries the category icon; a category without one reads as "wrench", a ticket without a category stays null.
func TestSummaryCategoryIcon(t *testing.T) {
	id := uuid.New()
	icon := "snowflake"
	cases := []struct {
		name string
		in   TicketSummary
		want string
	}{
		{"icon", TicketSummary{Category: &Ref{ID: id, Name: "ระบบปรับอากาศ"}, CategoryIcon: &icon}, "snowflake"},
		{"fallback", TicketSummary{Category: &Ref{ID: id, Name: "อื่น ๆ"}}, "wrench"},
	}
	for _, c := range cases {
		d := toSummaryDTO(c.in)
		if d.Category == nil || d.Category.Icon != c.want || d.Category.ID != id {
			t.Fatalf("%s: got %+v, want icon %q", c.name, d.Category, c.want)
		}
	}
	if d := toSummaryDTO(TicketSummary{}); d.Category != nil {
		t.Fatalf("no category: got %+v, want nil", d.Category)
	}
}
