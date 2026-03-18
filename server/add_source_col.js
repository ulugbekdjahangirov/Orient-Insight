const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE GuideConfirmation ADD COLUMN source TEXT');
    console.log('source column added');
  } catch (e) {
    if (e.message.includes('duplicate column')) {
      console.log('column already exists');
    } else {
      throw e;
    }
  }
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
