# Use Cases

Use these prompts when explaining why AgentDispatch exists. Each prompt is written for a lead agent that already has the AgentDispatch MCP server connected.

The pattern is always the same:

1. Check runtime readiness with `check_cloud_agent_runtime`.
2. Spawn work with `spawn_cloud_agent` only when dispatch is approved.
3. Poll with `get_task_status`.
4. Inspect progress with `get_task_logs`.
5. Retrieve output with `get_task_result`.

Do not claim live AWS dispatch unless a real `spawn_cloud_agent` call or `verify:aws-live` run succeeds with `AGENTDISPATCH_LIVE_DISPATCH=1`.

## Repository Audit

Use when the local agent should keep coding while a background agent reviews the repo.

```text
Use AgentDispatch for a background repository audit.

First call check_cloud_agent_runtime for runtime research-agent. If the runtime is ready and I approve dispatch, call spawn_cloud_agent with this instruction:

Audit this repository for production-readiness gaps. Focus on installability, package boundaries, public docs, tests, security defaults, release claims, and launch-readiness evidence. Return prioritized findings with file paths, severity, and concrete fixes.

Use protocol a2a if available. After spawning, poll get_task_status, inspect get_task_logs, and call get_task_result when complete.
```

Good output:

- prioritized findings
- exact files or packages
- missing tests or gates
- launch-claim risks
- next local fixes

## Release Readiness Check

Use before pushing, publishing, or announcing.

```text
Use AgentDispatch for a release-readiness review.

First check_cloud_agent_runtime for runtime research-agent. If ready and dispatch is approved, spawn a cloud agent with this instruction:

Review the AgentDispatch release path. Check README claims, npm package order, provenance requirements, release runbook, status:release output expectations, local E2E coverage, published package canary, and live AWS claim boundaries. Return a concise release blocker list and a launch-safe claim summary.

Poll status and logs, then retrieve the final result.
```

Good output:

- release blockers
- unverified claims
- package-order problems
- CI/provenance gaps
- launch-safe wording

## Dependency And API Upgrade Review

Use when a lead agent needs a second agent to assess dependency or API changes.

```text
Use AgentDispatch for a dependency and API upgrade review.

After runtime preflight and user approval, spawn a cloud agent with this instruction:

Review the package graph for dependency upgrade risks. Focus on TypeScript, MCP SDK usage, AWS SDK usage, tsup, vitest, better-sqlite3, Node engine requirements, npm package files, and any public API compatibility risk. Return a table of candidate upgrades, breaking-change risk, test impact, and recommended order.

Poll status, collect logs, and retrieve the final result.
```

Good output:

- upgrade candidates
- compatibility risks
- affected packages
- required tests
- safe upgrade order

## Documentation And Launch Copy Review

Use before public posts, README rewrites, or website changes.

```text
Use AgentDispatch for a documentation and launch-copy review.

After runtime preflight and user approval, spawn a cloud agent with this instruction:

Review the AgentDispatch docs, website, profile, examples, launch announcement kit, contributor issue bank, and verification matrix. Find unclear wording, overclaims, missing links, weak first-screen messaging, and copy that may confuse MCP users or cloud-runtime builders. Return exact suggested edits.

Poll status, inspect logs, and retrieve the result.
```

Good output:

- unclear claims
- missing links
- launch-copy improvements
- README/profile first-screen fixes
- examples that need more proof

## Provider Adapter Design

Use when exploring a new provider without changing the MCP tool surface.

```text
Use AgentDispatch for a provider adapter design review.

After runtime preflight and user approval, spawn a cloud agent with this instruction:

Design a provider adapter for <provider/runtime>. Preserve the AgentDispatch routing model: provider + capability + task_type + target.mode. Define account profile fields, target.details, providerRefs, live preflight checks, dispatch behavior, logs, artifacts, cancellation, cleanup, and what stays provider-specific. Do not add provider-specific MCP tools.

Poll status, inspect logs, and retrieve the result.
```

Good output:

- adapter config shape
- provider refs
- preflight checks
- lifecycle mapping
- implementation plan by package

## Worker Framework Prototype

Use when adding a framework-specific cloud-side worker.

```text
Use AgentDispatch for a worker framework prototype review.

After runtime preflight and user approval, spawn a cloud agent with this instruction:

Design a worker integration for <framework>. Keep framework code inside the worker boundary, not the provider adapter. Define request input, runtime environment, streaming/log events, result shape, error mapping, artifacts, and handoff metadata for A2A, MCP, AG-UI, or HTTP when available.

Poll status, inspect logs, and retrieve the result.
```

Good output:

- worker handler shape
- framework-specific dependencies
- log/result/error normalization
- handoff protocol notes
- tests and examples

## Long-Running Research Task

Use when a lead agent should delegate slow research while continuing local work.

```text
Use AgentDispatch for a long-running research task.

After runtime preflight and user approval, spawn a cloud agent with this instruction:

Research <topic>. Produce a concise technical brief with sources, assumptions, open questions, and recommended next actions. Keep raw credentials and private data out of the prompt. Return a result that can be pasted into an issue or design doc.

Poll status, inspect logs, and retrieve the result.
```

Good output:

- source-backed summary
- assumptions
- open questions
- next actions
- issue-ready text

## Claim Boundaries

- Local demo: proves CLI config, doctor, MCP startup, and handoff shape.
- Published npm canary: proves public packages install and expose expected imports and bins.
- Runtime preflight: proves the configured runtime can be checked.
- Live dispatch: requires a successful real cloud task with `AGENTDISPATCH_LIVE_DISPATCH=1`.

Use [Examples](./examples.md), [Verification matrix](./verification-matrix.md), and [Live AWS verification](./live-aws-verification.md) before publishing any public claim.
