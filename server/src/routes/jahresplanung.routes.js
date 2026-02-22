const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth.middleware');
const multer = require('multer');
const FormData = require('form-data');
const axios = require('axios');
const gmailService = require('../services/gmail.service');
const fs = require('fs');
const path = require('path');

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

    // ── Interactive confirmation message ──────────────────────────────────
    const sections = req.body.sections ? JSON.parse(req.body.sections) : [];
    const allRows = [];
    for (const sec of sections) {
      for (const row of sec.rows) {
        if (!row.cancelled && row.bookingId) {
          allRows.push({ ...row, sectionLabel: sec.label || null });
        }
      }
    }

    if (allRows.length > 0) {
      // Build message text
      const ST_ICON = { CONFIRMED: '✅', WAITING: '⏳', REJECTED: '❌', PENDING: '⬜' };
      let msgLines = [`📋 *Jahresplanung ${year} — ${tourLabel}*`, `🏨 *${hotel.name}*`, ''];
      let lastLabel = null;
      allRows.forEach((row, i) => {
        if (row.sectionLabel && row.sectionLabel !== lastLabel) {
          msgLines.push(`*${row.sectionLabel}:*`);
          lastLabel = row.sectionLabel;
        }
        msgLines.push(`${ST_ICON.PENDING} ${i + 1}. ${row.group} | ${row.checkIn} → ${row.checkOut} | ${row.pax} pax | DBL:${row.dbl} TWN:${row.twn} SNGL:${row.sngl}`);
      });

      // Build inline keyboard — one row per group + bulk row at bottom
      const keyboard = allRows.map(row => ([
        { text: `✅ ${row.group}`, callback_data: `jp_c:${row.bookingId}:${hotelId}` },
        { text: '⏳ WL',           callback_data: `jp_w:${row.bookingId}:${hotelId}` },
        { text: '❌ Rad',          callback_data: `jp_r:${row.bookingId}:${hotelId}` },
      ]));
      keyboard.push([
        { text: '✅ Barchasini',     callback_data: `jp_ca:${hotelId}` },
        { text: '⏳ WL barchasi',    callback_data: `jp_wa:${hotelId}` },
        { text: '❌ Barchasini rad', callback_data: `jp_ra:${hotelId}` },
      ]);

      await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        chat_id: hotel.telegramChatId,
        text: msgLines.join('\n'),
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });

      // Store row data in SystemSetting for webhook rebuilding
      await prisma.systemSetting.upsert({
        where: { key: `JP_SECTIONS_${hotelId}` },
        update: { value: JSON.stringify({ year, tourType, hotelName: hotel.name, rows: allRows }) },
        create: { key: `JP_SECTIONS_${hotelId}`, value: JSON.stringify({ year, tourType, hotelName: hotel.name, rows: allRows }) }
      });

      // Delete old confirmations and create fresh PENDING ones
      const bookingIds = allRows.map(r => r.bookingId);
      await prisma.telegramConfirmation.deleteMany({ where: { bookingId: { in: bookingIds }, hotelId } });
      await prisma.telegramConfirmation.createMany({
        data: allRows.map(r => ({ bookingId: r.bookingId, hotelId, status: 'PENDING' }))
      });
    }

    console.log(`Jahresplanung Telegram sent: ${hotel.name} → ${hotel.telegramChatId}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Send hotel telegram error:', err);
    res.status(500).json({ error: err.response?.data?.description || err.message });
  }
});

// POST /api/jahresplanung/generate-pdf — server-side PDF via puppeteer (supports Cyrillic)
router.post('/generate-pdf', authenticate, async (req, res) => {
  try {
    const { hotelName, tourType, year, sections } = req.body;
    const TOUR_NAMES = { ER: 'Erlebnisreisen', CO: 'ComfortPlus', KAS: 'Kasachstan', ZA: 'Zentralasien' };
    const tourLabel = TOUR_NAMES[tourType] || tourType;

    // Logo
    const logoPath = path.join(__dirname, '../../uploads/logo.png');
    let logoHtml = '<div style="font-size:18pt;font-weight:bold;color:#D4842F;margin-bottom:8px">ORIENT INSIGHT</div>';
    try {
      if (fs.existsSync(logoPath)) {
        const dataUrl = `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;
        logoHtml = `<img src="${dataUrl}" alt="Orient Insight" style="width:180px;height:auto;margin-bottom:8px" />`;
      }
    } catch {}

    const today = new Date();
    const dateStr = `${String(today.getDate()).padStart(2,'0')}.${String(today.getMonth()+1).padStart(2,'0')}.${today.getFullYear()}`;

    // Build sections HTML
    let sectionsHtml = '';
    for (const sec of sections) {
      if (sec.label) {
        sectionsHtml += `<div class="section-label">${sec.label}</div>`;
      }
      sectionsHtml += `
      <table class="summary-table">
        <thead>
          <tr>
            <th>№</th>
            <th>Группа</th>
            <th>Страна</th>
            <th>PAX</th>
            <th>Заезд</th>
            <th>Выезд</th>
            <th>DBL</th>
            <th>TWN</th>
            <th>SNGL</th>
            <th>Тип номера</th>
          </tr>
        </thead>
        <tbody>`;
      for (const row of sec.rows) {
        if (row.isTotal) {
          sectionsHtml += `<tr class="row-total">
            <td></td>
            <td style="text-align:left;">ИТОГО</td>
            <td></td>
            <td>${row.pax}</td>
            <td></td>
            <td></td>
            <td>${row.dbl}</td>
            <td>${row.twn}</td>
            <td>${row.sngl}</td>
            <td></td>
          </tr>`;
        } else {
          const cls = row.cancelled ? 'class="row-cancelled"' : '';
          sectionsHtml += `<tr ${cls}>
            <td>${row.no}</td>
            <td style="text-align:left;">${row.group}</td>
            <td>${row.cancelled ? 'СТОРНО' : row.country}</td>
            <td>${row.pax}</td>
            <td>${row.checkIn}</td>
            <td>${row.checkOut}</td>
            <td>${row.dbl}</td>
            <td>${row.twn}</td>
            <td>${row.sngl}</td>
            <td>${row.cancelled ? '' : 'стандарт'}</td>
          </tr>`;
        }
      }
      sectionsHtml += `</tbody></table>`;
    }

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Tinos:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
  <style>
    @page { size: A4 portrait; margin: 15mm 12mm 15mm 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Tinos', 'Times New Roman', Times, serif; font-size: 9pt; line-height: 1.3; color: #000; }
    .header-table { width: 100%; border: none; border-collapse: collapse; margin-bottom: 10px; }
    .date-hotel-row { width: 100%; border: none; border-collapse: collapse; margin-bottom: 15px; }
    .date-hotel-row td { vertical-align: top; padding: 3px; }
    .zayvka-title { text-align: center; font-size: 14pt; font-weight: bold; margin: 15px 0; text-decoration: underline; }
    .intro-text { margin-bottom: 15px; text-align: justify; }
    .section-label { margin: 14px 0 5px 0; font-size: 11pt; font-weight: bold; }
    .summary-table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
    .summary-table th, .summary-table td { border: 1px solid #000; padding: 4px 3px; text-align: center; font-size: 8pt; }
    .summary-table th { background-color: #f0f0f0; font-weight: bold; }
    .row-cancelled { background: #ffd2d2; color: #a00000; }
    .row-total { background: #dce3fa; font-weight: bold; }
    .signature-table { width: 100%; border: none; border-collapse: collapse; margin-top: 25px; font-size: 9pt; }
    .signature-table td { padding: 5px; }
  </style>
</head>
<body>
  <!-- Logo + Company Info -->
  <table class="header-table">
    <tr>
      <td style="width:100%;text-align:center;">
        ${logoHtml}
        <div style="font-size:9pt;margin-top:6px;">
          <strong>Республика Узбекистан,</strong><br>
          г.Самарканд, Шота Руставели, дом 45<br>
          Тел/fax.: +998 933484208, +998 97 9282814<br>
          E-Mail: orientinsightreisen@gmail.com<br>
          Website: orient-insight.uz
        </div>
      </td>
    </tr>
  </table>

  <!-- Date and Hotel -->
  <table class="date-hotel-row">
    <tr>
      <td style="width:50%;text-align:left;"><strong>Дата:</strong> ${dateStr}</td>
      <td style="width:50%;text-align:right;">
        <strong>Директору гостиницы</strong><br>
        <strong>${hotelName}</strong>
      </td>
    </tr>
  </table>

  <!-- Title -->
  <div class="zayvka-title">ЗАЯВКА ${year} — ${tourLabel}</div>

  <div class="intro-text">
    ООО <strong>"ORIENT INSIGHT"</strong> приветствует Вас, и просит забронировать места с учетом нижеследующих деталей.
  </div>

  ${sectionsHtml}

  <p style="font-style:italic;font-size:9pt;margin-top:6px;">Оплату гости производят на месте.</p>

  <table class="signature-table">
    <tr>
      <td style="width:45%;font-weight:bold;"><strong>Директор ООО «ORIENT INSIGHT»</strong></td>
      <td style="width:35%;text-align:center;">_________________________</td>
      <td style="width:20%;text-align:right;font-weight:bold;"><strong>Милиев С.Р.</strong></td>
    </tr>
  </table>
</body>
</html>`;

    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfUint8 = await page.pdf({ format: 'A4', margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' }, printBackground: true });
    await browser.close();

    const pdfBuffer = Buffer.isBuffer(pdfUint8) ? pdfUint8 : Buffer.from(pdfUint8);
    console.log(`PDF generated: ${pdfBuffer.length} bytes for ${hotelName}`);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Content-Disposition', `attachment; filename="${year}_${tourType}_${hotelName.replace(/[^a-zA-Z0-9_.\-]/g,'_')}.pdf"`);
    res.end(pdfBuffer);
  } catch (err) {
    console.error('Jahresplanung generate-pdf error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/jahresplanung/logo — returns Orient Insight logo as base64 data URL
router.get('/logo', authenticate, async (req, res) => {
  try {
    const logoPath = path.join(__dirname, '../../uploads/logo.png');
    if (fs.existsSync(logoPath)) {
      const buf = fs.readFileSync(logoPath);
      res.json({ dataUrl: `data:image/png;base64,${buf.toString('base64')}` });
    } else {
      res.json({ dataUrl: null });
    }
  } catch (err) {
    res.json({ dataUrl: null });
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
