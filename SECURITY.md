Security Notes

CORS
- By default, CORS is disabled (same-origin only).
- To allow browser access from other origins, set:
  CORS_ORIGINS=http://localhost:3000,https://app.example.com
- Do not use "*" in production.

WebSocket Origin Enforcement
- WS upgrades are allowed only for:
  - Same-origin requests (Origin host matches Host)
  - Origins listed in CORS_ORIGINS

Rate Limiting
- Write endpoints (POST /configs, PATCH /configs/:id) and WS connect attempts are rate-limited per IP.
- Configure with:
  RATE_LIMIT_RPS, RATE_LIMIT_BURST
  WS_RATE_LIMIT_RPS, WS_RATE_LIMIT_BURST

Pprof
- /debug/pprof is disabled by default.
- Enable with PPROF=1.
- Access is allowed only from loopback by default.
- To allow remote access, set PPROF_TOKEN and send header:
  X-Admin-Token: <token>

Ingestion
- Ingest CLI validates zip contents, blocks symlinks and path traversal.
- Only allowed extensions are extracted (.gltf, .glb, .bin, .png, .jpg, .jpeg, .webp).
