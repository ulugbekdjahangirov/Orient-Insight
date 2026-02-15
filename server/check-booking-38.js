const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkBooking38() {
  try {
    // Get booking details
    const booking = await prisma.booking.findUnique({
      where: { id: 38 },
      include: {
        tourType: true,
        tourists: {
          select: {
            id: true,
            fullName: true,
            roomPreference: true,
          }
        }
      }
    });

    console.log('\n📋 BOOKING 38 DETAILS:');
    console.log('=====================================');
    console.log('Tour Type:', booking.tourType?.code);
    console.log('Departure Date:', booking.departureDate);
    console.log('Arrival Date:', booking.arrivalDate);
    console.log('End Date:', booking.endDate);
    console.log('Tourists:', booking.tourists.length);
    console.log('');

    // Get itinerary from TourType
    const itinerary = await prisma.tourItinerary.findMany({
      where: {
        tourTypeId: booking.tourTypeId,
        accommodation: {
          not: null
        }
      },
      orderBy: { dayNumber: 'asc' }
    });

    console.log('\n🗓️  ITINERARY (Hotels only):');
    console.log('=====================================');
    itinerary.forEach(day => {
      console.log(`Day ${day.dayNumber}: ${day.accommodation}`);
    });
    console.log('');

    // Get accommodations (BookingRoom is legacy, Accommodation is new)
    const bookingRooms = await prisma.bookingRoom.findMany({
      where: { bookingId: 38 },
      include: {
        hotel: {
          include: {
            city: true
          }
        },
        roomType: true
      },
      orderBy: { checkInDate: 'asc' }
    });

    const accommodations = await prisma.accommodation.findMany({
      where: { bookingId: 38 },
      include: {
        hotel: {
          include: {
            city: true
          }
        }
      },
      orderBy: { checkInDate: 'asc' }
    });

    console.log('\n🏨 BOOKING ROOMS (Legacy):');
    console.log('=====================================');
    if (bookingRooms.length > 0) {
      bookingRooms.forEach((room, idx) => {
        console.log(`${idx + 1}. ${room.hotel.name} - ${room.roomType.name}`);
        console.log(`   City: ${room.hotel.city?.name} (${room.hotel.city?.country || 'N/A'})`);
        console.log(`   Check-in: ${room.checkInDate}`);
        console.log(`   Check-out: ${room.checkOutDate}`);
        console.log(`   Quantity: ${room.quantity}, Price: ${room.pricePerNight}/night`);
        console.log('');
      });
    } else {
      console.log('   (none)');
    }

    console.log('\n🏨 ACCOMMODATIONS (New):');
    console.log('=====================================');
    if (accommodations.length > 0) {
      accommodations.forEach((acc, idx) => {
        console.log(`${idx + 1}. ${acc.hotel.name}`);
        console.log(`   City: ${acc.hotel.city?.name} (${acc.hotel.city?.country || 'N/A'})`);
        console.log(`   Check-in: ${acc.checkInDate}`);
        console.log(`   Check-out: ${acc.checkOutDate}`);
        console.log('');
      });
    } else {
      console.log('   (none)');
    }

    // Find first Uzbekistan hotel in itinerary
    const uzbekistanCities = ['tashkent', 'ташкент', 'samarkand', 'самарканд',
                              'bukhara', 'бухара', 'khiva', 'хива', 'chiwa',
                              'fergana', 'фергана', 'shakhrisabz', 'шахрисабз'];

    let firstUzbekDay = null;
    for (const day of itinerary) {
      const accLower = day.accommodation.toLowerCase();
      const isUzbekHotel = uzbekistanCities.some(city => accLower.includes(city));
      if (isUzbekHotel) {
        firstUzbekDay = day.dayNumber;
        console.log(`\n✅ First Uzbekistan hotel found at Day ${firstUzbekDay}: ${day.accommodation}`);
        break;
      }
    }

    if (firstUzbekDay && booking.tourType?.code === 'KAS') {
      const departureDate = new Date(booking.departureDate);
      const calculatedArrival = new Date(departureDate);
      calculatedArrival.setDate(calculatedArrival.getDate() + (firstUzbekDay - 1));

      console.log('\n🧮 KAS CALCULATION:');
      console.log('=====================================');
      console.log('Formula: departureDate + (firstUzbekDay - 1)');
      console.log(`Departure Date: ${booking.departureDate}`);
      console.log(`First UZ Hotel Day: ${firstUzbekDay}`);
      console.log(`Calculated UZ Arrival: ${calculatedArrival.toISOString().split('T')[0]}`);
      console.log(`Actual arrivalDate field: ${booking.arrivalDate}`);
      console.log(`Match: ${calculatedArrival.toISOString().split('T')[0] === booking.arrivalDate ? '✅' : '❌'}`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkBooking38();
