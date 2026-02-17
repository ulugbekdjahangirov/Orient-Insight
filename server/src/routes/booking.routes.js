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
      limit = 100, // Increased from 50 to 100 to accommodate all bookings
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
          guide: { select: { id: true, name: true, dayRate: true, halfDayRate: true } },
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

    // DEBUG: Log bookings count by tourType
    const tourTypeCounts = {};
    bookingsWithCalculatedRooms.forEach(b => {
      const code = b.tourType?.code;
      if (code) {
        tourTypeCounts[code] = (tourTypeCounts[code] || 0) + 1;
      }
    });
    console.log(`📊 API Returning ${bookingsWithCalculatedRooms.length} total bookings:`, tourTypeCounts);
    console.log(`   Filters: tourTypeId=${tourTypeId}, guideId=${guideId}, status=${status}, page=${page}, limit=${limit}`);
    console.log(`   Total in DB matching filter: ${total}`);

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

    // Parse JSON fields
    if (booking.mainGuideData) {
      try {
        booking.mainGuideData = JSON.parse(booking.mainGuideData);
      } catch (e) {
        booking.mainGuideData = null;
      }
    }
    if (booking.additionalGuides) {
      try {
        booking.additionalGuides = JSON.parse(booking.additionalGuides);
      } catch (e) {
        booking.additionalGuides = null;
      }
    }
    if (booking.bergreiseleiter) {
      try {
        booking.bergreiseleiter = JSON.parse(booking.bergreiseleiter);
      } catch (e) {
        booking.bergreiseleiter = null;
      }
    }
    if (booking.itineraryHeader) {
      try {
        booking.itineraryHeader = JSON.parse(booking.itineraryHeader);
      } catch (e) {
        booking.itineraryHeader = null;
      }
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

    // Calculate arrivalDate as departureDate + 1 day
    const departureDateObj = new Date(departureDate);
    const arrivalDateObj = new Date(departureDateObj);
    arrivalDateObj.setDate(arrivalDateObj.getDate() + 1);

    const booking = await prisma.booking.create({
      data: {
        bookingNumber,
        tourTypeId: parseInt(tourTypeId),
        departureDate: departureDateObj,
        arrivalDate: arrivalDateObj, // Always departureDate + 1 day
        endDate: endDate ? new Date(endDate) : departureDateObj,
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
    console.log('🔄 PUT /bookings/:id', id, 'rlExchangeRate:', req.body.rlExchangeRate);
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
      guideFullDays,
      guideHalfDays,
      mainGuideData,
      additionalGuides,
      bergreiseleiter,
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
      assignedToId,
      rechnungFirma,
      rlExchangeRate,
      itineraryHeader
    } = req.body;

    const updateData = {};

    if (bookingNumber) updateData.bookingNumber = bookingNumber;
    if (tourTypeId) updateData.tourTypeId = parseInt(tourTypeId);
    if (country !== undefined) updateData.country = country || null;

    // Handle dates - arrivalDate is always departureDate + 1 day
    if (departureDate) {
      const departureDateObj = new Date(departureDate);
      const arrivalDateObj = new Date(departureDateObj);
      arrivalDateObj.setDate(arrivalDateObj.getDate() + 1);

      updateData.departureDate = departureDateObj;
      updateData.arrivalDate = arrivalDateObj; // Auto-sync: departureDate + 1 day
    }
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
    if (guideFullDays !== undefined) updateData.guideFullDays = parseFloat(guideFullDays) || 0;
    if (guideHalfDays !== undefined) updateData.guideHalfDays = parseFloat(guideHalfDays) || 0;
    if (mainGuideData !== undefined) updateData.mainGuideData = mainGuideData ? JSON.stringify(mainGuideData) : null;
    if (additionalGuides !== undefined) updateData.additionalGuides = additionalGuides ? JSON.stringify(additionalGuides) : null;
    if (bergreiseleiter !== undefined) updateData.bergreiseleiter = bergreiseleiter ? JSON.stringify(bergreiseleiter) : null;
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
    if (rechnungFirma !== undefined) updateData.rechnungFirma = rechnungFirma || null;
    if (rlExchangeRate !== undefined) updateData.rlExchangeRate = rlExchangeRate ? parseFloat(rlExchangeRate) : null;
    if (itineraryHeader !== undefined) updateData.itineraryHeader = itineraryHeader ? JSON.stringify(itineraryHeader) : null;

    if (rlExchangeRate !== undefined) {
      console.log('💾 Saving rlExchangeRate to DB:', updateData.rlExchangeRate);
    }

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
// NEW: Calculates cost based on each tourist's actual nights from Rooming List
function calculateAccommodationTotals(rooms, nights, tourists = [], accommodation = null, allTourists = []) {
  let totalRooms = 0;
  let totalGuests = 0;
  let totalCost = 0;

  // Build room price map
  const roomPrices = {};
  rooms.forEach(room => {
    const normalizedCode = normalizeRoomType(room.roomTypeCode);
    roomPrices[normalizedCode] = room.pricePerNight || 0;
    totalRooms += room.roomsCount || 0;

    // Calculate guests based on room type
    const guestsPerRoom = ['SNGL', 'SINGLE', 'EZ'].includes(normalizedCode) ? 1 :
                         ['TRPL', 'TRIPLE'].includes(normalizedCode) ? 3 :
                         ['QDPL', 'QUAD'].includes(normalizedCode) ? 4 : 2;
    totalGuests += (room.roomsCount || 0) * (room.guestsPerRoom || guestsPerRoom);
  });

  // Helper to normalize room type codes
  function normalizeRoomType(code) {
    const upper = (code || '').toUpperCase();
    if (['DBL', 'DOUBLE', 'DZ'].includes(upper)) return 'DBL';
    if (['TWN', 'TWIN'].includes(upper)) return 'TWN';
    if (['SNGL', 'SINGLE', 'EZ'].includes(upper)) return 'SNGL';
    if (['TRPL', 'TRIPLE'].includes(upper)) return 'TRPL';
    return upper;
  }

  // Check if we have rooming list data to calculate from
  const hasRoomingListData = allTourists.length > 0 && accommodation;

  if (hasRoomingListData) {
    // Calculate guest-nights from each tourist's actual dates
    const guestNightsByRoomType = {};

    const accCheckIn = new Date(accommodation.checkInDate);
    accCheckIn.setHours(0, 0, 0, 0);
    const accCheckOut = new Date(accommodation.checkOutDate);
    accCheckOut.setHours(0, 0, 0, 0);

    allTourists.forEach(tourist => {
      // Get tourist's dates - first check AccommodationRoomingList, then global dates, then use accommodation dates
      let touristCheckIn, touristCheckOut;

      // Check for accommodation-specific dates in accommodationRoomingList
      if (tourist.accommodationRoomingList && tourist.accommodationRoomingList.length > 0 && accommodation.id) {
        const roomingEntry = tourist.accommodationRoomingList.find(e => e.accommodationId === accommodation.id);
        if (roomingEntry) {
          touristCheckIn = roomingEntry.checkInDate ? new Date(roomingEntry.checkInDate) : null;
          touristCheckOut = roomingEntry.checkOutDate ? new Date(roomingEntry.checkOutDate) : null;
        }
      }

      // Fallback to global tourist dates
      if (!touristCheckIn && tourist.checkInDate) {
        touristCheckIn = new Date(tourist.checkInDate);
      }
      if (!touristCheckOut && tourist.checkOutDate) {
        touristCheckOut = new Date(tourist.checkOutDate);
      }

      // Default to accommodation dates if no custom dates
      let effectiveCheckIn = touristCheckIn || accCheckIn;
      let effectiveCheckOut = touristCheckOut || accCheckOut;
      effectiveCheckIn.setHours(0, 0, 0, 0);
      effectiveCheckOut.setHours(0, 0, 0, 0);

      // Clamp tourist dates to accommodation dates (tourist can't stay outside accommodation period)
      if (effectiveCheckIn < accCheckIn) effectiveCheckIn = new Date(accCheckIn);
      if (effectiveCheckOut > accCheckOut) effectiveCheckOut = new Date(accCheckOut);

      // Calculate this tourist's nights (0 if dates don't overlap)
      const touristNights = Math.max(0, Math.round((effectiveCheckOut - effectiveCheckIn) / (1000 * 60 * 60 * 24)));

      // Get normalized room type
      const roomType = normalizeRoomType(tourist.roomPreference);

      // Accumulate guest-nights
      if (!guestNightsByRoomType[roomType]) {
        guestNightsByRoomType[roomType] = 0;
      }
      guestNightsByRoomType[roomType] += touristNights;
    });

    // Convert guest-nights to cost
    // Check if this is PAX-based (Guesthouse/Yurta) - PAX pricing is per person, not per room
    const isPaxBased = roomPrices['PAX'] !== undefined && roomPrices['PAX'] > 0;

    // If no PAX price in rooms but accommodation hotel is Guesthouse/Yurta, get PAX price from hotel
    let paxPrice = roomPrices['PAX'] || 0;
    if (!isPaxBased && accommodation?.hotel?.stars && (accommodation.hotel.stars === 'Guesthouse' || accommodation.hotel.stars === 'Yurta')) {
      const hotelPaxRoomType = accommodation.hotel.roomTypes?.find(rt => rt.name === 'PAX');
      if (hotelPaxRoomType) {
        paxPrice = hotelPaxRoomType.pricePerNight || 0;
        console.log(`💡 PAX price from hotel room types: ${paxPrice} (${hotelPaxRoomType.currency})`);
      }
    }

    const isPaxBasedFinal = isPaxBased || (paxPrice > 0 && accommodation?.hotel?.stars && (accommodation.hotel.stars === 'Guesthouse' || accommodation.hotel.stars === 'Yurta'));

    Object.keys(guestNightsByRoomType).forEach(roomType => {
      const guestNights = guestNightsByRoomType[roomType];

      if (isPaxBasedFinal) {
        // For PAX-based accommodations (Guesthouse/Yurta), use PAX price for all tourists
        // PAX is per person per night, so cost = guestNights × price
        totalCost += guestNights * paxPrice;
      } else {
        const pricePerNight = roomPrices[roomType] || 0;
        // TWN and DBL: 2 guests share 1 room, so room-nights = guest-nights / 2
        // SNGL: 1 guest per room, so room-nights = guest-nights
        let roomNights;
        if (roomType === 'TWN' || roomType === 'DBL') {
          roomNights = guestNights / 2;
        } else {
          roomNights = guestNights;
        }
        totalCost += roomNights * pricePerNight;
      }
    });
  } else {
    // Fallback: standard calculation based on room count × nights
    for (const room of rooms) {
      totalCost += room.totalCost || ((room.roomsCount || 0) * (room.pricePerNight || 0) * nights);
    }
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

    console.log(`📋 GET /accommodations: Found ${accommodations.length} accommodations for booking ${id}:`, accommodations.map(a => ({ id: a.id, hotel: a.hotel?.name, totalCost: a.totalCost })));

    // Format dates as YYYY-MM-DD strings to avoid timezone issues
    const formattedAccommodations = accommodations.map(acc => ({
      ...acc,
      checkInDate: acc.checkInDate ? acc.checkInDate.toISOString().split('T')[0] : null,
      checkOutDate: acc.checkOutDate ? acc.checkOutDate.toISOString().split('T')[0] : null
    }));

    console.log(`   📅 First accommodation dates: ${formattedAccommodations[0]?.checkInDate} → ${formattedAccommodations[0]?.checkOutDate}`);

    // Simply return database values with formatted dates
    // Edit modal auto-saves calculated totals when opened
    res.json({ accommodations: formattedAccommodations });
  } catch (error) {
    console.error('Get accommodations error:', error);
    res.status(500).json({ error: 'Ошибка получения размещений' });
  }
});

// POST /api/bookings/:id/accommodations - Создать размещение
router.post('/:id/accommodations', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { hotelId, roomTypeId, roomTypeCode, checkInDate, checkOutDate, notes, rooms, totalCost, totalRooms, totalGuests } = req.body;

    console.log('📥 POST /accommodations:', { hotelId, checkInDate, checkOutDate });

    // Валидация обязательных полей
    if (!hotelId || !checkInDate || !checkOutDate) {
      return res.status(400).json({ error: 'Отель и даты обязательны' });
    }

    // CRITICAL: Parse dates as UTC to avoid timezone shift (+1 day bug)
    // new Date("2025-10-04") creates local midnight, which shifts to next day in some timezones
    // Solution: append "T00:00:00.000Z" to force UTC interpretation
    const checkIn = new Date(checkInDate + 'T00:00:00.000Z');
    const checkOut = new Date(checkOutDate + 'T00:00:00.000Z');

    console.log(`   ✓ Parsed dates as UTC: ${checkIn.toISOString().split('T')[0]} → ${checkOut.toISOString().split('T')[0]}`);

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
        totalCost: parseFloat(totalCost) || 0,
        totalRooms: parseInt(totalRooms) || 0,
        totalGuests: parseInt(totalGuests) || 0,
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

    // Simply return created accommodation from database
    // Frontend calculates and saves correct values
    res.status(201).json({ accommodation });
  } catch (error) {
    console.error('Create accommodation error:', error);
    res.status(500).json({ error: 'Ошибка создания размещения' });
  }
});

