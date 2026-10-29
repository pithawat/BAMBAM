package users

// MeResponse = P1 GET /api/v1/me in docs/modules/repair/04-api-contract.md.
type MeResponse struct {
	ID                   string  `json:"id"`
	EmployeeCode         string  `json:"employeeCode"`
	Name                 string  `json:"name"`
	Position             *string `json:"position"`
	Department           *string `json:"department"`
	Division             *string `json:"division"`
	Email                *string `json:"email"`
	Role                 string  `json:"role"`
	TechnicianCategories []Ref   `json:"technicianCategories"`
	IsDemoUser           bool    `json:"isDemoUser"`
	// Environment is "DEV", "UAT", or null in production.
	Environment *string `json:"environment"`
}

// DemoUserResponse = P2 GET /api/v1/dev/demo-users item.
type DemoUserResponse struct {
	Role string `json:"role"`
	Name string `json:"name"`
}

func NewMeResponse(u User, categories []Ref, envLabel string) MeResponse {
	if categories == nil {
		categories = []Ref{}
	}
	var env *string
	if envLabel != "" {
		env = &envLabel
	}
	return MeResponse{
		ID:                   u.ID.String(),
		EmployeeCode:         u.EmployeeCode,
		Name:                 u.DisplayName(),
		Position:             u.PositionTH,
		Department:           u.Department,
		Division:             u.Division,
		Email:                u.Email,
		Role:                 u.Role,
		TechnicianCategories: categories,
		IsDemoUser:           u.IsDemo,
		Environment:          env,
	}
}
