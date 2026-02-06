const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkER01() {
  try {
    const booking = await prisma.booking.findFirst({
      where: { bookingNumber: 'ER-01' },
      include: { tourists: true }
    });

    console.log(`ER-01: ${booking.tourists.length} tourists`);
    console.log('\nAccommodation breakdown:');

    const uzb = booking.tourists.filter(t => !(t.accommodation || '').toLowerCase().includes('turkmen'));
    const tkm = booking.tourists.filter(t => (t.accommodation || '').toLowerCase().includes('turkmen'));

    console.log(`  Uzbekistan: ${uzb.length} tourists`);
    console.log(`  Turkmenistan: ${tkm.length} tourists`);

    console.log('\nTourist details:');
    booking.tourists.forEach((t, i) => {
      console.log(`  ${i+1}. ${t.name} - accommodation: '${t.accommodation || 'not set'}'`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkER01();
