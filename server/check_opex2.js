const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Check OpexConfig
  const opexConfigs = await prisma.opexConfig.findMany({ orderBy: { id: 'asc' } });
  console.log('OpexConfig count:', opexConfigs.length);
  opexConfigs.forEach(o => {
    const val = o.value ? String(o.value).substring(0, 100) : 'NULL';
    console.log('  [' + o.id + '] ' + JSON.stringify(o));
  });

  // Check TourService grouped by type
  const services = await prisma.tourService.findMany({ orderBy: [{ type: 'asc' }, { bookingId: 'asc' }] });
  const byType = {};
  services.forEach(s => { byType[s.type] = (byType[s.type] || 0) + 1; });
  console.log('\nTourService by type:', JSON.stringify(byType));
  console.log('Total TourService:', services.length);

  // Check bookings with TourServices
  const bookingsWithServices = [...new Set(services.map(s => s.bookingId))];
  console.log('Bookings with TourServices:', bookingsWithServices.sort((a,b)=>a-b).join(', '));

  // Check PriceConfig
  try {
    const priceConfigs = await prisma.priceConfig.findMany({ orderBy: { id: 'asc' } });
    console.log('\nPriceConfig count:', priceConfigs.length);
    priceConfigs.slice(0, 5).forEach(p => console.log('  ' + JSON.stringify(p)));
  } catch(e) { console.log('PriceConfig error:', e.message); }
}
main().catch(console.error).finally(() => prisma.$disconnect());
