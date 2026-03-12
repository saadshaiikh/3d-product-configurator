-- name: UpdateConfigCAS :one
UPDATE configs
SET
  title = COALESCE(sqlc.narg('title'), title),
  is_public = COALESCE(sqlc.narg('is_public'), is_public),
  colors = COALESCE(sqlc.narg('colors'), colors),
  revision = revision + 1,
  updated_at = NOW()
WHERE id = $1 AND revision = $2
RETURNING id, model_id, title, colors, revision, is_public, created_at, updated_at;
