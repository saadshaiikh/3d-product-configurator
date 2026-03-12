Release Checklist

Required env vars
- DATABASE_URL (required)
- ADDR (default :8080)
- FRONTEND_DIR (default ../build)
- STATIC_DIR (default ../public/static)
- ASSET_BASE_URL (for seed/ingest, default http://localhost:8080/static/models)
- CORS_ORIGINS (comma-separated allowlist, optional)
- PPROF=1 to enable /debug/pprof (optional)
- PPROF_TOKEN (optional; required if not loopback)
- DB_MAX_CONNS, DB_MIN_CONNS, DB_CONN_TIMEOUT (optional)
- RATE_LIMIT_RPS, RATE_LIMIT_BURST (optional)
- WS_RATE_LIMIT_RPS, WS_RATE_LIMIT_BURST (optional)

Bring-up (single-origin)
1) Build frontend:
   npm run build

2) Run API:
   cd backend
   export DATABASE_URL="postgres://app:app@localhost:5432/appdb?sslmode=disable"
   export ADDR=":8080"
   export FRONTEND_DIR="../build"
   export STATIC_DIR="../public/static"
   go run ./cmd/api

Docker compose (prod-like)
1) docker compose up --build
2) Verify:
   curl -i http://localhost:8080/healthz
   curl -I http://localhost:8080/
   curl -I http://localhost:8080/c/00000000-0000-0000-0000-000000000000
   curl -I http://localhost:8080/static/models/shoe/model.gltf

Migrations
- Using compose: migrate service runs automatically.
- Manual:
  migrate -path backend/migrations -database "$DATABASE_URL" up

Seed
cd backend
export DATABASE_URL="postgres://app:app@localhost:5432/appdb?sslmode=disable"
export ASSET_BASE_URL="http://localhost:8080/static/models"
go run ./cmd/seed

Ingest model
cd backend
export DATABASE_URL="postgres://app:app@localhost:5432/appdb?sslmode=disable"
export STATIC_DIR="../public/static"
export ASSET_BASE_URL="http://localhost:8080/static/models"
go run ./cmd/ingestmodel --spec ../ingest/shoe.json --zip ../ingest/shoe.zip

Validate assets
cd backend
go run ./cmd/validateassets --base http://localhost:8080/static/models --models shoe

Troubleshooting
- Port in use: stop local servers on 8080.
- DB connection failed: verify DATABASE_URL and db container.
- Missing static assets: ensure public/static/models/<id>/ exists.
- WS not connecting in dev: set CORS_ORIGINS=http://localhost:3000 and use same-origin WS in production.
