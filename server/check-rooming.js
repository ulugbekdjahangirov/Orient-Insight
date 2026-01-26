const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRoomingList() {
  try {
    // Check all accommodations
    const accs = await prisma.accommodation.findMany({
      where: { bookingId: 1 },
      include: {
        hotel: { include: { city: true } },
        rooms: true
      },
      orderBy: { checkInDate: 'asc' }
    });

    console.log('All accommodations:');
    accs.forEach(a => {
      console.log(`  ${a.id}: ${a.hotel.name} (${a.hotel.city.name})`);
      console.log(`      ${a.checkInDate?.toISOString().split('T')[0]} - ${a.checkOutDate?.toISOString().split('T')[0]}`);
      console.log(`      Rooms: ${a.rooms?.length || 0}, Total: ${a.totalCost} ${a.currency || ''}`);
    });

    // Check all tourists
    const tourists = await prisma.tourist.findMany({
      where: { bookingId: 1 },
      orderBy: { lastName: 'asc' }
    });

    console.log(`\nAll tourists (${tourists.length}):`);
    tourists.forEach(t => {
      console.log(`  ${t.id}: ${t.fullName || t.lastName}`);
      console.log(`      Hotel: ${t.hotelName || 'N/A'}`);
      console.log(`      Dates: ${t.checkInDate?.toISOString().split('T')[0] || 'N/A'} - ${t.checkOutDate?.toISOString().split('T')[0] || 'N/A'}`);
      console.log(`      Room: ${t.roomPreference || 'N/A'}, Placement: ${t.accommodation || 'N/A'}`);
    });

    // Check accommodation 666 rooming list entries
    const entries = await prisma.accommodationRoomingList.findMany({
      where: { accommodationId: 666 },
      include: { tourist: true }
    });

    console.log(`\nAccommodation 666 Rooming List entries: ${entries.length}`);
    if (entries.length > 0) {
      entries.forEach((entry, i) => {
        console.log(`\nEntry ${i + 1}:`);
        console.log('  Tourist:', entry.tourist.fullName || entry.tourist.lastName);
        console.log('  Entry dates:', entry.checkInDate, '-', entry.checkOutDate);
        console.log('  Room:', entry.roomPreference);
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkRoomingList();
