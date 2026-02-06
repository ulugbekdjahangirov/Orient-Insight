const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listAll() {
  try {
    const bookings = await prisma.booking.findMany({
      where: {
        bookingNumber: {
          startsWith: 'ER-'
        }
      },
      select: {
        id: true,
        bookingNumber: true,
        departureDate: true,
        endDate: true
      },
      orderBy: { bookingNumber: 'asc' }
    });

    console.log('\nBarcha ER bookinglar:\n');
    bookings.forEach(b => {
      console.log(b.bookingNumber + ': ' + b.departureDate.toISOString().split('T')[0] + ' - ' + b.endDate.toISOString().split('T')[0]);
    });
    console.log('');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listAll();
