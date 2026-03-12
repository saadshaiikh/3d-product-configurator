-- name: CreateConfig :one
INSERT INTO configs (model_id, title, colors, is_public)
VALUES ($1, $2, $3::jsonb, $4)
RETURNING id, model_id, title, colors, revision, is_public, created_at, updated_at;

-- name: GetConfigByID :one
SELECT id, model_id, title, colors, revision, is_public, created_at, updated_at
FROM configs
WHERE id = $1
LIMIT 1;

-- name: GetPublishedModelExists :one
SELECT 1
FROM models
WHERE id = $1 AND status = 'published'
LIMIT 1;
