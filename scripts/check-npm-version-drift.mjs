#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const docsRoot = resolve(scriptDir, "..");
const workspaceRoot = resolve(process.env.AGENTDISPATCH_WORKSPACE_ROOT ?? join(docsRoot, ".."));
const args = new Set(process.argv.slice(2));

const publicPackages = [
  { repo: "agentdispatch-core", packageName: "@agent-dispatch/core" },
  { repo: "agentdispatch-store-sqlite", packageName: "@agent-dispatch/store-sqlite" },
  { repo: "agentdispatch-adapter-aws-agentcore", packageName: "@agent-dispatch/adapter-aws-agentcore" },
  { repo: "agentdispatch-sdk-js", packageName: "@agent-dispatch/sdk" },
  { repo: "agentdispatch-worker-agentcore", packageName: "@agent-dispatch/worker-agentcore" },
  { repo: "agentdispatch-mcp-server", packageName: "@agent-dispatch/mcp-server" },
  { repo: "agentdispatch-cli", packageName: "@agent-dispatch/cli" }
];

const checkedAt = new Date().toISOString();
const packages = publicPackages.map((repo) => inspectPackage(repo));
const summary = {
  total: packages.length,
  pendingPublish: packages.filter((pkg) => pkg.status === "pending-publish").length,
  synced: packages.filter((pkg) => pkg.status === "synced").length,
  localBehindNpm: packages.filter((pkg) => pkg.status === "local-behind-npm").length,
  missingOnNpm: packages.filter((pkg) => pkg.status === "missing-on-npm").length,
  checkFailed: packages.filter((pkg) => pkg.status === "check-failed").length
};

const report = {
  checkedAt,
  workspaceRoot,
  releaseOrder: packages.map((pkg) => pkg.name),
  packages,
  summary
};

if (process.env.AGENTDISPATCH_NPM_STATUS_REPORT) {
  writeJsonReport(process.env.AGENTDISPATCH_NPM_STATUS_REPORT, report);
}

if (args.has("--json")) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  printHuman(report);
}

if (args.has("--strict") && (summary.localBehindNpm > 0 || summary.missingOnNpm > 0 || summary.checkFailed > 0)) {
  process.exitCode = 1;
}

function inspectPackage({ repo, packageName }) {
  const packageJsonPath = join(workspaceRoot, repo, "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const localVersion = packageJson.version;
  const name = packageJson.name;
  if (name !== packageName) {
    return {
      repo,
      name,
      localVersion,
      npmVersion: null,
      status: "check-failed",
      message: `${repo}/package.json declares ${name}, expected ${packageName}`
    };
  }
  const npmVersionResult = npmViewVersion(name);

  if (!npmVersionResult.ok) {
    return {
      repo,
      name,
      localVersion,
      npmVersion: null,
      status: npmVersionResult.notFound ? "missing-on-npm" : "check-failed",
      message: npmVersionResult.message
    };
  }

  const npmVersion = npmVersionResult.version;
  const comparison = compareVersions(localVersion, npmVersion);
  const status = comparison > 0
    ? "pending-publish"
    : comparison === 0
      ? "synced"
      : "local-behind-npm";

  return {
    repo,
    name,
    localVersion,
    npmVersion,
    status,
    message: statusMessage(status, localVersion, npmVersion)
  };
}

function npmViewVersion(name) {
  try {
    const output = execFileSync("npm", ["view", name, "version", "--json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();
    const parsed = JSON.parse(output);
    if (typeof parsed !== "string" || parsed.length === 0) {
      return { ok: false, notFound: false, message: `npm returned an unexpected version payload for ${name}` };
    }
    return { ok: true, version: parsed };
  } catch (error) {
    const stderr = String(error.stderr ?? "");
    const notFound = stderr.includes("E404") || stderr.includes("Not found");
    return {
      ok: false,
      notFound,
      message: notFound
        ? `${name} is not published on npm`
        : `failed to read npm version for ${name}: ${stderr.trim() || error.message}`
    };
  }
}

function printHuman(report) {
  console.log("AgentDispatch npm version drift");
  console.log(`workspace: ${report.workspaceRoot}`);
  console.log(`checked: ${report.checkedAt}`);
  console.log("");
  for (const pkg of report.packages) {
    const npmVersion = pkg.npmVersion ?? "unavailable";
    console.log(`- ${pkg.name}: local ${pkg.localVersion}, npm ${npmVersion} -> ${pkg.status}`);
    if (pkg.message) console.log(`  ${pkg.message}`);
  }
  console.log("");
  console.log("Summary");
  console.log(`- pending publish: ${report.summary.pendingPublish}`);
  console.log(`- synced: ${report.summary.synced}`);
  console.log(`- local behind npm: ${report.summary.localBehindNpm}`);
  console.log(`- missing on npm: ${report.summary.missingOnNpm}`);
  console.log(`- check failed: ${report.summary.checkFailed}`);
}

function statusMessage(status, localVersion, npmVersion) {
  if (status === "pending-publish") return `local ${localVersion} is newer than npm ${npmVersion}`;
  if (status === "synced") return `local ${localVersion} matches npm`;
  return `local ${localVersion} is older than npm ${npmVersion}; inspect release history before publishing`;
}

function compareVersions(a, b) {
  const left = parseVersion(a);
  const right = parseVersion(b);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const l = left[index] ?? 0;
    const r = right[index] ?? 0;
    if (l > r) return 1;
    if (l < r) return -1;
  }
  return 0;
}

function parseVersion(version) {
  return version
    .split("-", 1)[0]
    .split(".")
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0));
}

function writeJsonReport(path, reportPayload) {
  const reportPath = resolve(path);
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(reportPayload, null, 2)}\n`);
}
