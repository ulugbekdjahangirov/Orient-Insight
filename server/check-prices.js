const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPrices() {
  const hotel = await prisma.hotel.findFirst({
    where: { name: 'Arien Plaza' },
    include: { roomTypes: true }
  });

  console.log('\n🏨 Hotel:', hotel.name);
  console.log('🏢 Total Rooms:', hotel.totalRooms);
  console.log('\n📋 Room Types:');

  hotel.roomTypes.forEach(rt => {
    // Calculate tourist tax percentage
    const totalRooms = hotel.totalRooms || 0;
    let taxPercentage = 0.15; // default >40 rooms
    if (totalRooms <= 10) taxPercentage = 0.05;
    else if (totalRooms <= 40) taxPercentage = 0.10;

    const basePrice = parseFloat(rt.pricePerNight) || 0;
    const vatAmount = rt.vatIncluded ? basePrice * 0.12 : 0;
    let totalPrice = basePrice + vatAmount;

    // Add tourist tax if enabled (per person, not per room)
    let touristTax = 0;
    if (rt.touristTaxEnabled && rt.brvValue > 0) {
      touristTax = rt.brvValue * taxPercentage * (rt.maxGuests || 1);
      totalPrice += touristTax;
    }

    console.log(`\n  ${rt.name} (${rt.currency}):`);
    console.log(`    Base price: ${basePrice.toLocaleString()}`);
    console.log(`    Max Guests: ${rt.maxGuests}`);
    console.log(`    VAT (12%): ${rt.vatIncluded ? 'Yes' : 'No'} = ${vatAmount.toLocaleString()}`);
    console.log(`    Tourist Tax: ${rt.touristTaxEnabled ? 'Yes' : 'No'} (${(taxPercentage * 100)}%) = ${touristTax.toLocaleString()}`);
    console.log(`    BRV Value: ${rt.brvValue || 0}`);
    console.log(`    ✅ TOTAL (displayed in Hotels): ${Math.round(totalPrice).toLocaleString()}`);
  });

  await prisma.$disconnect();
}

checkPrices().catch(console.error);
