package httpapi

import (
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type WSHubManager struct {
	mu   sync.Mutex
	hubs map[string]*wsHub
}

func NewWSHubManager() *WSHubManager {
	return &WSHubManager{hubs: make(map[string]*wsHub)}
}

func (m *WSHubManager) getHub(configID string) *wsHub {
	m.mu.Lock()
	defer m.mu.Unlock()

	if hub, ok := m.hubs[configID]; ok {
		return hub
	}

	hub := newWSHub(configID, m)
	m.hubs[configID] = hub
	go hub.run()
	return hub
}

func (m *WSHubManager) removeHub(configID string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.hubs, configID)
}

func (m *WSHubManager) broadcastIfExists(configID string, payload []byte) {
	m.mu.Lock()
	hub := m.hubs[configID]
	m.mu.Unlock()
	if hub == nil {
		return
	}
	hub.broadcast <- payload
}

type wsHub struct {
	configID   string
	manager    *WSHubManager
	register   chan *wsClient
	unregister chan *wsClient
	broadcast  chan []byte
	clients    map[*wsClient]struct{}
}

func newWSHub(configID string, manager *WSHubManager) *wsHub {
	return &wsHub{
		configID:   configID,
		manager:    manager,
		register:   make(chan *wsClient),
		unregister: make(chan *wsClient),
		broadcast:  make(chan []byte, 16),
		clients:    make(map[*wsClient]struct{}),
	}
}

func (h *wsHub) run() {
	for {
		select {
		case c := <-h.register:
			h.clients[c] = struct{}{}
		case c := <-h.unregister:
			if _, ok := h.clients[c]; ok {
				delete(h.clients, c)
				close(c.send)
			}
			if len(h.clients) == 0 {
				h.manager.removeHub(h.configID)
				return
			}
		case msg := <-h.broadcast:
			for c := range h.clients {
				select {
				case c.send <- msg:
				default:
					delete(h.clients, c)
					close(c.send)
				}
			}
		}
	}
}

type wsClient struct {
	hub  *wsHub
	conn wsConn
	send chan []byte
}

// wsConn abstracts *websocket.Conn for testing/mocking (minimal surface).
type wsConn interface {
	ReadMessage() (messageType int, p []byte, err error)
	WriteMessage(messageType int, data []byte) error
	SetReadDeadline(t time.Time) error
	SetWriteDeadline(t time.Time) error
	SetPongHandler(h func(string) error)
	Close() error
}

func (c *wsClient) writePump() {
	ticker := time.NewTicker(wsPingPeriod)
	defer func() {
		ticker.Stop()
		_ = c.conn.Close()
	}()

	for {
		select {
		case msg, ok := <-c.send:
			_ = c.conn.SetWriteDeadline(time.Now().Add(wsWriteWait))
			if !ok {
				_ = c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		case <-ticker.C:
			_ = c.conn.SetWriteDeadline(time.Now().Add(wsWriteWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
