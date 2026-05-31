# Release Runbook

Use this runbook when publishing AgentDispatch packages. AgentDispatch is split across separate repositories, so releases need dependency order, provenance, and claim discipline.

## Release Order

Publish public packages in this order:

1. `@agent-dispatch/core`
2. `@agent-dispatch/store-sqlite`
3. `@agent-dispatch/adapter-aws-agentcore`
4. `@agent-dispatch/sdk`
5. `@agent-dispatch/worker-agentcore`
6. `@agent-dispatch/mcp-server`
7. `@agent-dispatch/cli`

`@agent-dispatch/adapter-template` is private template source. Do not publish it unless the repository is intentionally converted into a public package.

## Required Local Gate

Run the multi-repo local gate before any release:

```bash
AGENTDISPATCH_VERIFY_INSTALL=1 npm --prefix agentdispatch-docs run verify:local-e2e
```

This proves package installs, tests, typechecks, builds, package tarball consumption, CLI bootstrap, MCP server startup, docs validation, profile assets, and website validation against the current workspace.

For launch notes, retain a local evidence report:

```bash
AGENTDISPATCH_VERIFY_INSTALL=1 \
AGENTDISPATCH_LOCAL_E2E_REPORT=./agentdispatch-local-e2e-report.json \
npm --prefix agentdispatch-docs run verify:local-e2e
```

Then record the release status summary:

```bash
npm --prefix agentdispatch-docs run status:release
```

This reports repo cleanliness, commits ahead of `origin/main`, launch gate commands, and live AWS evidence state before the announcement.

Check local package versions against npm before running publish workflows:

```bash
npm --prefix agentdispatch-docs run status:npm
```

This reports which public packages are already synced with npm and which local package versions are pending publication.

## Required Published-Install Gate

After the package line is published, run the registry canary:

```bash
npm --prefix agentdispatch-docs run smoke:published
```

This installs the current public npm versions into a fresh consumer project, imports every public package, and checks the published `agentdispatch` and `agentdispatch-mcp` bins. Use this before launch posts that tell users to install from npm.

## Package Repo Gate

Each public package repo must have:

- `.github/workflows/ci.yml`
- `.github/workflows/publish.yml`
- `docs/release.md`
- `publishConfig.access = "public"`
- `engines.node >=20.19`
- `files` limited to runtime output, README, LICENSE, and required runtime assets
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm publish --provenance --access public` in the publish workflow
- `permissions.id-token: write` in the publish workflow for npm Trusted Publisher

The adapter template must keep CI and `docs/release.md`, but it must remain private.

## Trusted Publisher Setup

For each public package, configure npm Trusted Publisher against its repository and workflow:

| Package | GitHub repository | Workflow |
| --- | --- | --- |
| `@agent-dispatch/core` | `agent-dispatch/core` | `.github/workflows/publish.yml` |
| `@agent-dispatch/store-sqlite` | `agent-dispatch/store-sqlite` | `.github/workflows/publish.yml` |
| `@agent-dispatch/adapter-aws-agentcore` | `agent-dispatch/adapter-aws-agentcore` | `.github/workflows/publish.yml` |
| `@agent-dispatch/sdk` | `agent-dispatch/sdk-js` | `.github/workflows/publish.yml` |
| `@agent-dispatch/worker-agentcore` | `agent-dispatch/worker-agentcore` | `.github/workflows/publish.yml` |
| `@agent-dispatch/mcp-server` | `agent-dispatch/mcp-server` | `.github/workflows/publish.yml` |
| `@agent-dispatch/cli` | `agent-dispatch/cli` | `.github/workflows/publish.yml` |

Do not publish from a developer laptop for public releases. Use the `Publish` GitHub Actions workflow so the npm package has provenance.

## Per-Package Publish

For each package in release order:

1. Confirm the version has not already been published.
2. Confirm CI is green on `main`.
3. Confirm `docs/release.md` names the correct upstream package dependencies.
4. Run the manual `Publish` workflow with the intended version.
5. Confirm npm shows provenance for the package version.
6. Move to the next package after npm propagation.

Downstream package publish workflows update upstream `@agent-dispatch/*` dependencies before typecheck, test, build, and publish.

## Live AWS Claim Boundary

Package releases do not prove live AWS dispatch. Use [Live AWS verification](./live-aws-verification.md) before making live-cloud claims:

```bash
AGENTDISPATCH_CONFIG=/absolute/path/agentdispatch.config.json \
AGENTDISPATCH_LIVE_DISPATCH=1 \
AGENTDISPATCH_LIVE_REPORT=./agentdispatch-live-aws-dispatch-report.json \
npm --prefix agentdispatch-docs run verify:aws-live
```

Only a successful `AGENTDISPATCH_LIVE_DISPATCH=1` run, or an equivalent successful live `spawn_cloud_agent` call against a real runtime, proves live cloud dispatch end to end.
