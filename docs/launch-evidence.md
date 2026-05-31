# Launch Evidence

Use this page before a public push, release note, launch post, or demo recording. The goal is to keep every public claim tied to retained evidence instead of memory from a terminal run.

## Local E2E Evidence

For the complete no-cloud launch gate, run:

```bash
AGENTDISPATCH_LAUNCH_EVIDENCE_DIR=./agentdispatch-launch-evidence \
npm --prefix agentdispatch-docs run verify:launch
```

That runs local E2E, npm version drift, publish dry-run, security audit, published package canary, and release-status capture, then writes all JSON reports into the evidence directory.

Run the local gate with an evidence report path:

```bash
AGENTDISPATCH_VERIFY_INSTALL=1 \
AGENTDISPATCH_LOCAL_E2E_REPORT=./agentdispatch-local-e2e-report.json \
npm --prefix agentdispatch-docs run verify:local-e2e
```

That writes a JSON report with:

- `ok: true`
- package names and local versions
- the local verification claim
- the list of covered checks
- the list of things the local gate does not prove

The local evidence report proves the current workspace passed package installs, unit tests, typechecks, builds, local tarball consumption, CLI init, CLI doctor, MCP server check, docs validation, profile validation, website validation/build, and the no-cloud local demo.

It does not prove live AWS AgentCore preflight, live AWS AgentCore dispatch, or that unpublished local versions are already available on npm.

## Demo Recording Evidence

For no-cloud demo narration or launch posts, record the local demo:

```bash
AGENTDISPATCH_DEMO_RECORD_DIR=./agentdispatch-local-demo-recording \
npm --prefix agentdispatch-docs run demo:record
```

That writes:

- `local-demo.transcript.txt` with temporary paths sanitized
- `local-demo.raw.txt` with exact command output
- `local-demo.report.json` with the demo claim boundary and artifact paths

Use the transcript for recording a short terminal demo or for PR review. Do not use it as proof of live AWS dispatch.

## CI Evidence

The docs repo `Local E2E` workflow runs the local gate, npm version drift check, security audit, published package canary, and release-status capture. Successful runs upload an `agentdispatch-launch-evidence` artifact containing:

- `agentdispatch-local-e2e-report.json`
- `agentdispatch-npm-status-report.json`
- `agentdispatch-publish-dry-run-report.json`
- `agentdispatch-security-audit-report.json`
- `agentdispatch-published-smoke-report.json`
- `agentdispatch-release-status.json`
- `agentdispatch-launch-summary.md`

Use this artifact when launch notes need a reproducible CI link instead of local terminal output. The Markdown summary is the easiest file to attach to a release note or launch checklist review.

## Release Status Evidence

After the local report exists, run:

```bash
npm --prefix agentdispatch-docs run status:release
```

The output should include:

```text
Retained local E2E report found: yes
Retained published canary report found: yes
Retained npm version report found: yes
Retained publish dry-run report found: yes
Retained security audit report found: yes
Local launch claim ready from repo state: yes
Live AWS dispatch claim ready: no
```

The retained local E2E line and clean repo-state line are enough for a local launch claim. The npm and security lines support install and dependency-health claims. The live AWS line must remain `no` until the live AWS verification path writes a successful dispatch report.

For automation or release notes, capture JSON:

```bash
npm --prefix agentdispatch-docs run status:release -- --json > agentdispatch-release-status.json
```

To render a human-readable summary from a retained evidence directory:

```bash
AGENTDISPATCH_LAUNCH_EVIDENCE_DIR=./agentdispatch-launch-evidence \
npm --prefix agentdispatch-docs run status:launch-summary
```

## npm Evidence

Before telling users to install from npm, run both npm checks:

```bash
AGENTDISPATCH_NPM_STATUS_REPORT=./agentdispatch-npm-status-report.json \
npm --prefix agentdispatch-docs run status:npm

AGENTDISPATCH_PUBLISH_DRY_RUN_REPORT=./agentdispatch-publish-dry-run-report.json \
npm --prefix agentdispatch-docs run status:publish -- --strict

AGENTDISPATCH_SECURITY_REPORT=./agentdispatch-security-audit-report.json \
npm --prefix agentdispatch-docs run status:security -- --strict

AGENTDISPATCH_PUBLISHED_SMOKE_REPORT=./agentdispatch-published-smoke-report.json \
npm --prefix agentdispatch-docs run smoke:published
```

`status:npm` tells you whether local package versions are synced, pending publication, missing on npm, or unexpectedly behind npm. `status:publish` runs `npm publish --dry-run --json` from each public package directory and verifies the tarball metadata is for the intended scoped package instead of a parent workspace package. `smoke:published` installs the currently published packages in a fresh consumer and verifies public imports plus the CLI and MCP binaries.
`status:security` runs `npm audit` across the workspace and reports high or critical findings separately from the default local E2E gate.

If `status:npm` reports `pending-publish`, do not imply the unpublished local changes are already available through npm.

## Live AWS Evidence

For live preflight evidence:

```bash
AGENTDISPATCH_CONFIG=/absolute/path/agentdispatch.config.json \
AGENTDISPATCH_LIVE_REPORT=./agentdispatch-live-aws-report.json \
npm --prefix agentdispatch-docs run verify:aws-live
```

For live dispatch evidence:

```bash
AGENTDISPATCH_CONFIG=/absolute/path/agentdispatch.config.json \
AGENTDISPATCH_LIVE_DISPATCH=1 \
AGENTDISPATCH_LIVE_REPORT=./agentdispatch-live-aws-dispatch-report.json \
npm --prefix agentdispatch-docs run verify:aws-live
```

Only the second command can support this claim:

```text
Live AWS dispatch verified against a real AgentCore runtime.
```

## Launch-Safe Claim Table

| Evidence | Safe claim |
| --- | --- |
| `agentdispatch-local-e2e-report.json` has `ok: true` | The current workspace passes the local multi-repo AgentDispatch gate. |
| `status:release` says `Local launch claim ready from repo state: yes` | The checked-out repos are present and clean. |
| `status:npm` has no `local-behind-npm` or `check-failed` entries | Local package versions are not older than npm and registry lookup succeeded. |
| `status:security` has no high, critical, or check-failed entries | The workspace has no high or critical npm audit findings at the time of the registry check. |
| `smoke:published` succeeds | The currently published npm packages install and expose expected imports and bins. |
| `verify:aws-live` succeeds without `AGENTDISPATCH_LIVE_DISPATCH=1` | AWS live preflight passed for the configured account/runtime. |
| `verify:aws-live` succeeds with `AGENTDISPATCH_LIVE_DISPATCH=1` | Live AWS dispatch worked against a real AgentCore runtime. |

## What To Keep

Keep these artifacts with the launch notes:

- `agentdispatch-local-e2e-report.json`
- `agentdispatch-release-status.json`
- `agentdispatch-npm-status-report.json`
- `agentdispatch-security-audit-report.json`
- `agentdispatch-published-smoke-report.json`
- `agentdispatch-launch-summary.md`
- `agentdispatch-live-aws-report.json`, if live preflight was run
- `agentdispatch-live-aws-dispatch-report.json`, if live dispatch was run

Do not commit account-specific live AWS reports if they contain private runtime names, account IDs, regions, or operational metadata that should stay private.
