const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRoomAssignments() {
  try {
    // Check TouristRoomAssignment
    const assignments = await prisma.touristRoomAssignment.findMany({
      where: {
        tourist: {
          bookingId: 38
        }
      },
      include: {
        tourist: {
          select: {
            fullName: true,
            checkInDate: true,
            checkOutDate: true
          }
        },
        bookingRoom: {
          select: {
            checkInDate: true,
            checkOutDate: true,
            hotel: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });

    console.log('\n🏨 TOURIST ROOM ASSIGNMENTS (Booking 38):');
    console.log('=====================================');
    if (assignments.length > 0) {
      assignments.forEach(a => {
        console.log(`${a.tourist.fullName}:`);
        console.log(`  Tourist check-in: ${new Date(a.tourist.checkInDate).toISOString().split('T')[0]}`);
        console.log(`  Room check-in: ${new Date(a.bookingRoom.checkInDate).toISOString().split('T')[0]}`);
        console.log(`  Room check-out: ${new Date(a.bookingRoom.checkOutDate).toISOString().split('T')[0]}`);
        console.log(`  Hotel: ${a.bookingRoom.hotel.name}`);
        console.log('');
      });
    } else {
      console.log('(no room assignments)');
    }

    // Check BookingRoom
    const bookingRooms = await prisma.bookingRoom.findMany({
      where: { bookingId: 38 },
      include: {
        hotel: {
          select: {
            name: true
          }
        }
      }
    });

    console.log('\n🏨 BOOKING ROOMS (Booking 38):');
    console.log('=====================================');
    if (bookingRooms.length > 0) {
      bookingRooms.forEach(br => {
        console.log(`${br.hotel.name}:`);
        console.log(`  Check-in: ${new Date(br.checkInDate).toISOString().split('T')[0]}`);
        console.log(`  Check-out: ${new Date(br.checkOutDate).toISOString().split('T')[0]}`);
        console.log('');
      });
    } else {
      console.log('(no booking rooms)');
    }

    // Check Accommodation (new structure)
    const accommodations = await prisma.accommodation.findMany({
      where: { bookingId: 38 },
      include: {
        hotel: {
          select: {
            name: true
          }
        }
      }
    });

    console.log('\n🏨 ACCOMMODATIONS (new structure):');
    console.log('=====================================');
    if (accommodations.length > 0) {
      accommodations.forEach(acc => {
        console.log(`${acc.hotel.name}:`);
        console.log(`  Check-in: ${new Date(acc.checkInDate).toISOString().split('T')[0]}`);
        console.log(`  Check-out: ${new Date(acc.checkOutDate).toISOString().split('T')[0]}`);
        console.log('');
      });
    } else {
      console.log('(no accommodations)');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRoomAssignments();
