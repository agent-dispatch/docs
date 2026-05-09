# AgentDispatch: Agent Core Runtime Design

**Status:** Draft v0.1  
**Scope:** Core runtime only  
**Audience:** Founders, runtime engineers, SDK/CLI/MCP implementers  
**Last updated:** 2026-05-09

---

## 1. Summary

AgentDispatch is a runtime-agnostic task delegation platform that lets an agent offload long-running work to isolated remote workers through a unified SDK, CLI, and MCP interface.

This document focuses on the **agent core runtime**: the control-plane and execution model that accepts a task, allocates an isolated worker, runs the task, streams progress, persists state, and returns outputs.

The design goal is to make remote delegation feel as simple as a function call while preserving the properties needed for production use:

- isolation
- resumability
- observability
- deterministic lifecycle control
- transport independence
- backend portability

---

## 2. Problem Statement

Today, agent systems can reason well but struggle to safely offload work that is:

- long-running
- stateful
- expensive
- dependent on tools or credentials
- likely to outlive a single interactive session
- risky to run on the caller’s local machine

Typical failure modes:

- local runtime state is polluted or non-reproducible
- agent work dies when the initiating process exits
- tool execution and agent orchestration are tightly coupled
- background jobs have weak lifecycle tracking
- there is no clean handoff between SDK, CLI, and MCP clients
- logs and artifacts are fragmented or lost
- worker backends are hardcoded to one environment

AgentDispatch should provide a general runtime layer that lets a caller say, in effect:

> Run this agent task elsewhere, in an isolated environment, and give me a stable handle for observing, controlling, and retrieving the result.

---

## 3. Goals

### Primary goals

1. **Unified submission model** across SDK, CLI, and MCP.
2. **Isolated execution** on remote workers with explicit lifecycle.
3. **Asynchronous task handles** with polling, streaming, cancellation, and resumption.
4. **Runtime agnosticism** across worker backends.
5. **Durable task state** independent of the client process.
6. **First-class outputs**: logs, structured result, artifacts, status timeline, metrics.
7. **Composable agent execution** so one agent can delegate work to another runtime-managed worker.

### Secondary goals

1. Cost and quota controls.
2. Retry and recovery semantics.
3. Human-debuggable operational model.
4. Support for both ephemeral and reusable worker sessions.

---

## 4. Non-goals

For this first design pass, the runtime will **not** fully specify:

- UI/dashboard product details
- billing system implementation
- marketplace or multi-tenant monetization features
- fine-grained secret-management product UX
- full workflow DAG orchestration
- model-specific prompting strategy inside the worker
- every provider-specific backend implementation detail

---

## 5. Related Systems / Prior Art

### Crabbox

Crabbox is strongly adjacent prior art.

What Crabbox provides, based on its docs:

- CLI-driven remote execution
- broker/control plane
- ephemeral or warm remote boxes
- lease lifecycle
- worker provisioning across providers
- sync, SSH execution, logs, telemetry, cleanup

Crabbox is closest to an **ephemeral remote workspace broker**.

### What AgentDispatch should borrow from Crabbox

- explicit lease/session model
- separation of control plane from worker
- isolated remote execution as a default
- durable run state outside the runner
- usage, expiry, cleanup, and cost guardrails
- artifacts/logs/telemetry retained in the platform

### How AgentDispatch differs

AgentDispatch should be broader than a remote testbox system. It should treat the worker as a **general task execution runtime** rather than only a repo-synced shell box.

AgentDispatch must additionally support:

- agent-native task contracts, not just shell commands
- SDK/CLI/MCP as equal front doors
- long-running async task handles
- transport-agnostic clients
- richer execution modes: agent task, shell task, container task, future workflow task
- nested delegation patterns where agents dispatch tasks to runtime-managed workers

### Design takeaway

Crabbox is a useful reference for the **runtime/control-plane substrate**, but AgentDispatch should define a more general task abstraction above that substrate.

### Amazon Bedrock AgentCore Runtime

Amazon Bedrock AgentCore Runtime is the preferred first concrete adapter for AgentDispatch.

What AgentCore Runtime provides:

