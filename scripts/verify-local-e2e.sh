#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
docs_root="$(cd "$script_dir/.." && pwd)"
workspace_root="${AGENTDISPATCH_WORKSPACE_ROOT:-$(cd "$docs_root/.." && pwd)}"
cleanup_dirs=()

cleanup() {
  for dir in "${cleanup_dirs[@]}"; do
    rm -rf "$dir"
  done
}
trap cleanup EXIT

pack_dir="$(mktemp -d)"
cleanup_dirs+=("$pack_dir")

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

package_name() {
  local package_dir="$1"
  node -e "console.log(require('${package_dir}/package.json').name)"
}

is_private_package() {
  local package_dir="$1"
  node -e "process.exit(require('${package_dir}/package.json').private === true ? 0 : 1)"
}

local_agentdispatch_deps() {
  local package_dir="$1"
  node -e "
    const pkg = require('${package_dir}/package.json');
    const deps = new Set();
    for (const section of ['dependencies', 'devDependencies', 'peerDependencies']) {
      for (const name of Object.keys(pkg[section] ?? {})) {
        if (name.startsWith('@agent-dispatch/')) deps.add(name);
      }
    }
    for (const dep of deps) console.log(dep);
  "
}

tarball_prefix() {
  local name="$1"
  name="${name#@}"
  echo "${name//\//-}"
}

install_local_agentdispatch_deps() {
  local package_dir="$1"
  local tarballs=()
  local dep prefix pattern
  while IFS= read -r dep; do
    [[ -n "$dep" ]] || continue
    prefix="$(tarball_prefix "$dep")"
    pattern="$pack_dir/$prefix"-*.tgz
    if compgen -G "$pattern" > /dev/null; then
      tarballs+=( $pattern )
    fi
  done < <(local_agentdispatch_deps "$package_dir")

  if [[ "${#tarballs[@]}" -gt 0 ]]; then
    run_step npm --prefix "$package_dir" install --no-save --package-lock=false "${tarballs[@]}"
  fi
}

pack_local_package() {
  local package_dir="$1"
  local name prefix
  name="$(package_name "$package_dir")"
  if [[ "$name" == @agent-dispatch/* ]] && ! is_private_package "$package_dir"; then
    prefix="$(tarball_prefix "$name")"
    rm -f "$pack_dir/$prefix"-*.tgz
    printf '\n===== npm pack: %s =====\n' "$package_dir"
    (cd "$package_dir" && npm pack --pack-destination "$pack_dir")
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
  install_local_agentdispatch_deps "$package_dir"
  run_step npm --prefix "$package_dir" test
  if has_script "$package_dir" typecheck; then
    run_step npm --prefix "$package_dir" run typecheck
  fi
  if has_script "$package_dir" build; then
    run_step npm --prefix "$package_dir" run build
    pack_local_package "$package_dir"
  fi
done

run_step npm --prefix "$workspace_root/agentdispatch-docs" run smoke:packages
run_step npm --prefix "$workspace_root/agentdispatch-docs" run demo:local
run_step npm --prefix "$workspace_root/agentdispatch-docs" run status:release

tmpdir="$(mktemp -d)"
cleanup_dirs+=("$tmpdir")
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

if [[ -n "${AGENTDISPATCH_LOCAL_E2E_REPORT:-}" ]]; then
  node - "$AGENTDISPATCH_LOCAL_E2E_REPORT" "$workspace_root" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const [reportPath, workspaceRoot] = process.argv.slice(2);
const packages = [
  "agentdispatch-core",
  "agentdispatch-store-sqlite",
  "agentdispatch-adapter-aws-agentcore",
  "agentdispatch-worker-agentcore",
  "agentdispatch-sdk-js",
  "agentdispatch-mcp-server",
  "agentdispatch-cli",
  "agentdispatch-adapter-template",
  "agentdispatch-docs",
  "agentdispatch-github-profile",
  "agentdispatch-website"
].map((repo) => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(workspaceRoot, repo, "package.json"), "utf8"));
  return {
    repo,
    packageName: packageJson.name,
    version: packageJson.version,
    private: packageJson.private === true
  };
});

const report = {
  generatedAt: new Date().toISOString(),
  workspaceRoot,
  ok: true,
  claim: "Local AgentDispatch end-to-end verification passed without live AWS dispatch.",
  command: "AGENTDISPATCH_VERIFY_INSTALL=1 AGENTDISPATCH_LOCAL_E2E_REPORT=<path> npm --prefix agentdispatch-docs run verify:local-e2e",
  coverage: [
    "package installs",
    "unit tests",
    "typechecks",
    "builds",
    "local package tarball consumption",
    "CLI init",
    "CLI doctor",
    "MCP server check",
    "docs validation",
    "GitHub profile asset validation",
    "website validation and build",
    "local demo"
  ],
  doesNotProve: [
    "live AWS AgentCore preflight",
    "live AWS AgentCore dispatch",
    "published npm versions for unpublished local changes"
  ],
  packages
};

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
NODE
  echo "Wrote local E2E evidence report: $AGENTDISPATCH_LOCAL_E2E_REPORT"
fi

echo
echo "AgentDispatch local end-to-end verification passed."
echo "Note: live AWS AgentCore dispatch is intentionally not run by this local gate."
