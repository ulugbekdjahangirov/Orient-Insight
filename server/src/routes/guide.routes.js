const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');
const {
  encryptGuideData,
  decryptGuideData,
  maskGuideData,
  checkPassportExpiry
} = require('../utils/crypto');

const router = express.Router();
const prisma = new PrismaClient();

// Поля, которые могут видеть все пользователи
const publicFields = {
  id: true,
  name: true,
  firstName: true,
  lastName: true,
  dateOfBirth: true,
  phone: true,
  email: true,
  address: true,
  notes: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  passportExpiryDate: true, // Для предупреждений
};

// Конфиденциальные поля (только для админа)
const sensitiveFields = {
  passportNumber: true,
  passportIssueDate: true,
  passportIssuedBy: true,
  bankAccountNumber: true,
  bankCardNumber: true,
  bankName: true,
};

// GET /api/guides - Получить список гидов
router.get('/', authenticate, async (req, res) => {
  try {
    const { includeInactive, withAlerts } = req.query;
    const isAdmin = req.user.role === 'ADMIN';

    const where = includeInactive === 'true' ? {} : { isActive: true };

    const guides = await prisma.guide.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { bookings: true, guidePayments: true } }
      }
    });

    // Обрабатываем данные в зависимости от роли
    const processedGuides = guides.map(guide => {
      let processedGuide;

      if (isAdmin) {
        // Админ видит расшифрованные данные
        processedGuide = decryptGuideData(guide);
      } else {
        // Менеджер видит замаскированные данные
        processedGuide = maskGuideData(guide);
      }

      // Добавляем информацию о сроке действия паспорта
      const passportStatus = checkPassportExpiry(guide.passportExpiryDate);
      processedGuide.passportStatus = passportStatus;

      return processedGuide;
    });

    // Если запрошены только гиды с предупреждениями
    if (withAlerts === 'true') {
      const alertGuides = processedGuides.filter(
        g => g.passportStatus.isExpired || g.passportStatus.isExpiringSoon
      );
      return res.json({ guides: alertGuides });
    }

    res.json({ guides: processedGuides });
  } catch (error) {
    console.error('Get guides error:', error);
    res.status(500).json({ error: 'Ошибка получения списка гидов' });
  }
});

// GET /api/guides/alerts - Получить предупреждения о паспортах
router.get('/alerts', authenticate, async (req, res) => {
  try {
    const guides = await prisma.guide.findMany({
      where: {
        isActive: true,
        passportExpiryDate: { not: null }
      },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        passportExpiryDate: true
      }
    });

    const alerts = guides
      .map(guide => {
        const status = checkPassportExpiry(guide.passportExpiryDate);
        return {
          ...guide,
          passportStatus: status
        };
      })
      .filter(g => g.passportStatus.isExpired || g.passportStatus.isExpiringSoon)
      .sort((a, b) => a.passportStatus.daysLeft - b.passportStatus.daysLeft);

    res.json({
      alerts,
      expiredCount: alerts.filter(a => a.passportStatus.isExpired).length,
      expiringSoonCount: alerts.filter(a => a.passportStatus.isExpiringSoon).length
    });
  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({ error: 'Ошибка получения предупреждений' });
  }
});

// GET /api/guides/:id - Получить гида по ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user.role === 'ADMIN';

    const guide = await prisma.guide.findUnique({
      where: { id: parseInt(id) },
      include: {
        bookings: {
          orderBy: { departureDate: 'asc' },
          take: 20,
          select: {
            id: true,
            bookingNumber: true,
            departureDate: true,
            arrivalDate: true,
            endDate: true,
            pax: true,
            paxUzbekistan: true,
            paxTurkmenistan: true,
            tourType: { select: { code: true, name: true, color: true } }
          }
        },
        guidePayments: {
          orderBy: { paymentDate: 'desc' },
          take: 10
        },
        _count: { select: { bookings: true, guidePayments: true } }
      }
    });

    if (!guide) {
      return res.status(404).json({ error: 'Гид не найден' });
    }

    let processedGuide;
    if (isAdmin) {
      processedGuide = decryptGuideData(guide);
    } else {
      processedGuide = maskGuideData(guide);
      // Скрываем платежи от менеджеров
      processedGuide.guidePayments = [];
    }

    // Добавляем статус паспорта
    processedGuide.passportStatus = checkPassportExpiry(guide.passportExpiryDate);

    res.json({ guide: processedGuide });
  } catch (error) {
    console.error('Get guide error:', error);
    res.status(500).json({ error: 'Ошибка получения данных гида' });
  }
});

