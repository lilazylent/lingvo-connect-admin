import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const must = (text, token, label) => {
  if (!text.includes(token)) throw new Error(`Phase 14 audit failed: ${label}`);
};
const buildId = "phase15-pre-release-audit-20260922-r4";
const layout = read("src/app/layout.tsx");
const orders = read("src/components/crm-orders.tsx");
const css = read("src/app/phase5-orders.css");
const serviceDefs = read("../api/app/service_definitions.py");
const crm = read("../api/app/routers/crm.py");
const migration = read("../api/alembic/versions/0024_service_work_fields.py");

must(layout, `data-build-id="${buildId}"`, "build provenance");
for (const code of [
  "written_translation", "editing", "proofreading", "typing",
  "notarial_certification", "company_certification", "apostille", "notarial_copy",
  "text_layout", "drawing_layout", "recognition", "delivery",
  "audio_listening", "transcription", "consecutive_interpreting", "simultaneous_interpreting",
]) must(serviceDefs, `"${code}"`, `service definition ${code}`);
for (const token of [
  '"certification_mode"', '"document_count"', '"duration_seconds"', '"hour_count"',
  '"start_date"', '"start_time"', '"PER_SECOND"', '"HOURLY"',
  '"matching_mode": "SERVICE_ONLY"', '"matching_mode": "SOURCE_LANGUAGE"',
  '"supports_routing": True',
]) must(serviceDefs, token, token);
must(serviceDefs, '"BOUND"', "company certification bound variant");
must(serviceDefs, '"PER_PAGE"', "company certification per-page variant");
must(orders, "Сначала выберите услугу", "service-first form");
must(orders, "activeServiceFields", "dynamic field visibility");
must(orders, "serviceBillingUnit", "service-driven units");
must(orders, "Количество документов", "document volume UI");
must(orders, "Длительность, секунд", "seconds volume UI");
must(orders, "Количество часов", "hour volume UI");
must(orders, "Вариант заверения", "certification variant UI");
must(orders, "Округление вверх до 0,1; минимум 1 страница", "page rule UI");
must(orders, "Не учитывать в расчёте для клиента", "non-billable regression");
must(orders, "service={services.find", "assignment editor consumes service definition");
must(css, ".service-driven-work-draft", "dynamic form owner CSS");
must(css, "grid-auto-flow: row dense", "dense dynamic form packing");
must(css, ":nth-child(odd):not(.service-form-intro):not(.textarea):has(+ .internal-work-switch)", "orphan half-row compaction");
must(crm, "return max(Decimal(\"1\"), rounded)", "minimum one conditional page");
must(crm, "fields_for(payload.service_code", "server field sanitisation");
must(crm, 'item["definition"] = definition_view(row.code)', "service definitions API");
must(migration, 'revision = "0024_service_work_fields"', "migration revision");

for (const forbidden of ["deposit_balance", "wallet_balance", "auto_spend", "customer_wallet"]) {
  if (orders.includes(forbidden) || serviceDefs.includes(forbidden) || migration.includes(forbidden)) {
    throw new Error(`Phase 14 audit failed: deferred client-balance feature leaked into phase (${forbidden})`);
  }
}

console.log("Phase 14 service-driven forms audit: PASS");
console.log(`Build ID: ${buildId}`);
