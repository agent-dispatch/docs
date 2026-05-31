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
  mustInclude(readme, `agent-dispatch/${publicRepoName(pkg.repo)}/actions/workflows/ci.yml`, label, "shows package CI badge");

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
    mustInclude(readme, `npmjs.com/package/${pkg.packageName}`, label, "links public npm package");
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
    if (readme.includes("npmjs.com/package/") || readme.includes("img.shields.io/npm/v/")) {
      failures.push(`${label}: private template must not present itself as a published npm package`);
    }
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

const docsPackageJson = JSON.parse(await readFile(join(docsRoot, "package.json"), "utf8"));
for (const script of ["demo:local", "demo:record", "verify:launch", "verify:local-e2e", "verify:aws-live", "smoke:packages", "smoke:published", "status:release", "status:npm", "status:publish", "status:security"]) {
  if (!docsPackageJson.scripts?.[script]) {
    failures.push(`package.json: missing script ${script}`);
  }
}

const localDemoScript = await readFile(join(docsRoot, "scripts", "demo-local.sh"), "utf8");
for (const expected of [
  "agentdispatch doctor",
  "MCP server",
  "spawn_cloud_agent",
  "AGENTDISPATCH_LIVE_DISPATCH=1"
]) {
  mustInclude(localDemoScript, expected, "scripts/demo-local.sh", `documents ${expected}`);
}

const localDemoRecordScript = await readFile(join(docsRoot, "scripts", "record-local-demo.sh"), "utf8");
for (const expected of [
  "AGENTDISPATCH_DEMO_RECORD_DIR",
  "local-demo.transcript.txt",
  "local-demo.report.json",
  "doesNotProve",
  "spawn_cloud_agent"
]) {
  mustInclude(localDemoRecordScript, expected, "scripts/record-local-demo.sh", `documents ${expected}`);
}

const localE2eScript = await readFile(join(docsRoot, "scripts", "verify-local-e2e.sh"), "utf8");
mustInclude(localE2eScript, "status:release", "scripts/verify-local-e2e.sh", "runs release status");
mustInclude(localE2eScript, "AGENTDISPATCH_LOCAL_E2E_REPORT", "scripts/verify-local-e2e.sh", "writes optional local E2E evidence report");

const launchVerifyScript = await readFile(join(docsRoot, "scripts", "verify-launch.sh"), "utf8");
for (const expected of [
  "AGENTDISPATCH_LAUNCH_EVIDENCE_DIR",
  "verify:local-e2e",
  "status:npm",
  "status:publish",
  "status:security",
  "smoke:published",
  "agentdispatch-publish-dry-run-report.json",
  "agentdispatch-release-status.json"
]) {
  mustInclude(launchVerifyScript, expected, "scripts/verify-launch.sh", `runs ${expected}`);
}

const npmStatusScript = await readFile(join(docsRoot, "scripts", "check-npm-version-drift.mjs"), "utf8");
mustInclude(npmStatusScript, "AGENTDISPATCH_NPM_STATUS_REPORT", "scripts/check-npm-version-drift.mjs", "writes optional npm evidence report");

const publishDryRunScript = await readFile(join(docsRoot, "scripts", "check-publish-dry-run.mjs"), "utf8");
for (const expected of [
  "AGENTDISPATCH_PUBLISH_DRY_RUN_REPORT",
  "npm",
  "publish",
  "--dry-run",
  "--access",
  "public",
  "unexpected-package",
  "@agent-dispatch/core"
]) {
  mustInclude(publishDryRunScript, expected, "scripts/check-publish-dry-run.mjs", `implements ${expected}`);
}

const securityAuditEvidenceScript = await readFile(join(docsRoot, "scripts", "check-security-audit.mjs"), "utf8");
mustInclude(securityAuditEvidenceScript, "AGENTDISPATCH_SECURITY_REPORT", "scripts/check-security-audit.mjs", "writes optional security evidence report");

const publishedSmokeScript = await readFile(join(docsRoot, "scripts", "smoke-published-packages.mjs"), "utf8");
mustInclude(publishedSmokeScript, "AGENTDISPATCH_PUBLISHED_SMOKE_REPORT", "scripts/smoke-published-packages.mjs", "writes optional published canary evidence report");

