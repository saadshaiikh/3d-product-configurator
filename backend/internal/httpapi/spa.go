package httpapi

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

func MountSPA(mux *http.ServeMux, frontendDir string) {
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			http.NotFound(w, r)
			return
		}

		if frontendDir == "" {
			http.NotFound(w, r)
			return
		}

		path := filepath.Clean(r.URL.Path)
		if path == "/" {
			serveIndex(w, r, frontendDir)
			return
		}

		path = strings.TrimPrefix(path, "/")
		fullPath := filepath.Join(frontendDir, path)
		if info, err := os.Stat(fullPath); err == nil && !info.IsDir() {
			if strings.HasSuffix(fullPath, "index.html") {
				w.Header().Set("Cache-Control", "no-store")
			}
			http.ServeFile(w, r, fullPath)
			return
		}

		serveIndex(w, r, frontendDir)
	})
}

func serveIndex(w http.ResponseWriter, r *http.Request, frontendDir string) {
	w.Header().Set("Cache-Control", "no-store")
	indexPath := filepath.Join(frontendDir, "index.html")
	http.ServeFile(w, r, indexPath)
}
