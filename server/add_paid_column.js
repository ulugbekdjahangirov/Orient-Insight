const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  try {
    await p.$executeRawUnsafe('ALTER TABLE Railway ADD COLUMN paid INTEGER NOT NULL DEFAULT 0');
    console.log('paid column added successfully');
  } catch (e) {
    if (e.message && e.message.includes('duplicate column')) {
      console.log('Column already exists');
    } else {
      console.log('Error:', e.message);
    }
  } finally {
    await p.$disconnect();
  }
}

main();
