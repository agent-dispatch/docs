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
    purpose: ["Provider-neutral", "Adapter contract", "RuntimeService"],
    publicPackage: true
  },
  {
    repo: "agentdispatch-mcp-server",
    packageName: "@agent-dispatch/mcp-server",
    purpose: ["spawn_cloud_agent", "check_cloud_agent_runtime", "get_task_result"],
    mcpSnippet: true,
    publicPackage: true
  },
  {
    repo: "agentdispatch-sdk-js",
    packageName: "@agent-dispatch/sdk",
    purpose: ["AgentDispatchStdioClient", "spawnCloudAgent", "sendCloudAgentA2AMessage"],
    mcpSnippet: true,
    publicPackage: true
  },
  {
    repo: "agentdispatch-cli",
    packageName: "@agent-dispatch/cli",
    purpose: ["agentdispatch init", "agentdispatch doctor", "spawn_cloud_agent"],
    mcpSnippet: true,
    publicPackage: true
  },
  {
    repo: "agentdispatch-store-sqlite",
    packageName: "@agent-dispatch/store-sqlite",
    purpose: ["SQLite", "durable", "artifacts"],
    publicPackage: true
  },
  {
    repo: "agentdispatch-adapter-aws-agentcore",
    packageName: "@agent-dispatch/adapter-aws-agentcore",
    purpose: ["AWS AgentCore", "session", "runtime"],
    publicPackage: true
  },
  {
    repo: "agentdispatch-worker-agentcore",
    packageName: "@agent-dispatch/worker-agentcore",
    purpose: ["AgentCore worker", "A2A", "message/send"],
    publicPackage: true
  },
  {
    repo: "agentdispatch-adapter-template",
    packageName: "@agent-dispatch/adapter-template",
    purpose: ["GCP", "Azure", "Kubernetes"],
    publicPackage: false
  }
];

const failures = [];

