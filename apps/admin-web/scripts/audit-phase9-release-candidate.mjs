import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const repo = path.resolve(root, "../..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const readRepo = (relative) => fs.readFileSync(path.join(repo, relative), "utf8");
const problems = [];
const requireText = (body, text, label) => {
  if (!body.includes(text)) problems.push(`${label}: missing ${JSON.stringify(text)}`);
};
const forbidText = (body, text, label) => {
  if (body.includes(text)) problems.push(`${label}: forbidden ${JSON.stringify(text)}`);
};

const buildId = "phase15-pre-release-audit-20260922-r4";
const layout = read("src/app/layout.tsx");
const dashboard = read("src/app/admin/page.tsx");
const applications = read("src/app/admin/applications/page.tsx");
const users = read("src/app/admin/users/page.tsx");
const phase8 = read("src/app/phase8-visual-motion.css");
const phase5 = read("src/app/phase5-orders.css");
const phase6 = read("src/app/phase6-admin.css");
const orders = read("src/components/crm-orders.tsx");
const settings = read("src/components/crm-settings.tsx");
const agents = read("AGENTS.md");
const master = readRepo("docs/CRM_MVP_MASTER_SPEC.md");
const phase9Prompt = readRepo("docs/phases/PHASE_09_MASTER_EXECUTION_PROMPT.md");
const phase9Spec = readRepo("docs/phases/PHASE_09_FINAL_MVP_QA_RELEASE_CANDIDATE.md");
const packageJson = JSON.parse(read("package.json"));

requireText(layout, `data-build-id="${buildId}"`, "release build provenance");
requireText(phase9Prompt, "Phase 10 executor matching/routing is explicitly out of scope", "Phase 10 boundary");
requireText(phase9Spec, "Dashboard KPI cards", "Phase 09 owner acceptance item");
requireText(agents, "Phase 09 final MVP QA + release candidate", "AGENTS Phase 09 contract");
forbidText(agents, "`src/app/master-reference.css`", "deleted CSS ownership path");
forbidText(agents, "`src/app/theme-system.css`", "deleted CSS ownership path");

for (const label of ["Новые заявки", "Активные заказы", "Сдать сегодня", "Просрочено", "Без исполнителя", "Ждут оплаты"]) {
  requireText(dashboard, `label: "${label}"`, `Dashboard metric ${label}`);
}
for (const filler of ["Новые обращения", "Работа в процессе", "0 за сегодня", "Хорошо!", "Требует назначения", "Есть задолженность"]) {
  forbidText(dashboard, filler, "Phase 08 KPI filler regression");
}
requireText(dashboard, 'className="lc-circle-arrow"', "Dashboard metric navigation affordance");
requireText(phase8, "grid-template-rows: auto auto minmax(26px,1fr)", "Dashboard metric reserved footer row");
requireText(phase8, "grid-column:1 / -1;", "Dashboard arrow full-card grid span");
requireText(phase8, "grid-row:3;", "Dashboard arrow lower row");
requireText(phase8, "justify-self:end;", "Dashboard arrow lower-right placement");
requireText(phase8, "align-self:end;", "Dashboard arrow lower placement");
requireText(phase8, "right:auto;", "Dashboard arrow legacy absolute reset");
requireText(phase8, "bottom:auto;", "Dashboard arrow legacy absolute reset");

requireText(applications, "tabIndex={0}", "Applications keyboard-selectable rows");
requireText(applications, "aria-selected={selected?.id === item.id}", "Applications selected-row semantics");
requireText(applications, "event.target !== event.currentTarget", "Applications nested-control keyboard guard");
requireText(users, "tabIndex={0}", "Users keyboard-selectable rows");
requireText(users, "aria-selected={selectedUser?.id === user.id}", "Users selected-row semantics");
requireText(users, "event.target !== event.currentTarget", "Users nested-control keyboard guard");

requireText(orders, 'board: "MAIN" | "ARCHIVE"', "order status board contract");
requireText(orders, 'label: "Добавить в архив"', "order archive action");
requireText(orders, 'label: "Вернуть в основную воронку"', "order restore action");
requireText(orders, 'status.board === board', "Kanban board-scoped statuses");
requireText(settings, "Добавить этап", "custom status stage creation UI");
requireText(settings, 'value="ARCHIVE"', "archive stage Settings option");
requireText(phase8, ".phase5-finance-main-column", "finance independent main column");
requireText(phase8, ".phase5-finance-side-column", "finance independent side column");
requireText(phase8, "grid-template-columns:minmax(0,1.55fr) minmax(340px,.75fr)", "finance two-column alignment");
requireText(phase5, "grid-template-columns: auto minmax(0,1fr) auto auto auto auto", "file row six-column geometry");
requireText(phase5, "grid-template-rows: minmax(54px, auto) auto", "client quote centered action lane");
requireText(phase5, "align-self: center;", "client quote copy action vertical centering");
requireText(phase6, "status-directory__group", "status board Settings grouping");

if (packageJson.scripts?.["audit:phase9"] !== "node scripts/audit-phase9-release-candidate.mjs") {
  problems.push("package.json: audit:phase9 script is missing or incorrect");
}

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
for (const file of deleted) {
  if (fs.existsSync(path.join(root, "src", "app", file))) problems.push(`deleted compatibility file restored: ${file}`);
}
if (fs.existsSync(path.join(root, "src", "app", "phase9.css"))) problems.push("phase9.css override layer must not exist");

const sourceFiles = [];
const collect = (dir) => {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) collect(full);
    else if (/\.(?:ts|tsx)$/.test(item.name)) sourceFiles.push(full);
  }
};
collect(path.join(root, "src"));
const sourceText = sourceFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");
for (const phase10Marker of ["VIA_RUSSIAN", "ROUTE_VIA_RUSSIAN"]) {
  forbidText(sourceText, phase10Marker, "Phase 10 routing leakage");
}

const cssFiles = fs.readdirSync(path.join(root, "src", "app")).filter((file) => file.endsWith(".css"));
let importantCount = 0;
for (const file of cssFiles) {
  const text = fs.readFileSync(path.join(root, "src", "app", file), "utf8");
  importantCount += (text.match(/!important\b/g) ?? []).length;
}
if (importantCount > 30) problems.push(`new !important debt detected: ${importantCount} > Phase 08 baseline 30`);

requireText(master, "Phase 9 — final MVP QA and release candidate", "master Phase 09 delivery contract");

if (problems.length) {
  console.error("Phase 09 release-candidate audit failed:");
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log("Phase 09 release-candidate audit passed");
console.log(`Build ID: ${buildId}`);
console.log("Dashboard KPI arrow grid placement: OK");
console.log("Orders MAIN/ARCHIVE board separation: OK");
console.log("Finance/file owner patch geometry: OK");
console.log("Phase 10 routing boundary: OK; later direct matching UI is intentionally allowed");
console.log(`CSS !important declarations: ${importantCount} (baseline <= 30)`);
console.log("Deleted compatibility stylesheets remain absent: OK");
