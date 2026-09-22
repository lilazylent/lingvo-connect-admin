import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

test("Owner patch 02 removes KPI filler copy and installs premium glass tint roles", async () => {
  const dashboard = read("src/app/admin/page.tsx");
  const css = read("src/app/phase8-visual-motion.css");
  for (const text of ["Новые обращения", "Работа в процессе", "0 за сегодня", "Хорошо!", "Требует назначения", "Есть задолженность"]) {
    expect(dashboard).not.toContain(text);
  }
  for (const tone of ["wine", "slate", "amber", "red", "teal", "gold"]) {
    expect(dashboard).toContain(`tone: "${tone}"`);
    expect(css).toContain(`.lc-dashboard .lc-metric-card--${tone}`);
  }
  expect(css).toContain("backdrop-filter: blur(14px) saturate(125%)");
  expect(css).toContain("@keyframes lc-gloss-sweep");
  expect(css).toContain("grid-template-rows: auto auto minmax(26px,1fr)");
  expect(css).toContain("grid-column:1 / -1;");
  expect(css).toContain("grid-row:3;");
  expect(css).toContain("justify-self:end;");
  expect(css).toContain("align-self:end;");
});

test("Owner patch 02 applies one shared PageHeader-to-summary spacing contract", async () => {
  const foundation = read("src/app/crm-foundation.css");
  const css = read("src/app/phase8-visual-motion.css");
  expect(foundation).toContain("--ui-page-section-gap: 18px");
  expect(css).toContain(".page-head + .lc-module-metrics");
  expect(css).toContain("margin-top:var(--ui-page-section-gap)");
});

test("Owner patch 02 upgrades semantic helper typography instead of isolated phrases", async () => {
  const css = read("src/app/owner-readability.css");
  expect(css).toContain(".operational-group > div:first-child p");
  expect(css).toContain(".panel-actions > span");
  expect(css).toContain(".settings-head-copy");
  expect(css).toContain("font-size: var(--ui-text-sm)");
  expect(css).toContain(".field__hint,.field__error");
});

test("Owner patch 02 removes the Client nested visual scroll rail", async () => {
  const css = read("src/app/phase4-directories.css");
  expect(css).toContain(".directory-detail-panel");
  expect(css).toContain("max-height: none");
  expect(css).toContain("overflow: visible");
});

test("Owner patch 02 compacts real Settings catalogs with search and pagination", async () => {
  const settings = read("src/components/crm-settings.tsx");
  const css = read("src/app/phase6-admin.css");
  expect(settings).toContain("function SettingsPager");
  expect(settings).toContain("Всего: {total}");
  expect(settings).toContain('function PageSizeControl');
  expect(settings).toContain('[8, 12, 20]');
  expect(settings).toContain('settings-module-card');
  expect(settings).toContain('SettingsModuleGlyph');
  expect(settings).toContain('placeholder="Услуга, код или единица"');
  expect(css).toContain(".settings-catalog-tools");
  expect(css).toContain(".settings-pagination");
  expect(css).toContain(".settings-page-size");
  const motion = read("src/app/phase8-visual-motion.css");
  expect(motion).toContain(".settings-module-dock");
  expect(motion).toContain("shared graphite fade hero for internal CRM pages");
});

test("Owner patch 02 uses an SVG dial for the order pipeline and a clockwise 12-o'clock fill", async () => {
  const orders = read("src/components/crm-orders.tsx");
  const geometry = read("src/app/phase5-orders.css");
  const motion = read("src/app/phase8-visual-motion.css");
  expect(orders).toContain('className="order-stage__glyph"');
  expect(orders).toContain('className="order-stage__dial-progress"');
  expect(geometry).toContain("transform: rotate(-90deg)");
  expect(geometry).toContain("stroke-width: 1.55");
  expect(motion).toContain("@keyframes lc-stage-clock-fill");
  expect(motion).toContain("stroke-dashoffset:100");
  expect(motion).toContain("stroke-dashoffset:0");
});

test("Owner patch 02 build provenance is explicit", async () => {
  const layout = read("src/app/layout.tsx");
  expect(layout).toContain('data-build-id="phase15-pre-release-audit-20260922-r4"');
});

test("Phase 08 final polish installs graphite fade hero and Concept C Settings navigation", async () => {
  const settings = read("src/components/crm-settings.tsx");
  const structure = read("src/app/phase6-admin.css");
  const visual = read("src/app/phase8-visual-motion.css");
  expect(settings).toContain("settings-module-dock");
  expect(settings).toContain("settings-module-select");
  expect(settings).toContain("Раздел настроек");
  expect(settings).toContain("settings-module-card__visual");
  expect(settings).toContain("SettingsModuleGlyph");
  expect(settings).toContain("PageSizeControl");
  expect(settings).toContain("[8, 12, 20]");
  expect(structure).toContain(".settings-page-size");
  expect(structure).toContain("table-layout:fixed");
  expect(visual).toContain("grid-template-columns:repeat(6,minmax(0,1fr))");
  expect(visual).toContain("shared graphite fade hero for internal CRM pages");
  expect(visual).toContain(".content .page-head.page-head--compact");
  expect(visual).toContain(".settings-module-select { display:none; }");
  expect(visual).toContain(".settings-module-dock { display:none; }");
  expect(visual).toContain("radial-gradient(ellipse at 100% 18%");
});
