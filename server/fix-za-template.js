const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixZATemplate() {
  console.log('🔧 Fixing ZA route template providers...');

  // Update all ZA routes that have 'sevil' provider to 'sevil-za'
  const result = await prisma.routeTemplate.updateMany({
    where: {
      tourTypeCode: 'ZA',
      provider: 'sevil'
    },
    data: {
      provider: 'sevil-za'
    }
  });

  console.log(`✅ Updated ${result.count} routes from 'sevil' to 'sevil-za'`);

  // Verify the changes
  const templates = await prisma.routeTemplate.findMany({
    where: { tourTypeCode: 'ZA' },
    orderBy: { dayNumber: 'asc' }
  });

  console.log('\n📋 Updated ZA Route Templates:');
  templates.forEach(t => {
    console.log(`Day ${t.dayNumber}: ${t.routeName} - Provider: ${t.provider}`);
  });

  await prisma.$disconnect();
}

fixZATemplate().catch(console.error);
