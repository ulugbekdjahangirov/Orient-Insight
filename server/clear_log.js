const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.systemSetting.delete({ where: { key: 'AUSGABEN_SENT_LOG' } })
  .then(() => console.log('Log cleared'))
  .catch(e => console.log('Not found, ok:', e.message))
  .finally(() => p.$disconnect());
