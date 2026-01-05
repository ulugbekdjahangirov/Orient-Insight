const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Country name mapping from English to Russian
const countryMapping = {
  'Germany': 'Германия',
  'Austria': 'Австрия',
  'Switzerland': 'Швейцария',
  'France': 'Франция',
  'Italy': 'Италия',
  'Spain': 'Испания',
  'United Kingdom': 'Великобритания',
  'UK': 'Великобритания',
  'USA': 'США',
  'United States': 'США',
  'Netherlands': 'Нидерланды',
  'Belgium': 'Бельгия',
  'Poland': 'Польша',
  'Czech Republic': 'Чехия',
  'Czechia': 'Чехия',
  'Sweden': 'Швеция',
  'Norway': 'Норвегия',
  'Denmark': 'Дания',
  'Finland': 'Финляндия',
  'Portugal': 'Португалия',
  'Greece': 'Греция',
  'Ireland': 'Ирландия',
  'Luxembourg': 'Люксембург',
  'Australia': 'Австралия',
  'New Zealand': 'Новая Зеландия',
  'Canada': 'Канада',
  'Japan': 'Япония',
  'South Korea': 'Южная Корея',
  'Korea': 'Южная Корея',
  'China': 'Китай',
  'India': 'Индия',
  'Brazil': 'Бразилия',
  'Mexico': 'Мексика',
  'Argentina': 'Аргентина',
  'Russia': 'Россия',
  'Ukraine': 'Украина',
  'Kazakhstan': 'Казахстан',
  'Uzbekistan': 'Узбекистан',
  'Turkmenistan': 'Туркменистан',
  'Tajikistan': 'Таджикистан',
  'Kyrgyzstan': 'Кыргызстан',
  'Azerbaijan': 'Азербайджан',
  'Georgia': 'Грузия',
  'Armenia': 'Армения',
  'Turkey': 'Турция',
  'Israel': 'Израиль',
  'UAE': 'ОАЭ',
  'Saudi Arabia': 'Саудовская Аравия',
  'Egypt': 'Египет',
  'South Africa': 'ЮАР',
  'Singapore': 'Сингапур',
  'Malaysia': 'Малайзия',
  'Thailand': 'Таиланд',
  'Indonesia': 'Индонезия',
  'Philippines': 'Филиппины',
  'Vietnam': 'Вьетнам'
};

async function main() {
  console.log('🔄 Migrating country names to Russian...\n');

  const bookings = await prisma.booking.findMany({
    select: {
      id: true,
      bookingNumber: true,
      country: true
    }
  });

  console.log(`Found ${bookings.length} bookings to process\n`);

  let updatedCount = 0;

  for (const booking of bookings) {
    if (!booking.country) continue;

    // Check if already in Russian (by checking if it matches a Russian name in our list)
    const russianNames = Object.values(countryMapping);
    if (russianNames.includes(booking.country)) {
      continue; // Already in Russian
    }

    // Try to find mapping
    const russianName = countryMapping[booking.country];

    if (russianName) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { country: russianName }
      });

      console.log(`✅ ${booking.bookingNumber}: "${booking.country}" → "${russianName}"`);
      updatedCount++;
    } else if (booking.country) {
      console.log(`⚠️  ${booking.bookingNumber}: Unknown country "${booking.country}" - skipped`);
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
