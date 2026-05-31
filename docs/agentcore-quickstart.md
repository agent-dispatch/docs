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

## Configure The Cloud Worker Framework

`framework` is not a cloud-provider concept. It is the agent loop that runs inside your AgentCore runtime image. For OpenClaw, Hermes Agent, Strands, LangChain, or an internal runner, configure the worker process with command-backed framework adapters:

```bash
AGENTDISPATCH_AGENT_FRAMEWORK=openclaw
AGENTDISPATCH_FRAMEWORK_COMMAND_OPENCLAW="openclaw run --stdin-json"
```

For multiple frameworks in one runtime image:

```bash
AGENTDISPATCH_FRAMEWORK_COMMANDS='{
  "openclaw": "openclaw run --stdin-json",
  "hermes": {
    "command": "hermes-agent run --stdin-json",
    "timeoutSeconds": 1800,
    "env": {
      "HERMES_MODE": "subagent"
    }
  }
}'
```

In `runtime` target mode, pass those variables through `target.details.environmentVariables` so AgentDispatch sets them when creating the AgentCore runtime resource. In `session` target mode, set them on the prebuilt AgentCore runtime image before registering the runtime ARN.

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
    "sessionId": "ad-f7221e93f25499a0a1fc0160f63c7621",
    "providerRefs": {
      "region": "us-west-2",
      "runtimeArn": "arn:aws:bedrock-agentcore:us-west-2:123456789012:agent/...",
      "qualifier": "DEFAULT",
      "runtimeSessionId": "ad-f7221e93f25499a0a1fc0160f63c7621",
      "runtimeUrl": "https://bedrock-agentcore.us-west-2.amazonaws.com/runtimes/.../invocations/"
    },
    "invocation": {
      "type": "aws.agentcore.invoke_agent_runtime",
      "runtimeUrl": "https://bedrock-agentcore.us-west-2.amazonaws.com/runtimes/.../invocations/",
      "agentRuntimeArn": "arn:aws:bedrock-agentcore:us-west-2:123456789012:agent/...",
      "qualifier": "DEFAULT",
      "runtimeSessionId": "ad-f7221e93f25499a0a1fc0160f63c7621",
      "sessionHeaderName": "X-Amzn-Bedrock-AgentCore-Runtime-Session-Id",
      "sessionHeaderValue": "ad-f7221e93f25499a0a1fc0160f63c7621",
      "contentType": "application/json",
      "accept": "application/json",
      "payloadFormat": "a2a.jsonrpc.message-send"
    },
    "a2a": {
      "transport": "json-rpc-2.0-http",
      "messageMethod": "message/send",
      "agentCardPath": "/.well-known/agent-card.json",
      "agentCardOperation": "GetAgentCard",
      "endpointUrl": "https://bedrock-agentcore.us-west-2.amazonaws.com/runtimes/.../invocations/",
      "agentCardUrl": "https://bedrock-agentcore.us-west-2.amazonaws.com/runtimes/.../invocations/.well-known/agent-card.json"
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

## Verify End To End

Run the deterministic local smoke path first. It does not call AWS; it verifies MCP stdio-compatible transport, config bootstrap, adapter routing, SQLite persistence, logs, and result retrieval:

```bash
cd mcp-server
npm run typecheck
npm test -- --run
npm run build
```

Run the AWS adapter unit and live-test surface:

```bash
cd adapter-aws-agentcore
npm run typecheck
npm test -- --run
npm run build
```

Live AgentCore tests are opt-in because they invoke real AWS resources. Session-mode `agent.run` requires an existing runtime ARN:

```bash
cd adapter-aws-agentcore
export AGENTDISPATCH_LIVE_AGENTCORE=1
export AGENTDISPATCH_LIVE_AGENTCORE_AGENT_RUN=1
export AGENTDISPATCH_AWS_REGION=us-west-2
export AGENTDISPATCH_AGENTCORE_RUNTIME_ARN=arn:aws:bedrock-agentcore:us-west-2:123456789012:agent/00000000-0000-0000-0000-000000000000:1
export AGENTDISPATCH_AGENTCORE_PROTOCOL=a2a
npm test -- --run test/live.test.ts
```

For the repo-level live proof path, use [Live AWS verification](./live-aws-verification.md). It runs the same live-preflight surface through the CLI and can optionally submit a real cloud task with `AGENTDISPATCH_LIVE_DISPATCH=1`.

Runtime-mode live testing also needs a pushed worker image and execution role:

```bash
export AGENTDISPATCH_LIVE_AGENTCORE_RUNTIME_MODE=true
export AGENTDISPATCH_AGENTCORE_RUNTIME_ECR_IMAGE_URI=123456789012.dkr.ecr.us-west-2.amazonaws.com/agentdispatch-worker-agentcore:latest
export AGENTDISPATCH_AGENTCORE_EXECUTION_ROLE_ARN=arn:aws:iam::123456789012:role/AgentDispatchAgentCoreExecutionRole
npm test -- --run test/live.test.ts
```

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

AgentCore Runtime containers use protocol-specific service contracts. HTTP containers listen on port `8080`, expose `POST /invocations` for invocation payloads, and expose `GET /ping` for health. A2A containers listen on port `9000` at the root path and expose Agent Card discovery at `/.well-known/agent-card.json`.

The reference `@agent-dispatch/worker-agentcore` image defaults to A2A for AgentDispatch runtime-mode deployments. It returns `{"status":"Healthy"}` from `/ping`, serves the Agent Card path, and accepts JSON-RPC `message/send` on `/`. For HTTP envelope mode, run it with `AGENTDISPATCH_WORKER_PROTOCOL=http PORT=8080`.

References:

- [Deploy A2A servers in AgentCore Runtime](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-a2a.html)
- [Invoke an AgentCore Runtime agent](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-invoke-agent.html)
- [Use isolated sessions for agents](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-sessions.html)
- [Understand the AgentCore Runtime service contract](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-service-contract.html)

AgentCore command execution streams `contentStart`, `contentDelta`, and `contentStop` chunks. AgentDispatch maps these to provider-neutral progress/log events and a command exit result.

Runtime sessions are isolated microVM-backed execution contexts. Reusing a `runtimeSessionId` lets `InvokeAgentRuntime` and `InvokeAgentRuntimeCommand` operate in the same session; AgentDispatch creates one session ID per task for isolation and cancellation.