- serverless hosting for agents and tools
- containerized agent runtime deployment
- runtime versions and stable endpoints
- isolated per-session microVM execution
- session stickiness through runtime session IDs
- synchronous, streaming, and asynchronous agent invocation patterns
- command execution inside an active runtime session
- IAM SigV4 and OAuth-oriented authentication paths
- persistent filesystem state across stop/resume cycles
- built-in scaling, infrastructure management, and runtime isolation

AgentCore Runtime should be treated as a **managed agent execution backend**, not as the AgentDispatch product itself.

AgentDispatch should still own:

- cross-surface task API across SDK, CLI, and MCP
- durable dispatch handles
- normalized task state machine
- task lineage and ownership
- result and artifact catalog
- backend-neutral scheduling policy
- user-visible lifecycle semantics

The AgentCore adapter maps those AgentDispatch primitives onto AgentCore runtime ARNs, endpoints, qualifiers, runtime session IDs, invocation streams, command streams, and session stop operations.

---

## 6. Design Principles

1. **Control plane / data plane separation**  
   Control logic, state, auth, quotas, and coordination live centrally. Workers stay simple.

2. **Durable handles over live coupling**  
   A task should continue even if the initiating client disconnects.

3. **Transport-neutral API**  
   The same runtime concepts should map cleanly to SDK calls, CLI commands, and MCP tools.

4. **Execution-mode pluggability**  
   The runtime should not assume every task is a shell command or every worker is an SSH VM.

5. **Observable by default**  
   Logs, events, timestamps, artifacts, and resource signals are first-class.

6. **Idempotent control operations**  
   Submit, attach, cancel, retry, and fetch-result operations should be safe to repeat.

7. **Ephemeral by default, reusable when explicit**  
   Most tasks should run in short-lived isolated workers, but explicit reusable sessions should exist.

---

## 7. Core Concepts

### 7.1 Task

A **Task** is the unit submitted by a client.

It includes:

- task ID
- type
- input payload
- execution requirements
- identity/ownership
- lifecycle status
- outputs and metadata

Examples of task types:

- `agent.run`
- `command.run`
- `container.run`
- `workflow.step` (future)

### 7.2 Session / Lease

A **Session** is a bound execution environment allocated to one or more tasks.

Two modes:

- **ephemeral**: created for one task and destroyed after completion
- **reusable**: explicitly kept warm and reused across tasks

This concept is similar to Crabbox leases, but generalized beyond SSH boxes.

### 7.3 Worker

A **Worker** is the actual compute environment that executes the task.

Possible worker forms:

- AgentCore Runtime endpoint
- VM over SSH
- container runner
- serverless sandbox
- hosted code-execution sandbox
- future specialized agent worker

### 7.4 Runtime Backend

A **Runtime Backend** targets, provisions, or manages workers.

Examples:

- AWS AgentCore Runtime adapter
- local debug backend
- Docker backend
- VM backend
- sandbox provider backend
- Kubernetes backend

### 7.5 Dispatch Handle

A **Dispatch Handle** is the stable identifier returned to the caller.

It supports:

- get status
- stream events
- fetch logs
- fetch artifacts
- cancel
- retry
- await result

### 7.6 Artifact

An **Artifact** is any persisted output beyond inline logs.

Examples:

- file bundles
- screenshots
- structured JSON results
- traces
- test reports

---

## 8. High-Level Architecture

```text
Client Surface
  - SDK
  - CLI
  - MCP
       |
       v
Dispatch API Layer
  - auth
  - validation
  - idempotency
  - request normalization
       |
       v
Runtime Control Plane
  - task state machine
  - scheduler
  - session/lease manager
  - backend adapter manager
  - event/log/artifact registry
  - quota/cost policy
       |
       v
Execution Gateway
  - start task
  - attach to worker
  - stream events
  - collect outputs
  - heartbeat
       |
       v
Worker Backend Adapters
  - AWS AgentCore Runtime
  - VM/SSH
  - container
  - sandbox
  - local debug
       |
       v
Workers
  - isolated task environments
```

### Architectural split

- **Client Surface** translates user intent into runtime requests.
- **Dispatch API Layer** provides the canonical external API.
- **Runtime Control Plane** owns durable state and orchestration.
- **Execution Gateway** speaks backend-specific execution protocols.
- **Workers** execute user tasks and emit outputs.

---

## 9. Request Model

A normalized task submission request should look conceptually like this:

