const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteAccommodation() {
  try {
    console.log('\nDeleting accommodation ID 1145...\n');
    
    const deleted = await prisma.accommodation.delete({
      where: { id: 1145 }
    });
    
    console.log('Deleted: ' + deleted.id + ' - ' + deleted.checkInDate.toISOString().split('T')[0] + ' to ' + deleted.checkOutDate.toISOString().split('T')[0]);
    console.log('\nDone!\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteAccommodation();
