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
const packages = publicPackages.map((pkg) => dryRunPackage(pkg));
const summary = {
  total: packages.length,
  ok: packages.filter((pkg) => pkg.status === "ok").length,
  checkFailed: packages.filter((pkg) => pkg.status === "check-failed").length,
  unexpectedPackage: packages.filter((pkg) => pkg.status === "unexpected-package").length
};

const report = {
  checkedAt,
  workspaceRoot,
  releaseOrder: packages.map((pkg) => pkg.expectedName),
  packages,
  summary,
  ok: summary.ok === summary.total && summary.checkFailed === 0 && summary.unexpectedPackage === 0
};

if (process.env.AGENTDISPATCH_PUBLISH_DRY_RUN_REPORT) {
  writeJsonReport(process.env.AGENTDISPATCH_PUBLISH_DRY_RUN_REPORT, report);
}

if (args.has("--json")) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  printHuman(report);
}

if (args.has("--strict") && !report.ok) {
  process.exitCode = 1;
}

function dryRunPackage({ repo, packageName }) {
  const repoPath = join(workspaceRoot, repo);
  const packageJson = JSON.parse(readFileSync(join(repoPath, "package.json"), "utf8"));

  if (packageJson.name !== packageName) {
    return {
      repo,
      path: repoPath,
      expectedName: packageName,
      name: packageJson.name,
      localVersion: packageJson.version,
      status: "unexpected-package",
      message: `${repo}/package.json declares ${packageJson.name}, expected ${packageName}`
    };
  }

  try {
    const stdout = execFileSync("npm", ["publish", "--dry-run", "--access", "public", "--json"], {
      cwd: repoPath,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();
    const dryRun = JSON.parse(stdout);
    const name = dryRun.name;
    const version = dryRun.version;
    const fileCount = Array.isArray(dryRun.files) ? dryRun.files.length : 0;

    if (name !== packageName || version !== packageJson.version) {
      return {
        repo,
        path: repoPath,
        expectedName: packageName,
        name,
        localVersion: packageJson.version,
        dryRunVersion: version,
        status: "unexpected-package",
        message: `npm dry-run produced ${name}@${version}, expected ${packageName}@${packageJson.version}`,
        fileCount
      };
    }

    return {
      repo,
      path: repoPath,
      expectedName: packageName,
      name,
      version,
      status: "ok",
      fileCount,
      size: Number(dryRun.size ?? 0),
      unpackedSize: Number(dryRun.unpackedSize ?? 0),
      tarball: dryRun.filename ?? null
    };
  } catch (error) {
    return {
      repo,
      path: repoPath,
      expectedName: packageName,
      name: packageJson.name,
      localVersion: packageJson.version,
      status: "check-failed",
      message: String(error.stderr ?? error.message).trim() || error.message
    };
  }
}

function printHuman(reportPayload) {
  console.log("AgentDispatch npm publish dry-run");
  console.log(`workspace: ${reportPayload.workspaceRoot}`);
  console.log(`checked: ${reportPayload.checkedAt}`);
  console.log("");
  for (const pkg of reportPayload.packages) {
    const version = pkg.version ?? pkg.localVersion ?? "unknown";
    console.log(`- ${pkg.expectedName}@${version}: ${pkg.status}`);
    if (pkg.status === "ok") {
      console.log(`  files: ${pkg.fileCount}, package size: ${pkg.size} bytes, unpacked: ${pkg.unpackedSize} bytes`);
    }
    if (pkg.message) console.log(`  ${pkg.message}`);
  }
  console.log("");
  console.log("Summary");
  console.log(`- ok: ${reportPayload.summary.ok}`);
  console.log(`- unexpected package: ${reportPayload.summary.unexpectedPackage}`);
  console.log(`- check failed: ${reportPayload.summary.checkFailed}`);
}

function writeJsonReport(path, reportPayload) {
  const reportPath = resolve(path);
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(reportPayload, null, 2)}\n`);
}
