# Release Status

Use this command before a public push, npm release, launch post, or demo recording:

```bash
npm --prefix agentdispatch-docs run status:release
```

It prints a local release dashboard for the multi-repo workspace:

- whether each repo exists and is clean
- package names and versions
- commits ahead of `origin/main`
- launch gate commands to run
- whether a retained local E2E JSON evidence report exists
- whether retained npm, security, and published-canary evidence reports exist
- whether retained npm publish dry-run evidence exists
- whether a live AWS verification report exists
- whether the live AWS report proves preflight only or real dispatch

Use this separate networked command to compare local public package versions against npm:

```bash
npm --prefix agentdispatch-docs run status:npm
```

`status:npm` is not part of the default local E2E gate because it depends on npm registry availability.
To retain the npm version evidence for `status:release`, write a report:

```bash
AGENTDISPATCH_NPM_STATUS_REPORT=./agentdispatch-npm-status-report.json \
npm --prefix agentdispatch-docs run status:npm
```

Use this separate networked command to verify public package tarball metadata before publish:

```bash
npm --prefix agentdispatch-docs run status:publish
```

`status:publish` runs `npm publish --dry-run --json` from each public package directory. This matters because running publish dry-runs through `npm --prefix` can package the wrong parent workspace.
To retain the publish dry-run evidence for `status:release`, write a report:

```bash
AGENTDISPATCH_PUBLISH_DRY_RUN_REPORT=./agentdispatch-publish-dry-run-report.json \
npm --prefix agentdispatch-docs run status:publish -- --strict
```

Use this separate networked command to audit high and critical npm vulnerabilities across the workspace:

```bash
npm --prefix agentdispatch-docs run status:security
```

Use `--strict` before release automation when high or critical findings should fail the run:

```bash
npm --prefix agentdispatch-docs run status:security -- --strict
```

`status:security` is not part of the default local E2E gate because it depends on npm registry availability.
To retain the audit evidence for `status:release`, write a report:

```bash
AGENTDISPATCH_SECURITY_REPORT=./agentdispatch-security-audit-report.json \
npm --prefix agentdispatch-docs run status:security -- --strict
```

For automation or release notes, use JSON:

```bash
npm --prefix agentdispatch-docs run status:release -- --json
```

For a stricter local check that exits non-zero when repos are missing or dirty:

```bash
npm --prefix agentdispatch-docs run status:release -- --strict
```

## What This Proves

`status:release` proves the local workspace shape, git cleanliness, package versions, unpushed commit counts, and live AWS evidence boundary at the moment it runs.

It does not run tests, builds, package smoke tests, public npm canaries, or live AWS calls. Pair it with the release gates:

```bash
AGENTDISPATCH_VERIFY_INSTALL=1 npm --prefix agentdispatch-docs run verify:local-e2e
AGENTDISPATCH_VERIFY_INSTALL=1 AGENTDISPATCH_LOCAL_E2E_REPORT=./agentdispatch-local-e2e-report.json npm --prefix agentdispatch-docs run verify:local-e2e
AGENTDISPATCH_NPM_STATUS_REPORT=./agentdispatch-npm-status-report.json npm --prefix agentdispatch-docs run status:npm
AGENTDISPATCH_PUBLISH_DRY_RUN_REPORT=./agentdispatch-publish-dry-run-report.json npm --prefix agentdispatch-docs run status:publish -- --strict
AGENTDISPATCH_SECURITY_REPORT=./agentdispatch-security-audit-report.json npm --prefix agentdispatch-docs run status:security -- --strict
AGENTDISPATCH_PUBLISHED_SMOKE_REPORT=./agentdispatch-published-smoke-report.json npm --prefix agentdispatch-docs run smoke:published
```

Or run the complete no-cloud launch gate and evidence capture with:

```bash
AGENTDISPATCH_LAUNCH_EVIDENCE_DIR=./agentdispatch-launch-evidence \
npm --prefix agentdispatch-docs run verify:launch
```

To render the retained evidence as Markdown for release notes or review:

```bash
AGENTDISPATCH_LAUNCH_EVIDENCE_DIR=./agentdispatch-launch-evidence \
npm --prefix agentdispatch-docs run status:launch-summary
```

For live AWS preflight:

```bash
AGENTDISPATCH_CONFIG=/absolute/path/agentdispatch.config.json \
AGENTDISPATCH_LIVE_REPORT=./agentdispatch-live-aws-report.json \
npm --prefix agentdispatch-docs run verify:aws-live
```

For a real live cloud-dispatch claim:

```bash
AGENTDISPATCH_CONFIG=/absolute/path/agentdispatch.config.json \
AGENTDISPATCH_LIVE_DISPATCH=1 \
AGENTDISPATCH_LIVE_REPORT=./agentdispatch-live-aws-dispatch-report.json \
npm --prefix agentdispatch-docs run verify:aws-live
```

Do not claim live AWS dispatch unless `status:release` reports `Live AWS dispatch claim ready: yes`, or you have separately retained a successful `verify:aws-live` dispatch report whose claim says:

```text
Live AWS dispatch verified against a real AgentCore runtime.
```

## Example Output

```text
AgentDispatch release status
workspace: /Users/vamgan/Projects/agentdispatch
generated: 2026-05-30T00:00:00.000Z

Repositories
- agentdispatch-core: clean, ahead origin/main by 2, @agent-dispatch/core@0.1.2
- agentdispatch-docs: clean, ahead origin/main by 18, @agent-dispatch/docs@0.1.0
- agentdispatch-website: clean, ahead origin/main by 12, @agent-dispatch/website@0.1.0

Gates
- local-e2e: manual
  AGENTDISPATCH_VERIFY_INSTALL=1 npm --prefix agentdispatch-docs run verify:local-e2e
- published-canary: manual
  npm --prefix agentdispatch-docs run smoke:published
- npm-version-drift: manual
  npm --prefix agentdispatch-docs run status:npm
- publish-dry-run: manual
  npm --prefix agentdispatch-docs run status:publish
- security-audit: manual
  npm --prefix agentdispatch-docs run status:security
- live-aws: missing
  AGENTDISPATCH_CONFIG=/absolute/path/agentdispatch.config.json AGENTDISPATCH_LIVE_REPORT=./agentdispatch-live-aws-report.json npm --prefix agentdispatch-docs run verify:aws-live

Claim boundary
- Local launch claim ready from repo state: yes
- Retained local E2E report found: no
- Retained published canary report found: no
- Retained npm version report found: no
- Retained publish dry-run report found: no
- Retained security audit report found: no
- Repos with unpushed commits: 11
- Live AWS preflight report found: no
- Live AWS dispatch claim ready: no
- Do not claim live AWS dispatch until verify:aws-live succeeds with AGENTDISPATCH_LIVE_DISPATCH=1.
```
