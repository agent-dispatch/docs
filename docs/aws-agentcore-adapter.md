# AWS AgentCore Adapter

The AWS adapter implements `provider: aws` and `capability: agent-runtime`.

## Session Mode

Session mode creates a new AgentCore runtime session against a configured runtime ARN. It is the default V1 path for long-running work.

- `agent.run` maps to `InvokeAgentRuntime`.
- `command.run` maps to `InvokeAgentRuntimeCommand`.
- Cancellation maps to `StopRuntimeSession`.

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

## Runtime Mode

Runtime mode creates AgentCore runtime resources from a prebuilt ECR image and execution role ARN, creates an endpoint, runs the task, and deletes runtime resources by default.

Runtime creation is heavier than session mode and is intended for tasks requiring a fresh deployed worker artifact.

## Persistence

AgentDispatch persists task state, events, logs, result summaries, artifact metadata, runtime refs, session refs, and cleanup status outside AgentCore.

## AgentCore Runtime Notes

AgentCore Runtime is a good fit for AgentDispatch V1 because it supports isolated per-session microVM execution, long-running agent workloads, large payloads, framework-agnostic containers, and direct invocation through AWS SDK clients. The adapter should continue to treat AgentCore as a backend implementation detail: MCP calls remain provider-neutral and reference named account profiles rather than raw AWS credentials.
