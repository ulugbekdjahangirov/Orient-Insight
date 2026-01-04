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

  console.log('\n🎉 База данных заполнена успешно!');
  console.log('\n📋 Данные для входа:');
  console.log('   Админ: admin@orientinsight.uz / admin123');
  console.log('   Менеджер: manager@orientinsight.uz / manager123');
}

main()
  .catch((e) => {
    console.error('❌ Ошибка:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