```json
{
  "task_type": "agent.run",
  "input": {
    "instruction": "Investigate failing CI and propose a patch",
    "context": {
      "repo": "github.com/org/repo",
      "ref": "main"
    }
  },
  "execution": {
    "mode": "ephemeral",
    "backend": "aws-agentcore",
    "backend_ref": {
      "region": "us-west-2",
      "runtime_arn": "arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/agentdispatch-worker",
      "qualifier": "DEFAULT"
    },
    "timeout_seconds": 3600,
    "max_retries": 1,
    "resources": {
      "cpu": 2,
      "memory_mb": 4096
    }
  },
  "artifacts": {
    "capture_logs": true,
    "capture_result": true,
    "capture_files": true
  },
  "metadata": {
    "project": "agentdispatch",
    "submitted_by": "cli"
  }
}
```

SDK, CLI, and MCP should all compile to this internal request shape.

---

## 10. Runtime State Machine

### Task states

```text
queued
  -> scheduling
  -> provisioning
  -> starting
  -> running
  -> completing
  -> succeeded

queued|scheduling|provisioning|starting|running
  -> cancelling
  -> cancelled

provisioning|starting|running|completing
  -> failed

failed
  -> retrying
  -> queued
```

### Session states

```text
requested
  -> provisioning
  -> ready
  -> attached
  -> releasing
  -> released

provisioning|ready|attached
  -> expired
  -> failed
```

### Why separate Task from Session

A task is user intent. A session is execution environment.

This separation allows:

- multiple tasks on one reusable session
- task retry on a fresh session
- backend portability
- better observability and cost accounting

---

## 11. End-to-End Flow

### 11.1 Submit

1. Client submits task through SDK, CLI, or MCP.
2. API layer authenticates and validates.
3. Request is normalized into canonical runtime form.
4. Control plane creates task record in `queued`.
5. Client receives dispatch handle immediately.

### 11.2 Schedule

1. Scheduler evaluates backend selection.
2. Quota/cost/policy checks run.
3. Control plane either:
   - reuses an existing warm session, or
   - provisions a new one.

### 11.3 Provision

1. Backend adapter provisions or allocates worker.
2. Session transitions to `ready`.
3. Execution gateway attaches and prepares runtime context.

For the AWS AgentCore adapter, v1 should start with a pre-existing AgentCore Runtime endpoint ARN and create or reuse an AgentCore runtime session ID. Runtime creation, version rollout, and endpoint management can be added after the invocation path is stable.

### 11.4 Run

1. Task starts on worker.
2. Worker emits lifecycle events and logs.
3. Control plane persists status transitions.
4. Heartbeats track liveness.
5. Client may attach live or disconnect safely.

For AgentCore, `agent.run` maps to `InvokeAgentRuntime`. `command.run` maps to `InvokeAgentRuntimeCommand` against the same runtime session so deterministic commands can run in the same container, filesystem, and environment as the agent.

### 11.5 Complete

1. Worker returns structured result and exit status.
2. Artifacts are uploaded/persisted.
3. Task transitions to terminal state.
4. Session is released unless explicitly reusable.

---

## 12. Execution Modes

The runtime should support multiple execution contracts.

### 12.1 Agent task mode

The worker launches an agent runtime with:

- instruction
- context payload
- tools/policies
- output contract

This is the primary mode for AgentDispatch.

In the AWS AgentCore adapter, the deployed container exposes the AgentCore application contract and AgentDispatch passes the normalized task input as the invocation payload.

### 12.2 Command mode

The worker runs a shell command or script.

Useful for:

- CI-like tasks
- build/test jobs
- debugging
- migration from simpler remote-exec systems

In the AWS AgentCore adapter, command mode uses AgentCore command execution inside an active runtime session and translates streamed command events into AgentDispatch log and completion events. Required tools such as `git`, package managers, or language runtimes must exist in the deployed container image or be installed during session setup.

### 12.3 Container mode

The worker launches a containerized payload with resource constraints.

Useful for stronger packaging and backend consistency.

### 12.4 Reusable interactive mode

The runtime provisions a durable session and allows multiple task attachments.

Useful for:

- long debugging sessions
- incremental agent workflows
- user-inspected warm environments

---

## 13. API Surface

The exact transport may vary, but the logical operations should be:

### Task APIs

- `CreateTask`
- `GetTask`
- `ListTasks`
- `CancelTask`
- `RetryTask`
- `AwaitTask`

