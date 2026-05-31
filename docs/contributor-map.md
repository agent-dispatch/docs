# Contributor Map

Use this map when you want to help but do not yet know which AgentDispatch repo owns the work.

## Pick A Lane

| You want to work on | Start here | Good first issue |
| --- | --- | --- |
| MCP tool behavior | [`mcp-server`](https://github.com/agent-dispatch/mcp-server) | Improve `spawn_cloud_agent`, preflight, status, logs, result, or cancellation ergonomics. |
| Provider-neutral runtime model | [`core`](https://github.com/agent-dispatch/core) | Tighten task lifecycle, adapter contracts, target routing, or capability metadata. |
| AWS AgentCore behavior | [`adapter-aws-agentcore`](https://github.com/agent-dispatch/adapter-aws-agentcore) | Improve error normalization, live preflight, session/runtime mode coverage, or protocol metadata. |
| Cloud-side worker behavior | [`worker-agentcore`](https://github.com/agent-dispatch/worker-agentcore) | Add framework adapters, worker health checks, A2A/HTTP protocol coverage, or artifact export helpers. |
| CLI experience | [`cli`](https://github.com/agent-dispatch/cli) | Improve `init`, `doctor`, `run`, polling, A2A follow-up, or config diagnostics. |
| TypeScript app integration | [`sdk-js`](https://github.com/agent-dispatch/sdk-js) | Improve typed client APIs, MCP handoff examples, or transport helpers. |
| Durable local state | [`store-sqlite`](https://github.com/agent-dispatch/store-sqlite) | Improve task/event/log/artifact queries or migration behavior. |
| New provider adapters | [`adapter-template`](https://github.com/agent-dispatch/adapter-template) | Start a local, Kubernetes, GCP Cloud Run, or Azure Container Apps adapter. |
| Docs, launch, website, profile | [`docs`](https://github.com/agent-dispatch/docs), [`website`](https://github.com/agent-dispatch/website), [`.github`](https://github.com/agent-dispatch/.github) | Improve quickstarts, verification evidence, launch copy, profile assets, or examples. |

## Good First Paths

- [New provider adapter](https://github.com/agent-dispatch/.github/issues/new?template=good_first_adapter.yml)
- [Worker framework integration](https://github.com/agent-dispatch/.github/issues/new?template=good_first_worker.yml)
- [Architecture improvement](https://github.com/agent-dispatch/.github/issues/new?template=architecture_request.yml)
- [Contributor issue bank](./contributor-issue-bank.md) for ready-to-open adapter, worker, and architecture issues with acceptance criteria.

## Architecture Rules

- Keep MCP tools provider-neutral.
- Keep cloud-provider SDKs and provider-specific checks inside adapter packages.
- Keep agent framework integrations in worker-side code, not in cloud backend adapters.
- Keep raw cloud credentials out of MCP payloads.
- Preserve the stable routing shape: `provider + capability + task_type + target.mode`.

## Verification Rules

For package-local changes:

```bash
npm test
npm run typecheck
npm run build
```

For cross-repo behavior:

```bash
AGENTDISPATCH_VERIFY_INSTALL=1 npm --prefix agentdispatch-docs run verify:local-e2e
```

For live cloud claims, use [Live AWS verification](./live-aws-verification.md). Do not say live AWS dispatch has been verified unless the live dispatch path succeeds with real credentials and a real AgentCore runtime ARN.
