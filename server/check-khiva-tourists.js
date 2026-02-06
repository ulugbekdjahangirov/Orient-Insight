const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTourists() {
  // Get all tourists for booking ER-03
  const tourists = await prisma.tourist.findMany({
    where: {
      bookingId: 3,
      roomNumber: { not: null } // Only tourists with room assignments
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      accommodation: true,
      roomNumber: true
    }
  });

  console.log('\n📋 ER-03 Tourists:\n');

  let uzCount = 0;
  let tmCount = 0;

  tourists.forEach(t => {
    const placement = (t.accommodation || '').toLowerCase();
    const isUZ = placement.includes('uzbek') || placement.includes('узбек') || placement === 'uz';
    const isTM = placement.includes('turkmen') || placement.includes('туркмен') || placement === 'tm';

    if (isUZ) uzCount++;
    if (isTM) tmCount++;

    console.log(`   ${t.lastName}: ${t.accommodation || 'N/A'} (${isUZ ? 'UZ' : isTM ? 'TM' : '?'})`);
  });

  console.log(`\n📊 Summary:`);
  console.log(`   UZ tourists: ${uzCount}`);
  console.log(`   TM tourists: ${tmCount}`);
  console.log(`   Total: ${tourists.length}`);

  if (uzCount > 0 && tmCount === 0) {
    console.log('\n✅ VARIANT 2: Faqat UZ turistlar');
    console.log('   → Malika Khorazm: 22.09-24.09 (2 nights) bolishi kerak\n');
  } else if (tmCount > 0 && uzCount === 0) {
    console.log('\n✅ VARIANT 3: Faqat TM turistlar');
    console.log('   → Malika Khorazm: 22.09-25.09 (3 nights)');
    console.log('   → Oxirgi Tashkent hoteli yo\'q\n');
  } else if (uzCount > 0 && tmCount > 0) {
    console.log('\n✅ VARIANT 1: Aralash gruppa (UZ + TM)');
    console.log('   → Malika Khorazm: 22.09-25.09 (3 nights)');
    console.log('   → UZ: 2 kecha, TM: 3 kecha (rooming listda)\n');
  }

  await prisma.$disconnect();
}

checkTourists().catch(console.error);
