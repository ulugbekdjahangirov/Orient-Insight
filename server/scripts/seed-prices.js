const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Default price data based on Price.jsx defaults
const defaultHotelPrices = [
  { id: 1, city: 'Tashkent', days: 3, pricePerDay: 0, ezZimmer: 0, ezZuschlag: 0 },
  { id: 2, city: 'Samarkand', days: 3, pricePerDay: 0, ezZimmer: 0, ezZuschlag: 0 },
  { id: 3, city: 'Asraf', days: 1, pricePerDay: 0, ezZimmer: 0, ezZuschlag: 0 },
  { id: 4, city: 'Buchara', days: 3, pricePerDay: 0, ezZimmer: 0, ezZuschlag: 0 },
  { id: 5, city: 'Chiwa', days: 2, pricePerDay: 0, ezZimmer: 0, ezZuschlag: 0 },
];

const defaultTransportRoutes = [
  { id: 1, name: 'Taschkent', days: 1, price: 220 },
  { id: 2, name: 'Taschkent-Chimgan-Taschkent', days: 1, price: 220 },
  { id: 3, name: 'Transfer zum Bahnhof', days: 1, price: 60 },
  { id: 4, name: 'Samarkand', days: 1, price: 220 },
  { id: 5, name: 'Samarkand-Asraf', days: 1, price: 220 },
  { id: 6, name: 'Asraf-Bukhara', days: 1, price: 220 },
  { id: 7, name: 'Bukhara', days: 1, price: 220 },
  { id: 8, name: 'Bukhara-Khiva', days: 1, price: 220 },
  { id: 9, name: 'Khiva-Urgench', days: 1, price: 80 },
  { id: 10, name: 'Khiva-Shovot', days: 1, price: 100 },
  { id: 11, name: 'Aeroport-Hotel', days: 1, price: 60 },
  { id: 12, name: 'Hotel-Aeroport', days: 1, price: 60 },
];

const defaultRailwayRoutes = [
  { id: 1, name: 'Taschkent-Samarkand', days: 1, price: 0 },
  { id: 2, name: 'Samarkand-Taschkent', days: 1, price: 0 },
];

const defaultFlyRoutes = [
  { id: 1, name: 'Istanbul-Taschkent', days: 1, price: 0 },
  { id: 2, name: 'Taschkent-Istanbul', days: 1, price: 0 },
];

const defaultMealItems = [
  { id: 1, name: 'Breakfast', days: 1, price: 0 },
  { id: 2, name: 'Lunch', days: 1, price: 0 },
  { id: 3, name: 'Dinner', days: 1, price: 0 },
];

const defaultSightseingItems = [
  { id: 1, name: 'Museum Entry', days: 1, price: 0 },
  { id: 2, name: 'Guide Service', days: 1, price: 0 },
];

const defaultGuideItems = [
  { id: 1, name: 'Main Guide (per day)', days: 1, price: 0 },
  { id: 2, name: 'Local Guide (per day)', days: 1, price: 0 },
];

const defaultShouItems = [
  { id: 1, name: 'Show', days: 1, price: 0 },
];

async function seedPrices() {
  console.log('🌱 Starting price seeding...');

  const tourTypes = ['ER', 'CO', 'KAS', 'ZA', 'PREIS2026'];
  const paxTiers = ['4', '5', '6-7', '8-9', '10-11', '12-13', '14-15', '16'];

  let count = 0;

  for (const tourType of tourTypes) {
    console.log(`\n📦 Seeding ${tourType}...`);

    for (const paxTier of paxTiers) {
      // Hotels
      await prisma.priceConfig.upsert({
        where: {
          tourType_category_paxTier: { tourType, category: 'hotels', paxTier }
        },
        update: {
          itemsJson: JSON.stringify(defaultHotelPrices)
        },
        create: {
          tourType,
          category: 'hotels',
          paxTier,
          itemsJson: JSON.stringify(defaultHotelPrices)
        }
      });
      count++;

      // Transport
      await prisma.priceConfig.upsert({
        where: {
          tourType_category_paxTier: { tourType, category: 'transport', paxTier }
        },
        update: {
          itemsJson: JSON.stringify(defaultTransportRoutes)
        },
        create: {
          tourType,
          category: 'transport',
          paxTier,
          itemsJson: JSON.stringify(defaultTransportRoutes)
        }
      });
      count++;

      // Railway
      await prisma.priceConfig.upsert({
        where: {
          tourType_category_paxTier: { tourType, category: 'railway', paxTier }
        },
        update: {
          itemsJson: JSON.stringify(defaultRailwayRoutes)
        },
        create: {
          tourType,
          category: 'railway',
          paxTier,
          itemsJson: JSON.stringify(defaultRailwayRoutes)
        }
      });
      count++;

      // Fly
      await prisma.priceConfig.upsert({
        where: {
          tourType_category_paxTier: { tourType, category: 'fly', paxTier }
        },
        update: {
          itemsJson: JSON.stringify(defaultFlyRoutes)
        },
        create: {
          tourType,
          category: 'fly',
          paxTier,
          itemsJson: JSON.stringify(defaultFlyRoutes)
        }
      });
      count++;

      // Meal
      await prisma.priceConfig.upsert({
        where: {
          tourType_category_paxTier: { tourType, category: 'meal', paxTier }
        },
        update: {
          itemsJson: JSON.stringify(defaultMealItems)
        },
        create: {
          tourType,
          category: 'meal',
          paxTier,
          itemsJson: JSON.stringify(defaultMealItems)
        }
      });
      count++;

      // Sightseeing
      await prisma.priceConfig.upsert({
        where: {
          tourType_category_paxTier: { tourType, category: 'sightseeing', paxTier }
        },
        update: {
          itemsJson: JSON.stringify(defaultSightseingItems)
        },
        create: {
          tourType,
          category: 'sightseeing',
          paxTier,
          itemsJson: JSON.stringify(defaultSightseingItems)
        }
      });
      count++;

      // Guide
      await prisma.priceConfig.upsert({
        where: {
          tourType_category_paxTier: { tourType, category: 'guide', paxTier }
        },
        update: {
          itemsJson: JSON.stringify(defaultGuideItems)
        },
        create: {
          tourType,
          category: 'guide',
          paxTier,
          itemsJson: JSON.stringify(defaultGuideItems)
        }
      });
      count++;

      // Shou
      await prisma.priceConfig.upsert({
        where: {
          tourType_category_paxTier: { tourType, category: 'shou', paxTier }
        },
        update: {
          itemsJson: JSON.stringify(defaultShouItems)
        },
        create: {
          tourType,
          category: 'shou',
          paxTier,
          itemsJson: JSON.stringify(defaultShouItems)
        }
      });
      count++;

      // Zusatzkosten (empty by default)
      await prisma.priceConfig.upsert({
        where: {
          tourType_category_paxTier: { tourType, category: 'zusatzkosten', paxTier }
        },
        update: {
          itemsJson: JSON.stringify([])
        },
        create: {
          tourType,
          category: 'zusatzkosten',
          paxTier,
          itemsJson: JSON.stringify([])
        }
      });
      count++;
    }

    console.log(`✅ ${tourType} seeded`);
  }

  console.log(`\n🎉 Seeding complete! ${count} configurations created.`);
}

seedPrices()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
