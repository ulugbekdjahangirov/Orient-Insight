const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get ER-01 routes to find Khiva and Nurata dates
  const routes = await prisma.route.findMany({
    where: { bookingId: 1 },
    orderBy: { sortOrder: 'asc' }
  });

  // Find Khiva route date
  const khivaRoute = routes.find(r => r.city === 'Khiva' && r.routeName.includes('Bukhara - Khiva'));
  const khivaDate = khivaRoute ? new Date(khivaRoute.date) : new Date('2026-03-23');

  // Nurata is on the way from Bukhara to Khiva — same day as Bukhara-Khiva transfer
  const nurataDate = khivaDate;

  const fmt = (d) => `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;

  console.log('Khiva/Nurata date:', fmt(khivaDate));

  const MEALS = [
    {
      bookingId: 1,          // ER-01
      restaurantName: 'Mahmudjon',
      city: 'Khiva',
      mealDate: fmt(khivaDate),
      pax: 15,
      status: 'CONFIRMED',
      confirmedBy: 'Makhmud Baltayev',
      sentAt: new Date('2026-02-20T10:00:00.000Z'),
      respondedAt: new Date('2026-02-20T11:00:00.000Z'),
    },
    {
      bookingId: 1,          // ER-01
      restaurantName: 'Saida Opa',
      city: 'Nurata',
      mealDate: fmt(nurataDate),
      pax: 15,
      status: 'CONFIRMED',
      confirmedBy: 'Рузиева Саида',
      sentAt: new Date('2026-02-20T10:00:00.000Z'),
      respondedAt: new Date('2026-02-20T11:30:00.000Z'),
    },
  ];

  const existing = await prisma.mealConfirmation.count();
  console.log('Existing MealConfirmation count:', existing);

  let created = 0;
  for (const m of MEALS) {
    await prisma.mealConfirmation.create({ data: m });
    console.log(`  ✅ ${m.restaurantName} (${m.city}) — ${m.mealDate} — ${m.pax} PAX — ${m.status}`);
    created++;
  }

  console.log('\nTotal restored:', created);

  const all = await prisma.mealConfirmation.findMany({
    include: { booking: { select: { bookingNumber: true } } },
    orderBy: { id: 'asc' }
  });
  console.log('\nFinal MealConfirmation table:');
  all.forEach(c => console.log(`  [${c.id}] ${c.booking.bookingNumber} — ${c.restaurantName} (${c.city}) — ${c.mealDate} — ${c.status}`));
}
main().catch(console.error).finally(() => prisma.$disconnect());
