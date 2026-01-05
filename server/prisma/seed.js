const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Начинаем заполнение базы данных...');

  // Создаём администратора
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@orientinsight.uz' },
    update: {},
    create: {
      email: 'admin@orientinsight.uz',
      password: adminPassword,
      name: 'Администратор',
      role: 'ADMIN'
    }
  });
  console.log('✅ Создан администратор:', admin.email);

  // Создаём менеджера
  const managerPassword = await bcrypt.hash('manager123', 10);
  const manager = await prisma.user.upsert({
    where: { email: 'manager@orientinsight.uz' },
    update: {},
    create: {
      email: 'manager@orientinsight.uz',
      password: managerPassword,
      name: 'Менеджер',
      role: 'MANAGER'
    }
  });
  console.log('✅ Создан менеджер:', manager.email);

  // Создаём типы туров
  const tourTypes = [
    { code: 'ER', name: 'Тур ER (Узбекистан-Туркменистан)', color: '#3B82F6', description: 'Комбинированный тур по Узбекистану и Туркменистану' },
    { code: 'CO', name: 'Тур CO (Классический)', color: '#10B981', description: 'Классический тур по Узбекистану' },
    { code: 'KAS', name: 'Тур KAS (Кашкадарья)', color: '#F59E0B', description: 'Тур по Кашкадарьинской области' },
    { code: 'ZA', name: 'Тур ZA (Заамин)', color: '#8B5CF6', description: 'Горный тур в Заамин' }
  ];

  for (const tourType of tourTypes) {
    await prisma.tourType.upsert({
      where: { code: tourType.code },
      update: tourType,
      create: tourType
    });
    console.log('✅ Создан тип тура:', tourType.code);
  }

  // Создаём типы размещения (глобальный справочник)
  const accommodationRoomTypes = [
    { code: 'SNGL', name: 'Single', description: 'Одноместный номер', maxGuests: 1, sortOrder: 1 },
    { code: 'DBL', name: 'Double', description: 'Двухместный номер с одной кроватью', maxGuests: 2, sortOrder: 2 },
    { code: 'TWN', name: 'Twin', description: 'Двухместный номер с двумя кроватями', maxGuests: 2, sortOrder: 3 },
    { code: 'TRPL', name: 'Triple', description: 'Трёхместный номер', maxGuests: 3, sortOrder: 4 },
    { code: 'QDPL', name: 'Quadruple', description: 'Четырёхместный номер', maxGuests: 4, sortOrder: 5 },
    { code: 'SUITE', name: 'Suite', description: 'Люкс', maxGuests: 2, sortOrder: 6 },
    { code: 'EXTRA', name: 'Extra Bed', description: 'Дополнительная кровать', maxGuests: 1, sortOrder: 7 }
  ];

  for (const roomType of accommodationRoomTypes) {
    await prisma.accommodationRoomType.upsert({
      where: { code: roomType.code },
      update: roomType,
      create: roomType
    });
    console.log('✅ Создан тип размещения:', roomType.code);
  }

  // Создаём гидов
  const guides = [
    { name: 'Zokir', phone: '+998901234567' },
    { name: 'Avaz aka', phone: '+998901234568' },
    { name: 'Siroj', phone: '+998901234569' },
    { name: 'Ulugbek', phone: '+998901234570' }
  ];

  for (const guide of guides) {
    await prisma.guide.upsert({
      where: { name: guide.name },
      update: guide,
      create: guide
    });
    console.log('✅ Создан гид:', guide.name);
  }

  // Создаём города
  const cities = [
    { name: 'Ташкент', nameEn: 'Tashkent', sortOrder: 1 },
    { name: 'Самарканд', nameEn: 'Samarkand', sortOrder: 2 },
    { name: 'Бухара', nameEn: 'Bukhara', sortOrder: 3 },
    { name: 'Хива', nameEn: 'Khiva', sortOrder: 4 },
    { name: 'Ургенч', nameEn: 'Urgench', sortOrder: 5 },
    { name: 'Шахрисабз', nameEn: 'Shakhrisabz', sortOrder: 6 },
    { name: 'Нукус', nameEn: 'Nukus', sortOrder: 7 },
    { name: 'Фергана', nameEn: 'Fergana', sortOrder: 8 }
  ];

  const createdCities = {};
  for (const city of cities) {
    const created = await prisma.city.upsert({
      where: { name: city.name },
      update: city,
      create: city
    });
    createdCities[city.name] = created.id;
    console.log('✅ Создан город:', city.name);
  }

  // Создаём отели
  const hotels = [
    // Ташкент
    {
      name: 'Hyatt Regency Tashkent',
      cityName: 'Ташкент',
      address: 'ул. Навои, 1А',
      phone: '+998 71 207 12 34',
      email: 'tashkent.regency@hyatt.com',
      stars: 5,
      description: 'Роскошный 5-звёздочный отель в центре Ташкента',
      roomTypes: [
        { name: 'SNGL', displayName: 'Standard Single', roomCount: 30, pricePerNight: 180, maxGuests: 1 },
        { name: 'DBL', displayName: 'Standard Double', roomCount: 50, pricePerNight: 220, maxGuests: 2 },
        { name: 'TWN', displayName: 'Twin Room', roomCount: 40, pricePerNight: 220, maxGuests: 2 },
        { name: 'Suite', displayName: 'Executive Suite', roomCount: 15, pricePerNight: 450, maxGuests: 3 }
      ]
    },
    {
      name: 'Hilton Tashkent City',
      cityName: 'Ташкент',
      address: 'ул. Тараккиёт, 2',
      phone: '+998 71 140 00 00',
      email: 'info@hiltontashkent.com',
      stars: 5,
      description: 'Современный бизнес-отель с панорамным видом на город',
      roomTypes: [
        { name: 'SNGL', displayName: 'King Guest Room', roomCount: 25, pricePerNight: 170, maxGuests: 1 },
        { name: 'DBL', displayName: 'King Deluxe', roomCount: 45, pricePerNight: 210, maxGuests: 2 },
        { name: 'TWN', displayName: 'Twin Deluxe', roomCount: 35, pricePerNight: 210, maxGuests: 2 },
        { name: 'Suite', displayName: 'Junior Suite', roomCount: 12, pricePerNight: 380, maxGuests: 2 }
      ]
    },
    {
      name: 'Hotel Uzbekistan',
      cityName: 'Ташкент',
      address: 'ул. Мустакиллик, 45',
      phone: '+998 71 233 00 00',
      email: 'info@hoteluzbekistan.uz',
      stars: 4,
      description: 'Историческая гостиница с видом на площадь Мустакиллик',
      roomTypes: [
        { name: 'SNGL', displayName: 'Standard Single', roomCount: 40, pricePerNight: 85, maxGuests: 1 },
        { name: 'DBL', displayName: 'Standard Double', roomCount: 60, pricePerNight: 110, maxGuests: 2 },
        { name: 'TWN', displayName: 'Standard Twin', roomCount: 50, pricePerNight: 110, maxGuests: 2 },
        { name: 'Suite', displayName: 'Luxe Suite', roomCount: 10, pricePerNight: 200, maxGuests: 3 }
      ]
    },
    // Самарканд
    {
      name: 'Movenpick Hotel Samarkand',
      cityName: 'Самарканд',
      address: 'ул. Бустон Сарой, 1',
      phone: '+998 66 233 50 50',
      email: 'hotel.samarkand@movenpick.com',
      stars: 5,
      description: 'Премиальный отель рядом с площадью Регистан',
      roomTypes: [
        { name: 'SNGL', displayName: 'Superior Single', roomCount: 20, pricePerNight: 160, maxGuests: 1 },
        { name: 'DBL', displayName: 'Superior Double', roomCount: 35, pricePerNight: 200, maxGuests: 2 },
        { name: 'TWN', displayName: 'Superior Twin', roomCount: 30, pricePerNight: 200, maxGuests: 2 },
        { name: 'Suite', displayName: 'Registan Suite', roomCount: 8, pricePerNight: 380, maxGuests: 3 }
      ]
    },
    {
      name: 'Hotel Zilol Baxt',
      cityName: 'Самарканд',
      address: 'ул. Махмуда Кошгари, 12',
      phone: '+998 66 233 15 15',
      email: 'info@zilolbaxt.uz',
      stars: 4,
      description: 'Уютный отель в историческом центре города',
      roomTypes: [
        { name: 'SNGL', displayName: 'Standard Single', roomCount: 15, pricePerNight: 70, maxGuests: 1 },
        { name: 'DBL', displayName: 'Standard Double', roomCount: 25, pricePerNight: 95, maxGuests: 2 },
        { name: 'TWN', displayName: 'Standard Twin', roomCount: 20, pricePerNight: 95, maxGuests: 2 },
        { name: 'TRPL', displayName: 'Triple Room', roomCount: 10, pricePerNight: 120, maxGuests: 3 }
      ]
    },
    {
      name: 'Emirkhan Hotel',
      cityName: 'Самарканд',
      address: 'ул. Регистан, 5',
      phone: '+998 66 233 20 20',
      email: 'emirkhan@hotel.uz',
      stars: 3,
      description: 'Бюджетный отель в шаговой доступности от Регистана',
      roomTypes: [
        { name: 'SNGL', displayName: 'Economy Single', roomCount: 20, pricePerNight: 45, maxGuests: 1 },
        { name: 'DBL', displayName: 'Economy Double', roomCount: 30, pricePerNight: 65, maxGuests: 2 },
        { name: 'TWN', displayName: 'Economy Twin', roomCount: 25, pricePerNight: 65, maxGuests: 2 }
      ]
    },
    // Бухара
    {
      name: 'Hotel Minorai Kalon',
      cityName: 'Бухара',
      address: 'ул. Хакикат, 1',
      phone: '+998 65 224 02 02',
      email: 'info@minoraikalonhotel.com',
      stars: 4,
      description: 'Бутик-отель с видом на минарет Калян',
      roomTypes: [
        { name: 'SNGL', displayName: 'Standard Single', roomCount: 12, pricePerNight: 80, maxGuests: 1 },
        { name: 'DBL', displayName: 'Standard Double', roomCount: 20, pricePerNight: 100, maxGuests: 2 },
        { name: 'TWN', displayName: 'Standard Twin', roomCount: 18, pricePerNight: 100, maxGuests: 2 },
        { name: 'Suite', displayName: 'Kalon Suite', roomCount: 5, pricePerNight: 180, maxGuests: 2 }
      ]
    },
    {
      name: 'Lyabi House Hotel',
      cityName: 'Бухара',
      address: 'ул. Накшбанди, 7',
      phone: '+998 65 224 10 10',
      email: 'lyabihouse@mail.uz',
      stars: 3,
      description: 'Традиционный отель у пруда Ляби-Хауз',
      roomTypes: [
        { name: 'SNGL', displayName: 'Cozy Single', roomCount: 10, pricePerNight: 50, maxGuests: 1 },
        { name: 'DBL', displayName: 'Cozy Double', roomCount: 15, pricePerNight: 70, maxGuests: 2 },
        { name: 'TWN', displayName: 'Cozy Twin', roomCount: 12, pricePerNight: 70, maxGuests: 2 }
      ]
    },
    {
      name: 'Amelia Boutique Hotel',
      cityName: 'Бухара',
      address: 'ул. Бахоуддин Накшбанд, 45',
      phone: '+998 65 221 00 00',
      email: 'amelia@boutiquehotel.uz',
      stars: 4,
      description: 'Современный бутик-отель с национальным колоритом',
      roomTypes: [
        { name: 'SNGL', displayName: 'Deluxe Single', roomCount: 8, pricePerNight: 90, maxGuests: 1 },
        { name: 'DBL', displayName: 'Deluxe Double', roomCount: 16, pricePerNight: 120, maxGuests: 2 },
        { name: 'TWN', displayName: 'Deluxe Twin', roomCount: 14, pricePerNight: 120, maxGuests: 2 },
        { name: 'Suite', displayName: 'Royal Suite', roomCount: 4, pricePerNight: 220, maxGuests: 3 }
      ]
    },
    // Хива
    {
      name: 'Hotel Khiva Palace',
      cityName: 'Хива',
      address: 'ул. Палван Махмуд, 1',
      phone: '+998 62 375 70 70',
      email: 'info@khivapalace.uz',
      stars: 4,
      description: 'Отель в стенах древнего Ичан-Калы',
      roomTypes: [
        { name: 'SNGL', displayName: 'Heritage Single', roomCount: 10, pricePerNight: 75, maxGuests: 1 },
        { name: 'DBL', displayName: 'Heritage Double', roomCount: 18, pricePerNight: 95, maxGuests: 2 },
        { name: 'TWN', displayName: 'Heritage Twin', roomCount: 15, pricePerNight: 95, maxGuests: 2 },
        { name: 'Suite', displayName: 'Khan Suite', roomCount: 3, pricePerNight: 170, maxGuests: 2 }
      ]
    },
    {
      name: 'Orient Star Khiva',
      cityName: 'Хива',
      address: 'ул. Пахлавон Махмуд, 15',
      phone: '+998 62 375 55 55',
      email: 'khiva@orientstar.uz',
      stars: 3,
      description: 'Уютная гостиница в историческом медресе',
      roomTypes: [
        { name: 'SNGL', displayName: 'Standard Single', roomCount: 12, pricePerNight: 55, maxGuests: 1 },
        { name: 'DBL', displayName: 'Standard Double', roomCount: 20, pricePerNight: 75, maxGuests: 2 },
        { name: 'TWN', displayName: 'Standard Twin', roomCount: 16, pricePerNight: 75, maxGuests: 2 }
      ]
    },
    // Ургенч
    {
      name: 'Hotel Khorezm Palace',
      cityName: 'Ургенч',
      address: 'ул. Аль-Хорезми, 28',
      phone: '+998 62 224 50 50',
      email: 'khorezm@palace.uz',
      stars: 4,
      description: 'Современный отель в Ургенче',
      roomTypes: [
        { name: 'SNGL', displayName: 'Standard Single', roomCount: 20, pricePerNight: 65, maxGuests: 1 },
        { name: 'DBL', displayName: 'Standard Double', roomCount: 30, pricePerNight: 85, maxGuests: 2 },
        { name: 'TWN', displayName: 'Standard Twin', roomCount: 25, pricePerNight: 85, maxGuests: 2 }
      ]
    },
    // Шахрисабз
    {
      name: 'Hotel Shakhrisabz',
      cityName: 'Шахрисабз',
      address: 'ул. Ипак Йўли, 10',
      phone: '+998 75 522 10 10',
      email: 'info@hotelshakhrisabz.uz',
      stars: 3,
      description: 'Отель на родине Амира Тимура',
      roomTypes: [
        { name: 'SNGL', displayName: 'Standard Single', roomCount: 15, pricePerNight: 45, maxGuests: 1 },
        { name: 'DBL', displayName: 'Standard Double', roomCount: 25, pricePerNight: 60, maxGuests: 2 },
        { name: 'TWN', displayName: 'Standard Twin', roomCount: 20, pricePerNight: 60, maxGuests: 2 }
      ]
    },
    // Нукус
    {
      name: 'Hotel Jipek Joli',
      cityName: 'Нукус',
      address: 'ул. Каракалпакстан, 5',
      phone: '+998 61 222 50 50',
      email: 'jipekjoli@hotel.uz',
      stars: 3,
      description: 'Лучший отель в Нукусе рядом с музеем Савицкого',
      roomTypes: [
        { name: 'SNGL', displayName: 'Standard Single', roomCount: 18, pricePerNight: 50, maxGuests: 1 },
        { name: 'DBL', displayName: 'Standard Double', roomCount: 25, pricePerNight: 70, maxGuests: 2 },
        { name: 'TWN', displayName: 'Standard Twin', roomCount: 20, pricePerNight: 70, maxGuests: 2 }
      ]
    },
    // Фергана
    {
      name: 'Asia Fergana Hotel',
      cityName: 'Фергана',
      address: 'ул. Мустакиллик, 29',
      phone: '+998 73 244 00 00',
      email: 'asia@ferganahotel.uz',
      stars: 4,
      description: 'Современный отель в центре Ферганской долины',
      roomTypes: [
        { name: 'SNGL', displayName: 'Standard Single', roomCount: 20, pricePerNight: 60, maxGuests: 1 },
        { name: 'DBL', displayName: 'Standard Double', roomCount: 35, pricePerNight: 80, maxGuests: 2 },
        { name: 'TWN', displayName: 'Standard Twin', roomCount: 30, pricePerNight: 80, maxGuests: 2 },
        { name: 'Suite', displayName: 'Silk Road Suite', roomCount: 5, pricePerNight: 150, maxGuests: 3 }
      ]
    }
  ];

  for (const hotelData of hotels) {
    const { roomTypes, cityName, ...hotel } = hotelData;
    const cityId = createdCities[cityName];

    // Проверяем существование отеля
    const existingHotel = await prisma.hotel.findFirst({
      where: { name: hotel.name, cityId }
    });

    let createdHotel;
    if (existingHotel) {
      createdHotel = await prisma.hotel.update({
        where: { id: existingHotel.id },
        data: hotel
      });
    } else {
      createdHotel = await prisma.hotel.create({
        data: { ...hotel, cityId }
      });
    }
    console.log('✅ Создан отель:', hotel.name);

    // Создаём типы номеров
    for (const roomType of roomTypes) {
      const existingRoom = await prisma.roomType.findFirst({
        where: { hotelId: createdHotel.id, name: roomType.name }
      });

      if (existingRoom) {
        await prisma.roomType.update({
          where: { id: existingRoom.id },
          data: roomType
        });
      } else {
        await prisma.roomType.create({
          data: { ...roomType, hotelId: createdHotel.id }
        });
      }
    }
    console.log(`   📦 Добавлено ${roomTypes.length} типов номеров`);
  }

  console.log('\n🎉 База данных заполнена успешно!');
  console.log('\n📋 Данные для входа:');
  console.log('   Админ: admin@orientinsight.uz / admin123');
  console.log('   Менеджер: manager@orientinsight.uz / manager123');
  console.log('\n🏨 Добавлено отелей:', hotels.length);
  console.log('🌆 Добавлено городов:', cities.length);
}

main()
  .catch((e) => {
    console.error('❌ Ошибка:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
