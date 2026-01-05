const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');

const router = express.Router();
const prisma = new PrismaClient();

// Configure multer for hotel image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/hotels');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `hotel-${req.params.id}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mime = allowedTypes.test(file.mimetype);
    if (ext && mime) {
      cb(null, true);
    } else {
      cb(new Error('Только изображения (jpeg, jpg, png, gif, webp)'));
    }
  }
});

// ============================================
// HOTELS
// ============================================

// GET /api/hotels - Get all hotels (grouped by city)
router.get('/', authenticate, async (req, res) => {
  try {
    const { cityId, search, includeInactive } = req.query;

    const where = {};

    if (includeInactive !== 'true') {
      where.isActive = true;
    }

    if (cityId) {
      where.cityId = parseInt(cityId);
    }

    if (search) {
      where.name = { contains: search };
    }

    const hotels = await prisma.hotel.findMany({
      where,
      include: {
        city: true,
        roomTypes: {
          where: includeInactive === 'true' ? {} : { isActive: true },
          orderBy: { name: 'asc' }
        },
        _count: { select: { roomTypes: true } }
      },
      orderBy: [
        { city: { sortOrder: 'asc' } },
        { city: { name: 'asc' } },
        { name: 'asc' }
      ]
    });

    // Group hotels by city
    const groupedByCity = hotels.reduce((acc, hotel) => {
      const cityName = hotel.city.name;
      if (!acc[cityName]) {
        acc[cityName] = {
          city: hotel.city,
          hotels: []
        };
      }
      acc[cityName].hotels.push(hotel);
      return acc;
    }, {});

    res.json({
      hotels,
      groupedByCity: Object.values(groupedByCity)
    });
  } catch (error) {
    console.error('Get hotels error:', error);
    res.status(500).json({ error: 'Ошибка получения списка отелей' });
  }
});

// GET /api/hotels/:id - Get hotel by ID with room types, images, and seasonal prices
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const hotel = await prisma.hotel.findUnique({
      where: { id: parseInt(id) },
      include: {
        city: true,
        images: {
          orderBy: [{ isMain: 'desc' }, { sortOrder: 'asc' }]
        },
        roomTypes: {
          orderBy: { name: 'asc' },
          include: {
            seasonalPrices: {
              where: { isActive: true },
              orderBy: { startDate: 'asc' }
            }
          }
        }
      }
    });

    if (!hotel) {
      return res.status(404).json({ error: 'Отель не найден' });
    }

    res.json({ hotel });
  } catch (error) {
    console.error('Get hotel error:', error);
    res.status(500).json({ error: 'Ошибка получения отеля' });
  }
});

// POST /api/hotels - Create hotel
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, cityId, address, phone, email, website, stars, description } = req.body;

    // Validation
    if (!name || !cityId) {
      return res.status(400).json({ error: 'Название и город обязательны' });
    }

    if (name.length < 2 || name.length > 100) {
      return res.status(400).json({ error: 'Название должно быть от 2 до 100 символов' });
    }

    if (stars && (stars < 1 || stars > 5)) {
      return res.status(400).json({ error: 'Звёздность должна быть от 1 до 5' });
    }

    // Check city exists
    const city = await prisma.city.findUnique({ where: { id: parseInt(cityId) } });
    if (!city) {
      return res.status(400).json({ error: 'Город не найден' });
    }

    // Check for duplicate hotel in same city
    const existing = await prisma.hotel.findFirst({
      where: {
        name: { equals: name },
        cityId: parseInt(cityId)
      }
    });
    if (existing) {
      return res.status(400).json({ error: 'Отель с таким названием уже существует в этом городе' });
    }

    const hotel = await prisma.hotel.create({
      data: {
        name,
        cityId: parseInt(cityId),
        address,
        phone,
        email,
        website,
        stars: stars ? parseInt(stars) : null,
        description
      },
      include: {
        city: true,
        roomTypes: true
      }
    });

    res.status(201).json({ hotel });
  } catch (error) {
    console.error('Create hotel error:', error);
    res.status(500).json({ error: 'Ошибка создания отеля' });
  }
});