// POST /api/guides - Создать гида (только админ)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const {
      name,
      firstName,
      lastName,
      dateOfBirth,
      phone,
      email,
      passportNumber,
      passportIssueDate,
      passportExpiryDate,
      passportIssuedBy,
      bankAccountNumber,
      bankCardNumber,
      bankName,
      mfo,
      address,
      notes,
      dayRate,
      halfDayRate,
      city,
      cityRate
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Имя гида обязательно' });
    }

    // Проверяем уникальность имени
    const existing = await prisma.guide.findUnique({ where: { name } });
    if (existing) {
      return res.status(400).json({ error: 'Гид с таким именем уже существует' });
    }

    // Шифруем конфиденциальные данные
    const encryptedData = encryptGuideData({
      passportNumber,
      bankAccountNumber,
      bankCardNumber
    });

    const guide = await prisma.guide.create({
      data: {
        name,
        firstName,
        lastName,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        phone,
        email,
        passportNumber: encryptedData.passportNumber,
        passportIssueDate: passportIssueDate ? new Date(passportIssueDate) : null,
        passportExpiryDate: passportExpiryDate ? new Date(passportExpiryDate) : null,
        passportIssuedBy,
        bankAccountNumber: encryptedData.bankAccountNumber,
        bankCardNumber: encryptedData.bankCardNumber,
        bankName,
        mfo,
        address,
        notes,
        dayRate: dayRate ? parseFloat(dayRate) : 110,
        halfDayRate: halfDayRate ? parseFloat(halfDayRate) : 55,
        city: city || null,
        cityRate: cityRate ? parseFloat(cityRate) : 0
      }
    });

    // Возвращаем расшифрованные данные админу
    const responseGuide = decryptGuideData(guide);
    responseGuide.passportStatus = checkPassportExpiry(guide.passportExpiryDate);

    res.status(201).json({ guide: responseGuide });
  } catch (error) {
    console.error('Create guide error:', error);
    res.status(500).json({ error: 'Ошибка создания гида' });
  }
});

