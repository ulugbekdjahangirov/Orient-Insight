const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function recreate() {
  try {
    // Get ER-03
    const booking = await prisma.booking.findFirst({
      where: { bookingNumber: 'ER-03' },
      include: { 
        tourists: true,
        accommodations: true 
      }
    });

    if (!booking) {
      console.log('ER-03 not found');
      return;
    }

    // Delete existing accommodations
    console.log('\n🗑️ Deleting ' + booking.accommodations.length + ' old accommodations...\n');
    for (const acc of booking.accommodations) {
      await prisma.accommodation.delete({ where: { id: acc.id } });
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

    console.log('📊 PAX: UZB=' + paxUzb + ', TKM=' + paxTkm + '\n');

    // Get template
    const templates = await prisma.accommodationTemplate.findMany({
      where: { tourTypeCode: 'ER' },
      orderBy: { sortOrder: 'asc' }
    });

    console.log('🏨 Creating ' + templates.length + ' accommodations from template...\n');

    const departureDate = new Date(booking.departureDate);
    let created = 0;

    for (let i = 0; i < templates.length; i++) {
      const template = templates[i];
      const hotelName = (template.hotelName || '').toLowerCase();

      // Skip logic
      const isSecondMalikaKhorazm = hotelName.includes('malika') && i >= 5;
      const isSecondArienPlaza = hotelName.includes('arien') && hotelName.includes('plaza') && i >= 5;

      if (isSecondMalikaKhorazm && paxTkm === 0) {
        console.log('⏭️ Skip: ' + template.hotelName + ' (no TKM)');
        continue;
      }

      if (isSecondArienPlaza && paxUzb === 0) {
        console.log('⏭️ Skip: ' + template.hotelName + ' (no UZB)');
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
      }

      // Create accommodation
      const accommodation = await prisma.accommodation.create({
        data: {
          bookingId: booking.id,
          hotelId: template.hotelId,
          checkInDate: checkInDate,
          checkOutDate: checkOutDate,
          nights: nights
        }
      });

      const checkIn = checkInDate.toISOString().split('T')[0];
      const checkOut = checkOutDate.toISOString().split('T')[0];
      
      console.log('✅ Created: ' + template.hotelName + ' (' + checkIn + ' to ' + checkOut + ', ' + nights + ' nights)');
      created++;
    }

    console.log('\n✅ DONE! Created ' + created + ' accommodations\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

recreate();