// PUT /api/hotels/:id - Update hotel
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, cityId, address, phone, email, website, stars, description, isActive } = req.body;

    // Validation
    if (name && (name.length < 2 || name.length > 100)) {
      return res.status(400).json({ error: 'Название должно быть от 2 до 100 символов' });
    }

    if (stars && (stars < 1 || stars > 5)) {
      return res.status(400).json({ error: 'Звёздность должна быть от 1 до 5' });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (cityId) updateData.cityId = parseInt(cityId);
    if (address !== undefined) updateData.address = address;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (website !== undefined) updateData.website = website;
    if (stars !== undefined) updateData.stars = stars ? parseInt(stars) : null;
    if (description !== undefined) updateData.description = description;
    if (typeof isActive === 'boolean') updateData.isActive = isActive;

    const hotel = await prisma.hotel.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        city: true,
        roomTypes: true
      }
    });

    res.json({ hotel });
  } catch (error) {
    console.error('Update hotel error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Отель с таким названием уже существует в этом городе' });
    }
    res.status(500).json({ error: 'Ошибка обновления отеля' });
  }
});

// DELETE /api/hotels/:id - Delete hotel
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if hotel has room types
    const roomTypesCount = await prisma.roomType.count({
      where: { hotelId: parseInt(id) }
    });

    if (roomTypesCount > 0) {
      // Soft delete - deactivate
      await prisma.hotel.update({
        where: { id: parseInt(id) },
        data: { isActive: false }
      });
      return res.json({ message: 'Отель деактивирован (есть типы номеров)' });
    }

    await prisma.hotel.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Отель удалён' });
  } catch (error) {
    console.error('Delete hotel error:', error);
    res.status(500).json({ error: 'Ошибка удаления отеля' });
  }
});

// ============================================
// ROOM TYPES
// ============================================

// GET /api/hotels/:hotelId/room-types - Get room types for hotel
router.get('/:hotelId/room-types', authenticate, async (req, res) => {
  try {
    const { hotelId } = req.params;
    const { includeInactive } = req.query;

    const where = { hotelId: parseInt(hotelId) };
    if (includeInactive !== 'true') {
      where.isActive = true;
    }

    const roomTypes = await prisma.roomType.findMany({
      where,
      orderBy: { name: 'asc' }
    });

    res.json({ roomTypes });
  } catch (error) {
    console.error('Get room types error:', error);
    res.status(500).json({ error: 'Ошибка получения типов номеров' });
  }
});

// POST /api/hotels/:hotelId/room-types - Create room type
router.post('/:hotelId/room-types', authenticate, requireAdmin, async (req, res) => {
  try {
    const { hotelId } = req.params;
    const { name, displayName, roomCount, pricePerNight, currency, description, amenities, maxGuests } = req.body;

    // Validation
    if (!name) {
      return res.status(400).json({ error: 'Название типа номера обязательно' });
    }

    if (name.length > 20) {
      return res.status(400).json({ error: 'Код типа номера должен быть до 20 символов' });
    }

    if (roomCount !== undefined && roomCount < 0) {
      return res.status(400).json({ error: 'Количество номеров не может быть отрицательным' });
    }

    if (pricePerNight !== undefined && pricePerNight < 0) {
      return res.status(400).json({ error: 'Цена не может быть отрицательной' });
    }

    // Check hotel exists
    const hotel = await prisma.hotel.findUnique({ where: { id: parseInt(hotelId) } });
    if (!hotel) {
      return res.status(404).json({ error: 'Отель не найден' });
    }

    // Check for duplicate room type in hotel
    const existing = await prisma.roomType.findFirst({
      where: {
        hotelId: parseInt(hotelId),
        name: { equals: name }
      }
    });
    if (existing) {
      return res.status(400).json({ error: 'Тип номера с таким названием уже существует в этом отеле' });
    }

    const roomType = await prisma.roomType.create({
      data: {
        hotelId: parseInt(hotelId),
        name: name.toUpperCase(),
        displayName,
        roomCount: roomCount || 0,
        pricePerNight: pricePerNight || 0,
        currency: currency || 'USD',
        description,
        amenities,
        maxGuests: maxGuests || 2
      }
    });

    res.status(201).json({ roomType });
  } catch (error) {
    console.error('Create room type error:', error);
    res.status(500).json({ error: 'Ошибка создания типа номера' });
  }
});

