const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/prices/:tourType/:category/:paxTier - Get price config
router.get('/:tourType/:category/:paxTier', authenticate, async (req, res) => {
  try {
    const { tourType, category, paxTier } = req.params;
    const year = parseInt(req.query.year) || 2026;

    const config = await prisma.priceConfig.findUnique({
      where: {
        tourType_category_paxTier_year: {
          tourType: tourType.toUpperCase(),
          category,
          paxTier,
          year
        }
      }
    });

    if (!config) {
      return res.json({ items: [] });
    }

    const items = JSON.parse(config.itemsJson);
    res.json({ items });
  } catch (error) {
    console.error('Get price config error:', error);
    res.status(500).json({ error: 'Ошибка получения конфигурации цен' });
  }
});

// GET /api/prices/:tourType/total - Get total prices for Rechnung (all PAX tiers)
router.get('/:tourType/total', authenticate, async (req, res) => {
  try {
    const { tourType } = req.params;
    const year = parseInt(req.query.year) || 2026;

    const configs = await prisma.priceConfig.findMany({
      where: {
        tourType: tourType.toUpperCase(),
        category: 'total',
        year
      },
      orderBy: [{ paxTier: 'asc' }]
    });

    if (configs.length === 0) {
      return res.json({ items: {} });
    }

    // Format: { '4': { totalPrice: 1490, ezZuschlag: 260 }, '5': { ... }, ... }
    const result = {};
    configs.forEach(config => {
      result[config.paxTier] = JSON.parse(config.itemsJson);
    });

    res.json({ items: result });
  } catch (error) {
    console.error('Get total prices error:', error);
    res.status(500).json({ error: 'Ошибка получения Total Prices' });
  }
});

// GET /api/prices/:tourType - Get all configs for a tour type
router.get('/:tourType', authenticate, async (req, res) => {
  try {
    const { tourType } = req.params;
    const year = parseInt(req.query.year) || 2026;

    const configs = await prisma.priceConfig.findMany({
      where: { tourType: tourType.toUpperCase(), year },
      orderBy: [{ category: 'asc' }, { paxTier: 'asc' }]
    });

    const result = {};
    configs.forEach(config => {
      const key = `${config.category}_${config.paxTier}`;
      result[key] = JSON.parse(config.itemsJson);
    });

    res.json(result);
  } catch (error) {
    console.error('Get tour type prices error:', error);
    res.status(500).json({ error: 'Ошибка получения цен' });
  }
});

// POST /api/prices - Create or update price config
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { tourType, category, paxTier, items, year: yearRaw } = req.body;
    const year = parseInt(yearRaw) || 2026;

    if (!tourType || !category || !paxTier || !items) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }

    const itemsJson = JSON.stringify(items);

    const config = await prisma.priceConfig.upsert({
      where: {
        tourType_category_paxTier_year: {
          tourType: tourType.toUpperCase(),
          category,
          paxTier,
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
        paxTier,
        year,
        itemsJson
      }
    });

    res.json({
      message: 'Конфигурация сохранена',
      config: {
        ...config,
        items: JSON.parse(config.itemsJson)
      }
    });
  } catch (error) {
    console.error('Save price config error:', error);
    res.status(500).json({ error: 'Ошибка сохранения конфигурации' });
  }
});

// POST /api/prices/bulk - Bulk import from localStorage
router.post('/bulk', authenticate, requireAdmin, async (req, res) => {
  try {
    const { configs } = req.body;

    if (!Array.isArray(configs)) {
      return res.status(400).json({ error: 'configs должен быть массивом' });
    }

    const results = [];
    for (const config of configs) {
      const { tourType, category, paxTier, items, year: yearRaw } = config;
      const year = parseInt(yearRaw) || 2026;

      const saved = await prisma.priceConfig.upsert({
        where: {
          tourType_category_paxTier_year: {
            tourType: tourType.toUpperCase(),
            category,
            paxTier,
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
          paxTier,
          year,
          itemsJson: JSON.stringify(items)
        }
      });

      results.push(saved);
    }

    res.json({
      message: `Импортировано ${results.length} конфигураций`,
      count: results.length
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({ error: 'Ошибка импорта' });
  }
});

// DELETE /api/prices/:tourType/:category/:paxTier - Delete config
router.delete('/:tourType/:category/:paxTier', authenticate, requireAdmin, async (req, res) => {
  try {
    const { tourType, category, paxTier } = req.params;
    const year = parseInt(req.query.year) || 2026;

    await prisma.priceConfig.delete({
      where: {
        tourType_category_paxTier_year: {
          tourType: tourType.toUpperCase(),
          category,
          paxTier,
          year
        }
      }
    });

    res.json({ message: 'Конфигурация удалена' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Конфигурация не найдена' });
    }
    console.error('Delete price config error:', error);
    res.status(500).json({ error: 'Ошибка удаления конфигурации' });
  }
});

module.exports = router;
