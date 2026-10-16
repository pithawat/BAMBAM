package repair

import (
	"strconv"

	"github.com/google/uuid"
)

// Sample master data from docs/modules/repair/ui/screens/_common.md §8 — SAMPLE ONLY,
// replaced when the real seed files arrive (PROGRESS.md Open issues). Ids are derived
// from the names, so every dev/UAT database gets the same ids.

var seedNamespace = uuid.MustParse("5b0d3c8e-7a51-4c2f-9f61-2d8a4e7b1c90")

func seedID(parts ...string) uuid.UUID {
	key := ""
	for _, p := range parts {
		key += "/" + p
	}
	return uuid.NewSHA1(seedNamespace, []byte(key))
}

func sampleCategories() []Category {
	type cat struct {
		name, icon string
		symptoms   []string
	}
	data := []cat{
		{"ระบบปรับอากาศ", "snowflake", []string{"แอร์ไม่เย็น", "มีน้ำหยด", "มีเสียงดัง", "มีกลิ่นอับ", "เปิดไม่ติด"}},
		{"ไฟฟ้าและแสงสว่าง", "lightbulb", []string{"ไฟไม่ติด", "ไฟกะพริบ", "ปลั๊กไม่มีไฟ", "เบรกเกอร์ตัด"}},
		{"ประปาและสุขภัณฑ์", "droplets", []string{"น้ำรั่ว", "ท่อตัน", "ชักโครกกดไม่ลง", "น้ำไม่ไหล"}},
		{"อาคารและเฟอร์นิเจอร์", "armchair", []string{"ประตูปิดไม่สนิท", "กระเบื้องแตก", "เก้าอี้ชำรุด", "ฝ้าเพดานรั่ว"}},
		{"ความสะอาด", "sparkles", []string{"พื้นเปียก", "ขยะล้น", "มีกลิ่นไม่พึงประสงค์"}},
	}
	out := make([]Category, 0, len(data))
	for _, c := range data {
		cat := Category{ID: seedID("category", c.name), Name: c.name, Icon: c.icon}
		for _, s := range c.symptoms {
			cat.Symptoms = append(cat.Symptoms, Ref{ID: seedID("symptom", c.name, s), Name: s})
		}
		out = append(out, cat)
	}
	return out
}

func sampleBuildings() []Building {
	type bld struct {
		name   string
		floors int
	}
	data := []bld{{"อาคารหลัก", 7}, {"อาคารด้านหลัง", 2}}
	out := make([]Building, 0, len(data))
	for _, b := range data {
		building := Building{ID: seedID("building", b.name), Name: b.name}
		for level := 1; level <= b.floors; level++ {
			name := strconv.Itoa(level)
			building.Floors = append(building.Floors, Floor{ID: seedID("floor", b.name, name), Name: name, Level: int32(level)}) // #nosec G115 -- small constant
		}
		out = append(out, building)
	}
	return out
}
