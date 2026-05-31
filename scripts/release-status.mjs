#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const docsRoot = resolve(scriptDir, "..");
const workspaceRoot = resolve(process.env.AGENTDISPATCH_WORKSPACE_ROOT ?? join(docsRoot, ".."));
const args = new Set(process.argv.slice(2));

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

const repoStatuses = repos.map((repo) => inspectRepo(repo));
const missingRepos = repoStatuses.filter((repo) => !repo.exists);
const dirtyRepos = repoStatuses.filter((repo) => repo.dirty.length > 0);
const aheadRepos = repoStatuses.filter((repo) => repo.ahead > 0);
const localE2eReport = inspectLocalE2eReport();
const liveReport = inspectLiveReport();

const status = {
  generatedAt: new Date().toISOString(),
  workspaceRoot,
  repositories: repoStatuses,
  gates: [
    {
      name: "local-e2e",
      status: localE2eReport.verified ? "ok" : "manual",
      command: "AGENTDISPATCH_VERIFY_INSTALL=1 npm --prefix agentdispatch-docs run verify:local-e2e",
      evidenceCommand: "AGENTDISPATCH_VERIFY_INSTALL=1 AGENTDISPATCH_LOCAL_E2E_REPORT=./agentdispatch-local-e2e-report.json npm --prefix agentdispatch-docs run verify:local-e2e",
      proves: "local package graph, tests, typechecks, builds, packaged smoke, CLI init/doctor, MCP check, docs, profile, and website"
    },
    {
      name: "published-canary",
      status: "manual",
      command: "npm --prefix agentdispatch-docs run smoke:published",
      proves: "public npm install, imports, CLI binary, and MCP binary"
    },
    {
      name: "npm-version-drift",
      status: "manual",
      command: "npm --prefix agentdispatch-docs run status:npm",
      proves: "local package versions compared with currently published npm versions"
    },
    {
      name: "release-status",
      status: missingRepos.length === 0 && dirtyRepos.length === 0 ? "ok" : "warn",
      command: "npm --prefix agentdispatch-docs run status:release",
      proves: "workspace shape, git cleanliness, unpushed commits, and live AWS evidence boundary"
    },
    {
      name: "live-aws",
      status: liveReport.dispatchVerified ? "ok" : liveReport.preflightVerified ? "warn" : "missing",
      command: "AGENTDISPATCH_CONFIG=/absolute/path/agentdispatch.config.json AGENTDISPATCH_LIVE_REPORT=./agentdispatch-live-aws-report.json npm --prefix agentdispatch-docs run verify:aws-live",
      dispatchCommand: "AGENTDISPATCH_CONFIG=/absolute/path/agentdispatch.config.json AGENTDISPATCH_LIVE_DISPATCH=1 AGENTDISPATCH_LIVE_REPORT=./agentdispatch-live-aws-dispatch-report.json npm --prefix agentdispatch-docs run verify:aws-live",
      proves: "real AWS AgentCore preflight, and live dispatch only when AGENTDISPATCH_LIVE_DISPATCH=1 succeeds"
    }
  ],
  summary: {
    missingRepos: missingRepos.length,
    dirtyRepos: dirtyRepos.length,
    reposAheadOfOrigin: aheadRepos.length,
    localE2eReportFound: localE2eReport.verified,
    liveAwsPreflightVerified: liveReport.preflightVerified,
    liveAwsDispatchVerified: liveReport.dispatchVerified,
    readyForLocalLaunchClaim: missingRepos.length === 0 && dirtyRepos.length === 0,
    readyForLiveAwsDispatchClaim: liveReport.dispatchVerified
  },
  localE2eReport,
  liveReport
};

if (args.has("--json")) {
  process.stdout.write(`${JSON.stringify(status, null, 2)}\n`);
} else {
  printHuman(status);
}

if (args.has("--strict") && (missingRepos.length > 0 || dirtyRepos.length > 0)) {
  process.exitCode = 1;
}

function inspectRepo(repo) {
  const repoPath = join(workspaceRoot, repo);
  const packageJsonPath = join(repoPath, "package.json");
  const exists = existsSync(repoPath) && existsSync(join(repoPath, ".git"));
  const packageJson = existsSync(packageJsonPath)
    ? JSON.parse(readFileSync(packageJsonPath, "utf8"))
    : null;

  return {
    repo,
    path: repoPath,
    exists,
    packageName: packageJson?.name ?? null,
    version: packageJson?.version ?? null,
    private: packageJson?.private === true,
    dirty: exists ? lines(git(repoPath, ["status", "--short"])) : [],
    ahead: exists ? Number(git(repoPath, ["rev-list", "--count", "origin/main..HEAD"]) || 0) : 0,
    head: exists ? git(repoPath, ["log", "--oneline", "-1"]) : null
  };
}

