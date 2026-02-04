const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/bookings/:bookingId/tour-services?type=EINTRITT
router.get('/:bookingId/tour-services', async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { type } = req.query; // EINTRITT, METRO, SHOU, OTHER

    const where = { bookingId: parseInt(bookingId) };
    if (type) {
      where.type = type;
    }

    const services = await prisma.tourService.findMany({
      where,
      orderBy: [
        { sortOrder: 'asc' },
        { date: 'asc' },
        { id: 'asc' }
      ]
    });

    console.log(`📋 GET /tour-services: Found ${services.length} services for booking ${bookingId}, type: ${type || 'ALL'}`);
    res.json({ services });
  } catch (error) {
    console.error('Error loading tour services:', error);
    res.status(500).json({ error: 'Xizmatlarni yuklashda xatolik' });
  }
});

// POST /api/bookings/:bookingId/tour-services
router.post('/:bookingId/tour-services', async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { type, name, city, date, pricePerPerson, pax, notes } = req.body;

    if (!type || !name) {
      return res.status(400).json({ error: 'Type va Name majburiy' });
    }

    // Parse pricePerPerson safely
    let pricePerPersonValue = 0;
    if (pricePerPerson !== undefined && pricePerPerson !== null && pricePerPerson !== '') {
      const priceNum = parseFloat(pricePerPerson);
      if (!isNaN(priceNum)) {
        pricePerPersonValue = priceNum;
      }
    }

    // Parse pax safely
    let paxValue = 0;
    if (pax !== undefined && pax !== null && pax !== '') {
      const paxNum = parseInt(pax);
      if (!isNaN(paxNum) && paxNum >= 0) {
        paxValue = paxNum;
      }
    }

    // Calculate total price
    const totalPrice = pricePerPersonValue * paxValue;

    // Get max sortOrder
    const maxSort = await prisma.tourService.aggregate({
      where: { bookingId: parseInt(bookingId), type },
      _max: { sortOrder: true }
    });

    const service = await prisma.tourService.create({
      data: {
        bookingId: parseInt(bookingId),
        type,
        name,
        city: city || null,
        date: date ? new Date(date) : null,
        pricePerPerson: pricePerPersonValue,
        pax: paxValue,
        price: totalPrice,
        notes: notes || null,
        sortOrder: (maxSort._max.sortOrder || 0) + 1
      }
    });

    console.log(`✅ Created tour service: ${type} - ${name}, PAX: ${paxValue}, Price: ${totalPrice}`);
    res.json({ service });
  } catch (error) {
    console.error('Error creating tour service:', error);
    res.status(500).json({ error: 'Xizmat yaratishda xatolik' });
  }
});

// PUT /api/bookings/:bookingId/tour-services/:id
router.put('/:bookingId/tour-services/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { type, name, city, date, pricePerPerson, pax, notes } = req.body;

    const updateData = {};

    if (type !== undefined) updateData.type = type;
    if (name !== undefined) updateData.name = name;
    if (city !== undefined) updateData.city = city;
    if (date !== undefined) updateData.date = date ? new Date(date) : null;
    if (notes !== undefined) updateData.notes = notes;

    // Handle pricePerPerson separately - parse as float
    if (pricePerPerson !== undefined && pricePerPerson !== null && pricePerPerson !== '') {
      const priceNum = parseFloat(pricePerPerson);
      if (!isNaN(priceNum)) {
        updateData.pricePerPerson = priceNum;
      }
    }

    // Handle pax separately - parse as int
    if (pax !== undefined && pax !== null && pax !== '') {
      const paxNum = parseInt(pax);
      if (!isNaN(paxNum) && paxNum >= 0) {
        updateData.pax = paxNum;
      }
    }

    // Recalculate total price if pricePerPerson or pax changed
    if (updateData.pricePerPerson !== undefined || updateData.pax !== undefined) {
      const currentService = await prisma.tourService.findUnique({
        where: { id: parseInt(id) }
      });

      const newPricePerPerson = updateData.pricePerPerson !== undefined ? updateData.pricePerPerson : currentService.pricePerPerson;
      const newPax = updateData.pax !== undefined ? updateData.pax : currentService.pax;
      updateData.price = newPricePerPerson * newPax;
    }

    const service = await prisma.tourService.update({
      where: { id: parseInt(id) },
      data: updateData
    });

    console.log(`✏️ Updated tour service ${id}: ${service.type} - ${service.name}`);
    res.json({ service });
  } catch (error) {
    console.error('Error updating tour service:', error);
    res.status(500).json({ error: 'Xizmatni yangilashda xatolik' });
  }
});

// DELETE /api/bookings/:bookingId/tour-services/:id
router.delete('/:bookingId/tour-services/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.tourService.delete({
      where: { id: parseInt(id) }
    });

    console.log(`🗑️ Deleted tour service ${id}`);
    res.json({ message: 'Xizmat o\'chirildi' });
  } catch (error) {
    console.error('Error deleting tour service:', error);
    res.status(500).json({ error: 'Xizmatni o\'chirishda xatolik' });
  }
});

module.exports = router;
