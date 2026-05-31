#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

const packages = [
  "@agent-dispatch/core",
  "@agent-dispatch/store-sqlite",
  "@agent-dispatch/adapter-aws-agentcore",
  "@agent-dispatch/sdk",
  "@agent-dispatch/worker-agentcore",
  "@agent-dispatch/mcp-server",
  "@agent-dispatch/cli"
];

const keepTemp = process.env.AGENTDISPATCH_KEEP_PUBLISHED_SMOKE === "1";
const consumerDir = await mkdtemp(join(tmpdir(), "agentdispatch-published-consumer-"));

try {
  const versions = {};
  for (const pkg of packages) {
    const result = await run("npm", ["view", pkg, "version"], { cwd: consumerDir });
    versions[pkg] = result.stdout.trim();
  }

  await run("npm", ["init", "-y"], { cwd: consumerDir });
  await run("npm", ["install", "--package-lock=false", ...packages], { cwd: consumerDir });

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
    throw new Error("Published CLI config did not include defaults.runtime=research-agent.");
  }

  const report = {
    generatedAt: new Date().toISOString(),
    ok: true,
    versions,
    tempKept: keepTemp,
    consumerDir: keepTemp ? consumerDir : basename(consumerDir)
  };

  if (process.env.AGENTDISPATCH_PUBLISHED_SMOKE_REPORT) {
    await writeJsonReport(process.env.AGENTDISPATCH_PUBLISHED_SMOKE_REPORT, report);
  }

  console.log(JSON.stringify(report, null, 2));
} finally {
  if (!keepTemp) {
    await rm(consumerDir, { recursive: true, force: true });
  }
}

async function writeJsonReport(path, reportPayload) {
  const reportPath = resolve(path);
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(reportPayload, null, 2)}\n`);
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
