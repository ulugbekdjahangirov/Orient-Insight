const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateArienPlaza() {
  try {
    console.log('🔧 Updating Arien Plaza in ZA template...\n');

    // Find Arien Plaza template
    const template = await prisma.accommodationTemplate.findFirst({
      where: {
        tourTypeCode: 'ZA',
        hotelId: 16  // Arien Plaza
      }
    });

    if (!template) {
      console.log('❌ Arien Plaza template not found');
      return;
    }

    console.log('Current values:');
    console.log(`  checkInOffset: ${template.checkInOffset}`);
    console.log(`  checkOutOffset: ${template.checkOutOffset}`);
    console.log(`  nights: ${template.nights}\n`);

    // Update to correct values
    // Arrival in UZ: 31.08 (day 0)
    // Bukhara: 31.08 - 03.09 (days 0-3)
    // Samarkand: 03.09 - 05.09 (days 3-5)
    // Tajikistan: 05.09 - 09.09 (days 5-9, no hotel)
    // Tashkent: 09.09 - 22.09 (days 9-22)
    const updated = await prisma.accommodationTemplate.update({
      where: { id: template.id },
      data: {
        checkInOffset: 9,   // 31.08 + 9 = 09.09
        checkOutOffset: 22, // 31.08 + 22 = 22.09 (booking end date)
        nights: 13          // 22 - 9 = 13 nights
      }
    });

    console.log('✅ Updated to:');
    console.log(`  checkInOffset: ${updated.checkInOffset} (09.09)`);
    console.log(`  checkOutOffset: ${updated.checkOutOffset} (22.09)`);
    console.log(`  nights: ${updated.nights}\n`);

    console.log('✅ Arien Plaza template updated successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

updateArienPlaza();
