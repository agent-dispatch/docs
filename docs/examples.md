# Examples

Use this page to choose the right AgentDispatch demo path. The examples are ordered from no-cloud proof to real AWS dispatch evidence.

## Paths

| Path | Needs cloud credentials | Proves |
| --- | --- | --- |
| Local no-cloud demo | No | CLI config, `doctor`, MCP server startup, and the `spawn_cloud_agent` handoff shape. |
| Published npm canary | No | Public package install, imports, CLI binary, and MCP binary. |
| Use-case playbook | No | Copyable task prompts for common background-agent workflows. |
| Lead-agent prompt kit | No | Copy-paste prompts for Claude Code, Codex, OpenClaw, Hermes, and MCP-capable agents. |
| Live AWS preflight | Yes | AWS credentials, region, runtime reachability, and adapter-owned preflight. |
| Live AWS dispatch | Yes | A real cloud task submitted to an AgentCore runtime. |

## Local No-Cloud Demo

Run this from the multi-repo workspace:

```bash
npm --prefix agentdispatch-docs run demo:local
```

This creates a temporary config, runs `agentdispatch doctor`, starts the MCP server with `--check`, and prints a planned `spawn_cloud_agent` payload.

Use this when recording a launch demo without live AWS credentials. Pair it with the [local demo transcript](./local-demo-transcript.md).

To retain demo artifacts for a launch post or PR:

```bash
npm --prefix agentdispatch-docs run demo:record
```

That writes a sanitized transcript, raw command output, and JSON report. Use `AGENTDISPATCH_DEMO_RECORD_DIR=/path/to/output` when you want stable artifact paths.

Claim boundary:

- You can say local CLI config, local doctor, MCP startup, and handoff shape work.
- You cannot say live AWS AgentCore dispatch has been verified.

## Published Npm Canary

Run this from the docs repo:

```bash
npm run smoke:published
```

This installs the public `@agent-dispatch/*` packages into a fresh consumer and verifies public imports plus the published `agentdispatch` and `agentdispatch-mcp` binaries.

Use this before posting install commands publicly.

Claim boundary:

- You can say the currently published npm packages install and expose the expected bins.
- You cannot use this as proof that unpublished local changes are available on npm.

## Lead-Agent Prompt Kit

Use the [lead agent prompt kit](./lead-agent-prompt-kit.md) when testing AgentDispatch through a real MCP-capable lead agent.

For concrete tasks to delegate, use the [use-case playbook](./use-cases.md).

Recommended first prompt:

```text
Use the AgentDispatch MCP tools. First call check_cloud_agent_runtime for runtime research-agent. If it is ready, call spawn_cloud_agent with a short repository-audit instruction, then poll get_task_status, get_task_logs, and get_task_result.
```

Use this when validating the human workflow and demo narration.

Claim boundary:

- You can say the prompts describe the intended MCP workflow.
- You cannot say an external lead-agent client completed a live dispatch unless you actually ran it and retained evidence.

## Live AWS Preflight

Run this only with real AWS credentials and a real AgentCore runtime ARN:

```bash
AGENTDISPATCH_CONFIG=/absolute/path/agentdispatch.config.json \
AGENTDISPATCH_RUNTIME=research-agent \
AGENTDISPATCH_LIVE_REPORT=./agentdispatch-live-aws-report.json \
npm --prefix agentdispatch-docs run verify:aws-live
```

This performs adapter-owned AWS checks without submitting a task.

Claim boundary:

- You can say live AWS preflight passed if the command succeeds and writes the report.
- You cannot say live AWS dispatch has been verified until the dispatch path succeeds.

## Live AWS Dispatch

Run this only when a real cloud task is allowed:

```bash
AGENTDISPATCH_CONFIG=/absolute/path/agentdispatch.config.json \
AGENTDISPATCH_RUNTIME=research-agent \
AGENTDISPATCH_LIVE_DISPATCH=1 \
AGENTDISPATCH_LIVE_REPORT=./agentdispatch-live-aws-dispatch-report.json \
npm --prefix agentdispatch-docs run verify:aws-live
```

This submits a real task through the configured AgentCore runtime and writes a JSON evidence report.

Claim boundary:

- You can say live AWS dispatch was verified only when the report claim says `Live AWS dispatch verified against a real AgentCore runtime.`
- Keep the report with release evidence before making public live-cloud claims.

## Release Status

Before a push, release, launch post, or demo recording, run:

```bash
npm --prefix agentdispatch-docs run status:release
```

This summarizes repo cleanliness, commits ahead of `origin/main`, launch gates, and live AWS evidence state.

## Related Docs

- [Verification matrix](./verification-matrix.md)
- [Live AWS verification](./live-aws-verification.md)
- [Use cases](./use-cases.md)
- [Release status](./release-status.md)
- [Release runbook](./release-runbook.md)
- [Contributor issue bank](./contributor-issue-bank.md)
