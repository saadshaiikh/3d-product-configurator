package seed

type PartSpec struct {
	PartID        string
	DisplayName   string
	Selectable    bool
	SortOrder     int32
	DefaultColor  string
	MeshSelectors []string
}

type ModelSpec struct {
	ID          string
	DisplayName string
	Status      string
	Parts       []PartSpec
	Aliases     map[string]string
}

func Specs() []ModelSpec {
	return []ModelSpec{
		{
			ID:          "shoe",
			DisplayName: "Shoe",
			Status:      "published",
			Parts: []PartSpec{
				{
					PartID:        "sole",
					DisplayName:   "Sole",
					Selectable:    true,
					SortOrder:     1,
					DefaultColor:  "#ffffff",
					MeshSelectors: []string{"SoleMesh"},
				},
				{
					PartID:       "laces",
					DisplayName:  "Laces",
					Selectable:   true,
					SortOrder:    2,
					DefaultColor: "#ffffff",
				},
			},
			Aliases: map[string]string{
				"bottom":  "sole",
				"strings": "laces",
			},
		},
	}
}
