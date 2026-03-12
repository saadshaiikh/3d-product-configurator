package httpapi

import (
	"context"
	"database/sql"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
)

type modelSummary struct {
	ID           string `json:"id"`
	DisplayName  string `json:"displayName"`
	ThumbnailURL string `json:"thumbnailUrl"`
	Status       string `json:"status"`
	UpdatedAt    string `json:"updatedAt"`
}

func (s *Server) HandleGetModels(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()

	rows, err := s.Queries.ListModels(ctx)
	if err != nil {
		http.Error(w, "failed to list models", http.StatusInternalServerError)
		return
	}

	out := make([]modelSummary, 0, len(rows))
	for _, m := range rows {
		out = append(out, modelSummary{
			ID:           m.ID,
			DisplayName:  m.DisplayName,
			ThumbnailURL: textOrEmpty(any(m.ThumbnailUrl)),
			Status:       m.Status,
			UpdatedAt:    timeToRFC3339Nano(any(m.UpdatedAt)),
		})
	}

	writeJSON(w, http.StatusOK, map[string]any{"models": out})
}

func textOrEmpty(v any) string {
	switch t := v.(type) {
	case string:
		return t
	case sql.NullString:
		if t.Valid {
			return t.String
		}
	case pgtype.Text:
		if t.Valid {
			return t.String
		}
	}
	return ""
}

func timeToRFC3339Nano(v any) string {
	switch t := v.(type) {
	case time.Time:
		return t.UTC().Format(time.RFC3339Nano)
	case sql.NullTime:
		if t.Valid {
			return t.Time.UTC().Format(time.RFC3339Nano)
		}
	case pgtype.Timestamptz:
		if t.Valid {
			return t.Time.UTC().Format(time.RFC3339Nano)
		}
	case pgtype.Timestamp:
		if t.Valid {
			return t.Time.UTC().Format(time.RFC3339Nano)
		}
	}
	return ""
}
