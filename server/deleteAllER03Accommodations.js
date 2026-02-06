const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteAll() {
  try {
    const booking = await prisma.booking.findFirst({
      where: { bookingNumber: 'ER-03' },
      include: { accommodations: true }
    });

    if (!booking) {
      console.log('ER-03 topilmadi');
      return;
    }

    console.log('\nDeleting ' + booking.accommodations.length + ' accommodations from ER-03...\n');

    for (const acc of booking.accommodations) {
      await prisma.accommodation.delete({ where: { id: acc.id } });
      console.log('Deleted ID ' + acc.id);
    }

    console.log('\nDone!\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteAll();
