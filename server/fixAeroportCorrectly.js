const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixCorrectly() {
  try {
    console.log('\n🔧 FIXING: Only row 14 should be Xalqaro, row 13 should stay Mahalliy\n');

    // 1. Restore row 13: Xalqaro Aeroport-Hotel → Mahalliy Aeroport-Hotel
    console.log('📌 Step 1: Restoring row 13 (Aeroport-Hotel)...\n');

    const row13Routes = await prisma.route.findMany({
      where: {
        routeName: 'Xalqaro Aeroport-Hotel'
      },
      include: {
        booking: true
      }
    });

    console.log(`Found ${row13Routes.length} routes to restore:\n`);

    for (const route of row13Routes) {
      await prisma.route.update({
        where: { id: route.id },
        data: { routeName: 'Mahalliy Aeroport-Hotel' }
      });

      console.log(`  ✅ ${route.booking.bookingNumber}: Xalqaro Aeroport-Hotel → Mahalliy Aeroport-Hotel`);
    }

    // 2. Check row 14: Hotel- Xalqaro Aeroport (should already be correct)
    console.log('\n📌 Step 2: Verifying row 14 (Hotel- ... Aeroport)...\n');

    const row14Routes = await prisma.route.findMany({
      where: {
        routeName: 'Hotel- Xalqaro Aeroport'
      },
      include: {
        booking: true
      }
    });

    console.log(`✅ Row 14 already correct: ${row14Routes.length} routes\n`);

    // 3. Update template: Keep both versions
    console.log('📝 Updating ER template...\n');

    // Restore row 13 in template
    const template13 = await prisma.routeTemplate.findFirst({
      where: {
        tourTypeCode: 'ER',
        routeName: 'Xalqaro Aeroport-Hotel'
      }
    });

    if (template13) {
      await prisma.routeTemplate.update({
        where: { id: template13.id },
        data: { routeName: 'Mahalliy Aeroport-Hotel' }
      });
      console.log('  ✅ Template row 13: Xalqaro → Mahalliy Aeroport-Hotel');
    }

    // Row 14 should already be correct
    const template14 = await prisma.routeTemplate.findFirst({
      where: {
        tourTypeCode: 'ER',
        routeName: 'Hotel- Xalqaro Aeroport'
      }
    });

    if (template14) {
      console.log('  ✅ Template row 14: Already correct (Hotel- Xalqaro Aeroport)');
    }

    console.log('\n✅ DONE! Summary:');
    console.log('   Row 13: Mahalliy Aeroport-Hotel (ichki reys - Urgench to Tashkent)');
    console.log('   Row 14: Hotel- Xalqaro Aeroport (xalqaro reys - Tashkent to Istanbul)\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixCorrectly();
