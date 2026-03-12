package httpapi

import (
	"net/http"
	"strings"
)

type OriginChecker struct {
	allowed map[string]struct{}
}

func NewOriginChecker(origins []string) OriginChecker {
	out := make(map[string]struct{}, len(origins))
	for _, o := range origins {
		o = strings.TrimSpace(o)
		if o != "" {
			out[o] = struct{}{}
		}
	}
	return OriginChecker{allowed: out}
}

func (o OriginChecker) Allowed(origin string, r *http.Request) bool {
	if origin == "" {
		return true
	}
	if r != nil && originMatchesHost(origin, r.Host) {
		return true
	}
	if _, ok := o.allowed[origin]; ok {
		return true
	}
	return false
}

func originMatchesHost(origin, host string) bool {
	origin = strings.TrimSpace(origin)
	if origin == "" || host == "" {
		return false
	}
	origin = strings.TrimPrefix(origin, "http://")
	origin = strings.TrimPrefix(origin, "https://")
	if strings.Contains(origin, "/") {
		origin = strings.SplitN(origin, "/", 2)[0]
	}
	return strings.EqualFold(origin, host)
}

func CORSMiddleware(origins []string) Middleware {
	checker := NewOriginChecker(origins)
	if len(checker.allowed) == 0 {
		return func(next http.Handler) http.Handler { return next }
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if origin != "" && !checker.Allowed(origin, r) {
				http.Error(w, "origin not allowed", http.StatusForbidden)
				return
			}
			if origin != "" && checker.Allowed(origin, r) {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Vary", "Origin")
				w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-Id")
				w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS")
			}
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
