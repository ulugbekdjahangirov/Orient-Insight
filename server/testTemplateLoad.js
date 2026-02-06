const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testLoad() {
  try {
    // Get ER-03 booking
    const booking = await prisma.booking.findFirst({
      where: { bookingNumber: 'ER-03' },
      include: { tourists: true }
    });

    if (!booking) {
      console.log('ER-03 not found');
      return;
    }

    // Calculate PAX split
    const paxUzb = booking.tourists.filter(t => {
      const placement = (t.accommodation || '').toLowerCase();
      return placement.includes('uzbek') || placement.includes('узбек') || placement === 'uz' || !placement.includes('turkmen');
    }).length;

    const paxTkm = booking.tourists.filter(t => {
      const placement = (t.accommodation || '').toLowerCase();
      return placement.includes('turkmen') || placement.includes('туркмен') || placement === 'tm';
    }).length;

    console.log('\n📊 ER-03 PAX Split:');
    console.log('   UZB: ' + paxUzb);
    console.log('   TKM: ' + paxTkm);

    // Get template
    const templates = await prisma.accommodationTemplate.findMany({
      where: { tourTypeCode: 'ER' },
      orderBy: { sortOrder: 'asc' }
    });

    console.log('\n📋 Template has ' + templates.length + ' hotels:\n');

    const departureDate = new Date(booking.departureDate);

    for (let i = 0; i < templates.length; i++) {
      const template = templates[i];
      const hotelName = (template.hotelName || '').toLowerCase();

      // Check skip conditions
      const isSecondMalikaKhorazm = hotelName.includes('malika') && i >= 5;
      const isSecondArienPlaza = hotelName.includes('arien') && hotelName.includes('plaza') && i >= 5;

      if (isSecondMalikaKhorazm && paxTkm === 0) {
        console.log((i+1) + '. ' + template.hotelName + ' - SKIP (no TKM)');
        continue;
      }

      if (isSecondArienPlaza && paxUzb === 0) {
        console.log((i+1) + '. ' + template.hotelName + ' - SKIP (no UZB)');
        continue;
      }

      // Calculate dates
      const checkInDate = new Date(departureDate);
      checkInDate.setDate(checkInDate.getDate() + template.checkInOffset);

      const checkOutDate = new Date(departureDate);
      checkOutDate.setDate(checkOutDate.getDate() + template.checkOutOffset);

      // Adjust Malika for UZB-only
      const isMalikaKhorazm = hotelName.includes('malika') && (hotelName.includes('khorazm') || hotelName.includes('хорезм'));
      let nights = template.nights;
      if (isMalikaKhorazm && paxTkm === 0 && paxUzb > 0) {
        checkOutDate.setDate(checkOutDate.getDate() - 1);
        nights = 2;
        console.log((i+1) + '. ' + template.hotelName + ' - ADJUSTED for UZB-only');
      }

      const checkIn = checkInDate.toISOString().split('T')[0];
      const checkOut = checkOutDate.toISOString().split('T')[0];

      console.log((i+1) + '. ' + template.hotelName + ': ' + checkIn + ' to ' + checkOut + ' (' + nights + ' nights)');
    }

    console.log('');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testLoad();