// PUT /api/bookings/:id/accommodations/:accId - Обновить размещение
router.put('/:id/accommodations/:accId', authenticate, async (req, res) => {
  try {
    const { accId } = req.params;
    const { hotelId, roomTypeId, roomTypeCode, checkInDate, checkOutDate, notes, rooms, totalCost, totalRooms, totalGuests } = req.body;

    console.log('📝 PUT /accommodations/:accId - Received data:', { accId, totalCost, totalRooms, totalGuests, roomsCount: rooms?.length });

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

    // Сохраняем totalCost, totalRooms, totalGuests из frontend
    if (totalCost !== undefined) {
      updateData.totalCost = parseFloat(totalCost) || 0;
    }
    if (totalRooms !== undefined) {
      updateData.totalRooms = parseInt(totalRooms) || 0;
    }
    if (totalGuests !== undefined) {
      updateData.totalGuests = parseInt(totalGuests) || 0;
    }

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

    // Simply return updated accommodation from database
    // Frontend calculates and saves correct values
    res.json({ accommodation: updatedAccommodation });
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

    // Get booking details for departureDate and tour type
    const booking = await prisma.booking.findUnique({
      where: { id: bookingIdInt },
      include: {
        tourType: true
      }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
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

    // Check if this is the first accommodation (earliest check-in date)
    const isFirstAccommodation = allAccommodations.length > 0 && allAccommodations[0].id === accommodationIdInt;

    // Check if this is the last accommodation (latest check-out date)
    const isLastAccommodation = allAccommodations.length > 0 &&
                                 allAccommodations[allAccommodations.length - 1].id === accommodationIdInt;

    // CRITICAL: Check if this is a MIXED group (UZ + TM) for Khiva/Turkmenistan logic
    // Only apply -1 day adjustment for UZ tourists if group is mixed
    let isMixedGroup = false;
    if (isTurkmenistanHotel) {
      let hasUZ = false;
      let hasTM = false;
      tourists.forEach(t => {
        const placement = (t.accommodation || '').toLowerCase();
        if (placement.includes('uzbek') || placement.includes('узбек') || placement === 'uz') {
          hasUZ = true;
        }
        if (placement.includes('turkmen') || placement.includes('туркмен') || placement === 'tm') {
          hasTM = true;
        }
      });
      isMixedGroup = hasUZ && hasTM; // Check if group has both UZ and TM tourists
      console.log(`   📊 Khiva Hotel Group Analysis: UZ=${hasUZ}, TM=${hasTM}, Mixed=${isMixedGroup}`);
    }

    // CRITICAL FIX: For ER MIXED groups, filter last Tashkent hotel to only UZ tourists
    // This handles case where 6th hotel (Arien Plaza) is DIFFERENT from first Tashkent hotel
    const currentCityName = accommodation.hotel?.city?.name?.toLowerCase() || '';
    const isTashkentHotel = currentCityName.includes('ташкент') || currentCityName.includes('tashkent') || currentCityName.includes('toshkent');
    const isLastTashkentHotel = isTashkentHotel &&
                                 tashkentAccommodations.length > 0 &&
                                 tashkentAccommodations[tashkentAccommodations.length - 1].id === accommodationIdInt;
    const tourTypeCode = booking?.tourType?.code;
    const isERTour = tourTypeCode === 'ER';

    // For Tashkent hotels, recalculate isMixedGroup if it wasn't already calculated
    if (!isTurkmenistanHotel && isTashkentHotel) {
      let hasUZ = false;
      let hasTM = false;
      tourists.forEach(t => {
        const placement = (t.accommodation || '').toLowerCase();
        if (placement.includes('uzbek') || placement.includes('узбек') || placement === 'uz') {
          hasUZ = true;
        }
        if (placement.includes('turkmen') || placement.includes('туркмен') || placement === 'tm') {
          hasTM = true;
        }
      });
      isMixedGroup = hasUZ && hasTM;
      console.log(`   📊 Tashkent Hotel Group Analysis: UZ=${hasUZ}, TM=${hasTM}, Mixed=${isMixedGroup}`);
    }

    // For ER MIXED groups: Last Tashkent hotel = only UZ tourists (6th hotel return)
    if (isERTour && isMixedGroup && isLastTashkentHotel && !isSecondVisitSameHotel) {
      console.log(`   🔥 ER MIXED: Last Tashkent hotel (${accommodation.hotel?.name}) - filtering to UZ tourists only`);
      const beforeCount = tourists.length;
      tourists = tourists.filter(t => {
        const placement = (t.accommodation || '').toLowerCase();
        const isUzbekistan = placement.includes('uzbek') || placement.includes('узбек') || placement === 'uz';
        return isUzbekistan;
      });
      console.log(`   ✅ Filtered from ${beforeCount} to ${tourists.length} UZ tourists`);
    }

    // Merge tourists with accommodation-specific data
    const roomingList = tourists.map(tourist => {
      const entry = roomingListEntries.find(e => e.touristId === tourist.id);

      // Get tour type code once for all logic
      const tourTypeCode = booking?.tourType?.code;

      // Priority:
      // 1) AccommodationRoomingList entry (explicitly set dates)
      // 2) For FIRST hotel: tourist's global checkInDate (for early arrivals like Mrs. Baetgen)
      // 3) For LAST hotel: tourist's global checkOutDate (for late departures)
      // 4) Accommodation dates (default)
      let checkInDate, checkOutDate;

      if (entry?.checkInDate) {
        // Priority 1: Explicitly saved date in AccommodationRoomingList
        checkInDate = entry.checkInDate;
      } else if (isFirstAccommodation) {
        // Priority 2: For FIRST hotel, use tourist's arrival date
        //
        // For ER tours: Tour start date in PDF = departure from Germany
        //               Arrival in Uzbekistan = tour start + 1 day
        //
        // For ZA tours: Tourist checkInDate already represents ARRIVAL in Uzbekistan
        //               (calculated as booking.departureDate + 4 days during PDF import)
        //               Do NOT add another +1 day!
        //
        // CRITICAL: Use UTC date manipulation to avoid timezone issues
        const tourStartDate = tourist.checkInDate ? new Date(tourist.checkInDate) : new Date(booking.departureDate);
        const year = tourStartDate.getUTCFullYear();
        const month = tourStartDate.getUTCMonth();
        const day = tourStartDate.getUTCDate();

        // For ZA/KAS tours: tourist.checkInDate is already arrival date (start from Kazakhstan/Kyrgyzstan), don't add +1
        // For CO/ER tours: fly from Germany, add +1 day to get arrival date in Uzbekistan
        const daysToAdd = (tourTypeCode === 'ZA' || tourTypeCode === 'KAS') ? 0 : 1;
        const arrivalDate = new Date(Date.UTC(year, month, day + daysToAdd));
        checkInDate = arrivalDate.toISOString();
      } else {
        // Priority 3: Use accommodation default dates
        checkInDate = accommodation.checkInDate;
      }

      if (entry?.checkOutDate) {
        checkOutDate = entry.checkOutDate;
      } else if (isLastAccommodation && tourist.checkOutDate && tourTypeCode === 'ER') {
        // CRITICAL: Only use tourist's global checkout date for LAST hotel in ER tours
        // For ZA/CO/KAS tours: tour continues to other countries after last hotel,
        // so tourist.checkOutDate is END of tour (including Kazakhstan/etc), not hotel checkout
        // For first/middle hotels, ALWAYS use accommodation checkout date
        checkOutDate = tourist.checkOutDate;
      } else {
        // For all hotels in ZA/CO/KAS tours, and for first/middle hotels in ER tours
        checkOutDate = accommodation.checkOutDate;
      }

      let remarks = tourist.remarks || '';

      // CRITICAL FOR ER TOURS: UZ tourists in Khiva/Turkmenistan hotels leave 1 day earlier
      // This logic handles Malika Khorazm case where UZ tourists stay 2 nights, TM tourists stay 3 nights
      // IMPORTANT: Only apply -1 day adjustment if group is MIXED (has both UZ and TM)
      // If all-UZ or all-TM, use accommodation dates as-is
      const placement = (tourist.accommodation || '').toLowerCase();
      const isUzbekistan = placement.includes('uzbek') || placement.includes('узбек') || placement === 'uz';

      if (isTurkmenistanHotel && isUzbekistan && isMixedGroup) {
        console.log(`   🟢 UZ tourist in TM hotel (MIXED group): ${tourist.fullName || tourist.lastName}`);

        // If no custom dates, use accommodation dates and adjust checkout
        if (!checkInDate && !checkOutDate) {
          checkInDate = accommodation.checkInDate;
          checkOutDate = accommodation.checkOutDate;
          console.log(`      Using accommodation dates: ${checkInDate} - ${checkOutDate}`);
        }

        // Reduce checkout date by 1 day (ONLY for mixed groups)
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
      } else if (isTurkmenistanHotel && isUzbekistan && !isMixedGroup) {
        // All-UZ group: use accommodation dates as-is
        console.log(`   ✅ UZ tourist in TM hotel (ALL-UZ group): ${tourist.fullName || tourist.lastName}`);
        console.log(`      Accommodation: ${accommodation.checkInDate?.toISOString().split('T')[0]} → ${accommodation.checkOutDate?.toISOString().split('T')[0]}`);
        console.log(`      Returning: ${checkInDate ? new Date(checkInDate).toISOString().split('T')[0] : 'null'} → ${checkOutDate ? new Date(checkOutDate).toISOString().split('T')[0] : 'null'}`);
      }

      // Convert dates to YYYY-MM-DD strings to avoid timezone issues
      const checkInStr = checkInDate ? new Date(checkInDate).toISOString().split('T')[0] : null;
      const checkOutStr = checkOutDate ? new Date(checkOutDate).toISOString().split('T')[0] : null;

      return {
        ...tourist,
        checkInDate: checkInStr,
        checkOutDate: checkOutStr,
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

// ============================================
// ACCOMMODATION TEMPLATES API (for ER tours)
// ============================================

// GET /api/accommodations/templates/:tourTypeCode - Get accommodation template for tour type
router.get('/templates/:tourTypeCode', authenticate, async (req, res) => {
  try {
    const { tourTypeCode } = req.params;

    const templates = await prisma.accommodationTemplate.findMany({
      where: { tourTypeCode: tourTypeCode.toUpperCase() },
      orderBy: { sortOrder: 'asc' }
    });

    console.log(`🏨 Loaded ${templates.length} accommodation templates for ${tourTypeCode}`);
    res.json({ templates });
  } catch (error) {
    console.error('Error fetching accommodation templates:', error);
    res.status(500).json({ error: 'Ошибка получения шаблонов размещений' });
  }
});

// PUT /api/accommodations/templates/:tourTypeCode - Save accommodation template for tour type
router.put('/templates/:tourTypeCode', authenticate, async (req, res) => {
  try {
    const { tourTypeCode } = req.params;
    const { accommodations } = req.body;

    console.log(`💾 Saving ${accommodations?.length} accommodation templates for ${tourTypeCode}`);

    if (!Array.isArray(accommodations)) {
      return res.status(400).json({ error: 'accommodations должен быть массивом' });
    }

    // Delete existing templates for this tour type
    await prisma.accommodationTemplate.deleteMany({
      where: { tourTypeCode: tourTypeCode.toUpperCase() }
    });

    // Create new templates
    const createdTemplates = await Promise.all(
      accommodations.map((acc, index) =>
        prisma.accommodationTemplate.create({
          data: {
            tourTypeCode: tourTypeCode.toUpperCase(),
            hotelId: acc.hotelId || acc.hotel?.id || null,
            hotelName: acc.hotelName || acc.hotel?.name || null,
            cityId: acc.cityId || acc.hotel?.cityId || null,
            cityName: acc.cityName || acc.hotel?.city?.name || null,
            checkInOffset: acc.checkInOffset || 0,
            checkOutOffset: acc.checkOutOffset || 1,
            nights: acc.nights || 1,
            sortOrder: index
          }
        })
      )
    );

    console.log(`✅ Saved ${createdTemplates.length} accommodation templates for ${tourTypeCode}`);
    res.json({ templates: createdTemplates, message: 'Шаблон размещений сохранён' });
  } catch (error) {
    console.error('Error saving accommodation templates:', error);
    res.status(500).json({ error: 'Ошибка сохранения шаблонов размещений' });
  }
});

// POST /api/bookings/:id/load-template - Load accommodations from template with PAX split logic
router.post('/:id/load-template', authenticate, async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);

    // Get booking with tourists
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        tourType: true,
        tourists: true,
        accommodations: true
      }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const tourTypeCode = booking.tourType?.code;
    if (!tourTypeCode) {
      return res.status(400).json({ error: 'Tour type not defined' });
    }

    console.log(`\n🏨 Loading accommodation template for ${booking.bookingNumber} (${tourTypeCode})`);

    // STEP 1: Delete existing accommodations
    if (booking.accommodations.length > 0) {
      console.log(`🗑️ Deleting ${booking.accommodations.length} existing accommodations...`);
      await prisma.accommodation.deleteMany({
        where: { bookingId: bookingId }
      });
    }

    // STEP 2: Calculate PAX split from tourists
    const paxUzb = booking.tourists.filter(t => {
      const placement = (t.accommodation || '').toLowerCase();
      return placement.includes('uzbek') || placement.includes('узбек') || placement === 'uz' || !placement.includes('turkmen');
    }).length;

    const paxTkm = booking.tourists.filter(t => {
      const placement = (t.accommodation || '').toLowerCase();
      return placement.includes('turkmen') || placement.includes('туркмен') || placement === 'tm';
    }).length;

    console.log(`📊 PAX Split: UZB=${paxUzb}, TKM=${paxTkm}`);

    // STEP 3: Load template
    const templates = await prisma.accommodationTemplate.findMany({
      where: { tourTypeCode: tourTypeCode },
      orderBy: { sortOrder: 'asc' }
    });

    if (templates.length === 0) {
      return res.status(404).json({ error: `Template for ${tourTypeCode} not found` });
    }

    console.log(`📋 Loaded ${templates.length} hotels from template\n`);

    // STEP 4: Create accommodations with PAX split logic
    const departureDate = new Date(booking.departureDate);

    // CRITICAL: For ZA tours, add 4 days to get actual arrival in Uzbekistan
    // ZA tours: Excel date → booking.departureDate (+4) → Uzbekistan arrival (+4)
    // Example: Excel 23.08 → departureDate 27.08 → arrival 31.08
    const baseDate = tourTypeCode === 'ZA'
      ? new Date(departureDate.getTime() + (4 * 24 * 60 * 60 * 1000)) // +4 days
      : departureDate;

    if (tourTypeCode === 'ZA') {
      console.log(`📅 ZA tour: Base date adjusted from ${departureDate.toISOString().split('T')[0]} to ${baseDate.toISOString().split('T')[0]} (arrival in Uzbekistan)`);
    }

    const createdAccommodations = [];

    for (let i = 0; i < templates.length; i++) {
      const template = templates[i];
      const hotelName = (template.hotelName || '').toLowerCase();

      // Skip logic: 2nd Arien Plaza (last hotel) only for UZB tourists
      const isLastArienPlaza = hotelName.includes('arien') && hotelName.includes('plaza') && i >= 5;
      if (isLastArienPlaza && paxTkm > 0 && paxUzb === 0) {
        console.log(`⏭️  Skip: ${template.hotelName} (TKM-only, no Tashkent at end)`);
        continue;
      }

      // Calculate check-in date from base date (arrival in Uzbekistan for ZA tours)
      const checkInDate = new Date(baseDate);
      checkInDate.setDate(checkInDate.getDate() + template.checkInOffset);

      // CRITICAL: Adjust nights for Malika Khorazm based on group composition
      // 3 VARIANTS:
      // Variant 1 (Mixed UZ+TM): Hotel 3 nights, UZ tourists 2 nights, TM tourists 3 nights
      // Variant 2 (All UZ): Hotel 2 nights, all tourists 2 nights
      // Variant 3 (All TM): Hotel 3 nights, all tourists 3 nights
      const isMalikaKhorazm = hotelName.includes('malika') && (hotelName.includes('khorazm') || hotelName.includes('хорезм') || hotelName.includes('хива'));

      let nights = template.nights;
      if (isMalikaKhorazm) {
        if (paxTkm === 0 && paxUzb > 0) {
          // Variant 2: UZB-only group
          nights = 2;
          console.log(`📅 ${template.hotelName}: 2 nights (UZB-only group)`);
        } else if (paxTkm > 0) {
          // Variant 1 (Mixed) or Variant 3 (TKM-only): Hotel stays 3 nights
          nights = 3;
          const groupType = paxUzb > 0 ? 'MIXED UZ+TM' : 'TKM-only';
          console.log(`📅 ${template.hotelName}: 3 nights (${groupType} group)`);
        }
      } else {
        console.log(`✓  ${template.hotelName}: ${nights} nights`);
      }

      // Calculate checkout date from check-in + nights (CORRECT method)
      const checkOutDate = new Date(checkInDate);
      checkOutDate.setDate(checkOutDate.getDate() + nights);

      // Get hotel with room types
      const hotel = await prisma.hotel.findUnique({
        where: { id: template.hotelId },
        include: { roomTypes: true }
      });

      if (!hotel) {
        console.log(`⚠️  Hotel ID ${template.hotelId} not found, skipping`);
        continue;
      }

      // Get room types (prefer ones with tourist tax enabled for UZS pricing)
      const dblRoom = hotel.roomTypes.find(rt =>
        rt.name === 'DBL' && rt.currency === 'UZS' && rt.touristTaxEnabled
      ) || hotel.roomTypes.find(rt => rt.name === 'DBL');

      const snglRoom = hotel.roomTypes.find(rt =>
        rt.name === 'SNGL' && rt.currency === 'UZS' && rt.touristTaxEnabled
      ) || hotel.roomTypes.find(rt => rt.name === 'SNGL');

      if (snglRoom) {
        console.log(`   📝 SNGL room selected: ${snglRoom.pricePerNight} ${snglRoom.currency}, Tax: ${snglRoom.touristTaxEnabled}`);
      }

      const twnRoom = hotel.roomTypes.find(rt =>
        rt.name === 'TWN' && rt.currency === 'UZS' && rt.touristTaxEnabled
      ) || hotel.roomTypes.find(rt => rt.name === 'TWN');

      const paxRoom = hotel.roomTypes.find(rt => rt.name === 'PAX');

      // Calculate total price with VAT and tourist tax (same logic as frontend Hotels module)
      const calculateTotalPrice = (roomType, hotelTotalRooms) => {
        if (!roomType) return 0;

        const basePrice = parseFloat(roomType.pricePerNight) || 0;

        // Add VAT if included
        const vatAmount = roomType.vatIncluded ? basePrice * 0.12 : 0;
        let totalPrice = basePrice + vatAmount;

        // Add tourist tax if enabled (per person, not per room)
        if (roomType.touristTaxEnabled && roomType.brvValue > 0) {
          // Calculate tax percentage based on hotel's total rooms
          let taxPercentage = 0.15; // default >40 rooms
          if (hotelTotalRooms <= 10) taxPercentage = 0.05;
          else if (hotelTotalRooms <= 40) taxPercentage = 0.10;

          // Tourist tax is calculated per person (maxGuests)
          const touristTax = roomType.brvValue * taxPercentage * (roomType.maxGuests || 1);
          totalPrice += touristTax;
        }

        return Math.round(totalPrice);
      };

      const hotelTotalRooms = hotel.totalRooms || 0;
      const rooms = [];

      // For guesthouses/yurta (PAX pricing)
      if (hotel.stars === 'Guesthouse' || hotel.stars === 'Yurta') {
        if (paxRoom) {
          const pricePerNight = calculateTotalPrice(paxRoom, hotelTotalRooms);
          const totalCost = booking.tourists.length * pricePerNight * nights;

          rooms.push({
            roomTypeCode: 'PAX',
            roomsCount: booking.tourists.length,
            guestsPerRoom: 1,
            pricePerNight: pricePerNight,
            totalCost: totalCost
          });
        }
      } else {
        // Count tourists by room preference
        const dblTourists = booking.tourists.filter(t =>
          (t.roomPreference || '').toUpperCase() === 'DBL' ||
          (t.roomPreference || '').toUpperCase() === 'DZ' ||
          (t.roomPreference || '').toUpperCase() === 'DOUBLE'
        );
        const twnTourists = booking.tourists.filter(t =>
          (t.roomPreference || '').toUpperCase() === 'TWN' ||
          (t.roomPreference || '').toUpperCase() === 'TWIN'
        );
        const snglTourists = booking.tourists.filter(t =>
          (t.roomPreference || '').toUpperCase() === 'SNGL' ||
          (t.roomPreference || '').toUpperCase() === 'EZ' ||
          (t.roomPreference || '').toUpperCase() === 'SINGLE'
        );

        // DBL rooms: calculate price with VAT and tourist tax
        if (dblTourists.length > 0 && dblRoom) {
          const roomCount = Math.ceil(dblTourists.length / 2);
          const pricePerNight = calculateTotalPrice(dblRoom, hotelTotalRooms);
          const totalCost = roomCount * pricePerNight * nights;

          rooms.push({
            roomTypeCode: 'DBL',
            roomsCount: roomCount,
            guestsPerRoom: 2,
            pricePerNight: pricePerNight,
            totalCost: totalCost
          });
        }

        // TWN rooms: calculate price with VAT and tourist tax
        if (twnTourists.length > 0 && twnRoom) {
          const roomCount = Math.ceil(twnTourists.length / 2);
          const pricePerNight = calculateTotalPrice(twnRoom, hotelTotalRooms);
          const totalCost = roomCount * pricePerNight * nights;

          rooms.push({
            roomTypeCode: 'TWN',
            roomsCount: roomCount,
            guestsPerRoom: 2,
            pricePerNight: pricePerNight,
            totalCost: totalCost
          });
        }

        // SNGL rooms: calculate price with VAT and tourist tax
        if (snglTourists.length > 0 && snglRoom) {
          const pricePerNight = calculateTotalPrice(snglRoom, hotelTotalRooms);
          const totalCost = snglTourists.length * pricePerNight * nights;

          rooms.push({
            roomTypeCode: 'SNGL',
            roomsCount: snglTourists.length,
            guestsPerRoom: 1,
            pricePerNight: pricePerNight,
            totalCost: totalCost
          });
        }
      }

      // Calculate total: sum of all room costs
      const totalCost = rooms.reduce((sum, room) => sum + room.totalCost, 0);
      const totalRooms = rooms.reduce((sum, room) => sum + room.roomsCount, 0);

      // Create accommodation with rooms
      const accommodation = await prisma.accommodation.create({
        data: {
          bookingId: bookingId,
          hotelId: template.hotelId,
          checkInDate: checkInDate,
          checkOutDate: checkOutDate,
          nights: nights,
          totalCost: totalCost,
          totalRooms: totalRooms,
          totalGuests: booking.tourists.length,
          rooms: {
            create: rooms
          }
        }
      });

      console.log(`   💰 ${hotel.name}: ${totalRooms} rooms, $${totalCost}`);
      createdAccommodations.push(accommodation);
    }

    console.log(`\n✅ Created ${createdAccommodations.length} accommodations for ${booking.bookingNumber}\n`);

    // STEP 5: Update tourist check-in/check-out dates to match first accommodation
    // This ensures rooming list calculations use correct hotel dates, not tour-wide dates
    if (createdAccommodations.length > 0 && booking.tourists.length > 0) {
      const firstAccommodation = createdAccommodations[0];
      console.log(`📅 Updating ${booking.tourists.length} tourists' dates to match first hotel (${firstAccommodation.checkInDate.toISOString().split('T')[0]} - ${firstAccommodation.checkOutDate.toISOString().split('T')[0]})`);

      await prisma.tourist.updateMany({
        where: { bookingId: bookingId },
        data: {
          checkInDate: firstAccommodation.checkInDate,
          checkOutDate: firstAccommodation.checkOutDate
        }
      });

      console.log(`✅ Updated tourist dates for accurate rooming list calculations\n`);
    }

    res.json({
      accommodations: createdAccommodations,
      message: `Загружено ${createdAccommodations.length} размещений из шаблона ${tourTypeCode}`
    });

  } catch (error) {
    console.error('❌ Error loading accommodations from template:', error);
    res.status(500).json({ error: 'Ошибка загрузки шаблона: ' + error.message });
  }
});

// GET /api/bookings/:id/storno-preview - Stornierungsschreiben (Cancellation letter) PDF
router.get('/:id/storno-preview', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { hotelName, hotelCity, checkIn, checkOut, rooms, bookingNumber, pax } = req.query;

    // Format dates to German format
    const formatDE = (dateStr) => {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      const months = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
      return `${d.getDate()}. ${months[d.getMonth()]} ${d.getFullYear()}`;
    };

    const today = new Date();
    const todayDE = formatDE(today.toISOString().split('T')[0]);
    const checkInDE = formatDE(checkIn);
    const checkOutDE = formatDE(checkOut);

    const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Storno ${bookingNumber} - ${hotelName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12pt; color: #222; background: white; padding: 40px 50px; }
    .header { margin-bottom: 40px; }
    .sender { font-size: 10pt; color: #666; border-bottom: 1px solid #ccc; padding-bottom: 6px; margin-bottom: 20px; }
    .recipient { margin-bottom: 30px; }
    .recipient strong { font-size: 13pt; }
    .date-line { text-align: right; margin-bottom: 30px; font-size: 11pt; color: #555; }
    .subject { font-size: 13pt; font-weight: bold; margin-bottom: 24px; border-bottom: 2px solid #e55; padding-bottom: 8px; color: #c33; }
    .body p { margin-bottom: 14px; line-height: 1.6; }
    .details-box { background: #fff8f8; border: 1px solid #f5c6c6; border-radius: 6px; padding: 16px 20px; margin: 20px 0; }
    .details-box table { width: 100%; border-collapse: collapse; }
    .details-box td { padding: 5px 10px; font-size: 11pt; }
    .details-box td:first-child { font-weight: bold; color: #555; width: 180px; }
    .footer { margin-top: 50px; }
    .signature { margin-top: 40px; }
    @media print {
      body { padding: 20px 30px; }
      @page { margin: 15mm 15mm; size: A4; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="sender">Orient Insight GmbH &nbsp;|&nbsp; Reisebüro &nbsp;|&nbsp; info@orient-insight.com</div>
    <div class="recipient">
      <strong>${hotelName || 'Hotel'}</strong><br>
      ${hotelCity || ''}
    </div>
  </div>

  <div class="date-line">Taschkent, den ${todayDE}</div>

  <div class="subject">Betreff: Stornierung der Buchung ${bookingNumber || ''}</div>

  <div class="body">
    <p>Sehr geehrte Damen und Herren,</p>

    <p>hiermit teilen wir Ihnen mit, dass wir die folgende Buchung leider stornieren müssen:</p>

    <div class="details-box">
      <table>
        <tr><td>Buchungsnummer:</td><td><strong>${bookingNumber || '–'}</strong></td></tr>
        <tr><td>Hotel:</td><td>${hotelName || '–'}</td></tr>
        <tr><td>Anreisedatum:</td><td>${checkInDE || '–'}</td></tr>
        <tr><td>Abreisedatum:</td><td>${checkOutDE || '–'}</td></tr>
        <tr><td>Zimmerbelegung:</td><td>${rooms || '–'}</td></tr>
        <tr><td>Personenanzahl:</td><td>${pax || '–'} Personen</td></tr>
      </table>
    </div>

    <p>Wir bitten Sie, diese Stornierung zu bestätigen und uns gegebenenfalls über anfallende Stornogebühren zu informieren.</p>

    <p>Wir entschuldigen uns für etwaige Unannehmlichkeiten und danken Ihnen für Ihr Verständnis.</p>
  </div>

  <div class="footer">
    <div class="signature">
      <p>Mit freundlichen Grüßen,</p>
      <br><br>
      <p><strong>Orient Insight GmbH</strong></p>
      <p>Reisebüro</p>
    </div>
  </div>

  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    console.error('Storno preview error:', error);
    res.status(500).json({ error: 'Ошибка создания Storno' });
  }
});

module.exports = router;





// Debug added

