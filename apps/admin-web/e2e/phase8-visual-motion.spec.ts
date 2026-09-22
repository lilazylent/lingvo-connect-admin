import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

test("Phase 08 build provenance and canonical motion owner are installed", async () => {
  const layout = read("src/app/layout.tsx");
  expect(layout).toContain('data-build-id="phase15-pre-release-audit-20260922-r4"');
  expect(layout).toContain('import "./phase8-visual-motion.css"');
  expect(layout.indexOf('import "./phase8-visual-motion.css"')).toBeLessThan(layout.indexOf('import "./crm-foundation.css"'));
});

test("Phase 08 uses geometry-safe gloss motion and reduced-motion support", async () => {
  const css = read("src/app/phase8-visual-motion.css");
  expect(css).toContain("@keyframes lc-gloss-sweep");
  expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  expect(css).toContain("@keyframes lc-stage-clock-fill");
});

test("Phase 08 pipeline is prepared as a thin clockwise progress ring", async () => {
  const css = read("src/app/phase8-visual-motion.css");
  const orders = read("src/components/crm-orders.tsx");
  expect(orders).toContain('className="order-stage__glyph"');
  expect(orders).toContain('className="order-stage__dial"');
  expect(orders).toContain('className="order-stage__dial-progress"');
  expect(css).toContain("@keyframes lc-stage-clock-fill");
  expect(css).toContain("stroke-dashoffset:100");
});

test("Phase 08 finance uses the compact economics + client utility composition", async () => {
  const orders = read("src/components/crm-orders.tsx");
  const css = read("src/app/phase8-visual-motion.css");
  expect(orders).toContain("phase5-finance-workspace");
  expect(orders).toContain("Итоговая стоимость заказа");
  expect(orders).toContain("Выплаты исполнителям");
  expect(orders).toContain("Предварительный расчёт");
  expect(css).toContain("grid-template-columns:minmax(0,1.55fr) minmax(300px,.75fr)");
});

test("Phase 08 normalizes Settings navigation and Files source badges", async () => {
  const settings = read("src/components/crm-settings.tsx");
  const css = read("src/app/phase8-visual-motion.css");
  expect(settings).toContain("settings-modules__number");
  expect(css).toContain("width:70px; min-width:70px; height:28px");
  expect(css).toContain("grid-template-columns:70px minmax(0,1fr)");
});
