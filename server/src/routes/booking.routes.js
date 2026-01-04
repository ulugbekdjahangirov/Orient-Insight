const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/bookings - Получить список бронирований с фильтрами
router.get('/', authenticate, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      tourTypeId,
      guideId,
      status,
      startDate,
      endDate,
      search,
      sortBy = 'departureDate',
      sortOrder = 'asc'
    } = req.query;

    const where = {};

    // Фильтр по типу тура
    if (tourTypeId) {
      where.tourTypeId = parseInt(tourTypeId);
    }

    // Фильтр по гиду
    if (guideId) {
      where.guideId = parseInt(guideId);
    }

    // Фильтр по статусу
    if (status) {
      where.status = status;
    }

    // Фильтр по дате
    if (startDate || endDate) {
      where.departureDate = {};
      if (startDate) {
        where.departureDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.departureDate.lte = new Date(endDate);
      }
    }

    // Поиск по номеру бронирования
    if (search) {
      where.bookingNumber = { contains: search };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          tourType: { select: { id: true, code: true, name: true, color: true } },
          guide: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } }
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: parseInt(limit)
      }),
      prisma.booking.count({ where })
    ]);

    res.json({
      bookings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ error: 'Ошибка получения бронирований' });
  }
});

// GET /api/bookings/:id - Получить бронирование по ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(id) },
      include: {
        tourType: true,
        guide: true,
        createdBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } }
      }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Бронирование не найдено' });
    }

    res.json({ booking });
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({ error: 'Ошибка получения бронирования' });
  }
});

// POST /api/bookings - Создать бронирование
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      bookingNumber,
      tourTypeId,
      departureDate,
      arrivalDate,
      endDate,
      pax,
      paxUzbekistan,
      paxTurkmenistan,
      guideId,
      trainTickets,
      avia,
      roomsDbl,
      roomsTwn,
      roomsSngl,
      roomsTotal,
      dateOlot,
      dateJartepa,
      dateOybek,
      dateChernyaevka,
      status,
      notes
    } = req.body;

    if (!bookingNumber || !tourTypeId || !departureDate) {
      return res.status(400).json({ error: 'Обязательные поля: номер бронирования, тип тура, дата' });
    }

    // Проверка уникальности номера
    const existing = await prisma.booking.findUnique({ where: { bookingNumber } });
    if (existing) {
      return res.status(400).json({ error: 'Бронирование с таким номером уже существует' });
    }

    const booking = await prisma.booking.create({
      data: {
        bookingNumber,
        tourTypeId: parseInt(tourTypeId),
        departureDate: new Date(departureDate),
        arrivalDate: arrivalDate ? new Date(arrivalDate) : new Date(departureDate),
        endDate: endDate ? new Date(endDate) : new Date(departureDate),
        pax: parseInt(pax) || 0,
        paxUzbekistan: paxUzbekistan ? parseInt(paxUzbekistan) : null,
        paxTurkmenistan: paxTurkmenistan ? parseInt(paxTurkmenistan) : null,
        guideId: guideId ? parseInt(guideId) : null,
        trainTickets,
        avia,
        roomsDbl: parseInt(roomsDbl) || 0,
        roomsTwn: parseInt(roomsTwn) || 0,
        roomsSngl: parseInt(roomsSngl) || 0,
        roomsTotal: parseInt(roomsTotal) || 0,
        dateOlot: dateOlot ? new Date(dateOlot) : null,
        dateJartepa: dateJartepa ? new Date(dateJartepa) : null,
        dateOybek: dateOybek ? new Date(dateOybek) : null,
        dateChernyaevka: dateChernyaevka ? new Date(dateChernyaevka) : null,
        status: status || 'PENDING',
        notes,
        createdById: req.user.id
      },
      include: {
        tourType: true,
        guide: true
      }
    });

    res.status(201).json({ booking });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ error: 'Ошибка создания бронирования' });
  }
});

// PUT /api/bookings/:id - Обновить бронирование
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      bookingNumber,
      tourTypeId,
      departureDate,
      arrivalDate,
      endDate,
      pax,
      paxUzbekistan,
      paxTurkmenistan,
      guideId,
      trainTickets,
      avia,
      roomsDbl,
      roomsTwn,
      roomsSngl,
      roomsTotal,
      dateOlot,
      dateJartepa,
      dateOybek,
      dateChernyaevka,
      status,
      notes,
      assignedToId
    } = req.body;

    const updateData = {};

    if (bookingNumber) updateData.bookingNumber = bookingNumber;
    if (tourTypeId) updateData.tourTypeId = parseInt(tourTypeId);
    if (departureDate) updateData.departureDate = new Date(departureDate);
    if (arrivalDate) updateData.arrivalDate = new Date(arrivalDate);
    if (endDate) updateData.endDate = new Date(endDate);
    if (pax !== undefined) updateData.pax = parseInt(pax);
    if (paxUzbekistan !== undefined) updateData.paxUzbekistan = paxUzbekistan ? parseInt(paxUzbekistan) : null;
    if (paxTurkmenistan !== undefined) updateData.paxTurkmenistan = paxTurkmenistan ? parseInt(paxTurkmenistan) : null;
    if (guideId !== undefined) updateData.guideId = guideId ? parseInt(guideId) : null;
    if (trainTickets !== undefined) updateData.trainTickets = trainTickets;
    if (avia !== undefined) updateData.avia = avia;
    if (roomsDbl !== undefined) updateData.roomsDbl = parseInt(roomsDbl);
    if (roomsTwn !== undefined) updateData.roomsTwn = parseInt(roomsTwn);
    if (roomsSngl !== undefined) updateData.roomsSngl = parseInt(roomsSngl);
    if (roomsTotal !== undefined) updateData.roomsTotal = parseInt(roomsTotal);
    if (dateOlot !== undefined) updateData.dateOlot = dateOlot ? new Date(dateOlot) : null;
    if (dateJartepa !== undefined) updateData.dateJartepa = dateJartepa ? new Date(dateJartepa) : null;
    if (dateOybek !== undefined) updateData.dateOybek = dateOybek ? new Date(dateOybek) : null;
    if (dateChernyaevka !== undefined) updateData.dateChernyaevka = dateChernyaevka ? new Date(dateChernyaevka) : null;
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (assignedToId !== undefined) updateData.assignedToId = assignedToId ? parseInt(assignedToId) : null;

    const booking = await prisma.booking.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        tourType: true,
        guide: true,
        createdBy: { select: { id: true, name: true } }
      }
    });

    res.json({ booking });
  } catch (error) {
    console.error('Update booking error:', error);
    res.status(500).json({ error: 'Ошибка обновления бронирования' });
  }
});

// DELETE /api/bookings/:id - Удалить бронирование
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.booking.delete({ where: { id: parseInt(id) } });

    res.json({ message: 'Бронирование удалено' });
  } catch (error) {
    console.error('Delete booking error:', error);
    res.status(500).json({ error: 'Ошибка удаления бронирования' });
  }
});

// PATCH /api/bookings/:id/status - Изменить статус бронирования
router.patch('/:id/status', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Недопустимый статус' });
    }

    const booking = await prisma.booking.update({
      where: { id: parseInt(id) },
      data: { status },
      include: { tourType: true, guide: true }
    });

    res.json({ booking });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Ошибка изменения статуса' });
  }
});

module.exports = router;
