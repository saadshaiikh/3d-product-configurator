-- NOTE: sqlc does not require extensions; keep CREATE EXTENSION in migrations only.

CREATE TABLE models (
  id            text PRIMARY KEY,
  display_name  text NOT NULL,
  status        text NOT NULL DEFAULT 'draft',
  gltf_url      text NOT NULL,
  base_url      text,
  thumbnail_url text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE model_parts (
  model_id       text NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  part_id        text NOT NULL,
  display_name   text NOT NULL,
  selectable     boolean NOT NULL DEFAULT true,
  sort_order     int NOT NULL DEFAULT 0,
  default_color  text,
  mesh_selectors jsonb,
  PRIMARY KEY (model_id, part_id)
);

CREATE TABLE model_aliases (
  model_id text NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  alias    text NOT NULL,
  part_id  text NOT NULL,
  PRIMARY KEY (model_id, alias),
  FOREIGN KEY (model_id, part_id) REFERENCES model_parts(model_id, part_id) ON DELETE CASCADE
);

CREATE TABLE configs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id   text NOT NULL REFERENCES models(id),
  title      text,
  colors     jsonb NOT NULL,
  revision   bigint NOT NULL DEFAULT 0,
  is_public  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX configs_model_id_idx ON configs(model_id);
CREATE INDEX configs_is_public_idx ON configs(is_public);
CREATE INDEX configs_colors_gin_idx ON configs USING gin (colors jsonb_path_ops);
