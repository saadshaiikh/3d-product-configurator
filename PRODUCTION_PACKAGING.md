Step 11 — Production Packaging (Single-Origin Serve + Docker Compose Bring-up)

How to run
1) Build and start:
   docker compose up --build

2) Verify URLs:
   curl -i http://localhost:8080/healthz
   curl -s http://localhost:8080/models | python3 -m json.tool
   curl -I http://localhost:8080/static/models/shoe/model.gltf
   curl -I http://localhost:8080/
   curl -I http://localhost:8080/c/00000000-0000-0000-0000-000000000000

Expected results
- /healthz -> 200 ok
- /models -> JSON
- /static/models/... -> 200, correct content-type
- / -> 200 text/html
- /c/<anything> -> 200 text/html (SPA fallback)

Services
- db: Postgres 16
- migrate: migrate/migrate applies backend/migrations
- api: Go server with embedded SPA + static assets

Environment (compose defaults)
- DATABASE_URL=postgres://app:app@db:5432/appdb?sslmode=disable
- FRONTEND_DIR=/app/build
- STATIC_DIR=/app/public/static
- ASSET_BASE_URL=http://localhost:8080/static/models

Troubleshooting
- Port in use: stop any local server on 8080.
- Migration failures: check db is healthy, then re-run:
  docker compose up --build --force-recreate migrate
- Missing assets: ensure public/static/models/<id>/... exists in repo before build.
