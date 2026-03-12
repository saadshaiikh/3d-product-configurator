-- name: GetModelByID :one
SELECT
  id,
  display_name,
  status,
  gltf_url,
  base_url,
  thumbnail_url,
  updated_at
FROM models
WHERE id = $1
LIMIT 1;

-- name: ListModelParts :many
SELECT
  part_id,
  display_name,
  selectable,
  sort_order,
  default_color,
  mesh_selectors
FROM model_parts
WHERE model_id = $1
ORDER BY sort_order ASC, part_id ASC;

-- name: ListModelAliases :many
SELECT
  alias,
  part_id
FROM model_aliases
WHERE model_id = $1
ORDER BY alias ASC;
