const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const rows = await prisma.systemSetting.findMany({ where: { key: { startsWith: 'JP_SECTIONS_' } } });
  const byType = { ER: [], CO: [], KAS: [], ZA: [], OTHER: [] };
  rows.forEach(r => {
    try {
      const d = JSON.parse(r.value);
      const t = d.tourType || 'OTHER';
      const groups = d.groups || [];
      const allStatuses = groups.flatMap(g => (g.visits||[]).map(v => v.status));
      const confirmed = allStatuses.filter(s => s === 'CONFIRMED').length;
      const pending = allStatuses.filter(s => s === 'PENDING').length;
      (byType[t] || byType.OTHER).push({
        key: r.key, hotel: d.hotelName, groups: groups.length,
        confirmed, pending, total: allStatuses.length
      });
    } catch(e) {}
  });
  for (const [type, list] of Object.entries(byType)) {
    if (list.length === 0) continue;
    console.log(`\n=== ${type} (${list.length} hotel) ===`);
    list.forEach(h => console.log(`  ${h.hotel}: ${h.groups} guruh | ${h.confirmed}✅ ${h.pending}⬜ / ${h.total} visit`));
  }
  await prisma.$disconnect();
}
main().catch(console.error);
