const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();
const prisma = new PrismaClient();

// ============================================
// GET /api/bookings/:bookingId/routes - Получить все маршруты
// ============================================
router.get('/:bookingId/routes', authenticate, async (req, res) => {
  try {
    const { bookingId } = req.params;

    const routes = await prisma.route.findMany({
      where: { bookingId: parseInt(bookingId) },
      orderBy: [
        { sortOrder: 'asc' },
        { dayNumber: 'asc' }
      ]
    });

    res.json({ routes });
  } catch (error) {
    console.error('Error fetching routes:', error);
    res.status(500).json({ error: 'Ошибка получения маршрутов' });
  }
});

// ============================================
// POST /api/bookings/:bookingId/routes - Создать маршрут
// ============================================
router.post('/:bookingId/routes', authenticate, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { dayNumber, date, city, routeName, itinerary, personCount, transportType, departureTime, provider, optionRate, price, sortOrder } = req.body;

    // Verify booking exists
    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(bookingId) }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Бронирование не найдено' });
    }

    const route = await prisma.route.create({
      data: {
        bookingId: parseInt(bookingId),
        dayNumber: dayNumber || 1,
        date: date ? new Date(date) : null,
        city: city || null,
        routeName: routeName || '',
        itinerary: itinerary || null,
        personCount: personCount || 0,
        transportType: transportType || null,
        departureTime: departureTime || null,
        provider: provider || null,
        optionRate: optionRate || null,
        price: price ? parseFloat(price) : 0,
        sortOrder: sortOrder || 0
      }
    });

    res.status(201).json({ route });
  } catch (error) {
    console.error('Error creating route:', error);
    res.status(500).json({ error: 'Ошибка создания маршрута' });
  }
});

// ============================================
// PUT /api/bookings/:bookingId/routes/bulk - Массовое обновление маршрутов
// IMPORTANT: This route MUST be before /:id route to avoid "bulk" being matched as id
// ============================================
router.put('/:bookingId/routes/bulk', authenticate, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { routes } = req.body;


    if (!Array.isArray(routes)) {
      return res.status(400).json({ error: 'routes должен быть массивом' });
    }

    // Delete existing routes for this booking
    await prisma.route.deleteMany({
      where: { bookingId: parseInt(bookingId) }
    });

    // Create new routes sequentially inside a transaction (SQLite can't handle parallel writes)
    const createdRoutes = await prisma.$transaction(
      routes.map((route, index) =>
        prisma.route.create({
          data: {
            bookingId: parseInt(bookingId),
            dayNumber: route.dayNumber || index + 1,
            date: route.date ? new Date(route.date) : null,
            city: route.city || null,
            routeName: route.routeName || route.route || '',
            itinerary: route.itinerary || null,
            personCount: route.personCount || parseInt(route.person) || 0,
            transportType: route.transportType || null,
            departureTime: route.departureTime || null,
            provider: route.provider || route.choiceTab || null,
            optionRate: route.optionRate || route.choiceRate || null,
            price: route.price ? parseFloat(route.price) : 0,
            sortOrder: index
          }
        })
      )
    );

    res.json({ routes: createdRoutes });
  } catch (error) {
    console.error('Error bulk updating routes:', error);
    res.status(500).json({ error: 'Ошибка массового обновления маршрутов' });
  }
});

// ============================================
// PUT /api/bookings/:bookingId/routes/:id - Обновить маршрут
// ============================================
router.put('/:bookingId/routes/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { dayNumber, date, city, routeName, itinerary, personCount, transportType, departureTime, provider, optionRate, price, sortOrder } = req.body;

    const route = await prisma.route.update({
      where: { id: parseInt(id) },
      data: {
        dayNumber: dayNumber !== undefined ? dayNumber : undefined,
        date: date !== undefined ? (date ? new Date(date) : null) : undefined,
        city: city !== undefined ? city : undefined,
        routeName: routeName !== undefined ? routeName : undefined,
        itinerary: itinerary !== undefined ? itinerary : undefined,
        personCount: personCount !== undefined ? personCount : undefined,
        transportType: transportType !== undefined ? transportType : undefined,
        departureTime: departureTime !== undefined ? departureTime : undefined,
        provider: provider !== undefined ? provider : undefined,
        optionRate: optionRate !== undefined ? optionRate : undefined,
        price: price !== undefined ? parseFloat(price) : undefined,
        sortOrder: sortOrder !== undefined ? sortOrder : undefined
      }
    });

    res.json({ route });
  } catch (error) {
    console.error('Error updating route:', error);
    res.status(500).json({ error: 'Ошибка обновления маршрута' });
  }
});

// ============================================
// DELETE /api/bookings/:bookingId/routes/:id - Удалить маршрут
// ============================================
router.delete('/:bookingId/routes/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.route.delete({
      where: { id: parseInt(id) }
    });

    res.json({ message: 'Маршрут удалён' });
  } catch (error) {
    console.error('Error deleting route:', error);
    res.status(500).json({ error: 'Ошибка удаления маршрута' });
  }
});

// ============================================
// ROUTE TEMPLATES API
// ============================================

// GET /api/routes/templates/:tourTypeCode - Get route template for tour type
router.get('/templates/:tourTypeCode', authenticate, async (req, res) => {
  try {
    const { tourTypeCode } = req.params;

    const templates = await prisma.routeTemplate.findMany({
      where: { tourTypeCode: tourTypeCode.toUpperCase() },
      orderBy: [
        { sortOrder: 'asc' },
        { dayNumber: 'asc' }
      ]
    });

    res.json({ templates });
  } catch (error) {
    console.error('Error fetching route templates:', error);
    res.status(500).json({ error: 'Ошибка получения шаблонов маршрутов' });
  }
});

// PUT /api/routes/templates/:tourTypeCode - Save route template for tour type
router.put('/templates/:tourTypeCode', authenticate, async (req, res) => {
  try {
    const { tourTypeCode } = req.params;
    const { routes } = req.body;


    if (!Array.isArray(routes)) {
      return res.status(400).json({ error: 'routes должен быть массивом' });
    }

    // Delete existing templates for this tour type
    await prisma.routeTemplate.deleteMany({
      where: { tourTypeCode: tourTypeCode.toUpperCase() }
    });

    // Create new templates
    const createdTemplates = await Promise.all(
      routes.map((route, index) =>
        prisma.routeTemplate.create({
          data: {
            tourTypeCode: tourTypeCode.toUpperCase(),
            dayNumber: route.dayNumber || index + 1,
            dayOffset: route.dayOffset || index,
            city: route.city || route.shahar || null,
            routeName: route.routeName || route.route || '',
            itinerary: route.itinerary || null,
            provider: route.provider || route.choiceTab || null,
            optionRate: route.optionRate || route.choiceRate || null,
            sortOrder: index
          }
        })
      )
    );

    res.json({ templates: createdTemplates, message: 'Шаблон маршрутов сохранён' });
  } catch (error) {
    console.error('Error saving route templates:', error);
    res.status(500).json({ error: 'Ошибка сохранения шаблонов маршрутов' });
  }
});

module.exports = router;
