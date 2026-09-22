import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const layout = read("src/app/layout.tsx");
const orders = read("src/components/crm-orders.tsx");
const lookup = read("src/components/crm-lookup.tsx");
const languages = read("src/components/language-combobox.tsx");
const buildId = "phase15-pre-release-audit-20260922-r4";

function must(text, token, label) {
  if (!text.includes(token)) throw new Error(`Missing ${label}: ${token}`);
}

must(layout, `data-build-id="${buildId}"`, "build provenance");
must(lookup, "Debounced server-side autocomplete", "server-side CRM lookup");
must(lookup, "setTimeout", "lookup debounce");
must(languages, "/api/admin/crm/languages?q=", "language catalog search");
must(orders, "/api/admin/crm/pricing/options", "pricing options endpoint");
must(orders, "Тариф по запросу / автоматический тариф не найден", "manual fallback copy");
must(orders, "через русский", "foreign-to-foreign pricing explanation");
must(orders, "quoteAutoDiscount", "automatic discount state");
must(orders, "manualPrice", "manual total override");
must(orders, "tariff_ids", "persisted tariff ids");

console.log("Phase 13.5 tariff automation audit: PASS");
console.log(`Build ID: ${buildId}`);
