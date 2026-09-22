import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const orders = read("src/components/crm-orders.tsx");
const css = read("src/app/phase5-orders.css");
const layout = read("src/app/layout.tsx");
const apiMatching = read("../api/app/executor_matching.py");
const operations = read("../api/app/routers/operations.py");
const packageJson = JSON.parse(read("package.json"));
const buildId = "phase15-pre-release-audit-20260922-r4";

const problems = [];
const must = (text, needle, label) => {
  if (!text.includes(needle)) problems.push(`${label}: missing ${JSON.stringify(needle)}`);
};
const forbid = (text, needle, label) => {
  if (text.includes(needle)) problems.push(`${label}: forbidden ${JSON.stringify(needle)}`);
};

must(layout, `data-build-id="${buildId}"`, "build provenance");
must(operations, '@router.get("/orders/{order_id}/works/{work_id}/executor-candidates")', "Phase 10.2 read-only candidate endpoint");
must(apiMatching, '"candidate_state": candidate_state', "factual candidate state");
must(orders, "type ExecutorCandidateResponse", "candidate response contract");
must(orders, "Подобрать исполнителя", "matching trigger");
must(orders, "Подходящие исполнители", "candidate region");
must(orders, "Доступность не указана", "UNKNOWN availability copy");
must(orders, "Исполнитель не найден", "no-candidate state");
must(orders, "Недоступен на срок", "blocking candidate state");
must(orders, "alreadySelected", "duplicate assignment guard");
must(orders, "Назначен", "duplicate assignment UI state");
must(orders, "executorMatchingLockReason", "stale persisted-work guard");
must(orders, "Сначала сохраните работу, затем обновите подбор", "stale matching copy");
must(orders, "next.rate = effectiveCandidateRate(candidate)", "effective executor rate applied to draft");
must(orders, "next.billing_unit = candidate.rate_unit", "default rate unit applied to draft");
must(orders, "onChange([...assignments, next])", "selection mutates existing assignment draft only");
must(css, ".executor-matching", "matching panel styles");
must(css, ".executor-candidate-card", "candidate card styles");
must(css, ".executor-assignments__actions", "shared assignment action layout");
forbid(orders, "VIA_RUSSIAN", "Phase 10.4 routing leakage");
forbid(orders, "ROUTE_VIA_RUSSIAN", "Phase 10.4 routing leakage");

if (packageJson.scripts?.["audit:phase10-matching-ui"] !== "node scripts/audit-phase10-matching-ui.mjs") {
  problems.push("package.json: audit:phase10-matching-ui script missing");
}

const importantCount = (css.match(/!important\b/g) ?? []).length;
if (importantCount > 0) problems.push(`phase5-orders.css contains new !important debt: ${importantCount}`);

if (problems.length) {
  console.error("Phase 10.3 matching UI audit failed:");
  problems.forEach((problem) => console.error(`- ${problem}`));
  process.exit(1);
}

console.log("Phase 10.3 direct matching UI audit passed");
console.log(`Build ID: ${buildId}`);
console.log("Direct selection remains manager-confirmed; routed persistence is verified by the client-demo audit");