### Session APIs

- `CreateSession`
- `GetSession`
- `ListSessions`
- `ReleaseSession`

### Streaming / observability APIs

- `StreamTaskEvents`
- `GetTaskLogs`
- `ListTaskArtifacts`
- `GetTaskResult`

### Backend / admin APIs

- `ListBackends`
- `GetCapacity`
- `GetUsage`
- `GetHealth`

### Mapping examples

- **SDK**: `dispatch.createTask(...)`
- **CLI**: `agentdispatch run ...`
- **MCP**: `dispatch_task`, `get_task_status`, `get_task_result`

---

## 14. MCP, CLI, and SDK Alignment

A major product requirement is that these are not separate systems.

They should all map onto the same runtime primitives.

| Surface | User mental model | Runtime primitive |
|---|---|---|
| SDK | async function / future | task handle |
| CLI | command invocation + attach | task + optional session |
| MCP | remote tool call with durable continuation | task handle + polling/stream |

### Important implication

MCP calls are often synchronous from the caller’s perspective, but the runtime should expose an async backbone underneath. If a task outlives a tool timeout, MCP should still return a durable handle and allow follow-up retrieval.

That is one of the key product differentiators.

---

## 15. Scheduling and Backend Selection

The scheduler chooses where a task runs.

Inputs:

- requested backend or `auto`
- task type
- resource requirements
- tenant policy
- cost caps
- warm session availability
- backend health/capacity
- affinity hints

Selection strategies:

- **direct request**: user chooses backend
- **policy-based**: org policy constrains backend
- **auto-fit**: scheduler picks the preferred healthy backend that satisfies constraints
- **affinity reuse**: prefer existing warm session when safe

For v1, `auto` should prefer `aws-agentcore` when the requested task type and account configuration are compatible. The local debug backend remains the fallback for development and adapter tests.

---

## 16. Durability Model

The control plane, not the worker, is the source of truth.

Persisted centrally:

- task metadata
- task status transitions
- session metadata
- logs offsets / references
- artifact metadata
- result payload summary
- retry history
- ownership / auth scope

Workers should be treated as disposable.

This mirrors one of the best ideas from Crabbox: **durable evidence remains in the platform, not on the box**.

---

## 17. Observability Model

Every task should emit:

- status events
- timestamps
- structured logs
- stdout/stderr when applicable
- heartbeat/liveness signals
- resource telemetry when available
- artifact inventory
- final result summary

Recommended event examples:

- `task.queued`
- `task.scheduled`
- `session.provisioning`
- `session.ready`
- `task.started`
- `task.progress`
- `task.log`
- `task.artifact.created`
- `task.succeeded`
- `task.failed`
- `task.cancelled`

Observability storage may use:

- relational state store for metadata
- object storage for logs/artifacts
- append-only event stream for live subscriptions

For the AWS AgentCore adapter:

- invocation response chunks map to `task.progress` or `task.log`
- command `contentStart`, `contentDelta`, and `contentStop` events map to start, log, and completion events
- AgentCore asynchronous processing should be represented as an AgentDispatch task that remains `running` after the initial invocation returns
- AgentCore health/ping status can inform liveness, but AgentDispatch task state remains the user-visible source of truth

---

## 18. Failure Handling

### Failure classes

1. **submission failure**: invalid request, auth failure, quota rejection
2. **scheduling failure**: no capacity, policy denial, backend unavailable
3. **provisioning failure**: worker creation/boot failure
4. **runtime failure**: task exits non-zero, agent exception, timeout
5. **transport failure**: client disconnect, stream interruption
6. **finalization failure**: artifact upload or cleanup failure

### Recovery policies

- submission failures: no retry unless request changes
- provisioning failures: safe automatic retry on new worker
- runtime failures: retry only if task contract allows it
- disconnects: task keeps running
- cleanup failures: background janitor reclaims leaked sessions

### Design choice

AgentDispatch should distinguish:

- **task failed**
- **worker failed**
- **platform failed**

Those are operationally different and should remain distinct in user-visible status.

---

## 19. Security Model

### Core rules

- provider credentials stay in the control plane, not on clients
- workers receive only scoped execution credentials
- tasks execute in isolated environments
- task ownership scopes access to logs/results/artifacts
- cancellation/control requires authorization on the task handle

