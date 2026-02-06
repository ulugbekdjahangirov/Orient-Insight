const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findExtra() {
  try {
    // Find Malika Khorazm accommodation with dates 24.09-26.09
    const malika = await prisma.accommodation.findMany({
      where: {
        hotel: {
          name: { contains: 'Malika Khorazm' }
        },
        checkInDate: {
          gte: new Date('2025-09-24T00:00:00'),
          lte: new Date('2025-09-24T23:59:59')
        }
      },
      include: {
        booking: {
          select: {
            bookingNumber: true,
            tourists: {
              select: { accommodation: true }
            }
          }
        },
        hotel: {
          select: { name: true, city: { select: { name: true } } }
        }
      }
    });

    console.log('\n🔍 Found Malika Khorazm accommodations starting 24.09:\n');

    malika.forEach(acc => {
      const uzbCount = acc.booking.tourists.filter(t => {
        const placement = (t.accommodation || '').toLowerCase();
        return placement.includes('uzbek') || placement.includes('узбек') || placement === 'uz';
      }).length;

      const tkmCount = acc.booking.tourists.filter(t => {
        const placement = (t.accommodation || '').toLowerCase();
        return placement.includes('turkmen') || placement.includes('туркмен') || placement === 'tm';
      }).length;

      console.log(`${acc.booking.bookingNumber}:`);
      console.log(`  Accommodation ID: ${acc.id}`);
      console.log(`  Hotel: ${acc.hotel.name} (${acc.hotel.city?.name})`);
      console.log(`  Dates: ${acc.checkInDate.toISOString().split('T')[0]} - ${acc.checkOutDate.toISOString().split('T')[0]}`);
      console.log(`  Nights: ${acc.nights}`);
      console.log(`  Tourists: UZB=${uzbCount}, TKM=${tkmCount}`);

      if (uzbCount > 0 && tkmCount === 0) {
        console.log(`  🗑️  ACTION: DELETE (UZB-only group, should not have 2nd Malika)`);
      }

      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findExtra();
