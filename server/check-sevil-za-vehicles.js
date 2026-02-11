const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSevilZAVehicles() {
  const vehicles = await prisma.transportVehicle.findMany({
    where: { provider: 'sevil-za' },
    orderBy: { sortOrder: 'asc' }
  });

  console.log('Sevil ZA Vehicles:');
  vehicles.forEach(v => {
    console.log(`${v.name} (${v.person} PAX, ${v.seats} seats)`);
    console.log(`  TAG Rate: $${v.tagRate}`);
    console.log(`  Jartepa Rate: $${v.jartepaRate}`);
    console.log('');
  });

  await prisma.$disconnect();
}

checkSevilZAVehicles().catch(console.error);
