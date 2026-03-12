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
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"yourrepo/backend/internal/sqlc/dbgen"
)

func (s *Server) HandlePostConfigs(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)

	var req postConfigsRequest
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

	modelID := strings.TrimSpace(req.ModelID)
	if modelID == "" || !modelIDRe.MatchString(modelID) {
		http.Error(w, "invalid modelId", http.StatusBadRequest)
		return
	}

	colors, err := normalizeColors(req.Colors)
	if err != nil {
		http.Error(w, "invalid colors", http.StatusBadRequest)
		return
	}

	title := strings.TrimSpace(req.Title)
	if title != "" && utf8.RuneCountInString(title) > 120 {
		http.Error(w, "title too long", http.StatusBadRequest)
		return
	}

	isPublic := true
	if req.IsPublic != nil {
		isPublic = *req.IsPublic
	}

	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()

	if _, err := s.Queries.GetPublishedModelExists(ctx, modelID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) || errors.Is(err, sql.ErrNoRows) {
			http.Error(w, "unknown modelId", http.StatusBadRequest)
			return
		}
		http.Error(w, "failed to validate model", http.StatusInternalServerError)
		return
	}

	colorsJSON, err := json.Marshal(colors)
	if err != nil {
		http.Error(w, "failed to encode colors", http.StatusInternalServerError)
		return
	}

	cfg, err := s.Queries.CreateConfig(ctx, dbgen.CreateConfigParams{
		ModelID:  modelID,
		Title:    pgtype.Text{String: title, Valid: title != ""},
		Column3:  colorsJSON,
		IsPublic: isPublic,
	})
	if err != nil {
		http.Error(w, "failed to create config", http.StatusInternalServerError)
		return
	}

	dto, err := configDTOFromRow(cfg)
	if err != nil {
		http.Error(w, "invalid stored colors", http.StatusInternalServerError)
		return
	}

	resp := map[string]any{
		"config": dto,
	}

	writeJSON(w, http.StatusCreated, resp)
}
