const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function exportPrices() {
  console.log('📤 Starting price export...');

  try {
    // Get all price configurations from database
    const configs = await prisma.priceConfig.findMany({
      orderBy: [
        { tourType: 'asc' },
        { category: 'asc' },
        { paxTier: 'asc' }
      ]
    });

    console.log(`✅ Found ${configs.length} configurations`);

    // Convert to export format
    const exportData = configs.map(config => ({
      tourType: config.tourType,
      category: config.category,
      paxTier: config.paxTier,
      items: JSON.parse(config.itemsJson),
      updatedAt: config.updatedAt
    }));

    // Write to JSON file
    const exportPath = path.join(__dirname, 'price-export.json');
    fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2), 'utf8');

    console.log(`✅ Exported to: ${exportPath}`);
    console.log(`📊 Total configurations: ${exportData.length}`);

    // Summary by tour type
    const summary = {};
    exportData.forEach(item => {
      if (!summary[item.tourType]) summary[item.tourType] = 0;
      summary[item.tourType]++;
    });

    console.log('\n📋 Summary by tour type:');
    Object.entries(summary).forEach(([type, count]) => {
      console.log(`   ${type}: ${count} configurations`);
    });

    console.log('\n🎉 Export complete!');
  } catch (error) {
    console.error('❌ Export error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

exportPrices();
