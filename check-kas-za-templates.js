const { PrismaClient } = require('./node_modules/@prisma/client');
const p = new PrismaClient();

async function main() {
  for (const code of ['KAS', 'ZA']) {
    const templates = await p.routeTemplate.findMany({
      where: { tourTypeCode: code },
      orderBy: { sortOrder: 'asc' }
    });
    console.log(`\n=== ${code} RouteTemplate (${templates.length} routes) ===`);
    templates.forEach(t => {
      console.log(`  [${t.sortOrder}] dayOffset=${t.dayOffset} | ${t.city} | "${t.routeName}" | ${t.provider}`);
    });

    // Check booking route counts
    const bookings = await p.booking.findMany({
      where: { tourType: { code } },
      include: { tourists: { select: { id: true } } },
      orderBy: { bookingNumber: 'asc' }
    });
    console.log(`\n${code} bookings:`);
    for (const b of bookings) {
      const count = await p.route.count({ where: { bookingId: b.id } });
      const pax = b.tourists.length || b.pax || 0;
      console.log(`  ${b.bookingNumber} | dep=${b.departureDate.toISOString().split('T')[0]} | PAX=${pax} | routes=${count}`);
    }
  }
  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
