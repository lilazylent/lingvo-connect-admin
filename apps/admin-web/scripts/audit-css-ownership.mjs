import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const appDir = path.join(root, "src", "app");
const layout = fs.readFileSync(path.join(appDir, "layout.tsx"), "utf8");

const deleted = [
  "workspace-polish.css",
  "workspace-rhythm.css",
  "theme-system.css",
  "order-deal-redesign.css",
  "files-workspace.css",
  "motion-system.css",
  "frontend-resilience.css",
  "master-reference.css",
];

const problems = [];
for (const file of deleted) {
  if (fs.existsSync(path.join(appDir, file))) problems.push(`${file} unexpectedly exists`);
  if (layout.includes(`./${file}`)) problems.push(`layout.tsx still imports ${file}`);
}

const requiredOrder = [
  "./globals.css",
  "./legacy-visual-core.css",
  "./phase1-shell.css",
  "./phase2-ui-kit.css",
  "./phase4-directories.css",
  "./owner-readability.css",
  "./phase5-orders.css",
  "./phase6-admin.css",
  "./phase8-visual-motion.css",
  "./crm-foundation.css",
];
let last = -1;
for (const item of requiredOrder) {
  const idx = layout.indexOf(`import \"${item}\"`);
  if (idx < 0) problems.push(`missing CSS import ${item}`);
  if (idx <= last && idx >= 0) problems.push(`CSS import order is wrong at ${item}`);
  last = Math.max(last, idx);
}

if (!layout.includes('data-build-id="phase15-pre-release-audit-20260922-r4"')) {
  problems.push("expected build id is missing from RootLayout");
}

if (problems.length) {
  console.error("CSS ownership audit failed:");
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log("CSS ownership audit passed");
console.log(`Deleted standalone legacy files: ${deleted.length}`);
console.log("Canonical CSS import order: OK");
console.log("Build ID: phase15-pre-release-audit-20260922-r4");
