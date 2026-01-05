const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/cities - Get all cities
router.get('/', authenticate, async (req, res) => {
  try {
    const { includeInactive } = req.query;

    const where = includeInactive === 'true' ? {} : { isActive: true };

    const cities = await prisma.city.findMany({
      where,
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' }
      ],
      include: {
        _count: { select: { hotels: true } }
      }
    });

    res.json({ cities });
  } catch (error) {
    console.error('Get cities error:', error);
    res.status(500).json({ error: 'Ошибка получения списка городов' });
  }
});

// GET /api/cities/:id - Get city by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const city = await prisma.city.findUnique({
      where: { id: parseInt(id) },
      include: {
        hotels: {
          where: { isActive: true },
          include: {
            roomTypes: {
              where: { isActive: true }
            }
          }
        },
        _count: { select: { hotels: true } }
      }
    });

    if (!city) {
      return res.status(404).json({ error: 'Город не найден' });
    }

    res.json({ city });
  } catch (error) {
    console.error('Get city error:', error);
    res.status(500).json({ error: 'Ошибка получения города' });
  }
});

// POST /api/cities - Create city
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, nameEn, country, sortOrder } = req.body;

    // Validation
    if (!name) {
      return res.status(400).json({ error: 'Название города обязательно' });
    }

    if (name.length < 2 || name.length > 50) {
      return res.status(400).json({ error: 'Название должно быть от 2 до 50 символов' });
    }

    // Check for duplicate
    const existing = await prisma.city.findUnique({ where: { name } });
    if (existing) {
      return res.status(400).json({ error: 'Город с таким названием уже существует' });
    }

    const city = await prisma.city.create({
      data: {
        name,
        nameEn,
        country: country || 'Uzbekistan',
        sortOrder: sortOrder || 0
      }
    });

    res.status(201).json({ city });
  } catch (error) {
    console.error('Create city error:', error);
    res.status(500).json({ error: 'Ошибка создания города' });
  }
});

// PUT /api/cities/:id - Update city
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, nameEn, country, sortOrder, isActive } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (nameEn !== undefined) updateData.nameEn = nameEn;
    if (country) updateData.country = country;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (typeof isActive === 'boolean') updateData.isActive = isActive;

    const city = await prisma.city.update({
      where: { id: parseInt(id) },
      data: updateData
    });

    res.json({ city });
  } catch (error) {
    console.error('Update city error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Город с таким названием уже существует' });
    }
    res.status(500).json({ error: 'Ошибка обновления города' });
  }
});

// DELETE /api/cities/:id - Delete city
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if city has hotels
    const hotelsCount = await prisma.hotel.count({
      where: { cityId: parseInt(id) }
    });

    if (hotelsCount > 0) {
      await prisma.city.update({
        where: { id: parseInt(id) },
        data: { isActive: false }
      });
      return res.json({ message: 'Город деактивирован (есть связанные отели)' });
    }

    await prisma.city.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Город удалён' });
  } catch (error) {
    console.error('Delete city error:', error);
    res.status(500).json({ error: 'Ошибка удаления города' });
  }
});

module.exports = router;
