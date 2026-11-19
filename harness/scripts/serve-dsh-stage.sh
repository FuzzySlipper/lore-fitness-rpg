#!/usr/bin/env bash
# A local copy of Lore's Marinara-DSH instance for testing the team turn: DSH from npm pinned
# to the release on den-lore, the dsh-stage plugin built from source, an isolated DSH_HOME,
# listening on 127.0.0.1 only. Marinara finds it through MARINARA_TEAM_DSH_DIR=<dir>, which
# reads <dir>/run/host.log for the launch token, as it does on Windows.
#
#   serve-dsh-stage.sh [--dir DIR] [--port 3181] [--stage-src ~/dev/experiments/roleplay/dsh-stage] [--install-only]
#
# Runs in the foreground; stop it with Ctrl-C or by killing the PID in DIR/run/host.pid.
set -euo pipefail

dir="${HOME}/dev/lore-fitness-rpg-work/dsh-instance"
port=3181
stage_src="${HOME}/dev/experiments/roleplay/dsh-stage"
install_only=false
while [ $# -gt 0 ]; do
  case "$1" in
    --dir) dir="$2"; shift 2 ;;
    --port) port="$2"; shift 2 ;;
    --stage-src) stage_src="$2"; shift 2 ;;
    --install-only) install_only=true; shift ;;
    *) echo "unknown option $1" >&2; exit 2 ;;
  esac
done

# The release on den-lore (see docs/references.md, DSH snapshot) and the pi-ai version its hook needs.
dsh_version="0.2.2-alpha.2"
pi_ai_version="1.3.0"

mkdir -p "$dir/stage" "$dir/run" "$dir/work" "$dir/home"
export DSH_HOME="$dir/home" DSH_TELEMETRY_DISABLED=1 MARINARA_CONNECTION_KEY=none MOCK_API_KEY=mock

if [ ! -f "$dir/node_modules/@deepseek-ai/dsh/package.json" ] ||
  ! grep -q "\"version\": \"$dsh_version\"" "$dir/node_modules/@deepseek-ai/dsh/package.json"; then
  cat >"$dir/package.json" <<JSON
{ "name": "marinara-dsh-test", "private": true,
  "dependencies": { "@deepseek-ai/dsh": "$dsh_version" },
  "overrides": { "@earendil-works/pi-ai": "$pi_ai_version" } }
JSON
  (cd "$dir" && npm install --no-audit --no-fund --loglevel=error)
fi

# The plugin as the Windows install ships it: the built lib plus its profile files and scripts.
[ -f "$stage_src/lib/index.mjs" ] || { echo "build the plugin first: $stage_src/lib/index.mjs is missing" >&2; exit 1; }
rm -rf "$dir/stage/lib" "$dir/stage/scripts"
cp -r "$stage_src/lib" "$stage_src/scripts" "$dir/stage/"
cp "$stage_src/package.json" "$stage_src/cordis.patch.yml" "$stage_src/profile.patch.yml" "$dir/stage/"
node "$dir/stage/scripts/setup-home.mjs" --plugin "$dir/stage" >/dev/null
(cd "$DSH_HOME/profiles/stage" && rm -rf node_modules/dsh-stage && npm install --legacy-peer-deps --no-audit --no-fund --loglevel=error)
echo "installed dsh $(node "$dir/node_modules/@deepseek-ai/dsh/lib/bin.js" --version 2>/dev/null) with dsh-stage from $stage_src"
$install_only && exit 0

cd "$dir/work"
echo $$ >"$dir/run/host.pid"
exec node "$dir/node_modules/@deepseek-ai/dsh/lib/bin.js" --profile stage --no-open --port "$port" >"$dir/run/host.log" 2>"$dir/run/host.err.log"
