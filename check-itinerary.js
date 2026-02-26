const { PrismaClient } = require('./node_modules/@prisma/client');
const p = new PrismaClient();

async function main() {
  // 1. Check RouteTemplate for ER - does it have itinerary?
  const templates = await p.routeTemplate.findMany({
    where: { tourTypeCode: 'ER' },
    orderBy: { sortOrder: 'asc' }
  });
  console.log('=== ER RouteTemplate itinerary ===');
  templates.forEach(t => {
    console.log(`  [${t.sortOrder}] "${t.routeName}" → itinerary: ${t.itinerary ? '"'+t.itinerary.substring(0,80)+'"' : 'NULL'}`);
  });

  // 2. Check CO RouteTemplate for comparison
  const coTemplates = await p.routeTemplate.findMany({
    where: { tourTypeCode: 'CO' },
    orderBy: { sortOrder: 'asc' }
  });
  console.log('\n=== CO RouteTemplate itinerary ===');
  coTemplates.forEach(t => {
    console.log(`  [${t.sortOrder}] "${t.routeName}" → itinerary: ${t.itinerary ? '"'+t.itinerary.substring(0,80)+'"' : 'NULL'}`);
  });

  // 3. Check if any ER booking still has itinerary in routes
  const erBookings = await p.booking.findMany({
    where: { tourType: { code: 'ER' } },
    orderBy: { bookingNumber: 'asc' }
  });
  console.log('\n=== ER routes with non-null itinerary ===');
  let found = 0;
  for (const b of erBookings) {
    const routes = await p.route.findMany({
      where: { bookingId: b.id, itinerary: { not: null } }
    });
    if (routes.length > 0) {
      found++;
      routes.forEach(r => console.log(`  ${b.bookingNumber} | "${r.routeName}" | itinerary: "${r.itinerary?.substring(0,100)}"`));
    }
  }
  if (found === 0) console.log('  (none found - all cleared)');

  // 4. Check CO routes for itinerary examples
  console.log('\n=== CO routes with itinerary (first booking) ===');
  const co01 = await p.booking.findFirst({ where: { bookingNumber: 'CO-01' } });
  if (co01) {
    const coRoutes = await p.route.findMany({ where: { bookingId: co01.id }, orderBy: { sortOrder: 'asc' } });
    coRoutes.forEach(r => {
      console.log(`  "${r.routeName}" → ${r.itinerary ? '"'+r.itinerary.substring(0,100)+'"' : 'NULL'}`);
    });
  }

  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
