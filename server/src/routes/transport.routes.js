const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/transport - Get all transport vehicles
router.get('/', authenticate, async (req, res) => {
  try {
    const { provider } = req.query;

    const where = { isActive: true };
    if (provider) {
      where.provider = provider;
    }

    const vehicles = await prisma.transportVehicle.findMany({
      where,
      orderBy: [
        { provider: 'asc' },
        { sortOrder: 'asc' },
        { id: 'asc' }
      ]
    });

    // Group by provider
    const grouped = {
      sevil: vehicles.filter(v => v.provider === 'sevil'),
      xayrulla: vehicles.filter(v => v.provider === 'xayrulla'),
      nosir: vehicles.filter(v => v.provider === 'nosir'),
      train: vehicles.filter(v => v.provider === 'train'),
      plane: vehicles.filter(v => v.provider === 'plane'),
      metro: vehicles.filter(v => v.provider === 'metro')
    };

    res.json({ vehicles, grouped });
  } catch (error) {
    console.error('Get transport vehicles error:', error);
    res.status(500).json({ error: 'Ошибка получения списка транспорта' });
  }
});

// GET /api/transport/:provider - Get vehicles by provider
router.get('/:provider', authenticate, async (req, res) => {
  try {
    const { provider } = req.params;

    const vehicles = await prisma.transportVehicle.findMany({
      where: {
        provider,
        isActive: true
      },
      orderBy: [
        { sortOrder: 'asc' },
        { id: 'asc' }
      ]
    });

    res.json({ vehicles });
  } catch (error) {
    console.error('Get transport by provider error:', error);
    res.status(500).json({ error: 'Ошибка получения транспорта' });
  }
});

// POST /api/transport - Create vehicle
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      provider, name, seats, person,
      // Sevil
      pickupDropoff, tagRate, urgenchRate, shovotRate2,
      // Xayrulla
      vstrecha, chimgan, tag, oybek, chernyayevka, cityTour,
      // Nosir
      margilan, qoqon, dostlik, toshkent, extra,
      // Train/Plane
      route, economPrice, businessPrice, departure, arrival,
      sortOrder
    } = req.body;

    if (!provider || !name) {
      return res.status(400).json({ error: 'Provider va nom majburiy' });
    }

    const vehicle = await prisma.transportVehicle.create({
      data: {
        provider,
        name,
        seats,
        person,
        pickupDropoff,
        tagRate: tagRate ? parseFloat(tagRate) : null,
        urgenchRate: urgenchRate ? parseFloat(urgenchRate) : null,
        shovotRate2: shovotRate2 ? parseFloat(shovotRate2) : null,
        vstrecha: vstrecha ? parseFloat(vstrecha) : null,
        chimgan: chimgan ? parseFloat(chimgan) : null,
        tag: tag ? parseFloat(tag) : null,
        oybek: oybek ? parseFloat(oybek) : null,
        chernyayevka: chernyayevka ? parseFloat(chernyayevka) : null,
        cityTour: cityTour ? parseFloat(cityTour) : null,
        margilan: margilan ? parseFloat(margilan) : null,
        qoqon: qoqon ? parseFloat(qoqon) : null,
        dostlik: dostlik ? parseFloat(dostlik) : null,
        toshkent: toshkent ? parseFloat(toshkent) : null,
        extra: extra ? parseFloat(extra) : null,
        route,
        economPrice,
        businessPrice,
        departure,
        arrival,
        sortOrder: sortOrder || 0
      }
    });

    res.status(201).json({ vehicle });
  } catch (error) {
    console.error('Create vehicle error:', error);
    res.status(500).json({ error: 'Ошибка создания транспорта' });
  }
});

