-- models
INSERT INTO models (id, display_name, status, gltf_url, thumbnail_url)
VALUES
  ('shoe', 'Shoe', 'published',
   'http://localhost:8080/static/models/shoe/model.gltf',
   'http://localhost:8080/static/models/shoe/thumb.png')
ON CONFLICT (id) DO NOTHING;

-- parts
INSERT INTO model_parts (model_id, part_id, display_name, selectable, sort_order, default_color, mesh_selectors)
VALUES
  ('shoe','sole','Sole',true,1,'#ffffff','["SoleMesh"]'::jsonb),
  ('shoe','laces','Laces',true,2,'#ffffff',NULL)
ON CONFLICT (model_id, part_id) DO NOTHING;

-- aliases
INSERT INTO model_aliases (model_id, alias, part_id)
VALUES
  ('shoe','bottom','sole'),
  ('shoe','strings','laces')
ON CONFLICT (model_id, alias) DO NOTHING;
