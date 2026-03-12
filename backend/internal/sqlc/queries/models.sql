-- name: ListModels :many
SELECT
  id,
  display_name,
  thumbnail_url,
  status,
  updated_at
FROM models
WHERE status != 'archived'
ORDER BY updated_at DESC;
