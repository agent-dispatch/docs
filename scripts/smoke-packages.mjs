#!/usr/bin/env node
import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const docsRoot = resolve(scriptDir, "..");
const workspaceRoot = resolve(process.env.AGENTDISPATCH_WORKSPACE_ROOT ?? join(docsRoot, ".."));
const keepTemp = process.env.AGENTDISPATCH_KEEP_SMOKE === "1";
const skipBuild = process.argv.includes("--skip-build");

const packages = [
  { key: "core", repo: "agentdispatch-core", deps: [] },
  { key: "store-sqlite", repo: "agentdispatch-store-sqlite", deps: ["core"] },
  { key: "adapter-aws-agentcore", repo: "agentdispatch-adapter-aws-agentcore", deps: ["core"] },
  { key: "sdk", repo: "agentdispatch-sdk-js", deps: ["core"] },
  { key: "worker-agentcore", repo: "agentdispatch-worker-agentcore", deps: ["core"] },
  { key: "mcp-server", repo: "agentdispatch-mcp-server", deps: ["core", "store-sqlite", "adapter-aws-agentcore"] },
  { key: "cli", repo: "agentdispatch-cli", deps: ["core", "sdk", "store-sqlite", "adapter-aws-agentcore"] }
];

const packageDirs = Object.fromEntries(packages.map((pkg) => [pkg.key, join(workspaceRoot, pkg.repo)]));
const packDir = await mkdtemp(join(tmpdir(), "agentdispatch-packs-"));
const consumerDir = await mkdtemp(join(tmpdir(), "agentdispatch-consumer-"));
const tarballs = new Map();

try {
  await assertWorkspace();
  for (const pkg of packages) {
    const cwd = packageDirs[pkg.key];
    await run("npm", ["install", "--package-lock=false"], { cwd });
    if (pkg.deps.length > 0) {
      await run("npm", [
        "install",
        "--package-lock=false",
        "--no-save",
        ...pkg.deps.map((dep) => tarballs.get(dep))
      ], { cwd });
    }
    if (!skipBuild) {
      await run("npm", ["run", "build"], { cwd });
    }
    const packed = await run("npm", ["pack", "--json", "--pack-destination", packDir], { cwd });
    const [{ filename }] = JSON.parse(packed.stdout);
    tarballs.set(pkg.key, join(packDir, filename));
  }

  await run("npm", ["init", "-y"], { cwd: consumerDir });
  await run("npm", [
    "install",
    "--package-lock=false",
    ...packages.map((pkg) => tarballs.get(pkg.key))
  ], { cwd: consumerDir });

  await run("node", [
    "--input-type=module",
    "-e",
    [
      "await import('@agent-dispatch/core');",
      "await import('@agent-dispatch/sdk');",
      "await import('@agent-dispatch/store-sqlite');",
      "await import('@agent-dispatch/adapter-aws-agentcore');",
      "await import('@agent-dispatch/mcp-server');",
      "await import('@agent-dispatch/worker-agentcore');"
    ].join("")
  ], { cwd: consumerDir });

  const configPath = join(consumerDir, "agentdispatch.config.json");
  await run("npx", [
    "--no-install",
    "agentdispatch",
    "init",
    "--config",
    configPath,
    "--region",
    "us-west-2",
    "--runtime-arn",
    "arn:aws:bedrock-agentcore:us-west-2:123456789012:agent/00000000-0000-0000-0000-000000000000:1"
  ], { cwd: consumerDir });

  const doctor = await run("npx", ["--no-install", "agentdispatch", "doctor", "--config", configPath, "--json"], { cwd: consumerDir });
  assertJsonOk(doctor.stdout, "agentdispatch doctor");

  const mcpCheck = await run("npx", ["--no-install", "agentdispatch-mcp", "--config", configPath, "--check"], { cwd: consumerDir });
  assertJsonOk(mcpCheck.stdout, "agentdispatch-mcp --check");

  const config = JSON.parse(await readFile(configPath, "utf8"));
  if (config.defaults?.runtime !== "research-agent") {
    throw new Error("Generated config did not include defaults.runtime=research-agent.");
  }

  console.log(JSON.stringify({
    ok: true,
    workspaceRoot,
    packed: Object.fromEntries([...tarballs.entries()].map(([key, value]) => [key, keepTemp ? value : basename(value)])),
    tempKept: keepTemp,
    packDir: keepTemp ? packDir : undefined,
    consumerDir: keepTemp ? consumerDir : undefined
  }, null, 2));
} finally {
  if (!keepTemp) {
    await rm(packDir, { recursive: true, force: true });
    await rm(consumerDir, { recursive: true, force: true });
  }
}

async function assertWorkspace() {
  for (const [key, dir] of Object.entries(packageDirs)) {
    try {
      await access(join(dir, "package.json"), constants.R_OK);
    } catch {
      throw new Error(`Missing package ${key} at ${dir}. Set AGENTDISPATCH_WORKSPACE_ROOT to the directory containing all agentdispatch-* repos.`);
    }
  }
}

function assertJsonOk(stdout, label) {
  const parsed = JSON.parse(stdout);
  if (parsed.ok !== true) {
    throw new Error(`${label} did not return ok:true.`);
  }
}

function run(command, args, options) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", rejectRun);
    child.on("close", (code) => {
      if (code === 0) {
        resolveRun({ stdout, stderr });
        return;
      }
      rejectRun(new Error([
        `${command} ${args.join(" ")} failed with exit code ${code} in ${options.cwd}`,
        stdout.trim(),
        stderr.trim()
      ].filter(Boolean).join("\n")));
    });
  });
}
