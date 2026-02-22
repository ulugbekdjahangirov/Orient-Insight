const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth.middleware');
const multer = require('multer');
const FormData = require('form-data');
const axios = require('axios');
const gmailService = require('../services/gmail.service');

const router = express.Router();
const prisma = new PrismaClient();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// GET /api/jahresplanung/hotels?year=2026&tourType=ER
router.get('/hotels', authenticate, async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const tourType = req.query.tourType || 'ER';

    const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
    const endDate   = new Date(`${year + 1}-01-01T00:00:00.000Z`);

    function addDays(date, days) {
      return new Date(new Date(date).getTime() + days * 24 * 60 * 60 * 1000);
    }
    function daysBetween(d1, d2) {
      return Math.round((new Date(d2) - new Date(d1)) / (24 * 60 * 60 * 1000));
    }

    // ── Step 1: ALL accommodations for this tourType (any year)
    //    Used for: hotel discovery + offset derivation
    const allAccommodations = await prisma.accommodation.findMany({
      where: { booking: { tourType: { code: tourType } } },
      include: {
        hotel: { include: { city: true } },
        booking: {
          select: { id: true, bookingNumber: true, pax: true, status: true, departureDate: true }
        },
        rooms: true
      },
      orderBy: [{ checkInDate: 'asc' }]
    });

    // ── Step 2: Build hotel reference map (hotel info + per-booking offset data, any year)
    // hotelRefMap: hotelId → { hotel, refBookings: Map<bookingId, [acc, ...]> }
    const hotelRefMap = new Map();
    for (const acc of allAccommodations) {
      if (!hotelRefMap.has(acc.hotelId)) {
        hotelRefMap.set(acc.hotelId, { hotel: acc.hotel, refBookings: new Map() });
      }
      const hr = hotelRefMap.get(acc.hotelId);
      if (!hr.refBookings.has(acc.bookingId)) hr.refBookings.set(acc.bookingId, []);
      hr.refBookings.get(acc.bookingId).push(acc);
    }

    // ── Step 3: Build display hotelMap — only REAL entries for target year
    const hotelMap = new Map();
    for (const acc of allAccommodations) {
      const checkIn = new Date(acc.checkInDate);
      if (checkIn < startDate || checkIn >= endDate) continue; // skip non-year entries

      if (!hotelMap.has(acc.hotelId)) {
        hotelMap.set(acc.hotelId, { hotel: acc.hotel, bookings: [] });
      }

      let dbl = 0, twn = 0, sngl = 0;
      for (const room of acc.rooms) {
        const code = (room.roomTypeCode || '').toUpperCase();
        if (code === 'DBL') dbl += room.roomsCount;
        else if (code === 'TWN') twn += room.roomsCount;
        else if (code === 'SNGL' || code === 'SGL') sngl += room.roomsCount;
      }

      const isCancelled = acc.booking.status === 'CANCELLED';
      hotelMap.get(acc.hotelId).bookings.push({
        bookingId:    acc.bookingId,
        bookingNumber: acc.booking.bookingNumber,
        pax:          isCancelled ? 0 : (acc.booking.pax || 0),
        status:       acc.booking.status,
        checkInDate:  acc.checkInDate,
        checkOutDate: acc.checkOutDate,
        nights:       acc.nights || 0,
        totalRooms:   isCancelled ? 0 : (acc.totalRooms || 0),
        dbl:  isCancelled ? 0 : dbl,
        twn:  isCancelled ? 0 : twn,
        sngl: isCancelled ? 0 : sngl,
        notes: acc.notes
      });
    }

    // ── Step 4: Get all target-year bookings for virtual entry generation
    const yearBookings = await prisma.booking.findMany({
      where: {
        tourType: { code: tourType },
        departureDate: { gte: startDate, lt: endDate }
      },
      select: { id: true, bookingNumber: true, pax: true, status: true, departureDate: true },
      orderBy: { bookingNumber: 'asc' }
    });

    // ── Step 5: For every hotel ever used by this tourType,
    //    fill missing year-bookings with virtual (planned) entries
    for (const [hotelId, hotelRef] of hotelRefMap.entries()) {
      // Ensure hotel exists in display map
      if (!hotelMap.has(hotelId)) {
        hotelMap.set(hotelId, { hotel: hotelRef.hotel, bookings: [] });
      }
      const hotelData = hotelMap.get(hotelId);

      const existingIds = new Set(hotelData.bookings.map(b => b.bookingId));
      const missingBookings = yearBookings.filter(b => !existingIds.has(b.id));
      if (missingBookings.length === 0) continue;

      // Derive offsets from ANY reference booking (prefer latest year)
      // Sort refBookings by departure date desc to pick most recent
      const refEntries = Array.from(hotelRef.refBookings.entries())
        .sort((a, b) => new Date(b[1][0].booking.departureDate) - new Date(a[1][0].booking.departureDate));

      let offsets = [];
      for (const [, accs] of refEntries) {
        const refDep = new Date(accs[0].booking.departureDate);
        const sorted = [...accs].sort((a, b) => new Date(a.checkInDate) - new Date(b.checkInDate));
        offsets = sorted.map(e => ({
          checkInOffset:  daysBetween(refDep, e.checkInDate),
          checkOutOffset: daysBetween(refDep, e.checkOutDate),
          nights: e.nights || daysBetween(e.checkInDate, e.checkOutDate)
        }));
        break;
      }
      if (offsets.length === 0) continue;

      missingBookings.forEach(b => {
        const dep = b.departureDate;
        offsets.forEach(off => {
          hotelData.bookings.push({
            bookingId:     b.id,
            bookingNumber: b.bookingNumber,
            pax:           16,
            status:        b.status,
            checkInDate:   addDays(dep, off.checkInOffset),
            checkOutDate:  addDays(dep, off.checkOutOffset),
            nights:        off.nights,
            totalRooms:    12,
            dbl: 4, twn: 4, sngl: 4,
            isVirtual: true
          });
        });
      });
    }

    // Sort hotels alphabetically, bookings by bookingNumber then checkInDate
    const hotels = Array.from(hotelMap.values())
      .sort((a, b) => a.hotel.name.localeCompare(b.hotel.name))
      .map(h => ({
        ...h,
        bookings: h.bookings.sort((a, b) =>
          a.bookingNumber.localeCompare(b.bookingNumber) ||
          new Date(a.checkInDate) - new Date(b.checkInDate)
        )
      }));

    res.json({ hotels, year, tourType });
  } catch (err) {
    console.error('Jahresplanung hotels error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/jahresplanung/send-hotel-email/:hotelId
// Sends annual plan PDF to hotel's email address
router.post('/send-hotel-email/:hotelId', authenticate, upload.single('pdf'), async (req, res) => {
  try {
    const hotelId = parseInt(req.params.hotelId);
    const { year, tourType } = req.body;
    const pdfFile = req.file;

    if (!pdfFile) {
      return res.status(400).json({ error: 'PDF fayl yuklanmadi' });
    }

    const hotel = await prisma.hotel.findUnique({
      where: { id: hotelId },
      include: { city: true }
    });
    if (!hotel) {
      return res.status(404).json({ error: 'Hotel topilmadi' });
    }
    if (!hotel.email) {
      return res.status(400).json({ error: `${hotel.name} hotelida email manzil yo'q` });
    }

    const tourNames = { ER: 'Erlebnisreisen', CO: 'ComfortPlus', KAS: 'Kasachstan', ZA: 'Zentralasien' };
    const tourLabel = tourNames[tourType] || tourType;

    const subject = `Jahresplanung ${year} — ${tourLabel} (${hotel.name})`;
    const html = `<p>Sehr geehrtes Team des Hotels <strong>${hotel.name}</strong>,</p>
<p>im Anhang finden Sie die Jahresplanung ${year} für unsere ${tourLabel}-Gruppen.</p>
<p>Bei Fragen können Sie sich gerne bei uns melden.</p>
<br/>
<p>Mit freundlichen Grüßen,<br/>Ulugbek &amp; Siroj<br/>Orient Insight</p>`;

    await gmailService.sendEmail({
      to: hotel.email,
      subject,
      html,
      attachments: [{
        filename: pdfFile.originalname,
        content: pdfFile.buffer,
        mimeType: 'application/pdf'
      }]
    });

    console.log(`Jahresplanung email sent: ${hotel.name} → ${hotel.email}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Send hotel email error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/jahresplanung/send-hotel-telegram/:hotelId
// Sends annual plan PDF to hotel's Telegram chat
router.post('/send-hotel-telegram/:hotelId', authenticate, upload.single('pdf'), async (req, res) => {
  try {
    const hotelId = parseInt(req.params.hotelId);
    const { year, tourType } = req.body;
    const pdfFile = req.file;

    if (!pdfFile) {
      return res.status(400).json({ error: 'PDF fayl yuklanmadi' });
    }

    const hotel = await prisma.hotel.findUnique({
      where: { id: hotelId },
      include: { city: true }
    });
    if (!hotel) {
      return res.status(404).json({ error: 'Hotel topilmadi' });
    }
    if (!hotel.telegramChatId) {
      return res.status(400).json({ error: `${hotel.name} hotelida Telegram chat ID yo'q` });
    }

    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (!TELEGRAM_BOT_TOKEN) {
      return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN sozlanmagan' });
    }

    const tourNames = { ER: 'Erlebnisreisen', CO: 'ComfortPlus', KAS: 'Kasachstan', ZA: 'Zentralasien' };
    const tourLabel = tourNames[tourType] || tourType;

    const caption = `📅 *Jahresplanung ${year}*\n🏨 *${hotel.name}*\n🗺 ${tourLabel} gruppalar uchun yillik zayavka`;

    const form = new FormData();
    form.append('chat_id', hotel.telegramChatId);
    form.append('caption', caption);
    form.append('parse_mode', 'Markdown');
    form.append('document', pdfFile.buffer, {
      filename: pdfFile.originalname,
      contentType: 'application/pdf'
    });

    await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`,
      form,
      { headers: form.getHeaders() }
    );

    console.log(`Jahresplanung Telegram sent: ${hotel.name} → ${hotel.telegramChatId}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Send hotel telegram error:', err);
    res.status(500).json({ error: err.response?.data?.description || err.message });
  }
});

// GET /api/jahresplanung/state?year=2026&tourType=ER
router.get('/state', authenticate, async (req, res) => {
  try {
    const { year, tourType } = req.query;
    const key = `JP_STATE_${year}_${tourType}`;
    const s = await prisma.systemSetting.findUnique({ where: { key } });
    res.json(s ? JSON.parse(s.value) : null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/jahresplanung/state
router.put('/state', authenticate, async (req, res) => {
  try {
    const { year, tourType, overrides, statuses, cityExtras, hotelAssign } = req.body;
    const key = `JP_STATE_${year}_${tourType}`;
    const value = JSON.stringify({ overrides, statuses, cityExtras, hotelAssign });
    await prisma.systemSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/jahresplanung/all-hotels — active hotels with city info (for hotel picker)
router.get('/all-hotels', authenticate, async (req, res) => {
  try {
    const hotels = await prisma.hotel.findMany({
      where: { isActive: true },
      include: { city: true },
      orderBy: [{ city: { sortOrder: 'asc' } }, { city: { name: 'asc' } }, { name: 'asc' }]
    });
    res.json(hotels);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
