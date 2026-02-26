const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const zaTemplates = await prisma.routeTemplate.findMany({
    where: { tourTypeCode: "ZA" },
    orderBy: { sortOrder: "asc" }
  });
  console.log("ZA templates:");
  zaTemplates.forEach(t => console.log("  [" + t.sortOrder + "] " + t.routeName + " | " + t.provider + " | itinerary=" + (t.itinerary ? t.itinerary.substring(0,40) : "EMPTY")));

  const zaRoutes = await prisma.route.findMany({
    where: { booking: { bookingNumber: { startsWith: "ZA" } } },
    orderBy: [{ bookingId: "asc" }, { sortOrder: "asc" }]
  });
  const zaEmpty = zaRoutes.filter(r => r.itinerary === null || r.itinerary === "").length;
  console.log("\nZA routes total:", zaRoutes.length, "without itinerary:", zaEmpty);

  let updated = 0;
  for (const route of zaRoutes) {
    const isEmpty = route.itinerary === null || route.itinerary === "";
    if (isEmpty) {
      const match = zaTemplates.find(t => t.routeName === route.routeName);
      if (match && match.itinerary) {
        await prisma.route.update({
          where: { id: route.id },
          data: {
            itinerary: match.itinerary,
            provider: route.provider || match.provider || null,
            optionRate: route.optionRate || match.optionRate || null
          }
        });
        updated++;
      }
    }
  }
  console.log("Updated ZA routes with itinerary:", updated);

  await prisma.$disconnect();
}
main().catch(console.error);
