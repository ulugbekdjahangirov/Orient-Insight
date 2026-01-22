const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();
const prisma = new PrismaClient();

// Helper function to calculate room counts from tourists
// If roomNumber is set, count unique rooms. Otherwise, count by roomPreference.
function calculateRoomCountsFromTourists(tourists) {
  if (!tourists || tourists.length === 0) {
    return { roomsDbl: 0, roomsTwn: 0, roomsSngl: 0, roomsTotal: 0 };
  }

  // Check if any tourist has roomNumber set (not null and not "null" string)
  const hasRoomNumbers = tourists.some(t => t.roomNumber && t.roomNumber !== 'null');

  if (hasRoomNumbers) {
    // Count unique room numbers
    const uniqueRooms = {
      DBL: new Set(),
      TWN: new Set(),
      SNGL: new Set()
    };

    tourists.forEach(tourist => {
      if (tourist.roomNumber && tourist.roomNumber !== 'null') {
        const room = tourist.roomNumber.toUpperCase();
        if (room.startsWith('DBL')) {
          uniqueRooms.DBL.add(room);
        } else if (room.startsWith('SNGL') || room.startsWith('SGL')) {
          uniqueRooms.SNGL.add(room);
        } else if (room.startsWith('TWN')) {
          uniqueRooms.TWN.add(room);
        }
      }
    });

    return {
      roomsDbl: uniqueRooms.DBL.size,
      roomsTwn: uniqueRooms.TWN.size,
      roomsSngl: uniqueRooms.SNGL.size,
      roomsTotal: uniqueRooms.DBL.size + uniqueRooms.TWN.size + uniqueRooms.SNGL.size
    };
  } else {
    // Fallback: count by roomPreference (old method)
    let dblCount = 0;
    let twnCount = 0;
    let snglCount = 0;

    tourists.forEach(tourist => {
      const roomPref = (tourist.roomPreference || '').toUpperCase().trim();

      // DZ or DBL = Double room
      if (roomPref === 'DZ' || roomPref === 'DBL' || roomPref.includes('DBL') || roomPref.includes('DOUBLE')) {
        dblCount++;
      }
      // EZ or SNGL = Single room
      else if (roomPref === 'EZ' || roomPref === 'SNGL' || roomPref === 'SGL' || roomPref.includes('SNGL') || roomPref.includes('SINGLE')) {
        snglCount++;
      }
      // TWN = Twin room
      else if (roomPref === 'TWN' || roomPref.includes('TWN') || roomPref.includes('TWIN')) {
        twnCount++;
      }
    });

    // Calculate actual room numbers
    // If there's an odd number of DZ (single DZ without pair), count it as 0.5 TWN
    let roomsDbl, roomsTwn;
    if (dblCount % 2 === 1) {
      // Odd number of DZ: one person alone, rest in pairs
      roomsDbl = Math.floor(dblCount / 2); // Full DBL rooms for pairs
      roomsTwn = Math.ceil(twnCount / 2) + 0.5; // Regular TWN rooms + 0.5 for single DZ
    } else {
      // Even number of DZ: all in pairs
      roomsDbl = dblCount / 2;
      roomsTwn = Math.ceil(twnCount / 2);
    }
    const roomsSngl = snglCount;
    const roomsTotal = roomsDbl + roomsTwn + roomsSngl;

    return { roomsDbl, roomsTwn, roomsSngl, roomsTotal };
  }
}

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
      if (guideId === 'unassigned') {
        where.guideId = null;
      } else {
        where.guideId = parseInt(guideId);
      }
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
          createdBy: { select: { id: true, name: true } },
          tourists: { select: { id: true, roomNumber: true, roomPreference: true, accommodation: true } }
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: parseInt(limit)
      }),
      prisma.booking.count({ where })
    ]);

    // Return bookings with room counts (already in database)
    const bookingsWithCalculatedRooms = bookings.map(booking => {
      const { tourists, ...bookingData } = booking;

      return {
        ...bookingData,
        _touristsCount: tourists ? tourists.length : 0
      };
    });

    res.json({
      bookings: bookingsWithCalculatedRooms,
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

    // Auto-calculate total PAX from Uzbekistan + Turkmenistan
    const uzbek = paxUzbekistan ? parseInt(paxUzbekistan) : 0;
    const turkmen = paxTurkmenistan ? parseInt(paxTurkmenistan) : 0;
    const calculatedPax = uzbek + turkmen;

    // Auto-set status based on PAX count
    let autoStatus = 'PENDING';
    if (calculatedPax >= 6) {
      autoStatus = 'CONFIRMED';
    } else if (calculatedPax === 4 || calculatedPax === 5) {
      autoStatus = 'IN_PROGRESS';
    }

    const booking = await prisma.booking.create({
      data: {
        bookingNumber,
        tourTypeId: parseInt(tourTypeId),
        departureDate: new Date(departureDate),
        arrivalDate: arrivalDate ? new Date(arrivalDate) : new Date(departureDate),
        endDate: endDate ? new Date(endDate) : new Date(departureDate),
        pax: calculatedPax,
        paxUzbekistan: uzbek || null,
        paxTurkmenistan: turkmen || null,
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
        status: status || autoStatus,
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

    // Handle Uzbekistan and Turkmenistan PAX
    if (paxUzbekistan !== undefined) updateData.paxUzbekistan = paxUzbekistan ? parseInt(paxUzbekistan) : null;
    if (paxTurkmenistan !== undefined) updateData.paxTurkmenistan = paxTurkmenistan ? parseInt(paxTurkmenistan) : null;

    // Auto-calculate total PAX from Uzbekistan + Turkmenistan
    const uzbek = updateData.paxUzbekistan !== undefined ? updateData.paxUzbekistan : (paxUzbekistan !== undefined ? parseInt(paxUzbekistan) || 0 : 0);
    const turkmen = updateData.paxTurkmenistan !== undefined ? updateData.paxTurkmenistan : (paxTurkmenistan !== undefined ? parseInt(paxTurkmenistan) || 0 : 0);

    // Get current booking to calculate accurate total
    const currentBooking = await prisma.booking.findUnique({ where: { id: parseInt(id) } });
    const currentUzbek = updateData.paxUzbekistan !== undefined ? (updateData.paxUzbekistan || 0) : (currentBooking?.paxUzbekistan || 0);
    const currentTurkmen = updateData.paxTurkmenistan !== undefined ? (updateData.paxTurkmenistan || 0) : (currentBooking?.paxTurkmenistan || 0);

    updateData.pax = currentUzbek + currentTurkmen;

    // Auto-set status based on PAX count (only if status not explicitly provided)
    if (status === undefined) {
      const calculatedPax = updateData.pax;
      if (calculatedPax >= 6) {
        updateData.status = 'CONFIRMED';
      } else if (calculatedPax === 4 || calculatedPax === 5) {
        updateData.status = 'IN_PROGRESS';
      } else {
        updateData.status = 'PENDING';
      }
    }
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

// POST /api/bookings/update-all-statuses - Update all bookings' statuses based on PAX
router.post('/update-all-statuses', authenticate, async (req, res) => {
  try {
    const allBookings = await prisma.booking.findMany({
      select: { id: true, pax: true }
    });

    let updated = 0;
    for (const booking of allBookings) {
      const pax = booking.pax || 0;
      let status = 'PENDING';

      if (pax >= 6) {
        status = 'CONFIRMED';
      } else if (pax === 4 || pax === 5) {
        status = 'IN_PROGRESS';
      }

      await prisma.booking.update({
        where: { id: booking.id },
        data: { status }
      });
      updated++;
    }

    res.json({ message: `Обновлено ${updated} бронирований` });
  } catch (error) {
    console.error('Update all statuses error:', error);
    res.status(500).json({ error: 'Ошибка обновления статусов' });
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
const VALID_ROOM_TYPE_CODES = ['SNGL', 'DBL', 'TWN', 'TRPL', 'QDPL', 'SUITE', 'EXTRA', 'PAX'];

// Функция расчёта итогов для размещения с учётом индивидуальных дат туристов
function calculateAccommodationTotals(rooms, nights, tourists = [], accommodation = null, allTourists = []) {
  let totalRooms = 0;
  let totalGuests = 0;
  let totalCost = 0;

  // Check if this is Turkmenistan/Khiva hotel
  const isTurkmenistanHotel = accommodation && (
    accommodation.hotel?.city?.name?.toLowerCase().includes('хива') ||
    accommodation.hotel?.city?.name?.toLowerCase().includes('khiva') ||
    accommodation.hotel?.city?.name?.toLowerCase().includes('туркмен') ||
    accommodation.hotel?.city?.name?.toLowerCase().includes('turkmen')
  );

  // For Turkmenistan hotels: calculate separately for UZ (2 nights) and TM (3 nights) tourists
  if (isTurkmenistanHotel && allTourists.length > 0) {
    const uzTourists = allTourists.filter(t => {
      const placement = (t.accommodation || '').toLowerCase();
      return placement.includes('uzbek') || placement.includes('узбек') || placement === 'uz';
    });
    const tmTourists = allTourists.filter(t => {
      const placement = (t.accommodation || '').toLowerCase();
      return placement.includes('turkmen') || placement.includes('туркмен') || placement === 'tm';
    });

    // Calculate UZ tourists rooms (2 nights)
    const uzNights = 2;
    rooms.forEach(room => {
      // Determine how many of this room type are for UZ tourists
      const roomTypeCode = room.roomTypeCode?.toUpperCase();
      let uzRoomsCount = 0;

      if (roomTypeCode === 'SNGL' || roomTypeCode === 'SINGLE' || roomTypeCode === 'EZ') {
        uzRoomsCount = uzTourists.filter(t => ['SNGL', 'SINGLE', 'EZ'].includes(t.roomPreference?.toUpperCase())).length;
      } else if (roomTypeCode === 'DBL' || roomTypeCode === 'DOUBLE') {
        uzRoomsCount = Math.floor(uzTourists.filter(t => ['DBL', 'DOUBLE', 'DZ'].includes(t.roomPreference?.toUpperCase())).length / 2);
      } else if (roomTypeCode === 'TWN' || roomTypeCode === 'TWIN') {
        uzRoomsCount = Math.floor(uzTourists.filter(t => ['TWN', 'TWIN'].includes(t.roomPreference?.toUpperCase())).length / 2);
      }

      const tmRoomsCount = room.roomsCount - uzRoomsCount;

      // Add UZ cost (2 nights)
      if (uzRoomsCount > 0) {
        totalCost += uzRoomsCount * room.pricePerNight * uzNights;
      }
      // Add TM cost (3 nights)
      if (tmRoomsCount > 0) {
        totalCost += tmRoomsCount * room.pricePerNight * nights;
      }

      totalRooms += room.roomsCount;
      totalGuests += room.roomsCount * (room.guestsPerRoom || 2);
    });
  } else {
    // Standard calculation
    for (const room of rooms) {
      totalRooms += room.roomsCount;
      totalGuests += room.roomsCount * (room.guestsPerRoom || 2);
      totalCost += room.totalCost || (room.roomsCount * room.pricePerNight * nights);
    }
  }

  // Calculate extra nights cost for tourists with custom dates
  if (tourists.length > 0 && accommodation) {
    const accCheckIn = new Date(accommodation.checkInDate);
    const accCheckOut = new Date(accommodation.checkOutDate);

    // Find tourists staying at this hotel during these dates
    tourists.forEach(tourist => {
      if (!tourist.checkInDate || !tourist.checkOutDate) {
        return;
      }

      const touristCheckIn = new Date(tourist.checkInDate);
      const touristCheckOut = new Date(tourist.checkOutDate);

      // Normalize dates to midnight to avoid time zone issues
      const normalizedTouristCheckIn = new Date(touristCheckIn);
      normalizedTouristCheckIn.setHours(0, 0, 0, 0);

      const normalizedTouristCheckOut = new Date(touristCheckOut);
      normalizedTouristCheckOut.setHours(0, 0, 0, 0);

      const normalizedAccCheckIn = new Date(accCheckIn);
      normalizedAccCheckIn.setHours(0, 0, 0, 0);

      const normalizedAccCheckOut = new Date(accCheckOut);
      normalizedAccCheckOut.setHours(0, 0, 0, 0);

      // Check if tourist dates overlap with accommodation dates
      const datesOverlap = normalizedTouristCheckIn <= normalizedAccCheckOut && normalizedTouristCheckOut >= normalizedAccCheckIn;
      if (!datesOverlap) {
        return;
      }

      // Calculate extra nights BEFORE group check-in
      let extraNightsBefore = 0;
      if (normalizedTouristCheckIn < normalizedAccCheckIn) {
        extraNightsBefore = Math.round((normalizedAccCheckIn - normalizedTouristCheckIn) / (1000 * 60 * 60 * 24));
      }

      // Calculate extra nights AFTER group check-out
      let extraNightsAfter = 0;
      if (normalizedTouristCheckOut > normalizedAccCheckOut) {
        extraNightsAfter = Math.round((normalizedTouristCheckOut - normalizedAccCheckOut) / (1000 * 60 * 60 * 24));
      }

      const totalExtraNights = extraNightsBefore + extraNightsAfter;

      if (totalExtraNights > 0) {
        // Find price for tourist's room type
        const touristRoomType = tourist.roomPreference?.toUpperCase();
        let pricePerNight = 0;

        // Find matching room price
        const matchingRoom = rooms.find(r =>
          r.roomTypeCode?.toUpperCase() === touristRoomType ||
          (touristRoomType === 'SNGL' && r.roomTypeCode === 'SINGLE') ||
          (touristRoomType === 'DBL' && r.roomTypeCode === 'DOUBLE') ||
          (touristRoomType === 'EZ' && r.roomTypeCode === 'SNGL') ||
          (touristRoomType === 'DZ' && (r.roomTypeCode === 'DBL' || r.roomTypeCode === 'TWN'))
        );

        if (matchingRoom) {
          pricePerNight = matchingRoom.pricePerNight;
        }

        // Add extra cost for extra nights
        const extraCost = totalExtraNights * pricePerNight;
        totalCost += extraCost;
      }
    });
  }

  return { totalRooms, totalGuests, totalCost };
}

// GET /api/bookings/:id/accommodations - Получить все размещения для бронирования
router.get('/:id/accommodations', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Load tourists for this booking to calculate extra nights
    const tourists = await prisma.tourist.findMany({
      where: { bookingId: parseInt(id) },
      include: {
        accommodationRoomingList: true
      }
    });

    const accommodations = await prisma.accommodation.findMany({
      where: { bookingId: parseInt(id) },
      include: {
        hotel: {
          include: {
            city: true,
            roomTypes: true  // Include room types to get currency info
          }
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

    // console.log(`Total tourists loaded: ${tourists.length}`);

    // Identify Tashkent accommodations
    const tashkentAccommodations = accommodations.filter(acc => {
      const cityName = acc.hotel?.city?.name?.toLowerCase() || '';
      return cityName.includes('ташкент') || cityName.includes('tashkent') || cityName.includes('toshkent');
    });

    // Добавляем итоги к каждому размещению с учётом индивидуальных дат туристов
    const accommodationsWithTotals = accommodations.map((acc, accIndex) => {
      // console.log(`Processing accommodation: ${acc.hotel?.name} (${acc.checkInDate} - ${acc.checkOutDate})`);

      // Only calculate extra nights for the FIRST accommodation
      // Subsequent accommodations use standard group dates
      const isFirstAccommodation = accIndex === 0;

      // Check if this is second visit to same Tashkent hotel
      const isSecondVisitSameHotel = tashkentAccommodations.length > 1 &&
                                      tashkentAccommodations[tashkentAccommodations.length - 1].id === acc.id &&
                                      tashkentAccommodations[0].hotelId === tashkentAccommodations[tashkentAccommodations.length - 1].hotelId &&
                                      tashkentAccommodations[0].id !== tashkentAccommodations[tashkentAccommodations.length - 1].id;

      // Filter tourists for this accommodation
      let accTourists = tourists.filter(t => {
        if (!t.checkInDate || !t.checkOutDate) return false;

        const accCheckIn = new Date(acc.checkInDate);
        const accCheckOut = new Date(acc.checkOutDate);
        const touristCheckIn = new Date(t.checkInDate);
        const touristCheckOut = new Date(t.checkOutDate);

        // Check if tourist dates overlap with accommodation dates
        return touristCheckIn <= accCheckOut && touristCheckOut >= accCheckIn;
      });

      // For second visit to same hotel - only UZ tourists return to Tashkent
      if (isSecondVisitSameHotel) {
        const allBookingTourists = tourists; // All tourists for this booking
        const uzTourists = allBookingTourists.filter(t => {
          const placement = (t.accommodation || '').toLowerCase();
          const isUzbekistan = placement.includes('uzbek') || placement.includes('узбек') || placement === 'uz';
          return isUzbekistan;
        });

        // console.log(`Second visit to same hotel - filtering UZ tourists only: ${uzTourists.length} out of ${allBookingTourists.length}`);

        // Recalculate rooms based on UZ tourists only
        let roomsForCalculation = acc.rooms;

        // Calculate room counts from UZ tourists
        const uzDblCount = Math.ceil(uzTourists.filter(t => ['DBL', 'DOUBLE', 'DZ'].includes(t.roomPreference)).length / 2);
        const uzTwnCount = Math.ceil(uzTourists.filter(t => ['TWN', 'TWIN'].includes(t.roomPreference)).length / 2);
        const uzSnglCount = uzTourists.filter(t => ['SNGL', 'SINGLE', 'EZ'].includes(t.roomPreference)).length;

        // Override rooms with recalculated values
        roomsForCalculation = [];
        if (uzDblCount > 0) {
          roomsForCalculation.push({
            roomTypeCode: 'DBL',
            roomsCount: uzDblCount,
            pricePerNight: acc.rooms.find(r => r.roomTypeCode === 'DBL')?.pricePerNight || 0
          });
        }
        if (uzTwnCount > 0) {
          roomsForCalculation.push({
            roomTypeCode: 'TWN',
            roomsCount: uzTwnCount,
            pricePerNight: acc.rooms.find(r => r.roomTypeCode === 'TWN')?.pricePerNight || 0
          });
        }
        if (uzSnglCount > 0) {
          roomsForCalculation.push({
            roomTypeCode: 'SNGL',
            roomsCount: uzSnglCount,
            pricePerNight: acc.rooms.find(r => r.roomTypeCode === 'SNGL')?.pricePerNight || 0
          });
        }

        // console.log(`Recalculated rooms for UZ tourists: DBL=${uzDblCount}, TWN=${uzTwnCount}, SNGL=${uzSnglCount}`);

        const totals = calculateAccommodationTotals(roomsForCalculation, acc.nights, [], acc, tourists);
        return {
          ...acc,
          rooms: roomsForCalculation, // Override with filtered rooms
          ...totals
        };
      }

      // console.log(`Found ${accTourists.length} tourists for this accommodation`);

      // Get tourists with AccommodationRoomingList entries for THIS accommodation
      const touristsWithCustomDates = tourists.filter(t => {
        if (!t.accommodationRoomingList || t.accommodationRoomingList.length === 0) return false;
        return t.accommodationRoomingList.some(entry => entry.accommodationId === acc.id);
      }).map(t => {
        // Find this accommodation's entry
        const entry = t.accommodationRoomingList.find(e => e.accommodationId === acc.id);
        return {
          ...t,
          checkInDate: entry.checkInDate,
          checkOutDate: entry.checkOutDate
        };
      });

      // console.log(`Found ${touristsWithCustomDates.length} tourists with custom dates for accommodation ${acc.id}`);

      // RECALCULATE room counts based on actual tourists' room preferences
      // This ensures displayed room counts match Rooming List data
      const touristsForThisAccommodation = tourists.filter(t => {
        // Use AccommodationRoomingList if available
        if (t.accommodationRoomingList && t.accommodationRoomingList.length > 0) {
          return t.accommodationRoomingList.some(entry => entry.accommodationId === acc.id);
        }
        // Fallback: check if tourist dates overlap with accommodation dates
        if (t.checkInDate && t.checkOutDate) {
          const accCheckIn = new Date(acc.checkInDate);
          const accCheckOut = new Date(acc.checkOutDate);
          const touristCheckIn = new Date(t.checkInDate);
          const touristCheckOut = new Date(t.checkOutDate);
          return touristCheckIn <= accCheckOut && touristCheckOut >= accCheckIn;
        }
        return false;
      });

      // Calculate room counts from tourists' room preferences
      const roomCounts = {};
      const roomPrices = {};

      // Build room price map from existing rooms
      acc.rooms.forEach(room => {
        roomPrices[room.roomTypeCode] = room.pricePerNight;
      });

      // Count tourists by room type
      touristsForThisAccommodation.forEach(tourist => {
        const roomPref = (tourist.roomPreference || '').toUpperCase();

        // Normalize room type codes
        let normalizedType = roomPref;
        if (['DBL', 'DOUBLE', 'DZ'].includes(roomPref)) {
          normalizedType = 'DBL';
        } else if (['TWN', 'TWIN'].includes(roomPref)) {
          normalizedType = 'TWN';
        } else if (['SNGL', 'SINGLE', 'EZ'].includes(roomPref)) {
          normalizedType = 'SNGL';
        } else if (['TRPL', 'TRIPLE'].includes(roomPref)) {
          normalizedType = 'TRPL';
        }

        if (!roomCounts[normalizedType]) {
          roomCounts[normalizedType] = 0;
        }
        roomCounts[normalizedType]++;
      });

      // Convert tourist counts to room counts (2 tourists per DBL/TWN, 1 per SNGL)
      const recalculatedRooms = [];

      if (roomCounts['DBL'] && roomCounts['DBL'] > 0) {
        recalculatedRooms.push({
          id: acc.rooms.find(r => r.roomTypeCode === 'DBL')?.id || null,
          roomTypeCode: 'DBL',
          roomsCount: Math.ceil(roomCounts['DBL'] / 2), // 2 tourists per room, round up for odd numbers
          pricePerNight: roomPrices['DBL'] || 0,
          accommodationRoomType: acc.rooms.find(r => r.roomTypeCode === 'DBL')?.accommodationRoomType
        });
      }

      if (roomCounts['TWN'] && roomCounts['TWN'] > 0) {
        recalculatedRooms.push({
          id: acc.rooms.find(r => r.roomTypeCode === 'TWN')?.id || null,
          roomTypeCode: 'TWN',
          roomsCount: Math.ceil(roomCounts['TWN'] / 2), // 2 tourists per room, round up for odd numbers
          pricePerNight: roomPrices['TWN'] || 0,
          accommodationRoomType: acc.rooms.find(r => r.roomTypeCode === 'TWN')?.accommodationRoomType
        });
      }

      if (roomCounts['SNGL'] && roomCounts['SNGL'] > 0) {
        recalculatedRooms.push({
          id: acc.rooms.find(r => r.roomTypeCode === 'SNGL')?.id || null,
          roomTypeCode: 'SNGL',
          roomsCount: roomCounts['SNGL'], // 1 tourist per room
          pricePerNight: roomPrices['SNGL'] || 0,
          accommodationRoomType: acc.rooms.find(r => r.roomTypeCode === 'SNGL')?.accommodationRoomType
        });
      }

      if (roomCounts['TRPL'] && roomCounts['TRPL'] > 0) {
        recalculatedRooms.push({
          id: acc.rooms.find(r => r.roomTypeCode === 'TRPL')?.id || null,
          roomTypeCode: 'TRPL',
          roomsCount: Math.ceil(roomCounts['TRPL'] / 3), // 3 tourists per room, round up
          pricePerNight: roomPrices['TRPL'] || 0,
          accommodationRoomType: acc.rooms.find(r => r.roomTypeCode === 'TRPL')?.accommodationRoomType
        });
      }

      // Use recalculated rooms if we have tourists, otherwise use original rooms
      const roomsForCalculation = touristsForThisAccommodation.length > 0 ? recalculatedRooms : acc.rooms;

      const totals = calculateAccommodationTotals(roomsForCalculation, acc.nights, touristsWithCustomDates, acc, tourists);
      return {
        ...acc,
        rooms: roomsForCalculation, // Override with recalculated rooms based on tourists
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

    console.log('📥 POST /accommodations:', { hotelId, checkInDate, checkOutDate });

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

    console.log(`   → Hotel: ${hotel.name} (${hotel.city?.name})`);

    // Автоматическая корректировка дат для Turkmenistan отелей
    // Для TM туристов нужны полные даты (3 ночи), UZ туристы уезжают на 1 день раньше
    const cityName = hotel.city?.name?.toLowerCase() || '';
    const isTurkmenistanHotel = cityName.includes('хива') || cityName.includes('khiva') ||
                                 cityName.includes('туркмен') || cityName.includes('turkmen');

    if (isTurkmenistanHotel) {
      // Добавляем +1 день к checkout date для TM туристов (полные даты)
      checkOut.setDate(checkOut.getDate() + 1);
      console.log(`   ✅ Turkmenistan hotel: checkout adjusted from ${checkOutDate} to ${checkOut.toISOString().split('T')[0]}`);
    }

    // Рассчитываем количество ночей ПОСЛЕ корректировки дат
    const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

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

    // Load tourists to calculate extra nights
    const tourists = await prisma.tourist.findMany({
      where: { bookingId: parseInt(id) }
    });

    // Filter tourists for this accommodation
    const accTourists = tourists.filter(t => {
      if (!t.checkInDate || !t.checkOutDate) return false;

      const accCheckIn = new Date(accommodation.checkInDate);
      const accCheckOut = new Date(accommodation.checkOutDate);
      const touristCheckIn = new Date(t.checkInDate);
      const touristCheckOut = new Date(t.checkOutDate);

      return touristCheckIn <= accCheckOut && touristCheckOut >= accCheckIn;
    });

    // Добавляем итоги с учётом индивидуальных дат туристов
    const totals = calculateAccommodationTotals(accommodation.rooms, nights, accTourists, accommodation, tourists);

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

    // Load tourists to calculate extra nights
    const tourists = await prisma.tourist.findMany({
      where: { bookingId: updatedAccommodation.bookingId }
    });

    // Filter tourists for this accommodation
    const accTourists = tourists.filter(t => {
      if (!t.checkInDate || !t.checkOutDate) return false;

      const accCheckIn = new Date(updatedAccommodation.checkInDate);
      const accCheckOut = new Date(updatedAccommodation.checkOutDate);
      const touristCheckIn = new Date(t.checkInDate);
      const touristCheckOut = new Date(t.checkOutDate);

      return touristCheckIn <= accCheckOut && touristCheckOut >= accCheckIn;
    });

    // Добавляем итоги с учётом индивидуальных дат туристов
    const totals = calculateAccommodationTotals(updatedAccommodation.rooms, nights, accTourists, updatedAccommodation, tourists);

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

    // Check if accommodation exists first
    const existing = await prisma.accommodation.findUnique({
      where: { id: parseInt(accId) }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Размещение не найдено' });
    }

    await prisma.accommodation.delete({ where: { id: parseInt(accId) } });

    res.json({ message: 'Размещение удалено' });
  } catch (error) {
    console.error('Delete accommodation error:', error);

    // Handle P2025 error (record not found)
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Размещение не найдено' });
    }

    res.status(500).json({ error: 'Ошибка удаления размещения' });
  }
});

// GET /api/bookings/:id/debug-rooms - Debug room preferences for a booking
router.get('/:id/debug-rooms', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(id) },
      include: {
        tourists: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            roomPreference: true
          }
        }
      }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Count room preferences
    let dblCount = 0;
    let twnCount = 0;
    let snglCount = 0;
    let otherCount = 0;

    const roomDetails = booking.tourists.map(tourist => {
      const roomPref = (tourist.roomPreference || '').toUpperCase().trim();
      let category = 'OTHER';

      // DZ or DBL = Double room (accept both original and mapped codes)
      if (roomPref === 'DZ' || roomPref === 'DBL' || roomPref.includes('DBL') || roomPref.includes('DOUBLE')) {
        dblCount++;
        category = 'DBL';
      }
      // EZ or SNGL = Single room (accept both original and mapped codes)
      else if (roomPref === 'EZ' || roomPref === 'SNGL' || roomPref === 'SGL' || roomPref.includes('SNGL') || roomPref.includes('SINGLE')) {
        snglCount++;
        category = 'SNGL';
      }
      // TWN = Twin room
      else if (roomPref === 'TWN' || roomPref.includes('TWN') || roomPref.includes('TWIN')) {
        twnCount++;
        category = 'TWN';
      } else {
        otherCount++;
      }

      return {
        id: tourist.id,
        name: `${tourist.firstName} ${tourist.lastName}`,
        roomPreference: tourist.roomPreference,
        category
      };
    });

    res.json({
      bookingId: booking.id,
      bookingNumber: booking.bookingNumber,
      totalTourists: booking.tourists.length,
      counts: {
        dblCount,
        twnCount,
        snglCount,
        otherCount
      },
      calculatedRooms: {
        roomsDbl: Math.ceil(dblCount / 2),
        roomsTwn: Math.ceil(twnCount / 2),
        roomsSngl: snglCount
      },
      currentBookingRooms: {
        roomsDbl: booking.roomsDbl,
        roomsTwn: booking.roomsTwn,
        roomsSngl: booking.roomsSngl
      },
      tourists: roomDetails
    });
  } catch (error) {
    console.error('Debug rooms error:', error);
    res.status(500).json({ error: 'Error debugging rooms' });
  }
});

// POST /api/bookings/recalculate-rooms - Recalculate room counts for all bookings (for testing)
router.post('/recalculate-rooms', authenticate, async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      include: {
        tourists: {
          select: { id: true, roomPreference: true }
        }
      }
    });

    let updated = 0;
    const results = [];

    for (const booking of bookings) {
      // Calculate room counts based on roomPreference
      let dblCount = 0;
      let twnCount = 0;
      let snglCount = 0;

      booking.tourists.forEach(tourist => {
        const roomPref = (tourist.roomPreference || '').toUpperCase().trim();

        // DZ or DBL = Double room (accept both original and mapped codes)
        if (roomPref === 'DZ' || roomPref === 'DBL' || roomPref.includes('DBL') || roomPref.includes('DOUBLE')) {
          dblCount++;
        }
        // EZ or SNGL = Single room (accept both original and mapped codes)
        else if (roomPref === 'EZ' || roomPref === 'SNGL' || roomPref === 'SGL' || roomPref.includes('SNGL') || roomPref.includes('SINGLE')) {
          snglCount++;
        }
        // TWN = Twin room
        else if (roomPref === 'TWN' || roomPref.includes('TWN') || roomPref.includes('TWIN')) {
          twnCount++;
        }
      });

      const roomsDbl = Math.ceil(dblCount / 2);
      const roomsTwn = Math.ceil(twnCount / 2);
      const roomsSngl = snglCount;

      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          roomsDbl,
          roomsTwn,
          roomsSngl
        }
      });

      updated++;
      results.push({
        bookingNumber: booking.bookingNumber,
        tourists: booking.tourists.length,
        dblCount,
        twnCount,
        snglCount,
        roomsDbl,
        roomsTwn,
        roomsSngl
      });
    }

    res.json({
      message: `Recalculated room counts for ${updated} bookings`,
      results
    });
  } catch (error) {
    console.error('Recalculate rooms error:', error);
    res.status(500).json({ error: 'Error recalculating room counts' });
  }
});

// GET /api/bookings/debug/count-by-type - Debug endpoint to show booking counts by tour type
router.get('/debug/count-by-type', authenticate, async (req, res) => {
  try {
    const allBookings = await prisma.booking.findMany({
      include: {
        tourType: true
      },
      orderBy: { bookingNumber: 'asc' }
    });

    const byType = {};
    const details = {};
    const statusCounts = {
      CONFIRMED: 0,
      IN_PROGRESS: 0,
      PENDING: 0,
      CANCELLED: 0,
      COMPLETED: 0
    };

    // Helper to calculate status based on PAX, departure date, and end date
    const calculateStatus = (pax, departureDate, endDate) => {
      const paxCount = parseInt(pax) || 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Check if tour has ended
      if (endDate) {
        const tourEndDate = new Date(endDate);
        tourEndDate.setHours(0, 0, 0, 0);
        if (tourEndDate < today) {
          return 'COMPLETED';
        }
      }

      if (departureDate) {
        const daysUntilDeparture = Math.ceil((new Date(departureDate) - today) / (1000 * 60 * 60 * 24));

        if (daysUntilDeparture < 30 && paxCount < 4) {
          return 'CANCELLED';
        }
      }

      if (paxCount >= 6) {
        return 'CONFIRMED';
      } else if (paxCount === 4 || paxCount === 5) {
        return 'IN_PROGRESS';
      } else {
        return 'PENDING';
      }
    };

    allBookings.forEach(booking => {
      const code = booking.tourType?.code || 'UNKNOWN';
      if (!byType[code]) {
        byType[code] = 0;
        details[code] = [];
      }
      byType[code]++;

      const calculatedStatus = calculateStatus(booking.pax, booking.departureDate, booking.endDate);
      statusCounts[calculatedStatus]++;

      details[code].push({
        id: booking.id,
        bookingNumber: booking.bookingNumber,
        departureDate: booking.departureDate,
        endDate: booking.endDate,
        pax: booking.pax,
        status: calculatedStatus
      });
    });

    const total = allBookings.length;

    console.log(`\n📊 BOOKING COUNT DEBUG:`);
    console.log(`   Total: ${total}`);
    console.log(`   Подтверждено (CONFIRMED): ${statusCounts.CONFIRMED}`);
    console.log(`   В процессе (IN_PROGRESS): ${statusCounts.IN_PROGRESS}`);
    console.log(`   Ожидает (PENDING): ${statusCounts.PENDING}`);
    console.log(`   Отменено (CANCELLED): ${statusCounts.CANCELLED}`);
    console.log(`   Завершено (COMPLETED): ${statusCounts.COMPLETED}`);
    Object.keys(byType).sort().forEach(code => {
      console.log(`   ${code}: ${byType[code]}`);
    });

    res.json({
      total,
      byType,
      details,
      statusCounts,
      expected: {
        ER: 22,
        CO: 13,
        KAS: 12,
        ZA: 8,
        total: 55
      },
      difference: {
        ER: 22 - (byType.ER || 0),
        CO: 13 - (byType.CO || 0),
        KAS: 12 - (byType.KAS || 0),
        ZA: 8 - (byType.ZA || 0),
        total: 55 - total
      }
    });
  } catch (error) {
    console.error('Debug count error:', error);
    res.status(500).json({ error: 'Error counting bookings' });
  }
});

// ============================================
// Accommodation-specific Rooming List
// ============================================

// GET /api/bookings/:id/accommodations/:accId/rooming-list
// Get rooming list for specific accommodation with hotel-specific dates
router.get('/:id/accommodations/:accId/rooming-list', authenticate, async (req, res) => {
  try {
    const { id, accId } = req.params;
    const bookingIdInt = parseInt(id);
    const accommodationIdInt = parseInt(accId);

    // Get current accommodation details
    const accommodation = await prisma.accommodation.findUnique({
      where: { id: accommodationIdInt },
      include: {
        hotel: {
          include: {
            city: true
          }
        }
      }
    });

    if (!accommodation) {
      return res.status(404).json({ error: 'Accommodation not found' });
    }

    // Determine if this is second visit to same Tashkent hotel
    const allAccommodations = await prisma.accommodation.findMany({
      where: { bookingId: bookingIdInt },
      include: {
        hotel: {
          include: {
            city: true
          }
        }
      },
      orderBy: { checkInDate: 'asc' }
    });

    // Filter Tashkent accommodations
    const tashkentAccommodations = allAccommodations.filter(acc => {
      const cityName = acc.hotel?.city?.name?.toLowerCase() || '';
      return cityName.includes('ташкент') || cityName.includes('tashkent') || cityName.includes('toshkent');
    });

    // Check if this is second visit to same hotel
    const isSecondVisitSameHotel = tashkentAccommodations.length > 1 &&
                                    tashkentAccommodations[tashkentAccommodations.length - 1].id === accommodationIdInt &&
                                    tashkentAccommodations[0].hotelId === tashkentAccommodations[tashkentAccommodations.length - 1].hotelId &&
                                    tashkentAccommodations[0].id !== tashkentAccommodations[tashkentAccommodations.length - 1].id;

    // Get all tourists for this booking
    let tourists = await prisma.tourist.findMany({
      where: { bookingId: bookingIdInt },
      orderBy: { lastName: 'asc' }
    });

    // Filter tourists for second visit - only UZ tourists return to Tashkent
    if (isSecondVisitSameHotel) {
      tourists = tourists.filter(t => {
        const placement = (t.accommodation || '').toLowerCase();
        const isUzbekistan = placement.includes('uzbek') || placement.includes('узбек') || placement === 'uz';
        return isUzbekistan;
      });
    }

    // Get accommodation-specific rooming list entries
    const roomingListEntries = await prisma.accommodationRoomingList.findMany({
      where: { accommodationId: accommodationIdInt },
      include: {
        tourist: true
      }
    });

    // Check if this is a Turkmenistan/Khiva hotel
    const cityName = accommodation.hotel?.city?.name?.toLowerCase() || '';
    const isTurkmenistanHotel = cityName.includes('хива') || cityName.includes('khiva') ||
                                 cityName.includes('туркмен') || cityName.includes('turkmen');

    // Merge tourists with accommodation-specific data
    const roomingList = tourists.map(tourist => {
      const entry = roomingListEntries.find(e => e.touristId === tourist.id);

      let checkInDate = entry?.checkInDate || tourist.checkInDate || accommodation.checkInDate;
      let checkOutDate = entry?.checkOutDate || tourist.checkOutDate || accommodation.checkOutDate;
      let remarks = tourist.remarks || '';

      // For UZ tourists in Turkmenistan hotels: they leave 1 day earlier
      const placement = (tourist.accommodation || '').toLowerCase();
      const isUzbekistan = placement.includes('uzbek') || placement.includes('узбек') || placement === 'uz';

      if (isTurkmenistanHotel && isUzbekistan) {
        console.log(`   🟢 UZ tourist in TM hotel: ${tourist.fullName || tourist.lastName}`);

        // If no custom dates, use accommodation dates and adjust checkout
        if (!checkInDate && !checkOutDate) {
          checkInDate = accommodation.checkInDate;
          checkOutDate = accommodation.checkOutDate;
          console.log(`      Using accommodation dates: ${checkInDate} - ${checkOutDate}`);
        }

        // Reduce checkout date by 1 day
        if (checkOutDate) {
          const originalCheckOut = checkOutDate;
          const date = new Date(checkOutDate);
          date.setDate(date.getDate() - 1);
          checkOutDate = date.toISOString();
          console.log(`      Adjusted checkout: ${originalCheckOut} → ${checkOutDate.split('T')[0]}`);
        }

        // Calculate nights
        if (checkInDate && checkOutDate) {
          const nights = Math.ceil((new Date(checkOutDate) - new Date(checkInDate)) / (1000 * 60 * 60 * 24));
          remarks = `${nights} Nights${remarks ? ' | ' + remarks : ''}`;
          console.log(`      Nights: ${nights}, Remarks: "${remarks}"`);
        }
      }

      return {
        ...tourist,
        checkInDate,
        checkOutDate,
        roomPreference: entry?.roomPreference || tourist.roomPreference,
        remarks,
        hasAccommodationOverride: !!entry
      };
    });

    res.json({ roomingList });
  } catch (error) {
    console.error('Get accommodation rooming list error:', error);
    res.status(500).json({ error: 'Error fetching rooming list' });
  }
});

// PUT /api/bookings/:id/accommodations/:accId/rooming-list/:touristId
// Update accommodation-specific dates for a tourist
router.put('/:id/accommodations/:accId/rooming-list/:touristId', authenticate, async (req, res) => {
  try {
    const { id, accId, touristId } = req.params;
    const { checkInDate, checkOutDate, roomPreference } = req.body;

    const data = {};
    if (checkInDate !== undefined) data.checkInDate = checkInDate ? new Date(checkInDate) : null;
    if (checkOutDate !== undefined) data.checkOutDate = checkOutDate ? new Date(checkOutDate) : null;
    if (roomPreference !== undefined) data.roomPreference = roomPreference;

    // Upsert: create if doesn't exist, update if exists
    const entry = await prisma.accommodationRoomingList.upsert({
      where: {
        accommodationId_touristId: {
          accommodationId: parseInt(accId),
          touristId: parseInt(touristId)
        }
      },
      create: {
        accommodationId: parseInt(accId),
        touristId: parseInt(touristId),
        ...data
      },
      update: data,
      include: {
        tourist: true
      }
    });

    res.json({ entry });
  } catch (error) {
    console.error('Update accommodation rooming list error:', error);
    res.status(500).json({ error: 'Error updating rooming list' });
  }
});

module.exports = router;

