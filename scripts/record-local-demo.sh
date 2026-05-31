#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
docs_root="$(cd "$script_dir/.." && pwd)"
workspace_root="${AGENTDISPATCH_WORKSPACE_ROOT:-$(cd "$docs_root/.." && pwd)}"

if [[ -n "${AGENTDISPATCH_DEMO_RECORD_DIR:-}" ]]; then
  output_dir="$AGENTDISPATCH_DEMO_RECORD_DIR"
else
  output_dir="$(mktemp -d -t agentdispatch-demo-recording-XXXXXX)"
fi

mkdir -p "$output_dir"

raw_output="$output_dir/local-demo.raw.txt"
transcript="$output_dir/local-demo.transcript.txt"
report="$output_dir/local-demo.report.json"

echo "Recording AgentDispatch local demo into: $output_dir"
echo

set +e
bash "$script_dir/demo-local.sh" 2>&1 | tee "$raw_output"
status="${PIPESTATUS[0]}"
set -e

escaped_workspace="${workspace_root//\//\\/}"
sed -E \
  -e "s/${escaped_workspace}/<agentdispatch-workspace>/g" \
  -e "s#/var/folders/[^[:space:]]+/agentdispatch\\.config\\.json#<temporary-agentdispatch.config.json>#g" \
  -e "s#/tmp/[^[:space:]]+/agentdispatch\\.config\\.json#<temporary-agentdispatch.config.json>#g" \
  "$raw_output" > "$transcript"

node - "$report" "$output_dir" "$status" "$transcript" "$raw_output" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const [reportPath, outputDir, status, transcriptPath, rawOutputPath] = process.argv.slice(2);
const ok = Number(status) === 0;
const transcript = fs.readFileSync(transcriptPath, "utf8");

const report = {
  generatedAt: new Date().toISOString(),
  ok,
  claim: ok
    ? "Recorded AgentDispatch local no-cloud demo successfully."
    : "AgentDispatch local no-cloud demo recording failed.",
  outputDir,
  artifacts: {
    transcript: path.resolve(transcriptPath),
    rawOutput: path.resolve(rawOutputPath)
  },
  checks: {
    createdConfig: transcript.includes("Wrote <temporary-agentdispatch.config.json>"),
    doctorOk: transcript.includes('"ok": true'),
    mcpCheckOk: transcript.includes("MCP server") && transcript.includes('"providers"'),
    plannedSpawnPayload: transcript.includes('"tool": "spawn_cloud_agent"'),
    claimBoundary: transcript.includes("It does not prove live AWS AgentCore dispatch")
  },
  doesNotProve: [
    "live AWS AgentCore preflight",
    "live AWS AgentCore dispatch",
    "published npm availability for unpublished local changes"
  ]
};

fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
NODE

echo
echo "Demo recording artifacts"
echo "- Transcript: $transcript"
echo "- Raw output: $raw_output"
echo "- Report: $report"

if [[ "$status" -ne 0 ]]; then
  exit "$status"
fi
