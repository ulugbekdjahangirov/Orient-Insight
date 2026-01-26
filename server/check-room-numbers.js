const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRoomNumbers() {
  try {
    const tourists = await prisma.tourist.findMany({
      where: { bookingId: 1 },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        roomPreference: true,
        roomNumber: true
      }
    });

    console.log('\n=== Tourists in Booking 1 ===\n');
    tourists.forEach(t => {
      console.log(`ID: ${t.id}, Name: ${t.lastName}, ${t.firstName}, Preference: ${t.roomPreference || 'N/A'}, RoomNumber: ${t.roomNumber || 'NULL'}`);
    });

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
  }
}

checkRoomNumbers();
