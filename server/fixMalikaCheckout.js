const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixCheckout() {
  try {
    console.log('\nUpdating Malika Khorazm checkout date for UZB tourists...\n');
    
    const updated = await prisma.accommodation.update({
      where: { id: 1143 },
      data: {
        checkOutDate: new Date('2025-09-24T00:00:00'),
        nights: 2
      }
    });
    
    console.log('Updated ID ' + updated.id + ':');
    console.log('  Check-in: ' + updated.checkInDate.toISOString().split('T')[0]);
    console.log('  Check-out: ' + updated.checkOutDate.toISOString().split('T')[0]);
    console.log('  Nights: ' + updated.nights);
    console.log('\nDone!\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixCheckout();
