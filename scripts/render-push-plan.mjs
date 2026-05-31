#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const docsRoot = resolve(scriptDir, "..");
const workspaceRoot = resolve(process.env.AGENTDISPATCH_WORKSPACE_ROOT ?? join(docsRoot, ".."));
const outputPath = process.env.AGENTDISPATCH_PUSH_PLAN_REPORT
  ? resolve(process.env.AGENTDISPATCH_PUSH_PLAN_REPORT)
  : null;

const repos = [
  "agentdispatch-core",
  "agentdispatch-store-sqlite",
  "agentdispatch-adapter-aws-agentcore",
  "agentdispatch-worker-agentcore",
  "agentdispatch-sdk-js",
  "agentdispatch-mcp-server",
  "agentdispatch-cli",
  "agentdispatch-adapter-template",
  "agentdispatch-docs",
  "agentdispatch-github-profile",
  "agentdispatch-website"
];

const publishOrder = [
  { repo: "agentdispatch-core", name: "@agent-dispatch/core" },
  { repo: "agentdispatch-store-sqlite", name: "@agent-dispatch/store-sqlite" },
  { repo: "agentdispatch-adapter-aws-agentcore", name: "@agent-dispatch/adapter-aws-agentcore" },
  { repo: "agentdispatch-sdk-js", name: "@agent-dispatch/sdk" },
  { repo: "agentdispatch-worker-agentcore", name: "@agent-dispatch/worker-agentcore" },
  { repo: "agentdispatch-mcp-server", name: "@agent-dispatch/mcp-server" },
  { repo: "agentdispatch-cli", name: "@agent-dispatch/cli" }
];

const repoStatuses = repos.map(inspectRepo);
const markdown = renderPlan();

if (outputPath) {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, markdown);
} else {
  process.stdout.write(markdown);
}

function inspectRepo(repo) {
  const repoPath = join(workspaceRoot, repo);
  const packageJsonPath = join(repoPath, "package.json");
  const packageJson = existsSync(packageJsonPath)
    ? JSON.parse(readFileSync(packageJsonPath, "utf8"))
    : {};

  return {
    repo,
    path: repoPath,
    exists: existsSync(join(repoPath, ".git")),
    packageName: packageJson.name ?? null,
    version: packageJson.version ?? null,
    dirty: git(repoPath, ["status", "--short"]).trim(),
    ahead: Number(git(repoPath, ["rev-list", "--count", "origin/main..HEAD"]) || 0),
    head: git(repoPath, ["log", "--oneline", "-1"]),
    remote: git(repoPath, ["remote", "get-url", "origin"])
  };
}

function renderPlan() {
  const generatedAt = new Date().toISOString();
  const aheadRepos = repoStatuses.filter((repo) => repo.ahead > 0);
  const dirtyRepos = repoStatuses.filter((repo) => repo.dirty.length > 0);

  const lines = [
    "# AgentDispatch Push And Publish Plan",
    "",
    `Generated: ${generatedAt}`,
    `Workspace: \`${workspaceRoot}\``,
    "",
    "## Current Repo State",
    "",
    "| Repo | Head | Ahead | Clean |",
    "| --- | --- | ---: | --- |",
    ...repoStatuses.map((repo) => `| ${repo.repo} | \`${repo.head}\` | ${repo.ahead} | ${repo.dirty.length === 0 ? "yes" : "no"} |`),
    "",
    "## Push Plan",
    "",
    ...pushCommands(aheadRepos),
    "",
    "## npm Publish Order",
    "",
    "Publish through each package repo's GitHub Actions `Publish` workflow after the corresponding repo is pushed and CI is green. Do not publish from a laptop for public releases.",
    "",
    ...publishOrder.map((pkg, index) => `${index + 1}. \`${pkg.name}\` from \`${pkg.repo}\` (${versionFor(pkg.repo)})`),
    "",
    "## Guardrails",
    "",
    "- Do not push `agentdispatch-website` until the website is explicitly approved.",
    "- Do not claim live AWS dispatch until `verify:aws-live` succeeds with `AGENTDISPATCH_LIVE_DISPATCH=1`.",
    "- If any repo is dirty, commit or intentionally discard those local changes before pushing.",
    "- After pushing, wait for CI on every repo before running publish workflows.",
    "",
    "## Remaining Local Issues",
    "",
    ...remainingIssues(dirtyRepos, aheadRepos),
    ""
  ];

  return `${lines.join("\n")}\n`;
}

function pushCommands(aheadRepos) {
  if (aheadRepos.length === 0) return ["- No repos are ahead of `origin/main`."];
  return aheadRepos.map((repo) => {
    const note = repo.repo === "agentdispatch-website" ? " # wait for website approval" : "";
    return `- \`git -C ${repo.path} push origin main\`${note}`;
  });
}

function remainingIssues(dirtyRepos, aheadRepos) {
  const issues = [];
  if (dirtyRepos.length > 0) {
    issues.push(`- Dirty repos: ${dirtyRepos.map((repo) => `\`${repo.repo}\``).join(", ")}.`);
  }
  if (aheadRepos.length > 0) {
    issues.push(`- Repos ahead of origin: ${aheadRepos.length}.`);
  }
  return issues.length > 0 ? issues : ["- None in local repo state."];
}

function versionFor(repoName) {
  const repo = repoStatuses.find((candidate) => candidate.repo === repoName);
  return repo?.packageName && repo?.version ? `${repo.packageName}@${repo.version}` : "version unavailable";
}

function git(cwd, gitArgs) {
  try {
    return execFileSync("git", ["-C", cwd, ...gitArgs], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trimEnd();
  } catch {
    return "";
  }
}
