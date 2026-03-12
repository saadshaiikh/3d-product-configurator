package httpapi

import (
	"net/http"
	"strings"
	"sync"
	"time"
)

type RateLimiter struct {
	mu       sync.Mutex
	rps      float64
	burst    float64
	visitors map[string]*visitor
	ttl      time.Duration
}

type visitor struct {
	tokens   float64
	lastSeen time.Time
}

func NewRateLimiter(rps float64, burst int) *RateLimiter {
	return &RateLimiter{
		rps:      rps,
		burst:    float64(burst),
		visitors: make(map[string]*visitor),
		ttl:      10 * time.Minute,
	}
}

func (l *RateLimiter) Allow(key string) bool {
	if l == nil {
		return true
	}
	if l.rps <= 0 || l.burst <= 0 {
		return true
	}
	if strings.TrimSpace(key) == "" {
		return true
	}
	l.mu.Lock()
	defer l.mu.Unlock()

	v, ok := l.visitors[key]
	if !ok {
		v = &visitor{tokens: l.burst, lastSeen: time.Now()}
		l.visitors[key] = v
	}
	now := time.Now()
	elapsed := now.Sub(v.lastSeen).Seconds()
	v.tokens += elapsed * l.rps
	if v.tokens > l.burst {
		v.tokens = l.burst
	}
	v.lastSeen = now

	for k, vis := range l.visitors {
		if time.Since(vis.lastSeen) > l.ttl {
			delete(l.visitors, k)
		}
	}

	if v.tokens < 1 {
		return false
	}
	v.tokens -= 1
	return true
}

func RateLimitMiddleware(limiter *RateLimiter, match func(*http.Request) bool) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if match != nil && !match(r) {
				next.ServeHTTP(w, r)
				return
			}
			if limiter != nil && !limiter.Allow(clientIP(r)) {
				http.Error(w, "rate limit exceeded", http.StatusTooManyRequests)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
