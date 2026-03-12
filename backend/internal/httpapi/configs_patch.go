package httpapi

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"yourrepo/backend/internal/sqlc/dbgen"
)

type patchConfigRequest struct {
	BaseRevision *int64            `json:"baseRevision"`
	Title        *string           `json:"title,omitempty"`
	Colors       map[string]string `json:"colors,omitempty"`
	IsPublic     *bool             `json:"isPublic,omitempty"`
}

func (s *Server) HandlePatchConfig(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	if idStr == "" {
		http.Error(w, "invalid config id", http.StatusBadRequest)
		return
	}

	var id pgtype.UUID
	if err := id.Scan(idStr); err != nil {
		http.Error(w, "invalid config id", http.StatusBadRequest)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)

	var req patchConfigRequest
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	if err := dec.Decode(&struct{}{}); err != io.EOF {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}

	if req.BaseRevision == nil || *req.BaseRevision < 0 {
		http.Error(w, "invalid baseRevision", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()

	current, err := s.Queries.GetConfigByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) || errors.Is(err, sql.ErrNoRows) {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		http.Error(w, "failed to load config", http.StatusInternalServerError)
		return
	}

	if current.Revision != *req.BaseRevision {
		dto, err := configDTOFromRow(current)
		if err != nil {
			http.Error(w, "invalid stored colors", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusConflict, map[string]any{"config": dto})
		return
	}

	currentColors, err := colorsFromJSONB(current.Colors)
	if err != nil {
		http.Error(w, "invalid stored colors", http.StatusInternalServerError)
		return
	}

	mergedColors := currentColors
	if req.Colors != nil {
		patchColors, err := normalizeColors(req.Colors)
		if err != nil {
			http.Error(w, "invalid colors", http.StatusBadRequest)
			return
		}
		for k, v := range patchColors {
			mergedColors[k] = v
		}
	}

	colorsJSON, err := json.Marshal(mergedColors)
	if err != nil {
		http.Error(w, "failed to encode colors", http.StatusInternalServerError)
		return
	}

	titleParam := pgtype.Text{Valid: false}
	if req.Title != nil {
		titleParam = pgtype.Text{String: strings.TrimSpace(*req.Title), Valid: true}
	}

	isPublicParam := pgtype.Bool{Valid: false}
	if req.IsPublic != nil {
		isPublicParam = pgtype.Bool{Bool: *req.IsPublic, Valid: true}
	}

	updated, err := s.Queries.UpdateConfigCAS(ctx, dbgen.UpdateConfigCASParams{
		ID:       id,
		Revision: *req.BaseRevision,
		Title:    titleParam,
		IsPublic: isPublicParam,
		Colors:   colorsJSON,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) || errors.Is(err, sql.ErrNoRows) {
			fresh, err := s.Queries.GetConfigByID(ctx, id)
			if err != nil {
				if errors.Is(err, pgx.ErrNoRows) || errors.Is(err, sql.ErrNoRows) {
					http.Error(w, "not found", http.StatusNotFound)
					return
				}
				http.Error(w, "failed to load config", http.StatusInternalServerError)
				return
			}
			dto, err := configDTOFromRow(fresh)
			if err != nil {
				http.Error(w, "invalid stored colors", http.StatusInternalServerError)
				return
			}
			writeJSON(w, http.StatusConflict, map[string]any{"config": dto})
			return
		}
		http.Error(w, "failed to update config", http.StatusInternalServerError)
		return
	}

	dto, err := configDTOFromRow(updated)
	if err != nil {
		http.Error(w, "invalid stored colors", http.StatusInternalServerError)
		return
	}

	if s.WS != nil {
		rev := dto.Revision
		wsMsg := wsMessage{
			Type:     "patch_applied",
			ConfigID: id.String(),
			Config:   &dto,
			Revision: &rev,
		}
		if payload, err := json.Marshal(wsMsg); err == nil {
			s.WS.broadcastIfExists(id.String(), payload)
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{"config": dto})
}
