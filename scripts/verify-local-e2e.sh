#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
docs_root="$(cd "$script_dir/.." && pwd)"
workspace_root="${AGENTDISPATCH_WORKSPACE_ROOT:-$(cd "$docs_root/.." && pwd)}"

packages=(
  agentdispatch-core
  agentdispatch-store-sqlite
  agentdispatch-adapter-aws-agentcore
  agentdispatch-worker-agentcore
  agentdispatch-sdk-js
  agentdispatch-mcp-server
  agentdispatch-cli
  agentdispatch-adapter-template
  agentdispatch-docs
  agentdispatch-github-profile
  agentdispatch-website
)

run_step() {
  printf '\n===== %s =====\n' "$*"
  "$@"
}

has_script() {
  local package_dir="$1"
  local script_name="$2"
  node -e "
    const pkg = require('${package_dir}/package.json');
    process.exit(pkg.scripts && pkg.scripts['${script_name}'] ? 0 : 1);
  "
}

require_file() {
  local path="$1"
  if [[ ! -f "$path" ]]; then
    echo "Missing required file: $path" >&2
    exit 1
  fi
}

echo "Verifying AgentDispatch workspace: $workspace_root"

require_file "$workspace_root/agentdispatch-github-profile/profile/assets/org-banner.svg"
require_file "$workspace_root/agentdispatch-github-profile/profile/assets/org-banner.png"
require_file "$workspace_root/agentdispatch-github-profile/profile/assets/org-logo.svg"
require_file "$workspace_root/agentdispatch-github-profile/profile/assets/org-logo.png"
require_file "$workspace_root/agentdispatch-github-profile/profile/assets/repo-social-preview.svg"
require_file "$workspace_root/agentdispatch-github-profile/profile/assets/repo-social-preview.png"
grep -q "assets/org-banner.svg" "$workspace_root/agentdispatch-github-profile/profile/README.md"

for package in "${packages[@]}"; do
  package_dir="$workspace_root/$package"
  require_file "$package_dir/package.json"
  printf '\n===== package: %s =====\n' "$package"
  if [[ "${AGENTDISPATCH_VERIFY_INSTALL:-0}" == "1" || ! -d "$package_dir/node_modules" ]]; then
    if [[ -f "$package_dir/package-lock.json" ]]; then
      run_step npm --prefix "$package_dir" ci
    else
      run_step npm --prefix "$package_dir" install --package-lock=false
    fi
  fi
  run_step npm --prefix "$package_dir" test
  if has_script "$package_dir" typecheck; then
    run_step npm --prefix "$package_dir" run typecheck
  fi
  if has_script "$package_dir" build; then
    run_step npm --prefix "$package_dir" run build
  fi
done

run_step npm --prefix "$workspace_root/agentdispatch-docs" run smoke:packages

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT
config="$tmpdir/agentdispatch.config.json"

run_step node "$workspace_root/agentdispatch-cli/dist/index.js" init \
  --config "$config" \
  --region us-west-2 \
  --runtime-arn arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/my-runtime \
  --protocol a2a

doctor_output="$tmpdir/doctor.json"
printf '\n===== CLI doctor JSON =====\n'
node "$workspace_root/agentdispatch-cli/dist/index.js" doctor --config "$config" --json > "$doctor_output"
node -e "const report = require(process.argv[1]); if (report.ok !== true) throw new Error('doctor did not return ok:true');" "$doctor_output"

mcp_output="$tmpdir/mcp-check.json"
printf '\n===== MCP server check JSON =====\n'
node "$workspace_root/agentdispatch-mcp-server/dist/bin.js" --config "$config" --check > "$mcp_output"
node -e "const report = require(process.argv[1]); if (report.ok !== true) throw new Error('MCP check did not return ok:true');" "$mcp_output"

echo
echo "AgentDispatch local end-to-end verification passed."
echo "Note: live AWS AgentCore dispatch is intentionally not run by this local gate."
