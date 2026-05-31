# Live AWS Verification

Use this page only after the local gate passes. The local gate proves package wiring, CLI startup, MCP server startup, SQLite persistence, docs validation, website validation, and package-consumption smoke tests without touching AWS. Live verification proves the configured AWS AgentCore path against real account state.

## What This Proves

`npm --prefix agentdispatch-docs run verify:aws-live` runs `agentdispatch doctor --aws-live --json` through the local CLI build when available, or the published CLI otherwise.

For a session-mode runtime, the live preflight proves:

- the selected runtime profile exists and routes through the `aws-agentcore` adapter
- AWS credentials resolve through the SDK default provider chain
- the configured region is reachable
- the configured AgentCore runtime ARN is real and reachable
- the runtime reports a status that AgentDispatch can inspect before dispatch

With `AGENTDISPATCH_LIVE_DISPATCH=1`, the script also submits a real `agentdispatch run --wait` task and waits for a terminal AgentDispatch result.

Successful runs write a JSON evidence file. By default it is `agentdispatch-live-aws-report.json` in the current directory. Override it with `AGENTDISPATCH_LIVE_REPORT=/absolute/path/live-aws-report.json`.

## What This Does Not Prove

Preflight alone does not prove the cloud worker can complete an arbitrary task. It does not upload worker images, create IAM roles, change quotas, or guarantee that a runtime image contains your requested framework tools.

Only the `AGENTDISPATCH_LIVE_DISPATCH=1` path, or an equivalent successful `spawn_cloud_agent` call against the same runtime, proves live cloud dispatch end to end.

## Prerequisites

You need:

- AWS credentials available to the AWS SDK default provider chain
- a real AgentCore Runtime ARN, not the sample placeholder
- the matching AWS region in the config or `AWS_REGION`
- IAM permission for `bedrock-agentcore:GetAgentRuntime`
- IAM permission for invocation when running the dispatch step
- a runtime image whose protocol matches the AgentDispatch runtime config, such as `a2a` or `http`

For session mode, the config must point at an existing runtime:

```json
{
  "backends": {
    "aws-agentcore": {
      "provider": "aws",
      "capability": "agent-runtime",
      "adapter": "aws-agentcore",
      "account": "dev-aws",
      "details": {
        "runtimeArn": "arn:aws:bedrock-agentcore:us-west-2:123456789012:agent/11111111-1111-1111-1111-111111111111:1",
        "qualifier": "DEFAULT",
        "protocol": "a2a"
      }
    }
  }
}
```

## Preflight Command

Run this from the parent multi-repo workspace:

```bash
AGENTDISPATCH_CONFIG=/absolute/path/agentdispatch.config.json \
AGENTDISPATCH_RUNTIME=research-agent \
AGENTDISPATCH_LIVE_REPORT=./agentdispatch-live-aws-report.json \
npm --prefix agentdispatch-docs run verify:aws-live
```

Expected successful ending:

```text
Live AWS preflight passed.
Set AGENTDISPATCH_LIVE_DISPATCH=1 to also submit a real cloud task.
```

The report records the target runtime, region, protocol, doctor checks, whether dispatch was requested, and the claim supported by the run. It does not include AWS secret values.

If the script fails before calling AWS, fix the named local config issue first. If it fails during `doctor --aws-live`, use the failed check name and message from the JSON report to decide whether the problem is credentials, region, permissions, runtime ARN, or runtime readiness.

## Real Dispatch Command

This submits a real cloud task, may incur AWS cost, and writes task state under the configured `stateDir`:

```bash
AGENTDISPATCH_CONFIG=/absolute/path/agentdispatch.config.json \
AGENTDISPATCH_RUNTIME=research-agent \
AGENTDISPATCH_LIVE_DISPATCH=1 \
AGENTDISPATCH_LIVE_INSTRUCTION="AgentDispatch live smoke: respond with a short success message and no external side effects." \
AGENTDISPATCH_LIVE_REPORT=./agentdispatch-live-aws-dispatch-report.json \
npm --prefix agentdispatch-docs run verify:aws-live
```

Successful output includes the initial task handle, streamed logs if the runtime emits any, and the final AgentDispatch result JSON.

For launch evidence, keep the generated report with the release checklist. The report claim should read `Live AWS dispatch verified against a real AgentCore runtime.` before making a public live-dispatch claim.

## GitHub Actions Evidence

The docs repo includes a manual `Live AWS Verification` workflow. Configure these repository secrets before running it:

- `AGENTDISPATCH_CONFIG_JSON`: the full AgentDispatch config JSON
- `AGENTDISPATCH_AWS_REGION`: AWS region for credential configuration
- `AWS_ROLE_ARN`: optional OIDC role to assume
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`: optional static credentials when OIDC is not used
- `AGENTDISPATCH_LIVE_INSTRUCTION`: optional custom smoke instruction

Run the workflow manually, choose the runtime profile, and set `live_dispatch=true` only when you want to submit a real cloud task. Successful runs upload `agentdispatch-live-aws-report.json` as the workflow artifact.

## Troubleshooting

- `runtime was not found`: set `AGENTDISPATCH_RUNTIME` to a configured runtime profile or update `defaults.runtime`.
- `sample placeholder AgentCore runtime ARN`: replace the generated example ARN with a real runtime ARN.
- `AWS credentials could not be resolved`: configure `AWS_PROFILE`, `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`, SSO, or another SDK-supported credential source.
- `runtime was not reachable`: check region, runtime ARN, `bedrock-agentcore:GetAgentRuntime`, and whether the AgentCore runtime still exists.
- dispatch times out after preflight passes: inspect the AgentCore runtime logs and confirm the worker image implements the configured protocol.
- report file is missing: the script did not reach a successful preflight, or the `AGENTDISPATCH_LIVE_REPORT` path was not writable.

## Launch Claim Rule

Do not claim live AWS dispatch has been verified unless the real dispatch command above, or an equivalent live `spawn_cloud_agent` call, has succeeded against a real runtime. Local E2E and live preflight are valuable but narrower claims.
