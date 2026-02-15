const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixBooking38() {
  try {
    // Get current booking
    const booking = await prisma.booking.findUnique({
      where: { id: 38 },
      include: { tourType: true }
    });

    if (!booking) {
      console.log('❌ Booking 38 not found!');
      return;
    }

    console.log('\n📋 BEFORE UPDATE:');
    console.log('=====================================');
    console.log('Tour Type:', booking.tourType?.code);
    console.log('Departure Date:', booking.departureDate);
    console.log('Arrival Date:', booking.arrivalDate, '❌');
    console.log('End Date:', booking.endDate);

    // Calculate correct arrivalDate for KAS tour
    // departureDate + 14 days = Uzbekistan arrival (Day 15)
    const departureDate = new Date(booking.departureDate);
    const correctArrivalDate = new Date(departureDate);
    correctArrivalDate.setDate(correctArrivalDate.getDate() + 14);

    console.log('\n🔄 UPDATING...');
    console.log('=====================================');
    console.log('Calculated arrivalDate:', correctArrivalDate.toISOString());

    // Update booking
    const updated = await prisma.booking.update({
      where: { id: 38 },
      data: {
        arrivalDate: correctArrivalDate
      }
    });

    console.log('\n✅ AFTER UPDATE:');
    console.log('=====================================');
    console.log('Tour Type:', booking.tourType?.code);
    console.log('Departure Date:', updated.departureDate);
    console.log('Arrival Date:', updated.arrivalDate, '✅');
    console.log('End Date:', updated.endDate);

    console.log('\n🎉 Booking 38 updated successfully!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixBooking38();
