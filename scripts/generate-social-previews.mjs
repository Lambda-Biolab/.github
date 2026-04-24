#!/usr/bin/env node
// Generate GitHub social-preview PNGs for every Lambda Biolab repo.
//
// Config-driven: reads ../social-previews.json. Each entry defines the repo
// name, copy, and accent color. Output goes to ./dist/<repo>.png by default,
// or to ../../<repo>/.github/social-preview.png with --write-to-siblings
// (requires sibling-repo checkouts next to this .github repo).
//
// Usage:
//   pnpm generate:previews                 # dist/ only (safe, CI-friendly)
//   pnpm generate:previews:siblings        # write into each sibling repo
//   node scripts/generate-social-previews.mjs --config path --only repo-name

import { mkdir, readFile, access } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");

function parseArgs(argv) {
  const args = { writeToSiblings: false, config: "social-previews.json", only: null, outDir: "dist" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--write-to-siblings") args.writeToSiblings = true;
    else if (a === "--config") args.config = argv[++i];
    else if (a === "--only") args.only = argv[++i];
    else if (a === "--out-dir") args.outDir = argv[++i];
    else if (a === "--help" || a === "-h") {
      console.log(`Usage: generate-social-previews.mjs [options]

  --write-to-siblings    Write into ../<repo>/.github/social-preview.png
  --only <repo>          Generate a single repo (name must match config)
  --config <path>        Config file (default: social-previews.json)
  --out-dir <path>       Dist directory (default: dist)
`);
      process.exit(0);
    }
  }
  return args;
}

function escape(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function fitTitleSize(title) {
  const len = title.length;
  if (len <= 14) return 72;
  if (len <= 20) return 60;
  if (len <= 26) return 52;
  return 44;
}

function cardSvg({ width, height, title, subtitle, tagline, accent, footer }) {
  const AVATAR_SIZE = 320;
  const avatarX = Math.round(width * 0.1);
  const textX = avatarX + AVATAR_SIZE + 60;
  const textY = Math.round(height * 0.4);
  const titleSize = fitTitleSize(title);

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#08090a"/>
      <stop offset="100%" stop-color="#161b22"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <rect x="0" y="${height - 8}" width="${width}" height="8" fill="${accent}"/>
  <g>
    <text x="${textX}" y="${textY}" font-family="Inter, system-ui, sans-serif" font-size="${titleSize}" font-weight="600" fill="#f0f0f0" letter-spacing="-2">${escape(title)}</text>
    <text x="${textX}" y="${textY + 70}" font-family="Inter, system-ui, sans-serif" font-size="32" font-weight="400" fill="#b0b4bc">${escape(subtitle)}</text>
    <text x="${textX}" y="${textY + 130}" font-family="Inter, system-ui, sans-serif" font-size="28" font-weight="400" fill="#8a8f98">${escape(tagline)}</text>
    <text x="${textX}" y="${height - 60}" font-family="ui-monospace, SFMono-Regular, monospace" font-size="20" font-weight="400" fill="${accent}">${escape(footer)}</text>
  </g>
</svg>`;
}

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

async function resolveOutputPath(entry, args) {
  if (args.writeToSiblings) {
    const siblingGithub = resolve(REPO_ROOT, "..", entry.repo, ".github");
    if (!(await exists(resolve(siblingGithub, "..")))) {
      return { path: null, reason: `sibling repo not found at ../${entry.repo}` };
    }
    await mkdir(siblingGithub, { recursive: true });
    return { path: join(siblingGithub, "social-preview.png") };
  }
  const distDir = resolve(REPO_ROOT, args.outDir);
  await mkdir(distDir, { recursive: true });
  return { path: join(distDir, `${entry.repo}.png`) };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const configPath = resolve(REPO_ROOT, args.config);
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const { defaults, repos } = config;

  const avatarPath = resolve(REPO_ROOT, defaults.avatar);
  const avatarBuf = await readFile(avatarPath);
  const avatarResized = await sharp(avatarBuf).resize(320, 320).png().toBuffer();

  const width = defaults.width ?? 1280;
  const height = defaults.height ?? 640;
  const avatarX = Math.round(width * 0.1);
  const avatarY = Math.round((height - 320) / 2);

  const entries = args.only ? repos.filter((r) => r.repo === args.only) : repos;
  if (entries.length === 0) {
    console.error(`No repos matched${args.only ? ` --only ${args.only}` : ""}`);
    process.exit(1);
  }

  for (const entry of entries) {
    const { path: out, reason } = await resolveOutputPath(entry, args);
    if (!out) {
      console.log(`  skip  ${entry.repo}  (${reason})`);
      continue;
    }
    const svg = Buffer.from(
      cardSvg({
        width,
        height,
        title: entry.title,
        subtitle: entry.subtitle,
        tagline: entry.tagline,
        accent: entry.accent,
        footer: entry.footer ?? defaults.footer,
      })
    );
    await sharp(svg)
      .composite([{ input: avatarResized, left: avatarX, top: avatarY }])
      .png()
      .toFile(out);
    console.log(`  ${entry.repo}  ${entry.accent}  →  ${out.replace(REPO_ROOT + "/", "")}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
