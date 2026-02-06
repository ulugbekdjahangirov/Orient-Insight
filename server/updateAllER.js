const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateAllERRoutes() {
  try {
    // Get all ER bookings
    const erBookings = await prisma.booking.findMany({
      where: {
        tourType: {
          code: 'ER'
        }
      },
      include: {
        tourType: true,
        tourists: true
      },
      orderBy: {
        bookingNumber: 'asc'
      }
    });

    console.log(`Found ${erBookings.length} ER bookings\n`);

    // Get ER template
    const templates = await prisma.routeTemplate.findMany({
      where: { tourTypeCode: 'ER' },
      orderBy: { sortOrder: 'asc' }
    });

    console.log(`Using template with ${templates.length} routes\n`);

    if (templates.length === 0) {
      console.log('ERROR: No ER template found!');
      return;
    }

    // Update each booking
    for (const booking of erBookings) {
      console.log(`\nProcessing ${booking.bookingNumber}...`);

      if (!booking.departureDate) {
        console.log(`   Skipped - no departure date`);
        continue;
      }

      // Calculate dates
      const departureDate = new Date(booking.departureDate);
      const arrivalDate = new Date(departureDate);
      arrivalDate.setDate(arrivalDate.getDate() + 1); // Arrival = Departure + 1

      // Get total PAX and calculate UZB/TKM split
      const totalPax = booking.tourists.length || 0;
      const paxUzb = booking.tourists.filter(t => !(t.accommodation || '').toLowerCase().includes('turkmen')).length;
      const paxTkm = booking.tourists.filter(t => (t.accommodation || '').toLowerCase().includes('turkmen')).length;

      console.log(`   PAX: Total=${totalPax}, UZB=${paxUzb}, TKM=${paxTkm}`);

      // Delete old routes
      const deletedCount = await prisma.route.deleteMany({
        where: { bookingId: booking.id }
      });
      console.log(`   Deleted ${deletedCount.count} old routes`);

      // Create new routes from template
      for (const template of templates) {
        const routeDate = new Date(arrivalDate);
        routeDate.setDate(routeDate.getDate() + template.dayOffset);

        // Determine PAX for this route based on split logic
        let routePax = totalPax;

        if (template.routeName === 'Khiva - Urgench') {
          routePax = paxTkm;  // Turkmenistan group stays in Khiva
        } else if (template.routeName === 'Mahalliy Aeroport-Hotel' && template.city === 'Tashkent') {
          routePax = paxUzb;  // Uzbekistan group goes to Tashkent
        } else if (template.routeName === 'Hotel- Mahalliy Aeroport' && template.city === 'Tashkent') {
          routePax = paxUzb;  // Uzbekistan group departure
        } else if (template.routeName === 'Khiva - Shovot') {
          routePax = paxTkm;  // Turkmenistan group
        }

        await prisma.route.create({
          data: {
            bookingId: booking.id,
            dayNumber: template.dayNumber,
            date: routeDate,
            city: template.city,
            routeName: template.routeName,
            personCount: routePax,
            provider: template.provider,
            optionRate: template.optionRate,
            transportType: null,  // Will be filled by Fix Vehicles button
            price: 0
          }
        });
      }

      console.log(`   Created ${templates.length} routes (PAX=${totalPax})`);
    }

    console.log(`\n=== All ER bookings updated successfully! ===`);

  } catch (error) {
    console.error('ERROR:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateAllERRoutes();
