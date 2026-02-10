#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

cd "$REPO_ROOT"

echo "🚀 Starting CodexMonitor (dev mode)..."

if ! command -v npm >/dev/null 2>&1; then
  echo "❌ Error: npm is not installed or not in PATH."
  echo "Install Node.js first: https://nodejs.org/"
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "📦 node_modules not found; running npm install..."
  npm install
fi

echo "🩺 Running environment doctor..."
npm run doctor:strict

echo "🧪 Launching Tauri app..."
exec npm run tauri:dev
