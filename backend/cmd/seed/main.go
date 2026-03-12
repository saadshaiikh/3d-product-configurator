package main

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"strings"
	"time"

	"yourrepo/backend/internal/db"
	"yourrepo/backend/internal/seed"
)

func main() {
	dsn := os.Getenv("DATABASE_URL")
	if strings.TrimSpace(dsn) == "" {
		fmt.Fprintln(os.Stderr, "DATABASE_URL is required")
		os.Exit(1)
	}

	baseURL := os.Getenv("ASSET_BASE_URL")
	if strings.TrimSpace(baseURL) == "" {
		baseURL = "http://localhost:8080/static/models"
	}

	fmt.Printf("seed: database=%s\n", redactURL(dsn))
	fmt.Printf("seed: asset base url=%s\n", baseURL)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := db.Open(ctx, db.Config{DatabaseURL: dsn})
	if err != nil {
		fmt.Fprintf(os.Stderr, "db connect failed: %v\n", err)
		os.Exit(1)
	}
	defer pool.Close()

	res, err := seed.Seed(ctx, pool, baseURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "seed failed: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("seed complete: models=%d parts=%d aliases=%d\n", res.Models, res.Parts, res.Aliases)
}

func redactURL(dsn string) string {
	u, err := url.Parse(dsn)
	if err != nil || u.User == nil {
		return dsn
	}
	u.User = url.User(u.User.Username())
	return u.String()
}
