const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('📦 Adding sample bookings with participants...\n');

  // Get existing data
  const tourTypes = await prisma.tourType.findMany();
  const guides = await prisma.guide.findMany();
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const hotels = await prisma.hotel.findMany({
    include: { roomTypes: true, city: true }
  });

  if (!tourTypes.length || !guides.length || !admin) {
    console.log('❌ Please run npm run db:seed first to create base data');
    return;
  }

  // Sample German names for participants
  const germanNames = [
    { firstName: 'Hans', lastName: 'Mueller', gender: 'M' },
    { firstName: 'Petra', lastName: 'Schmidt', gender: 'F' },
    { firstName: 'Klaus', lastName: 'Weber', gender: 'M' },
    { firstName: 'Ingrid', lastName: 'Fischer', gender: 'F' },
    { firstName: 'Wolfgang', lastName: 'Wagner', gender: 'M' },
    { firstName: 'Helga', lastName: 'Becker', gender: 'F' },
    { firstName: 'Dieter', lastName: 'Hoffmann', gender: 'M' },
    { firstName: 'Ursula', lastName: 'Schulz', gender: 'F' },
    { firstName: 'Gerhard', lastName: 'Koch', gender: 'M' },
    { firstName: 'Monika', lastName: 'Bauer', gender: 'F' },
    { firstName: 'Heinrich', lastName: 'Richter', gender: 'M' },
    { firstName: 'Renate', lastName: 'Klein', gender: 'F' },
    { firstName: 'Werner', lastName: 'Wolf', gender: 'M' },
    { firstName: 'Brigitte', lastName: 'Schroeder', gender: 'F' },
    { firstName: 'Helmut', lastName: 'Neumann', gender: 'M' },
    { firstName: 'Gisela', lastName: 'Schwarz', gender: 'F' },
    { firstName: 'Friedrich', lastName: 'Zimmermann', gender: 'M' },
    { firstName: 'Elisabeth', lastName: 'Braun', gender: 'F' },
    { firstName: 'Karl', lastName: 'Krause', gender: 'M' },
    { firstName: 'Margarete', lastName: 'Hartmann', gender: 'F' },
    { firstName: 'Otto', lastName: 'Lange', gender: 'M' },
    { firstName: 'Elfriede', lastName: 'Werner', gender: 'F' },
    { firstName: 'Manfred', lastName: 'Schmitt', gender: 'M' },
    { firstName: 'Christa', lastName: 'Meier', gender: 'F' },
  ];

  // Find tour types by code
  const erTour = tourTypes.find(t => t.code === 'ER');
  const coTour = tourTypes.find(t => t.code === 'CO');
  const kasTour = tourTypes.find(t => t.code === 'KAS');
  const zaTour = tourTypes.find(t => t.code === 'ZA');

  // Sample bookings data
  const bookingsData = [
    {
      bookingNumber: 'ER-001',
      tourType: erTour,
      departureDate: new Date('2025-02-15'),
      arrivalDate: new Date('2025-02-15'),
      endDate: new Date('2025-02-26'),
      pax: 16,
      paxUzbekistan: 12,
      paxTurkmenistan: 16,
      country: 'Germany',
      guide: guides[0],
      status: 'CONFIRMED',
      trainTickets: 'Samarkand-Bukhara 18.02, Bukhara-Urgench 20.02',
      notes: 'VIP group from Berlin',
      participantCount: 16
    },
    {
      bookingNumber: 'CO-002',
      tourType: coTour,
      departureDate: new Date('2025-02-20'),
      arrivalDate: new Date('2025-02-20'),
      endDate: new Date('2025-02-28'),
      pax: 12,
      country: 'Germany',
      guide: guides[1],
      status: 'CONFIRMED',
      trainTickets: 'Tashkent-Samarkand 21.02',
      notes: 'Classic Uzbekistan tour',
      participantCount: 12
    },
    {
      bookingNumber: 'ER-003',
      tourType: erTour,
      departureDate: new Date('2025-03-01'),
      arrivalDate: new Date('2025-03-01'),
      endDate: new Date('2025-03-12'),
      pax: 20,
      paxUzbekistan: 16,
      paxTurkmenistan: 20,
      country: 'Germany',
      guide: guides[2],
      status: 'PENDING',
      trainTickets: 'TBD',
      notes: 'Large group - needs 2 buses',
      participantCount: 20
    },
    {
      bookingNumber: 'KAS-001',
      tourType: kasTour,
      departureDate: new Date('2025-03-10'),
      arrivalDate: new Date('2025-03-10'),
      endDate: new Date('2025-03-17'),
      pax: 8,
      country: 'Austria',
      guide: guides[3],
      status: 'CONFIRMED',
      notes: 'Small group tour to Kashkadarya',
      participantCount: 8
    },
    {
      bookingNumber: 'CO-003',
      tourType: coTour,
      departureDate: new Date('2025-03-15'),
      arrivalDate: new Date('2025-03-15'),
      endDate: new Date('2025-03-23'),
      pax: 14,
      country: 'Switzerland',
      guide: guides[0],
      status: 'PENDING',
      trainTickets: 'Pending confirmation',
      participantCount: 14
    },
    {
      bookingNumber: 'ZA-001',
      tourType: zaTour,
      departureDate: new Date('2025-04-01'),
      arrivalDate: new Date('2025-04-01'),
      endDate: new Date('2025-04-08'),
      pax: 10,
      country: 'Germany',
      guide: guides[1],
      status: 'PENDING',
      notes: 'Mountain tour to Zaamin',
      participantCount: 10
    },
    {
      bookingNumber: 'ER-004',
      tourType: erTour,
      departureDate: new Date('2025-01-10'),
      arrivalDate: new Date('2025-01-10'),
      endDate: new Date('2025-01-21'),
      pax: 18,
      paxUzbekistan: 14,
      paxTurkmenistan: 18,
      country: 'Germany',
      guide: guides[2],
      status: 'COMPLETED',
      trainTickets: 'Completed',
      notes: 'Tour completed successfully',
      participantCount: 18
    },
    {
      bookingNumber: 'CO-001',
      tourType: coTour,
      departureDate: new Date('2025-01-20'),
      arrivalDate: new Date('2025-01-20'),
      endDate: new Date('2025-01-28'),
      pax: 10,
      country: 'France',
      guide: guides[3],
      status: 'COMPLETED',
      notes: 'French group - completed',
      participantCount: 10
    }
  ];

  let nameIndex = 0;

  for (const bookingData of bookingsData) {
    const { participantCount, tourType, guide, ...booking } = bookingData;

    // Check if booking already exists
    const existing = await prisma.booking.findUnique({
      where: { bookingNumber: booking.bookingNumber }
    });

    if (existing) {
      console.log(`⏭️  Booking ${booking.bookingNumber} already exists, skipping...`);
      continue;
    }

    // Create booking
    const createdBooking = await prisma.booking.create({
      data: {
        ...booking,
        tourTypeId: tourType.id,
        guideId: guide.id,
        createdById: admin.id,
        roomsDbl: Math.floor(participantCount / 2),
        roomsSngl: participantCount % 2,
        roomsTotal: Math.floor(participantCount / 2) + (participantCount % 2)
      }
    });

    console.log(`✅ Created booking: ${booking.bookingNumber} (${tourType.code}, ${participantCount} pax)`);

    // Create participants for this booking
    const participants = [];
    for (let i = 0; i < participantCount; i++) {
      const nameData = germanNames[nameIndex % germanNames.length];
      nameIndex++;

      const participant = await prisma.tourParticipant.create({
        data: {
          bookingId: createdBooking.id,
          firstName: nameData.firstName,
          lastName: nameData.lastName,
          fullName: `${nameData.firstName} ${nameData.lastName}`,
          gender: nameData.gender,
          roomPreference: i % 2 === 0 ? 'DBL' : 'TWN',
          isGroupLeader: i === 0,
          passportNumber: `DE${Math.random().toString().slice(2, 11)}`
        }
      });
      participants.push(participant);
    }
    console.log(`   👥 Added ${participantCount} participants`);

    // Add hotel room allocations for some bookings
    if (['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(booking.status)) {
      // Get hotels for this tour
      const tashkentHotel = hotels.find(h => h.city.name === 'Ташкент' && h.stars >= 4);
      const samarkandHotel = hotels.find(h => h.city.name === 'Самарканд' && h.stars >= 4);
      const bukharaHotel = hotels.find(h => h.city.name === 'Бухара' && h.stars >= 3);
      const khivaHotel = hotels.find(h => h.city.name === 'Хива' && h.stars >= 3);

      const dblRooms = Math.floor(participantCount / 2);
      const snglRooms = participantCount % 2;

      // Tashkent (first 2 nights)
      if (tashkentHotel) {
        const dblRoomType = tashkentHotel.roomTypes.find(r => r.name === 'DBL');
        const snglRoomType = tashkentHotel.roomTypes.find(r => r.name === 'SNGL');

        const checkIn = new Date(booking.arrivalDate);
        const checkOut = new Date(checkIn);
        checkOut.setDate(checkOut.getDate() + 2);

        if (dblRoomType && dblRooms > 0) {
          await prisma.bookingRoom.create({
            data: {
              bookingId: createdBooking.id,
              hotelId: tashkentHotel.id,
              roomTypeId: dblRoomType.id,
              checkInDate: checkIn,
              checkOutDate: checkOut,
              quantity: dblRooms,
              pricePerNight: dblRoomType.pricePerNight,
              totalPrice: dblRoomType.pricePerNight * 2 * dblRooms
            }
          });
        }
        if (snglRoomType && snglRooms > 0) {
          await prisma.bookingRoom.create({
            data: {
              bookingId: createdBooking.id,
              hotelId: tashkentHotel.id,
              roomTypeId: snglRoomType.id,
              checkInDate: checkIn,
              checkOutDate: checkOut,
              quantity: snglRooms,
              pricePerNight: snglRoomType.pricePerNight,
              totalPrice: snglRoomType.pricePerNight * 2 * snglRooms
            }
          });
        }
        console.log(`   🏨 Added rooms at ${tashkentHotel.name}`);
      }

      // Samarkand (next 2 nights)
      if (samarkandHotel) {
        const dblRoomType = samarkandHotel.roomTypes.find(r => r.name === 'DBL');
        const snglRoomType = samarkandHotel.roomTypes.find(r => r.name === 'SNGL');

        const checkIn = new Date(booking.arrivalDate);
        checkIn.setDate(checkIn.getDate() + 2);
        const checkOut = new Date(checkIn);
        checkOut.setDate(checkOut.getDate() + 2);

        if (dblRoomType && dblRooms > 0) {
          await prisma.bookingRoom.create({
            data: {
              bookingId: createdBooking.id,
              hotelId: samarkandHotel.id,
              roomTypeId: dblRoomType.id,
              checkInDate: checkIn,
              checkOutDate: checkOut,
              quantity: dblRooms,
              pricePerNight: dblRoomType.pricePerNight,
              totalPrice: dblRoomType.pricePerNight * 2 * dblRooms
            }
          });
        }
        if (snglRoomType && snglRooms > 0) {
          await prisma.bookingRoom.create({
            data: {
              bookingId: createdBooking.id,
              hotelId: samarkandHotel.id,
              roomTypeId: snglRoomType.id,
              checkInDate: checkIn,
              checkOutDate: checkOut,
              quantity: snglRooms,
              pricePerNight: snglRoomType.pricePerNight,
              totalPrice: snglRoomType.pricePerNight * 2 * snglRooms
            }
          });
        }
        console.log(`   🏨 Added rooms at ${samarkandHotel.name}`);
      }

      // Bukhara (next 2 nights)
      if (bukharaHotel) {
        const dblRoomType = bukharaHotel.roomTypes.find(r => r.name === 'DBL');
        const snglRoomType = bukharaHotel.roomTypes.find(r => r.name === 'SNGL');

        const checkIn = new Date(booking.arrivalDate);
        checkIn.setDate(checkIn.getDate() + 4);
        const checkOut = new Date(checkIn);
        checkOut.setDate(checkOut.getDate() + 2);

        if (dblRoomType && dblRooms > 0) {
          await prisma.bookingRoom.create({
            data: {
              bookingId: createdBooking.id,
              hotelId: bukharaHotel.id,
              roomTypeId: dblRoomType.id,
              checkInDate: checkIn,
              checkOutDate: checkOut,
              quantity: dblRooms,
              pricePerNight: dblRoomType.pricePerNight,
              totalPrice: dblRoomType.pricePerNight * 2 * dblRooms
            }
          });
        }
        if (snglRoomType && snglRooms > 0) {
          await prisma.bookingRoom.create({
            data: {
              bookingId: createdBooking.id,
              hotelId: bukharaHotel.id,
              roomTypeId: snglRoomType.id,
              checkInDate: checkIn,
              checkOutDate: checkOut,
              quantity: snglRooms,
              pricePerNight: snglRoomType.pricePerNight,
              totalPrice: snglRoomType.pricePerNight * 2 * snglRooms
            }
          });
        }
        console.log(`   🏨 Added rooms at ${bukharaHotel.name}`);
      }
    }

    console.log('');
  }

  // Summary
  const totalBookings = await prisma.booking.count();
  const totalParticipants = await prisma.tourParticipant.count();
  const totalRoomAllocations = await prisma.bookingRoom.count();

  console.log('🎉 Sample bookings added successfully!\n');
  console.log('📊 Summary:');
  console.log(`   📋 Total bookings: ${totalBookings}`);
  console.log(`   👥 Total participants: ${totalParticipants}`);
  console.log(`   🏨 Total room allocations: ${totalRoomAllocations}`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