// PUT /api/hotels/:hotelId/room-types/:id - Update room type
router.put('/:hotelId/room-types/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, displayName, roomCount, pricePerNight, currency, description, amenities, maxGuests, isActive } = req.body;

    // Validation
    if (roomCount !== undefined && roomCount < 0) {
      return res.status(400).json({ error: 'Количество номеров не может быть отрицательным' });
    }

    if (pricePerNight !== undefined && pricePerNight < 0) {
      return res.status(400).json({ error: 'Цена не может быть отрицательной' });
    }

    const updateData = {};
    if (name) updateData.name = name.toUpperCase();
    if (displayName !== undefined) updateData.displayName = displayName;
    if (roomCount !== undefined) updateData.roomCount = roomCount;
    if (pricePerNight !== undefined) updateData.pricePerNight = pricePerNight;
    if (currency) updateData.currency = currency;
    if (description !== undefined) updateData.description = description;
    if (amenities !== undefined) updateData.amenities = amenities;
    if (maxGuests !== undefined) updateData.maxGuests = maxGuests;
    if (typeof isActive === 'boolean') updateData.isActive = isActive;

    const roomType = await prisma.roomType.update({
      where: { id: parseInt(id) },
      data: updateData
    });

    res.json({ roomType });
  } catch (error) {
    console.error('Update room type error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Тип номера с таким названием уже существует' });
    }
    res.status(500).json({ error: 'Ошибка обновления типа номера' });
  }
});

// DELETE /api/hotels/:hotelId/room-types/:id - Delete room type
router.delete('/:hotelId/room-types/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.roomType.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Тип номера удалён' });
  } catch (error) {
    console.error('Delete room type error:', error);
    res.status(500).json({ error: 'Ошибка удаления типа номера' });
  }
});

// ============================================
// HOTEL IMAGES
// ============================================

// GET /api/hotels/:id/images - Get hotel images
router.get('/:id/images', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const images = await prisma.hotelImage.findMany({
      where: { hotelId: parseInt(id) },
      orderBy: [{ isMain: 'desc' }, { sortOrder: 'asc' }]
    });

    res.json({ images });
  } catch (error) {
    console.error('Get hotel images error:', error);
    res.status(500).json({ error: 'Ошибка получения изображений' });
  }
});

// POST /api/hotels/:id/images - Upload hotel image
router.post('/:id/images', authenticate, requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { caption, isMain } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }

    // Check hotel exists
    const hotel = await prisma.hotel.findUnique({ where: { id: parseInt(id) } });
    if (!hotel) {
      // Delete uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Отель не найден' });
    }

    // If this is set as main, unset other main images
    if (isMain === 'true') {
      await prisma.hotelImage.updateMany({
        where: { hotelId: parseInt(id), isMain: true },
        data: { isMain: false }
      });
    }

    // Get max sortOrder
    const maxSort = await prisma.hotelImage.findFirst({
      where: { hotelId: parseInt(id) },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true }
    });

    const image = await prisma.hotelImage.create({
      data: {
        hotelId: parseInt(id),
        filename: req.file.filename,
        originalName: req.file.originalname,
        url: `/uploads/hotels/${req.file.filename}`,
        caption: caption || null,
        isMain: isMain === 'true',
        sortOrder: (maxSort?.sortOrder || 0) + 1
      }
    });

    res.status(201).json({ image });
  } catch (error) {
    console.error('Upload hotel image error:', error);
    // Clean up file if exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Ошибка загрузки изображения' });
  }
});

