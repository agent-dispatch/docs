#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const args = process.argv.slice(2);
const evidenceDir = resolve(valueAfter("--evidence-dir") ?? process.env.AGENTDISPATCH_LAUNCH_EVIDENCE_DIR ?? process.cwd());
const outputPath = process.env.AGENTDISPATCH_LAUNCH_SUMMARY_REPORT
  ? resolve(process.env.AGENTDISPATCH_LAUNCH_SUMMARY_REPORT)
  : null;

const reports = {
  localE2e: readJson("agentdispatch-local-e2e-report.json"),
  npmStatus: readJson("agentdispatch-npm-status-report.json"),
  publishDryRun: readJson("agentdispatch-publish-dry-run-report.json"),
  security: readJson("agentdispatch-security-audit-report.json"),
  publishedSmoke: readJson("agentdispatch-published-smoke-report.json"),
  releaseStatus: readJson("agentdispatch-release-status.json")
};

const markdown = renderSummary();

if (outputPath) {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, markdown);
} else {
  process.stdout.write(markdown);
}

function renderSummary() {
  const release = reports.releaseStatus.value;
  const summary = release.summary ?? {};
  const gates = release.gates ?? [];
  const pendingPublish = reports.npmStatus.value.summary?.pendingPublish ?? 0;
  const synced = reports.npmStatus.value.summary?.synced ?? 0;
  const cleanRepos = reports.security.value.summary?.clean ?? 0;
  const vulnerableRepos = reports.security.value.summary?.vulnerable ?? 0;
  const publishOk = reports.publishDryRun.value.summary?.ok ?? 0;
  const publishTotal = reports.publishDryRun.value.summary?.total ?? 0;
  const publishedVersions = reports.publishedSmoke.value.versions ?? {};

  const lines = [
    "# AgentDispatch Launch Evidence Summary",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Evidence directory: \`${evidenceDir}\``,
    "",
    "## Gate Status",
    "",
    "| Gate | Status |",
    "| --- | --- |",
    ...gates.map((gate) => `| ${gate.name} | ${gate.status} |`),
    "",
    "## What This Evidence Supports",
    "",
    `- Local launch claim ready: ${yesNo(summary.readyForLocalLaunchClaim)}.`,
    `- Local E2E report retained: ${yesNo(summary.localE2eReportFound)}.`,
    `- Publish dry-run retained: ${yesNo(summary.publishDryRunReportFound)} (${publishOk}/${publishTotal} public packages).`,
    `- npm version check retained: ${yesNo(summary.npmStatusReportFound)} (${pendingPublish} pending publish, ${synced} synced).`,
    `- Security audit retained: ${yesNo(summary.securityReportFound)} (${cleanRepos} clean repos, ${vulnerableRepos} vulnerable repos).`,
    `- Published package canary retained: ${yesNo(summary.publishedSmokeReportFound)}.`,
    "",
    "## Published npm Versions Checked",
    "",
    ...Object.entries(publishedVersions).map(([name, version]) => `- \`${name}@${version}\``),
    "",
    "## Remaining Blockers",
    "",
    ...remainingBlockers(summary, pendingPublish),
    "",
    "## Claim Boundary",
    "",
    "- Safe: the current local multi-repo workspace passes the no-cloud launch gate when all retained reports are present and gates above are `ok` except `live-aws`.",
    "- Safe: the currently published npm packages install and expose the expected public imports and binaries when `published-canary` is `ok`.",
    "- Not safe yet: do not claim live AWS dispatch until `verify:aws-live` succeeds with `AGENTDISPATCH_LIVE_DISPATCH=1` and a retained live dispatch report.",
    ""
  ];

  return `${lines.join("\n")}\n`;
}

function remainingBlockers(summary, pendingPublish) {
  const blockers = [];
  if (Number(summary.reposAheadOfOrigin ?? 0) > 0) {
    blockers.push(`- ${summary.reposAheadOfOrigin} repos have commits ahead of \`origin/main\`.`);
  }
  if (pendingPublish > 0) {
    blockers.push(`- ${pendingPublish} local public package versions are newer than npm and still need publication.`);
  }
  if (!summary.liveAwsDispatchVerified) {
    blockers.push("- Live AWS dispatch evidence is missing.");
  }
  return blockers.length > 0 ? blockers : ["- None for no-cloud launch claims."];
}

function readJson(filename) {
  const path = join(evidenceDir, filename);
  if (!existsSync(path)) {
    throw new Error(`Missing launch evidence report: ${path}`);
  }
  return {
    filename,
    path,
    value: JSON.parse(readFileSync(path, "utf8"))
  };
}

function valueAfter(flag) {
  const index = args.indexOf(flag);
  if (index === -1) return null;
  return args[index + 1] ?? null;
}

function yesNo(value) {
  return value ? "yes" : "no";
}
