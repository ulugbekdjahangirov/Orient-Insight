const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixCOPlacement() {
  try {
    console.log('🔧 Fixing CO tourists placement to Uzbekistan...\n');

    // Get all CO bookings
    const coBookings = await prisma.booking.findMany({
      where: {
        tourType: {
          code: 'CO'
        }
      },
      include: {
        tourists: true
      }
    });

    console.log(`📋 Found ${coBookings.length} CO bookings\n`);

    for (const booking of coBookings) {
      console.log(`\n📌 Booking ${booking.bookingNumber}:`);
      
      // Update all tourists in this booking
      const updated = await prisma.tourist.updateMany({
        where: {
          bookingId: booking.id
        },
        data: {
          accommodation: 'Uzbekistan'
        }
      });

      console.log(`   ✅ Updated ${updated.count} tourists to Uzbekistan`);
    }

    console.log('\n✅ All CO tourists placement fixed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixCOPlacement();