### Isolation levels

Potential tiers:

1. process isolation
2. container isolation
3. VM isolation
4. dedicated machine isolation

The runtime should allow backend-specific guarantees, but surface them as capability levels to callers.

For the AWS AgentCore adapter, the control plane should use scoped IAM permissions for invocation, command execution, session listing, and session stop operations. AgentDispatch should not expose AWS credentials to SDK, CLI, or MCP callers.

---

## 20. Cost and Quota Guardrails

The runtime should enforce:

- max concurrent tasks
- max warm sessions
- max runtime per task
- per-task cost cap
- tenant monthly budget cap
- backend allow/deny policy

This is another area where Crabbox’s lease TTL and spend-guardrail approach is good prior art.

---

## 21. Minimal Viable Runtime

A realistic MVP should support:

### Front doors

- CLI
- TypeScript SDK
- MCP tools

### Task types

- `agent.run`
- `command.run`

### Backends

- local debug backend
- AWS AgentCore Runtime adapter as the first remote backend

### Core capabilities

- create task
- get task status
- stream logs/events
- cancel task
- collect result
- artifact upload/download
- automatic cleanup
- reusable session optional but not required in v1

### Recommended MVP position

Build the runtime around **AgentCore-backed ephemeral sessions first**, because that gives AgentDispatch a production-grade isolated agent backend without first building its own VM or container provisioning stack.

The first adapter should assume:

- a deployed AgentCore Runtime endpoint ARN is supplied in configuration
- AgentDispatch generates and stores runtime session IDs
- `agent.run` invokes the endpoint with the normalized payload
- `command.run` uses command execution in the same session
- AgentDispatch persists logs, task state, result summaries, and artifact metadata outside AgentCore
- runtime deployment and endpoint/version management are post-MVP concerns

---

## 22. AWS AgentCore Runtime Adapter

### Adapter responsibility

The AWS AgentCore adapter is responsible for translating AgentDispatch runtime operations into Bedrock AgentCore data-plane calls.

It should implement:

- session ID creation and reuse
- `agent.run` invocation
- `command.run` invocation
- stream-to-event translation
- cancellation through session stop where applicable
- backend capability reporting
- AWS error normalization

It should not own:

- AgentDispatch task identity
- user-facing task status
- cross-backend scheduling policy
- durable artifact catalog
- SDK/CLI/MCP API semantics

### Primitive mapping

| AgentDispatch primitive | AgentCore primitive |
|---|---|
| Runtime backend | AgentCore adapter configuration |
| Worker | AgentCore Runtime endpoint/version |
| Session | AgentCore runtime session ID |
| `agent.run` task | `InvokeAgentRuntime` |
| `command.run` task | `InvokeAgentRuntimeCommand` |
| Stream event | invocation or command stream chunk |
| Cancel/release | stop runtime session |
| Backend capability | region, runtime ARN, qualifier, protocol, command support |

### Required configuration

The adapter should be configured with:

- AWS region
- AgentCore Runtime ARN
- endpoint qualifier, defaulting to `DEFAULT`
- invocation protocol
- maximum task duration
- command execution enabled/disabled flag
- IAM role or credential source for control-plane use

### Session semantics

AgentDispatch should generate a runtime session ID for each ephemeral task unless the request explicitly targets a reusable session.

Session IDs must be persisted because they are needed to:

- attach follow-up invocations to the same AgentCore microVM
- run deterministic commands in the same environment as the agent
- stop or clean up the session
- correlate AgentCore-side behavior with AgentDispatch task state

AgentCore can preserve filesystem state across stop/resume cycles, but AgentDispatch should still copy durable results and artifacts into its own artifact store before marking a task complete.

### Streaming semantics

The adapter should normalize AgentCore streams into AgentDispatch events.

For agent invocations:

- streamed model or agent output becomes `task.progress`
- stdout/stderr-like diagnostic output becomes `task.log`
- final payload becomes `result_json`

For command invocations:

- command start becomes `task.progress`
- stdout/stderr deltas become `task.log`
- command stop becomes `task.succeeded` or `task.failed` depending on exit code and timeout status

### Asynchronous task semantics

AgentCore supports agents that return quickly and continue background work while reporting busy status through health/ping behavior.

AgentDispatch should model that as:

