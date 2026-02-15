/**
 * Arien Plaza Accommodation Fix Script
 *
 * Bu script Arien Plaza hotelining barcha accommodation larini topib,
 * totalCost, totalGuests, totalRooms ni NULL ga o'zgartiradi.
 *
 * Bu tizimni Rooming List dan qayta hisoblashga majbur qiladi.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixArienPlaza() {
  console.log('🔍 Arien Plaza ni qidiryapman...\n');

  try {
    // 1. Arien Plaza hotelini topish
    const arienPlaza = await prisma.hotel.findFirst({
      where: {
        name: {
          contains: 'Arien'
        }
      },
      include: {
        city: true
      }
    });

    if (!arienPlaza) {
      console.log('❌ Arien Plaza hotel topilmadi!');
      return;
    }

    console.log('✅ Hotel topildi:');
    console.log(`   ID: ${arienPlaza.id}`);
    console.log(`   Nomi: ${arienPlaza.name}`);
    console.log(`   Shahar: ${arienPlaza.city?.name || 'N/A'}`);
    console.log('');

    // 2. Bu hotelga tegishli barcha accommodation larni topish
    const accommodations = await prisma.accommodation.findMany({
      where: {
        hotelId: arienPlaza.id
      },
      include: {
        booking: {
          select: {
            id: true,
            bookingNumber: true,
            arrivalDate: true,
            departureDate: true
          }
        }
      }
    });

    if (accommodations.length === 0) {
      console.log('⚠️  Bu hotel uchun accommodation topilmadi.');
      return;
    }

    console.log(`📋 Topilgan accommodation lar: ${accommodations.length} ta\n`);

    // 3. Har bir accommodation ni ko'rsatish
    accommodations.forEach((acc, index) => {
      console.log(`${index + 1}. Accommodation ID: ${acc.id}`);
      console.log(`   Booking: ${acc.booking.bookingNumber}`);
      console.log(`   Sanalar: ${acc.checkInDate} → ${acc.checkOutDate}`);
      console.log(`   Kechalar: ${acc.nights}`);
      console.log(`   Current totalCost: ${acc.totalCost || 'NULL'}`);
      console.log(`   Current totalGuests: ${acc.totalGuests || 'NULL'}`);
      console.log(`   Current totalRooms: ${acc.totalRooms || 'NULL'}`);
      console.log('');
    });

    // 4. Foydalanuvchidan tasdiqlash (auto-confirm for script)
    console.log('🔧 TUZATISH BOSHLANDI...\n');

    // 5. Barcha accommodation larni yangilash
    let updatedCount = 0;

    for (const acc of accommodations) {
      const result = await prisma.accommodation.update({
        where: {
          id: acc.id
        },
        data: {
          totalCost: 0,
          totalGuests: 0,
          totalRooms: 0
        }
      });

      console.log(`✅ Yangilandi: Accommodation ID ${result.id}`);
      console.log(`   totalCost: ${acc.totalCost} → 0`);
      console.log(`   totalGuests: ${acc.totalGuests} → 0`);
      console.log(`   totalRooms: ${acc.totalRooms} → 0`);
      console.log('');

      updatedCount++;
    }

    console.log('═══════════════════════════════════════════════════');
    console.log(`✅ MUVAFFAQIYAT!`);
    console.log(`   ${updatedCount} ta accommodation yangilandi.`);
    console.log('═══════════════════════════════════════════════════');
    console.log('');
    console.log('📌 KEYINGI QADAM:');
    console.log('   1. Browser da Arien Plaza hotelini ochib, sahifani refresh qiling');
    console.log('   2. Console da "usedRoomingList: YES ✓" ni tekshiring');
    console.log('   3. Total Cost va Total Guests to\'g\'ri hisoblangan bo\'lishi kerak');
    console.log('');
    console.log('📊 KUTILAYOTGAN NATIJA:');
    console.log('   - usedRoomingList: YES ✓');
    console.log('   - totalGuests: 11 (8 emas!)');
    console.log('   - totalCost: ~11,130,000 so\'m (9,506,400 emas!)');
    console.log('');

  } catch (error) {
    console.error('❌ Xatolik:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Script ni ishga tushirish
fixArienPlaza();