const docsReadme = await readFile(join(docsRoot, "README.md"), "utf8");
mustInclude(docsReadme, "./docs/live-aws-verification.md", "README.md", "links live AWS verification runbook");
mustInclude(docsReadme, "./docs/verification-matrix.md", "README.md", "links verification matrix");
mustInclude(docsReadme, "./docs/launch-evidence.md", "README.md", "links launch evidence");
mustInclude(docsReadme, "./docs/contributor-map.md", "README.md", "links contributor map");
mustInclude(docsReadme, "./docs/contributor-issue-bank.md", "README.md", "links contributor issue bank");
mustInclude(docsReadme, "./docs/examples.md", "README.md", "links examples");
mustInclude(docsReadme, "./docs/use-cases.md", "README.md", "links use cases");
mustInclude(docsReadme, "./docs/lead-agent-prompt-kit.md", "README.md", "links lead agent prompt kit");
mustInclude(docsReadme, "./docs/release-runbook.md", "README.md", "links release runbook");
mustInclude(docsReadme, "./docs/release-status.md", "README.md", "links release status");
mustInclude(docsReadme, "actions/workflows/local-e2e.yml/badge.svg", "README.md", "shows local E2E badge");
mustInclude(docsReadme, "actions/workflows/live-aws-verification.yml/badge.svg", "README.md", "shows live AWS verification badge");
mustInclude(docsReadme, "npm --prefix agentdispatch-docs run demo:local", "README.md", "shows executable local demo");
mustInclude(docsReadme, "npm --prefix agentdispatch-docs run demo:record", "README.md", "shows demo recording command");
mustInclude(docsReadme, "npm --prefix agentdispatch-docs run status:release", "README.md", "shows release status command");
mustInclude(docsReadme, "npm --prefix agentdispatch-docs run status:npm", "README.md", "shows npm status command");
mustInclude(docsReadme, "npm --prefix agentdispatch-docs run status:publish", "README.md", "shows publish dry-run command");
mustInclude(docsReadme, "npm --prefix agentdispatch-docs run status:security", "README.md", "shows security status command");

const contributorMap = await readFile(join(docsRoot, "docs", "contributor-map.md"), "utf8");
for (const expected of [
  "good_first_adapter.yml",
  "good_first_worker.yml",
  "architecture_request.yml",
  "./contributor-issue-bank.md",
  "provider + capability + task_type + target.mode",
  "verify:local-e2e"
]) {
  mustInclude(contributorMap, expected, "docs/contributor-map.md", `documents ${expected}`);
}

