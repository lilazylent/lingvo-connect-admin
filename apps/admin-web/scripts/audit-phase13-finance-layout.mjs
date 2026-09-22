import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const must = (text, needle, label) => {
  if (!text.includes(needle)) throw new Error(`Missing ${label}: ${needle}`);
};

const orders = read(new URL("../src/components/crm-orders.tsx", import.meta.url));
const phase8 = read(new URL("../src/app/phase8-visual-motion.css", import.meta.url));
const phase5 = read(new URL("../src/app/phase5-orders.css", import.meta.url));
const layout = read(new URL("../src/app/layout.tsx", import.meta.url));
const buildId = "phase15-pre-release-audit-20260922-r4";

must(layout, `data-build-id="${buildId}"`, "build provenance");
must(orders, 'className="phase5-finance-main-column"', "independent finance main column");
must(orders, 'className="phase5-finance-side-column"', "independent finance side column");
must(orders, 'className="executor-finance-breakdown"', "executor payout breakdown");
must(phase8, ".phase5-finance-side-column", "finance side-column owner");
must(phase8, "grid-template-columns:minmax(0,1.55fr) minmax(340px,.75fr)", "desktop two-column finance grid");
must(phase5, ".executor-finance-stage > div:first-child { grid-column:1 / -1", "executor stage header row");
must(phase5, "grid-template-columns:repeat(3,minmax(0,1fr))", "executor metrics grid");

if (phase8.includes(".phase5-finance-workspace > .order-finance-module { display:contents; }")) {
  throw new Error("Legacy display:contents finance layout is still present");
}
console.log("Phase 13 finance layout owner patch audit: PASS");
console.log(`Build ID: ${buildId}`);
