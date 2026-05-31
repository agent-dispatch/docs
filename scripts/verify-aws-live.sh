#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
docs_root="$(cd "$script_dir/.." && pwd)"
workspace_root="${AGENTDISPATCH_WORKSPACE_ROOT:-$(cd "$docs_root/.." && pwd)}"
config="${AGENTDISPATCH_CONFIG:-agentdispatch.config.json}"
runtime="${AGENTDISPATCH_RUNTIME:-research-agent}"
report_path="${AGENTDISPATCH_LIVE_REPORT:-agentdispatch-live-aws-report.json}"
placeholder_runtime_arn="arn:aws:bedrock-agentcore:us-west-2:123456789012:agent/00000000-0000-0000-0000-000000000000:1"

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

target_output="$(mktemp)"
doctor_output="$(mktemp)"
dispatch_output="$(mktemp)"
trap 'rm -f "$target_output" "$doctor_output" "$dispatch_output"' EXIT

node - "$config" "$runtime" "$placeholder_runtime_arn" "$target_output" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

try {
  const [, , configPath, runtimeName, placeholderRuntimeArn, targetOutput] = process.argv;
  const raw = fs.readFileSync(configPath, "utf8");
  let config;
  try {
    config = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Config is not valid JSON: ${error.message}`);
  }

  const runtime = config.runtimes?.[runtimeName];
  if (!runtime) {
    const known = Object.keys(config.runtimes ?? {});
    throw new Error(`Runtime '${runtimeName}' was not found in ${path.resolve(configPath)}. Known runtimes: ${known.join(", ") || "(none)"}.`);
  }

  const backend = config.backends?.[runtime.backend];
  if (!backend) {
    throw new Error(`Runtime '${runtimeName}' references missing backend '${runtime.backend}'.`);
  }
  if (backend.adapter !== "aws-agentcore") {
    throw new Error(`Runtime '${runtimeName}' uses backend '${runtime.backend}', but that backend adapter is '${backend.adapter}', not 'aws-agentcore'.`);
  }

  const account = config.accounts?.[runtime.account ?? backend.account];
  if (!account) {
    throw new Error(`Runtime '${runtimeName}' references missing AWS account profile '${runtime.account ?? backend.account}'.`);
  }

  const mode = runtime.target?.mode ?? config.defaults?.targetMode ?? "session";
  const region = account.region ?? backend.details?.region ?? process.env.AWS_REGION ?? "us-east-1";
  const runtimeArn = runtime.target?.details?.runtimeArn ?? backend.details?.runtimeArn ?? process.env.AGENTDISPATCH_AGENTCORE_RUNTIME_ARN;

  if (mode === "session") {
    if (!runtimeArn) {
      throw new Error(`Runtime '${runtimeName}' is session mode and needs a real AgentCore runtime ARN in runtime.target.details.runtimeArn, backend.details.runtimeArn, or AGENTDISPATCH_AGENTCORE_RUNTIME_ARN.`);
    }
    if (runtimeArn === placeholderRuntimeArn) {
      throw new Error(`Runtime '${runtimeName}' still uses the sample placeholder AgentCore runtime ARN. Replace it before running live AWS verification.`);
    }
  }

  console.error(`Live AWS target: runtime=${runtimeName} mode=${mode} region=${region} config=${path.resolve(configPath)}`);
  if (mode === "session") console.error(`Live AWS target runtimeArn=${runtimeArn}`);
  fs.writeFileSync(targetOutput, `${JSON.stringify({
    configPath: path.resolve(configPath),
    runtime: runtimeName,
    backend: runtime.backend,
    account: runtime.account ?? backend.account,
    mode,
    region,
    protocol: runtime.protocol ?? runtime.target?.protocol ?? backend.details?.protocol ?? null,
    runtimeArn: runtimeArn ?? null
  }, null, 2)}\n`);
} catch (error) {
  console.error(`Live AWS verification input error: ${error.message}`);
  process.exit(1);
}
NODE

echo
echo "Running live AWS AgentCore preflight."
echo "This resolves AWS credentials and checks the configured AgentCore runtime/control plane."
"${cli[@]}" doctor --config "$config" --runtime "$runtime" --aws-live --json > "$doctor_output"
cat "$doctor_output"
node - "$doctor_output" <<'NODE'
const fs = require("node:fs");
const report = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
if (report.ok === true) process.exit(0);
for (const check of report.checks ?? []) {
  if (check.status === "fail") {
    console.error(`FAILED ${check.name}: ${check.message}`);
  }
}
process.exit(1);
NODE

write_report() {
  local dispatch_status="$1"
  node - "$target_output" "$doctor_output" "$report_path" "$dispatch_status" "$dispatch_output" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const [, , targetPath, doctorPath, reportPath, dispatchStatus, dispatchOutputPath] = process.argv;
const target = JSON.parse(fs.readFileSync(targetPath, "utf8"));
const doctor = JSON.parse(fs.readFileSync(doctorPath, "utf8"));
const dispatchOutput = fs.existsSync(dispatchOutputPath) ? fs.readFileSync(dispatchOutputPath, "utf8") : "";
const report = {
  generatedAt: new Date().toISOString(),
  kind: "agentdispatch-live-aws-verification",
  target,
  preflight: {
    ok: doctor.ok === true,
    checks: doctor.checks ?? []
  },
  dispatch: {
    requested: process.env.AGENTDISPATCH_LIVE_DISPATCH === "1",
    status: dispatchStatus,
    output: dispatchOutput || null
  },
  claim: dispatchStatus === "succeeded"
    ? "Live AWS dispatch verified against a real AgentCore runtime."
    : "Live AWS preflight verified; live dispatch was not requested."
};

fs.mkdirSync(path.dirname(path.resolve(reportPath)), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.error(`Wrote live AWS verification report: ${path.resolve(reportPath)}`);
NODE
}

if [[ "${AGENTDISPATCH_LIVE_DISPATCH:-0}" != "1" ]]; then
  write_report "not-requested"
  echo
  echo "Live AWS preflight passed."
  echo "Set AGENTDISPATCH_LIVE_DISPATCH=1 to also submit a real cloud task. That may incur AWS cost and will write task state under the configured stateDir."
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
  --timeout-ms "$timeout_ms" | tee "$dispatch_output"
write_report "succeeded"