const contributorIssueBank = await readFile(join(docsRoot, "docs", "contributor-issue-bank.md"), "utf8");
for (const expected of [
  "local child-process adapter",
  "Kubernetes Job adapter",
  "GCP Cloud Run Jobs adapter",
  "Azure Container Apps Jobs adapter",
  "command-backed worker",
  "LangGraph worker",
  "OpenAI Agents worker",
  "provider-neutral artifact browsing",
  "provider-neutral live preflight evidence",
  "AGENTDISPATCH_VERIFY_INSTALL=1 npm --prefix agentdispatch-docs run verify:local-e2e",
  "AGENTDISPATCH_LIVE_DISPATCH=1"
]) {
  mustInclude(contributorIssueBank, expected, "docs/contributor-issue-bank.md", `documents ${expected}`);
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

const localE2eWorkflow = await readFile(join(docsRoot, ".github", "workflows", "local-e2e.yml"), "utf8");
for (const expected of [
  "verify:launch",
  "AGENTDISPATCH_LAUNCH_EVIDENCE_DIR",
  "agentdispatch-release-status.json",
  "agentdispatch-publish-dry-run-report.json",
  "agentdispatch-launch-evidence",
  "actions/upload-artifact@v4"
]) {
  mustInclude(localE2eWorkflow, expected, ".github/workflows/local-e2e.yml", `configures ${expected}`);
}

const verificationMatrix = await readFile(join(docsRoot, "docs", "verification-matrix.md"), "utf8");
for (const expected of [
  "./examples.md",
  "./launch-evidence.md",
  "verify:local-e2e",
  "smoke:published",
  "status:release",
  "status:publish",
  "verify:aws-live",
  "AGENTDISPATCH_LIVE_DISPATCH=1",
  "Do not use local E2E evidence as proof that live AWS dispatch works",
  "Live AWS Verification",
  "actions/workflows/local-e2e.yml"
]) {
  mustInclude(verificationMatrix, expected, "docs/verification-matrix.md", `documents ${expected}`);
}

const launchEvidence = await readFile(join(docsRoot, "docs", "launch-evidence.md"), "utf8");
for (const expected of [
  "AGENTDISPATCH_LOCAL_E2E_REPORT=./agentdispatch-local-e2e-report.json",
  "agentdispatch-release-status.json",
  "AGENTDISPATCH_DEMO_RECORD_DIR=./agentdispatch-local-demo-recording",
  "local-demo.report.json",
  "status:npm",
  "status:publish",
  "smoke:published",
  "status:security",
  "AGENTDISPATCH_NPM_STATUS_REPORT",
  "AGENTDISPATCH_PUBLISH_DRY_RUN_REPORT",
  "AGENTDISPATCH_SECURITY_REPORT",
  "AGENTDISPATCH_PUBLISHED_SMOKE_REPORT",
  "agentdispatch-launch-evidence",
  "verify:launch",
  "AGENTDISPATCH_LIVE_DISPATCH=1",
  "Live AWS dispatch verified against a real AgentCore runtime",
  "Do not commit account-specific live AWS reports"
]) {
  mustInclude(launchEvidence, expected, "docs/launch-evidence.md", `documents ${expected}`);
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
  "./use-cases.md",
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
mustInclude(launchAnnouncementKit, "./launch-evidence.md", "docs/launch-announcement-kit.md", "links launch evidence");
mustInclude(launchAnnouncementKit, "./use-cases.md", "docs/launch-announcement-kit.md", "links use cases");
mustInclude(launchAnnouncementKit, "./examples.md", "docs/launch-announcement-kit.md", "links examples");
mustInclude(launchAnnouncementKit, "./contributor-issue-bank.md", "docs/launch-announcement-kit.md", "links contributor issue bank");
mustInclude(launchAnnouncementKit, "./release-runbook.md", "docs/launch-announcement-kit.md", "links release runbook");
mustInclude(launchAnnouncementKit, "demo:local", "docs/launch-announcement-kit.md", "references executable local demo");
mustInclude(launchAnnouncementKit, "demo:record", "docs/launch-announcement-kit.md", "references demo recording");
mustInclude(launchAnnouncementKit, "status:release", "docs/launch-announcement-kit.md", "references release status");

const releaseRunbook = await readFile(join(docsRoot, "docs", "release-runbook.md"), "utf8");
for (const expected of [
  "Release Order",
  "Trusted Publisher",
  "AGENTDISPATCH_LOCAL_E2E_REPORT",
  "smoke:published",
  "status:release",
  "status:npm",
  "status:publish",
  "status:security",
  "npm publish --dry-run --json",
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
mustInclude(localDemoTranscript, "demo:local", "docs/local-demo-transcript.md", "references executable local demo");
mustInclude(localDemoTranscript, "demo:record", "docs/local-demo-transcript.md", "references demo recording");
mustInclude(localDemoTranscript, "AGENTDISPATCH_DEMO_RECORD_DIR", "docs/local-demo-transcript.md", "documents deterministic demo artifact paths");

const packageConsumption = await readFile(join(docsRoot, "docs", "package-consumption.md"), "utf8");
mustInclude(packageConsumption, "smoke:published", "docs/package-consumption.md", "documents published package smoke");
mustInclude(packageConsumption, "status:npm", "docs/package-consumption.md", "documents npm version drift check");
mustInclude(packageConsumption, "status:publish", "docs/package-consumption.md", "documents publish dry-run check");

const launchChecklist = await readFile(join(docsRoot, "docs", "repo-launch-checklist.md"), "utf8");
mustInclude(launchChecklist, "./examples.md", "docs/repo-launch-checklist.md", "links examples");
mustInclude(launchChecklist, "./launch-evidence.md", "docs/repo-launch-checklist.md", "links launch evidence");
mustInclude(launchChecklist, "./verification-matrix.md", "docs/repo-launch-checklist.md", "links verification matrix");
mustInclude(launchChecklist, "./contributor-issue-bank.md", "docs/repo-launch-checklist.md", "links contributor issue bank");
mustInclude(launchChecklist, "./live-aws-verification.md", "docs/repo-launch-checklist.md", "links live AWS runbook");
mustInclude(launchChecklist, "./lead-agent-prompt-kit.md", "docs/repo-launch-checklist.md", "links lead agent prompt kit");
mustInclude(launchChecklist, "./release-runbook.md", "docs/repo-launch-checklist.md", "links release runbook");
mustInclude(launchChecklist, "./release-status.md", "docs/repo-launch-checklist.md", "links release status");
mustInclude(launchChecklist, "demo:local", "docs/repo-launch-checklist.md", "runs executable local demo");
mustInclude(launchChecklist, "demo:record", "docs/repo-launch-checklist.md", "records local demo");
mustInclude(launchChecklist, "status:release", "docs/repo-launch-checklist.md", "runs release status");
mustInclude(launchChecklist, "status:npm", "docs/repo-launch-checklist.md", "runs npm status");
mustInclude(launchChecklist, "status:publish", "docs/repo-launch-checklist.md", "runs publish dry-run status");
mustInclude(launchChecklist, "status:security", "docs/repo-launch-checklist.md", "runs security status");
mustInclude(launchChecklist, "AGENTDISPATCH_LOCAL_E2E_REPORT", "docs/repo-launch-checklist.md", "captures local E2E report");
mustInclude(launchChecklist, "npm run smoke:published", "docs/repo-launch-checklist.md", "runs published package smoke");
mustInclude(launchChecklist, "AGENTDISPATCH_LIVE_REPORT", "docs/repo-launch-checklist.md", "captures live AWS report path");

const releaseStatus = await readFile(join(docsRoot, "docs", "release-status.md"), "utf8");
for (const expected of [
  "status:release",
  "status:npm",
  "status:publish",
  "status:security",
  "Retained publish dry-run report found",
  "Retained local E2E report found",
  "AGENTDISPATCH_LOCAL_E2E_REPORT",
  "AGENTDISPATCH_PUBLISH_DRY_RUN_REPORT",
  "--json",
  "--strict",
  "origin/main",
  "AGENTDISPATCH_LIVE_DISPATCH=1",
  "Live AWS dispatch verified against a real AgentCore runtime"
]) {
  mustInclude(releaseStatus, expected, "docs/release-status.md", `documents ${expected}`);
}

const npmVersionDriftScript = await readFile(join(docsRoot, "scripts", "check-npm-version-drift.mjs"), "utf8");
for (const expected of [
  "@agent-dispatch/core",
  "pending-publish",
  "local-behind-npm",
  "missing-on-npm",
  "--json",
  "--strict"
]) {
  mustInclude(npmVersionDriftScript, expected, "scripts/check-npm-version-drift.mjs", `implements ${expected}`);
}

const securityAuditScript = await readFile(join(docsRoot, "scripts", "check-security-audit.mjs"), "utf8");
for (const expected of [
  "npm audit",
  "--audit-level=high",
  "vulnerable",
  "critical",
  "high",
  "--json",
  "--strict"
]) {
  mustInclude(securityAuditScript, expected, "scripts/check-security-audit.mjs", `implements ${expected}`);
}

const examples = await readFile(join(docsRoot, "docs", "examples.md"), "utf8");
for (const expected of [
  "Local no-cloud demo",
  "demo:record",
  "AGENTDISPATCH_DEMO_RECORD_DIR",
  "Published npm canary",
  "./use-cases.md",
  "Lead-Agent Prompt Kit",
  "Live AWS Preflight",
  "Live AWS Dispatch",
  "npm --prefix agentdispatch-docs run demo:local",
  "npm run smoke:published",
  "AGENTDISPATCH_LIVE_DISPATCH=1",
  "status:release",
  "Live AWS dispatch verified against a real AgentCore runtime"
]) {
  mustInclude(examples, expected, "docs/examples.md", `documents ${expected}`);
}

const useCases = await readFile(join(docsRoot, "docs", "use-cases.md"), "utf8");
for (const expected of [
  "Repository Audit",
  "Release Readiness Check",
  "Dependency And API Upgrade Review",
  "Documentation And Launch Copy Review",
  "Provider Adapter Design",
  "Worker Framework Prototype",
  "Long-Running Research Task",
  "check_cloud_agent_runtime",
  "spawn_cloud_agent",
  "get_task_status",
  "get_task_logs",
  "get_task_result",
  "AGENTDISPATCH_LIVE_DISPATCH=1",
  "./examples.md"
]) {
  mustInclude(useCases, expected, "docs/use-cases.md", `documents ${expected}`);
}

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

function publicRepoName(repo) {
  return repo.replace(/^agentdispatch-/, "");
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
