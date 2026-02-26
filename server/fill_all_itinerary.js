const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function fillItineraryForTourType(code) {
  const templates = await prisma.routeTemplate.findMany({
    where: { tourTypeCode: code },
    orderBy: { sortOrder: "asc" }
  });

  const tmplWithItinerary = templates.filter(t => t.itinerary && t.itinerary.trim());
  console.log(code + " templates: " + templates.length + " (with itinerary: " + tmplWithItinerary.length + ")");

  if (tmplWithItinerary.length === 0) {
    console.log("  No templates with itinerary for " + code + ", skipping");
    return 0;
  }

  const routes = await prisma.route.findMany({
    where: { booking: { bookingNumber: { startsWith: code } } }
  });
  const emptyRoutes = routes.filter(r => r.itinerary === null || r.itinerary === "");
  console.log("  Routes without itinerary: " + emptyRoutes.length);

  let updated = 0;
  for (const route of emptyRoutes) {
    const match = tmplWithItinerary.find(t => t.routeName === route.routeName);
    if (match) {
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
  console.log("  Updated: " + updated + " routes");
  return updated;
}

async function main() {
  for (const code of ["ER", "CO"]) {
    await fillItineraryForTourType(code);
  }

  // Final check
  console.log("\n=== Final itinerary status ===");
  for (const code of ["ER", "CO", "KAS", "ZA"]) {
    const routes = await prisma.route.findMany({
      where: { booking: { bookingNumber: { startsWith: code } } }
    });
    const empty = routes.filter(r => r.itinerary === null || r.itinerary === "").length;
    console.log(code + ": total=" + routes.length + " empty=" + empty + " filled=" + (routes.length - empty));
  }

  await prisma.$disconnect();
}
main().catch(console.error);
