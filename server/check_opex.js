const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Check all OPEX-related tables
  const models = [
    'tourService', 'opexItem', 'opexEntry', 'expense', 'tourServiceEntry'
  ];

  // Try to find OPEX tables dynamically
  const tableNames = await prisma.$queryRaw`
    SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
  `;
  console.log('All tables:', tableNames.map(t => t.name).join(', '));

  // Check TourService (MEALS, EINTRITT, SHOU etc.)
  try {
    const services = await prisma.tourService.findMany({ orderBy: { id: 'asc' } });
    console.log('\nTourService count:', services.length);
    services.forEach(s => console.log('  [' + s.id + '] ' + s.name + ' | type=' + s.type + ' | price=' + s.price + ' | bookingId=' + s.bookingId));
  } catch(e) { console.log('TourService error:', e.message); }

  // Check any expense-like tables
  for (const model of ['opexItem', 'opexEntry', 'expense']) {
    try {
      const count = await prisma[model].count();
      console.log('\n' + model + ' count:', count);
    } catch(e) { /* model doesn't exist */ }
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
