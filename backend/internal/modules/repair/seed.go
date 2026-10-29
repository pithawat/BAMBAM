package repair

import (
	"strconv"

	"github.com/google/uuid"
)

// Sample master data from docs/modules/repair/ui/screens/_common.md §8 (+ CR-008 priorities and
// building names) — SAMPLE ONLY, replaced when the real seed files arrive (PROGRESS.md Open issues).
// Ids are derived from stable keys, so every dev/UAT database gets the same ids.

var seedNamespace = uuid.MustParse("5b0d3c8e-7a51-4c2f-9f61-2d8a4e7b1c90")

func seedID(parts ...string) uuid.UUID {
	key := ""
	for _, p := range parts {
		key += "/" + p
	}
	return uuid.NewSHA1(seedNamespace, []byte(key))
}

type sampleSymptom struct{ name, priority string }

func sampleCategories() []Category {
	type cat struct {
		name, icon, def string
		symptoms        []sampleSymptom
	}
	data := []cat{
		{"ระบบปรับอากาศ", "snowflake", PriorityMedium, []sampleSymptom{{"แอร์ไม่เย็น", PriorityMedium}, {"มีน้ำหยด", PriorityHigh}, {"มีเสียงดัง", PriorityMedium}, {"มีกลิ่นอับ", PriorityLow}, {"เปิดไม่ติด", PriorityHigh}}},
		{"ไฟฟ้าและแสงสว่าง", "lightbulb", PriorityHigh, []sampleSymptom{{"ไฟไม่ติด", PriorityMedium}, {"ไฟกะพริบ", PriorityLow}, {"ปลั๊กไม่มีไฟ", PriorityMedium}, {"เบรกเกอร์ตัด", PriorityCritical}}},
		{"ประปาและสุขภัณฑ์", "droplets", PriorityMedium, []sampleSymptom{{"น้ำรั่ว", PriorityHigh}, {"ท่อตัน", PriorityMedium}, {"ชักโครกกดไม่ลง", PriorityMedium}, {"น้ำไม่ไหล", PriorityHigh}}},
		{"อาคารและเฟอร์นิเจอร์", "armchair", PriorityLow, []sampleSymptom{{"ประตูปิดไม่สนิท", PriorityLow}, {"กระเบื้องแตก", PriorityMedium}, {"เก้าอี้ชำรุด", PriorityLow}, {"ฝ้าเพดานรั่ว", PriorityHigh}}},
		{"ความสะอาด", "sparkles", PriorityMedium, []sampleSymptom{{"พื้นเปียก", PriorityHigh}, {"ขยะล้น", PriorityMedium}, {"มีกลิ่นไม่พึงประสงค์", PriorityLow}}},
	}
	out := make([]Category, 0, len(data))
	for _, c := range data {
		cat := Category{ID: seedID("category", c.name), Name: c.name, Icon: c.icon, DefaultPriority: c.def}
		for _, s := range c.symptoms {
			cat.Symptoms = append(cat.Symptoms, Symptom{ID: seedID("symptom", c.name, s.name), Name: s.name, Priority: s.priority})
		}
		out = append(out, cat)
	}
	return out
}

// sampleBuilding: key keeps the id stable (it was the first sample name); name is shown (CR-008).
type sampleBuilding struct {
	key, name string
	floors    int
}

var sampleBuildingData = []sampleBuilding{
	{"อาคารหลัก", "อาคารฝั่ง Office", 7},
	{"อาคารด้านหลัง", "อาคาร Office โรงงานบางซ่อน", 2},
}

func sampleBuildings() []Building {
	out := make([]Building, 0, len(sampleBuildingData))
	for _, b := range sampleBuildingData {
		building := Building{ID: seedID("building", b.key), Name: b.name}
		for level := 1; level <= b.floors; level++ {
			name := strconv.Itoa(level)
			building.Floors = append(building.Floors, Floor{ID: seedID("floor", b.key, name), Name: name, Level: int32(level)}) // #nosec G115 -- small constant
		}
		out = append(out, building)
	}
	return out
}

// SampleRename renames a sample building that still has its first sample name.
type SampleRename struct {
	ID       uuid.UUID
	From, To string
}

func sampleBuildingRenames() []SampleRename {
	out := make([]SampleRename, 0, len(sampleBuildingData))
	for _, b := range sampleBuildingData {
		out = append(out, SampleRename{ID: seedID("building", b.key), From: b.key, To: b.name})
	}
	return out
}
