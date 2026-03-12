package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Addr           string
	DatabaseURL    string
	FrontendDir    string
	StaticDir      string
	PublicBaseURL  string
	SerpAPIKey     string
	OpenAIKey      string
	CORSOrigins    []string
	PprofEnabled   bool
	PprofToken     string
	DBMaxConns     int32
	DBMinConns     int32
	DBConnTimeout  time.Duration
	WriteRPS       float64
	WriteBurst     int
	WSConnectRPS   float64
	WSConnectBurst int
}

func Load() Config {
	addr := getenv("ADDR", ":8080")
	dsn := getenv("DATABASE_URL", "")
	frontendDir := getenv("FRONTEND_DIR", "../build")
	staticDir := getenv("STATIC_DIR", "../public/static")
	publicBaseURL := getenv("PUBLIC_BASE_URL", "http://localhost:8080")
	serpKey := getenv("SERPAPI_KEY", "")
	openAIKey := getenv("OPENAI_API_KEY", "")
	corsOrigins := splitCSV(getenv("CORS_ORIGINS", ""))
	if len(corsOrigins) == 0 {
		corsOrigins = []string{
			"http://localhost:3000",
			"http://localhost:3001",
		}
	}
	pprofEnabled := getenv("PPROF", "") == "1"
	pprofToken := getenv("PPROF_TOKEN", "")
	dbMax := int32(getenvInt("DB_MAX_CONNS", 10))
	dbMin := int32(getenvInt("DB_MIN_CONNS", 1))
	dbTimeout := getenvDuration("DB_CONN_TIMEOUT", 5*time.Second)
	writeRPS := getenvFloat("RATE_LIMIT_RPS", 5)
	writeBurst := getenvInt("RATE_LIMIT_BURST", 10)
	wsRPS := getenvFloat("WS_RATE_LIMIT_RPS", 2)
	wsBurst := getenvInt("WS_RATE_LIMIT_BURST", 4)
	return Config{
		Addr:           addr,
		DatabaseURL:    dsn,
		FrontendDir:    frontendDir,
		StaticDir:      staticDir,
		PublicBaseURL:  publicBaseURL,
		SerpAPIKey:     serpKey,
		OpenAIKey:      openAIKey,
		CORSOrigins:    corsOrigins,
		PprofEnabled:   pprofEnabled,
		PprofToken:     pprofToken,
		DBMaxConns:     dbMax,
		DBMinConns:     dbMin,
		DBConnTimeout:  dbTimeout,
		WriteRPS:       writeRPS,
		WriteBurst:     writeBurst,
		WSConnectRPS:   wsRPS,
		WSConnectBurst: wsBurst,
	}
}

func getenv(k, def string) string {
	v := os.Getenv(k)
	if v == "" {
		return def
	}
	return v
}

func getenvInt(k string, def int) int {
	v := strings.TrimSpace(os.Getenv(k))
	if v == "" {
		return def
	}
	if n, err := strconv.Atoi(v); err == nil {
		return n
	}
	return def
}

func getenvFloat(k string, def float64) float64 {
	v := strings.TrimSpace(os.Getenv(k))
	if v == "" {
		return def
	}
	if n, err := strconv.ParseFloat(v, 64); err == nil {
		return n
	}
	return def
}

func getenvDuration(k string, def time.Duration) time.Duration {
	v := strings.TrimSpace(os.Getenv(k))
	if v == "" {
		return def
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		return def
	}
	return d
}

func splitCSV(v string) []string {
	v = strings.TrimSpace(v)
	if v == "" {
		return nil
	}
	parts := strings.Split(v, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}