for (const pkg of packages) {
  const readmePath = join(workspaceRoot, pkg.repo, "README.md");
  const readme = await readFile(readmePath, "utf8");
  const label = `${pkg.repo}/README.md`;
  const packageJsonLabel = `${pkg.repo}/package.json`;
  const packageJson = JSON.parse(await readFile(join(workspaceRoot, pkg.repo, "package.json"), "utf8"));
  const ciWorkflow = await readFile(join(workspaceRoot, pkg.repo, ".github", "workflows", "ci.yml"), "utf8");
  const releaseDoc = await readFile(join(workspaceRoot, pkg.repo, "docs", "release.md"), "utf8");

  mustInclude(readme, `# ${pkg.packageName}`, label, "starts with package name");
  mustInclude(readme, "AgentDispatch", label, "names the project");
  mustInclude(readme, "npm install", label, "has an install command");
  mustInclude(readme, "npm run typecheck", label, "documents typecheck command");
  mustInclude(readme, "npm test", label, "documents test command");
  mustInclude(readme, "npm run build", label, "documents build command");
  mustInclude(readme, "docs/release.md", label, "links release workflow");

  if (!/MCP|adapter|cloud|AgentCore|provider-neutral/i.test(readme)) {
    failures.push(`${label}: does not explain how the package fits the AgentDispatch architecture`);
  }

  assertReadmeLinksWorkOnNpm(readme, packageJson, label);

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

  mustEqual(packageJson.name, pkg.packageName, packageJsonLabel, "uses expected package name");
  mustEqual(packageJson.type, "module", packageJsonLabel, "uses ESM");
  mustEqual(packageJson.engines?.node, ">=20.19", packageJsonLabel, "requires supported Node version");
  mustIncludeArray(packageJson.files, "dist", packageJsonLabel, "publishes dist");
  mustIncludeArray(packageJson.files, "README.md", packageJsonLabel, "publishes README");
  mustIncludeArray(packageJson.files, "LICENSE", packageJsonLabel, "publishes LICENSE");
  mustInclude(Object.keys(packageJson.scripts ?? {}).join("\n"), "typecheck", packageJsonLabel, "has typecheck script");
  mustInclude(Object.keys(packageJson.scripts ?? {}).join("\n"), "test", packageJsonLabel, "has test script");
  mustInclude(Object.keys(packageJson.scripts ?? {}).join("\n"), "build", packageJsonLabel, "has build script");

  for (const expected of ["actions/setup-node@v4", "npm ci", "npm run typecheck", "npm run build"]) {
    mustInclude(ciWorkflow, expected, `${pkg.repo}/.github/workflows/ci.yml`, `CI runs ${expected}`);
  }
  if (!/npm test(?: --if-present)?/.test(ciWorkflow)) {
    failures.push(`${pkg.repo}/.github/workflows/ci.yml: CI must run npm test`);
  }

  mustInclude(releaseDoc, "Release", `${pkg.repo}/docs/release.md`, "documents release policy");
  if (pkg.publicPackage) {
    mustEqual(packageJson.publishConfig?.access, "public", packageJsonLabel, "publishes publicly");
    const publishWorkflow = await readFile(join(workspaceRoot, pkg.repo, ".github", "workflows", "publish.yml"), "utf8");
    for (const expected of [
      "workflow_dispatch",
      "id-token: write",
      "registry-url: https://registry.npmjs.org",
      "npm ci",
      "npm run typecheck",
      "npm test",
      "npm run build",
      "npm publish --provenance --access public"
    ]) {
      mustInclude(publishWorkflow, expected, `${pkg.repo}/.github/workflows/publish.yml`, `publish workflow includes ${expected}`);
    }
    mustInclude(releaseDoc, "Trusted Publisher", `${pkg.repo}/docs/release.md`, "documents Trusted Publisher");
  } else {
    mustEqual(packageJson.private, true, packageJsonLabel, "keeps template private");
    mustInclude(releaseDoc, "Do not publish", `${pkg.repo}/docs/release.md`, "documents no-publish policy");
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
mustInclude(docsReadme, "./docs/verification-matrix.md", "README.md", "links verification matrix");
mustInclude(docsReadme, "./docs/contributor-map.md", "README.md", "links contributor map");
mustInclude(docsReadme, "./docs/lead-agent-prompt-kit.md", "README.md", "links lead agent prompt kit");
mustInclude(docsReadme, "./docs/release-runbook.md", "README.md", "links release runbook");
mustInclude(docsReadme, "actions/workflows/local-e2e.yml/badge.svg", "README.md", "shows local E2E badge");
mustInclude(docsReadme, "actions/workflows/live-aws-verification.yml/badge.svg", "README.md", "shows live AWS verification badge");

const contributorMap = await readFile(join(docsRoot, "docs", "contributor-map.md"), "utf8");
for (const expected of [
  "good_first_adapter.yml",
  "good_first_worker.yml",
  "architecture_request.yml",
  "provider + capability + task_type + target.mode",
  "verify:local-e2e"
]) {
  mustInclude(contributorMap, expected, "docs/contributor-map.md", `documents ${expected}`);
}

const liveWorkflow = await readFile(join(docsRoot, ".github", "workflows", "live-aws-verification.yml"), "utf8");
for (const expected of [
  "Live AWS Verification",
  "AGENTDISPATCH_CONFIG_JSON",
  "AGENTDISPATCH_LIVE_REPORT",
  "actions/upload-artifact@v4"
]) {
  mustInclude(liveWorkflow, expected, ".github/workflows/live-aws-verification.yml", `configures ${expected}`);
}

const verificationMatrix = await readFile(join(docsRoot, "docs", "verification-matrix.md"), "utf8");
for (const expected of [
  "verify:local-e2e",
  "verify:aws-live",
  "AGENTDISPATCH_LIVE_DISPATCH=1",
  "Do not use local E2E evidence as proof that live AWS dispatch works",
  "Live AWS Verification",
  "actions/workflows/local-e2e.yml"
]) {
  mustInclude(verificationMatrix, expected, "docs/verification-matrix.md", `documents ${expected}`);
}

const liveAwsVerification = await readFile(join(docsRoot, "docs", "live-aws-verification.md"), "utf8");
for (const expected of [
  "AGENTDISPATCH_LIVE_DISPATCH=1",
  "What This Proves",
  "What This Does Not Prove",
  "Launch Claim Rule",
  "sample placeholder",
  "AGENTDISPATCH_LIVE_REPORT",
  "agentdispatch-live-aws-report.json",
  "GitHub Actions Evidence"
]) {
  mustInclude(liveAwsVerification, expected, "docs/live-aws-verification.md", `documents ${expected}`);
}

const leadAgentPromptKit = await readFile(join(docsRoot, "docs", "lead-agent-prompt-kit.md"), "utf8");
for (const expected of [
  "Claude Code",
  "Codex",
  "OpenClaw",
  "Hermes",
  "spawn_cloud_agent",
  "check_cloud_agent_runtime",
  "get_task_status",
  "get_task_logs",
  "get_task_result",
  "AGENTDISPATCH_LIVE_DISPATCH=1",
  "A2A Follow-Up Prompt"
]) {
  mustInclude(leadAgentPromptKit, expected, "docs/lead-agent-prompt-kit.md", `documents ${expected}`);
}

const launchAnnouncementKit = await readFile(join(docsRoot, "docs", "launch-announcement-kit.md"), "utf8");
mustInclude(launchAnnouncementKit, "./lead-agent-prompt-kit.md", "docs/launch-announcement-kit.md", "links lead agent prompt kit");
mustInclude(launchAnnouncementKit, "./release-runbook.md", "docs/launch-announcement-kit.md", "links release runbook");

const releaseRunbook = await readFile(join(docsRoot, "docs", "release-runbook.md"), "utf8");
for (const expected of [
  "Release Order",
  "Trusted Publisher",
  "npm publish --provenance --access public",
  "AGENTDISPATCH_VERIFY_INSTALL=1 npm --prefix agentdispatch-docs run verify:local-e2e",
  "@agent-dispatch/core",
  "@agent-dispatch/cli",
  "AGENTDISPATCH_LIVE_DISPATCH=1"
]) {
  mustInclude(releaseRunbook, expected, "docs/release-runbook.md", `documents ${expected}`);
}

const localDemoTranscript = await readFile(join(docsRoot, "docs", "local-demo-transcript.md"), "utf8");
mustInclude(localDemoTranscript, "./lead-agent-prompt-kit.md", "docs/local-demo-transcript.md", "links lead agent prompt kit");

const launchChecklist = await readFile(join(docsRoot, "docs", "repo-launch-checklist.md"), "utf8");
mustInclude(launchChecklist, "./verification-matrix.md", "docs/repo-launch-checklist.md", "links verification matrix");
mustInclude(launchChecklist, "./live-aws-verification.md", "docs/repo-launch-checklist.md", "links live AWS runbook");
mustInclude(launchChecklist, "./lead-agent-prompt-kit.md", "docs/repo-launch-checklist.md", "links lead agent prompt kit");
mustInclude(launchChecklist, "./release-runbook.md", "docs/repo-launch-checklist.md", "links release runbook");
mustInclude(launchChecklist, "AGENTDISPATCH_LIVE_REPORT", "docs/repo-launch-checklist.md", "captures live AWS report path");

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

function mustEqual(actual, expected, label, reason) {
  if (actual !== expected) {
    failures.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)} (${reason})`);
  }
}

function mustIncludeArray(value, expected, label, reason) {
  if (!Array.isArray(value) || !value.includes(expected)) {
    failures.push(`${label}: missing ${JSON.stringify(expected)} (${reason})`);
  }
}

function assertReadmeLinksWorkOnNpm(readme, packageJson, label) {
  const included = new Set([...(packageJson.files ?? []), "README.md", "LICENSE", "package.json"]);
  for (const link of extractMarkdownLinks(readme)) {
    if (/^(https?:|mailto:|tel:|#|data:)/i.test(link)) continue;
    const [pathPart] = link.split("#", 1);
    if (!pathPart) continue;
    const normalized = pathPart.replace(/^\.\//, "");
    const isIncluded = [...included].some((entry) => {
      const clean = entry.replace(/\/$/, "");
      return normalized === clean || normalized.startsWith(`${clean}/`);
    });
    if (!isIncluded) {
      failures.push(`${label}: relative link ${JSON.stringify(link)} points outside package files and may break on npm`);
    }
  }
}

function extractMarkdownLinks(text) {
  const links = [];
  const inline = /!?(?<!\\)\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  for (const match of text.matchAll(inline)) links.push(match[1]);
  const htmlHref = /href="([^"]+)"/g;
  for (const match of text.matchAll(htmlHref)) links.push(match[1]);
  return links;
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
