const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAccommodations() {
  try {
    // Get all ER bookings
    const bookings = await prisma.booking.findMany({
      where: {
        tourType: { code: 'ER' }
      },
      select: {
        id: true,
        bookingNumber: true,
        tourists: {
          select: {
            accommodation: true
          }
        },
        accommodations: {
          select: {
            id: true,
            hotel: {
              select: {
                name: true,
                city: { select: { name: true } }
              }
            },
            checkInDate: true,
            checkOutDate: true,
            nights: true
          },
          orderBy: { checkInDate: 'asc' }
        }
      },
      orderBy: { bookingNumber: 'asc' }
    });

    console.log('\n🏨 ACCOMMODATION ANALYSIS\n');

    bookings.forEach(booking => {
      // Count UZB and TKM tourists
      const uzbCount = booking.tourists.filter(t => {
        const placement = (t.accommodation || '').toLowerCase();
        return placement.includes('uzbek') || placement.includes('узбек') || placement === 'uz';
      }).length;

      const tkmCount = booking.tourists.filter(t => {
        const placement = (t.accommodation || '').toLowerCase();
        return placement.includes('turkmen') || placement.includes('туркмен') || placement === 'tm';
      }).length;

      console.log(`${booking.bookingNumber}: UZB=${uzbCount}, TKM=${tkmCount}, Total=${booking.tourists.length}`);
      console.log('  Accommodations:');
      booking.accommodations.forEach((acc, i) => {
        const hotel = acc.hotel.name;
        const city = acc.hotel.city?.name || 'N/A';
        const dates = `${acc.checkInDate.toISOString().split('T')[0]} - ${acc.checkOutDate.toISOString().split('T')[0]}`;
        console.log(`    ${i+1}. ${hotel} (${city}) - ${dates} - ${acc.nights} nights`);
      });
      console.log('');
    });

    // Find bookings with "only Uzbekistan" tourists
    const onlyUzb = bookings.filter(b => {
      const uzbCount = b.tourists.filter(t => {
        const placement = (t.accommodation || '').toLowerCase();
        return placement.includes('uzbek') || placement.includes('узбек') || placement === 'uz';
      }).length;
      const tkmCount = b.tourists.filter(t => {
        const placement = (t.accommodation || '').toLowerCase();
        return placement.includes('turkmen') || placement.includes('туркмен') || placement === 'tm';
      }).length;
      return uzbCount > 0 && tkmCount === 0;
    });

    console.log(`\n📌 Bookings with ONLY Uzbekistan tourists: ${onlyUzb.length}`);
    onlyUzb.forEach(b => console.log(`  - ${b.bookingNumber}`));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAccommodations();
