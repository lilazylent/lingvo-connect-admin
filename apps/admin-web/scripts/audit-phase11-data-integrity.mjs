import fs from "node:fs";

const buildId = "phase15-pre-release-audit-20260922-r4";
const layout = fs.readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
const orders = fs.readFileSync(new URL("../src/components/crm-orders.tsx", import.meta.url), "utf8");

const fail = (message) => { throw new Error(`Phase 11 audit failed: ${message}`); };
if (!layout.includes(`data-build-id="${buildId}"`)) fail("build id provenance");
if (!orders.includes("Math.ceil((chars / 1800) * 10) / 10")) fail("frontend conditional-page ceil-to-tenth rule");
if (orders.includes("Math.round((chars / 1800) * 100) / 100")) fail("legacy hundredth rounding still present");
if (!orders.includes("rate: Number(assignment.rate || 0)")) fail("assignment rate is not posted from wizard/editor");
console.log("Phase 11 data-integrity audit: PASS");
console.log(`Build ID: ${buildId}`);