1. submit task and receive dispatch handle immediately
2. invoke AgentCore
3. keep the AgentDispatch task `running` while the AgentCore session reports busy or while the adapter can observe continued work
4. collect final result or timeout according to AgentDispatch policy
5. persist final status independently of the client connection

This preserves the AgentDispatch product promise: async task handles are durable even when the initiating client is MCP-bound or disconnects.

### Packaging assumptions

The first AgentCore worker image should include:

- AgentDispatch-compatible agent entrypoint
- supported agent framework dependencies
- command-mode dependencies needed by expected workflows
- artifact export helper
- health/ping behavior compatible with long-running tasks
- logging conventions that the adapter can parse or forward

### Known constraints

- AgentCore is an agent hosting runtime, not a complete AgentDispatch task database.
- AgentCore sessions require stable runtime session IDs for affinity; generated IDs should satisfy the AgentCore minimum length requirement.
- Long-running behavior is bounded by AgentCore runtime limits, including extended execution limits and idle-session termination behavior.
- Command execution depends on tools available inside the deployed container image.
- Runtime deployment, version promotion, and endpoint management add operational complexity and should not block the first invocation adapter.

---

## 23. Open Questions

1. Should the first reusable abstraction be **session** or **lease**?  
   `session` is broader and more product-neutral.

2. Should task payloads be fully opaque to the runtime, or partially typed by task type?  
   Recommendation: typed envelope, partially opaque body.

3. Should v1 create AgentCore runtimes, or only invoke pre-existing runtime endpoints?  
   Recommendation: invoke pre-existing endpoints first; add deployment/version management later.

4. Do we need nested delegation visibility in v1?  
   Recommendation: yes, at least parent-task ID and lineage metadata.

5. Should logs stream through the control plane, directly from worker, or hybrid?  
   Recommendation: hybrid, with control-plane durability and optional direct low-latency streams.

6. Should MCP expose long-running task handles as first-class resources?  
   Recommendation: yes.

7. How should AgentDispatch collect file artifacts from AgentCore sessions?  
   Recommendation: require an explicit artifact export contract in the worker image for v1.

---

## 24. Proposed V1 Data Model

### Task

```text
Task {
  id
  owner
  org
  parent_task_id?
  task_type
  input_json
  execution_json
  backend_selected
  backend_ref_json?
  session_id?
  status
  created_at
  started_at?
  ended_at?
  error_code?
  error_message?
  result_json?
}
```

### Session

```text
Session {
  id
  owner
  backend
  mode
  status
  worker_ref
  external_session_ref?
  capabilities_json
  expires_at?
  created_at
  released_at?
}
```

### Artifact

```text
Artifact {
  id
  task_id
  kind
  uri
  size_bytes
  content_type
  created_at
}
```

### Event

```text
Event {
  id
  task_id
  sequence
  type
  payload_json
  created_at
}
```

---

## 25. Recommended Implementation Plan

### Phase 1: canonical runtime contract

- define task/session/event schemas
- implement control-plane state machine
- implement CLI + SDK + MCP request normalization

### Phase 2: AWS AgentCore invocation adapter

- backend adapter interface
- configured AgentCore Runtime ARN support
- runtime session ID creation and persistence
- `InvokeAgentRuntime` task execution path
- stream/log/result persistence

### Phase 3: command mode and lifecycle control

- `InvokeAgentRuntimeCommand` execution path
- command stream event normalization
- cancellation through runtime session stop
- retries within AgentDispatch policy
- artifact retrieval

### Phase 4: reusable sessions and deployment management

- warm sessions
- affinity reuse
- AgentCore runtime deployment/version/endpoint management
- better cost/capacity routing

---

## 26. Recommendation

For AgentDispatch, the **core runtime should be defined first as a durable task-control plane**, not merely as remote command execution.

That means the primary abstraction is:

> a durable dispatched task with a stable handle and managed execution lifecycle

not:

> a shell command on a remote machine

Crabbox is excellent prior art for isolated worker provisioning, lifecycle, and control-plane ownership. AgentDispatch should adopt those strengths while generalizing the abstraction upward from **leased box** to **dispatched agent task**.

---

## 27. One-Sentence Product Framing

AgentDispatch is a control plane for durable agent task execution: submit work from an SDK, CLI, or MCP client, run it on isolated remote workers, and retrieve logs, artifacts, and results through a stable async handle.
