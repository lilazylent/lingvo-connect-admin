import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const checks = [];
const expect = (condition, message) => checks.push({ ok: Boolean(condition), message });

const orders = read("src/components/crm-orders.tsx");
const settings = read("src/components/crm-settings.tsx");
const users = read("src/app/admin/users/page.tsx");
const shell = read("src/components/admin-shell.tsx");
const css = read("src/app/phase16-owner-feedback.css");
const layout = read("src/app/layout.tsx");

expect(orders.includes('"cash"') && orders.includes('"cashless"') && orders.includes('"deposit"'), "payment method uses three canonical choices");
expect(orders.includes("service-driven-grid--written"), "written translation uses dedicated owner-approved grid");
expect(orders.includes("Обычный переводчик") && orders.includes("Носитель языка"), "translator type copy is explicit");
expect(settings.includes("showSourceLanguage") && settings.includes("showTargetLanguage") && settings.includes("showNativeMultiplier"), "tariff editor is service-driven");
expect(!settings.includes('label="Коэф. срочности"'), "tariff editor no longer exposes base urgency multiplier");
expect(users.includes("Роли и права") && users.includes("/api/admin/users/roles"), "roles and permissions UI is present");
expect(shell.includes("ORDERS_VIEW") && shell.includes("USERS_MANAGE") && shell.includes("SETTINGS_MANAGE"), "navigation is permission-aware");
expect(css.includes(".phase5-orders-filters") && css.includes("@media (max-width: 1320px)"), "orders filters wrap before tablet overflow");
expect(css.includes(".price-row__fields--tariff") && css.includes("minmax(230px, 2fr)"), "calculation row has readable content-aware widths");
expect(css.includes("safe-area-inset-top") && css.includes("overflow-x:hidden"), "global mobile safe-area/overflow hardening is present");
expect(layout.includes('import "./phase16-owner-feedback.css";'), "Phase 16 CSS is loaded globally");
expect(!orders.includes('label="Название заказа"') && !orders.includes("Заказ без названия") && !orders.includes("Клиент / название"), "order title field and title fallbacks are removed from order UI");
expect(orders.includes('placeholder="№ заказа или клиент"'), "order search uses number/client semantics only");
expect(!settings.slice(settings.indexOf("function ServiceForm("), settings.indexOf("function Tariffs(")).includes("allowedUnits"), "service editor has no leaked tariff-only allowedUnits logic");
expect(settings.slice(settings.indexOf("function TariffForm("), settings.indexOf("function Rules(")).includes("const showTargetLanguage"), "tariff service-driven variables live inside TariffForm");

let failed = 0;
for (const check of checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"}  ${check.message}`);
  if (!check.ok) failed += 1;
}
if (failed) {
  console.error(`\n${failed} Phase 16 audit check(s) failed.`);
  process.exit(1);
}
console.log(`\nPhase 16 owner-feedback audit passed (${checks.length}/${checks.length}).`);
