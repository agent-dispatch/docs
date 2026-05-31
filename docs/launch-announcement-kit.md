# AgentDispatch Launch Announcement Kit

Use this when announcing AgentDispatch publicly. The strongest message is architectural and specific: one MCP tool for durable cloud subagents, AWS AgentCore first, provider-neutral adapters next.

## One-Line Positioning

```text
AgentDispatch lets any MCP-capable lead agent spawn durable cloud subagents without hardcoding itself to one cloud provider.
```

## Short Description

```text
AgentDispatch is a provider-neutral MCP control plane for long-running agent work. A local lead agent calls `spawn_cloud_agent`, gets back a durable `task_id`, then polls status, logs, results, and cloud-agent handoff metadata for A2A, MCP, AG-UI, or HTTP follow-up.

V1 targets AWS Bedrock AgentCore Runtime. The contract is designed so GCP, Azure, Kubernetes, local runners, and other runtimes can become adapter packages without changing the MCP tool surface.
```

## X / Threads

Single post:

```text
Launching AgentDispatch:

One MCP tool for durable cloud subagents.

spawn_cloud_agent(...)
→ task_id for polling
→ logs/results/artifacts
→ cloud_agent metadata for A2A/MCP/HTTP follow-up

V1: AWS AgentCore
Design: provider-neutral adapters

https://github.com/agent-dispatch
```

Thread:

```text
1/ Local coding agents are good orchestrators. Long-running work needs a different execution plane.

AgentDispatch gives any MCP-capable lead agent one primitive:
spawn_cloud_agent(...)
```

```text
2/ The lead agent gets durable handles back:

- task_id
- status/log/result polling
- cancellation/cleanup
- cloud_agent metadata for A2A, MCP, AG-UI, or HTTP follow-up
```

```text
3/ V1 runs on AWS Bedrock AgentCore Runtime.

The public contract is provider-neutral, so new infrastructure becomes an adapter package, not a new MCP tool every agent has to learn.
```

```text
4/ The goal is simple:

Keep cloud credentials and provider SDK logic outside prompts.
Keep lead-agent tool calls stable.
Let background agent work survive local session restarts.

https://github.com/agent-dispatch
```

## LinkedIn

```text
I am launching AgentDispatch, an open-source provider-neutral MCP control plane for durable cloud-agent work.

Local lead agents such as Claude Code, Codex, OpenClaw, Hermes, or custom orchestrators are strong planners, but long-running work should not be tied to a local context window.

AgentDispatch gives them one stable tool:

spawn_cloud_agent(...)

The response includes a durable task_id for status/log/result polling and cloud_agent metadata for A2A, MCP, AG-UI, or HTTP follow-up when the runtime supports it.

V1 targets AWS Bedrock AgentCore Runtime. The contract is adapter-based from day one so GCP, Azure, Kubernetes, local runners, and workflow runners can plug in later without changing the agent-facing MCP surface.

The local verification gate already tests package installs, typechecks, builds, docs/profile/website validation, package-consumption smoke tests, CLI config generation, CLI doctor, and MCP server checks. Live AWS dispatch remains explicitly opt-in because it depends on real account state and runtime ARNs. Use the verification matrix for exact claim boundaries.

GitHub: https://github.com/agent-dispatch
```

## Hacker News

Title options:

```text
Show HN: AgentDispatch - spawn durable cloud subagents from any MCP-capable agent
```

```text
Show HN: A provider-neutral MCP control plane for cloud subagents
```

Post body:

