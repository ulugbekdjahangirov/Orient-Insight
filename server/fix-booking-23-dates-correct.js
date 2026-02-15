const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixDates() {
  try {
    console.log('🔧 Fixing dates for booking 23...');
    console.log('Target dates:');
    console.log('  - Tour Start (checkInDate): 21.09.2025');
    console.log('  - Arrival (arrivalDate): 22.09.2025');
    console.log('  - Tour End (checkOutDate): 04.10.2025');
    console.log('');

    // Step 1: Fix tourists' dates
    const tourists = await prisma.tourist.findMany({
      where: { bookingId: 23 },
      select: {
        id: true,
        fullName: true,
        checkInDate: true,
        checkOutDate: true
      }
    });

    console.log(`Found ${tourists.length} tourists`);
    console.log('');

    // Update each tourist
    let updated = 0;
    for (const tourist of tourists) {
      if (tourist.checkInDate && tourist.checkOutDate) {
        // Set exact dates
        const newCheckIn = new Date('2025-09-21T00:00:00Z');
        const newCheckOut = new Date('2025-10-04T00:00:00Z');

        await prisma.tourist.update({
          where: { id: tourist.id },
          data: {
            checkInDate: newCheckIn,
            checkOutDate: newCheckOut
          }
        });

        console.log(`✓ Updated ${tourist.fullName}:`);
        console.log(`  Check-in: ${new Date(tourist.checkInDate).toISOString().split('T')[0]} → 2025-09-21`);
        console.log(`  Check-out: ${new Date(tourist.checkOutDate).toISOString().split('T')[0]} → 2025-10-04`);
        updated++;
      }
    }

    console.log('');
    console.log(`✅ Updated ${updated} tourists`);
    console.log('');

    // Step 2: Fix booking dates
    const booking = await prisma.booking.findUnique({
      where: { id: 23 },
      select: {
        departureDate: true,
        arrivalDate: true,
        endDate: true
      }
    });

    console.log('Current booking dates:');
    console.log(`  Departure: ${booking.departureDate}`);
    console.log(`  Arrival: ${booking.arrivalDate}`);
    console.log(`  End: ${booking.endDate}`);
    console.log('');

    // Update booking
    await prisma.booking.update({
      where: { id: 23 },
      data: {
        departureDate: new Date('2025-09-21T00:00:00Z'),
        arrivalDate: new Date('2025-09-22T00:00:00Z'),
        endDate: new Date('2025-10-04T00:00:00Z')
      }
    });

    console.log('✅ Updated booking dates:');
    console.log('  Departure: 2025-09-21');
    console.log('  Arrival: 2025-09-22');
    console.log('  End: 2025-10-04');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixDates();
