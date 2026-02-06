const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAccommodations() {
  try {
    const booking = await prisma.booking.findFirst({
      where: { bookingNumber: 'ER-01' },
      include: {
        accommodations: {
          include: {
            hotel: {
              include: { city: true }
            }
          },
          orderBy: { checkInDate: 'asc' }
        },
        tourists: {
          select: {
            fullName: true,
            accommodation: true
          }
        }
      }
    });

    if (!booking) {
      console.log('ER-01 topilmadi');
      return;
    }

    console.log('\n' + booking.bookingNumber + ' - Mehmonxonalar:\n');
    
    const uzbCount = booking.tourists.filter(t => {
      const placement = (t.accommodation || '').toLowerCase();
      return placement.includes('uzbek') || placement.includes('узбек') || placement === 'uz';
    }).length;
    
    const tkmCount = booking.tourists.filter(t => {
      const placement = (t.accommodation || '').toLowerCase();
      return placement.includes('turkmen') || placement.includes('туркмен') || placement === 'tm';
    }).length;

    console.log('Turistlar: UZB=' + uzbCount + ', TKM=' + tkmCount + '\n');

    booking.accommodations.forEach((acc, index) => {
      console.log((index + 1) + '. ' + acc.hotel.name + ' (' + (acc.hotel.city?.name || 'N/A') + ')');
      console.log('   ID: ' + acc.id);
      console.log('   Dates: ' + acc.checkInDate.toISOString().split('T')[0] + ' - ' + acc.checkOutDate.toISOString().split('T')[0]);
      console.log('   Nights: ' + acc.nights);
      console.log('');
    });

    console.log('Jami: ' + booking.accommodations.length + ' ta mehmonxona\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAccommodations();
