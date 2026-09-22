import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";


function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255);
}
function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}
function tokenHex(block, token) {
  const match = block.match(new RegExp(`${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*(#[0-9a-fA-F]{6})`));
  return match?.[1]?.toLowerCase() ?? null;
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const appDir = path.join(root, "src", "app");
const layoutPath = path.join(appDir, "layout.tsx");
const foundationName = "crm-foundation.css";
const cssFiles = fs.readdirSync(appDir).filter((name) => name.endsWith(".css")).sort();
const legacyFiles = cssFiles.filter((name) => name !== foundationName);
const selectors = new Map();
const media = new Set();
let important = 0;
let colorOccurrences = 0;
const colors = new Set();
let lines = 0;

for (const name of legacyFiles) {
  const source = fs.readFileSync(path.join(appDir, name), "utf8");
  lines += source.split(/\r?\n/).length;
  important += (source.match(/!important/g) || []).length;
  for (const match of source.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
    colorOccurrences += 1;
    colors.add(match[0].toLowerCase());
  }
  for (const match of source.matchAll(/@media\s*\(([^)]*)\)/g)) media.add(match[1].replace(/\s+/g, " ").trim());
  // Deliberately conservative static selector inventory; this is a debt signal,
  // not a CSS parser and therefore does not gate builds on duplicate count.
  for (const match of source.matchAll(/(?:^|})\s*([^@{}][^{}]*?)\s*\{/gm)) {
    for (const raw of match[1].split(",")) {
      const selector = raw.trim();
      if (!selector || /^(from|to|\d+%)$/.test(selector)) continue;
      if (!selectors.has(selector)) selectors.set(selector, new Set());
      selectors.get(selector).add(name);
    }
  }
}

const duplicates = [...selectors.values()].filter((owners) => owners.size > 1).length;
const layout = fs.readFileSync(layoutPath, "utf8");
const styleImports = [...layout.matchAll(/import\s+"\.\/(.+?\.css)";/g)].map((m) => m[1]);
const foundationIsLast = styleImports.at(-1) === foundationName;
const foundation = fs.readFileSync(path.join(appDir, foundationName), "utf8");
const requiredTokens = [
  "--crm-bg", "--crm-surface", "--crm-border", "--crm-text", "--crm-accent",
  "--ui-sidebar-width", "--ui-topbar-height", "--ui-control-height",
  "--motion-interaction", "--motion-panel", "--z-modal",
];
const missingTokens = requiredTokens.filter((token) => !foundation.includes(token));

const lightBlock = foundation.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
const darkBlock = foundation.match(/html\[data-crm-theme="dark"\]\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
const contrastChecks = {
  light_primary: contrast(tokenHex(lightBlock, "--crm-text"), tokenHex(lightBlock, "--crm-bg")),
  light_secondary: contrast(tokenHex(lightBlock, "--crm-text-secondary"), tokenHex(lightBlock, "--crm-bg")),
  light_muted: contrast(tokenHex(lightBlock, "--crm-text-muted"), tokenHex(lightBlock, "--crm-bg")),
  light_accent_on_surface: contrast(tokenHex(lightBlock, "--crm-accent"), tokenHex(lightBlock, "--crm-surface")),
  dark_primary: contrast(tokenHex(darkBlock, "--crm-text"), tokenHex(darkBlock, "--crm-bg")),
  dark_secondary: contrast(tokenHex(darkBlock, "--crm-text-secondary"), tokenHex(darkBlock, "--crm-bg")),
  dark_muted: contrast(tokenHex(darkBlock, "--crm-text-muted"), tokenHex(darkBlock, "--crm-bg")),
  dark_accent_on_surface: contrast(tokenHex(darkBlock, "--crm-accent"), tokenHex(darkBlock, "--crm-surface")),
};
const contrastFailures = Object.entries(contrastChecks).filter(([, ratio]) => ratio < 4.5);

const report = {
  foundation: {
    imported_last: foundationIsLast,
    missing_required_tokens: missingTokens,
    contrast_ratios: Object.fromEntries(Object.entries(contrastChecks).map(([key, value]) => [key, Number(value.toFixed(2))])),
    contrast_failures_below_4_5: contrastFailures.map(([key]) => key),
  },
  legacy_debt_baseline: {
    css_files: legacyFiles.length,
    css_lines: lines,
    important_declarations: important,
    literal_color_occurrences: colorOccurrences,
    unique_literal_colors: colors.size,
    cross_file_duplicate_selectors: duplicates,
    media_query_variants: media.size,
  },
};

console.log(JSON.stringify(report, null, 2));
if (!foundationIsLast || missingTokens.length || contrastFailures.length) process.exitCode = 1;
