const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Recovered from PM2 server logs:
// Transport callbacks for booking #1 (ER-01):
//   tr_confirm from Matluba for booking #1 provider sevil (x3)
//   tr_confirm from Saodat  for booking #1 provider xayrulla (x8+)
//   tr_confirm from stay safe for booking #1 provider hammasi
// Final states: all CONFIRMED

const TRANSPORT_RECORDS = [
  {
    bookingId: 1,    // ER-01
    provider: 'hammasi',
    status: 'CONFIRMED',
    confirmedBy: 'stay safe',
    approvedBy: null,
    sentAt: new Date('2026-02-20T10:00:00.000Z'),
    respondedAt: new Date('2026-02-20T11:00:00.000Z'),
  },
  {
    bookingId: 1,    // ER-01
    provider: 'xayrulla',
    status: 'CONFIRMED',
    confirmedBy: 'Saodat',
    approvedBy: 'Matluba',
    sentAt: new Date('2026-02-20T10:00:00.000Z'),
    respondedAt: new Date('2026-02-20T11:30:00.000Z'),
  },
  {
    bookingId: 1,    // ER-01
    provider: 'sevil',
    status: 'CONFIRMED',
    confirmedBy: 'Matluba',
    approvedBy: null,
    sentAt: new Date('2026-02-20T10:00:00.000Z'),
    respondedAt: new Date('2026-02-20T12:00:00.000Z'),
  },
];

async function main() {
  const existing = await prisma.transportConfirmation.count();
  console.log('Existing TransportConfirmation count:', existing);

  let created = 0;
  for (const r of TRANSPORT_RECORDS) {
    const booking = await prisma.booking.findUnique({
      where: { id: r.bookingId },
      select: { bookingNumber: true }
    });
    if (!booking) { console.log('SKIP: booking not found', r.bookingId); continue; }

    await prisma.transportConfirmation.create({ data: r });
    console.log(`  ✅ ${booking.bookingNumber} — ${r.provider}: ${r.status} (${r.confirmedBy})`);
    created++;
  }

  console.log('\nTotal restored:', created);

  const all = await prisma.transportConfirmation.findMany({
    include: { booking: { select: { bookingNumber: true } } },
    orderBy: { id: 'asc' }
  });
  console.log('\nFinal TransportConfirmation table:');
  all.forEach(c => console.log(`  [${c.id}] ${c.booking.bookingNumber} — ${c.provider}: ${c.status}`));

  await prisma.$disconnect();
}
main().catch(console.error);
