package ingest

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type DBResult struct {
	Models  int64
	Parts   int
	Aliases int
}

func EnsureRequiredAssets(modelDir string) error {
	required := []string{"model.gltf", "thumb.png"}
	for _, name := range required {
		p := filepath.Join(modelDir, name)
		info, err := os.Stat(p)
		if err != nil {
			return fmt.Errorf("missing required asset %s", name)
		}
		if info.IsDir() {
			return fmt.Errorf("required asset is a directory: %s", name)
		}
	}
	return nil
}

func InstallAssets(rootDir, tempDir, staticDir, modelID string) (string, error) {
	modelsDir := filepath.Join(staticDir, "models")
	if err := os.MkdirAll(modelsDir, 0o755); err != nil {
		return "", err
	}

	destDir := filepath.Join(modelsDir, modelID)
	if _, err := os.Stat(destDir); err == nil {
		backup := destDir + ".bak-" + time.Now().Format("20060102-150405")
		if err := os.Rename(destDir, backup); err != nil {
			return "", fmt.Errorf("backup existing assets: %w", err)
		}
	}

	if err := os.Rename(rootDir, destDir); err != nil {
		return "", fmt.Errorf("install assets: %w", err)
	}

	if rootDir != tempDir {
		_ = os.RemoveAll(tempDir)
	}

	return destDir, nil
}

func UpdateDB(ctx context.Context, pool *pgxpool.Pool, spec *Spec, assetBaseURL string) (DBResult, error) {
	baseURL := strings.TrimRight(assetBaseURL, "/")
	gltfURL := fmt.Sprintf("%s/%s/model.gltf", baseURL, spec.ID)
	thumbURL := fmt.Sprintf("%s/%s/thumb.png", baseURL, spec.ID)

	tx, err := pool.Begin(ctx)
	if err != nil {
		return DBResult{}, err
	}
	defer tx.Rollback(ctx)

	tag, err := tx.Exec(ctx, `
		INSERT INTO models (id, display_name, status, gltf_url, thumbnail_url, updated_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
		ON CONFLICT (id) DO UPDATE SET
		  display_name = EXCLUDED.display_name,
		  status = EXCLUDED.status,
		  gltf_url = EXCLUDED.gltf_url,
		  thumbnail_url = EXCLUDED.thumbnail_url,
		  updated_at = NOW()
	`, spec.ID, spec.DisplayName, spec.Status, gltfURL, thumbURL)
	if err != nil {
		return DBResult{}, fmt.Errorf("upsert model: %w", err)
	}

	if _, err := tx.Exec(ctx, `DELETE FROM model_aliases WHERE model_id = $1`, spec.ID); err != nil {
		return DBResult{}, fmt.Errorf("delete aliases: %w", err)
	}
	if _, err := tx.Exec(ctx, `DELETE FROM model_parts WHERE model_id = $1`, spec.ID); err != nil {
		return DBResult{}, fmt.Errorf("delete parts: %w", err)
	}

	partCount := 0
	for _, p := range spec.Parts {
		var defaultColor any
		if strings.TrimSpace(p.DefaultColor) != "" {
			defaultColor = strings.ToLower(p.DefaultColor)
		}

		var meshJSON any
		if len(p.MeshSelectors) > 0 {
			b, err := json.Marshal(p.MeshSelectors)
			if err != nil {
				return DBResult{}, fmt.Errorf("marshal mesh selectors: %w", err)
			}
			meshJSON = b
		}

		_, err := tx.Exec(ctx, `
			INSERT INTO model_parts (model_id, part_id, display_name, selectable, sort_order, default_color, mesh_selectors)
			VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
		`, spec.ID, p.ID, p.DisplayName, p.Selectable, p.SortOrder, defaultColor, meshJSON)
		if err != nil {
			return DBResult{}, fmt.Errorf("insert part %s: %w", p.ID, err)
		}
		partCount++
	}

	aliasCount := 0
	for alias, partID := range spec.Aliases {
		_, err := tx.Exec(ctx, `
			INSERT INTO model_aliases (model_id, alias, part_id)
			VALUES ($1, $2, $3)
		`, spec.ID, alias, partID)
		if err != nil {
			return DBResult{}, fmt.Errorf("insert alias %s: %w", alias, err)
		}
		aliasCount++
	}

	if err := tx.Commit(ctx); err != nil {
		return DBResult{}, err
	}

	return DBResult{
		Models:  tag.RowsAffected(),
		Parts:   partCount,
		Aliases: aliasCount,
	}, nil
}
