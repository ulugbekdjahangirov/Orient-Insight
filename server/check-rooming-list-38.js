const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRoomingList() {
  try {
    // Check RoomingListEntry table
    const entries = await prisma.roomingListEntry.findMany({
      where: { bookingId: 38 },
      include: {
        tourist: {
          select: {
            fullName: true,
            checkInDate: true,
            checkOutDate: true
          }
        }
      }
    });

    console.log('\n📋 ROOMING LIST ENTRIES (Booking 38):');
    console.log('=====================================');
    if (entries.length > 0) {
      entries.forEach(entry => {
        console.log(`${entry.tourist?.fullName || 'Unknown'}:`);
        console.log(`  Entry arrivalDate: ${entry.arrivalDate ? new Date(entry.arrivalDate).toISOString().split('T')[0] : 'null'}`);
        console.log(`  Entry departureDate: ${entry.departureDate ? new Date(entry.departureDate).toISOString().split('T')[0] : 'null'}`);
        console.log(`  Tourist checkInDate: ${entry.tourist ? new Date(entry.tourist.checkInDate).toISOString().split('T')[0] : 'null'}`);
        console.log('');
      });
    } else {
      console.log('(no rooming list entries)');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRoomingList();
