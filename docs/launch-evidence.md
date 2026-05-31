# Launch Evidence

Use this page before a public push, release note, launch post, or demo recording. The goal is to keep every public claim tied to retained evidence instead of memory from a terminal run.

## Local E2E Evidence

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

## Release Status Evidence

After the local report exists, run:

```bash
npm --prefix agentdispatch-docs run status:release
```

The output should include:

```text
Retained local E2E report found: yes
Local launch claim ready from repo state: yes
Live AWS dispatch claim ready: no
```

The first two lines are enough for a local launch claim. The live AWS line must remain `no` until the live AWS verification path writes a successful dispatch report.

For automation or release notes, capture JSON:

```bash
npm --prefix agentdispatch-docs run status:release -- --json > agentdispatch-release-status.json
```

## npm Evidence

Before telling users to install from npm, run both npm checks:

```bash
npm --prefix agentdispatch-docs run status:npm
npm --prefix agentdispatch-docs run smoke:published
```

`status:npm` tells you whether local package versions are synced, pending publication, missing on npm, or unexpectedly behind npm. `smoke:published` installs the currently published packages in a fresh consumer and verifies public imports plus the CLI and MCP binaries.

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
| `smoke:published` succeeds | The currently published npm packages install and expose expected imports and bins. |
| `verify:aws-live` succeeds without `AGENTDISPATCH_LIVE_DISPATCH=1` | AWS live preflight passed for the configured account/runtime. |
| `verify:aws-live` succeeds with `AGENTDISPATCH_LIVE_DISPATCH=1` | Live AWS dispatch worked against a real AgentCore runtime. |

## What To Keep

Keep these artifacts with the launch notes:

- `agentdispatch-local-e2e-report.json`
- `agentdispatch-release-status.json`
- `agentdispatch-live-aws-report.json`, if live preflight was run
- `agentdispatch-live-aws-dispatch-report.json`, if live dispatch was run
- terminal output or CI links for `status:npm` and `smoke:published`

Do not commit account-specific live AWS reports if they contain private runtime names, account IDs, regions, or operational metadata that should stay private.
