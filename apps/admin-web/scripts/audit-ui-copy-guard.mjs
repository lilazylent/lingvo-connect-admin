import fs from "node:fs";
import path from "node:path";

const root = path.resolve("src");
const allowedExt = new Set([".ts", ".tsx", ".js", ".jsx"]);
const forbidden = [
  { label: "customer name in UI implementation note", re: /Олег/iu },
  { label: "unconfirmed-with-customer wording", re: /(заказчик|клиент).{0,80}не\s+(подтверж|утверж|соглас)/iu },
  { label: "unconfirmed-by-customer wording", re: /не\s+(подтверж|утверж|соглас).{0,80}(заказчик|клиент)/iu },
  { label: "developer uncertainty wording", re: /не\s+уверен/iu },
  { label: "not-implemented-yet wording", re: /пока\s+не\s+зашит/iu },
];

const failures = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (allowedExt.has(path.extname(entry.name))) {
      const text = fs.readFileSync(full, "utf8");
      for (const rule of forbidden) {
        if (rule.re.test(text)) failures.push(`${path.relative(process.cwd(), full)}: ${rule.label}`);
      }
    }
  }
}
walk(root);

const orders = fs.readFileSync(path.join(root, "components", "crm-orders.tsx"), "utf8");
if (!orders.includes('hint="Тарификация — за секунду."')) {
  failures.push("crm-orders.tsx: audio-listening hint must state only per-second billing");
}
if (failures.length) {
  console.error("UI copy guard failed:\n" + failures.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}
console.log("UI copy guard: PASS");
console.log("Internal customer-approval uncertainty is absent from user-facing source.");
