const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    console.log('=== Checking Sevil KAS Vehicles in Opex ===');
    console.log('');

    // Check sevil-kas vehicles
    const sevilKasVehicles = await prisma.transportVehicle.findMany({
      where: { provider: 'sevil-kas' },
      orderBy: { id: 'asc' }
    });

    if (sevilKasVehicles.length === 0) {
      console.log('❌ No sevil-kas vehicles found in database!');
      console.log('   This is why the modal shows empty prices for KAS tours.');
      console.log('');
      console.log('   Solution: Need to add sevil-kas vehicles in Opex page.');
    } else {
      console.log(`✅ Found ${sevilKasVehicles.length} sevil-kas vehicles:`);
      console.log('');
      sevilKasVehicles.forEach((v, i) => {
        console.log(`${i+1}. ${v.name} (${v.person} people)`);
        console.log(`   TAG Rate: $${v.tagRate || '(empty)'}`);
        console.log(`   Urgench Rate: $${v.urgenchRate || '(empty)'}`);
        console.log(`   Shovot Rate: $${v.shovotRate || '(empty)'}`);
        console.log('');
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
})();
