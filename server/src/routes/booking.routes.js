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

// GET /api/bookings/accommodation-room-types - Получить справочник типов размещения
// ВАЖНО: Этот маршрут должен быть ПЕРЕД маршрутом /:id
router.get('/accommodation-room-types', authenticate, async (req, res) => {
  try {
    const roomTypes = await prisma.accommodationRoomType.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' }
    });

    res.json({ roomTypes });
  } catch (error) {
    console.error('Get accommodation room types error:', error);
    res.status(500).json({ error: 'Ошибка получения типов размещения' });
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
        assignedTo: { select: { id: true, name: true, email: true } },
        bookingRooms: {
          include: {
            hotel: { include: { city: true } },
            roomType: true
          },
          orderBy: { createdAt: 'asc' }
        }
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
      country,
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
    if (country !== undefined) updateData.country = country || null;
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

// ============================================
// BOOKING ROOMS (Размещение в отелях)
// ============================================

// GET /api/bookings/:id/rooms - Получить размещение для бронирования
router.get('/:id/rooms', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const bookingRooms = await prisma.bookingRoom.findMany({
      where: { bookingId: parseInt(id) },
      include: {
        hotel: { include: { city: true } },
        roomType: true
      },
      orderBy: { checkInDate: 'asc' }
    });

    // Добавляем рассчитанные ночи и подсчитываем итоговую сумму
    const roomsWithNights = bookingRooms.map(room => ({
      ...room,
      nights: Math.ceil((new Date(room.checkOutDate) - new Date(room.checkInDate)) / (1000 * 60 * 60 * 24))
    }));
    const totalAmount = bookingRooms.reduce((sum, room) => sum + room.totalPrice, 0);

    res.json({ bookingRooms: roomsWithNights, totalAmount });
  } catch (error) {
    console.error('Get booking rooms error:', error);
    res.status(500).json({ error: 'Ошибка получения размещения' });
  }
});

// GET /api/bookings/:id/rooms/availability - Проверить доступность номеров
router.get('/:id/rooms/availability', authenticate, async (req, res) => {
  try {
    const { hotelId, roomTypeId, checkInDate, checkOutDate, excludeRoomId } = req.query;

    if (!hotelId || !roomTypeId || !checkInDate || !checkOutDate) {
      return res.status(400).json({ error: 'Все параметры обязательны' });
    }

    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);

    const roomType = await prisma.roomType.findUnique({ where: { id: parseInt(roomTypeId) } });
    if (!roomType) {
      return res.status(404).json({ error: 'Тип номера не найден' });
    }

    const whereClause = {
      hotelId: parseInt(hotelId),
      roomTypeId: parseInt(roomTypeId),
      checkInDate: { lt: checkOut },
      checkOutDate: { gt: checkIn }
    };

    if (excludeRoomId) {
      whereClause.id = { not: parseInt(excludeRoomId) };
    }

    const overlappingAllocations = await prisma.bookingRoom.findMany({ where: whereClause });
    const allocatedRooms = overlappingAllocations.reduce((sum, alloc) => sum + alloc.quantity, 0);
    const availableRooms = roomType.roomCount - allocatedRooms;

    res.json({
      totalRooms: roomType.roomCount,
      allocatedRooms,
      availableRooms
    });
  } catch (error) {
    console.error('Check availability error:', error);
    res.status(500).json({ error: 'Ошибка проверки доступности' });
  }
});

