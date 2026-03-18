const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
  const s = await p.systemSetting.findUnique({ where: { key: 'AUSGABEN_SENT_LOG' } });
  if (!s) { console.log('No log found'); return; }
  const log = JSON.parse(s.value);
  const deduped = [];
  const seen = new Set();
  for (const e of log) {
    const k = e.bookingNumber + '::' + e.tab;
    if (!seen.has(k)) { seen.add(k); deduped.push(e); }
  }
  console.log('Before:', log.length, 'After:', deduped.length);
  await p.systemSetting.update({ where: { key: 'AUSGABEN_SENT_LOG' }, data: { value: JSON.stringify(deduped) } });
  console.log('Done. Log entries:', deduped.map(e => e.bookingNumber + '/' + e.tab).join(', '));
}

run().then(() => p.$disconnect()).catch(e => { console.error(e); p.$disconnect(); });
