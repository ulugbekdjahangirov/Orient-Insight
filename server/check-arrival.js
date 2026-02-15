const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.booking.findUnique({
  where: { id: 38 }
}).then(b => {
  console.log('Booking 38 arrivalDate:', b.arrivalDate);
  console.log('Booking 38 departureDate:', b.departureDate);
  return prisma.$disconnect();
});
