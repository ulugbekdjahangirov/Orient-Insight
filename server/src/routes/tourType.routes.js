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

module.exports = router;
