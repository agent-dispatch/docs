# Contributor Issue Bank

Use this bank to seed launch-day GitHub issues. Each entry names a target repo, labels, scope, acceptance criteria, and verification commands so a contributor can start without reverse-engineering the architecture.

Link each published issue back to this page and the [Contributor map](./contributor-map.md). Do not use these issues to claim live AWS dispatch has been verified. Live cloud claims require the [Live AWS verification](./live-aws-verification.md) path with `AGENTDISPATCH_LIVE_DISPATCH=1`.

## Adapter Issues

| Title | Target repo | Labels |
| --- | --- | --- |
| Add a local child-process adapter prototype | `adapter-template` or new `adapter-local-process` | `good first issue`, `adapter`, `provider-local` |
| Add a Kubernetes Job adapter design spike | `adapter-template` or new `adapter-kubernetes` | `good first issue`, `adapter`, `kubernetes` |
| Add a GCP Cloud Run Jobs adapter design spike | `adapter-template` or new `adapter-gcp-cloud-run` | `good first issue`, `adapter`, `gcp` |
| Add an Azure Container Apps Jobs adapter design spike | `adapter-template` or new `adapter-azure-container-apps` | `good first issue`, `adapter`, `azure` |

### Add A Local Child-Process Adapter Prototype

Target repo: `adapter-template` or new `adapter-local-process`

Labels: `good first issue`, `adapter`, `provider-local`

Goal: Create a local adapter prototype that runs an AgentDispatch task as a child process while preserving the provider-neutral adapter contract.

Why: This gives contributors a no-cloud adapter path for testing routing, task lifecycle, logs, artifacts, and cancellation without AWS credentials.

Scope:

- Start from `agent-dispatch/adapter-template`.
- Map `provider + capability + task_type + target.mode` to a local command target.
- Keep command, args, cwd, and env allowlist in adapter config or `target.details`.
- Do not pass raw secrets through MCP tool payloads.
- Emit normalized task events for start, log, result, error, and cancellation.

Acceptance criteria:

- A sample config can dispatch a command such as `node worker.js`.
- Logs are captured as AgentDispatch task events.
- Exit code, stdout summary, and stderr summary are represented in the task result or error.
- Cancellation terminates the child process.
- README documents the adapter boundary and local-only security caveats.

Verification:

```bash
npm test
npm run typecheck
npm run build
AGENTDISPATCH_VERIFY_INSTALL=1 npm --prefix agentdispatch-docs run verify:local-e2e
```

### Add A Kubernetes Job Adapter Design Spike

Target repo: `adapter-template` or new `adapter-kubernetes`

Labels: `good first issue`, `adapter`, `kubernetes`

Goal: Design the first Kubernetes Job adapter shape for AgentDispatch.

Why: Kubernetes is the most portable cloud-neutral runtime target. A design spike helps contributors agree on config shape before implementation.

Scope:

- Define how `target.mode = "job"` maps to Kubernetes Job creation.
- Identify required config: namespace, image, service account, env allowlist, resource limits, cleanup policy, and log collection.
- Define provider refs for namespace, job name, pod name, and container name.
- Document how logs, artifacts, cancellation, and cleanup should work.
- Keep Kubernetes client details inside the adapter package.

Acceptance criteria:

- A design doc or README section describes the mapping from AgentDispatch runtime model to Kubernetes resources.
- The proposal avoids new MCP tool names.
- The proposal keeps credentials outside MCP payloads.
- Open questions are listed for artifacts, service exposure, and auth.

Verification:

```bash
npm test
npm run typecheck
npm run build
```

### Add A GCP Cloud Run Jobs Adapter Design Spike

Target repo: `adapter-template` or new `adapter-gcp-cloud-run`

Labels: `good first issue`, `adapter`, `gcp`

Goal: Create a design spike for a GCP Cloud Run Jobs adapter.

