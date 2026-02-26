const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const hotel = await prisma.hotel.findFirst({ where: { name: { contains: 'OLD' } } });
  console.log('Hotel:', JSON.stringify(hotel));
  if (!hotel) { await prisma.$disconnect(); return; }

  const state = await prisma.systemSetting.findUnique({ where: { key: 'JP_STATE_2026_CO' } });
  if (state) {
    const data = JSON.parse(state.value);
    const prefix = hotel.id + '_';
    const before = Object.keys(data.statuses || {}).length;
    data.statuses = Object.fromEntries(
      Object.entries(data.statuses || {}).filter(([k]) => !k.startsWith(prefix))
    );
    const after = Object.keys(data.statuses).length;
    console.log('Removed statuses:', before - after);
    await prisma.systemSetting.update({
      where: { key: 'JP_STATE_2026_CO' },
      data: { value: JSON.stringify(data) }
    });
    console.log('Done.');
  }
  await prisma.$disconnect();
}
main().catch(console.error);
