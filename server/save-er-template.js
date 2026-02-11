const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ER Route Template - Based on manually corrected ER-01 structure
const erRouteTemplate = [
  // Day 1 - Arrival
  { dayNumber: 1, dayOffset: 0, routeName: 'Tashkent City Tour', city: 'Tashkent', provider: 'xayrulla', sortOrder: 1 },

  // Day 2 - Chimgan
  { dayNumber: 2, dayOffset: 1, routeName: 'Tashkent - Chimgan - Tashkent', city: 'Tashkent', provider: 'xayrulla', sortOrder: 2 },

  // Day 3 - Train to Samarkand (SAME DAY for both routes)
  { dayNumber: 3, dayOffset: 2, routeName: 'Airport Pickup', city: 'Tashkent', provider: 'xayrulla', sortOrder: 3 },
  { dayNumber: 3, dayOffset: 2, routeName: 'Samarkand City Tour', city: 'Samarkand', provider: 'sevil-er', sortOrder: 4 },

  // Day 4-6 - Samarkand
  { dayNumber: 4, dayOffset: 3, routeName: 'Samarkand City Tour', city: 'Samarkand', provider: 'sevil-er', sortOrder: 5 },
  { dayNumber: 5, dayOffset: 4, routeName: 'Samarkand City Tour', city: 'Samarkand', provider: 'sevil-er', sortOrder: 6 },
  { dayNumber: 6, dayOffset: 5, routeName: 'Samarkand - Asraf', city: 'Asraf', provider: 'sevil-er', sortOrder: 7 },

  // Day 7 - Asraf to Bukhara
  { dayNumber: 7, dayOffset: 6, routeName: 'Asraf - Bukhara', city: 'Bukhara', provider: 'sevil-er', sortOrder: 8 },

  // Day 8-9 - Bukhara
  { dayNumber: 8, dayOffset: 7, routeName: 'Bukhara City Tour', city: 'Bukhara', provider: 'sevil-er', sortOrder: 9 },
  { dayNumber: 9, dayOffset: 8, routeName: 'Bukhara City Tour', city: 'Bukhara', provider: 'sevil-er', sortOrder: 10 },

  // Day 10 - Bukhara to Khiva
  { dayNumber: 10, dayOffset: 9, routeName: 'Bukhara - Khiva', city: 'Khiva', provider: 'sevil-er', sortOrder: 11 },

  // Day 11 - REST DAY in Khiva (no route - dayOffset jumps from 9 to 11)

  // Day 12 - UZB fly to Tashkent (SAME DAY for both routes)
  { dayNumber: 12, dayOffset: 11, routeName: 'Khiva - Urgench', city: 'Khiva', provider: 'sevil-er', sortOrder: 12 },
  { dayNumber: 12, dayOffset: 11, routeName: 'Airport Pickup', city: 'Tashkent', provider: 'xayrulla', sortOrder: 13 },

  // Day 13 - Final day split (SAME DAY for both routes)
  { dayNumber: 13, dayOffset: 12, routeName: 'Airport Drop-off', city: 'Tashkent', provider: 'xayrulla', sortOrder: 14 },
  { dayNumber: 13, dayOffset: 12, routeName: 'Khiva - Shovot', city: 'Khiva', provider: 'sevil-er', sortOrder: 15 }
];

async function saveErTemplate() {
  try {
    console.log('🔵 Saving ER route template to database...');

    // Delete existing ER templates
    await prisma.routeTemplate.deleteMany({
      where: { tourTypeCode: 'ER' }
    });
    console.log('  ✅ Deleted old ER templates');

    // Create new ER templates
    for (const route of erRouteTemplate) {
      await prisma.routeTemplate.create({
        data: {
          tourTypeCode: 'ER',
          dayNumber: route.dayNumber,
          dayOffset: route.dayOffset,
          routeName: route.routeName,
          city: route.city,
          provider: route.provider,
          sortOrder: route.sortOrder
        }
      });
      console.log(`  ✅ Saved: Day ${route.dayNumber} (offset ${route.dayOffset}) - ${route.routeName}`);
    }

    console.log('🎉 ER template saved successfully!');
    console.log(`📊 Total routes: ${erRouteTemplate.length}`);
    console.log('📝 Same-day routes:');
    console.log('   - Day 3 (offset 2): Airport Pickup + Samarkand City Tour');
    console.log('   - Day 12 (offset 11): Khiva-Urgench + Airport Pickup');
    console.log('   - Day 13 (offset 12): Airport Drop-off + Khiva-Shovot');
    console.log('📝 Rest day: Day 11 (no route, offset jumps 9→11)');

  } catch (error) {
    console.error('❌ Error saving ER template:', error);
  } finally {
    await prisma.$disconnect();
  }
}

saveErTemplate();