// PUT /api/guides/:id - Обновить гида (только админ для конфиденциальных данных)
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user.role === 'ADMIN';

    console.log('📝 Updating guide:', id);
    console.log('📦 Request body:', req.body);

    const {
      name,
      firstName,
      lastName,
      dateOfBirth,
      phone,
      email,
      passportNumber,
      passportIssueDate,
      passportExpiryDate,
      passportIssuedBy,
      bankAccountNumber,
      bankCardNumber,
      bankName,
      mfo,
      address,
      notes,
      isActive,
      dayRate,
      halfDayRate,
      city,
      cityRate
    } = req.body;

    // Базовые поля могут редактировать все авторизованные
    const updateData = {};

    if (name !== undefined) updateData.name = name;
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (address !== undefined) updateData.address = address;
    if (notes !== undefined) updateData.notes = notes;
    if (typeof isActive === 'boolean') updateData.isActive = isActive;
    if (dayRate !== undefined) updateData.dayRate = parseFloat(dayRate);
    if (halfDayRate !== undefined) updateData.halfDayRate = parseFloat(halfDayRate);
    if (city !== undefined) updateData.city = city;
    if (cityRate !== undefined) updateData.cityRate = parseFloat(cityRate);

    console.log('💾 Update data prepared:', updateData);

    // Конфиденциальные поля - только для админа
    if (isAdmin) {
      if (passportNumber !== undefined) {
        updateData.passportNumber = passportNumber ? encryptGuideData({ passportNumber }).passportNumber : null;
      }
      if (passportIssueDate !== undefined) {
        updateData.passportIssueDate = passportIssueDate ? new Date(passportIssueDate) : null;
      }
      if (passportExpiryDate !== undefined) {
        updateData.passportExpiryDate = passportExpiryDate ? new Date(passportExpiryDate) : null;
      }
      if (passportIssuedBy !== undefined) updateData.passportIssuedBy = passportIssuedBy;
      if (bankAccountNumber !== undefined) {
        updateData.bankAccountNumber = bankAccountNumber ? encryptGuideData({ bankAccountNumber }).bankAccountNumber : null;
      }
      if (bankCardNumber !== undefined) {
        updateData.bankCardNumber = bankCardNumber ? encryptGuideData({ bankCardNumber }).bankCardNumber : null;
      }
      if (bankName !== undefined) updateData.bankName = bankName;
      if (mfo !== undefined) updateData.mfo = mfo;
    }

    const guide = await prisma.guide.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        _count: { select: { bookings: true } }
      }
    });

    let responseGuide;
    if (isAdmin) {
      responseGuide = decryptGuideData(guide);
    } else {
      responseGuide = maskGuideData(guide);
    }
    responseGuide.passportStatus = checkPassportExpiry(guide.passportExpiryDate);

    res.json({ guide: responseGuide });
  } catch (error) {
    console.error('Update guide error:', error);
    res.status(500).json({ error: 'Ошибка обновления гида' });
  }
});

// DELETE /api/guides/:id - Удалить гида (только админ)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Проверяем, есть ли связанные бронирования
    const bookingsCount = await prisma.booking.count({
      where: { guideId: parseInt(id) }
    });

    if (bookingsCount > 0) {
      // Вместо удаления деактивируем
      await prisma.guide.update({
        where: { id: parseInt(id) },
        data: { isActive: false }
      });
      return res.json({ message: 'Гид деактивирован (есть связанные бронирования)' });
    }

    await prisma.guide.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Гид удалён' });
  } catch (error) {
    console.error('Delete guide error:', error);
    res.status(500).json({ error: 'Ошибка удаления гида' });
  }
});

// POST /api/guides/:id/payments - Добавить выплату гиду (только админ)
router.post('/:id/payments', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, currency, paymentDate, paymentType, bookingId, notes } = req.body;

    if (!amount || !paymentDate) {
      return res.status(400).json({ error: 'Сумма и дата обязательны' });
    }

    const payment = await prisma.guidePayment.create({
      data: {
        guideId: parseInt(id),
        amount: parseFloat(amount),
        currency: currency || 'UZS',
        paymentDate: new Date(paymentDate),
        paymentType: paymentType || 'SALARY',
        bookingId: bookingId ? parseInt(bookingId) : null,
        notes
      }
    });

    res.status(201).json({ payment });
  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({ error: 'Ошибка создания выплаты' });
  }
});

// GET /api/guides/:id/payments - Получить выплаты гида (только админ)
router.get('/:id/payments', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { year, month } = req.query;

    const where = { guideId: parseInt(id) };

    if (year) {
      const startDate = new Date(parseInt(year), month ? parseInt(month) - 1 : 0, 1);
      const endDate = new Date(parseInt(year), month ? parseInt(month) : 12, 0);
      where.paymentDate = { gte: startDate, lte: endDate };
    }

    const payments = await prisma.guidePayment.findMany({
      where,
      orderBy: { paymentDate: 'desc' }
    });

    const total = payments.reduce((sum, p) => sum + p.amount, 0);

    res.json({ payments, total });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ error: 'Ошибка получения выплат' });
  }
});

module.exports = router;
