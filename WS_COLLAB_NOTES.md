# Step 7 – WS Collaboration Notes

## WS URL (dev)
- `ws://localhost:8080/ws?configId=<uuid>`
- CRA proxy is not used for WS; client connects directly to `:8080` in development.

## Supported Messages
Server -> client:
- `hello`
- `sync` (full config)
- `patch_applied` (full config + revision)
- `conflict` (current config)
- `error`

Client -> server:
- `patch` (baseRevision + colors delta)

## Two‑tab test steps
1. Start backend + frontend.
2. Open `/c/:id` in two tabs.
3. Tab A: change sole color, click Update.
4. Tab B updates within ~1s (colors + revision).

## Conflict test
1. Tab A click Update.
2. Tab B immediately click Update using old revision (or trigger quickly).
3. Backend responds 409, client reloads latest config.

## Reconnect test
1. With `/c/:id` open, stop backend. UI shows Offline.
2. Restart backend, UI reconnects and syncs.
