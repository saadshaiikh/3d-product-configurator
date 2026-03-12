package httpapi

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

var modelIDRe = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]{1,63}$`)
var hexColorRe = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

func (s *Server) HandleGetModelByID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" || !modelIDRe.MatchString(id) {
		http.Error(w, "invalid model id", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()

	m, err := s.Queries.GetModelByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) || errors.Is(err, sql.ErrNoRows) {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		http.Error(w, "failed to load model", http.StatusInternalServerError)
		return
	}

	if m.Status == "archived" {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}

	partsRows, err := s.Queries.ListModelParts(ctx, id)
	if err != nil {
		http.Error(w, "failed to load parts", http.StatusInternalServerError)
		return
	}

	aliasRows, err := s.Queries.ListModelAliases(ctx, id)
	if err != nil {
		http.Error(w, "failed to load aliases", http.StatusInternalServerError)
		return
	}

	aliases := make(map[string]string, len(aliasRows))
	for _, a := range aliasRows {
		aliases[a.Alias] = a.PartID
	}

	parts := make([]partDTO, 0, len(partsRows))
	defaultColors := make(map[string]string)
	for _, p := range partsRows {
		dto := partDTO{
			ID:          p.PartID,
			DisplayName: p.DisplayName,
			Selectable:  p.Selectable,
		}

		if dc, ok := textFromPgtype(p.DefaultColor); ok && hexColorRe.MatchString(dc) {
			dto.DefaultColor = dc
			defaultColors[p.PartID] = dc
		}

		if ms, ok := stringsFromJSONB(p.MeshSelectors); ok && len(ms) > 0 {
			dto.MeshSelectors = ms
		}

		parts = append(parts, dto)
	}

	thumb, _ := textFromPgtype(m.ThumbnailUrl)
	baseURL, _ := textFromPgtype(m.BaseUrl)
	updatedAt := timeFromTimestamptz(m.UpdatedAt)

	assets := modelAssets{GLTFURL: m.GltfUrl}
	if baseURL != "" {
		assets.BaseURL = baseURL
	}

	resp := map[string]any{
		"model": modelDetailDTO{
			ID:           m.ID,
			DisplayName:  m.DisplayName,
			Status:       m.Status,
			ThumbnailURL: thumb,
			Assets:       assets,
			Parts:        parts,
			Aliases:      aliases,
			DefaultColors: func() map[string]string {
				if len(defaultColors) == 0 {
					return map[string]string{}
				}
				return defaultColors
			}(),
			UpdatedAt: updatedAt,
		},
	}

	writeJSON(w, http.StatusOK, resp)
}

func textFromPgtype(v pgtype.Text) (string, bool) {
	if !v.Valid {
		return "", false
	}
	return v.String, true
}

func timeFromTimestamptz(v pgtype.Timestamptz) string {
	if !v.Valid {
		return ""
	}
	return v.Time.UTC().Format(time.RFC3339Nano)
}

func stringsFromJSONB(v []byte) ([]string, bool) {
	if len(v) == 0 {
		return nil, false
	}
	var out []string
	if err := json.Unmarshal(v, &out); err != nil {
		return nil, false
	}
	return out, true
}
