# Verification Matrix

This matrix is the public proof boundary for AgentDispatch. Use it before launch posts, release notes, or README claims.

Public status badges:

- [Docs CI](https://github.com/agent-dispatch/docs/actions/workflows/ci.yml)
- [Local E2E](https://github.com/agent-dispatch/docs/actions/workflows/local-e2e.yml)
- [Live AWS Verification](https://github.com/agent-dispatch/docs/actions/workflows/live-aws-verification.yml)

Use [Examples](./examples.md) to choose the right no-cloud, published npm, prompt-kit, live preflight, or live dispatch path before making a public claim.
Use [Launch evidence](./launch-evidence.md) to retain JSON reports and command outputs for the claims you publish.

## Current Local Proof

Run from the parent multi-repo workspace:

```bash
AGENTDISPATCH_VERIFY_INSTALL=1 npm --prefix agentdispatch-docs run verify:local-e2e
```

For a quick release dashboard before or after the full gate, run:

```bash
npm --prefix agentdispatch-docs run status:release
```

That status command reports local repo cleanliness, commits ahead of `origin/main`, launch gate commands, and whether a live AWS verification report exists. It does not replace `verify:local-e2e`, `smoke:published`, or `verify:aws-live`.

That gate verifies:

| Surface | Evidence |
| --- | --- |
| Package installs | Runs `npm ci` or install for every repo in the workspace. |
| Unit behavior | Runs `npm test` for core, store, AWS adapter, worker, SDK, MCP server, CLI, adapter template, docs, profile, and website. |
| Type safety | Runs `npm run typecheck` for packages that expose a typecheck script. |
| Build output | Runs `npm run build` for packages that expose a build script. |
| Package consumption | Packs local publishable packages, installs those tarballs into downstream packages, then runs the package-consumption smoke test. |
| Published install canary | `smoke:published` installs current npm packages in a fresh consumer and verifies public imports plus CLI/MCP bins. |
| Publish dry-run | `status:publish` runs `npm publish --dry-run --json` from each public package directory and verifies the intended scoped package metadata. |
| Security audit | `status:security` runs `npm audit` across every package and reports high or critical findings. |
| CLI bootstrap | Runs the built CLI `init` command and validates `doctor --json` returns `ok: true`. |
| MCP startup | Runs the built MCP server with `--check` and validates the JSON report returns `ok: true`. |
| Launch assets | Checks GitHub profile artwork, social preview dimensions, website validation, profile validation, and docs launch checks. |
| Release readiness | Checks package metadata, CI workflows, provenance publish workflows, and per-package release docs. |
| Release status | `status:release` summarizes repo cleanliness, unpushed commits, launch gates, and live AWS evidence state. |
| Retained local evidence | `AGENTDISPATCH_LOCAL_E2E_REPORT=./agentdispatch-local-e2e-report.json` writes a JSON record for launch notes. |
| Retained CI evidence | The docs `Local E2E` workflow uploads `agentdispatch-launch-evidence` with local E2E, npm drift, publish dry-run, security audit, published canary, and release-status JSON reports. |

## Live Cloud Proof

Live AWS AgentCore dispatch is intentionally outside the local gate. It requires real account credentials, a real AgentCore runtime ARN, account quotas, permissions, and possible AWS cost.

Run live preflight with:

```bash
AGENTDISPATCH_CONFIG=/absolute/path/agentdispatch.config.json \
AGENTDISPATCH_RUNTIME=research-agent \
AGENTDISPATCH_LIVE_REPORT=./agentdispatch-live-aws-report.json \
npm --prefix agentdispatch-docs run verify:aws-live
```

Run live dispatch with:

```bash
AGENTDISPATCH_CONFIG=/absolute/path/agentdispatch.config.json \
AGENTDISPATCH_RUNTIME=research-agent \
AGENTDISPATCH_LIVE_DISPATCH=1 \
AGENTDISPATCH_LIVE_REPORT=./agentdispatch-live-aws-dispatch-report.json \
npm --prefix agentdispatch-docs run verify:aws-live
```

The generated dispatch report must contain this claim before a public live-cloud claim is made:

```text
Live AWS dispatch verified against a real AgentCore runtime.
```

Maintainers can also run the docs repo `Live AWS Verification` GitHub Actions workflow. It uses configured repository secrets, runs `verify:aws-live`, and uploads `agentdispatch-live-aws-report.json` as the release evidence artifact. For no-cloud release evidence, run the docs repo `Local E2E` workflow and download the uploaded `agentdispatch-launch-evidence` artifact.

## Claim Rules

- It is accurate to say the local multi-repo package graph, CLI, MCP server, docs, website, and org assets pass the local E2E gate after `verify:local-e2e` succeeds.
- It is accurate to say AWS live preflight passed only after `verify:aws-live` succeeds and writes the JSON evidence report.
- It is accurate to say live AWS dispatch was verified only after the `AGENTDISPATCH_LIVE_DISPATCH=1` run succeeds against a real AgentCore runtime.
- Do not use local E2E evidence as proof that live AWS dispatch works.
- Do not publish live-cloud claims without retaining the generated JSON evidence report.
