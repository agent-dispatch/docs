# AgentCore Quickstart

This quickstart shows the V1 AgentDispatch flow: an MCP-capable lead agent calls AgentDispatch, AgentDispatch spawns or selects an AWS AgentCore runtime session, and the caller receives a durable task handle plus cloud-agent connection metadata. For A2A runtimes, the lead agent then talks to the cloud subagent through A2A using the returned AgentCore details.

## Repositories

Install the published packages for local use:

```bash
npm install -g @agent-dispatch/cli
npm install @agent-dispatch/core @agent-dispatch/mcp-server @agent-dispatch/store-sqlite @agent-dispatch/adapter-aws-agentcore
```

Or clone the repos when developing the packages themselves:

```bash
git clone https://github.com/agent-dispatch/core
git clone https://github.com/agent-dispatch/store-sqlite
git clone https://github.com/agent-dispatch/adapter-aws-agentcore
git clone https://github.com/agent-dispatch/mcp-server
git clone https://github.com/agent-dispatch/cli
```

## AWS Prerequisites

Session mode requires:

- AWS credentials available through the AWS SDK default provider chain.
- An existing AgentCore Runtime ARN.
- IAM permission for `bedrock-agentcore:InvokeAgentRuntime`, `bedrock-agentcore:InvokeAgentRuntimeCommand`, `bedrock-agentcore:GetAgentCard`, and `bedrock-agentcore:StopRuntimeSession`.

Runtime mode additionally requires:

- A prebuilt ECR image for `@agent-dispatch/worker-agentcore` or a compatible worker.
- An AgentCore execution role ARN.
- AgentCore control-plane permissions to create endpoint/runtime resources and delete them after completion.

## Build The Reference Worker Image

Clone and build the AgentDispatch AgentCore worker:

```bash
git clone https://github.com/agent-dispatch/worker-agentcore
cd worker-agentcore

AWS_REGION=us-west-2 \
ECR_REPOSITORY=agentdispatch-worker-agentcore \
IMAGE_TAG=latest \
npm run image:push:ecr
```

The command prints an ECR image URI like:

```text
123456789012.dkr.ecr.us-west-2.amazonaws.com/agentdispatch-worker-agentcore:latest
```

Use that URI as `target.details.ecrImageUri` when testing runtime mode.

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
        "runtimeArn": "arn:aws:bedrock-agentcore:us-west-2:123456789012:agent/00000000-0000-0000-0000-000000000000:1",
        "qualifier": "DEFAULT",
        "protocol": "a2a"
      }
    }
  },
  "runtimes": {
    "research-agent": {
      "provider": "aws",
      "account": "dev-aws",
      "capability": "agent-runtime",
      "backend": "aws-agentcore",
      "protocol": "a2a",
      "target": {
        "mode": "session",
        "protocol": "a2a"
      },
      "framework": "strands",
      "model": {
        "provider": "bedrock",
        "modelId": "anthropic.claude-3-5-sonnet"
      },
      "runtimeTools": {
        "enabled": ["web-search"]
      }
    }
  },
  "defaults": {
    "runtime": "research-agent"
  }
}
```

The CLI can generate this file:

```bash
agentdispatch init \
  --region us-west-2 \
  --runtime-arn arn:aws:bedrock-agentcore:us-west-2:123456789012:agent/00000000-0000-0000-0000-000000000000:1
```

Validate local config before dispatching real work:

```bash
agentdispatch doctor --config agentdispatch.config.json
agentdispatch-mcp --config agentdispatch.config.json --check
```

## Run The MCP Server

```bash
agentdispatch-mcp --config agentdispatch.config.json
```

Configure your MCP client to launch that command over stdio.

## Dispatch A Long-Running Task

For a direct CLI smoke test, define only the task. Routing falls back to `defaults` in `agentdispatch.config.json`:

```bash
agentdispatch run \
  --config agentdispatch.config.json \
  --instruction "Run a long-running investigation and return a concise result." \
  --context-json '{"repo":"github.com/agent-dispatch/core"}' \
  --wait
```

For deterministic shell execution in the same AgentCore session:

```bash
agentdispatch run \
  --config agentdispatch.config.json \
  --command 'echo agentdispatch-smoke' \
  --wait
```

The agent calls:

```json
{
  "tool": "spawn_cloud_agent",
  "arguments": {
    "runtime": "research-agent",
    "instruction": "Run a long-running investigation and return artifacts.",
    "context": {
      "repo": "github.com/agent-dispatch/core"
    }
  }
}
```

`spawn_cloud_agent` is the simple agent-facing tool. It resolves provider, account profile, backend, capability, task type, target, protocol, model, framework, and runtime tool defaults from config. If `defaults.runtime` is set, the agent can omit the `runtime` field. The lower-level `dispatch_task` tool remains available for explicit routing:

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
    "instruction": "Run a long-running investigation and return artifacts.",
    "context": {
      "repo": "github.com/agent-dispatch/core"
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
  "cloudAgent": {
    "protocol": "a2a",
    "sessionId": "agentcore_session_...",
    "providerRefs": {
      "region": "us-west-2",
      "runtimeArn": "arn:aws:bedrock-agentcore:us-west-2:123456789012:agent/...",
      "qualifier": "DEFAULT",
      "runtimeSessionId": "agentcore_session_..."
    },
    "invocation": {
      "type": "aws.agentcore.invoke_agent_runtime",
      "agentRuntimeArn": "arn:aws:bedrock-agentcore:us-west-2:123456789012:agent/...",
      "qualifier": "DEFAULT",
      "runtimeSessionId": "agentcore_session_...",
      "payloadFormat": "a2a.jsonrpc.message-send"
    },
    "a2a": {
      "transport": "json-rpc-2.0-http",
      "messageMethod": "message/send",
      "agentCardOperation": "GetAgentCard"
    }
  },
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
- A2A follow-up calls using `cloudAgent.invocation.runtimeSessionId` and `cloudAgent.a2a.messageMethod`
- `cancel_task` to request cancellation and AgentCore session stop

## Optional Runtime Mode

Use runtime mode when the task requires a fresh deployed worker image:

```bash
IMAGE_URI="123456789012.dkr.ecr.us-west-2.amazonaws.com/agentdispatch-worker-agentcore:latest"
EXECUTION_ROLE_ARN="arn:aws:iam::123456789012:role/AgentDispatchAgentCoreExecutionRole"

agentdispatch run \
  --config agentdispatch.config.json \
  --target-mode runtime \
  --target-details-json "{\"ecrImageUri\":\"$IMAGE_URI\",\"executionRoleArn\":\"$EXECUTION_ROLE_ARN\"}" \
  --instruction "Run in a fresh AgentCore runtime." \
  --wait
```

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

## AgentCore Runtime Compatibility Notes

AgentCore Runtime HTTP containers are expected to listen on port `8080`, expose `POST /invocations` for invocation payloads, and expose `GET /ping` for health. The reference `@agent-dispatch/worker-agentcore` image follows this shape and returns `{"status":"Healthy"}` from `/ping`.

AgentCore command execution streams `contentStart`, `contentDelta`, and `contentStop` chunks. AgentDispatch maps these to provider-neutral progress/log events and a command exit result.

Runtime sessions are isolated microVM-backed execution contexts. Reusing a `runtimeSessionId` lets `InvokeAgentRuntime` and `InvokeAgentRuntimeCommand` operate in the same session; AgentDispatch creates one session ID per task for isolation and cancellation.
