# AgentDispatch Technical Design

AgentDispatch is a provider-neutral control plane for durable agent task execution. An agent calls a stable MCP contract with provider, account profile, capability, task type, target, and input. AgentDispatch routes to a backend adapter and returns a durable task handle immediately.

## V1 Architecture

- MCP is the first agent-facing surface.
- AWS AgentCore is the first provider backend.
- SQLite and filesystem storage provide local OSS durability.
- Each package lives in a separate repository under `agent-dispatch`.
- `@agent-dispatch/core` is the compatibility anchor.
- Agent framework adapters are worker-side plugins, separate from cloud backend adapters.

## Provider-Neutral Routing

Dispatch routing key:

```text
provider + capability + task_type + target.mode
```

V1 supports:

- `provider: aws`
- `capability: agent-runtime`
- `task_type: agent.run | command.run`
- `target.mode: session | runtime`

Future providers add adapters without changing MCP tools.

## Worker Framework Adapters

AgentDispatch has two extension axes:

- **Cloud backend adapters** decide where and how a task runs: AWS AgentCore, GCP Cloud Run, Azure Container Apps, Kubernetes, or local.
- **Agent framework adapters** decide what runs inside the worker: Strands, LangChain, LangGraph, CrewAI, OpenAI Agents, or a custom agent loop.

Framework selection is data-plane configuration. It should not become part of core provider routing unless dispatch scheduling truly needs it. A worker can select a framework from `input.framework`, top-level `framework`, or worker environment defaults while the MCP contract remains `dispatch_task`.

The reference AgentCore worker supports command-backed adapters. A runtime image can set `AGENTDISPATCH_FRAMEWORK_COMMAND_OPENCLAW`, `AGENTDISPATCH_FRAMEWORK_COMMAND_HERMES`, or `AGENTDISPATCH_FRAMEWORK_COMMANDS` to bind framework names to CLIs. The worker sends the normalized task envelope to the framework command over `stdin`, then maps plain-text or structured JSON output back into provider-neutral events, results, and artifacts.

Example:

```json
{
  "provider": "aws",
  "account_profile": "dev-aws",
  "capability": "agent-runtime",
  "task_type": "agent.run",
  "target": {
    "mode": "session"
  },
  "input": {
    "instruction": "Run a deep research task",
    "framework": "strands",
    "context": {}
  }
}
```

## Stable MCP Tools

- `list_providers`
- `list_capabilities`
- `list_account_profiles`
- `dispatch_task`
- `get_task_status`
- `get_task_logs`
- `get_task_result`
- `cancel_task`

Raw cloud credentials are never passed through MCP. Tool calls reference named account profiles configured by the user.