// POST /api/bookings/:id/rooms - Добавить размещение
router.post('/:id/rooms', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { hotelId, roomTypeId, quantity, checkInDate, checkOutDate, pricePerNight, notes } = req.body;

    // Валидация
    if (!hotelId || !roomTypeId) {
      return res.status(400).json({ error: 'Отель и тип номера обязательны' });
    }

    if (!checkInDate || !checkOutDate) {
      return res.status(400).json({ error: 'Даты заезда и выезда обязательны' });
    }

    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);

    if (checkOut <= checkIn) {
      return res.status(400).json({ error: 'Дата выезда должна быть позже даты заезда' });
    }

    const qty = parseInt(quantity) || 1;
    const price = parseFloat(pricePerNight) || 0;

    // Рассчитываем количество ночей
    const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

    if (qty < 1) {
      return res.status(400).json({ error: 'Количество номеров должно быть не менее 1' });
    }

    // Проверяем что бронирование существует
    const booking = await prisma.booking.findUnique({ where: { id: parseInt(id) } });
    if (!booking) {
      return res.status(404).json({ error: 'Бронирование не найдено' });
    }

    // Проверяем что roomType принадлежит отелю
    const roomType = await prisma.roomType.findFirst({
      where: { id: parseInt(roomTypeId), hotelId: parseInt(hotelId) }
    });
    if (!roomType) {
      return res.status(400).json({ error: 'Тип номера не принадлежит выбранному отелю' });
    }

    // Проверяем доступность номеров
    const overlappingAllocations = await prisma.bookingRoom.findMany({
      where: {
        hotelId: parseInt(hotelId),
        roomTypeId: parseInt(roomTypeId),
        // Перекрывающиеся даты: checkIn < existingCheckOut AND checkOut > existingCheckIn
        checkInDate: { lt: checkOut },
        checkOutDate: { gt: checkIn }
      }
    });

    const allocatedRooms = overlappingAllocations.reduce((sum, alloc) => sum + alloc.quantity, 0);
    const availableRooms = roomType.roomCount - allocatedRooms;

    if (qty > availableRooms) {
      return res.status(400).json({
        error: `Недостаточно свободных номеров. Доступно: ${availableRooms}, запрошено: ${qty}`,
        availableRooms
      });
    }

    // Используем цену из roomType если не указана
    const finalPrice = price > 0 ? price : roomType.pricePerNight;
    const totalPrice = qty * nights * finalPrice;

    const bookingRoom = await prisma.bookingRoom.create({
      data: {
        bookingId: parseInt(id),
        hotelId: parseInt(hotelId),
        roomTypeId: parseInt(roomTypeId),
        quantity: qty,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        pricePerNight: finalPrice,
        totalPrice,
        notes
      },
      include: {
        hotel: { include: { city: true } },
        roomType: true
      }
    });

    // Добавляем рассчитанные ночи в ответ
    res.status(201).json({ bookingRoom: { ...bookingRoom, nights } });
  } catch (error) {
    console.error('Create booking room error:', error);
    res.status(500).json({ error: 'Ошибка добавления размещения' });
  }
});

// PUT /api/bookings/:id/rooms/:roomId - Обновить размещение
router.put('/:id/rooms/:roomId', authenticate, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { hotelId, roomTypeId, quantity, checkInDate, checkOutDate, pricePerNight, notes } = req.body;

    const current = await prisma.bookingRoom.findUnique({ where: { id: parseInt(roomId) } });
    if (!current) {
      return res.status(404).json({ error: 'Размещение не найдено' });
    }

    const updateData = {};

    if (hotelId !== undefined) updateData.hotelId = parseInt(hotelId);
    if (roomTypeId !== undefined) updateData.roomTypeId = parseInt(roomTypeId);
    if (quantity !== undefined) updateData.quantity = parseInt(quantity);
    if (checkInDate !== undefined) updateData.checkInDate = new Date(checkInDate);
    if (checkOutDate !== undefined) updateData.checkOutDate = new Date(checkOutDate);
    if (pricePerNight !== undefined) updateData.pricePerNight = parseFloat(pricePerNight);
    if (notes !== undefined) updateData.notes = notes;

    // Получаем итоговые значения
    const finalHotelId = updateData.hotelId ?? current.hotelId;
    const finalRoomTypeId = updateData.roomTypeId ?? current.roomTypeId;
    const qty = updateData.quantity ?? current.quantity;
    const checkIn = updateData.checkInDate ?? current.checkInDate;
    const checkOut = updateData.checkOutDate ?? current.checkOutDate;
    const price = updateData.pricePerNight ?? current.pricePerNight;

    if (checkOut <= checkIn) {
      return res.status(400).json({ error: 'Дата выезда должна быть позже даты заезда' });
    }

    // Проверяем доступность номеров (исключая текущее размещение)
    const roomType = await prisma.roomType.findUnique({ where: { id: finalRoomTypeId } });
    if (!roomType) {
      return res.status(400).json({ error: 'Тип номера не найден' });
    }

    const overlappingAllocations = await prisma.bookingRoom.findMany({
      where: {
        id: { not: parseInt(roomId) },
        hotelId: finalHotelId,
        roomTypeId: finalRoomTypeId,
        checkInDate: { lt: checkOut },
        checkOutDate: { gt: checkIn }
      }
    });

    const allocatedRooms = overlappingAllocations.reduce((sum, alloc) => sum + alloc.quantity, 0);
    const availableRooms = roomType.roomCount - allocatedRooms;

    if (qty > availableRooms) {
      return res.status(400).json({
        error: `Недостаточно свободных номеров. Доступно: ${availableRooms}, запрошено: ${qty}`,
        availableRooms
      });
    }

    // Рассчитываем количество ночей и итоговую цену
    const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
    updateData.totalPrice = qty * nights * price;

    const bookingRoom = await prisma.bookingRoom.update({
      where: { id: parseInt(roomId) },
      data: updateData,
      include: {
        hotel: { include: { city: true } },
        roomType: true
      }
    });

    res.json({ bookingRoom: { ...bookingRoom, nights } });
  } catch (error) {
    console.error('Update booking room error:', error);
    res.status(500).json({ error: 'Ошибка обновления размещения' });
  }
});

