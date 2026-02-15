const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function importPrices() {
  console.log('📥 Starting price import...');

  try {
    // Read JSON file
    const importPath = path.join(__dirname, 'price-export.json');

    if (!fs.existsSync(importPath)) {
      console.error(`❌ File not found: ${importPath}`);
      process.exit(1);
    }

    const data = JSON.parse(fs.readFileSync(importPath, 'utf8'));
    console.log(`✅ Loaded ${data.length} configurations from file`);

    let imported = 0;
    let updated = 0;
    let failed = 0;

    // Import each configuration
    for (const config of data) {
      try {
        const existing = await prisma.priceConfig.findUnique({
          where: {
            tourType_category_paxTier: {
              tourType: config.tourType,
              category: config.category,
              paxTier: config.paxTier
            }
          }
        });

        if (existing) {
          // Update existing
          await prisma.priceConfig.update({
            where: {
              tourType_category_paxTier: {
                tourType: config.tourType,
                category: config.category,
                paxTier: config.paxTier
              }
            },
            data: {
              itemsJson: JSON.stringify(config.items)
            }
          });
          updated++;
          console.log(`🔄 Updated: ${config.tourType}/${config.category}/${config.paxTier}`);
        } else {
          // Create new
          await prisma.priceConfig.create({
            data: {
              tourType: config.tourType,
              category: config.category,
              paxTier: config.paxTier,
              itemsJson: JSON.stringify(config.items)
            }
          });
          imported++;
          console.log(`✅ Imported: ${config.tourType}/${config.category}/${config.paxTier}`);
        }
      } catch (error) {
        failed++;
        console.error(`❌ Failed: ${config.tourType}/${config.category}/${config.paxTier}`, error.message);
      }
    }

    console.log('\n📊 Import summary:');
    console.log(`   ✅ New imports: ${imported}`);
    console.log(`   🔄 Updated: ${updated}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📈 Total: ${imported + updated}`);
    console.log('\n🎉 Import complete!');

  } catch (error) {
    console.error('❌ Import error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

importPrices();
