# AWS AgentCore Adapter

The AWS adapter implements `provider: aws` and `capability: agent-runtime`.

## Session Mode

Session mode creates a new AgentCore runtime session against a configured runtime ARN. It is the default V1 path for long-running work.

- `agent.run` maps to `InvokeAgentRuntime`.
- `command.run` maps to `InvokeAgentRuntimeCommand`.
- Cancellation maps to `StopRuntimeSession`.

## Runtime Mode

Runtime mode creates AgentCore runtime resources from a prebuilt ECR image and execution role ARN, creates an endpoint, runs the task, and deletes runtime resources by default.

Runtime creation is heavier than session mode and is intended for tasks requiring a fresh deployed worker artifact.

## Persistence

AgentDispatch persists task state, events, logs, result summaries, artifact metadata, runtime refs, session refs, and cleanup status outside AgentCore.
