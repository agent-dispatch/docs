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
const publishedSmokeReport = inspectPublishedSmokeReport();
const npmStatusReport = inspectNpmStatusReport();
const publishDryRunReport = inspectPublishDryRunReport();
const securityReport = inspectSecurityReport();
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
      status: publishedSmokeReport.verified ? "ok" : "manual",
      command: "npm --prefix agentdispatch-docs run smoke:published",
      evidenceCommand: "AGENTDISPATCH_PUBLISHED_SMOKE_REPORT=./agentdispatch-published-smoke-report.json npm --prefix agentdispatch-docs run smoke:published",
      proves: "public npm install, imports, CLI binary, and MCP binary"
    },
    {
      name: "npm-version-drift",
      status: npmStatusReport.verified ? "ok" : npmStatusReport.present ? "warn" : "manual",
      command: "npm --prefix agentdispatch-docs run status:npm",
      evidenceCommand: "AGENTDISPATCH_NPM_STATUS_REPORT=./agentdispatch-npm-status-report.json npm --prefix agentdispatch-docs run status:npm",
      proves: "local package versions compared with currently published npm versions"
    },
    {
      name: "publish-dry-run",
      status: publishDryRunReport.verified ? "ok" : publishDryRunReport.present ? "warn" : "manual",
      command: "npm --prefix agentdispatch-docs run status:publish",
      evidenceCommand: "AGENTDISPATCH_PUBLISH_DRY_RUN_REPORT=./agentdispatch-publish-dry-run-report.json npm --prefix agentdispatch-docs run status:publish -- --strict",
      proves: "npm publish dry-run from each package directory for the intended scoped packages"
    },
    {
      name: "security-audit",
      status: securityReport.verified ? "ok" : securityReport.present ? "warn" : "manual",
      command: "npm --prefix agentdispatch-docs run status:security",
      strictCommand: "npm --prefix agentdispatch-docs run status:security -- --strict",
      evidenceCommand: "AGENTDISPATCH_SECURITY_REPORT=./agentdispatch-security-audit-report.json npm --prefix agentdispatch-docs run status:security -- --strict",
      proves: "npm audit high/critical vulnerability status across the multi-repo workspace"
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
    publishedSmokeReportFound: publishedSmokeReport.verified,
    npmStatusReportFound: npmStatusReport.verified,
    npmPendingPublish: npmStatusReport.pendingPublish,
    publishDryRunReportFound: publishDryRunReport.verified,
    securityReportFound: securityReport.verified,
    liveAwsPreflightVerified: liveReport.preflightVerified,
    liveAwsDispatchVerified: liveReport.dispatchVerified,
    readyForLocalLaunchClaim: missingRepos.length === 0 && dirtyRepos.length === 0,
    readyForLiveAwsDispatchClaim: liveReport.dispatchVerified
  },
  localE2eReport,
  publishedSmokeReport,
  npmStatusReport,
  publishDryRunReport,
  securityReport,
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

