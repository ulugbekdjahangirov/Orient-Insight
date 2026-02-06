const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteExtra() {
  try {
    console.log('\n🗑️  Deleting extra accommodations for UZB-only bookings...\n');

    // Find bookings with only UZB tourists
    const bookings = await prisma.booking.findMany({
      where: {
        tourType: { code: 'ER' }
      },
      include: {
        tourists: true,
        accommodations: {
          include: {
            hotel: {
              include: { city: true }
            }
          },
          orderBy: { checkInDate: 'asc' }
        }
      }
    });

    let deletedCount = 0;

    for (const booking of bookings) {
      // Count UZB and TKM
      const uzbCount = booking.tourists.filter(t => {
        const placement = (t.accommodation || '').toLowerCase();
        return placement.includes('uzbek') || placement.includes('узбек') || placement === 'uz';
      }).length;

      const tkmCount = booking.tourists.filter(t => {
        const placement = (t.accommodation || '').toLowerCase();
        return placement.includes('turkmen') || placement.includes('туркмен') || placement === 'tm';
      }).length;

      // If only UZB tourists (no TKM)
      if (uzbCount > 0 && tkmCount === 0) {
        console.log(`${booking.bookingNumber}: UZB=${uzbCount}, TKM=0`);

        // Find 2nd Malika Khorazm (index > 4)
        const malikaAccommodations = booking.accommodations.filter((acc, idx) => {
          const hotelName = acc.hotel.name.toLowerCase();
          return hotelName.includes('malika') && hotelName.includes('khorazm') && idx > 4;
        });

        if (malikaAccommodations.length > 0) {
          for (const acc of malikaAccommodations) {
            console.log(`  🗑️  Deleting: ${acc.hotel.name} (${acc.checkInDate.toISOString().split('T')[0]} - ${acc.checkOutDate.toISOString().split('T')[0]})`);
            await prisma.accommodation.delete({ where: { id: acc.id } });
            deletedCount++;
          }
        }
      }

      // If only TKM tourists (no UZB)
      if (tkmCount > 0 && uzbCount === 0) {
        console.log(`${booking.bookingNumber}: UZB=0, TKM=${tkmCount}`);

        // Find 2nd Arien Plaza (index > 4)
        const arienAccommodations = booking.accommodations.filter((acc, idx) => {
          const hotelName = acc.hotel.name.toLowerCase();
          return hotelName.includes('arien') && hotelName.includes('plaza') && idx > 4;
        });

        if (arienAccommodations.length > 0) {
          for (const acc of arienAccommodations) {
            console.log(`  🗑️  Deleting: ${acc.hotel.name} (${acc.checkInDate.toISOString().split('T')[0]} - ${acc.checkOutDate.toISOString().split('T')[0]})`);
            await prisma.accommodation.delete({ where: { id: acc.id } });
            deletedCount++;
          }
        }
      }
    }

    console.log(`\n✅ DONE! Deleted ${deletedCount} extra accommodations\n`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteExtra();
