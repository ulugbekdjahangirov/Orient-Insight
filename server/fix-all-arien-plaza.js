/**
 * Reset ALL Arien Plaza accommodations across ALL bookings
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixAllArienPlaza() {
  console.log('🔍 Searching for ALL Arien Plaza accommodations...\n');

  try {
    // 1. Find Arien Plaza hotel
    const arienPlaza = await prisma.hotel.findFirst({
      where: {
        name: {
          contains: 'Arien'
        }
      }
    });

    if (!arienPlaza) {
      console.log('❌ Arien Plaza hotel not found!');
      return;
    }

    console.log(`✅ Hotel found: ${arienPlaza.name} (ID: ${arienPlaza.id})\n`);

    // 2. Find ALL accommodations for this hotel (across all bookings)
    const accommodations = await prisma.accommodation.findMany({
      where: {
        hotelId: arienPlaza.id
      },
      include: {
        booking: {
          select: {
            id: true,
            bookingNumber: true
          }
        }
      },
      orderBy: {
        id: 'asc'
      }
    });

    console.log(`📋 Found ${accommodations.length} accommodations across all bookings\n`);

    if (accommodations.length === 0) {
      console.log('⚠️  No accommodations found.');
      return;
    }

    // 3. Show all accommodations
    accommodations.forEach((acc, index) => {
      console.log(`${index + 1}. ID: ${acc.id} | Booking: ${acc.booking.bookingNumber} | Dates: ${acc.checkInDate} → ${acc.checkOutDate}`);
      console.log(`   Current: totalCost=${acc.totalCost || 'NULL'}, totalGuests=${acc.totalGuests || 'NULL'}, totalRooms=${acc.totalRooms || 'NULL'}`);
    });

    console.log('\n🔧 Resetting all accommodations...\n');

    // 4. Reset all accommodations
    let updatedCount = 0;
    for (const acc of accommodations) {
      await prisma.accommodation.update({
        where: { id: acc.id },
        data: {
          totalCost: 0,
          totalGuests: 0,
          totalRooms: 0
        }
      });

      console.log(`✅ Reset: ID ${acc.id} (${acc.booking.bookingNumber})`);
      updatedCount++;
    }

    console.log('\n═══════════════════════════════════════════════════');
    console.log(`✅ SUCCESS! Reset ${updatedCount} accommodations`);
    console.log('═══════════════════════════════════════════════════');
    console.log('\n📌 NEXT STEPS:');
    console.log('   1. Refresh browser on each booking');
    console.log('   2. Check that totalCost recalculates from rooming list');
    console.log('   3. Console should show "usedRoomingList: YES ✓"');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixAllArienPlaza();