// DELETE /api/bookings/:id/rooms/:roomId - Удалить размещение
router.delete('/:id/rooms/:roomId', authenticate, async (req, res) => {
  try {
    const { roomId } = req.params;

    await prisma.bookingRoom.delete({ where: { id: parseInt(roomId) } });

    res.json({ message: 'Размещение удалено' });
  } catch (error) {
    console.error('Delete booking room error:', error);
    res.status(500).json({ error: 'Ошибка удаления размещения' });
  }
});

// ============================================
// ACCOMMODATIONS (Новая структура размещения)
// ============================================

// Словарь допустимых типов размещения (для валидации)
const VALID_ROOM_TYPE_CODES = ['SNGL', 'DBL', 'TWN', 'TRPL', 'QDPL', 'SUITE', 'EXTRA'];

// Функция расчёта итогов для размещения
function calculateAccommodationTotals(rooms, nights) {
  let totalRooms = 0;
  let totalGuests = 0;
  let totalCost = 0;

  for (const room of rooms) {
    totalRooms += room.roomsCount;
    totalGuests += room.roomsCount * room.guestsPerRoom;
    totalCost += room.totalCost || (room.roomsCount * room.pricePerNight * nights);
  }

  return { totalRooms, totalGuests, totalCost };
}

// GET /api/bookings/:id/accommodations - Получить все размещения для бронирования
router.get('/:id/accommodations', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const accommodations = await prisma.accommodation.findMany({
      where: { bookingId: parseInt(id) },
      include: {
        hotel: {
          include: { city: true }
        },
        roomType: true,
        accommodationRoomType: true,
        rooms: {
          include: {
            accommodationRoomType: true
          },
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { checkInDate: 'asc' }
    });

    // Добавляем итоги к каждому размещению
    const accommodationsWithTotals = accommodations.map(acc => {
      const totals = calculateAccommodationTotals(acc.rooms, acc.nights);
      return {
        ...acc,
        ...totals
      };
    });

    res.json({ accommodations: accommodationsWithTotals });
  } catch (error) {
    console.error('Get accommodations error:', error);
    res.status(500).json({ error: 'Ошибка получения размещений' });
  }
});

