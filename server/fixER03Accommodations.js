const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixER03() {
  try {
    console.log('\n🔧 Fixing ER-03 accommodations...\n');

    // Get ER-03
    const booking = await prisma.booking.findFirst({
      where: { bookingNumber: 'ER-03' },
      include: {
        accommodations: {
          include: {
            hotel: { include: { city: true } }
          },
          orderBy: { checkInDate: 'asc' }
        }
      }
    });

    if (!booking) {
      console.log('❌ ER-03 not found');
      return;
    }

    console.log(`📋 Current accommodations (${booking.accommodations.length}):\n`);
    booking.accommodations.forEach((acc, i) => {
      const dates = `${acc.checkInDate.toISOString().split('T')[0]} - ${acc.checkOutDate.toISOString().split('T')[0]}`;
      console.log(`  ${i+1}. ${acc.hotel.name} (${acc.hotel.city?.name}) - ${dates}`);
    });

    // Find the duplicate Malika Khorazm (should be the 7th accommodation)
    const duplicateMalika = booking.accommodations.find((acc, index) => {
      const hotelName = acc.hotel.name.toLowerCase();
      return hotelName.includes('malika') && index >= 6;
    });

    if (duplicateMalika) {
      console.log(`\n❌ Found duplicate Malika Khorazm (ID: ${duplicateMalika.id})`);
      console.log(`   Deleting...`);

      await prisma.accommodation.delete({
        where: { id: duplicateMalika.id }
      });

      console.log(`   ✅ Deleted!`);
    } else {
      console.log('\n✅ No duplicate Malika Khorazm found');
    }

    console.log('\n✅ Done!\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixER03();
