import fs from 'node:fs';

const orders = fs.readFileSync('src/components/crm-orders.tsx', 'utf8');
const css = fs.readFileSync('src/app/phase5-orders.css', 'utf8');
const crm = fs.readFileSync('../api/app/routers/crm.py', 'utf8');
const layout = fs.readFileSync('src/app/layout.tsx', 'utf8');
const buildId = 'phase15-pre-release-audit-20260922-r4';

function must(text, needle, label) {
  if (!text.includes(needle)) throw new Error(`Phase 12 assignment/calculator audit failed: ${label}`);
}

must(layout, `data-build-id="${buildId}"`, 'build provenance');
must(orders, 'persistRouteSelection(stageIndex, candidate);', 'route selection persists into draft assignments');
must(orders, 'patchAssignment(assignment.key, { rate: value })', 'manual candidate rate updates persisted draft assignment');
must(orders, 'assignmentPrice(assignment)', 'wizard review uses assignment calculator');
must(orders, 'setRouteSelections(persisted)', 'persisted route assignments restore selection state');
must(crm, 'candidate["candidate_state"] == "UNAVAILABLE"', 'backend blocks only unavailable routed candidates');
must(css, '.executor-route-rate-editor .button', 'manual-rate reset button owner layout');

console.log('Phase 12 assignment/calculator audit: PASS');
console.log(`Build ID: ${buildId}`);