function inspectPublishedSmokeReport() {
  const candidates = [
    process.env.AGENTDISPATCH_PUBLISHED_SMOKE_REPORT,
    join(workspaceRoot, "agentdispatch-published-smoke-report.json"),
    join(docsRoot, "agentdispatch-published-smoke-report.json")
  ].filter(Boolean);

  for (const candidate of candidates) {
    const reportPath = resolve(candidate);
    if (!existsSync(reportPath)) continue;
    try {
      const report = JSON.parse(readFileSync(reportPath, "utf8"));
      return {
        path: reportPath,
        present: true,
        generatedAt: report.generatedAt ?? null,
        verified: report.ok === true,
        versions: report.versions ?? null
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
    path: resolve(candidates[0] ?? join(workspaceRoot, "agentdispatch-published-smoke-report.json")),
    present: false,
    verified: false
  };
}

function inspectNpmStatusReport() {
  const candidates = [
    process.env.AGENTDISPATCH_NPM_STATUS_REPORT,
    join(workspaceRoot, "agentdispatch-npm-status-report.json"),
    join(docsRoot, "agentdispatch-npm-status-report.json")
  ].filter(Boolean);

  for (const candidate of candidates) {
    const reportPath = resolve(candidate);
    if (!existsSync(reportPath)) continue;
    try {
      const report = JSON.parse(readFileSync(reportPath, "utf8"));
      const summary = report.summary ?? {};
      const localBehindNpm = Number(summary.localBehindNpm ?? 0);
      const missingOnNpm = Number(summary.missingOnNpm ?? 0);
      const checkFailed = Number(summary.checkFailed ?? 0);
      return {
        path: reportPath,
        present: true,
        checkedAt: report.checkedAt ?? null,
        verified: localBehindNpm === 0 && missingOnNpm === 0 && checkFailed === 0,
        pendingPublish: Number(summary.pendingPublish ?? 0),
        synced: Number(summary.synced ?? 0),
        localBehindNpm,
        missingOnNpm,
        checkFailed
      };
    } catch (error) {
      return {
        path: reportPath,
        present: true,
        parseError: error.message,
        verified: false,
        pendingPublish: 0
      };
    }
  }

  return {
    path: resolve(candidates[0] ?? join(workspaceRoot, "agentdispatch-npm-status-report.json")),
    present: false,
    verified: false,
    pendingPublish: 0
  };
}

function inspectPublishDryRunReport() {
  const candidates = [
    process.env.AGENTDISPATCH_PUBLISH_DRY_RUN_REPORT,
    join(workspaceRoot, "agentdispatch-publish-dry-run-report.json"),
    join(docsRoot, "agentdispatch-publish-dry-run-report.json")
  ].filter(Boolean);

  for (const candidate of candidates) {
    const reportPath = resolve(candidate);
    if (!existsSync(reportPath)) continue;
    try {
      const report = JSON.parse(readFileSync(reportPath, "utf8"));
      const summary = report.summary ?? {};
      const checkFailed = Number(summary.checkFailed ?? 0);
      const unexpectedPackage = Number(summary.unexpectedPackage ?? 0);
      const total = Number(summary.total ?? 0);
      const ok = Number(summary.ok ?? 0);
      return {
        path: reportPath,
        present: true,
        checkedAt: report.checkedAt ?? null,
        verified: report.ok === true && total > 0 && ok === total && checkFailed === 0 && unexpectedPackage === 0,
        ok,
        total,
        checkFailed,
        unexpectedPackage
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
    path: resolve(candidates[0] ?? join(workspaceRoot, "agentdispatch-publish-dry-run-report.json")),
    present: false,
    verified: false
  };
}

function inspectSecurityReport() {
  const candidates = [
    process.env.AGENTDISPATCH_SECURITY_REPORT,
    join(workspaceRoot, "agentdispatch-security-audit-report.json"),
    join(docsRoot, "agentdispatch-security-audit-report.json")
  ].filter(Boolean);

  for (const candidate of candidates) {
    const reportPath = resolve(candidate);
    if (!existsSync(reportPath)) continue;
    try {
      const report = JSON.parse(readFileSync(reportPath, "utf8"));
      const summary = report.summary ?? {};
      const high = Number(summary.high ?? 0);
      const critical = Number(summary.critical ?? 0);
      const checkFailed = Number(summary.checkFailed ?? 0);
      return {
        path: reportPath,
        present: true,
        checkedAt: report.checkedAt ?? null,
        verified: high === 0 && critical === 0 && checkFailed === 0,
        high,
        critical,
        checkFailed
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
    path: resolve(candidates[0] ?? join(workspaceRoot, "agentdispatch-security-audit-report.json")),
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
  console.log(`- Retained published canary report found: ${yesNo(summary.publishedSmokeReportFound)}`);
  console.log(`- Retained npm version report found: ${yesNo(summary.npmStatusReportFound)}${summary.npmStatusReportFound ? `, pending publish: ${summary.npmPendingPublish}` : ""}`);
  console.log(`- Retained publish dry-run report found: ${yesNo(summary.publishDryRunReportFound)}`);
  console.log(`- Retained security audit report found: ${yesNo(summary.securityReportFound)}`);
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
    }).trimEnd();
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