// PUT /api/hotels/:id/images/:imageId - Update image (caption, isMain)
router.put('/:id/images/:imageId', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id, imageId } = req.params;
    const { caption, isMain } = req.body;

    // If setting as main, unset others
    if (isMain === true) {
      await prisma.hotelImage.updateMany({
        where: { hotelId: parseInt(id), isMain: true },
        data: { isMain: false }
      });
    }

    const image = await prisma.hotelImage.update({
      where: { id: parseInt(imageId) },
      data: {
        caption: caption !== undefined ? caption : undefined,
        isMain: isMain !== undefined ? isMain : undefined
      }
    });

    res.json({ image });
  } catch (error) {
    console.error('Update hotel image error:', error);
    res.status(500).json({ error: 'Ошибка обновления изображения' });
  }
});

// PUT /api/hotels/:id/images/reorder - Reorder images
router.put('/:id/images/reorder', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { imageIds } = req.body; // Array of image IDs in new order

    if (!Array.isArray(imageIds)) {
      return res.status(400).json({ error: 'imageIds должен быть массивом' });
    }

    // Update each image's sortOrder
    await Promise.all(
      imageIds.map((imageId, index) =>
        prisma.hotelImage.update({
          where: { id: parseInt(imageId) },
          data: { sortOrder: index }
        })
      )
    );

    const images = await prisma.hotelImage.findMany({
      where: { hotelId: parseInt(id) },
      orderBy: [{ isMain: 'desc' }, { sortOrder: 'asc' }]
    });

    res.json({ images });
  } catch (error) {
    console.error('Reorder hotel images error:', error);
    res.status(500).json({ error: 'Ошибка изменения порядка изображений' });
  }
});

// DELETE /api/hotels/:id/images/:imageId - Delete hotel image
router.delete('/:id/images/:imageId', authenticate, requireAdmin, async (req, res) => {
  try {
    const { imageId } = req.params;

    const image = await prisma.hotelImage.findUnique({
      where: { id: parseInt(imageId) }
    });

    if (!image) {
      return res.status(404).json({ error: 'Изображение не найдено' });
    }

    // Delete file from disk
    const filePath = path.join(__dirname, '../../uploads/hotels', image.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await prisma.hotelImage.delete({ where: { id: parseInt(imageId) } });

    res.json({ message: 'Изображение удалено' });
  } catch (error) {
    console.error('Delete hotel image error:', error);
    res.status(500).json({ error: 'Ошибка удаления изображения' });
  }
});

// ============================================
// SEASONAL PRICING
// ============================================

// GET /api/hotels/:hotelId/room-types/:roomTypeId/seasonal-prices
router.get('/:hotelId/room-types/:roomTypeId/seasonal-prices', authenticate, async (req, res) => {
  try {
    const { roomTypeId } = req.params;
    const { includeInactive } = req.query;

    const where = { roomTypeId: parseInt(roomTypeId) };
    if (includeInactive !== 'true') {
      where.isActive = true;
    }

    const seasonalPrices = await prisma.roomSeasonalPrice.findMany({
      where,
      orderBy: { startDate: 'asc' }
    });

    res.json({ seasonalPrices });
  } catch (error) {
    console.error('Get seasonal prices error:', error);
    res.status(500).json({ error: 'Ошибка получения сезонных цен' });
  }
});

// POST /api/hotels/:hotelId/room-types/:roomTypeId/seasonal-prices
router.post('/:hotelId/room-types/:roomTypeId/seasonal-prices', authenticate, requireAdmin, async (req, res) => {
  try {
    const { roomTypeId } = req.params;
    const { name, startDate, endDate, pricePerNight } = req.body;

    // Validation
    if (!name || !startDate || !endDate || pricePerNight === undefined) {
      return res.status(400).json({ error: 'Все поля обязательны: название, даты, цена' });
    }

    if (pricePerNight < 0) {
      return res.status(400).json({ error: 'Цена не может быть отрицательной' });
    }

    // Check room type exists
    const roomType = await prisma.roomType.findUnique({ where: { id: parseInt(roomTypeId) } });
    if (!roomType) {
      return res.status(404).json({ error: 'Тип номера не найден' });
    }

    const seasonalPrice = await prisma.roomSeasonalPrice.create({
      data: {
        roomTypeId: parseInt(roomTypeId),
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        pricePerNight: parseFloat(pricePerNight)
      }
    });

    res.status(201).json({ seasonalPrice });
  } catch (error) {
    console.error('Create seasonal price error:', error);
    res.status(500).json({ error: 'Ошибка создания сезонной цены' });
  }
});

// PUT /api/hotels/:hotelId/room-types/:roomTypeId/seasonal-prices/:id
router.put('/:hotelId/room-types/:roomTypeId/seasonal-prices/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, startDate, endDate, pricePerNight, isActive } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (startDate) updateData.startDate = new Date(startDate);
    if (endDate) updateData.endDate = new Date(endDate);
    if (pricePerNight !== undefined) updateData.pricePerNight = parseFloat(pricePerNight);
    if (typeof isActive === 'boolean') updateData.isActive = isActive;

    const seasonalPrice = await prisma.roomSeasonalPrice.update({
      where: { id: parseInt(id) },
      data: updateData
    });

    res.json({ seasonalPrice });
  } catch (error) {
    console.error('Update seasonal price error:', error);
    res.status(500).json({ error: 'Ошибка обновления сезонной цены' });
  }
});

