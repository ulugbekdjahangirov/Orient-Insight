const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migrateBookingRoomsToAccommodations() {
  console.log('Starting migration of BookingRoom to Accommodation...');

  try {
    // Get all booking rooms
    const bookingRooms = await prisma.bookingRoom.findMany({
      include: {
        hotel: {
          include: {
            city: true
          }
        },
        roomType: true,
        booking: true
      }
    });

    console.log(`Found ${bookingRooms.length} BookingRoom records`);

    if (bookingRooms.length === 0) {
      console.log('No BookingRoom records to migrate.');
      return;
    }

    // Group by bookingId + hotelId + checkInDate + checkOutDate
    const groups = {};

    for (const br of bookingRooms) {
      const key = `${br.bookingId}-${br.hotelId}-${br.checkInDate.toISOString()}-${br.checkOutDate.toISOString()}`;

      if (!groups[key]) {
        groups[key] = {
          bookingId: br.bookingId,
          hotelId: br.hotelId,
          cityId: br.hotel.cityId,
          checkInDate: br.checkInDate,
          checkOutDate: br.checkOutDate,
          notes: br.notes,
          rooms: []
        };
      }

      groups[key].rooms.push({
        roomTypeId: br.roomTypeId,
        roomsCount: br.quantity,
        guestsPerRoom: br.roomType.maxGuests || 2,
        pricePerNight: br.pricePerNight || br.roomType.pricePerNight || 0
      });
    }

    console.log(`Created ${Object.keys(groups).length} accommodation groups`);

    // Create Accommodation records
    let created = 0;

    for (const key in groups) {
      const group = groups[key];

      // Check if accommodation already exists
      const existing = await prisma.accommodation.findFirst({
        where: {
          bookingId: group.bookingId,
          hotelId: group.hotelId,
          checkInDate: group.checkInDate,
          checkOutDate: group.checkOutDate
        }
      });

      if (existing) {
        console.log(`Accommodation already exists for booking ${group.bookingId}, hotel ${group.hotelId}`);
        continue;
      }

      // Create accommodation with rooms
      const accommodation = await prisma.accommodation.create({
        data: {
          bookingId: group.bookingId,
          hotelId: group.hotelId,
          cityId: group.cityId,
          checkInDate: group.checkInDate,
          checkOutDate: group.checkOutDate,
          notes: group.notes,
          rooms: {
            create: group.rooms
          }
        },
        include: {
          rooms: true
        }
      });

      console.log(`Created Accommodation #${accommodation.id} for booking ${group.bookingId} with ${accommodation.rooms.length} room types`);
      created++;
    }

    console.log(`\nMigration complete! Created ${created} new Accommodation records.`);

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrateBookingRoomsToAccommodations()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
