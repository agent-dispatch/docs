# AgentDispatch Repo Launch Checklist

Use this checklist before a public push, announcement, or launch post. The goal is simple: a first-time visitor should understand AgentDispatch in 10 seconds, try it in 2 minutes, and know exactly where to contribute.

## First Screen

- The GitHub profile and primary README start with the same hook: "Spawn cloud subagents from any MCP-capable lead agent."
- The first paragraph says what it is, who uses it, and why MCP matters.
- The V1 constraint is explicit: AWS AgentCore first, provider-neutral by design.
- The README shows the real tool name: `spawn_cloud_agent`.
- The README shows the durable output concepts: `task_id`, polling, logs, result, cancellation, and `cloud_agent` metadata.

## Try-It Path

- `npm install -g @agent-dispatch/cli` works for the published CLI.
- `agentdispatch init` creates a valid sample config.
- `agentdispatch doctor --config ./agentdispatch.config.json` validates the config without requiring a live AWS call.
- `agentdispatch doctor --aws-live --runtime research-agent` is documented as opt-in because it touches external AWS state.
- The MCP JSON snippet uses `npx -y @agent-dispatch/mcp-server --config /absolute/path/agentdispatch.config.json`.
- The quickstart explains what a lead agent should ask for after MCP is connected.

## Demo Assets

- Use the [Examples](./examples.md) index to choose the right no-cloud, npm canary, prompt-kit, live preflight, or live dispatch path.
- Include the copyable [local demo transcript](./local-demo-transcript.md) for launch posts and README links when a recorded demo is not available yet.
- Include the [lead agent prompt kit](./lead-agent-prompt-kit.md) so Claude Code, Codex, OpenClaw, Hermes, and other MCP users can try AgentDispatch from copy-paste prompts.
- Run `npm --prefix agentdispatch-docs run demo:local` before recording or posting the demo.
- Record a short terminal demo:
  - create config
  - run doctor
  - connect MCP server with `--check`
  - call `spawn_cloud_agent`
  - poll status/logs/result
- Keep the demo under 90 seconds.
- Put the demo near the top of the README or website.
- Use real command output when possible; mark mock output clearly when credentials or cloud state are not available.

## Repo Graph

- GitHub organization profile links to the main repos in this order:
  - `mcp-server`
  - `core`
  - `adapter-aws-agentcore`
  - `worker-agentcore`
  - `cli`
  - `sdk-js`
  - `docs`
- Each repo README has:
  - one-sentence purpose
  - install command
  - minimal usage snippet
  - how it fits the overall architecture
  - test/build commands
- Package names and repo names use the same public spelling: `@agent-dispatch/*` and `agent-dispatch/*`.

## Contributor Hooks

- Use the [Contributor issue bank](./contributor-issue-bank.md) to seed launch-day issues with repo, labels, acceptance criteria, and verification commands.
- Add "good first adapter" issues for:
  - local child-process adapter
  - Kubernetes Job adapter
  - GCP Cloud Run Jobs adapter
  - Azure Container Apps Jobs adapter
- Add "good first worker framework" issues for:
  - command-backed worker examples
  - LangChain worker adapter
  - LangGraph worker adapter
  - OpenAI Agents worker adapter
- Add one architecture issue for artifact browsing and one for provider-neutral live preflight.
- Keep the org-wide issue templates in `agent-dispatch/.github` aligned with these contribution paths.

## Announcement Copy

Use the copy-ready [launch announcement kit](./launch-announcement-kit.md) for GitHub, X, LinkedIn, Hacker News, Reddit, and demo narration. Keep the language direct and technical:

```text
AgentDispatch lets a local MCP-capable lead agent spawn a durable cloud subagent.

One tool call:
spawn_cloud_agent(...)

The lead agent gets a task_id for polling and cloud_agent metadata for A2A/MCP/HTTP follow-up.

V1 runs on AWS AgentCore. The contract is provider-neutral so GCP, Azure, Kubernetes, and local runtimes can be adapters.
```

Avoid overclaiming autonomy or production maturity. The most credible message is the architecture: stable MCP surface, durable state, provider adapters, and no raw cloud credentials in tool payloads.

## Verification Before Launch

Use the [verification matrix](./verification-matrix.md) to keep local E2E, live preflight, and live dispatch claims separate.
Use the [release runbook](./release-runbook.md) before publishing npm packages so release order, Trusted Publisher, and provenance stay explicit.

From the local multi-repo workspace, run the single production gate:

```bash
npm --prefix agentdispatch-docs run verify:local-e2e
```

That gate checks the GitHub org image assets, runs every package test/typecheck/build, packs the publishable packages into a temporary consumer project, and exercises the built CLI plus MCP server with a generated local config.

Run from each package repo:

```bash
npm test
npm run typecheck
npm run build
```

Run from docs:

```bash
npm run status:release
npm run status:npm
npm test
npm run smoke:packages
npm run smoke:published
```

Use [Release status](./release-status.md) to record repo cleanliness, commits ahead of `origin/main`, launch gate commands, and the current live AWS evidence boundary before posting.

Run from website:

```bash
npm test
npm run build
```

If live AWS checks are available:

```bash
AGENTDISPATCH_CONFIG=/absolute/path/agentdispatch.config.json \
AGENTDISPATCH_LIVE_REPORT=./agentdispatch-live-aws-report.json \
npm --prefix agentdispatch-docs run verify:aws-live
```

To submit an actual cloud task after live preflight passes:

```bash
AGENTDISPATCH_CONFIG=/absolute/path/agentdispatch.config.json \
AGENTDISPATCH_LIVE_DISPATCH=1 \
AGENTDISPATCH_LIVE_REPORT=./agentdispatch-live-aws-dispatch-report.json \
npm --prefix agentdispatch-docs run verify:aws-live
```

Live AWS dispatch is deliberately separate from the local gate because it depends on external credentials, account state, quotas, cost, and a real AgentCore runtime ARN. Do not claim live cloud dispatch has been verified unless this command, or an actual `spawn_cloud_agent` against a real runtime, has been run successfully.

Use [Live AWS verification](./live-aws-verification.md) as the authoritative runbook for required AWS inputs, what preflight proves, what real dispatch proves, how to write the JSON evidence report, and how to troubleshoot failed live checks.

If using GitHub Actions instead of a local terminal, run the docs repo `Live AWS Verification` workflow and download the uploaded `agentdispatch-live-aws-report.json` artifact.

## Success Criteria

- A visitor can explain the project after reading the first screen.
- A lead-agent builder knows which repo to install.
- An adapter author knows which interface to implement.
- A security-conscious user sees that account profiles keep credentials outside MCP payloads.
- A contributor can find a concrete issue without understanding the whole system.
