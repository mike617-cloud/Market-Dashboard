#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

# ── Backend ───────────────────────────────────────────────────────────────────
echo "▶ Setting up Python backend..."
cd "$ROOT/backend"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "  ⚠  Created backend/.env – add your FRED_API_KEY before starting"
fi

if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
source .venv/bin/activate
pip install -q -r requirements.txt

echo "▶ Starting backend on http://localhost:8000"
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# ── Frontend ──────────────────────────────────────────────────────────────────
echo "▶ Setting up Node frontend..."
cd "$ROOT/frontend"

if [ ! -d node_modules ]; then
  npm install
fi

echo "▶ Starting frontend on http://localhost:5173"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "  Dashboard → http://localhost:5173"
echo "  API docs  → http://localhost:8000/docs"
echo ""
echo "  Press Ctrl-C to stop both servers"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