```text
AgentDispatch lets local MCP-capable agents spawn durable cloud subagents through one stable tool: spawn_cloud_agent.

The lead agent gets a task_id for polling status/logs/results and cloud_agent metadata for A2A/MCP/HTTP follow-up. Provider-specific credentials and SDK behavior stay in adapter packages rather than prompt payloads.

V1 targets AWS Bedrock AgentCore Runtime. The core contract is provider-neutral so GCP, Azure, Kubernetes, local runners, and workflow runners can be added as adapters.

The repo is split into core, MCP server, SDK, CLI, SQLite store, AWS AgentCore adapter, reference worker, adapter template, docs, website, and org profile repos.

Local E2E is covered by a multi-repo verification gate. Live AWS dispatch is separate and opt-in because it depends on real AWS credentials and runtime ARNs.
```

## Reddit / Discord

```text
I am working on AgentDispatch, an OSS MCP control plane for delegating long-running work from local agents to cloud subagents.

The core idea:
- Lead agent calls spawn_cloud_agent
- AgentDispatch routes to a provider adapter
- The lead agent gets task_id + polling tools + cloud-agent handoff metadata
- Provider credentials stay outside tool payloads

AWS AgentCore is the first runtime path, but the adapter contract is intentionally provider-neutral.

I am looking for feedback from:
- MCP users
- cloud runtime builders
- agent framework authors
- people interested in GCP/Azure/Kubernetes/local adapters

Repo: https://github.com/agent-dispatch
```

## Demo Narration

Use this with the [local demo transcript](./local-demo-transcript.md):

```text
First I install the CLI and create an AgentDispatch config.

The config names the runtime and protocol, but the lead agent does not need raw cloud credentials in the prompt.

Then I run doctor, which validates local configuration without touching live AWS state.

Next I run the MCP server check. This proves a lead agent can connect to AgentDispatch.

In a real agent session, the lead agent calls spawn_cloud_agent with the task instruction. It gets back a task_id for polling plus cloud_agent metadata for follow-up.

Live AWS dispatch is opt-in because it depends on account credentials, quotas, runtime ARNs, and possible cost.
```

For a deterministic terminal path before recording, run `npm --prefix agentdispatch-docs run demo:local` from the multi-repo workspace.

For a single menu of no-cloud, npm, prompt-kit, live preflight, and live dispatch demo paths, use the [examples index](./examples.md).

Before publishing the post, run `npm --prefix agentdispatch-docs run status:release` so the launch claim matches the local repo state and live AWS evidence boundary.

For copy-paste prompts that work across Claude Code, Codex, OpenClaw, Hermes, and any MCP-capable agent, use the [lead agent prompt kit](./lead-agent-prompt-kit.md).

For contributor conversion after the announcement, seed the first issues from the [contributor issue bank](./contributor-issue-bank.md).

## What Not To Claim

Avoid these claims unless live evidence exists:

- Do not say live AWS dispatch has been verified unless `verify:aws-live` or an actual live `spawn_cloud_agent` succeeded.
- Do not call every future provider implemented; say the contract is ready for adapter packages.
- Do not imply raw credentials are handled by the agent; account profiles and provider credential chains are outside MCP payloads.
- Do not claim autonomous production maturity; the credible claim is a tested local control plane, stable MCP surface, and adapter boundary.
- Use [Verification matrix](./verification-matrix.md) to keep local and live-cloud claims separate.
- Use [Live AWS verification](./live-aws-verification.md) and keep its JSON evidence report before making any public live-cloud claim.
- Use the [Release runbook](./release-runbook.md) before announcing a new npm release or provenance claim.

## Links

- Organization: <https://github.com/agent-dispatch>
- Website: <https://agent-dispatch.github.io/website>
- MCP server: <https://github.com/agent-dispatch/mcp-server>
- CLI: <https://github.com/agent-dispatch/cli>
- Docs: <https://github.com/agent-dispatch/docs>
- Release runbook: <https://github.com/agent-dispatch/docs/blob/main/docs/release-runbook.md>
- Local demo transcript: <https://github.com/agent-dispatch/docs/blob/main/docs/local-demo-transcript.md>
- Lead agent prompt kit: <https://github.com/agent-dispatch/docs/blob/main/docs/lead-agent-prompt-kit.md>
