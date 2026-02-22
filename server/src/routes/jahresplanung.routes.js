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
    const endDate = new Date(`${year + 1}-01-01T00:00:00.000Z`);

    const accommodations = await prisma.accommodation.findMany({
      where: {
        checkInDate: { gte: startDate, lt: endDate },
        booking: {
          tourType: { code: tourType }
        }
      },
      include: {
        hotel: { include: { city: true } },
        booking: {
          select: {
            id: true,
            bookingNumber: true,
            pax: true,
            status: true,
            departureDate: true
          }
        },
        rooms: true
      },
      orderBy: [{ checkInDate: 'asc' }]
    });

    // Group by hotel
    const hotelMap = new Map();
    for (const acc of accommodations) {
      const hotelId = acc.hotelId;
      if (!hotelMap.has(hotelId)) {
        hotelMap.set(hotelId, {
          hotel: acc.hotel,
          bookings: []
        });
      }

      // Calculate rooms from AccommodationRoom
      let dbl = 0, twn = 0, sngl = 0;
      for (const room of acc.rooms) {
        const code = (room.roomTypeCode || '').toUpperCase();
        if (code === 'DBL') dbl += room.roomsCount;
        else if (code === 'TWN') twn += room.roomsCount;
        else if (code === 'SNGL' || code === 'SGL') sngl += room.roomsCount;
      }

      const isCancelled = acc.booking.status === 'CANCELLED';
      hotelMap.get(hotelId).bookings.push({
        bookingId: acc.bookingId,
        bookingNumber: acc.booking.bookingNumber,
        pax: isCancelled ? 0 : (acc.booking.pax || 0),
        status: acc.booking.status,
        checkInDate: acc.checkInDate,
        checkOutDate: acc.checkOutDate,
        nights: acc.nights || 0,
        totalRooms: isCancelled ? 0 : (acc.totalRooms || 0),
        dbl: isCancelled ? 0 : dbl,
        twn: isCancelled ? 0 : twn,
        sngl: isCancelled ? 0 : sngl,
        notes: acc.notes
      });
    }

    // Sort hotels alphabetically, sort bookings by checkInDate
    const hotels = Array.from(hotelMap.values())
      .sort((a, b) => a.hotel.name.localeCompare(b.hotel.name))
      .map(h => ({
        ...h,
        bookings: h.bookings.sort((a, b) => new Date(a.checkInDate) - new Date(b.checkInDate))
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

module.exports = router;
