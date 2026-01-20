const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/tour-types - Получить список типов туров
router.get('/', authenticate, async (req, res) => {
  try {
    const { includeInactive } = req.query;

    const where = includeInactive === 'true' ? {} : { isActive: true };

    const tourTypes = await prisma.tourType.findMany({
      where,
      orderBy: { code: 'asc' },
      include: {
        _count: { select: { bookings: true } }
      }
    });

    res.json({ tourTypes });
  } catch (error) {
    console.error('Get tour types error:', error);
    res.status(500).json({ error: 'Ошибка получения типов туров' });
  }
});

// GET /api/tour-types/:id - Получить тип тура по ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const tourType = await prisma.tourType.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: { select: { bookings: true } }
      }
    });

    if (!tourType) {
      return res.status(404).json({ error: 'Тип тура не найден' });
    }

    res.json({ tourType });
  } catch (error) {
    console.error('Get tour type error:', error);
    res.status(500).json({ error: 'Ошибка получения типа тура' });
  }
});

// POST /api/tour-types - Создать тип тура
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { code, name, description, color } = req.body;

    if (!code || !name) {
      return res.status(400).json({ error: 'Код и название обязательны' });
    }

    const existing = await prisma.tourType.findUnique({ where: { code } });
    if (existing) {
      return res.status(400).json({ error: 'Тип тура с таким кодом уже существует' });
    }

    const tourType = await prisma.tourType.create({
      data: { code, name, description, color }
    });

    res.status(201).json({ tourType });
  } catch (error) {
    console.error('Create tour type error:', error);
    res.status(500).json({ error: 'Ошибка создания типа тура' });
  }
});

// PUT /api/tour-types/:id - Обновить тип тура
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, description, color, isActive } = req.body;

    const updateData = {};
    if (code) updateData.code = code;
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (color) updateData.color = color;
    if (typeof isActive === 'boolean') updateData.isActive = isActive;

    const tourType = await prisma.tourType.update({
      where: { id: parseInt(id) },
      data: updateData
    });

    res.json({ tourType });
  } catch (error) {
    console.error('Update tour type error:', error);
    res.status(500).json({ error: 'Ошибка обновления типа тура' });
  }
});

// DELETE /api/tour-types/:id - Удалить тип тура
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const bookingsCount = await prisma.booking.count({
      where: { tourTypeId: parseInt(id) }
    });

    if (bookingsCount > 0) {
      await prisma.tourType.update({
        where: { id: parseInt(id) },
        data: { isActive: false }
      });
      return res.json({ message: 'Тип тура деактивирован (есть связанные бронирования)' });
    }

    await prisma.tourType.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Тип тура удалён' });
  } catch (error) {
    console.error('Delete tour type error:', error);
    res.status(500).json({ error: 'Ошибка удаления типа тура' });
  }
});

// ============================================
// Модуль: Программа тура (Itinerary)
// ============================================

// GET /api/tour-types/:id/itinerary - Получить программу тура
router.get('/:id/itinerary', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const itinerary = await prisma.tourItinerary.findMany({
      where: { tourTypeId: parseInt(id) },
      orderBy: [{ dayNumber: 'asc' }, { sortOrder: 'asc' }]
    });

    res.json({ itinerary });
  } catch (error) {
    console.error('Get itinerary error:', error);
    res.status(500).json({ error: 'Ошибка получения программы тура' });
  }
});

// POST /api/tour-types/:id/itinerary - Добавить день в программу
router.post('/:id/itinerary', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { dayNumber, title, description, activities, meals, accommodation } = req.body;

    if (!dayNumber || !title) {
      return res.status(400).json({ error: 'Номер дня и заголовок обязательны' });
    }

    // Note: Day number duplicates are allowed for split groups (e.g., Uzbekistan vs Turkmenistan)
    // Use title to distinguish (e.g., "Day 13: Khiva-Tashkent" vs "Day 13: Khiva-Shavat (Turkmenistan)")

    const itineraryItem = await prisma.tourItinerary.create({
      data: {
        tourTypeId: parseInt(id),
        dayNumber: parseInt(dayNumber),
        title,
        description,
        activities,
        meals,
        accommodation,
        sortOrder: parseInt(dayNumber)
      }
    });

    res.status(201).json({ itineraryItem });
  } catch (error) {
    console.error('Create itinerary error:', error);
    res.status(500).json({ error: 'Ошибка создания дня программы' });
  }
});

// PUT /api/tour-types/:id/itinerary/:itemId - Обновить день программы
router.put('/:id/itinerary/:itemId', authenticate, requireAdmin, async (req, res) => {
  try {
    const { itemId } = req.params;
    const { dayNumber, title, description, activities, meals, accommodation } = req.body;

    const updateData = {};
    if (dayNumber !== undefined) updateData.dayNumber = parseInt(dayNumber);
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (activities !== undefined) updateData.activities = activities;
    if (meals !== undefined) updateData.meals = meals;
    if (accommodation !== undefined) updateData.accommodation = accommodation;

    const itineraryItem = await prisma.tourItinerary.update({
      where: { id: parseInt(itemId) },
      data: updateData
    });

    res.json({ itineraryItem });
  } catch (error) {
    console.error('Update itinerary error:', error);
    res.status(500).json({ error: 'Ошибка обновления дня программы' });
  }
});

// DELETE /api/tour-types/:id/itinerary/:itemId - Удалить день программы
router.delete('/:id/itinerary/:itemId', authenticate, requireAdmin, async (req, res) => {
  try {
    const { itemId } = req.params;

    await prisma.tourItinerary.delete({
      where: { id: parseInt(itemId) }
    });

    res.json({ message: 'День программы удалён' });
  } catch (error) {
    console.error('Delete itinerary error:', error);
    res.status(500).json({ error: 'Ошибка удаления дня программы' });
  }
});

module.exports = router;