// DELETE /api/hotels/:hotelId/room-types/:roomTypeId/seasonal-prices/:id
router.delete('/:hotelId/room-types/:roomTypeId/seasonal-prices/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.roomSeasonalPrice.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Сезонная цена удалена' });
  } catch (error) {
    console.error('Delete seasonal price error:', error);
    res.status(500).json({ error: 'Ошибка удаления сезонной цены' });
  }
});

// GET price for specific date (helper endpoint)
router.get('/:hotelId/room-types/:roomTypeId/price', authenticate, async (req, res) => {
  try {
    const { roomTypeId } = req.params;
    const { date } = req.query;

    const roomType = await prisma.roomType.findUnique({
      where: { id: parseInt(roomTypeId) },
      include: {
        seasonalPrices: {
          where: { isActive: true }
        }
      }
    });

    if (!roomType) {
      return res.status(404).json({ error: 'Тип номера не найден' });
    }

    let price = roomType.pricePerNight; // Default price
    let seasonName = null;

    if (date) {
      const checkDate = new Date(date);
      // Find matching seasonal price
      for (const sp of roomType.seasonalPrices) {
        // Compare month-day only (for recurring seasons)
        const checkMonth = checkDate.getMonth();
        const checkDay = checkDate.getDate();
        const startMonth = sp.startDate.getMonth();
        const startDay = sp.startDate.getDate();
        const endMonth = sp.endDate.getMonth();
        const endDay = sp.endDate.getDate();

        // Check if date falls within season (handles year wrap-around)
        let inSeason = false;
        if (startMonth <= endMonth) {
          // Normal case: Jan-Mar, Apr-Jun, etc.
          if (
            (checkMonth > startMonth || (checkMonth === startMonth && checkDay >= startDay)) &&
            (checkMonth < endMonth || (checkMonth === endMonth && checkDay <= endDay))
          ) {
            inSeason = true;
          }
        } else {
          // Year wrap-around: Oct-Mar
          if (
            (checkMonth > startMonth || (checkMonth === startMonth && checkDay >= startDay)) ||
            (checkMonth < endMonth || (checkMonth === endMonth && checkDay <= endDay))
          ) {
            inSeason = true;
          }
        }

        if (inSeason) {
          price = sp.pricePerNight;
          seasonName = sp.name;
          break;
        }
      }
    }

    res.json({
      price,
      seasonName,
      basePrice: roomType.pricePerNight,
      currency: roomType.currency
    });
  } catch (error) {
    console.error('Get price error:', error);
    res.status(500).json({ error: 'Ошибка получения цены' });
  }
});

module.exports = router;