function inspectLocalE2eReport() {
  const candidates = [
    process.env.AGENTDISPATCH_LOCAL_E2E_REPORT,
    join(workspaceRoot, "agentdispatch-local-e2e-report.json"),
    join(docsRoot, "agentdispatch-local-e2e-report.json")
  ].filter(Boolean);

  for (const candidate of candidates) {
    const reportPath = resolve(candidate);
    if (!existsSync(reportPath)) continue;
    try {
      const report = JSON.parse(readFileSync(reportPath, "utf8"));
      const claim = String(report.claim ?? "");
      return {
        path: reportPath,
        present: true,
        generatedAt: report.generatedAt ?? null,
        claim,
        verified: report.ok === true && claim.includes("Local AgentDispatch end-to-end verification passed")
      };
    } catch (error) {
      return {
        path: reportPath,
        present: true,
        parseError: error.message,
        verified: false
      };
    }
  }

  return {
    path: resolve(candidates[0] ?? join(workspaceRoot, "agentdispatch-local-e2e-report.json")),
    present: false,
    verified: false
  };
}

function inspectLiveReport() {
  const candidates = [
    process.env.AGENTDISPATCH_LIVE_REPORT,
    join(workspaceRoot, "agentdispatch-live-aws-dispatch-report.json"),
    join(workspaceRoot, "agentdispatch-live-aws-report.json"),
    join(docsRoot, "agentdispatch-live-aws-dispatch-report.json"),
    join(docsRoot, "agentdispatch-live-aws-report.json")
  ].filter(Boolean);

  for (const candidate of candidates) {
    const reportPath = resolve(candidate);
    if (!existsSync(reportPath)) continue;
    try {
      const report = JSON.parse(readFileSync(reportPath, "utf8"));
      const claim = String(report.claim ?? "");
      return {
        path: reportPath,
        present: true,
        generatedAt: report.generatedAt ?? null,
        claim,
        preflightVerified: report.preflight?.ok === true,
        dispatchRequested: report.dispatch?.requested === true,
        dispatchVerified: report.dispatch?.status === "succeeded" && claim.includes("Live AWS dispatch verified")
      };
    } catch (error) {
      return {
        path: reportPath,
        present: true,
        parseError: error.message,
        preflightVerified: false,
        dispatchVerified: false
      };
    }
  }

  return {
    path: resolve(candidates[0] ?? join(workspaceRoot, "agentdispatch-live-aws-report.json")),
    present: false,
    preflightVerified: false,
    dispatchVerified: false
  };
}

function printHuman(report) {
  const { summary } = report;
  console.log("AgentDispatch release status");
  console.log(`workspace: ${report.workspaceRoot}`);
  console.log(`generated: ${report.generatedAt}`);
  console.log("");
  console.log("Repositories");
  for (const repo of report.repositories) {
    const marker = repo.exists ? (repo.dirty.length > 0 ? "dirty" : "clean") : "missing";
    const ahead = repo.ahead > 0 ? `, ahead origin/main by ${repo.ahead}` : "";
    const pkg = repo.packageName ? `, ${repo.packageName}@${repo.version}` : "";
    console.log(`- ${repo.repo}: ${marker}${ahead}${pkg}`);
  }
  console.log("");
  console.log("Gates");
  for (const gate of report.gates) {
    console.log(`- ${gate.name}: ${gate.status}`);
    console.log(`  ${gate.command}`);
  }
  console.log("");
  console.log("Claim boundary");
  console.log(`- Local launch claim ready from repo state: ${yesNo(summary.readyForLocalLaunchClaim)}`);
  console.log(`- Retained local E2E report found: ${yesNo(summary.localE2eReportFound)}`);
  console.log(`- Repos with unpushed commits: ${summary.reposAheadOfOrigin}`);
  console.log(`- Live AWS preflight report found: ${yesNo(summary.liveAwsPreflightVerified)}`);
  console.log(`- Live AWS dispatch claim ready: ${yesNo(summary.readyForLiveAwsDispatchClaim)}`);
  if (!summary.readyForLiveAwsDispatchClaim) {
    console.log("- Do not claim live AWS dispatch until verify:aws-live succeeds with AGENTDISPATCH_LIVE_DISPATCH=1.");
  }
}

function git(cwd, gitArgs) {
  try {
    return execFileSync("git", ["-C", cwd, ...gitArgs], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return "";
  }
}

function lines(text) {
  return text ? text.split("\n").filter(Boolean) : [];
}

function yesNo(value) {
  return value ? "yes" : "no";
}
