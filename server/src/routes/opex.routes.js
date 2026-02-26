const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/opex/:tourType/:category - Get OPEX config
router.get('/:tourType/:category', authenticate, async (req, res) => {
  try {
    const { tourType, category } = req.params;
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const config = await prisma.opexConfig.findUnique({
      where: {
        tourType_category_year: {
          tourType: tourType.toUpperCase(),
          category,
          year
        }
      }
    });

    if (!config) {
      return res.json({ items: null }); // null = no record exists (different from empty array)
    }

    const items = JSON.parse(config.itemsJson);
    res.json({ items });
  } catch (error) {
    console.error('Get OPEX config error:', error);
    res.status(500).json({ error: 'Ошибка получения конфигурации OPEX' });
  }
});

// GET /api/opex/:tourType - Get all configs for a tour type
router.get('/:tourType', authenticate, async (req, res) => {
  try {
    const { tourType } = req.params;
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const configs = await prisma.opexConfig.findMany({
      where: { tourType: tourType.toUpperCase(), year },
      orderBy: [{ category: 'asc' }]
    });

    const result = {};
    configs.forEach(config => {
      result[config.category] = JSON.parse(config.itemsJson);
    });

    res.json(result);
  } catch (error) {
    console.error('Get tour type OPEX error:', error);
    res.status(500).json({ error: 'Ошибка получения OPEX' });
  }
});

// POST /api/opex - Create or update OPEX config
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { tourType, category, items, year: yearRaw } = req.body;
    const year = parseInt(yearRaw) || new Date().getFullYear();

    if (!tourType || !category || !items) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }

    const itemsJson = JSON.stringify(items);

    const config = await prisma.opexConfig.upsert({
      where: {
        tourType_category_year: {
          tourType: tourType.toUpperCase(),
          category,
          year
        }
      },
      update: {
        itemsJson,
        updatedAt: new Date()
      },
      create: {
        tourType: tourType.toUpperCase(),
        category,
        year,
        itemsJson
      }
    });

    res.json({
      message: 'OPEX конфигурация сохранена',
      config: {
        ...config,
        items: JSON.parse(config.itemsJson)
      }
    });
  } catch (error) {
    console.error('Save OPEX config error:', error);
    res.status(500).json({ error: 'Ошибка сохранения OPEX конфигурации' });
  }
});

// POST /api/opex/bulk - Bulk import from localStorage
router.post('/bulk', authenticate, requireAdmin, async (req, res) => {
  try {
    const { configs } = req.body;

    if (!Array.isArray(configs)) {
      return res.status(400).json({ error: 'configs должен быть массивом' });
    }

    const results = [];
    for (const config of configs) {
      const { tourType, category, items, year: yearRaw } = config;
      const year = parseInt(yearRaw) || new Date().getFullYear();

      const saved = await prisma.opexConfig.upsert({
        where: {
          tourType_category_year: {
            tourType: tourType.toUpperCase(),
            category,
            year
          }
        },
        update: {
          itemsJson: JSON.stringify(items),
          updatedAt: new Date()
        },
        create: {
          tourType: tourType.toUpperCase(),
          category,
          year,
          itemsJson: JSON.stringify(items)
        }
      });

      results.push(saved);
    }

    res.json({
      message: `Импортировано ${results.length} конфигураций OPEX`,
      count: results.length
    });
  } catch (error) {
    console.error('Bulk import OPEX error:', error);
    res.status(500).json({ error: 'Ошибка импорта OPEX' });
  }
});

// DELETE /api/opex/:tourType/:category - Delete config
router.delete('/:tourType/:category', authenticate, requireAdmin, async (req, res) => {
  try {
    const { tourType, category } = req.params;
    const year = parseInt(req.query.year) || new Date().getFullYear();

    await prisma.opexConfig.delete({
      where: {
        tourType_category_year: {
          tourType: tourType.toUpperCase(),
          category,
          year
        }
      }
    });

    res.json({ message: 'OPEX конфигурация удалена' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Конфигурация не найдена' });
    }
    console.error('Delete OPEX config error:', error);
    res.status(500).json({ error: 'Ошибка удаления OPEX конфигурации' });
  }
});

module.exports = router;
