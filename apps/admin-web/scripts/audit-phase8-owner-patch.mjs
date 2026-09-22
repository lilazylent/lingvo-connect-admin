import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const problems = [];
const requireText = (body, text, label) => { if (!body.includes(text)) problems.push(`${label}: missing ${JSON.stringify(text)}`); };
const forbidText = (body, text, label) => { if (body.includes(text)) problems.push(`${label}: forbidden legacy text ${JSON.stringify(text)}`); };

const layout = read("src/app/layout.tsx");
const dashboard = read("src/app/admin/page.tsx");
const applications = read("src/app/admin/applications/page.tsx");
const users = read("src/app/admin/users/page.tsx");
const directories = read("src/components/crm-directory.tsx");
const orders = read("src/components/crm-orders.tsx");
const settings = read("src/components/crm-settings.tsx");
const foundation = read("src/app/crm-foundation.css");
const phase4 = read("src/app/phase4-directories.css");
const readability = read("src/app/owner-readability.css");
const phase5 = read("src/app/phase5-orders.css");
const phase6 = read("src/app/phase6-admin.css");
const phase8 = read("src/app/phase8-visual-motion.css");
const allSrc = [dashboard, applications, users, directories, orders, settings].join("\n");

requireText(layout, 'data-build-id="phase15-pre-release-audit-20260922-r4"', "build provenance");
requireText(layout, 'import "./phase8-visual-motion.css"', "phase8 owner import");

for (const copy of ["Новые обращения", "Работа в процессе", "0 за сегодня", "Хорошо!", "Требует назначения", "Есть задолженность"]) {
  forbidText(allSrc, copy, "KPI cleanup");
}
for (const tone of ["wine", "slate", "amber", "red", "teal", "gold"]) {
  requireText(dashboard, `tone: "${tone}"`, `Dashboard semantic tone ${tone}`);
  requireText(phase8, `.lc-dashboard .lc-metric-card--${tone}`, `Dashboard glass tone ${tone}`);
}
requireText(phase8, "backdrop-filter: blur(14px) saturate(125%)", "premium glass");
requireText(phase8, "@keyframes lc-gloss-sweep", "geometry-safe gloss");
requireText(phase8, ".lc-dashboard .lc-circle-arrow {", "KPI arrow owner");
requireText(phase8, "grid-template-rows: auto auto minmax(26px,1fr)", "KPI arrow reserved row");
requireText(phase8, "grid-column:1 / -1;", "KPI arrow grid span");
requireText(phase8, "grid-row:3;", "KPI arrow lower row");
requireText(phase8, "justify-self:end;", "KPI arrow lower-right alignment");
requireText(phase8, "align-self:end;", "KPI arrow bottom alignment");
requireText(phase8, "right:auto;", "KPI arrow removes legacy absolute inset");
requireText(phase8, "bottom:auto;", "KPI arrow removes legacy absolute inset");

requireText(foundation, "--ui-page-section-gap: 18px", "shared page spacing token");
requireText(phase8, ".page-head + .lc-module-metrics", "shared PageHeader summary spacing");
requireText(phase8, "margin-top:var(--ui-page-section-gap)", "shared PageHeader summary spacing");

requireText(readability, ".operational-group > div:first-child p", "form helper typography");
requireText(readability, ".panel-actions > span", "save-state typography");
requireText(readability, ".settings-head-copy", "settings helper typography");
requireText(readability, "font-size: var(--ui-text-sm)", "readable helper font size");

requireText(phase4, ".directory-detail-panel {", "detail scroll cleanup");
requireText(phase4, "max-height: none", "detail scroll cleanup");
requireText(phase4, ".directory-detail-panel__body { overflow: visible; }", "detail scroll cleanup");

