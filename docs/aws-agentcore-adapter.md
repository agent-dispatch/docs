# AWS AgentCore Adapter

The AWS adapter implements `provider: aws` and `capability: agent-runtime`.

## Session Mode

Session mode creates a new AgentCore runtime session against a configured runtime ARN. It is the default V1 path for long-running work.

- `agent.run` maps to `InvokeAgentRuntime`.
- `command.run` maps to `InvokeAgentRuntimeCommand`.
- Cancellation maps to `StopRuntimeSession`.
- `protocol: "a2a"` maps `agent.run` to an A2A JSON-RPC `message/send` payload and returns AgentCore connection metadata for native follow-up interaction.

For `agent.run`, AgentDispatch sends its durable task envelope and also includes a top-level `prompt` alias when the caller provides `input.prompt` or `input.instruction`. This supports existing AgentCore starter-toolkit wrappers that expose an entrypoint reading `payload.get("prompt")`, while preserving the richer AgentDispatch payload for workers that understand `taskType`, `input`, and `metadata`.

The compatibility payload shape is:

```json
{
  "taskType": "agent.run",
  "input": {
    "instruction": "Research the latest market signals",
    "context": {}
  },
  "metadata": {},
  "prompt": "Research the latest market signals",
  "context": {}
}
```

For an A2A runtime, the initial `agent.run` payload is:

```json
{
  "jsonrpc": "2.0",
  "id": "task_...",
  "method": "message/send",
  "params": {
    "message": {
      "role": "user",
      "parts": [{ "kind": "text", "text": "Research the latest market signals" }],
      "messageId": "task_..."
    },
    "metadata": {
      "taskType": "agent.run",
      "input": {},
      "context": {}
    }
  }
}
```

The MCP response includes `cloudAgent.a2a` and `cloudAgent.invocation`, so the lead agent can retrieve the Agent Card with `GetAgentCard` and continue A2A `message/send` calls against the same `runtimeSessionId`.

For runtime mode with `protocol: "a2a"`, the adapter keeps the runtime resources alive by default because the spawned cloud agent is expected to receive follow-up A2A calls. Set `target.details.cleanupAfterTask: true` to restore immediate cleanup behavior.

## Runtime Mode

Runtime mode creates AgentCore runtime resources from a prebuilt ECR image and execution role ARN, creates an endpoint, runs the task, and deletes runtime resources by default.

Runtime creation is heavier than session mode and is intended for tasks requiring a fresh deployed worker artifact.

## Persistence

AgentDispatch persists task state, events, logs, result summaries, artifact metadata, runtime refs, session refs, and cleanup status outside AgentCore.

## AgentCore Runtime Notes

AgentCore Runtime is a good fit for AgentDispatch V1 because it supports isolated per-session microVM execution, long-running agent workloads, large payloads, framework-agnostic containers, and direct invocation through AWS SDK clients. The adapter should continue to treat AgentCore as a backend implementation detail: MCP calls remain provider-neutral and reference named account profiles rather than raw AWS credentials.
