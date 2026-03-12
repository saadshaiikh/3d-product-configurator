package httpapi

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func (s *Server) HandleGetConfigByID(w http.ResponseWriter, r *http.Request) {
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

	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()

	cfg, err := s.Queries.GetConfigByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) || errors.Is(err, sql.ErrNoRows) {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		http.Error(w, "failed to load config", http.StatusInternalServerError)
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

	writeJSON(w, http.StatusOK, resp)
}