requireText(settings, "function SettingsPager", "Settings pagination");
requireText(settings, "Всего: {total}", "Settings pagination summary");
requireText(settings, 'placeholder="Услуга, код или единица"', "Services search");
requireText(settings, 'function PageSizeControl', "Settings page size control");
requireText(settings, '[8, 12, 20]', "Settings compact page sizes");
requireText(settings, 'settings-module-card', "Settings Concept C module dock");
requireText(settings, 'settings-module-select', "Settings compact mobile selector");
requireText(settings, 'Раздел настроек', "Settings mobile selector label");
requireText(settings, 'SettingsModuleGlyph', "Settings custom module pictograms");
requireText(phase6, ".settings-catalog-tools", "Settings compact toolbar");
requireText(phase6, ".settings-pagination", "Settings pager styling");
requireText(phase6, ".phase6-settings .settings-modules", "Settings nav ownership");
requireText(phase6, ".settings-page-size", "Settings compact page size control styling");
requireText(phase8, ".settings-module-dock", "Settings Concept C dock styling");
requireText(phase8, ".settings-module-select { display:none; }", "Settings desktop/mobile selector contract");
requireText(phase8, ".settings-module-dock { display:none; }", "Settings narrow-screen dock collapse");
requireText(phase8, "shared graphite fade hero for internal CRM pages", "shared graphite fade hero");
requireText(read("src/components/select.tsx"), 'className="select-check"', "shared Select check indicator");
requireText(read("src/components/select.tsx"), 'strokeWidth="1.55"', "shared Select check SVG");
requireText(read("src/app/phase2-ui-kit.css"), ".select-check {", "shared Select check styling");

for (const marker of ['className="order-stage__glyph"', 'className="order-stage__dial"', 'className="order-stage__dial-progress"']) {
  requireText(orders, marker, "Order pipeline SVG dial");
}
forbidText(orders, 'className="order-stage__ring"', "Order pipeline legacy bubble");
requireText(phase5, "transform: rotate(-90deg)", "Order dial starts at 12 o'clock");
requireText(phase5, "stroke-width: 1.55", "Order dial thin progress stroke");
requireText(phase8, "@keyframes lc-stage-clock-fill", "Order dial animation");
requireText(phase8, "stroke-dashoffset:100", "Order dial animation start");
requireText(phase8, "stroke-dashoffset:0", "Order dial animation finish");
requireText(phase8, "prefers-reduced-motion: reduce", "Reduced-motion contract");

// Earlier Phase 08 owner requirements must survive the patch too.
const shell = read("src/components/admin-shell.tsx");
const icons = read("src/components/icons.tsx");
requireText(icons, "export function Pictogram", "shared pictogram family");
requireText(icons, 'settings: <><circle cx="12" cy="12" r="3.15"', "redrawn settings gear");
requireText(shell, 'className="lc-sidebar-promo__art"', "sidebar translation artwork");
forbidText(shell, '<span>→</span>', "sidebar fake promo action");
requireText(dashboard, 'className="lc-translation-art"', "Dashboard translation artwork");
requireText(phase8, ".lc-finance-bars b", "Dashboard finance-bar motion");
requireText(phase8, ".lc-global-search:focus-within", "rounded global search focus");
requireText(phase8, "width:70px; min-width:70px; height:28px", "Files fixed source badge geometry");
requireText(phase8, "phase5-finance-workspace.is-active", "balanced Order Finance workspace");
requireText(phase8, "grid-template-columns:minmax(0,1.55fr) minmax(340px,.75fr)", "balanced Order Finance workspace");
requireText(foundation, "--crm-accent: #b23a5a", "restrained light wine accent");

const legacy = read("src/app/legacy-visual-core.css");
forbidText(legacy, 'html[data-crm-theme="dark"] .order-stage {', "legacy Dark pipeline blocker");
forbidText(legacy, 'html[data-crm-theme="dark"] .lc-module-metric,', "legacy Dark module-metric blocker");
forbidText(legacy, ':is(.lc-surface,.lc-metric-card,', "legacy Dark Dashboard-glass blocker");

if (problems.length) {
  console.error("Phase 08 owner patch audit failed:");
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log("Phase 08 owner patch audit passed");
console.log("Build ID: phase15-pre-release-audit-20260922-r4");
console.log("KPI cleanup/glass: OK");
console.log("Shared page spacing: OK");
console.log("Helper typography: OK");
console.log("Client detail scroll cleanup: OK");
console.log("Settings Concept C dock/catalog UX: OK");
console.log("Shared graphite fade hero: OK");
console.log("Order SVG clockwise dial: OK");
