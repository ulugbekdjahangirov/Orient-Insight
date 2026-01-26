const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixCheckoutDates() {
  try {
    // Find ER booking with departure date 2025-10-15
    const bookings = await prisma.booking.findMany({
      where: {
        tourType: {
          code: 'ER'
        },
        departureDate: {
          gte: new Date('2025-10-01'),
          lte: new Date('2025-10-31')
        }
      },
      include: {
        tourType: true
      }
    });

    console.log('Found bookings:', bookings.map(b => ({
      id: b.id,
      name: b.groupName,
      departure: b.departureDate,
      end: b.endDate
    })));

    if (bookings.length === 0) {
      console.log('No ER bookings found in October 2025');
      return;
    }

    // Update all tourists for these bookings to have checkOutDate = 2025-10-25
    for (const booking of bookings) {
      const result = await prisma.tourist.updateMany({
        where: {
          bookingId: booking.id,
          checkOutDate: {
            not: null
          }
        },
        data: {
          checkOutDate: new Date('2025-10-25T00:00:00.000Z')
        }
      });

      console.log(`✅ Updated ${result.count} tourists for booking ${booking.groupName} (ID: ${booking.id})`);
    }

    console.log('✅ All tourist checkout dates fixed to 2025-10-25');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixCheckoutDates();
