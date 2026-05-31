# Lead Agent Prompt Kit

Use this kit to connect Claude Code, Codex, OpenClaw, Hermes, or any MCP-capable lead agent to AgentDispatch. The goal is copy-paste adoption: configure the MCP server once, then ask the lead agent to preflight, spawn, poll, and retrieve cloud-agent work through the stable AgentDispatch tool surface.

Do not claim live AWS dispatch is verified unless `AGENTDISPATCH_LIVE_DISPATCH=1` or an equivalent live `spawn_cloud_agent` call has succeeded against a real AgentCore runtime.

For task-specific prompts, use the [Use cases](./use-cases.md) playbook.

## MCP Setup

Create an AgentDispatch config first:

```bash
npm install -g @agent-dispatch/cli

agentdispatch init \
  --region us-west-2 \
  --runtime-arn arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/research-agent \
  --protocol a2a

agentdispatch doctor --config ./agentdispatch.config.json
```

Then add the MCP server to the lead agent:

```json
{
  "mcpServers": {
    "agentdispatch": {
      "command": "npx",
      "args": [
        "-y",
        "@agent-dispatch/mcp-server",
        "--config",
        "/absolute/path/agentdispatch.config.json"
      ]
    }
  }
}
```

For local verification without live AWS credentials, run:

```bash
npx -y @agent-dispatch/mcp-server \
  --config /absolute/path/agentdispatch.config.json \
  --check
```

## Safe Local Demo Prompt

Use this when you want the lead agent to demonstrate AgentDispatch without claiming live cloud dispatch:

```text
Use the AgentDispatch MCP server to inspect the available tools and explain how you would spawn background work.

Do not claim live AWS dispatch succeeded unless a real AgentCore runtime call succeeds. For this local demo, show the planned spawn_cloud_agent payload, explain the task_id polling flow, and identify which steps require live AWS credentials.
```

Expected agent behavior:

- Mention `spawn_cloud_agent` as the main dispatch primitive.
- Explain that `get_task_status`, `get_task_logs`, and `get_task_result` are used after dispatch.
- Keep live AWS claims separate from local MCP and CLI checks.

## Runtime Preflight Prompt

Use this before any real cloud dispatch:

```text
Use AgentDispatch to run a runtime readiness check for the configured cloud agent before spawning work.

Call check_cloud_agent_runtime for the default or named runtime. Summarize provider, region, runtime reachability, credential readiness, protocol support, and any blocking issue. Do not call spawn_cloud_agent until the preflight result is ready and the user confirms live dispatch.
```

The lead agent should call `check_cloud_agent_runtime` and report whether the runtime is ready. Preflight is useful evidence, but it is not proof that live dispatch completed.

## Background Repo Audit Prompt

Use this when live dispatch is approved and a real runtime is configured:

```text
Use AgentDispatch to spawn a cloud agent for a background repository audit.

Instruction for the cloud agent:
Audit this repository for production-readiness gaps. Focus on installability, package boundaries, tests, public docs, security defaults, and launch-readiness claims. Return prioritized findings with file paths and concrete fixes.

Use protocol a2a if available. After spawning, keep working locally while the cloud task runs. Poll status, collect logs, retrieve the final result, and summarize the result with any follow-up actions.
```

The expected tool sequence is:

```text
check_cloud_agent_runtime
spawn_cloud_agent
get_task_status
get_task_logs
get_task_result
```

## Poll And Result Prompt

Use this after a task has been spawned:

```text
Use AgentDispatch to continue the existing cloud task.

Task id: <task_id>

Poll get_task_status until the task reaches a terminal state or needs user action. Retrieve recent logs with get_task_logs. If complete, call get_task_result and summarize the output, artifacts, provider refs, and cloud_agent handoff metadata.
```

## A2A Follow-Up Prompt

Use this when the spawned cloud agent returns A2A handoff metadata:

```text
Use the AgentDispatch cloud_agent metadata from the completed or running task to continue with the remote agent through A2A.

Send this follow-up message:
<message>

Preserve the task_id and provider refs in your summary. If A2A metadata is missing, explain which handoff protocol is available instead.
```

## Client Notes

Claude Code:

```text
Install the AgentDispatch MCP server with the npx config above. Ask Claude Code to preflight with check_cloud_agent_runtime, then spawn with spawn_cloud_agent only after live dispatch is approved.
```

Codex:

```text
Use the same MCP server config. Ask Codex to keep local edits moving while AgentDispatch handles a background audit, package smoke, or documentation review task.
```

OpenClaw:

```text
Register AgentDispatch as an MCP server for delegation. Treat spawn_cloud_agent as the handoff boundary and task_id polling as durable state.
```

Hermes:

```text
Use AgentDispatch for long-running cloud work and preserve returned cloud_agent metadata for A2A, MCP, AG-UI, or HTTP follow-up.
```

Any MCP-capable agent:

```text
Prefer spawn_cloud_agent for normal work. Use check_cloud_agent_runtime before live dispatch. Use get_task_status, get_task_logs, and get_task_result after dispatch. Do not put raw cloud credentials into prompts.
```

## Claim Boundary

Local checks prove package wiring, CLI config shape, MCP startup, docs/profile/website validation, and smoke behavior. Live AWS preflight proves the configured account and runtime can be checked. Only `AGENTDISPATCH_LIVE_DISPATCH=1` or an equivalent successful live `spawn_cloud_agent` proves live cloud dispatch end to end.
