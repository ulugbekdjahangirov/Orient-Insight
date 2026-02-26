const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const bookings = await prisma.booking.findMany({ where: { bookingYear: 0 } });
  let updated = 0;
  for (const b of bookings) {
    const year = new Date(b.departureDate).getFullYear();
    await prisma.booking.update({ where: { id: b.id }, data: { bookingYear: year } });
    updated++;
  }
  console.log('Updated:', updated, 'bookings with bookingYear');
  const sample = await prisma.booking.findMany({
    select: { bookingNumber: true, bookingYear: true, departureDate: true },
    take: 5
  });
  console.log('Sample:', JSON.stringify(sample, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
