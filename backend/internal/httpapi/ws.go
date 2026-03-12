package httpapi

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"yourrepo/backend/internal/sqlc/dbgen"
)

const (
	wsWriteWait  = 10 * time.Second
	wsPongWait   = 60 * time.Second
	wsPingPeriod = 50 * time.Second
)

type wsMessage struct {
	Type         string            `json:"type"`
	ConfigID     string            `json:"configId,omitempty"`
	BaseRevision *int64            `json:"baseRevision,omitempty"`
	OpID         string            `json:"opId,omitempty"`
	Colors       map[string]string `json:"colors,omitempty"`
	Message      string            `json:"message,omitempty"`
	Config       *configDTO        `json:"config,omitempty"`
	Revision     *int64            `json:"revision,omitempty"`
}

func (s *Server) HandleWS(w http.ResponseWriter, r *http.Request) {
	if s.WS == nil {
		http.Error(w, "ws disabled", http.StatusNotImplemented)
		return
	}

	configID := strings.TrimSpace(r.URL.Query().Get("configId"))
	if configID == "" {
		http.Error(w, "missing configId", http.StatusBadRequest)
		return
	}

	var id pgtype.UUID
	if err := id.Scan(configID); err != nil {
		http.Error(w, "invalid configId", http.StatusBadRequest)
		return
	}

	upgrader := websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			origin := r.Header.Get("Origin")
			return s.OriginChecker.Allowed(origin, r)
		},
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	conn.SetReadDeadline(time.Now().Add(wsPongWait))
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(wsPongWait))
		return nil
	})

	hub := s.WS.getHub(configID)
	client := &wsClient{hub: hub, conn: conn, send: make(chan []byte, 8)}
	hub.register <- client
	go client.writePump()

	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()

	current, err := s.Queries.GetConfigByID(ctx, id)
	if err != nil {
		s.sendWS(client, wsMessage{Type: "error", Message: "failed to load config"})
		return
	}

	dto, err := configDTOFromRow(current)
	if err != nil {
		s.sendWS(client, wsMessage{Type: "error", Message: "invalid config"})
		return
	}

	s.sendWS(client, wsMessage{Type: "hello"})
	s.sendWS(client, wsMessage{Type: "sync", Config: &dto})

	for {
		_, payload, err := conn.ReadMessage()
		if err != nil {
			break
		}

		var msg wsMessage
		if err := json.Unmarshal(payload, &msg); err != nil {
			s.sendWS(client, wsMessage{Type: "error", Message: "invalid message"})
			continue
		}

		if msg.Type != "patch" {
			continue
		}

		if msg.BaseRevision == nil || *msg.BaseRevision < 0 {
			s.sendWS(client, wsMessage{Type: "error", Message: "invalid baseRevision"})
			continue
		}

		patchColors, err := normalizeColors(msg.Colors)
		if err != nil {
			s.sendWS(client, wsMessage{Type: "error", Message: "invalid colors"})
			continue
		}

		applyCtx, cancelApply := context.WithTimeout(r.Context(), 2*time.Second)
		updated, conflictCfg, err := s.applyConfigPatch(applyCtx, id, *msg.BaseRevision, nil, patchColors, nil)
		cancelApply()
		if err != nil {
			s.sendWS(client, wsMessage{Type: "error", Message: "failed to apply patch"})
			continue
		}
		if conflictCfg != nil {
			s.sendWS(client, wsMessage{Type: "conflict", Config: conflictCfg})
			continue
		}

		rev := updated.Revision
		out := wsMessage{
			Type:     "patch_applied",
			ConfigID: configID,
			Revision: &rev,
			Colors:   patchColors,
			OpID:     msg.OpID,
		}
		if dto, err := configDTOFromRow(updated); err == nil {
			out.Config = &dto
		}
		outPayload, _ := json.Marshal(out)
		hub.broadcast <- outPayload
	}

	hub.unregister <- client
}

func (s *Server) sendWS(c *wsClient, msg wsMessage) {
	payload, err := json.Marshal(msg)
	if err != nil {
		return
	}
	select {
	case c.send <- payload:
	default:
	}
}

func (s *Server) applyConfigPatch(
	ctx context.Context,
	id pgtype.UUID,
	baseRevision int64,
	title *string,
	patchColors map[string]string,
	isPublic *bool,
) (dbgen.Config, *configDTO, error) {
	current, err := s.Queries.GetConfigByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) || errors.Is(err, sql.ErrNoRows) {
			return dbgen.Config{}, nil, err
		}
		return dbgen.Config{}, nil, err
	}

	if current.Revision != baseRevision {
		dto, err := configDTOFromRow(current)
		if err != nil {
			return dbgen.Config{}, nil, err
		}
		return dbgen.Config{}, &dto, nil
	}

	currentColors, err := colorsFromJSONB(current.Colors)
	if err != nil {
		return dbgen.Config{}, nil, err
	}

	mergedColors := currentColors
	if patchColors != nil {
		for k, v := range patchColors {
			mergedColors[k] = v
		}
	}

	colorsJSON, err := json.Marshal(mergedColors)
	if err != nil {
		return dbgen.Config{}, nil, err
	}

	titleParam := pgtype.Text{Valid: false}
	if title != nil {
		titleParam = pgtype.Text{String: strings.TrimSpace(*title), Valid: true}
	}

	isPublicParam := pgtype.Bool{Valid: false}
	if isPublic != nil {
		isPublicParam = pgtype.Bool{Bool: *isPublic, Valid: true}
	}

	updated, err := s.Queries.UpdateConfigCAS(ctx, dbgen.UpdateConfigCASParams{
		ID:       id,
		Revision: baseRevision,
		Title:    titleParam,
		IsPublic: isPublicParam,
		Colors:   colorsJSON,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) || errors.Is(err, sql.ErrNoRows) {
			fresh, err := s.Queries.GetConfigByID(ctx, id)
			if err != nil {
				return dbgen.Config{}, nil, err
			}
			dto, err := configDTOFromRow(fresh)
			if err != nil {
				return dbgen.Config{}, nil, err
			}
			return dbgen.Config{}, &dto, nil
		}
		return dbgen.Config{}, nil, err
	}

	return updated, nil, nil
}
