// Phase 0 metrics report — prints acquisition, activation, retention, and
// feature-adoption numbers to the terminal without needing the web UI.
//
// Usage: npx tsx scripts/metrics.ts
//
// Reads the same aggregation as the /admin/metrics dashboard, so the CLI and the
// dashboard never disagree.

import 'dotenv/config';
import { getMetricsOverview } from '../src/lib/metrics';

function bar(pct: number, width = 24): string {
  const filled = Math.round((Math.max(0, Math.min(100, pct)) / 100) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

async function main() {
  const m = await getMetricsOverview();

  console.log('\n=== PRODUCT METRICS ===');
  console.log(`Generated ${m.generatedAt}\n`);

  console.log('TOTALS');
  console.log(`  Users:            ${m.totals.users}`);
  console.log(`  Verified:         ${m.totals.verifiedUsers} (${m.verificationRate}%)`);
  console.log(`  Activated:        ${m.totals.activatedUsers}`);
  console.log(`  Weekly active:    ${m.totals.wau}`);
  console.log(`  Events (30d):     ${m.totals.eventsLast30d}\n`);

  console.log('ACQUISITION → ACTIVATION FUNNEL');
  for (const s of m.funnel) {
    console.log(`  ${bar(s.pctOfTop)} ${String(s.pctOfTop).padStart(5)}%  ${s.label} (${s.count})`);
  }
  console.log('');

  console.log('RETENTION');
  console.log(`  D7:  ${m.retention.d7}%`);
  console.log(`  D30: ${m.retention.d30}%`);
  console.log(`  ${m.retention.cohortNote}\n`);

  console.log('FEATURE ADOPTION (% of 30d-active users)');
  for (const f of m.featureAdoption) {
    console.log(`  ${bar(f.pctOfActive)} ${String(f.pctOfActive).padStart(5)}%  ${f.feature} (${f.users})`);
  }
  console.log('');

  if (m.importerHealth.length) {
    console.log('IMPORTER HEALTH');
    for (const i of m.importerHealth) {
      console.log(`  ${i.source.padEnd(10)} imports=${i.imports}  rows=${i.rowsInserted}`);
    }
    console.log('');
  }

  if (m.errors.total) {
    console.log(`ERRORS (30d): ${m.errors.total}`);
    for (const e of m.errors.byRoute) console.log(`  ${e.route} — ${e.count}`);
    console.log('');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
