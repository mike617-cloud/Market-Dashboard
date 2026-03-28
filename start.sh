#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  Market Dashboard – start script
# ─────────────────────────────────────────────────────────────
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$ROOT/backend/.env"

# ── Check for FRED API key ─────────────────────────────────────
CURRENT_KEY=$(grep "^FRED_API_KEY=" "$ENV_FILE" 2>/dev/null | cut -d= -f2)
if [ -z "$CURRENT_KEY" ] || [ "$CURRENT_KEY" = "your_fred_api_key_here" ]; then
  echo ""
  echo "  ┌─────────────────────────────────────────────────────┐"
  echo "  │  One-time setup: you need a free FRED API key       │"
  echo "  │                                                     │"
  echo "  │  1. Go to: https://fred.stlouisfed.org/docs/api/api_key.html"
  echo "  │  2. Click 'Request API Key' and fill in your name   │"
  echo "  │  3. Paste your key below                            │"
  echo "  └─────────────────────────────────────────────────────┘"
  echo ""
  read -rp "  Paste your FRED API key here: " KEY
  if [ -z "$KEY" ]; then
    echo "  No key entered. Spreads and rates won't load without it."
    echo "  (You can add it later by editing backend/.env)"
  else
    # Write key to .env
    sed -i "s|FRED_API_KEY=.*|FRED_API_KEY=$KEY|" "$ENV_FILE"
    echo "  ✓ Key saved to backend/.env"
  fi
  echo ""
fi

# ── Backend ───────────────────────────────────────────────────
echo "▶  Starting data server (backend)..."
cd "$ROOT/backend"
source .venv/bin/activate
uvicorn main:app --host 127.0.0.1 --port 8000 --reload --log-level warning &
BACKEND_PID=$!

# Give backend a moment to start
sleep 2

# ── Frontend ──────────────────────────────────────────────────
echo "▶  Starting dashboard (frontend)..."
cd "$ROOT/frontend"
npm run dev --silent &
FRONTEND_PID=$!

sleep 2

echo ""
echo "  ┌─────────────────────────────────────────────────────┐"
echo "  │                                                     │"
echo "  │   Dashboard is running!                            │"
echo "  │                                                     │"
echo "  │   Open this in your browser:                       │"
echo "  │   → http://localhost:5173                          │"
echo "  │                                                     │"
echo "  │   Press Ctrl-C to stop                             │"
echo "  │                                                     │"
echo "  └─────────────────────────────────────────────────────┘"
echo ""

trap "echo ''; echo '  Shutting down...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
