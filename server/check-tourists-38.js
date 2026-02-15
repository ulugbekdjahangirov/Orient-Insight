const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTourists() {
  const tourists = await prisma.tourist.findMany({
    where: { bookingId: 38 },
    select: {
      id: true,
      fullName: true,
      checkInDate: true,
      checkOutDate: true
    }
  });

  console.log('\n👥 TOURISTS (Booking 38):');
  console.log('=====================================');
  tourists.forEach(t => {
    console.log(`${t.fullName}:`);
    console.log(`  Check-in: ${t.checkInDate}`);
    console.log(`  Check-out: ${t.checkOutDate}`);
  });

  await prisma.$disconnect();
}

checkTourists();
