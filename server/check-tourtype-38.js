const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.booking.findUnique({
  where: { id: 38 },
  include: { tourType: true }
}).then(b => {
  console.log('Booking 38:');
  console.log('ID:', b.id);
  console.log('Booking Number:', b.bookingNumber);
  console.log('tourType object:', b.tourType);
  console.log('tourType.code:', b.tourType?.code);
  console.log('tourType.name:', b.tourType?.name);
  return prisma.$disconnect();
});
