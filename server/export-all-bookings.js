const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function exportAllBookings() {
  try {
    console.log('📤 Exporting all bookings from localhost...');
    console.log('');

    // Get all bookings with full related data
    const bookings = await prisma.booking.findMany({
      include: {
        tourType: true,
        tourists: true,
        accommodations: {
          include: {
            hotel: true,
            rooms: true
          }
        },
        routes: true,
        flights: true,
        railways: true
      },
      orderBy: { id: 'asc' }
    });

    console.log(`Found ${bookings.length} bookings to export`);
    console.log('');

    // Export to JSON
    const exportData = {
      exportedAt: new Date().toISOString(),
      totalBookings: bookings.length,
      bookings: bookings.map(b => ({
        // Booking data
        id: b.id,
        bookingNumber: b.bookingNumber,
        tourTypeId: b.tourTypeId,
        tourTypeCode: b.tourType?.code,
        departureDate: b.departureDate,
        arrivalDate: b.arrivalDate,
        endDate: b.endDate,
        pax: b.pax,
        paxUzbekistan: b.paxUzbekistan,
        paxTurkmenistan: b.paxTurkmenistan,
        country: b.country,
        guideId: b.guideId,
        guideFullDays: b.guideFullDays,
        guideHalfDays: b.guideHalfDays,
        mainGuideData: b.mainGuideData,
        additionalGuides: b.additionalGuides,
        bergreiseleiter: b.bergreiseleiter,
        trainTickets: b.trainTickets,
        avia: b.avia,
        roomsDbl: b.roomsDbl,
        roomsTwn: b.roomsTwn,
        roomsSngl: b.roomsSngl,
        roomsTotal: b.roomsTotal,
        dateOlot: b.dateOlot,
        dateJartepa: b.dateJartepa,
        dateOybek: b.dateOybek,
        dateChernyaevka: b.dateChernyaevka,
        status: b.status,
        notes: b.notes,
        rechnungFirma: b.rechnungFirma,

        // Related data
        tourists: b.tourists.map(t => ({
          fullName: t.fullName,
          gender: t.gender,
          dateOfBirth: t.dateOfBirth,
          passportNumber: t.passportNumber,
          passportExpiry: t.passportExpiry,
          nationality: t.nationality,
          roomPreference: t.roomPreference,
          roomNumber: t.roomNumber,
          accommodation: t.accommodation,
          hotelName: t.hotelName,
          checkInDate: t.checkInDate,
          checkOutDate: t.checkOutDate
        })),

        accommodations: b.accommodations.map(a => ({
          hotelId: a.hotelId,
          hotelName: a.hotel?.name,
          checkInDate: a.checkInDate,
          checkOutDate: a.checkOutDate,
          totalCost: a.totalCost,
          rooms: a.rooms
        })),

        routes: b.routes.map(r => ({
          dayNumber: r.dayNumber,
          date: r.date,
          city: r.city,
          itinerary: r.itinerary,
          routeName: r.routeName,
          personCount: r.personCount,
          transportType: r.transportType,
          provider: r.provider,
          optionRate: r.optionRate,
          price: r.price
        })),

        flights: b.flights.map(f => ({
          flightNumber: f.flightNumber,
          airline: f.airline,
          from: f.from,
          to: f.to,
          date: f.date,
          time: f.time,
          pax: f.pax
        })),

        railways: b.railways.map(r => ({
          trainNumber: r.trainNumber,
          from: r.from,
          to: r.to,
          date: r.date,
          time: r.time,
          pax: r.pax
        }))
      }))
    };

    fs.writeFileSync('all-bookings-export.json', JSON.stringify(exportData, null, 2));

    console.log('✅ Export complete!');
    console.log(`📦 Exported ${exportData.totalBookings} bookings`);
    console.log(`📝 File: all-bookings-export.json (${(fs.statSync('all-bookings-export.json').size / 1024 / 1024).toFixed(2)} MB)`);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

exportAllBookings();
