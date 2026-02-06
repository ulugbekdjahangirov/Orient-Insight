const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkER01Routes() {
  try {
    const booking = await prisma.booking.findFirst({
      where: { bookingNumber: 'ER-01' },
      include: {
        routes: {
          orderBy: { dayNumber: 'asc' }
        }
      }
    });

    if (!booking) {
      console.log('❌ ER-01 not found');
      return;
    }

    console.log('📦 ER-01 Routes in Database:\n');
    console.log('# | Date       | City       | Route                        | PAX | Provider | Vehicle | Rate        | Price');
    console.log('-'.repeat(120));

    booking.routes.forEach((r, i) => {
      const date = r.date ? r.date.toISOString().split('T')[0] : 'N/A';
      const city = (r.city || 'N/A').padEnd(10);
      const route = (r.routeName || 'N/A').padEnd(28);
      const pax = (r.personCount || 0).toString().padStart(3);
      const provider = (r.provider || 'N/A').padEnd(8);
      const vehicle = (r.transportType || 'N/A').padEnd(7);
      const rate = (r.optionRate || 'N/A').padEnd(11);
      const price = r.price ? `$${r.price}` : 'N/A';

      console.log(`${(i+1).toString().padStart(2)} | ${date} | ${city} | ${route} | ${pax} | ${provider} | ${vehicle} | ${rate} | ${price}`);
    });

    console.log('\n📊 Summary:');
    const withVehicle = booking.routes.filter(r => r.transportType).length;
    const withPrice = booking.routes.filter(r => r.price && r.price > 0).length;
    console.log(`   Routes with Vehicle: ${withVehicle}/${booking.routes.length}`);
    console.log(`   Routes with Price: ${withPrice}/${booking.routes.length}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkER01Routes();
