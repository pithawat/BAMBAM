package repair

import (
	"encoding/json"
	"strings"
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

// CR-025: #1 sends `buildingTypeIds` (an empty list, never null, for "อื่น ๆ") and no `areaTypes`;
// #2 sends `buildingType` on every building.
func TestMasterDataShape(t *testing.T) {
	office := uuid.New()
	cats, err := json.Marshal(toCategoryDTOs([]Category{
		{ID: uuid.New(), Name: "ระบบปรับอากาศ", BuildingTypeIDs: []uuid.UUID{office}},
		{ID: uuid.New(), Name: "อื่น ๆ", IsOther: true},
	}))
	if err != nil {
		t.Fatal(err)
	}
	if s := string(cats); !strings.Contains(s, `"buildingTypeIds":["`+office.String()+`"]`) ||
		!strings.Contains(s, `"buildingTypeIds":[]`) || strings.Contains(s, "areaTypes") {
		t.Fatalf("#1 = %s", s)
	}
	blds, err := json.Marshal(toBuildingDTOs([]Building{{ID: uuid.New(), Name: "อาคาร 1", BuildingType: Ref{ID: office, Name: "อาคารสำนักงาน"}}}))
	if err != nil {
		t.Fatal(err)
	}
	if s := string(blds); !strings.Contains(s, `"buildingType":{"id":"`+office.String()+`","name":"อาคารสำนักงาน"}`) {
		t.Fatalf("#2 = %s", s)
	}
}