Why: Cloud Run Jobs are a natural target for long-running agent tasks on GCP while keeping the AgentDispatch MCP surface stable.

Scope:

- Map provider `gcp`, capability `job-runner`, and `target.mode = "job"` to Cloud Run Jobs.
- Define config for project, region, job name, service account, env allowlist, timeout, and log sink.
- Define provider refs for execution ID and log URL.
- Describe how live preflight would check project, region, IAM, and job reachability.

Acceptance criteria:

- Design doc names the exact Cloud Run APIs and provider refs.
- Live preflight is described as adapter-owned.
- No raw GCP credentials are passed through MCP tool payloads.
- Implementation steps are small enough for follow-up issues.

Verification:

```bash
npm test
npm run typecheck
npm run build
```

### Add An Azure Container Apps Jobs Adapter Design Spike

Target repo: `adapter-template` or new `adapter-azure-container-apps`

Labels: `good first issue`, `adapter`, `azure`

Goal: Create a design spike for an Azure Container Apps Jobs adapter.

Why: Azure Container Apps Jobs can run durable task workloads while AgentDispatch keeps the same `spawn_cloud_agent` contract.

Scope:

- Map provider `azure`, capability `job-runner`, and `target.mode = "job"` to Container Apps Jobs.
- Define config for subscription, resource group, environment, job name, identity, timeout, and logs.
- Define provider refs for execution name and Azure resource IDs.
- Describe live preflight checks for identity, region, resource existence, and permissions.

Acceptance criteria:

- Design doc names the Azure resource model and provider refs.
- Provider-specific SDK usage stays inside the adapter.
- Credential handling stays outside MCP payloads.
- Follow-up implementation tasks are listed.

Verification:

```bash
npm test
npm run typecheck
npm run build
```

## Worker Issues

| Title | Target repo | Labels |
| --- | --- | --- |
| Add a command-backed worker example | `worker-agentcore` | `good first issue`, `worker`, `examples` |
| Add a LangGraph worker integration sketch | `worker-agentcore` | `good first issue`, `worker`, `langgraph` |
| Add an OpenAI Agents worker integration sketch | `worker-agentcore` | `good first issue`, `worker`, `openai-agents` |

### Add A Command-Backed Worker Example

Target repo: `worker-agentcore`

Labels: `good first issue`, `worker`, `examples`

Goal: Add a worker example that runs a configured command and returns normalized logs and result metadata.

Why: This creates a simple bridge for existing scripts and makes AgentDispatch easier to try before adopting a full agent framework.

Scope:

- Add an example worker command runner under the worker package docs or examples.
- Show how the command receives an instruction and optional context.
- Normalize stdout, stderr, exit code, duration, and result summary.
- Document security boundaries and safe defaults.

Acceptance criteria:

- README or example docs show a complete command-backed worker flow.
- The example does not require live AWS to understand.
- Tests cover success and non-zero exit behavior if code is added.

Verification:

```bash
npm test
npm run typecheck
npm run build
```

### Add A LangGraph Worker Integration Sketch

Target repo: `worker-agentcore`

Labels: `good first issue`, `worker`, `langgraph`

Goal: Document or prototype how a LangGraph worker can run behind AgentDispatch without changing the MCP tool contract.

Why: Framework-specific worker examples help agent builders understand where their runtime code belongs.

Scope:

- Describe request input, graph invocation, streaming/log events, result shape, and error mapping.
- Keep framework code in the worker boundary, not the provider adapter.
- Show how A2A, HTTP, or MCP follow-up metadata would be returned if supported.

Acceptance criteria:

- The integration sketch includes a minimal handler shape.
- Logs and final output map to AgentDispatch task events.
- The docs clearly state that provider adapters remain framework-neutral.

Verification:

```bash
npm test
npm run typecheck
npm run build
```

### Add An OpenAI Agents Worker Integration Sketch

Target repo: `worker-agentcore`

