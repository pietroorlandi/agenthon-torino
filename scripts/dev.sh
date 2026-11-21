#!/usr/bin/env bash
# Backend (FastAPI :8000, auto-reload) + frontend (Vite :5173, proxy /api → :8000). Ctrl+C stops both.
set -euo pipefail
cd "$(dirname "$0")/.."
trap 'kill 0' EXIT
(cd src/backend && .venv/bin/uvicorn app.main:app --reload --port 8000) &
(cd src/frontend && npm run dev) &
wait