// POST /api/bookings/:id/accommodations - Создать размещение
router.post('/:id/accommodations', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { hotelId, roomTypeId, roomTypeCode, checkInDate, checkOutDate, notes, rooms } = req.body;

    // Валидация обязательных полей
    if (!hotelId || !checkInDate || !checkOutDate) {
      return res.status(400).json({ error: 'Отель и даты обязательны' });
    }

    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);

    // Валидация: дата выезда > дата заезда
    if (checkOut <= checkIn) {
      return res.status(400).json({ error: 'Дата выезда должна быть позже даты заезда' });
    }

    // Рассчитываем количество ночей на бэкенде
    const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

    // Проверяем существование бронирования
    const booking = await prisma.booking.findUnique({ where: { id: parseInt(id) } });
    if (!booking) {
      return res.status(404).json({ error: 'Бронирование не найдено' });
    }

    // Проверяем существование отеля
    const hotel = await prisma.hotel.findUnique({
      where: { id: parseInt(hotelId) },
      include: { city: true }
    });
    if (!hotel) {
      return res.status(400).json({ error: 'Отель не найден' });
    }

    // Если указан тип номера, проверяем что он принадлежит отелю
    if (roomTypeId) {
      const roomType = await prisma.roomType.findFirst({
        where: { id: parseInt(roomTypeId), hotelId: parseInt(hotelId) }
      });
      if (!roomType) {
        return res.status(400).json({ error: 'Тип номера не найден в этом отеле' });
      }
    }

    // Валидация roomTypeCode из словаря (для обратной совместимости)
    if (roomTypeCode) {
      if (!VALID_ROOM_TYPE_CODES.includes(roomTypeCode)) {
        return res.status(400).json({
          error: `Недопустимый тип размещения: ${roomTypeCode}. Допустимые: ${VALID_ROOM_TYPE_CODES.join(', ')}`
        });
      }
    }

    // Валидация rooms array
    if (rooms && Array.isArray(rooms)) {
      for (const room of rooms) {
        if (!room.roomTypeCode || !VALID_ROOM_TYPE_CODES.includes(room.roomTypeCode)) {
          return res.status(400).json({
            error: `Недопустимый тип размещения в комнате: ${room.roomTypeCode}. Допустимые: ${VALID_ROOM_TYPE_CODES.join(', ')}`
          });
        }
        if (!room.roomsCount || room.roomsCount < 1) {
          return res.status(400).json({ error: 'Количество номеров должно быть не менее 1' });
        }
        if (!room.guestsPerRoom || room.guestsPerRoom < 1) {
          return res.status(400).json({ error: 'Количество гостей должно быть не менее 1' });
        }
      }
    }

    // Подготавливаем данные для создания комнат
    const roomsData = (rooms && Array.isArray(rooms) && rooms.length > 0) ? rooms.map(room => ({
      roomTypeCode: room.roomTypeCode,
      roomsCount: parseInt(room.roomsCount) || 1,
      guestsPerRoom: parseInt(room.guestsPerRoom) || 2,
      pricePerNight: parseFloat(room.pricePerNight) || 0,
      totalCost: (parseInt(room.roomsCount) || 1) * (parseFloat(room.pricePerNight) || 0) * nights
    })) : [];

    // Создаём размещение с комнатами
    const accommodation = await prisma.accommodation.create({
      data: {
        bookingId: parseInt(id),
        hotelId: parseInt(hotelId),
        roomTypeId: roomTypeId ? parseInt(roomTypeId) : null,
        roomTypeCode: roomTypeCode || null,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        nights,
        notes,
        rooms: {
          create: roomsData
        }
      },
      include: {
        hotel: {
          include: { city: true }
        },
        roomType: true,
        accommodationRoomType: true,
        rooms: {
          include: {
            accommodationRoomType: true
          }
        }
      }
    });

    // Добавляем итоги
    const totals = calculateAccommodationTotals(accommodation.rooms, nights);

    res.status(201).json({
      accommodation: {
        ...accommodation,
        ...totals
      }
    });
  } catch (error) {
    console.error('Create accommodation error:', error);
    res.status(500).json({ error: 'Ошибка создания размещения' });
  }
});

