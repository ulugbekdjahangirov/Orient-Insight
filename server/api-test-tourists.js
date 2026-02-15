const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testAPI() {
  try {
    // Simulate what the API returns
    const tourists = await prisma.tourist.findMany({
      where: { bookingId: 38 },
      include: {
        roomAssignments: {
          include: {
            bookingRoom: {
              include: {
                hotel: { include: { city: true } },
                roomType: true
              }
            }
          }
        },
        accommodationRoomingList: {
          include: {
            accommodation: true
          }
        }
      }
    });

    console.log('\n📋 API RESPONSE SIMULATION:');
    console.log('=====================================');
    console.log(JSON.stringify({ tourists }, null, 2));

    console.log('\n📅 TOURIST DATES:');
    console.log('=====================================');
    tourists.forEach(t => {
      console.log(`${t.fullName}:`);
      console.log(`  checkInDate: ${t.checkInDate}`);
      console.log(`  checkOutDate: ${t.checkOutDate}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAPI();
