const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const KAS_TEMPLATES = [
  {
    dayNumber: 1, dayOffset: 0, sortOrder: 0,
    routeName: "Dostlik - Fergana", city: "Fergana",
    itinerary: "Dostlik chegarasidan Farg'ona shahriga transfer",
    provider: "nosir", optionRate: "dostlik"
  },
  {
    dayNumber: 2, dayOffset: 1, sortOrder: 1,
    routeName: "Fergana - Qoqon", city: "Fergana",
    itinerary: "Farg'ona va Qo'qon shahri bo'ylab ekskursiya",
    provider: "nosir", optionRate: "qoqon"
  },
  {
    dayNumber: 3, dayOffset: 2, sortOrder: 2,
    routeName: "Bukhara City Tour", city: "Bukhara",
    itinerary: "Buxoro shahri bo'ylab ekskursiya",
    provider: "sevil-kas", optionRate: "tagRate"
  },
  {
    dayNumber: 4, dayOffset: 3, sortOrder: 3,
    routeName: "Bukhara City Tour", city: "Bukhara",
    itinerary: "Buxoro shahri bo'ylab ekskursiya",
    provider: "sevil-kas", optionRate: "tagRate"
  },
  {
    dayNumber: 5, dayOffset: 4, sortOrder: 4,
    routeName: "Bukhara - Samarkand", city: "Bukhara",
    itinerary: "Buxorodan Samarqandga transfer",
    provider: "sevil-kas", optionRate: "tagRate"
  },
  {
    dayNumber: 6, dayOffset: 5, sortOrder: 5,
    routeName: "Samarkand City Tour", city: "Samarkand",
    itinerary: "Samarqand shahri bo'ylab ekskursiya",
    provider: "sevil-kas", optionRate: "tagRate"
  },
  {
    dayNumber: 7, dayOffset: 6, sortOrder: 6,
    routeName: "Samarkand City Tour", city: "Samarkand",
    itinerary: "Samarqand shahri bo'ylab ekskursiya",
    provider: "sevil-kas", optionRate: "tagRate"
  },
  {
    dayNumber: 8, dayOffset: 7, sortOrder: 7,
    routeName: "Train Station Pickup", city: "Tashkent",
    itinerary: "Samarqanddan Toshkentga poezd bilan transfer",
    provider: "xayrulla", optionRate: "vstrecha"
  },
  {
    dayNumber: 9, dayOffset: 8, sortOrder: 8,
    routeName: "Tashkent City Tour", city: "Tashkent",
    itinerary: "Toshkent shahri bo'ylab ekskursiya",
    provider: "xayrulla", optionRate: "cityTour"
  },
  {
    dayNumber: 10, dayOffset: 9, sortOrder: 9,
    routeName: "Airport Drop-off", city: "Tashkent",
    itinerary: "Toshkent xalqaro aeroportiga kuzatish",
    provider: "xayrulla", optionRate: "vstrecha"
  }
];

async function main() {
  // 1. Delete existing KAS RouteTemplates (if any)
  const deleted = await prisma.routeTemplate.deleteMany({ where: { tourTypeCode: "KAS" } });
  console.log("Deleted old KAS templates:", deleted.count);

  // 2. Insert new KAS RouteTemplates
  for (const t of KAS_TEMPLATES) {
    await prisma.routeTemplate.create({
      data: { tourTypeCode: "KAS", ...t }
    });
    console.log("Created:", t.sortOrder, t.routeName);
  }

  // 3. Update itinerary + provider + optionRate for existing KAS routes (empty ones)
  const kasBookings = await prisma.booking.findMany({
    where: { bookingNumber: { startsWith: "KAS" } },
    select: { id: true, bookingNumber: true }
  });

  let updatedRoutes = 0;
  for (const booking of kasBookings) {
    const routes = await prisma.route.findMany({ where: { bookingId: booking.id } });
    for (const route of routes) {
      const match = KAS_TEMPLATES.find(t => t.routeName === route.routeName);
      if (match) {
        await prisma.route.update({
          where: { id: route.id },
          data: {
            itinerary: route.itinerary || match.itinerary,
            provider: route.provider || match.provider,
            optionRate: route.optionRate || match.optionRate
          }
        });
        updatedRoutes++;
      }
    }
    console.log(booking.bookingNumber + ": updated");
  }
  console.log("Total routes updated:", updatedRoutes);

  // 4. Verify templates
  const templates = await prisma.routeTemplate.findMany({
    where: { tourTypeCode: "KAS" },
    orderBy: { sortOrder: "asc" }
  });
  console.log("\nKAS RouteTemplates in DB:", templates.length);
  for (const t of templates) {
    console.log("  [" + t.sortOrder + "] " + t.routeName + " | " + t.provider + " | " + t.itinerary);
  }

  await prisma.$disconnect();
}
main().catch(console.error);
