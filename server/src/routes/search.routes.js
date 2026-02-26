const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth.middleware');

const prisma = new PrismaClient();

// GET /api/search?q=...
router.get('/', authenticate, async (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.json({ results: [] });

  try {
    const [bookings, tourists, guides] = await Promise.all([
      // Search bookings by bookingNumber
      prisma.booking.findMany({
        where: {
          bookingNumber: { contains: q, mode: 'insensitive' }
        },
        include: { tourType: true },
        take: 5
      }),

      // Search tourists by name or passport
      prisma.tourist.findMany({
        where: {
          OR: [
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName:  { contains: q, mode: 'insensitive' } },
            { passportNumber: { contains: q, mode: 'insensitive' } }
          ]
        },
        include: {
          booking: { include: { tourType: true } }
        },
        take: 8
      }),

      // Search guides by name
      prisma.guide.findMany({
        where: {
          OR: [
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName:  { contains: q, mode: 'insensitive' } },
            { name:      { contains: q, mode: 'insensitive' } }
          ]
        },
        take: 5
      })
    ]);

    const results = [];

    for (const b of bookings) {
      results.push({
        type: 'booking',
        id: b.id,
        label: b.bookingNumber,
        sub: b.tourType?.name || '',
        color: b.tourType?.color || '#6B7280',
        url: `/bookings/${b.id}`
      });
    }

    // Deduplicate tourists by bookingId+name to avoid duplicates
    const seen = new Set();
    for (const t of tourists) {
      const key = `${t.bookingId}-${t.firstName}-${t.lastName}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        type: 'tourist',
        id: t.id,
        label: `${t.firstName} ${t.lastName}`,
        sub: t.booking?.bookingNumber || '',
        passport: t.passportNumber || '',
        color: t.booking?.tourType?.color || '#6B7280',
        url: `/bookings/${t.bookingId}`
      });
    }

    for (const g of guides) {
      const fullName = g.name || `${g.firstName || ''} ${g.lastName || ''}`.trim();
      results.push({
        type: 'guide',
        id: g.id,
        label: fullName,
        sub: g.phone || '',
        url: `/guides/${g.id}`
      });
    }

    res.json({ results });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;
