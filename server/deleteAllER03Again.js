const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteAll() {
  try {
    const deleted = await prisma.accommodation.deleteMany({
      where: {
        booking: { bookingNumber: 'ER-03' }
      }
    });

    console.log('\nDeleted ' + deleted.count + ' accommodations from ER-03\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteAll();