// PUT /api/transport/:id - Update vehicle
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, seats, person,
      pickupDropoff, tagRate, urgenchRate, shovotRate2,
      vstrecha, chimgan, tag, oybek, chernyayevka, cityTour,
      margilan, qoqon, dostlik, toshkent, extra,
      route, economPrice, businessPrice, departure, arrival,
      sortOrder, isActive
    } = req.body;

    const updateData = {};

    if (name !== undefined) updateData.name = name;
    if (seats !== undefined) updateData.seats = seats;
    if (person !== undefined) updateData.person = person;

    // Sevil
    if (pickupDropoff !== undefined) updateData.pickupDropoff = pickupDropoff;
    if (tagRate !== undefined) updateData.tagRate = tagRate ? parseFloat(tagRate) : null;
    if (urgenchRate !== undefined) updateData.urgenchRate = urgenchRate ? parseFloat(urgenchRate) : null;
    if (shovotRate2 !== undefined) updateData.shovotRate2 = shovotRate2 ? parseFloat(shovotRate2) : null;

    // Xayrulla
    if (vstrecha !== undefined) updateData.vstrecha = vstrecha ? parseFloat(vstrecha) : null;
    if (chimgan !== undefined) updateData.chimgan = chimgan ? parseFloat(chimgan) : null;
    if (tag !== undefined) updateData.tag = tag ? parseFloat(tag) : null;
    if (oybek !== undefined) updateData.oybek = oybek ? parseFloat(oybek) : null;
    if (chernyayevka !== undefined) updateData.chernyayevka = chernyayevka ? parseFloat(chernyayevka) : null;
    if (cityTour !== undefined) updateData.cityTour = cityTour ? parseFloat(cityTour) : null;

    // Nosir
    if (margilan !== undefined) updateData.margilan = margilan ? parseFloat(margilan) : null;
    if (qoqon !== undefined) updateData.qoqon = qoqon ? parseFloat(qoqon) : null;
    if (dostlik !== undefined) updateData.dostlik = dostlik ? parseFloat(dostlik) : null;
    if (toshkent !== undefined) updateData.toshkent = toshkent ? parseFloat(toshkent) : null;
    if (extra !== undefined) updateData.extra = extra ? parseFloat(extra) : null;

    // Train/Plane
    if (route !== undefined) updateData.route = route;
    if (economPrice !== undefined) updateData.economPrice = economPrice;
    if (businessPrice !== undefined) updateData.businessPrice = businessPrice;
    if (departure !== undefined) updateData.departure = departure;
    if (arrival !== undefined) updateData.arrival = arrival;

    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (typeof isActive === 'boolean') updateData.isActive = isActive;

    const vehicle = await prisma.transportVehicle.update({
      where: { id: parseInt(id) },
      data: updateData
    });

    res.json({ vehicle });
  } catch (error) {
    console.error('Update vehicle error:', error);
    res.status(500).json({ error: 'Ошибка обновления транспорта' });
  }
});

// DELETE /api/transport/:id - Delete vehicle
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.transportVehicle.delete({
      where: { id: parseInt(id) }
    });

    res.json({ message: 'Транспорт удалён' });
  } catch (error) {
    console.error('Delete vehicle error:', error);
    res.status(500).json({ error: 'Ошибка удаления транспорта' });
  }
});

// POST /api/transport/bulk - Bulk create/update vehicles (for migration from localStorage)
router.post('/bulk', authenticate, async (req, res) => {
  try {
    const { provider, vehicles } = req.body;

    if (!provider || !vehicles || !Array.isArray(vehicles)) {
      return res.status(400).json({ error: 'Provider va vehicles massivi majburiy' });
    }

    // Delete existing vehicles for this provider
    await prisma.transportVehicle.deleteMany({
      where: { provider }
    });

    // Create new vehicles
    const created = await Promise.all(
      vehicles.map((v, index) =>
        prisma.transportVehicle.create({
          data: {
            provider,
            name: v.name,
            seats: v.seats,
            person: v.person,
            pickupDropoff: v.pickupDropoff,
            tagRate: v.tagRate ? parseFloat(v.tagRate) : null,
            urgenchRate: v.urgenchRate ? parseFloat(v.urgenchRate) : null,
            shovotRate2: v.shovotRate2 ? parseFloat(v.shovotRate2) : null,
            vstrecha: v.vstrecha ? parseFloat(v.vstrecha) : null,
            chimgan: v.chimgan ? parseFloat(v.chimgan) : null,
            tag: v.tag ? parseFloat(v.tag) : null,
            oybek: v.oybek ? parseFloat(v.oybek) : null,
            chernyayevka: v.chernyayevka ? parseFloat(v.chernyayevka) : null,
            cityTour: v.cityTour ? parseFloat(v.cityTour) : null,
            margilan: v.margilan ? parseFloat(v.margilan) : null,
            qoqon: v.qoqon ? parseFloat(v.qoqon) : null,
            dostlik: v.dostlik ? parseFloat(v.dostlik) : null,
            toshkent: v.toshkent ? parseFloat(v.toshkent) : null,
            extra: v.extra ? parseFloat(v.extra) : null,
            route: v.route,
            economPrice: v.economPrice,
            businessPrice: v.businessPrice,
            departure: v.departure,
            arrival: v.arrival,
            sortOrder: index
          }
        })
      )
    );

    res.json({ vehicles: created, count: created.length });
  } catch (error) {
    console.error('Bulk create vehicles error:', error);
    res.status(500).json({ error: 'Ошибка массового создания транспорта' });
  }
});

module.exports = router;
