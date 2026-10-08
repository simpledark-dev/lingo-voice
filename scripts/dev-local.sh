#!/usr/bin/env bash
# Run the app against a LOCAL LiveKit server (no cloud account needed).
# Browser tabs on this machine can talk to each other; other devices cannot
# (they need HTTPS + a reachable LiveKit server -> use LiveKit Cloud + a deploy).
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v livekit-server >/dev/null 2>&1; then
  echo "livekit-server not found. Install it with: brew install livekit  (or see https://docs.livekit.io/home/self-hosting/local/)" >&2
  exit 1
fi

livekit-server --dev --node-ip 127.0.0.1 >/tmp/livekit-dev.log 2>&1 &
LK_PID=$!
trap 'kill "$LK_PID" 2>/dev/null || true' EXIT
echo "livekit-server (dev) started, pid $LK_PID, logs: /tmp/livekit-dev.log"

export LIVEKIT_URL="${LIVEKIT_URL:-ws://127.0.0.1:7880}"
export LIVEKIT_API_KEY="${LIVEKIT_API_KEY:-devkey}"
export LIVEKIT_API_SECRET="${LIVEKIT_API_SECRET:-secret}"
exec pnpm exec next dev -p "${PORT:-3000}"
