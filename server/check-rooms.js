const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async()=>{
  const rooms = await prisma.accommodationRoom.findMany({
    where:{accommodationId:666}
  });
  console.log(JSON.stringify(rooms,null,2));
  await prisma.$disconnect();
})();
