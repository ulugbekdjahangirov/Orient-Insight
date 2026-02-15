const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.tourType.findFirst({ where: { code: 'ZA' } }).then(t => {
  console.log('ZA Tour Type ID:', t?.id);
  prisma.$disconnect();
});
