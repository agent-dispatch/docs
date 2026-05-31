#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const docsRoot = resolve(scriptDir, "..");
const workspaceRoot = resolve(process.env.AGENTDISPATCH_WORKSPACE_ROOT ?? join(docsRoot, ".."));

const packages = [
  {
    repo: "agentdispatch-core",
    packageName: "@agent-dispatch/core",
    purpose: ["Provider-neutral", "Adapter contract", "RuntimeService"]
  },
  {
    repo: "agentdispatch-mcp-server",
    packageName: "@agent-dispatch/mcp-server",
    purpose: ["spawn_cloud_agent", "check_cloud_agent_runtime", "get_task_result"],
    mcpSnippet: true
  },
  {
    repo: "agentdispatch-sdk-js",
    packageName: "@agent-dispatch/sdk",
    purpose: ["AgentDispatchStdioClient", "spawnCloudAgent", "sendCloudAgentA2AMessage"],
    mcpSnippet: true
  },
  {
    repo: "agentdispatch-cli",
    packageName: "@agent-dispatch/cli",
    purpose: ["agentdispatch init", "agentdispatch doctor", "spawn_cloud_agent"],
    mcpSnippet: true
  },
  {
    repo: "agentdispatch-store-sqlite",
    packageName: "@agent-dispatch/store-sqlite",
    purpose: ["SQLite", "durable", "artifacts"]
  },
  {
    repo: "agentdispatch-adapter-aws-agentcore",
    packageName: "@agent-dispatch/adapter-aws-agentcore",
    purpose: ["AWS AgentCore", "session", "runtime"]
  },
  {
    repo: "agentdispatch-worker-agentcore",
    packageName: "@agent-dispatch/worker-agentcore",
    purpose: ["AgentCore worker", "A2A", "message/send"]
  },
  {
    repo: "agentdispatch-adapter-template",
    packageName: "@agent-dispatch/adapter-template",
    purpose: ["GCP", "Azure", "Kubernetes"]
  }
];

const failures = [];

for (const pkg of packages) {
  const readmePath = join(workspaceRoot, pkg.repo, "README.md");
  const readme = await readFile(readmePath, "utf8");
  const label = `${pkg.repo}/README.md`;

  mustInclude(readme, `# ${pkg.packageName}`, label, "starts with package name");
  mustInclude(readme, "AgentDispatch", label, "names the project");
  mustInclude(readme, "npm install", label, "has an install command");
  mustInclude(readme, "npm run typecheck", label, "documents typecheck command");
  mustInclude(readme, "npm test", label, "documents test command");
  mustInclude(readme, "npm run build", label, "documents build command");

  if (!/MCP|adapter|cloud|AgentCore|provider-neutral/i.test(readme)) {
    failures.push(`${label}: does not explain how the package fits the AgentDispatch architecture`);
  }

  for (const expected of pkg.purpose) {
    mustInclude(readme, expected, label, `mentions ${expected}`);
  }

  if (pkg.mcpSnippet) {
    if (!/"command"\s*:\s*"npx"|command\s*:\s*"npx"/.test(readme)) {
      failures.push(`${label}: missing MCP npx command`);
    }
    mustInclude(readme, '"-y"', label, "uses non-interactive npx in MCP config");
    mustInclude(readme, '"@agent-dispatch/mcp-server"', label, "uses package name in MCP config");
  }
}

await assertSyncedAsset(
  "agentdispatch-github-profile/profile/assets/repo-social-preview.png",
  "agentdispatch-website/src/assets/repo-social-preview.png"
);
await assertSyncedAsset(
  "agentdispatch-github-profile/profile/assets/org-logo.svg",
  "agentdispatch-website/src/assets/org-logo.svg"
);

const docsReadme = await readFile(join(docsRoot, "README.md"), "utf8");
mustInclude(docsReadme, "./docs/live-aws-verification.md", "README.md", "links live AWS verification runbook");

const liveAwsVerification = await readFile(join(docsRoot, "docs", "live-aws-verification.md"), "utf8");
for (const expected of [
  "AGENTDISPATCH_LIVE_DISPATCH=1",
  "What This Proves",
  "What This Does Not Prove",
  "Launch Claim Rule",
  "sample placeholder"
]) {
  mustInclude(liveAwsVerification, expected, "docs/live-aws-verification.md", `documents ${expected}`);
}

const launchChecklist = await readFile(join(docsRoot, "docs", "repo-launch-checklist.md"), "utf8");
mustInclude(launchChecklist, "./live-aws-verification.md", "docs/repo-launch-checklist.md", "links live AWS runbook");

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Checked launch readiness for ${packages.length} package READMEs.`);

function mustInclude(text, expected, label, reason) {
  if (!text.includes(expected)) {
    failures.push(`${label}: missing ${JSON.stringify(expected)} (${reason})`);
  }
}

async function assertSyncedAsset(source, copy) {
  const sourceHash = hash(await readFile(join(workspaceRoot, source)));
  const copyHash = hash(await readFile(join(workspaceRoot, copy)));
  if (sourceHash !== copyHash) {
    failures.push(`${copy}: must match ${source}`);
  }
}

function hash(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