// PUT /api/bookings/:id/accommodations/:accId - Обновить размещение
router.put('/:id/accommodations/:accId', authenticate, async (req, res) => {
  try {
    const { accId } = req.params;
    const { hotelId, roomTypeId, roomTypeCode, checkInDate, checkOutDate, notes, rooms } = req.body;

    const existing = await prisma.accommodation.findUnique({
      where: { id: parseInt(accId) }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Размещение не найдено' });
    }

    const checkIn = checkInDate ? new Date(checkInDate) : existing.checkInDate;
    const checkOut = checkOutDate ? new Date(checkOutDate) : existing.checkOutDate;

    // Валидация: дата выезда > дата заезда
    if (checkOut <= checkIn) {
      return res.status(400).json({ error: 'Дата выезда должна быть позже даты заезда' });
    }

    // Рассчитываем количество ночей на бэкенде
    const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

    // Данные для обновления
    const updateData = {
      checkInDate: checkIn,
      checkOutDate: checkOut,
      nights,
      notes: notes !== undefined ? notes : existing.notes
    };

    // Если указан отель
    if (hotelId) {
      const hotel = await prisma.hotel.findUnique({ where: { id: parseInt(hotelId) } });
      if (!hotel) {
        return res.status(400).json({ error: 'Отель не найден' });
      }
      updateData.hotelId = parseInt(hotelId);
    }

    // Если указан тип номера
    if (roomTypeId !== undefined) {
      if (roomTypeId === null) {
        updateData.roomTypeId = null;
      } else {
        const targetHotelId = hotelId ? parseInt(hotelId) : existing.hotelId;
        const roomType = await prisma.roomType.findFirst({
          where: { id: parseInt(roomTypeId), hotelId: targetHotelId }
        });
        if (!roomType) {
          return res.status(400).json({ error: 'Тип номера не найден в этом отеле' });
        }
        updateData.roomTypeId = parseInt(roomTypeId);
      }
    }

    // Если указан тип размещения (roomTypeCode)
    if (roomTypeCode !== undefined) {
      if (roomTypeCode === null || roomTypeCode === '') {
        updateData.roomTypeCode = null;
      } else {
        if (!VALID_ROOM_TYPE_CODES.includes(roomTypeCode)) {
          return res.status(400).json({
            error: `Недопустимый тип размещения: ${roomTypeCode}. Допустимые: ${VALID_ROOM_TYPE_CODES.join(', ')}`
          });
        }
        updateData.roomTypeCode = roomTypeCode;
      }
    }

    // Валидация rooms array
    if (rooms && Array.isArray(rooms)) {
      for (const room of rooms) {
        if (!room.roomTypeCode || !VALID_ROOM_TYPE_CODES.includes(room.roomTypeCode)) {
          return res.status(400).json({
            error: `Недопустимый тип размещения в комнате: ${room.roomTypeCode}. Допустимые: ${VALID_ROOM_TYPE_CODES.join(', ')}`
          });
        }
      }
    }

    // Обновляем размещение
    const accommodation = await prisma.accommodation.update({
      where: { id: parseInt(accId) },
      data: updateData,
      include: {
        hotel: {
          include: { city: true }
        },
        roomType: true,
        accommodationRoomType: true,
        rooms: true
      }
    });

    // Если передан массив rooms, обновляем комнаты (удаляем старые, создаём новые)
    if (rooms !== undefined && Array.isArray(rooms)) {
      // Удаляем все существующие комнаты
      await prisma.accommodationRoom.deleteMany({
        where: { accommodationId: parseInt(accId) }
      });

      // Создаём новые комнаты
      if (rooms.length > 0) {
        const roomsData = rooms.map(room => ({
          accommodationId: parseInt(accId),
          roomTypeCode: room.roomTypeCode,
          roomsCount: parseInt(room.roomsCount) || 1,
          guestsPerRoom: parseInt(room.guestsPerRoom) || 2,
          pricePerNight: parseFloat(room.pricePerNight) || 0,
          totalCost: (parseInt(room.roomsCount) || 1) * (parseFloat(room.pricePerNight) || 0) * nights
        }));

        await prisma.accommodationRoom.createMany({
          data: roomsData
        });
      }
    }

    // Получаем обновлённое размещение с комнатами
    const updatedAccommodation = await prisma.accommodation.findUnique({
      where: { id: parseInt(accId) },
      include: {
        hotel: {
          include: { city: true }
        },
        roomType: true,
        accommodationRoomType: true,
        rooms: {
          include: {
            accommodationRoomType: true
          }
        }
      }
    });

    // Добавляем итоги
    const totals = calculateAccommodationTotals(updatedAccommodation.rooms, nights);

    res.json({
      accommodation: {
        ...updatedAccommodation,
        ...totals
      }
    });
  } catch (error) {
    console.error('Update accommodation error:', error);
    res.status(500).json({ error: 'Ошибка обновления размещения' });
  }
});

// DELETE /api/bookings/:id/accommodations/:accId - Удалить размещение
router.delete('/:id/accommodations/:accId', authenticate, async (req, res) => {
  try {
    const { accId } = req.params;

    await prisma.accommodation.delete({ where: { id: parseInt(accId) } });

    res.json({ message: 'Размещение удалено' });
  } catch (error) {
    console.error('Delete accommodation error:', error);
    res.status(500).json({ error: 'Ошибка удаления размещения' });
  }
});

module.exports = router;
