const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Migrating ticket status fields...\n');

  // Get all bookings
  const bookings = await prisma.booking.findMany({
    select: {
      id: true,
      bookingNumber: true,
      trainTickets: true,
      avia: true
    }
  });

  console.log(`Found ${bookings.length} bookings to process\n`);

  let updatedCount = 0;

  for (const booking of bookings) {
    let newTrainTickets = booking.trainTickets;
    let newAvia = booking.avia;
    let needsUpdate = false;

    // Convert trainTickets
    if (booking.trainTickets) {
      const lowerValue = booking.trainTickets.toLowerCase();
      if (lowerValue === 'оформлено' || lowerValue === 'ok' || lowerValue === 'done' || lowerValue === 'completed') {
        newTrainTickets = 'Оформлено';
        needsUpdate = true;
      } else if (lowerValue === 'не оформлено' || lowerValue === 'pending' || lowerValue === 'tbd') {
        newTrainTickets = 'Не оформлено';
        needsUpdate = true;
      } else if (booking.trainTickets && booking.trainTickets !== 'Оформлено' && booking.trainTickets !== 'Не оформлено') {
        // If there's text content (like route info), assume tickets are issued
        newTrainTickets = 'Оформлено';
        needsUpdate = true;
      }
    } else {
      newTrainTickets = 'Не оформлено';
      needsUpdate = true;
    }

    // Convert avia
    if (booking.avia) {
      const lowerValue = booking.avia.toLowerCase();
      if (lowerValue === 'оформлено' || lowerValue === 'ok' || lowerValue === 'done' || lowerValue === 'completed') {
        newAvia = 'Оформлено';
        needsUpdate = true;
      } else if (lowerValue === 'не оформлено' || lowerValue === 'pending' || lowerValue === 'tbd') {
        newAvia = 'Не оформлено';
        needsUpdate = true;
      } else if (booking.avia && booking.avia !== 'Оформлено' && booking.avia !== 'Не оформлено') {
        // If there's text content, assume tickets are issued
        newAvia = 'Оформлено';
        needsUpdate = true;
      }
    } else {
      newAvia = 'Не оформлено';
      needsUpdate = true;
    }

    if (needsUpdate) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          trainTickets: newTrainTickets,
          avia: newAvia
        }
      });

      console.log(`✅ ${booking.bookingNumber}:`);
      console.log(`   ЖД билеты: "${booking.trainTickets || '(пусто)'}" → "${newTrainTickets}"`);
      console.log(`   Авиабилеты: "${booking.avia || '(пусто)'}" → "${newAvia}"`);
      updatedCount++;
    }
  }

  console.log(`\n🎉 Migration complete! Updated ${updatedCount} bookings.`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
