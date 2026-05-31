#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
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

const checkedAt = new Date().toISOString();
const results = repos.map((repo) => auditRepo(repo));
const summary = {
  total: results.length,
  clean: results.filter((result) => result.status === "clean").length,
  vulnerable: results.filter((result) => result.status === "vulnerable").length,
  skipped: results.filter((result) => result.status === "skipped").length,
  checkFailed: results.filter((result) => result.status === "check-failed").length,
  high: sum(results, "high"),
  critical: sum(results, "critical")
};

const report = {
  checkedAt,
  workspaceRoot,
  threshold: "high",
  results,
  summary
};

if (args.has("--json")) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  printHuman(report);
}

if (args.has("--strict") && (summary.high > 0 || summary.critical > 0 || summary.checkFailed > 0)) {
  process.exitCode = 1;
}

function auditRepo(repo) {
  const repoPath = join(workspaceRoot, repo);
  const packageJsonPath = join(repoPath, "package.json");
  const packageLockPath = join(repoPath, "package-lock.json");

  if (!existsSync(packageJsonPath)) {
    return {
      repo,
      path: repoPath,
      status: "skipped",
      message: "missing package.json",
      vulnerabilities: emptyVulnerabilities()
    };
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  if (!existsSync(packageLockPath)) {
    return {
      repo,
      path: repoPath,
      packageName: packageJson.name,
      status: "skipped",
      message: "missing package-lock.json; run npm install before auditing",
      vulnerabilities: emptyVulnerabilities()
    };
  }

  const output = npmAudit(repoPath);
  if (!output.ok && !output.report) {
    return {
      repo,
      path: repoPath,
      packageName: packageJson.name,
      status: "check-failed",
      message: output.message,
      vulnerabilities: emptyVulnerabilities()
    };
  }

  const vulnerabilities = normalizeVulnerabilities(output.report);
  const status = vulnerabilities.high > 0 || vulnerabilities.critical > 0 ? "vulnerable" : "clean";
  return {
    repo,
    path: repoPath,
    packageName: packageJson.name,
    status,
    vulnerabilities,
    message: status === "clean"
      ? "no high or critical npm audit findings"
      : "high or critical npm audit findings require review"
  };
}

function npmAudit(cwd) {
  try {
    const stdout = execFileSync("npm", ["audit", "--json", "--audit-level=high"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    return { ok: true, report: JSON.parse(stdout) };
  } catch (error) {
    const stdout = String(error.stdout ?? "").trim();
    if (stdout.length > 0) {
      try {
        return { ok: false, report: JSON.parse(stdout) };
      } catch {
        return { ok: false, message: `npm audit returned invalid JSON: ${stdout.slice(0, 220)}` };
      }
    }
    return { ok: false, message: String(error.stderr ?? error.message).trim() };
  }
}

function normalizeVulnerabilities(report) {
  const metadata = report?.metadata?.vulnerabilities ?? {};
  return {
    info: Number(metadata.info ?? 0),
    low: Number(metadata.low ?? 0),
    moderate: Number(metadata.moderate ?? 0),
    high: Number(metadata.high ?? 0),
    critical: Number(metadata.critical ?? 0),
    total: Number(metadata.total ?? 0)
  };
}

function emptyVulnerabilities() {
  return {
    info: 0,
    low: 0,
    moderate: 0,
    high: 0,
    critical: 0,
    total: 0
  };
}

function printHuman(report) {
  console.log("AgentDispatch npm security audit");
  console.log(`workspace: ${report.workspaceRoot}`);
  console.log(`checked: ${report.checkedAt}`);
  console.log(`threshold: ${report.threshold}`);
  console.log("");
  for (const result of report.results) {
    const vuln = result.vulnerabilities;
    console.log(`- ${result.repo}: ${result.status}`);
    console.log(`  ${result.message}`);
    console.log(`  vulnerabilities: critical ${vuln.critical}, high ${vuln.high}, moderate ${vuln.moderate}, low ${vuln.low}`);
  }
  console.log("");
  console.log("Summary");
  console.log(`- clean: ${report.summary.clean}`);
  console.log(`- vulnerable: ${report.summary.vulnerable}`);
  console.log(`- skipped: ${report.summary.skipped}`);
  console.log(`- check failed: ${report.summary.checkFailed}`);
  console.log(`- high: ${report.summary.high}`);
  console.log(`- critical: ${report.summary.critical}`);
}

function sum(results, key) {
  return results.reduce((total, result) => total + Number(result.vulnerabilities[key] ?? 0), 0);
}
