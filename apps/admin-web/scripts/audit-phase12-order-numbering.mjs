import fs from "node:fs";

const buildId = "phase15-pre-release-audit-20260922-r4";
const layout = fs.readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
const orders = fs.readFileSync(new URL("../src/components/crm-orders.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/phase5-orders.css", import.meta.url), "utf8");

const must = (source, token, label) => {
  if (!source.includes(token)) throw new Error(`Phase 12 audit failed: ${label}`);
};

must(layout, `data-build-id="${buildId}"`, "build provenance");
must(orders, "Заказ {order.number} · Создан {orderCreatedDate(order.created_at)}", "detail number/date header");
must(orders, "Создан {orderCreatedDate(o.created_at)}", "list/kanban creation date metadata");

must(orders, "orderNumberPreview ?", "draft number preview in wizard header");
must(orders, "/api/admin/crm/orders/number-preview", "read-only draft number preview API");
must(css, ".order-created-date", "shared order metadata styling");
console.log("Phase 12 order numbering audit: PASS");
console.log(`Build ID: ${buildId}`);
