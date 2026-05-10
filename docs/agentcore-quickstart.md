# AgentCore Quickstart

This quickstart shows the V1 AgentDispatch flow: an MCP-capable agent calls AgentDispatch, AgentDispatch dispatches a long-running task to AWS AgentCore, and the caller receives a durable task handle immediately.

## Repositories

Clone the first-run packages:

```bash
git clone https://github.com/agent-dispatch/core
git clone https://github.com/agent-dispatch/store-sqlite
git clone https://github.com/agent-dispatch/adapter-aws-agentcore
git clone https://github.com/agent-dispatch/mcp-server
git clone https://github.com/agent-dispatch/cli
```

Until packages are published to npm, develop from the local bootstrap workspace that keeps sibling `file:../` package links.

## AWS Prerequisites

Session mode requires:

- AWS credentials available through the AWS SDK default provider chain.
- An existing AgentCore Runtime ARN.
- IAM permission for `bedrock-agentcore:InvokeAgentRuntime`, `bedrock-agentcore:InvokeAgentRuntimeCommand`, and `bedrock-agentcore:StopRuntimeSession`.

Runtime mode additionally requires:

- A prebuilt ECR image for `@agentdispatch/worker-agentcore` or a compatible worker.
- An AgentCore execution role ARN.
- AgentCore control-plane permissions to create endpoint/runtime resources and delete them after completion.

## Configure AgentDispatch

Create `agentdispatch.config.json`:

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
  "defaults": {
    "provider": "aws",
    "accountProfile": "dev-aws",
    "capability": "agent-runtime",
    "backend": "aws-agentcore"
  }
}
```

The CLI can generate this file:

```bash
agentdispatch init \
  --region us-west-2 \
  --runtime-arn arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/example
```

## Run The MCP Server

```bash
agentdispatch-mcp --config agentdispatch.config.json
```

Configure your MCP client to launch that command over stdio.

## Dispatch A Long-Running Task

The agent calls:

```json
{
  "tool": "dispatch_task",
  "arguments": {
    "provider": "aws",
    "account_profile": "dev-aws",
    "capability": "agent-runtime",
    "task_type": "agent.run",
    "target": {
      "mode": "session"
    },
    "input": {
      "instruction": "Run a long-running investigation and return artifacts.",
      "context": {
        "repo": "github.com/agent-dispatch/core"
      }
    }
  }
}
```

The AWS adapter forwards `input.instruction` as both the AgentDispatch envelope and a top-level `prompt` alias. That means an existing AgentCore app using a starter-toolkit-style entrypoint such as `payload.get("prompt")` can run without adopting the AgentDispatch worker contract immediately.

Expected immediate response:

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

The agent can then call:

- `get_task_status` with the task ID
- `get_task_logs` with the task ID and optional cursor
- `get_task_result` after the task reaches a terminal state
- `cancel_task` to request cancellation and AgentCore session stop

## Optional Runtime Mode

Use runtime mode when the task requires a fresh deployed worker image:

```json
{
  "provider": "aws",
  "account_profile": "dev-aws",
  "capability": "agent-runtime",
  "task_type": "agent.run",
  "target": {
    "mode": "runtime",
    "details": {
      "ecrImageUri": "123456789012.dkr.ecr.us-west-2.amazonaws.com/agentdispatch-worker:latest",
      "executionRoleArn": "arn:aws:iam::123456789012:role/AgentDispatchAgentCoreExecutionRole"
    }
  },
  "input": {
    "instruction": "Run in a fresh AgentCore runtime."
  }
}
```

AgentDispatch creates runtime resources, runs the task, persists task state/logs/results/artifacts outside AgentCore, and deletes runtime resources by default.
