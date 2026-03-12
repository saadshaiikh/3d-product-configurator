package ingest

import (
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"strings"
)

type Spec struct {
	ID          string            `json:"id"`
	DisplayName string            `json:"displayName"`
	Status      string            `json:"status"`
	Assets      AssetsSpec        `json:"assets"`
	Parts       []PartSpec        `json:"parts"`
	Aliases     map[string]string `json:"aliases"`
}

type AssetsSpec struct {
	GLTF  string `json:"gltf"`
	Thumb string `json:"thumb"`
}

type PartSpec struct {
	ID            string   `json:"id"`
	DisplayName   string   `json:"displayName"`
	Selectable    bool     `json:"selectable"`
	SortOrder     int32    `json:"sortOrder"`
	DefaultColor  string   `json:"defaultColor"`
	MeshSelectors []string `json:"meshSelectors"`
}

var (
	modelIDRe = regexp.MustCompile(`^[a-z0-9_-]+$`)
	partIDRe  = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]{1,63}$`)
	colorRe   = regexp.MustCompile(`^#[0-9A-Fa-f]{6}$`)
)

func LoadSpec(path string) (*Spec, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	var spec Spec
	dec := json.NewDecoder(f)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&spec); err != nil {
		return nil, err
	}
	if dec.More() {
		return nil, fmt.Errorf("invalid spec: trailing data")
	}

	if err := ValidateSpec(&spec); err != nil {
		return nil, err
	}

	return &spec, nil
}

func ValidateSpec(spec *Spec) error {
	if spec == nil {
		return fmt.Errorf("spec is nil")
	}
	if spec.ID == "" || !modelIDRe.MatchString(spec.ID) {
		return fmt.Errorf("invalid model id: %q", spec.ID)
	}
	if strings.TrimSpace(spec.DisplayName) == "" {
		return fmt.Errorf("missing displayName")
	}
	if strings.TrimSpace(spec.Status) == "" {
		return fmt.Errorf("missing status")
	}
	if spec.Assets.GLTF != "model.gltf" {
		return fmt.Errorf("assets.gltf must be model.gltf")
	}
	if spec.Assets.Thumb != "thumb.png" {
		return fmt.Errorf("assets.thumb must be thumb.png")
	}

	partIDs := make(map[string]struct{}, len(spec.Parts))
	for i := range spec.Parts {
		p := &spec.Parts[i]
		if p.ID == "" || !partIDRe.MatchString(p.ID) {
			return fmt.Errorf("invalid part id: %q", p.ID)
		}
		if _, ok := partIDs[p.ID]; ok {
			return fmt.Errorf("duplicate part id: %s", p.ID)
		}
		partIDs[p.ID] = struct{}{}
		if strings.TrimSpace(p.DisplayName) == "" {
			return fmt.Errorf("missing displayName for part %s", p.ID)
		}
		if p.DefaultColor != "" {
			if !colorRe.MatchString(p.DefaultColor) {
				return fmt.Errorf("invalid defaultColor for part %s", p.ID)
			}
			p.DefaultColor = strings.ToLower(p.DefaultColor)
		}
	}

	for alias, partID := range spec.Aliases {
		if strings.TrimSpace(alias) == "" {
			return fmt.Errorf("empty alias")
		}
		if _, ok := partIDs[partID]; !ok {
			return fmt.Errorf("alias %s references unknown part %s", alias, partID)
		}
	}

	return nil
}
