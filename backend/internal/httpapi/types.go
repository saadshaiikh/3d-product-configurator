package httpapi

type modelAssets struct {
	GLTFURL string `json:"gltfUrl"`
	BaseURL string `json:"baseUrl,omitempty"`
}

type partDTO struct {
	ID            string   `json:"id"`
	DisplayName   string   `json:"displayName"`
	Selectable    bool     `json:"selectable"`
	DefaultColor  string   `json:"defaultColor,omitempty"`
	MeshSelectors []string `json:"meshSelectors,omitempty"`
}

type modelDetailDTO struct {
	ID            string            `json:"id"`
	DisplayName   string            `json:"displayName"`
	Status        string            `json:"status"`
	ThumbnailURL  string            `json:"thumbnailUrl,omitempty"`
	Assets        modelAssets       `json:"assets"`
	Parts         []partDTO         `json:"parts"`
	Aliases       map[string]string `json:"aliases"`
	DefaultColors map[string]string `json:"defaultColors"`
	UpdatedAt     string            `json:"updatedAt"`
}

type postConfigsRequest struct {
	ModelID  string            `json:"modelId"`
	Title    string            `json:"title,omitempty"`
	Colors   map[string]string `json:"colors"`
	IsPublic *bool             `json:"isPublic,omitempty"`
}

type configDTO struct {
	ID        string            `json:"id"`
	ModelID   string            `json:"modelId"`
	Title     string            `json:"title,omitempty"`
	Colors    map[string]string `json:"colors"`
	Revision  int64             `json:"revision"`
	IsPublic  bool              `json:"isPublic"`
	CreatedAt string            `json:"createdAt"`
	UpdatedAt string            `json:"updatedAt"`
}
