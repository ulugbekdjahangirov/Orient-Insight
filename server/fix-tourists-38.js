const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixTourists() {
  try {
    // Get booking to calculate correct Uzbekistan arrival
    const booking = await prisma.booking.findUnique({
      where: { id: 38 }
    });

    const uzbekistanArrival = new Date('2025-09-15'); // Day 15

    console.log('\n🔄 UPDATING tourists check-in dates...');
    console.log('=====================================');
    console.log('Uzbekistan arrival:', uzbekistanArrival.toISOString().split('T')[0]);

    // Update all tourists
    const result = await prisma.tourist.updateMany({
      where: { bookingId: 38 },
      data: {
        checkInDate: uzbekistanArrival
      }
    });

    console.log(`✅ Updated ${result.count} tourists`);

    // Verify
    const tourists = await prisma.tourist.findMany({
      where: { bookingId: 38 },
      select: {
        fullName: true,
        checkInDate: true,
        checkOutDate: true
      }
    });

    console.log('\n✅ AFTER UPDATE:');
    console.log('=====================================');
    tourists.forEach(t => {
      console.log(`${t.fullName}:`);
      console.log(`  Check-in: ${new Date(t.checkInDate).toISOString().split('T')[0]}`);
      console.log(`  Check-out: ${new Date(t.checkOutDate).toISOString().split('T')[0]}`);
    });

    console.log('\n🎉 Tourists updated successfully!');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixTourists();
