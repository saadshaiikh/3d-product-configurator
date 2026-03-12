package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"yourrepo/backend/internal/db"
	"yourrepo/backend/internal/ingest"
)

func main() {
	specPath := flag.String("spec", "", "path to model spec json")
	zipPath := flag.String("zip", "", "path to model zip")
	flag.Parse()

	if strings.TrimSpace(*specPath) == "" || strings.TrimSpace(*zipPath) == "" {
		fmt.Fprintln(os.Stderr, "usage: ingestmodel --spec <path> --zip <path>")
		os.Exit(1)
	}

	dsn := os.Getenv("DATABASE_URL")
	if strings.TrimSpace(dsn) == "" {
		fmt.Fprintln(os.Stderr, "DATABASE_URL is required")
		os.Exit(1)
	}

	staticDir := os.Getenv("STATIC_DIR")
	if strings.TrimSpace(staticDir) == "" {
		staticDir = "../public/static"
	}

	assetBaseURL := os.Getenv("ASSET_BASE_URL")
	if strings.TrimSpace(assetBaseURL) == "" {
		assetBaseURL = "http://localhost:8080/static/models"
	}

	spec, err := ingest.LoadSpec(*specPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "spec error: %v\n", err)
		os.Exit(1)
	}
	fmt.Println("parsed spec ok")

	modelsDir := filepath.Join(staticDir, "models")
	tmpDir := filepath.Join(modelsDir, fmt.Sprintf(".tmp-%s-%d", spec.ID, time.Now().UnixNano()))
	extractRes, err := ingest.ExtractZip(*zipPath, tmpDir)
	if err != nil {
		_ = os.RemoveAll(tmpDir)
		fmt.Fprintf(os.Stderr, "zip extract error: %v\n", err)
		os.Exit(1)
	}
	fmt.Println("zip extracted ok")

	cleanupTemp := true
	defer func() {
		if cleanupTemp {
			_ = os.RemoveAll(extractRes.Temp)
		}
	}()

	if err := ingest.EnsureRequiredAssets(extractRes.Root); err != nil {
		fmt.Fprintf(os.Stderr, "asset check error: %v\n", err)
		os.Exit(1)
	}

	refs, err := ingest.ValidateGLTFRefs(extractRes.Root)
	if err != nil {
		fmt.Fprintf(os.Stderr, "gltf reference error: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("gltf references ok (%d buffers, %d images)\n", len(refs.Buffers), len(refs.Images))

	installedPath, err := ingest.InstallAssets(extractRes.Root, extractRes.Temp, staticDir, spec.ID)
	if err != nil {
		fmt.Fprintf(os.Stderr, "install error: %v\n", err)
		os.Exit(1)
	}
	cleanupTemp = false
	fmt.Printf("assets installed to %s\n", installedPath)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := db.Open(ctx, db.Config{DatabaseURL: dsn})
	if err != nil {
		fmt.Fprintf(os.Stderr, "db connect failed: %v\n", err)
		os.Exit(1)
	}
	defer pool.Close()

	res, err := ingest.UpdateDB(ctx, pool, spec, assetBaseURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "db update error: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("db updated: model=%d parts=%d aliases=%d\n", res.Models, res.Parts, res.Aliases)
}
