#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";

const root = process.cwd();
const markdownFiles = collectMarkdown(root).filter((file) => !file.includes(`${join(root, "node_modules")}/`));
const failures = [];

for (const file of markdownFiles) {
  const text = readFileSync(file, "utf8");
  const links = extractMarkdownLinks(text);
  for (const link of links) {
    if (shouldSkip(link)) continue;
    const [pathPart, anchor] = link.split("#", 2);
    const target = pathPart ? resolve(dirname(file), decodeURIComponent(pathPart)) : file;
    if (!existsSync(target)) {
      failures.push(`${relative(file)} -> missing ${link}`);
      continue;
    }
    if (anchor && extname(target).toLowerCase() === ".md") {
      const targetText = readFileSync(target, "utf8");
      const anchors = new Set(extractHeadingAnchors(targetText));
      if (!anchors.has(anchor.toLowerCase())) {
        failures.push(`${relative(file)} -> missing anchor ${link}`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Checked ${markdownFiles.length} Markdown files for local links.`);

function collectMarkdown(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    if (entry === ".git" || entry === "node_modules" || entry === ".agentdispatch-workspace") continue;
    const path = join(dir, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) files.push(...collectMarkdown(path));
    if (stats.isFile() && extname(path).toLowerCase() === ".md") files.push(path);
  }
  return files;
}

function extractMarkdownLinks(text) {
  const links = [];
  const inline = /!?(?<!\\)\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  for (const match of text.matchAll(inline)) links.push(match[1]);
  const referenceDefs = /^\[[^\]]+\]:\s+(\S+)/gm;
  for (const match of text.matchAll(referenceDefs)) links.push(match[1]);
  return links;
}

function shouldSkip(link) {
  return /^(https?:|mailto:|tel:|#|data:)/i.test(link);
}

function extractHeadingAnchors(text) {
  return [...text.matchAll(/^#{1,6}\s+(.+)$/gm)].map((match) => slugify(match[1]));
}

function slugify(heading) {
  return heading
    .replace(/`([^`]+)`/g, "$1")
    .replace(/<[^>]+>/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

function relative(file) {
  return file.slice(root.length + 1);
}
