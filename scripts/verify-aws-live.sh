#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
docs_root="$(cd "$script_dir/.." && pwd)"
workspace_root="${AGENTDISPATCH_WORKSPACE_ROOT:-$(cd "$docs_root/.." && pwd)}"
config="${AGENTDISPATCH_CONFIG:-agentdispatch.config.json}"
runtime="${AGENTDISPATCH_RUNTIME:-research-agent}"

if [[ -f "$workspace_root/agentdispatch-cli/dist/index.js" ]]; then
  cli=(node "$workspace_root/agentdispatch-cli/dist/index.js")
else
  cli=(npx -y @agent-dispatch/cli)
fi

if [[ ! -f "$config" ]]; then
  echo "Config file was not found: $config" >&2
  echo "Set AGENTDISPATCH_CONFIG=/absolute/path/agentdispatch.config.json or run from a directory containing agentdispatch.config.json." >&2
  exit 1
fi

echo "Running live AWS AgentCore preflight for runtime '$runtime' with config '$config'."
doctor_output="$(mktemp)"
trap 'rm -f "$doctor_output"' EXIT
"${cli[@]}" doctor --config "$config" --runtime "$runtime" --aws-live --json > "$doctor_output"
cat "$doctor_output"
node -e "const fs = require('node:fs'); const report = JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); if (report.ok !== true) process.exit(1);" "$doctor_output"

if [[ "${AGENTDISPATCH_LIVE_DISPATCH:-0}" != "1" ]]; then
  echo
  echo "Live AWS preflight passed. Set AGENTDISPATCH_LIVE_DISPATCH=1 to also submit a real cloud task."
  exit 0
fi

instruction="${AGENTDISPATCH_LIVE_INSTRUCTION:-AgentDispatch live smoke: respond with a short success message and no external side effects.}"
timeout_ms="${AGENTDISPATCH_LIVE_TIMEOUT_MS:-600000}"

echo
echo "Submitting live AWS AgentCore task for runtime '$runtime'."
"${cli[@]}" run \
  --config "$config" \
  --runtime "$runtime" \
  --instruction "$instruction" \
  --wait \
  --timeout-ms "$timeout_ms"
