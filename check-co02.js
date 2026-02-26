const { PrismaClient } = require('./node_modules/@prisma/client');
const p = new PrismaClient();
async function main() {
  const b = await p.booking.findFirst({ where: { bookingNumber: 'CO-02' } });
  const routes = await p.route.findMany({ where: { bookingId: b.id }, orderBy: { sortOrder: 'asc' } });
  console.log(`CO-02 routes: ${routes.length}`);
  routes.forEach(r => console.log(`  [${r.sortOrder}] day=${r.dayNumber} | "${r.routeName}" | pax=${r.personCount} | ${r.transportType}`));
  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
