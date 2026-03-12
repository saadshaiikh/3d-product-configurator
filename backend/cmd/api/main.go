package main

import (
	"context"
	"log/slog"
	"mime"
	"net"
	"net/http"
	"net/http/pprof"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"yourrepo/backend/internal/config"
	"yourrepo/backend/internal/db"
	"yourrepo/backend/internal/httpapi"
	"yourrepo/backend/internal/sqlc/dbgen"
)

func main() {
	cfg := config.Load()

	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if cfg.DatabaseURL == "" {
		slog.Error("DATABASE_URL missing")
		os.Exit(1)
	}

	_ = mime.AddExtensionType(".gltf", "model/gltf+json")
	_ = mime.AddExtensionType(".glb", "model/gltf-binary")

	pool, err := db.Open(ctx, db.Config{
		DatabaseURL: cfg.DatabaseURL,
		MaxConns:    cfg.DBMaxConns,
		MinConns:    cfg.DBMinConns,
		ConnTimeout: cfg.DBConnTimeout,
	})
	if err != nil {
		slog.Error("db connect failed", "err", err)
		os.Exit(1)
	}
	defer pool.Close()

	q := dbgen.New(pool)
	api := &httpapi.Server{
		DB:            pool,
		Queries:       q,
		WS:            httpapi.NewWSHubManager(),
		OriginChecker: httpapi.NewOriginChecker(cfg.CORSOrigins),
		StaticDir:     cfg.StaticDir,
		PublicBaseURL: cfg.PublicBaseURL,
		SerpAPIKey:    cfg.SerpAPIKey,
		OpenAIKey:     cfg.OpenAIKey,
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	mux.HandleFunc("GET /models", api.HandleGetModels)
	mux.HandleFunc("GET /models/{id}", api.HandleGetModelByID)
	mux.HandleFunc("POST /configs", api.HandlePostConfigs)
	mux.HandleFunc("GET /configs/{id}", api.HandleGetConfigByID)
	mux.HandleFunc("PATCH /configs/{id}", api.HandlePatchConfig)
	mux.HandleFunc("GET /ws", api.HandleWS)
	mux.HandleFunc("POST /agent/lens", api.HandleLens)
	mux.HandleFunc("GET /tmp/visual/{token}", api.HandleTempVisual)
	mux.HandleFunc("HEAD /tmp/visual/{token}", api.HandleTempVisual)

	httpapi.MountStatic(mux, cfg.FrontendDir, cfg.StaticDir)
	httpapi.MountSPA(mux, cfg.FrontendDir)

	if cfg.PprofEnabled {
		guard := func(next http.HandlerFunc) http.HandlerFunc {
			return func(w http.ResponseWriter, r *http.Request) {
				if !allowPprof(r, cfg.PprofToken) {
					http.Error(w, "forbidden", http.StatusForbidden)
					return
				}
				next(w, r)
			}
		}

		pprofHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !allowPprof(r, cfg.PprofToken) {
				http.Error(w, "forbidden", http.StatusForbidden)
				return
			}
			pprof.Index(w, r)
		})
		mux.Handle("/debug/pprof/", pprofHandler)
		mux.HandleFunc("/debug/pprof/cmdline", guard(pprof.Cmdline))
		mux.HandleFunc("/debug/pprof/profile", guard(pprof.Profile))
		mux.HandleFunc("/debug/pprof/symbol", guard(pprof.Symbol))
		mux.HandleFunc("/debug/pprof/trace", guard(pprof.Trace))
	}

	writeLimiter := httpapi.NewRateLimiter(cfg.WriteRPS, cfg.WriteBurst)
	wsLimiter := httpapi.NewRateLimiter(cfg.WSConnectRPS, cfg.WSConnectBurst)
	rateLimit := httpapi.RateLimitMiddleware(writeLimiter, func(r *http.Request) bool {
		if r.Method == http.MethodPost && r.URL.Path == "/configs" {
			return true
		}
		if r.Method == http.MethodPost && r.URL.Path == "/agent/visual-search" {
			return true
		}
		if r.Method == http.MethodPatch && strings.HasPrefix(r.URL.Path, "/configs/") {
			return true
		}
		return false
	})
	wsRateLimit := httpapi.RateLimitMiddleware(wsLimiter, func(r *http.Request) bool {
		return r.Method == http.MethodGet && r.URL.Path == "/ws"
	})

	handler := httpapi.Chain(
		mux,
		httpapi.RequestIDMiddleware(),
		httpapi.RequestLogger(),
		httpapi.CORSMiddleware(cfg.CORSOrigins),
		wsRateLimit,
		rateLimit,
	)

	srv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    1 << 20,
	}

	go func() {
		slog.Info("api listening", "addr", cfg.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "err", err)
			stop()
		}
	}()

	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdownCtx)
	slog.Info("shutdown complete")
}

func allowPprof(r *http.Request, token string) bool {
	if token != "" && r.Header.Get("X-Admin-Token") == token {
		return true
	}
	ip := clientIPForPprof(r)
	if ip == "" {
		return false
	}
	return net.ParseIP(ip).IsLoopback()
}

func clientIPForPprof(r *http.Request) string {
	if r == nil {
		return ""
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil {
		return host
	}
	return r.RemoteAddr
}
