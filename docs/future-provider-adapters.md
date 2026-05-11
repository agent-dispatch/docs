# Future Provider Adapter Guide

AgentDispatch must add providers without changing MCP tools. New providers implement the `BackendAdapter` interface from `@agent-dispatch/core` and are selected by the routing key:

```text
provider + capability + task_type + target.mode
```

## Adapter Checklist

An adapter must:

- declare `provider` and `capabilities()`
- resolve a provider-neutral `DispatchRequest` into a provider-specific `RuntimeTarget`
- provision any runtime/session/job/service resources needed by the target mode
- start the task and return provider-neutral refs/results/artifacts
- emit provider-neutral `RuntimeEvent` values
- implement cancellation
- implement cleanup
- keep provider-specific fields inside adapter config, `target.details`, or `providerRefs`

The SDK and MCP server must not import provider-specific types.

## Framework Adapters Are Separate

Do not model Strands, LangChain, LangGraph, CrewAI, or OpenAI Agents as cloud backend adapters. Those are worker-side agent framework adapters. A cloud adapter provisions and invokes an execution target; the worker selects the agent framework from payload/config and returns normalized events, results, and artifacts.

This separation keeps the routing key stable:

```text
provider + capability + task_type + target.mode
```

and lets the same AWS AgentCore runtime image support multiple deep-agent frameworks without adding provider-specific MCP tools.

## Capability Examples

AWS:

- `agent-runtime`: AgentCore
- `service-deploy`: ECS, App Runner, Lambda, or EKS
- `job-runner`: Batch, ECS task, or Lambda

GCP:

- `agent-runtime`: Cloud Run service or Vertex AI Agent Engine
- `service-deploy`: Cloud Run
- `job-runner`: Cloud Run Jobs

Azure:

- `agent-runtime`: Container Apps or Azure AI Foundry agent runtime
- `service-deploy`: Container Apps or App Service
- `job-runner`: Container Apps Jobs

Kubernetes:

- `agent-runtime`: Deployment plus Service
- `service-deploy`: Deployment, Service, and Ingress
- `job-runner`: Job or CronJob

Local:

- `agent-runtime`: child process
- `job-runner`: local process or Docker container

## Account Profiles

Credentials are configured outside MCP calls:

```json
{
  "accounts": {
    "prod-gcp": {
      "provider": "gcp",
      "projectId": "my-project",
      "region": "us-central1",
      "credentialSource": "gcloud-default"
    },
    "prod-azure": {
      "provider": "azure",
      "subscriptionId": "...",
      "tenantId": "...",
      "region": "eastus",
      "credentialSource": "azure-default"
    }
  }
}
```

MCP calls reference `account_profile`; they never pass raw credentials.

## Testing Expectations

Every adapter should:

- import `assertBackendAdapterContract` from `@agent-dispatch/core`
- test supported capabilities and target modes
- test provider error normalization
- test cancellation and cleanup
- test provider refs are returned without leaking credentials
- include live tests behind an explicit environment gate

Example live-test gate:

```bash
AGENTDISPATCH_LIVE_GCP=1 npm test
```

No future provider should require a new MCP tool. If a provider cannot fit the existing `dispatch_task` shape, update the core provider model first rather than adding provider-specific tool names.
