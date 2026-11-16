#!/usr/bin/env bash
# Start a private scratch Marinara plus the scripted mock game master, for one
# internal playtest session. Lore's installation and data are never touched.
#
# Usage: serve-scratch-marinara.sh --host HOST --port PORT --data DIR [--script FILE]
#          [--model-url URL [--model NAME]]
#
# Environment:
#   MARINARA_DIR  Marinara checkout to run (default ~/dev/lore-fitness-rpg-work/marinara-custom).
#                 It must already be built with `pnpm install && pnpm build`.
#   NODE24_BIN    Directory holding a Node >= 24 binary (default ~/.local/opt/node24/bin).
#
# PROVIDER_LOCAL_URLS_ENABLED=true lets the scratch instance call LAN model servers;
# Marinara refuses private-range provider URLs without it.
#
# The mock game master listens on PORT+1. After Marinara is healthy, a connection
# named "Mock GM" is created. It is the default unless --model-url names a real
# OpenAI-compatible model (for example a LAN Lemonade server), in which case a
# "Real GM" connection to that model is created and made the default instead.
set -euo pipefail

host=127.0.0.1
port=7910
data=""
script=""
model_url=""
model="Gemma-4-26B-A4B-it-MTP-GGUF"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --host) host="$2"; shift 2 ;;
    --port) port="$2"; shift 2 ;;
    --data) data="$2"; shift 2 ;;
    --script) script="$2"; shift 2 ;;
    --model-url) model_url="$2"; shift 2 ;;
    --model) model="$2"; shift 2 ;;
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
HOST="$host" PORT="$port" DATA_DIR="$data/marinara" AUTO_UPDATE_ENABLED=false PROVIDER_LOCAL_URLS_ENABLED=true \
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

add_connection() { # name baseUrl model isDefault
  curl -sf "$base/api/connections" | grep -q "\"$1\"" && return 0
  curl -sf -X POST "$base/api/connections" -H 'content-type: application/json' \
    -d "{\"name\":\"$1\",\"provider\":\"custom\",\"baseUrl\":\"$2\",\"model\":\"$3\",\"isDefault\":$4}" \
    >> "$data/connections.json"
}
if [[ -n "$model_url" ]]; then
  add_connection "Real GM" "$model_url" "$model" true
  # Game Mode asks for maximum reasoning by default. With a thinking model on
  # Lemonade that truncated replies and leaked planning text into the story, so
  # the real connection turns reasoning off (Marinara then sends
  # chat_template_kwargs.enable_thinking=false to local endpoints).
  real_id="$(curl -sf "$base/api/connections" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const c=JSON.parse(s).find(c=>c.name==="Real GM");process.stdout.write(c?c.id:"")})')"
  [[ -n "$real_id" ]] && curl -sf -X PUT "$base/api/connections/$real_id/default-parameters" \
    -H 'content-type: application/json' \
    -d '{"reasoningEffort":null,"enabledParameters":{"reasoningEffort":true}}' > /dev/null
  add_connection "Mock GM" "http://127.0.0.1:$gm_port/v1" mock-gm false
else
  add_connection "Mock GM" "http://127.0.0.1:$gm_port/v1" mock-gm true
fi

echo "scratch marinara ready at $base (mock GM on $gm_port${model_url:+, real GM $model at $model_url}, data in $data)"
wait "$marinara_pid"
