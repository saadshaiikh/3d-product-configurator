package httpapi

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgtype"

	"yourrepo/backend/internal/sqlc/dbgen"
)

func normalizeColors(input map[string]string) (map[string]string, error) {
	if len(input) == 0 {
		return nil, fmt.Errorf("colors must be non-empty")
	}

	out := make(map[string]string, len(input))
	for k, v := range input {
		if strings.TrimSpace(k) == "" {
			return nil, fmt.Errorf("color key must be non-empty")
		}
		if !hexColorRe.MatchString(v) {
			return nil, fmt.Errorf("invalid color value")
		}
		out[k] = strings.ToLower(v)
	}
	return out, nil
}

func colorsFromJSONB(raw []byte) (map[string]string, error) {
	if len(raw) == 0 {
		return nil, fmt.Errorf("colors missing")
	}
	var out map[string]string
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, err
	}
	return normalizeColors(out)
}

func valueOrEmpty(v pgtype.Text) string {
	if s, ok := textFromPgtype(v); ok {
		return s
	}
	return ""
}

func configDTOFromRow(cfg dbgen.Config) (configDTO, error) {
	colorsOut, err := colorsFromJSONB(cfg.Colors)
	if err != nil {
		return configDTO{}, err
	}

	return configDTO{
		ID:        cfg.ID.String(),
		ModelID:   cfg.ModelID,
		Title:     valueOrEmpty(cfg.Title),
		Colors:    colorsOut,
		Revision:  cfg.Revision,
		IsPublic:  cfg.IsPublic,
		CreatedAt: timeFromTimestamptz(cfg.CreatedAt),
		UpdatedAt: timeFromTimestamptz(cfg.UpdatedAt),
	}, nil
}
