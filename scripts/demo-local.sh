#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
docs_root="$(cd "$script_dir/.." && pwd)"
workspace_root="${AGENTDISPATCH_WORKSPACE_ROOT:-$(cd "$docs_root/.." && pwd)}"
tmpdir="$(mktemp -d)"

cleanup() {
  rm -rf "$tmpdir"
}
trap cleanup EXIT

cli_dir="$workspace_root/agentdispatch-cli"
mcp_dir="$workspace_root/agentdispatch-mcp-server"
config="$tmpdir/agentdispatch.config.json"
doctor_report="$tmpdir/doctor.json"
mcp_report="$tmpdir/mcp-check.json"

if [[ ! -f "$cli_dir/dist/index.js" ]]; then
  npm --prefix "$cli_dir" run build >/dev/null
fi

if [[ ! -f "$mcp_dir/dist/bin.js" ]]; then
  npm --prefix "$mcp_dir" run build >/dev/null
fi

echo "AgentDispatch local demo"
echo "workspace: $workspace_root"
echo

echo "1. Create a local config"
node "$cli_dir/dist/index.js" init \
  --config "$config" \
  --region us-west-2 \
  --runtime-arn arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/research-agent \
  --protocol a2a

echo
echo "2. Run agentdispatch doctor"
node "$cli_dir/dist/index.js" doctor --config "$config" --json > "$doctor_report"
node -e "
  const report = require(process.argv[1]);
  if (report.ok !== true) throw new Error('doctor did not return ok:true');
  console.log(JSON.stringify({ ok: report.ok, accounts: report.accounts, backends: report.backends, runtimes: report.runtimes, defaultRuntime: report.defaultRuntime }, null, 2));
" "$doctor_report"

echo
echo "3. Check the MCP server"
node "$mcp_dir/dist/bin.js" --config "$config" --check > "$mcp_report"
node -e "
  const report = require(process.argv[1]);
  if (report.ok !== true) throw new Error('MCP check did not return ok:true');
  console.log(JSON.stringify({ ok: report.ok, providers: report.providers, accounts: report.accounts.map((account) => account.name), runtimes: report.runtimes.map((runtime) => runtime.name) }, null, 2));
" "$mcp_report"

echo
echo "4. Lead-agent MCP config"
cat <<JSON
{
  "mcpServers": {
    "agentdispatch": {
      "command": "npx",
      "args": [
        "-y",
        "@agent-dispatch/mcp-server",
        "--config",
        "$config"
      ]
    }
  }
}
JSON

echo
echo "5. Planned lead-agent tool call"
cat <<'JSON'
{
  "tool": "spawn_cloud_agent",
  "arguments": {
    "runtime": "research-agent",
    "instruction": "Audit this repository while I keep working locally.",
    "protocol": "a2a",
    "context": {
      "repo": "agent-dispatch",
      "priority": "background"
    }
  }
}
JSON

echo
echo "Local demo passed."
echo "This proves local CLI config, doctor, MCP startup, and copyable handoff shape."
echo "It does not prove live AWS AgentCore dispatch; use verify:aws-live with AGENTDISPATCH_LIVE_DISPATCH=1 for that."
