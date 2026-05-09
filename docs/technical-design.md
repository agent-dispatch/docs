# AgentDispatch Technical Design

AgentDispatch is a provider-neutral control plane for durable agent task execution. An agent calls a stable MCP contract with provider, account profile, capability, task type, target, and input. AgentDispatch routes to a backend adapter and returns a durable task handle immediately.

## V1 Architecture

- MCP is the first agent-facing surface.
- AWS AgentCore is the first provider backend.
- SQLite and filesystem storage provide local OSS durability.
- Each package lives in a separate repository under `agent-dispatch`.
- `@agentdispatch/core` is the compatibility anchor.

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
