const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Itinerary map by routeName (shared across ER and CO)
const ITINERARY_MAP = {
  "Tashkent City Tour":              "Toshkent shahri bo'ylab ekskursiya",
  "Tashkent - Chimgan - Tashkent":   "Chimgan tog'li kurortiga sayohat",
  "Train Station Drop-off":          "Toshkent temir yo'l vokzalida kuzatib qo'yish",
  "Airport Pickup":                  "Aeroportdan kutib olish va otelga keltirish",
  "Airport Drop-off":                "Toshkent xalqaro aeroportiga kuzatish",
  "Samarkand City Tour":             "Samarqand shahri bo'ylab ekskursiya",
  "Samarkand - Asraf":               "Samarqanddan Asraf shahriga transfer",
  "Asraf - Bukhara":                 "Asrafdan Buxoroga transfer",
  "Bukhara City Tour":               "Buxoro shahri bo'ylab ekskursiya",
  "Bukhara - Khiva":                 "Buxorodan Xivaga transfer",
  "Khiva - Urgench":                 "Xivadan Urganchga transfer",
  "Khiva - Shovot":                  "Xivadan Sho'vot chegarasiga transfer",
  // CO specific
  "Qoqon - Fergana":                 "Qo'qon shahridan Farg'onaga transfer",
  "Fergana - Tashkent":              "Farg'onadan Toshkentga transfer",
  "Samarkand - Bukhara":             "Samarqanddan Buxoroga transfer",
  "Bukhara - Samarkand":             "Buxorodan Samarqandga transfer",
};

async function updateTemplateItinerary(code) {
  const templates = await prisma.routeTemplate.findMany({
    where: { tourTypeCode: code },
    orderBy: { sortOrder: "asc" }
  });
  console.log("\n" + code + " templates: " + templates.length);

  let tplUpdated = 0;
  for (const t of templates) {
    const itinerary = ITINERARY_MAP[t.routeName];
    if (itinerary && !t.itinerary) {
      await prisma.routeTemplate.update({
        where: { id: t.id },
        data: { itinerary }
      });
      tplUpdated++;
      console.log("  Template updated: " + t.routeName);
    }
  }
  console.log("  Templates updated: " + tplUpdated);

  // Fill routes from map
  const routes = await prisma.route.findMany({
    where: { booking: { bookingNumber: { startsWith: code } } }
  });
  const empty = routes.filter(r => r.itinerary === null || r.itinerary === "");
  let rUpdated = 0;
  for (const route of empty) {
    const itinerary = ITINERARY_MAP[route.routeName];
    if (itinerary) {
      await prisma.route.update({
        where: { id: route.id },
        data: { itinerary }
      });
      rUpdated++;
    }
  }
  console.log("  Routes updated: " + rUpdated + " / " + empty.length + " empty");
}

async function main() {
  await updateTemplateItinerary("ER");
  await updateTemplateItinerary("CO");

  // Final summary
  console.log("\n=== FINAL STATUS ===");
  for (const code of ["ER", "CO", "KAS", "ZA"]) {
    const routes = await prisma.route.findMany({
      where: { booking: { bookingNumber: { startsWith: code } } }
    });
    const empty = routes.filter(r => r.itinerary === null || r.itinerary === "").length;
    console.log(code + ": total=" + routes.length + " filled=" + (routes.length - empty) + " empty=" + empty);
  }

  await prisma.$disconnect();
}
main().catch(console.error);
