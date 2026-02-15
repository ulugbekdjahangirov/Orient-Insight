const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixDates() {
  try {
    console.log('🔧 Fixing tourist dates for booking 23...');
    console.log('');

    // Get all tourists for booking 23
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

    if (tourists.length === 0) {
      console.log('No tourists found for booking 23');
      return;
    }

    // Show current dates
    console.log('Current dates:');
    tourists.forEach((t, i) => {
      console.log(`${i + 1}. ${t.fullName}`);
      console.log(`   Check-in: ${t.checkInDate}`);
      console.log(`   Check-out: ${t.checkOutDate}`);
    });
    console.log('');

    // Update dates: add 1 day to checkInDate and checkOutDate
    let updated = 0;
    for (const tourist of tourists) {
      if (tourist.checkInDate && tourist.checkOutDate) {
        const oldCheckIn = new Date(tourist.checkInDate);
        const oldCheckOut = new Date(tourist.checkOutDate);

        // Add 1 day
        const newCheckIn = new Date(oldCheckIn);
        newCheckIn.setDate(newCheckIn.getDate() + 1);

        const newCheckOut = new Date(oldCheckOut);
        newCheckOut.setDate(newCheckOut.getDate() + 1);

        await prisma.tourist.update({
          where: { id: tourist.id },
          data: {
            checkInDate: newCheckIn,
            checkOutDate: newCheckOut
          }
        });

        console.log(`✓ Updated ${tourist.fullName}:`);
        console.log(`  Check-in: ${oldCheckIn.toISOString().split('T')[0]} → ${newCheckIn.toISOString().split('T')[0]}`);
        console.log(`  Check-out: ${oldCheckOut.toISOString().split('T')[0]} → ${newCheckOut.toISOString().split('T')[0]}`);
        updated++;
      }
    }

    console.log('');
    console.log(`✅ Successfully updated ${updated} tourists`);
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixDates();
