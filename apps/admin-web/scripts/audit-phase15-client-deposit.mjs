import fs from 'node:fs';
const root = new URL('..', import.meta.url).pathname;
const read = (p) => fs.readFileSync(root + '/' + p, 'utf8');
const dir = read('src/components/crm-directory.tsx');
const orders = read('src/components/crm-orders.tsx');
const css4 = read('src/app/phase4-directories.css');
const css5 = read('src/app/phase5-orders.css');
const layout = read('src/app/layout.tsx');
const required = [
  [dir.includes('ClientDepositPanel'), 'client deposit panel'],
  [dir.includes('TOP_UP') && dir.includes('SET_BALANCE'), 'manual deposit controls'],
  [dir.includes('/api/admin/companies/${entry.id}/deposit'), 'deposit api wiring'],
  [orders.includes('depositApplied') && orders.includes('depositAfterOrder'), 'order deposit preview'],
  [orders.includes('Будет списано из депозита'), 'deposit debit copy'],
  [css4.includes('.client-deposit-panel { gap: var(--ui-space-4); }'), 'client deposit vertical spacing'],
  [css4.includes('.client-deposit-panel__history { display: grid; gap: var(--ui-space-3); padding-top: var(--ui-space-3);'), 'deposit history spacing'],
  [css5.includes('.client-deposit-preview'), 'order deposit preview styles'],
  [css5.includes('margin-top: var(--ui-space-4);'), 'order deposit preview spacing'],
  [layout.includes('phase15-pre-release-audit-20260922-r4'), 'build id'],
];
const failed = required.filter(([ok]) => !ok).map(([,label]) => label);
if (failed.length) {
  console.error('Phase 15 client deposit audit failed:', failed.join(', '));
  process.exit(1);
}
console.log('Phase 15 client deposit ledger audit: PASS');
console.log('Build ID: phase15-pre-release-audit-20260922-r4');
