const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function importAllBookings() {
  try {
    console.log('📥 Importing bookings to database...');
    console.log('');

    // Read export file
    const data = JSON.parse(fs.readFileSync('all-bookings-export.json', 'utf8'));
    console.log(`Loaded ${data.totalBookings} bookings from export file`);
    console.log(`Exported at: ${data.exportedAt}`);
    console.log('');

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const bookingData of data.bookings) {
      try {
        // Check if booking exists
        const existing = await prisma.booking.findUnique({
          where: { id: bookingData.id },
          include: {
            tourists: true,
            accommodations: true,
            routes: true
          }
        });

        // Prepare booking data (without related data)
        const bookingOnly = {
          bookingNumber: bookingData.bookingNumber,
          tourTypeId: bookingData.tourTypeId,
          departureDate: bookingData.departureDate ? new Date(bookingData.departureDate) : null,
          arrivalDate: bookingData.arrivalDate ? new Date(bookingData.arrivalDate) : null,
          endDate: bookingData.endDate ? new Date(bookingData.endDate) : null,
          pax: bookingData.pax,
          paxUzbekistan: bookingData.paxUzbekistan,
          paxTurkmenistan: bookingData.paxTurkmenistan,
          country: bookingData.country,
          guideId: bookingData.guideId,
          guideFullDays: bookingData.guideFullDays,
          guideHalfDays: bookingData.guideHalfDays,
          mainGuideData: bookingData.mainGuideData,
          additionalGuides: bookingData.additionalGuides,
          bergreiseleiter: bookingData.bergreiseleiter,
          trainTickets: bookingData.trainTickets,
          avia: bookingData.avia,
          roomsDbl: bookingData.roomsDbl,
          roomsTwn: bookingData.roomsTwn,
          roomsSngl: bookingData.roomsSngl,
          roomsTotal: bookingData.roomsTotal,
          dateOlot: bookingData.dateOlot ? new Date(bookingData.dateOlot) : null,
          dateJartepa: bookingData.dateJartepa ? new Date(bookingData.dateJartepa) : null,
          dateOybek: bookingData.dateOybek ? new Date(bookingData.dateOybek) : null,
          dateChernyaevka: bookingData.dateChernyaevka ? new Date(bookingData.dateChernyaevka) : null,
          status: bookingData.status,
          notes: bookingData.notes,
          rechnungFirma: bookingData.rechnungFirma
        };

        if (!existing) {
          // Create new booking
          await prisma.booking.create({
            data: {
              id: bookingData.id,
              ...bookingOnly
            }
          });

          // Create tourists
          for (const tourist of bookingData.tourists) {
            await prisma.tourist.create({
              data: {
                bookingId: bookingData.id,
                fullName: tourist.fullName,
                gender: tourist.gender,
                dateOfBirth: tourist.dateOfBirth ? new Date(tourist.dateOfBirth) : null,
                passportNumber: tourist.passportNumber,
                passportExpiry: tourist.passportExpiry ? new Date(tourist.passportExpiry) : null,
                nationality: tourist.nationality,
                roomPreference: tourist.roomPreference,
                roomNumber: tourist.roomNumber,
                accommodation: tourist.accommodation,
                hotelName: tourist.hotelName,
                checkInDate: tourist.checkInDate ? new Date(tourist.checkInDate) : null,
                checkOutDate: tourist.checkOutDate ? new Date(tourist.checkOutDate) : null
              }
            });
          }

          // Create accommodations
          for (const acc of bookingData.accommodations) {
            await prisma.accommodation.create({
              data: {
                bookingId: bookingData.id,
                hotelId: acc.hotelId,
                checkInDate: acc.checkInDate ? new Date(acc.checkInDate) : null,
                checkOutDate: acc.checkOutDate ? new Date(acc.checkOutDate) : null,
                totalCost: acc.totalCost,
                rooms: acc.rooms
              }
            });
          }

          // Create routes
          for (const route of bookingData.routes) {
            await prisma.route.create({
              data: {
                bookingId: bookingData.id,
                dayNumber: route.dayNumber,
                date: route.date ? new Date(route.date) : null,
                city: route.city,
                itinerary: route.itinerary,
                routeName: route.routeName,
                personCount: route.personCount,
                transportType: route.transportType,
                provider: route.provider,
                optionRate: route.optionRate,
                price: route.price
              }
            });
          }

          console.log(`✓ Created: ${bookingData.bookingNumber} (${bookingData.tourists.length} tourists, ${bookingData.routes.length} routes)`);
          created++;
        } else {
          // Check if data is different
          const hasChanges =
            JSON.stringify(bookingOnly) !== JSON.stringify({
              bookingNumber: existing.bookingNumber,
              tourTypeId: existing.tourTypeId,
              departureDate: existing.departureDate,
              arrivalDate: existing.arrivalDate,
              endDate: existing.endDate,
              pax: existing.pax,
              paxUzbekistan: existing.paxUzbekistan,
              paxTurkmenistan: existing.paxTurkmenistan,
              country: existing.country,
              guideId: existing.guideId,
              guideFullDays: existing.guideFullDays,
              guideHalfDays: existing.guideHalfDays,
              mainGuideData: existing.mainGuideData,
              additionalGuides: existing.additionalGuides,
              bergreiseleiter: existing.bergreiseleiter,
              trainTickets: existing.trainTickets,
              avia: existing.avia,
              roomsDbl: existing.roomsDbl,
              roomsTwn: existing.roomsTwn,
              roomsSngl: existing.roomsSngl,
              roomsTotal: existing.roomsTotal,
              dateOlot: existing.dateOlot,
              dateJartepa: existing.dateJartepa,
              dateOybek: existing.dateOybek,
              dateChernyaevka: existing.dateChernyaevka,
              status: existing.status,
              notes: existing.notes,
              rechnungFirma: existing.rechnungFirma
            });

          if (hasChanges ||
              existing.tourists.length !== bookingData.tourists.length ||
              existing.routes.length !== bookingData.routes.length) {

            // Update booking
            await prisma.booking.update({
              where: { id: bookingData.id },
              data: bookingOnly
            });

            // Delete and recreate tourists
            await prisma.tourist.deleteMany({ where: { bookingId: bookingData.id } });
            for (const tourist of bookingData.tourists) {
              await prisma.tourist.create({
                data: {
                  bookingId: bookingData.id,
                  fullName: tourist.fullName,
                  gender: tourist.gender,
                  dateOfBirth: tourist.dateOfBirth ? new Date(tourist.dateOfBirth) : null,
                  passportNumber: tourist.passportNumber,
                  passportExpiry: tourist.passportExpiry ? new Date(tourist.passportExpiry) : null,
                  nationality: tourist.nationality,
                  roomPreference: tourist.roomPreference,
                  roomNumber: tourist.roomNumber,
                  accommodation: tourist.accommodation,
                  hotelName: tourist.hotelName,
                  checkInDate: tourist.checkInDate ? new Date(tourist.checkInDate) : null,
                  checkOutDate: tourist.checkOutDate ? new Date(tourist.checkOutDate) : null
                }
              });
            }

            // Delete and recreate routes
            await prisma.route.deleteMany({ where: { bookingId: bookingData.id } });
            for (const route of bookingData.routes) {
              await prisma.route.create({
                data: {
                  bookingId: bookingData.id,
                  dayNumber: route.dayNumber,
                  date: route.date ? new Date(route.date) : null,
                  city: route.city,
                  itinerary: route.itinerary,
                  routeName: route.routeName,
                  personCount: route.personCount,
                  transportType: route.transportType,
                  provider: route.provider,
                  optionRate: route.optionRate,
                  price: route.price
                }
              });
            }

            console.log(`↻ Updated: ${bookingData.bookingNumber} (${bookingData.tourists.length} tourists, ${bookingData.routes.length} routes)`);
            updated++;
          } else {
            console.log(`⊘ Skipped: ${bookingData.bookingNumber} (no changes)`);
            skipped++;
          }
        }
      } catch (error) {
        console.error(`✗ Error processing ${bookingData.bookingNumber}:`, error.message);
        errors++;
      }
    }

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Import complete!');
    console.log(`   Created: ${created}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Errors: ${errors}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

importAllBookings();