Labels: `good first issue`, `worker`, `openai-agents`

Goal: Document or prototype how an OpenAI Agents worker can run as an AgentDispatch cloud-side worker.

Why: This gives OpenAI Agents users a clear path to run long-lived work behind the same `spawn_cloud_agent` primitive.

Scope:

- Define input mapping from AgentDispatch instruction/context to the worker.
- Define log/result/error normalization.
- Keep OpenAI-specific code in the worker boundary.
- Document environment variables without exposing secrets in MCP payloads.

Acceptance criteria:

- The integration sketch includes a minimal worker handler.
- The handler can return a final text result and structured metadata.
- The docs include security and environment configuration notes.

Verification:

```bash
npm test
npm run typecheck
npm run build
```

## Architecture Issues

| Title | Target repo | Labels |
| --- | --- | --- |
| Design provider-neutral artifact browsing | `core`, `mcp-server`, `store-sqlite` | `architecture`, `artifacts` |
| Design provider-neutral live preflight evidence | `core`, `mcp-server`, `cli`, provider adapters | `architecture`, `preflight` |
| Add an examples index for launch demos | `docs`, `website` | `docs`, `examples`, `launch` |

### Design Provider-Neutral Artifact Browsing

Target repos: `core`, `mcp-server`, `store-sqlite`

Labels: `architecture`, `artifacts`

Goal: Design a provider-neutral way to list and retrieve task artifacts.

Why: Long-running cloud subagents need to return more than final text. Repos, reports, traces, screenshots, and data extracts should be discoverable without provider-specific tool names.

Scope:

- Define artifact metadata in core.
- Define store queries for artifact list and retrieval.
- Define MCP tools or result fields for artifact discovery.
- Define provider refs for cloud-owned artifact locations.

Acceptance criteria:

- The design keeps provider-specific storage details behind adapter/provider refs.
- The MCP surface remains provider-neutral.
- Backward compatibility for existing task results is described.
- Follow-up implementation issues are listed by repo.

Verification:

```bash
npm test
npm run typecheck
npm run build
AGENTDISPATCH_VERIFY_INSTALL=1 npm --prefix agentdispatch-docs run verify:local-e2e
```

### Design Provider-Neutral Live Preflight Evidence

Target repos: `core`, `mcp-server`, `cli`, provider adapters

Labels: `architecture`, `preflight`

Goal: Design a common evidence model for live provider preflight checks.

Why: AgentDispatch needs credible launch claims across providers without making every adapter invent a separate proof format.

Scope:

- Define common fields for credential source, account, region, runtime reachability, permissions, and timestamp.
- Keep provider-specific diagnostic fields under adapter-owned details.
- Align CLI, SDK, MCP, and docs wording around preflight versus dispatch.
- Preserve the current live AWS report claim boundary.

Acceptance criteria:

- The model distinguishes local config checks, live preflight, and real dispatch.
- The model can represent AWS AgentCore today and future GCP/Azure/Kubernetes checks.
- Docs explain what public claims are allowed for each proof level.

Verification:

```bash
npm test
npm run typecheck
npm run build
npm --prefix agentdispatch-docs run status:release
```

### Add An Examples Index For Launch Demos

Target repos: `docs`, `website`

Labels: `docs`, `examples`, `launch`

Goal: Create an examples index that helps new users pick a demo path in under one minute.

Why: The repo already has strong architecture docs. A compact examples index improves first-run conversion for lead-agent builders and contributors.

Scope:

- List local no-cloud demo.
- List AWS AgentCore live preflight path.
- List planned adapter and worker demos.
- Link the lead-agent prompt kit and launch announcement kit.

Acceptance criteria:

- The index has one command per demo path.
- It clearly marks which demos require real cloud credentials.
- It links to verification docs and release status.

Verification:

```bash
npm --prefix agentdispatch-docs test
npm --prefix agentdispatch-docs run status:release
```
