# AgentDispatch Local Demo Transcript

This transcript is the launch-demo path that works without live AWS credentials. It proves the CLI, config shape, package wiring, and MCP server startup locally. Live AWS AgentCore dispatch remains a separate opt-in step because it needs real account credentials and a runtime ARN.

## 90-Second Flow

```bash
npm install -g @agent-dispatch/cli

agentdispatch init \
  --region us-west-2 \
  --runtime-arn arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/research-agent \
  --protocol a2a

agentdispatch doctor --config ./agentdispatch.config.json

npx -y @agent-dispatch/mcp-server \
  --config ./agentdispatch.config.json \
  --check
```

Expected local shape:

```text
Wrote ./agentdispatch.config.json
AgentDispatch doctor passed
MCP server check passed
```

Then connect a lead agent with:

```json
{
  "mcpServers": {
    "agentdispatch": {
      "command": "npx",
      "args": [
        "-y",
        "@agent-dispatch/mcp-server",
        "--config",
        "/absolute/path/agentdispatch.config.json"
      ]
    }
  }
}
```

Ask the lead agent:

```text
Use AgentDispatch to spawn a cloud agent for this repository audit.
Keep working locally while it runs, then poll the result.
```

For client-specific copy, use the [lead agent prompt kit](./lead-agent-prompt-kit.md).

The agent-facing call is:

```json
{
  "tool": "spawn_cloud_agent",
  "arguments": {
    "runtime": "research-agent",
    "instruction": "Audit this repository while I keep working locally.",
    "protocol": "a2a",
    "context": {
      "repo": "agent-dispatch",
      "priority": "background"
    }
  }
}
```

## Full Local Verification

From the multi-repo workspace:

```bash
AGENTDISPATCH_VERIFY_INSTALL=1 npm --prefix agentdispatch-docs run verify:local-e2e
```

This gate installs each package cleanly, overlays local package tarballs into downstream packages, runs tests, typechecks, builds, validates docs/profile/website assets, smoke-tests package consumption, creates a config with the built CLI, and checks the built MCP server.

Successful local output ends with:

```text
AgentDispatch local end-to-end verification passed.
Note: live AWS AgentCore dispatch is intentionally not run by this local gate.
```

## Live AWS Add-On

After configuring real AWS credentials and an AgentCore runtime ARN:

```bash
AGENTDISPATCH_CONFIG=/absolute/path/agentdispatch.config.json \
npm --prefix agentdispatch-docs run verify:aws-live
```

To submit a real cloud task after live preflight passes:

```bash
AGENTDISPATCH_CONFIG=/absolute/path/agentdispatch.config.json \
AGENTDISPATCH_LIVE_DISPATCH=1 \
npm --prefix agentdispatch-docs run verify:aws-live
```
