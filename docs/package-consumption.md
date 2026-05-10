# Package Consumption Guide

AgentDispatch is split into separate repositories and npm packages under the `@agentdispatch` scope. `@agentdispatch/core` is the compatibility anchor: stores, adapters, SDKs, the MCP server, and the CLI all align to the same core major version.

## Install Packages

For an MCP-first local runtime using AWS AgentCore and SQLite:

```bash
npm install @agentdispatch/mcp-server @agentdispatch/store-sqlite @agentdispatch/adapter-aws-agentcore
```

For command-line usage:

```bash
npm install -g @agentdispatch/cli
```

For SDK usage inside an application:

```bash
npm install @agentdispatch/sdk @agentdispatch/core
```

For custom in-process runtimes, install the store and adapter packages explicitly:

```bash
npm install @agentdispatch/core @agentdispatch/sdk @agentdispatch/store-sqlite @agentdispatch/adapter-aws-agentcore
```

For building the reference AgentCore worker image:

```bash
git clone https://github.com/agent-dispatch/worker-agentcore
cd worker-agentcore
npm run image:push:ecr
```

## Release Order

Publish packages in dependency order:

1. `@agentdispatch/core`
2. `@agentdispatch/store-sqlite`
3. `@agentdispatch/adapter-aws-agentcore`
4. `@agentdispatch/sdk`
5. `@agentdispatch/mcp-server`
6. `@agentdispatch/cli`
7. `@agentdispatch/worker-agentcore`

Compatibility rule:

- `@agentdispatch/core` owns provider-neutral types and adapter contracts.
- Adapters, stores, SDK, MCP, and CLI use `@agentdispatch/core` as a peer dependency where practical.
- Packages with the same major version are expected to be compatible.
- New providers should ship as new adapter packages without adding MCP tools.

During bootstrap, repositories may use sibling `file:../` dependencies. Registry consumers should use published semver ranges such as `^0.1.0`.

## Account Profile Config

Users configure cloud accounts outside MCP calls. Raw cloud credentials are never passed through MCP.

```json
{
  "stateDir": ".agentdispatch",
  "accounts": {
    "dev-aws": {
      "provider": "aws",
      "region": "us-west-2",
      "credentialSource": "aws-sdk-default"
    }
  },
  "backends": {
    "aws-agentcore": {
      "provider": "aws",
      "capability": "agent-runtime",
      "adapter": "aws-agentcore",
      "account": "dev-aws",
      "details": {
        "runtimeArn": "arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/example",
        "qualifier": "DEFAULT"
      }
    }
  },
  "policy": {
    "defaultEffect": "deny",
    "rules": [
      {
        "effect": "allow",
        "providers": ["aws"],
        "accountProfiles": ["dev-aws"],
        "capabilities": ["agent-runtime"],
        "taskTypes": ["agent.run", "command.run"],
        "targetModes": ["session"]
      }
    ]
  }
}
```

## MCP Server Config

Configure an MCP client to launch AgentDispatch over stdio:

```json
{
  "mcpServers": {
    "agentdispatch": {
      "command": "agentdispatch-mcp",
      "args": ["--config", "/absolute/path/to/agentdispatch.config.json"]
    }
  }
}
```

The MCP tool surface remains stable as providers grow:

- `list_providers`
- `list_capabilities`
- `list_account_profiles`
- `spawn_cloud_agent`
- `dispatch_task`
- `get_task_status`
- `get_task_logs`
- `get_task_result`
- `cancel_task`

## Minimal Dispatch

Most agents should use `spawn_cloud_agent`. The user configures account/runtime access once, and the agent only provides the task:

```json
{
  "instruction": "Run a long-running investigation and return a concise result.",
  "context": {
    "source": "mcp"
  },
  "framework": "echo",
  "runtime_tools": {
    "enabled": ["web-search"]
  }
}
```

AgentDispatch resolves provider, account profile, `agent-runtime`, `agent.run`, and target mode from configured defaults and adapter capabilities.

Power users can still call the lower-level `dispatch_task` provider-neutral contract:

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
    "instruction": "Run a long-running investigation and return a concise result.",
    "context": {
      "source": "mcp"
    }
  }
}
```

Immediate response:

```json
{
  "taskId": "task_...",
  "status": "queued",
  "provider": "aws",
  "accountProfile": "dev-aws",
  "capability": "agent-runtime",
  "backend": "aws-agentcore",
  "poll": {
    "statusTool": "get_task_status",
    "logsTool": "get_task_logs",
    "resultTool": "get_task_result"
  }
}
```

The agent then polls `get_task_status`, streams logs with `get_task_logs`, retrieves final output with `get_task_result`, or cancels with `cancel_task`.

The equivalent CLI call uses config defaults, so users only define the task:

```bash
agentdispatch run \
  --instruction "Run a long-running investigation and return a concise result." \
  --context-json '{"source":"cli"}' \
  --wait
```

## Future Providers

Future packages such as `@agentdispatch/adapter-gcp-cloud-run`, `@agentdispatch/adapter-azure-container-apps`, or `@agentdispatch/adapter-kubernetes` should only add adapters and config profiles. They must fit the same MCP contract by declaring provider, capability, task type, and target mode support through `@agentdispatch/core`.
