const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.systemSetting.findMany({ where: { key: { startsWith: 'JP_SECTIONS_' } } })
  .then(rows => {
    rows.forEach(r => {
      try {
        const d = JSON.parse(r.value);
        console.log(r.key, '| tourType:', d.tourType, '| hotel:', d.hotelName, '| groups:', (d.groups||[]).length);
      } catch(e) { console.log(r.key, 'parse error'); }
    });
    prisma.$disconnect();
  });
