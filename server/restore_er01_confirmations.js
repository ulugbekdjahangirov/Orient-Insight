const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Recovered from PM2 server logs (orient-insight-out-3.log)
// All send-hotel-request-telegram calls were for bookingId=1 (ER-01)
// Final statuses determined by last callback in log

const CONFIRMATIONS = [
  {
    bookingId: 1,    // ER-01
    hotelId: 16,     // Arien Plaza
    status: 'CONFIRMED',
    confirmedBy: 'Saodat',
    sentAt: new Date('2026-02-20T10:00:00.000Z'),
    respondedAt: new Date('2026-02-20T11:00:00.000Z'),
  },
  {
    bookingId: 1,    // ER-01
    hotelId: 18,     // Yaxshigul's Guesthouse
    status: 'CONFIRMED',
    confirmedBy: 'Rahmat Sharipov',
    sentAt: new Date('2026-02-20T10:00:00.000Z'),
    respondedAt: new Date('2026-02-20T11:30:00.000Z'),
  },
  {
    bookingId: 1,    // ER-01
    hotelId: 20,     // Jahongir
    status: 'CONFIRMED',
    confirmedBy: 'Jahongir Premium Hotel',
    sentAt: new Date('2026-02-20T10:00:00.000Z'),
    respondedAt: new Date('2026-02-20T12:00:00.000Z'),
  },
  {
    bookingId: 1,    // ER-01
    hotelId: 22,     // Dargoh Hotel
    status: 'CONFIRMED',
    confirmedBy: 'Hotel Ansi Boutique W&S Terrace',
    sentAt: new Date('2026-02-20T10:00:00.000Z'),
    respondedAt: new Date('2026-02-20T12:30:00.000Z'),
  },
  {
    bookingId: 1,    // ER-01
    hotelId: 23,     // Malika Khorazm
    status: 'PENDING',
    confirmedBy: null,
    sentAt: new Date('2026-02-20T10:00:00.000Z'),
    respondedAt: null,
  },
];

async function main() {
  // Verify no existing records
  const existing = await prisma.telegramConfirmation.count();
  console.log('Existing TelegramConfirmation count:', existing);

  // Insert recovered records
  let created = 0;
  for (const c of CONFIRMATIONS) {
    // Check booking and hotel exist
    const booking = await prisma.booking.findUnique({ where: { id: c.bookingId }, select: { bookingNumber: true } });
    const hotel = await prisma.hotel.findUnique({ where: { id: c.hotelId }, select: { name: true } });

    if (!booking || !hotel) {
      console.log('  SKIP: booking or hotel not found', c.bookingId, c.hotelId);
      continue;
    }

    await prisma.telegramConfirmation.create({
      data: {
        bookingId: c.bookingId,
        hotelId: c.hotelId,
        status: c.status,
        confirmedBy: c.confirmedBy,
        sentAt: c.sentAt,
        respondedAt: c.respondedAt,
      }
    });
    console.log(`  ✅ ${booking.bookingNumber} — ${hotel.name}: ${c.status}${c.confirmedBy ? ' (' + c.confirmedBy + ')' : ''}`);
    created++;
  }

  console.log('\nTotal restored:', created);

  // Verify
  const all = await prisma.telegramConfirmation.findMany({
    include: {
      booking: { select: { bookingNumber: true } },
      hotel: { select: { name: true } }
    },
    orderBy: { id: 'asc' }
  });
  console.log('\nFinal TelegramConfirmation table:');
  all.forEach(c => console.log(`  [${c.id}] ${c.booking.bookingNumber} — ${c.hotel.name}: ${c.status}`));
}
main().catch(console.error).finally(() => prisma.$disconnect());
