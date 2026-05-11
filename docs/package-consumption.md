# Package Consumption Guide

AgentDispatch is split into separate repositories and npm packages under the `@agent-dispatch` scope. `@agent-dispatch/core` is the compatibility anchor: stores, adapters, SDKs, the MCP server, and the CLI all align to the same core major version.

## Install Packages

For an MCP-first local runtime using AWS AgentCore and SQLite:

```bash
npm install @agent-dispatch/mcp-server @agent-dispatch/store-sqlite @agent-dispatch/adapter-aws-agentcore
```

For command-line usage:

```bash
npm install -g @agent-dispatch/cli
```

For SDK usage inside an application:

```bash
npm install @agent-dispatch/sdk @agent-dispatch/core
```

For custom in-process runtimes, install the store and adapter packages explicitly:

```bash
npm install @agent-dispatch/core @agent-dispatch/sdk @agent-dispatch/store-sqlite @agent-dispatch/adapter-aws-agentcore
```

For building the reference AgentCore worker image:

```bash
git clone https://github.com/agent-dispatch/worker-agentcore
cd worker-agentcore
npm run image:push:ecr
```

## Release Order

Publish packages in dependency order:

1. `@agent-dispatch/core`
2. `@agent-dispatch/store-sqlite`
3. `@agent-dispatch/adapter-aws-agentcore`
4. `@agent-dispatch/sdk`
5. `@agent-dispatch/mcp-server`
6. `@agent-dispatch/cli`
7. `@agent-dispatch/worker-agentcore`

Compatibility rule:

- `@agent-dispatch/core` owns provider-neutral types and adapter contracts.
- Adapters, stores, SDK, MCP, and CLI use `@agent-dispatch/core` as a peer dependency where practical.
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
  "runtimes": {
    "research-agent": {
      "provider": "aws",
      "account": "dev-aws",
      "capability": "agent-runtime",
      "backend": "aws-agentcore",
      "target": {
        "mode": "session"
      },
      "framework": "strands",
      "runtimeTools": {
        "enabled": ["web-search", "code-interpreter"]
      }
    }
  },
  "defaults": {
    "runtime": "research-agent"
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
  "runtime": "research-agent",
  "instruction": "Run a long-running investigation and return a concise result.",
  "context": {
    "source": "mcp"
  }
}
```

AgentDispatch resolves provider, account profile, backend, `agent-runtime`, `agent.run`, target mode, framework, and runtime tool defaults from the named runtime profile. If `defaults.runtime` is configured, the agent can omit `runtime` too.

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

Future packages such as `@agent-dispatch/adapter-gcp-cloud-run`, `@agent-dispatch/adapter-azure-container-apps`, or `@agent-dispatch/adapter-kubernetes` should only add adapters and config profiles. They must fit the same MCP contract by declaring provider, capability, task type, and target mode support through `@agent-dispatch/core`.
