package httpapi

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

func MountStatic(mux *http.ServeMux, frontendDir, staticDir string) {
	mux.HandleFunc("/static/", func(w http.ResponseWriter, r *http.Request) {
		rel := strings.TrimPrefix(r.URL.Path, "/static/")
		if rel == "" {
			http.NotFound(w, r)
			return
		}

		// Prefer CRA build static assets if present, then fall back to model assets.
		if tryServeStatic(w, r, filepath.Join(frontendDir, "static"), rel) {
			return
		}
		if tryServeStatic(w, r, staticDir, rel) {
			return
		}

		http.NotFound(w, r)
	})
}

func tryServeStatic(w http.ResponseWriter, r *http.Request, baseDir, rel string) bool {
	if baseDir == "" {
		return false
	}

	clean := filepath.Clean("/" + rel)
	clean = strings.TrimPrefix(clean, "/")
	fullPath := filepath.Join(baseDir, clean)

	info, err := os.Stat(fullPath)
	if err != nil || info.IsDir() {
		return false
	}

	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	http.ServeFile(w, r, fullPath)
	return true
}
