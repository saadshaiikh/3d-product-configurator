package seed

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	modelIDRe = regexp.MustCompile(`^[a-z0-9_-]+$`)
	colorRe   = regexp.MustCompile(`^#[0-9A-Fa-f]{6}$`)
)

type Result struct {
	Models  int64
	Parts   int64
	Aliases int64
}

func Seed(ctx context.Context, pool *pgxpool.Pool, baseURL string) (Result, error) {
	specs := Specs()
	if err := validateSpecs(specs); err != nil {
		return Result{}, err
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return Result{}, err
	}
	defer tx.Rollback(ctx)

	var res Result
	baseURL = strings.TrimRight(baseURL, "/")

	for _, m := range specs {
		gltfURL := fmt.Sprintf("%s/%s/model.gltf", baseURL, m.ID)
		thumbURL := fmt.Sprintf("%s/%s/thumb.png", baseURL, m.ID)

		tag, err := tx.Exec(ctx, `
			INSERT INTO models (id, display_name, status, gltf_url, thumbnail_url)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (id) DO UPDATE SET
			  display_name = EXCLUDED.display_name,
			  status = EXCLUDED.status,
			  gltf_url = EXCLUDED.gltf_url,
			  thumbnail_url = EXCLUDED.thumbnail_url
		`, m.ID, m.DisplayName, m.Status, gltfURL, thumbURL)
		if err != nil {
			return Result{}, fmt.Errorf("insert model %s: %w", m.ID, err)
		}
		res.Models += tag.RowsAffected()

		partIDs := make(map[string]struct{}, len(m.Parts))
		for _, p := range m.Parts {
			partIDs[p.PartID] = struct{}{}

			defaultColor := strings.TrimSpace(p.DefaultColor)
			if defaultColor != "" {
				defaultColor = strings.ToLower(defaultColor)
			}

			var meshJSON []byte
			if len(p.MeshSelectors) > 0 {
				meshJSON, err = json.Marshal(p.MeshSelectors)
				if err != nil {
					return Result{}, fmt.Errorf("marshal mesh selectors %s/%s: %w", m.ID, p.PartID, err)
				}
			}

			var defaultColorParam any
			if defaultColor != "" {
				defaultColorParam = defaultColor
			}

			tag, err := tx.Exec(ctx, `
				INSERT INTO model_parts (model_id, part_id, display_name, selectable, sort_order, default_color, mesh_selectors)
				VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
				ON CONFLICT (model_id, part_id) DO UPDATE SET
				  display_name = EXCLUDED.display_name,
				  selectable = EXCLUDED.selectable,
				  sort_order = EXCLUDED.sort_order,
				  default_color = EXCLUDED.default_color,
				  mesh_selectors = EXCLUDED.mesh_selectors
			`, m.ID, p.PartID, p.DisplayName, p.Selectable, p.SortOrder, defaultColorParam, meshJSON)
			if err != nil {
				return Result{}, fmt.Errorf("insert part %s/%s: %w", m.ID, p.PartID, err)
			}
			res.Parts += tag.RowsAffected()
		}

		for alias, partID := range m.Aliases {
			if _, ok := partIDs[partID]; !ok {
				return Result{}, fmt.Errorf("alias %s on %s references unknown part %s", alias, m.ID, partID)
			}

			tag, err := tx.Exec(ctx, `
				INSERT INTO model_aliases (model_id, alias, part_id)
				VALUES ($1, $2, $3)
				ON CONFLICT (model_id, alias) DO UPDATE SET
				  part_id = EXCLUDED.part_id
			`, m.ID, alias, partID)
			if err != nil {
				return Result{}, fmt.Errorf("insert alias %s/%s: %w", m.ID, alias, err)
			}
			res.Aliases += tag.RowsAffected()
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return Result{}, err
	}

	return res, nil
}

func validateSpecs(specs []ModelSpec) error {
	for _, m := range specs {
		if m.ID == "" || !modelIDRe.MatchString(m.ID) {
			return fmt.Errorf("invalid model id: %q", m.ID)
		}
		if strings.TrimSpace(m.DisplayName) == "" {
			return fmt.Errorf("missing display name for model %s", m.ID)
		}
		if strings.TrimSpace(m.Status) == "" {
			return fmt.Errorf("missing status for model %s", m.ID)
		}
		partIDs := make(map[string]struct{}, len(m.Parts))
		for _, p := range m.Parts {
			if strings.TrimSpace(p.PartID) == "" {
				return fmt.Errorf("missing part id for model %s", m.ID)
			}
			if _, ok := partIDs[p.PartID]; ok {
				return fmt.Errorf("duplicate part id %s for model %s", p.PartID, m.ID)
			}
			partIDs[p.PartID] = struct{}{}
			if strings.TrimSpace(p.DisplayName) == "" {
				return fmt.Errorf("missing part display name for %s/%s", m.ID, p.PartID)
			}
			if p.DefaultColor != "" && !colorRe.MatchString(p.DefaultColor) {
				return fmt.Errorf("invalid default color %s for %s/%s", p.DefaultColor, m.ID, p.PartID)
			}
		}
		for alias, partID := range m.Aliases {
			if strings.TrimSpace(alias) == "" {
				return fmt.Errorf("empty alias for model %s", m.ID)
			}
			if _, ok := partIDs[partID]; !ok {
				return fmt.Errorf("alias %s on %s references unknown part %s", alias, m.ID, partID)
			}
		}
	}
	return nil
}
