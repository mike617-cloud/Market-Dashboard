#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  Market Dashboard – start script (macOS + Linux compatible)
# ─────────────────────────────────────────────────────────────
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$ROOT/backend/.env"

# ── Check for FRED API key ────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  cp "$ROOT/backend/.env.example" "$ENV_FILE"
fi

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
    # Use Python for cross-platform .env editing (macOS sed differs from Linux)
    python3 - <<PYEOF
import re, pathlib
p = pathlib.Path("$ENV_FILE")
p.write_text(re.sub(r'FRED_API_KEY=.*', 'FRED_API_KEY=$KEY', p.read_text()))
PYEOF
    echo "  ✓ Key saved to backend/.env"
  fi
  echo ""
fi

# ── Python virtual environment ────────────────────────────────
echo "▶  Checking Python dependencies..."
cd "$ROOT/backend"
if [ ! -d ".venv" ]; then
  echo "  Setting up Python environment (first run only, ~1 min)..."
  python3 -m venv .venv
fi
source .venv/bin/activate
pip install -q -r requirements.txt
echo "  ✓ Python ready"

# ── Node dependencies ─────────────────────────────────────────
echo "▶  Checking Node dependencies..."
cd "$ROOT/frontend"
if [ ! -d "node_modules" ]; then
  echo "  Installing Node packages (first run only, ~1 min)..."
  npm install --silent
fi
echo "  ✓ Node ready"

# ── Start backend ─────────────────────────────────────────────
echo "▶  Starting data server..."
cd "$ROOT/backend"
uvicorn main:app --host 127.0.0.1 --port 8000 --reload --log-level warning &
BACKEND_PID=$!
sleep 2

# ── Start frontend ────────────────────────────────────────────
echo "▶  Starting dashboard..."
cd "$ROOT/frontend"
npm run dev --silent &
FRONTEND_PID=$!
sleep 2

echo ""
echo "  ┌─────────────────────────────────────────────────────┐"
echo "  │                                                     │"
echo "  │   Dashboard is running!                             │"
echo "  │                                                     │"
echo "  │   Open this in your browser:                        │"
echo "  │   → http://localhost:5173                           │"
echo "  │                                                     │"
echo "  │   Press Ctrl-C to stop                              │"
echo "  │                                                     │"
echo "  └─────────────────────────────────────────────────────┘"
echo ""

trap "echo ''; echo '  Shutting down...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
