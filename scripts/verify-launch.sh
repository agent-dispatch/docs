#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
docs_root="$(cd "$script_dir/.." && pwd)"
workspace_root="${AGENTDISPATCH_WORKSPACE_ROOT:-$(cd "$docs_root/.." && pwd)}"

if [[ -n "${AGENTDISPATCH_LAUNCH_EVIDENCE_DIR:-}" ]]; then
  evidence_dir="$AGENTDISPATCH_LAUNCH_EVIDENCE_DIR"
  mkdir -p "$evidence_dir"
else
  evidence_dir="$(mktemp -d "${TMPDIR:-/tmp}/agentdispatch-launch-evidence.XXXXXX")"
fi

evidence_dir="$(cd "$evidence_dir" && pwd)"

local_e2e_report="$evidence_dir/agentdispatch-local-e2e-report.json"
npm_status_report="$evidence_dir/agentdispatch-npm-status-report.json"
publish_dry_run_report="$evidence_dir/agentdispatch-publish-dry-run-report.json"
security_report="$evidence_dir/agentdispatch-security-audit-report.json"
published_smoke_report="$evidence_dir/agentdispatch-published-smoke-report.json"
release_status_report="$evidence_dir/agentdispatch-release-status.json"
launch_summary_report="$evidence_dir/agentdispatch-launch-summary.md"
push_plan_report="$evidence_dir/agentdispatch-push-plan.md"

run_step() {
  printf '\n===== %s =====\n' "$*" >&2
  "$@"
}

assert_json_report() {
  node -e "JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8'))" "$1"
}

echo "AgentDispatch launch verification"
echo "workspace: $workspace_root"
echo "evidence: $evidence_dir"

if [[ "${AGENTDISPATCH_SKIP_LOCAL_E2E:-0}" != "1" ]]; then
  run_step env \
    AGENTDISPATCH_WORKSPACE_ROOT="$workspace_root" \
    AGENTDISPATCH_VERIFY_INSTALL="${AGENTDISPATCH_VERIFY_INSTALL:-1}" \
    AGENTDISPATCH_LOCAL_E2E_REPORT="$local_e2e_report" \
    npm --prefix "$docs_root" run verify:local-e2e
else
  echo
  echo "Skipping local E2E because AGENTDISPATCH_SKIP_LOCAL_E2E=1."
  if [[ ! -f "$local_e2e_report" ]]; then
    echo "Expected retained local E2E report is missing: $local_e2e_report" >&2
    exit 1
  fi
fi

run_step env \
  AGENTDISPATCH_WORKSPACE_ROOT="$workspace_root" \
  AGENTDISPATCH_NPM_STATUS_REPORT="$npm_status_report" \
  npm --prefix "$docs_root" run status:npm

run_step env \
  AGENTDISPATCH_WORKSPACE_ROOT="$workspace_root" \
  AGENTDISPATCH_PUBLISH_DRY_RUN_REPORT="$publish_dry_run_report" \
  npm --prefix "$docs_root" run status:publish -- --strict

run_step env \
  AGENTDISPATCH_WORKSPACE_ROOT="$workspace_root" \
  AGENTDISPATCH_SECURITY_REPORT="$security_report" \
  npm --prefix "$docs_root" run status:security -- --strict

run_step env \
  AGENTDISPATCH_PUBLISHED_SMOKE_REPORT="$published_smoke_report" \
  npm --prefix "$docs_root" run smoke:published

printf '\n===== %s =====\n' "env AGENTDISPATCH_WORKSPACE_ROOT=$workspace_root AGENTDISPATCH_LOCAL_E2E_REPORT=$local_e2e_report AGENTDISPATCH_NPM_STATUS_REPORT=$npm_status_report AGENTDISPATCH_PUBLISH_DRY_RUN_REPORT=$publish_dry_run_report AGENTDISPATCH_SECURITY_REPORT=$security_report AGENTDISPATCH_PUBLISHED_SMOKE_REPORT=$published_smoke_report npm --prefix $docs_root run status:release -- --json" >&2
env \
  AGENTDISPATCH_WORKSPACE_ROOT="$workspace_root" \
  AGENTDISPATCH_LOCAL_E2E_REPORT="$local_e2e_report" \
  AGENTDISPATCH_NPM_STATUS_REPORT="$npm_status_report" \
  AGENTDISPATCH_PUBLISH_DRY_RUN_REPORT="$publish_dry_run_report" \
  AGENTDISPATCH_SECURITY_REPORT="$security_report" \
  AGENTDISPATCH_PUBLISHED_SMOKE_REPORT="$published_smoke_report" \
  npm --silent --prefix "$docs_root" run status:release -- --json > "$release_status_report"

for report in \
  "$local_e2e_report" \
  "$npm_status_report" \
  "$publish_dry_run_report" \
  "$security_report" \
  "$published_smoke_report" \
  "$release_status_report"; do
  assert_json_report "$report"
done

run_step env \
  AGENTDISPATCH_LAUNCH_EVIDENCE_DIR="$evidence_dir" \
  AGENTDISPATCH_LAUNCH_SUMMARY_REPORT="$launch_summary_report" \
  npm --prefix "$docs_root" run status:launch-summary

run_step env \
  AGENTDISPATCH_WORKSPACE_ROOT="$workspace_root" \
  AGENTDISPATCH_PUSH_PLAN_REPORT="$push_plan_report" \
  npm --prefix "$docs_root" run status:push-plan

echo
echo "Launch verification evidence written to:"
echo "$evidence_dir"
echo
echo "Reports:"
printf -- '- %s\n' \
  "$local_e2e_report" \
  "$npm_status_report" \
  "$publish_dry_run_report" \
  "$security_report" \
  "$published_smoke_report" \
  "$release_status_report" \
  "$launch_summary_report" \
  "$push_plan_report"
