package repair

import (
	"strconv"

	"github.com/google/uuid"
)

// Sample locations (buildings, floors, rooms) — SAMPLE ONLY until the owner's lists arrive (PROGRESS.md
// Open issues). Categories and symptoms are the real master loaded by migration 20261019000001 (CR-014).
// Ids are derived from stable keys, so every dev/UAT database gets the same ids.

var seedNamespace = uuid.MustParse("5b0d3c8e-7a51-4c2f-9f61-2d8a4e7b1c90")

func seedID(parts ...string) uuid.UUID {
	key := ""
	for _, p := range parts {
		key += "/" + p
	}
	return uuid.NewSHA1(seedNamespace, []byte(key))
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
			floor := Floor{ID: seedID("floor", b.key, name), Name: name, Level: int32(level)} // #nosec G115 -- small constant
			for _, rm := range sampleRooms(b.key, level) {
				rm.ID = seedID("room", b.key, name, rm.Name)
				floor.Rooms = append(floor.Rooms, rm)
			}
			building.Floors = append(building.Floors, floor)
		}
		out = append(out, building)
	}
	return out
}

// sampleRooms: meeting rooms, restrooms, pantry and an office per floor, plus the common area every
// floor has (CR-014). Floor 2 of the main building has more than 9 rooms, so S03 shows the room picker.
func sampleRooms(buildingKey string, level int) []Room {
	n := strconv.Itoa(level)
	meetings := []string{"A", "B"}
	if buildingKey == "อาคารหลัก" && level == 2 {
		meetings = []string{"A", "B", "C", "D", "E", "F"}
	}
	var rooms []Room
	for _, m := range meetings {
		rooms = append(rooms, Room{Name: "ห้องประชุม " + n + m, AreaType: AreaMeetingRoom})
	}
	rooms = append(rooms,
		Room{Name: "สำนักงานชั้น " + n, AreaType: AreaOffice},
		Room{Name: "ห้องน้ำชาย", AreaType: AreaRestroom},
		Room{Name: "ห้องน้ำหญิง", AreaType: AreaRestroom},
	)
	if buildingKey == "อาคารหลัก" {
		rooms = append(rooms, Room{Name: "Pantry", AreaType: AreaPantry})
	}
	return append(rooms, Room{Name: "พื้นที่ส่วนกลางชั้น " + n, AreaType: AreaCommon})
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
