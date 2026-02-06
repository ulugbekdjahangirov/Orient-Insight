const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateERTemplate() {
  try {
    console.log('🔄 Updating ER template with new Uzbek route names...');

    // Delete old ER template
    await prisma.routeTemplate.deleteMany({
      where: { tourTypeCode: 'ER' }
    });

    console.log('✅ Old template deleted');

    // New ER template with Uzbek route names
    // Matches screenshot: no "Khiva City Tour" before Khiva-Urgench
    // Rows 12-15 dates adjusted: 15.10, 15.10, 16.10, 16.10
    const newERTemplate = [
      { dayNumber: 1, dayOffset: 0, routeName: 'Tashkent City Tour', city: 'Tashkent', provider: 'xayrulla', optionRate: 'cityTour', sortOrder: 0 },
      { dayNumber: 2, dayOffset: 1, routeName: 'Tashkent - Chimgan - Tashkent', city: 'Tashkent', provider: 'xayrulla', optionRate: 'chimgan', sortOrder: 1 },
      { dayNumber: 3, dayOffset: 2, routeName: 'Hotel-Vokzal', city: 'Tashkent', provider: 'xayrulla', optionRate: 'vstrecha', sortOrder: 2 },
      { dayNumber: 4, dayOffset: 2, routeName: 'Samarkand City Tour', city: 'Samarkand', provider: 'sevil', optionRate: 'tagRate', sortOrder: 3 },
      { dayNumber: 5, dayOffset: 3, routeName: 'Samarkand City Tour', city: 'Samarkand', provider: 'sevil', optionRate: 'tagRate', sortOrder: 4 },
      { dayNumber: 6, dayOffset: 4, routeName: 'Samarkand City Tour', city: 'Samarkand', provider: 'sevil', optionRate: 'tagRate', sortOrder: 5 },
      { dayNumber: 7, dayOffset: 5, routeName: 'Samarkand - Asraf', city: 'Asraf', provider: 'sevil', optionRate: 'tagRate', sortOrder: 6 },
      { dayNumber: 8, dayOffset: 6, routeName: 'Asraf - Bukhara', city: 'Bukhara', provider: 'sevil', optionRate: 'tagRate', sortOrder: 7 },
      { dayNumber: 9, dayOffset: 7, routeName: 'Bukhara City Tour', city: 'Bukhara', provider: 'sevil', optionRate: 'tagRate', sortOrder: 8 },
      { dayNumber: 10, dayOffset: 8, routeName: 'Bukhara City Tour', city: 'Bukhara', provider: 'sevil', optionRate: 'tagRate', sortOrder: 9 },
      { dayNumber: 11, dayOffset: 9, routeName: 'Bukhara - Khiva', city: 'Khiva', provider: 'sevil', optionRate: 'tagRate', sortOrder: 10 },
      { dayNumber: 12, dayOffset: 11, routeName: 'Khiva - Urgench', city: 'Khiva', provider: 'sevil', optionRate: 'urgenchRate', sortOrder: 11 },
      { dayNumber: 13, dayOffset: 11, routeName: 'Mahalliy Aeroport-Hotel', city: 'Tashkent', provider: 'xayrulla', optionRate: 'vstrecha', sortOrder: 12 },
      { dayNumber: 14, dayOffset: 12, routeName: 'Hotel- Mahalliy Aeroport', city: 'Tashkent', provider: 'xayrulla', optionRate: 'vstrecha', sortOrder: 13 },
      { dayNumber: 15, dayOffset: 12, routeName: 'Khiva - Shovot', city: 'Khiva', provider: 'sevil', optionRate: 'shovotRate', sortOrder: 14 }
    ];

    // Create new template
    for (const template of newERTemplate) {
      await prisma.routeTemplate.create({
        data: {
          tourTypeCode: 'ER',
          dayNumber: template.dayNumber,
          dayOffset: template.dayOffset,
          routeName: template.routeName,
          city: template.city,
          provider: template.provider,
          optionRate: template.optionRate,
          sortOrder: template.sortOrder
        }
      });
    }

    console.log(`✅ Created ${newERTemplate.length} routes in new ER template`);
    console.log('\n📋 New ER Template:');
    newERTemplate.forEach((t, i) => {
      console.log(`  ${i + 1}. Day ${t.dayNumber} (offset ${t.dayOffset}): ${t.routeName} - ${t.city} (${t.provider})`);
    });

    console.log('\n🎉 ER template successfully updated!');
    console.log('Now "Fix Vehicles" button will use this template for all ER groups.');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateERTemplate();
