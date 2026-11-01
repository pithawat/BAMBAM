package permissions

// Service access keys of the systems that have no module yet (settings CR-006). Each booking module
// takes its key over (and adds its detailed permissions) at its own discovery.
const (
	CarBookingUse  = "car_booking.use"
	RoomBookingUse = "room_booking.use"
)

// usesServices are the seeded roles that use every service by default: all but technician
// (settings CR-006; super_admin has every key anyway).
var usesServices = []string{"employee", "housekeeper_lead", "security_lead", "admin"}

// Services is the "การเข้าใช้บริการ" system: without a key the service is hidden from Home and the
// navbar and its route shows Forbidden.
var Services = System{
	Key:  "services",
	Name: "การเข้าใช้บริการ",
	Groups: []Group{{Key: "services.booking", Name: "ระบบจองรถและห้องประชุม", Permissions: []Permission{
		{Key: CarBookingUse, Label: "ใช้ระบบจองรถ", Description: "เห็นบริการจองรถในหน้าแรกและเมนู", Defaults: usesServices},
		{Key: RoomBookingUse, Label: "ใช้ระบบจองห้องประชุม", Description: "เห็นบริการจองห้องประชุมในหน้าแรกและเมนู", Defaults: usesServices},
	}}},
}
