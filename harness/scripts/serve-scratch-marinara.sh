#!/usr/bin/env bash
# Start a private scratch Marinara plus the scripted mock game master, for one
# internal playtest session. Lore's installation and data are never touched.
#
# Usage: serve-scratch-marinara.sh --host HOST --port PORT --data DIR [--script FILE]
#
# Environment:
#   MARINARA_DIR  Marinara checkout to run (default ~/dev/lore-fitness-rpg-work/marinara-custom).
#                 It must already be built with `pnpm install && pnpm build`.
#   NODE24_BIN    Directory holding a Node >= 24 binary (default ~/.local/opt/node24/bin).
#
# The mock game master listens on PORT+1. After Marinara is healthy, a connection
# named "Mock GM" is created and made the default, so new games use it.
set -euo pipefail

host=127.0.0.1
port=7910
data=""
script=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --host) host="$2"; shift 2 ;;
    --port) port="$2"; shift 2 ;;
    --data) data="$2"; shift 2 ;;
    --script) script="$2"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
[[ -n "$data" ]] || { echo "--data is required" >&2; exit 2; }

harness_dir="$(cd "$(dirname "$0")/.." && pwd)"
marinara_dir="${MARINARA_DIR:-$HOME/dev/lore-fitness-rpg-work/marinara-custom}"
export PATH="${NODE24_BIN:-$HOME/.local/opt/node24/bin}:$PATH"
gm_port=$((port + 1))
mkdir -p "$data/marinara"

script_args=()
[[ -n "$script" ]] && script_args=(--script "$script")
node "$harness_dir/mock-gm/server.mjs" --host 127.0.0.1 --port "$gm_port" \
  --log "$data/mock-gm-requests.jsonl" "${script_args[@]}" > "$data/mock-gm.log" 2>&1 &
gm_pid=$!

cd "$marinara_dir"
HOST="$host" PORT="$port" DATA_DIR="$data/marinara" AUTO_UPDATE_ENABLED=false \
  node scripts/run-server.mjs packages/server/dist/index.js > "$data/marinara.log" 2>&1 &
marinara_pid=$!

cleanup() { kill "$marinara_pid" "$gm_pid" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

base="http://127.0.0.1:$port"
for _ in $(seq 1 90); do
  curl -sf -o /dev/null "$base/" && break
  kill -0 "$marinara_pid" 2>/dev/null || { echo "marinara exited; see $data/marinara.log" >&2; exit 1; }
  sleep 1
done

if ! curl -sf "$base/api/connections" | grep -q '"Mock GM"'; then
  curl -sf -X POST "$base/api/connections" -H 'content-type: application/json' \
    -d "{\"name\":\"Mock GM\",\"provider\":\"custom\",\"baseUrl\":\"http://127.0.0.1:$gm_port/v1\",\"model\":\"mock-gm\",\"isDefault\":true}" \
    > "$data/mock-gm-connection.json"
fi

echo "scratch marinara ready at $base (mock GM on $gm_port, data in $data)"
wait "$marinara_pid"
