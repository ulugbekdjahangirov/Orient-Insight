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

// ── Hardcoded city-level offsets (days from departureDate) per tour type.
//    These are the SOURCE OF TRUTH for virtual (planned) entries.
//    Derived from ER-01 real accommodations; stays reliable regardless of DB data quality.
//
//    ER schedule (arrival = dep+1):
//      Tashkent initial  : dep+1  (2 nights → checkout dep+3)
//      Samarkand         : dep+3  (3 nights → checkout dep+6)
//      Asraf             : dep+6  (1 night  → checkout dep+7)
//      Bukhara           : dep+7  (3 nights → checkout dep+10)
//      Khiva             : dep+10 (3 nights → checkout dep+13)
//      Tashkent return   : dep+12 (1 night  → checkout dep+13)
const TOUR_CITY_OFFSETS = {
  // ER (arrival = dep+1): Tashkent 2n → Samarkand 3n → Asraf 1n → Bukhara 3n → Khiva 3n → Tashkent 1n
  ER: {
    tashkent:  [
      { checkInOffset: 1,  nights: 2 },  // arrival / initial Tashkent
      { checkInOffset: 12, nights: 1 },  // return Tashkent
    ],
    samarkand: [{ checkInOffset: 3,  nights: 3 }],
    asraf:     [{ checkInOffset: 6,  nights: 1 }],
    bukhara:   [{ checkInOffset: 7,  nights: 3 }],
    khiva:     [{ checkInOffset: 10, nights: 3 }],
  },
  // CO (arrival = dep+1): Tashkent 2n → Fergana 1n → Tashkent 1n → Samarkand 2n → Bukhara 3n → Khiva 2n → Tashkent 1n
  CO: {
    tashkent:  [
      { checkInOffset: 1,  nights: 2 },  // arrival Tashkent
      { checkInOffset: 4,  nights: 1 },  // Tashkent transit (after Fergana)
      { checkInOffset: 12, nights: 1 },  // return Tashkent
    ],
    fergana:   [{ checkInOffset: 3,  nights: 1 }],
    samarkand: [{ checkInOffset: 5,  nights: 2 }],
    bukhara:   [{ checkInOffset: 7,  nights: 3 }],
    khiva:     [{ checkInOffset: 10, nights: 2 }],
  },
  // KAS (arrival = dep+14): Fergana 1n → [travel] → Bukhara 2n → Samarkand 2n → Tashkent 2n
  KAS: {
    fergana:   [{ checkInOffset: 14, nights: 1 }],
    bukhara:   [{ checkInOffset: 16, nights: 2 }],
    samarkand: [{ checkInOffset: 18, nights: 2 }],
    tashkent:  [{ checkInOffset: 20, nights: 2 }],
  },
  // ZA (arrival = dep+4): Bukhara 3n → Samarkand 2n → [border] → Tashkent 1n
  ZA: {
    bukhara:   [{ checkInOffset: 4,  nights: 3 }],
    samarkand: [{ checkInOffset: 7,  nights: 2 }],
    tashkent:  [{ checkInOffset: 10, nights: 1 }],
  },
};

/** Returns hardcoded offsets for (tourType, cityName), or null if not defined. */
function getHardcodedOffsets(tourType, cityName) {
  const typeMap = TOUR_CITY_OFFSETS[tourType];
  if (!typeMap || !cityName) return null;
  const key = cityName.trim().toLowerCase();
  for (const [mapKey, offsets] of Object.entries(typeMap)) {
    if (key.includes(mapKey) || mapKey.includes(key)) {
      return offsets.map(o => ({
        checkInOffset:  o.checkInOffset,
        checkOutOffset: o.checkInOffset + o.nights,
        nights:         o.nights
      }));
    }
  }
  return null;
}

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

    // ── Step 2b: If no accommodations exist yet (e.g. ZA), fall back to AccommodationTemplate
    //    so that planned virtual entries can still be shown using hardcoded city offsets.
    if (hotelRefMap.size === 0) {
      const templates = await prisma.accommodationTemplate.findMany({
        where: { tourTypeCode: tourType },
        orderBy: { sortOrder: 'asc' }
      });
      const hotelIds = [...new Set(templates.map(t => t.hotelId).filter(Boolean))];
      if (hotelIds.length > 0) {
        const hotels = await prisma.hotel.findMany({
          where: { id: { in: hotelIds } },
          include: { city: true }
        });
        for (const hotel of hotels) {
          if (!hotelRefMap.has(hotel.id)) {
            hotelRefMap.set(hotel.id, { hotel, refBookings: new Map() });
          }
        }
      }
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

      // ── Try hardcoded city offsets first (reliable, data-independent)
      let offsets = getHardcodedOffsets(tourType, hotelRef.hotel.city?.name);

      // ── Fallback: derive offsets from reference booking (used for CO / KAS / ZA)
      if (!offsets) {
        const refEntries = Array.from(hotelRef.refBookings.entries())
          .sort((a, b) => {
            const aInYear = new Date(a[1][0].checkInDate).getFullYear() === year ? 1 : 0;
            const bInYear = new Date(b[1][0].checkInDate).getFullYear() === year ? 1 : 0;
            if (aInYear !== bInYear) return bInYear - aInYear;
            return new Date(b[1][0].booking.departureDate) - new Date(a[1][0].booking.departureDate);
          });

        offsets = [];
        for (const [, accs] of refEntries) {
          const refDep = new Date(accs[0].booking.departureDate);
          const sorted = [...accs].sort((a, b) => new Date(a.checkInDate) - new Date(b.checkInDate));
          const candidate = sorted.map(e => ({
            checkInOffset:  daysBetween(refDep, e.checkInDate),
            checkOutOffset: daysBetween(refDep, e.checkOutDate),
            nights: e.nights || daysBetween(e.checkInDate, e.checkOutDate)
          }));
          if (candidate.every(o => o.checkInOffset >= -90)) { offsets = candidate; break; }
        }
        if (offsets.length === 0) continue;
      }

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
            dbl: tourType === 'CO' ? 3 : 4, twn: tourType === 'CO' ? 3 : 4, sngl: 4,
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
    res.status(500).json({ error: 'Server xatoligi' });
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

    const tourNames = { ER: 'ER', CO: 'CO', KAS: 'KAS', ZA: 'ZA' };
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

    res.json({ success: true });
  } catch (err) {
    console.error('Send hotel email error:', err);
    res.status(500).json({ error: 'Server xatoligi' });
  }
});

// POST /api/jahresplanung/send-hotel-telegram/:hotelId
// Accepts FormData: pdf (file) + year + tourType + sections (JSON string)
router.post('/send-hotel-telegram/:hotelId', authenticate, upload.single('pdf'), async (req, res) => {
  try {
    const hotelId = parseInt(req.params.hotelId);
    const { year, tourType } = req.body;
    const sections = JSON.parse(req.body.sections || '[]');
    const pdfBuffer = req.file?.buffer;

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

    const tourNames = { ER: 'ER', CO: 'CO', KAS: 'KAS', ZA: 'ZA' };
    const tourLabel = tourNames[tourType] || tourType;
    const TG_BASE = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

    // ── 1. Send PDF document first (if provided)
    if (pdfBuffer) {
      const docForm = new FormData();
      docForm.append('chat_id', hotel.telegramChatId);
      docForm.append('document', pdfBuffer, {
        filename: `${year}_${tourType}_${hotel.name.replace(/\s+/g, '_')}.pdf`,
        contentType: 'application/pdf'
      });
      docForm.append('caption', `📅 Jahresplanung ${year} — ${tourLabel}\n🏨 ${hotel.name}`);
      await axios.post(`${TG_BASE}/sendDocument`, docForm, { headers: docForm.getHeaders() });
    }

    // ── 2. Intro text message
    const intro = `📅 *Заявка ${year} — ${tourLabel}*\n🏨 *${hotel.name}*\n\nQuyida har bir zaezd uchun tasdiqlash so'rovi yuboriladi:`;
    await axios.post(`${TG_BASE}/sendMessage`, {
      chat_id: hotel.telegramChatId,
      text: intro,
      parse_mode: 'Markdown'
    });

    // ── Interactive confirmation messages ─────────────────────────────────

    // Group rows by bookingId — each booking shows all its visits together
    const groupedMap = new Map();
    let grpNo = 0;
    for (const sec of sections) {
      for (const row of sec.rows) {
        if (!row.cancelled && row.bookingId) {
          if (!groupedMap.has(row.bookingId)) {
            grpNo++;
            groupedMap.set(row.bookingId, { bookingId: row.bookingId, group: row.group, no: grpNo, visits: [] });
          }
          groupedMap.get(row.bookingId).visits.push({
            sectionLabel: sec.label || null,
            checkIn: row.checkIn, checkOut: row.checkOut,
            pax: row.pax, dbl: row.dbl, twn: row.twn, sngl: row.sngl
          });
        }
      }
    }
    const groups = Array.from(groupedMap.values());

    if (groups.length > 0) {
      const TG_API = TG_BASE;
      const header = `📋 *Заявка ${year} — ${tourLabel}*  🏨 *${hotel.name}*`;

      // Assign global visitIdx to each visit across all groups
      let visitIdx = 0;
      for (const grp of groups) {
        for (const v of grp.visits) {
          v.visitIdx = visitIdx++;
          v.status = 'PENDING';
          v.msgId = null;
        }
      }

      // Send visit messages in parallel batches of 10 (much faster than sequential)
      // Send all visit messages simultaneously — no batching
      await Promise.all(groups.flatMap(grp => grp.visits.map(async v => {
        const visitTitle = v.sectionLabel
          ? `*${grp.no}. ${grp.group} — ${v.sectionLabel}*`
          : `*${grp.no}. ${grp.group}*`;
        const lines = [
          header, '',
          visitTitle,
          `⬜ ${v.checkIn} → ${v.checkOut} | ${v.pax} pax | DBL:${v.dbl} TWN:${v.twn} SNGL:${v.sngl}`
        ];
        const msgRes = await axios.post(`${TG_API}/sendMessage`, {
          chat_id: hotel.telegramChatId,
          text: lines.join('\n'),
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[
            { text: '✅ Tasdiqlash', callback_data: `jp_c:${grp.bookingId}:${hotelId}:${v.visitIdx}` },
            { text: '⏳ WL',        callback_data: `jp_w:${grp.bookingId}:${hotelId}:${v.visitIdx}` },
            { text: '❌ Rad etish', callback_data: `jp_r:${grp.bookingId}:${hotelId}:${v.visitIdx}` },
          ]]}
        });
        v.msgId = msgRes.data?.result?.message_id || null;
      })));

      // Final bulk-action message
      const totalVisits = groups.reduce((s, g) => s + g.visits.length, 0);
      const bulkRes = await axios.post(`${TG_API}/sendMessage`, {
        chat_id: hotel.telegramChatId,
        text: `${header}\n\nBarcha *${totalVisits}* ta zaezd uchun:`,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[
          { text: '✅ Barchasini',     callback_data: `jp_ca:${hotelId}` },
          { text: '⏳ WL barchasi',    callback_data: `jp_wa:${hotelId}` },
          { text: '❌ Barchasini rad', callback_data: `jp_ra:${hotelId}` },
        ]]}
      });
      const bulkMsgId = bulkRes.data?.result?.message_id || null;

      // Store for webhook rebuilding (key includes tourType so same hotel can have multiple tour entries)
      const jpKey = `JP_SECTIONS_${hotelId}_${tourType}`;
      await prisma.systemSetting.upsert({
        where: { key: jpKey },
        update: { value: JSON.stringify({ year, tourType, hotelName: hotel.name, chatId: hotel.telegramChatId, groups, bulkMsgId }) },
        create: { key: jpKey, value: JSON.stringify({ year, tourType, hotelName: hotel.name, chatId: hotel.telegramChatId, groups, bulkMsgId }) }
      });

    }

    res.json({ success: true });
  } catch (err) {
    console.error('Send hotel telegram error:', err);
    res.status(500).json({ error: err.response?.data?.description || 'Telegram yuborishda xatolik' });
  }
});

// POST /api/jahresplanung/send-transport-telegram/:provider
// provider = sevil | xayrulla | nosir
// 2-stage flow: send to hammasi (approver) first → on approve → forward to actual provider
router.post('/send-transport-telegram/:provider', authenticate, upload.single('pdf'), async (req, res) => {
  try {
    const provider = req.params.provider.toLowerCase();
    const { year, tourType } = req.body;
    const pdfBuffer = req.file?.buffer;

    // Get actual provider's chat ID (for later forwarding after approval)
    const settingKey = `TRANSPORT_${provider.toUpperCase()}_CHAT_ID`;
    const setting = await prisma.systemSetting.findUnique({ where: { key: settingKey } });
    const providerChatId = setting?.value;
    if (!providerChatId) {
      return res.status(400).json({ error: `${provider} uchun Telegram chat ID sozlanmagan (${settingKey})` });
    }

    // Get hammasi (approver) chat ID
    const hammasiSetting = await prisma.systemSetting.findUnique({ where: { key: 'TRANSPORT_HAMMASI_CHAT_ID' } });
    const hammasiChatId = hammasiSetting?.value;
    if (!hammasiChatId) {
      return res.status(400).json({ error: 'Hammasi chat ID sozlanmagan (GmailSettings → Transport)' });
    }

    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (!TELEGRAM_BOT_TOKEN) {
      return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN sozlanmagan' });
    }

    const TG_BASE = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
    const providerLabel = { sevil: 'Sevil', xayrulla: 'Xayrulla', nosir: 'Nosir' }[provider] || provider;
    const tourLabel = { ER: 'ER', CO: 'CO', KAS: 'KAS', ZA: 'ZA' }[tourType] || tourType;

    // Formatted table text from frontend
    const messageText = req.body.messageText || '';

    // 1. Send PDF document to hammasi (approver) with approve/decline buttons
    let approvalMsgId = null;
    if (pdfBuffer) {
      const docForm = new FormData();
      docForm.append('chat_id', hammasiChatId);
      docForm.append('document', pdfBuffer, {
        filename: `${year}_${tourType}_Transport_${providerLabel}.pdf`,
        contentType: 'application/pdf'
      });
      const approvalCaption = [
        `⚠️ *Transport Rejasi ${year} — ${tourLabel}*`,
        `👤 *${providerLabel}*`,
        ``,
        `Tasdiqlasangiz, *${providerLabel}* ga avtomatik yuboriladi.`
      ].join('\n');
      docForm.append('caption', approvalCaption);
      docForm.append('parse_mode', 'Markdown');
      docForm.append('reply_markup', JSON.stringify({
        inline_keyboard: [[
          { text: `✅ ${providerLabel} ga yuborish`, callback_data: `tp26_approve:${year}:${tourType}:${provider}` },
          { text: '❌ Rad etish',                    callback_data: `tp26_decline:${year}:${tourType}:${provider}` },
        ]]
      }));
      const docRes = await axios.post(`${TG_BASE}/sendDocument`, docForm, { headers: docForm.getHeaders() });
      approvalMsgId = docRes.data?.result?.message_id || null;
    }

    // 2. Send formatted table as a separate text message to hammasi
    if (messageText) {
      const tableText = [
        `🚌 *Transport Rejasi ${year} — ${tourLabel}* | 👤 *${providerLabel}*`,
        ``,
        `\`\`\`\n${messageText}\n\`\`\``
      ].join('\n');
      await axios.post(`${TG_BASE}/sendMessage`, {
        chat_id: hammasiChatId,
        text: tableText,
        parse_mode: 'Markdown'
      }).catch(err => console.warn('tp26 table message warn:', err.response?.data?.description || err.message));
    }

    // 2. Save confirmation record as PENDING_APPROVAL (store providerChatId for webhook to use)
    const confKey = `JP_TRANSPORT_CONFIRM_${year}_${tourType}_${provider}`;
    await prisma.systemSetting.upsert({
      where: { key: confKey },
      update: { value: JSON.stringify({ year, tourType, provider, providerLabel, status: 'PENDING_APPROVAL', sentAt: new Date().toISOString(), messageId: approvalMsgId, chatId: hammasiChatId, providerChatId, messageText, approvedBy: null, confirmedBy: null, respondedAt: null }) },
      create: { key: confKey, value: JSON.stringify({ year, tourType, provider, providerLabel, status: 'PENDING_APPROVAL', sentAt: new Date().toISOString(), messageId: approvalMsgId, chatId: hammasiChatId, providerChatId, messageText, approvedBy: null, confirmedBy: null, respondedAt: null }) }
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Send transport telegram error:', err);
    res.status(500).json({ error: err.response?.data?.description || 'Telegram yuborishda xatolik' });
  }
});

// GET /api/jahresplanung/transport-confirmations
// Returns all JP_TRANSPORT_CONFIRM_* SystemSetting entries
router.get('/transport-confirmations', authenticate, async (req, res) => {
  try {
    const settings = await prisma.systemSetting.findMany({
      where: { key: { startsWith: 'JP_TRANSPORT_CONFIRM_' } },
      orderBy: { key: 'asc' }
    });
    const confirmations = settings.map(s => {
      try { return { key: s.key, ...JSON.parse(s.value) }; }
      catch { return { key: s.key }; }
    });
    res.json({ confirmations });
  } catch (err) {
    console.error('Get transport confirmations error:', err);
    res.status(500).json({ error: 'Server xatoligi' });
  }
});

// DELETE /api/jahresplanung/transport-confirmations/:key
router.delete('/transport-confirmations/:key', authenticate, async (req, res) => {
  try {
    const key = `JP_TRANSPORT_CONFIRM_${req.params.key}`;
    await prisma.systemSetting.delete({ where: { key } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server xatoligi' });
  }
});

// ── Persistent Puppeteer browser (reused across requests — saves 2-4s per PDF)
const puppeteer = require('puppeteer');
let _pdfBrowser = null;
async function getPdfBrowser() {
  if (!_pdfBrowser || !_pdfBrowser.connected) {
    _pdfBrowser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
  }
  return _pdfBrowser;
}

// ── Shared helper: generate PDF buffer via Puppeteer ─────────────────────────
async function generatePdfBuffer(hotelName, tourType, year, sections) {
    const TOUR_NAMES = { ER: 'ER', CO: 'CO', KAS: 'KAS', ZA: 'ZA' };
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
  <style>
    @page { size: A4 portrait; margin: 15mm 12mm 15mm 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'DejaVu Serif', 'Times New Roman', Times, serif; font-size: 9pt; line-height: 1.3; color: #000; }
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

    const browser = await getPdfBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 });
      const pdfUint8 = await page.pdf({ format: 'A4', margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' }, printBackground: true });
      const pdfBuffer = Buffer.isBuffer(pdfUint8) ? pdfUint8 : Buffer.from(pdfUint8);
      return pdfBuffer;
    } finally {
      await page.close(); // close page but keep browser alive for next request
    }
}

// POST /api/jahresplanung/generate-pdf — server-side PDF via puppeteer (supports Cyrillic)
router.post('/generate-pdf', authenticate, async (req, res) => {
  try {
    const { hotelName, tourType, year, sections } = req.body;
    const pdfBuffer = await generatePdfBuffer(hotelName, tourType, year, sections);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Content-Disposition', `attachment; filename="${year}_${tourType}_${hotelName.replace(/[^a-zA-Z0-9_.\-]/g,'_')}.pdf"`);
    res.end(pdfBuffer);
  } catch (err) {
    console.error('Jahresplanung generate-pdf error:', err);
    res.status(500).json({ error: 'Server xatoligi' });
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
    res.status(500).json({ error: 'Server xatoligi' });
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
    res.status(500).json({ error: 'Server xatoligi' });
  }
});

// GET /api/jahresplanung/meal-overrides?year=2026&tourType=ER
router.get('/meal-overrides', authenticate, async (req, res) => {
  try {
    const { year, tourType } = req.query;
    const key = `JP_MEAL_OVR_${year}_${tourType}`;
    const s = await prisma.systemSetting.findUnique({ where: { key } });
    res.json(s ? JSON.parse(s.value) : {});
  } catch (err) {
    res.status(500).json({ error: 'Server xatoligi' });
  }
});

// PUT /api/jahresplanung/meal-overrides
router.put('/meal-overrides', authenticate, async (req, res) => {
  try {
    const { year, tourType, data } = req.body;
    const key = `JP_MEAL_OVR_${year}_${tourType}`;
    await prisma.systemSetting.upsert({
      where: { key },
      update: { value: JSON.stringify(data) },
      create: { key, value: JSON.stringify(data) }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server xatoligi' });
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
    res.status(500).json({ error: 'Server xatoligi' });
  }
});

// PUT /api/jahresplanung/jp-sections/:hotelId/visit-status — update visit status from Jahresplanung UI
router.put('/jp-sections/:hotelId/visit-status', authenticate, async (req, res) => {
  try {
    const hotelId = parseInt(req.params.hotelId);
    const { bookingId, status, tourType } = req.body; // status: CONFIRMED|WAITING|PENDING|REJECTED

    // Try new tourType-keyed format first, then fall back to old format
    const key = tourType ? `JP_SECTIONS_${hotelId}_${tourType}` : `JP_SECTIONS_${hotelId}`;
    let setting = await prisma.systemSetting.findUnique({ where: { key } });
    if (!setting && tourType) {
      // Fallback to old format
      setting = await prisma.systemSetting.findUnique({ where: { key: `JP_SECTIONS_${hotelId}` } });
    }
    if (!setting) return res.status(404).json({ error: 'JP_SECTIONS not found' });

    const stored = JSON.parse(setting.value);
    let updated = false;
    stored.groups?.forEach(grp => {
      if (grp.bookingId === parseInt(bookingId)) {
        grp.visits?.forEach(v => { v.status = status; updated = true; });
      }
    });
    if (!updated) return res.status(404).json({ error: 'Booking not found in JP_SECTIONS' });

    await prisma.systemSetting.update({
      where: { key: setting.key },
      data: { value: JSON.stringify(stored) }
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server xatoligi' });
  }
});

// DELETE /api/jahresplanung/jp-sections/:hotelId/group/:bookingId/visit/:visitIdx
router.delete('/jp-sections/:hotelId/group/:bookingId/visit/:visitIdx', authenticate, async (req, res) => {
  try {
    const hotelId = parseInt(req.params.hotelId);
    const bookingId = parseInt(req.params.bookingId);
    const visitIdx = parseInt(req.params.visitIdx);
    const tourType = req.query.tourType;

    const key = tourType ? `JP_SECTIONS_${hotelId}_${tourType}` : `JP_SECTIONS_${hotelId}`;
    const setting = await prisma.systemSetting.findUnique({ where: { key } });
    if (!setting) return res.status(404).json({ error: 'JP_SECTIONS not found' });

    const stored = JSON.parse(setting.value);
    stored.groups = (stored.groups || []).map(grp => {
      if (grp.bookingId !== bookingId) return grp;
      return { ...grp, visits: (grp.visits || []).filter(v => v.visitIdx !== visitIdx) };
    }).filter(grp => grp.visits && grp.visits.length > 0);

    await prisma.systemSetting.update({
      where: { key },
      data: { value: JSON.stringify(stored) }
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server xatoligi' });
  }
});

// DELETE /api/jahresplanung/jp-sections/:hotelId/group/:bookingId
router.delete('/jp-sections/:hotelId/group/:bookingId', authenticate, async (req, res) => {
  try {
    const hotelId = parseInt(req.params.hotelId);
    const bookingId = parseInt(req.params.bookingId);
    const tourType = req.query.tourType;

    const key = tourType ? `JP_SECTIONS_${hotelId}_${tourType}` : `JP_SECTIONS_${hotelId}`;
    const setting = await prisma.systemSetting.findUnique({ where: { key } });
    if (!setting) return res.status(404).json({ error: 'JP_SECTIONS not found' });

    const stored = JSON.parse(setting.value);
    stored.groups = (stored.groups || []).filter(grp => grp.bookingId !== bookingId);

    await prisma.systemSetting.update({
      where: { key },
      data: { value: JSON.stringify(stored) }
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server xatoligi' });
  }
});

// DELETE /api/jahresplanung/jp-sections/:hotelId — delete entire hotel JP_SECTIONS (specific tourType)
// Also clears this hotel's rowStatuses from JP_STATE entries
router.delete('/jp-sections/:hotelId', authenticate, async (req, res) => {
  try {
    const hotelId = parseInt(req.params.hotelId);
    const tourType = req.query.tourType;

    // 1. Delete JP_SECTIONS (new format key with tourType, and old format for compat)
    if (tourType) {
      await prisma.systemSetting.deleteMany({ where: { key: { in: [`JP_SECTIONS_${hotelId}_${tourType}`, `JP_SECTIONS_${hotelId}`] } } });
    } else {
      await prisma.systemSetting.deleteMany({ where: { key: { startsWith: `JP_SECTIONS_${hotelId}` } } });
    }

    // 2. Clear rowStatuses for this hotel from all JP_STATE_* entries
    const prefix = `${hotelId}_`;
    const jpStates = await prisma.systemSetting.findMany({
      where: { key: { startsWith: 'JP_STATE_' } }
    });
    for (const state of jpStates) {
      try {
        const data = JSON.parse(state.value);
        if (data.statuses) {
          const cleaned = Object.fromEntries(
            Object.entries(data.statuses).filter(([k]) => !k.startsWith(prefix))
          );
          if (Object.keys(cleaned).length !== Object.keys(data.statuses).length) {
            data.statuses = cleaned;
            await prisma.systemSetting.update({
              where: { key: state.key },
              data: { value: JSON.stringify(data) }
            });
          }
        }
      } catch {}
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server xatoligi' });
  }
});

// GET /api/jahresplanung/jp-sections — all JP_SECTIONS data for Partners Hotels tab
router.get('/jp-sections', authenticate, async (req, res) => {
  try {
    const yearFilter = req.query.year ? parseInt(req.query.year) : null;
    const settings = await prisma.systemSetting.findMany({
      where: { key: { startsWith: 'JP_SECTIONS_' } }
    });

    // Collect all hotelIds and fetch city info in one query
    const hotelIds = settings.map(s => parseInt(s.key.replace('JP_SECTIONS_', '')));
    const hotels = await prisma.hotel.findMany({
      where: { id: { in: hotelIds } },
      include: { city: { select: { name: true, sortOrder: true } } }
    });
    const hotelMap = {};
    hotels.forEach(h => { hotelMap[h.id] = h; });

    const sections = settings.map(s => {
      const hotelId = parseInt(s.key.replace('JP_SECTIONS_', ''));
      try {
        const data = JSON.parse(s.value);
        const hotel = hotelMap[hotelId];
        return {
          hotelId,
          ...data,
          cityName: hotel?.city?.name || null,
          citySortOrder: hotel?.city?.sortOrder ?? 999,
        };
      } catch {
        return null;
      }
    }).filter(Boolean).filter(s => !yearFilter || s.year === yearFilter);

    res.json({ sections });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server xatoligi' });
  }
});

// ── GET /api/jahresplanung/meals?year=2026&tourType=ER ─────────────────────
// City aliases: special cities not in TOUR_CITY_OFFSETS mapped to nearest city offset
const CITY_MEAL_ALIASES = {
  nurata:    'bukhara',   // ER: on the road Asraf → Bukhara, same arrival day as Bukhara
  qizilqum:  'khiva',    // CO: on the road Bukhara → Khiva, same arrival day as Khiva
  navoi:     'bukhara',  // near Bukhara route
};

function getMealDayOffset(tourType, cityName) {
  if (!cityName) return null;
  const key = cityName.trim().toLowerCase();
  const typeMap = TOUR_CITY_OFFSETS[tourType];
  if (!typeMap) return null;
  // Check alias first
  const aliasKey = CITY_MEAL_ALIASES[key];
  if (aliasKey && typeMap[aliasKey]) return typeMap[aliasKey][0].checkInOffset;
  // Direct match
  for (const [mapKey, offsets] of Object.entries(typeMap)) {
    if (key.includes(mapKey) || mapKey.includes(key)) return offsets[0].checkInOffset;
  }
  return null;
}

function addDaysFmt(dateStr, days) {
  if (!dateStr || days === null) return null;
  // Use UTC methods to avoid timezone shift (dates stored as midnight UTC+5 = 19:00 UTC prev day)
  const base = new Date(dateStr);
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + days));
  return `${String(d.getUTCDate()).padStart(2,'0')}.${String(d.getUTCMonth()+1).padStart(2,'0')}.${d.getUTCFullYear()}`;
}

router.get('/meals', authenticate, async (req, res) => {
  try {
    const { year = new Date().getFullYear(), tourType = 'ER' } = req.query;
    const yearInt = parseInt(year);

    // 1. Load OPEX meal items for this tourType
    const opexSetting = await prisma.opexConfig.findUnique({
      where: { tourType_category_year: { tourType, category: 'meal', year: yearInt } }
    });
    const mealItems = opexSetting ? JSON.parse(opexSetting.itemsJson) : [];

    // 2. Load bookings for this tourType in target year (not CANCELLED)
    const allBookings = await prisma.booking.findMany({
      where: {
        tourType: { code: tourType },
        status: { not: 'CANCELLED' },
        departureDate: {
          gte: new Date(`${yearInt}-01-01`),
          lt:  new Date(`${yearInt + 1}-01-01`)
        }
      },
      select: { id: true, bookingNumber: true, pax: true, departureDate: true, status: true },
      orderBy: { bookingNumber: 'asc' }
    });

    // 3. Load MealConfirmations for those bookings
    const bookingIds = allBookings.map(b => b.id);
    const confirmations = bookingIds.length > 0
      ? await prisma.mealConfirmation.findMany({
          where: { bookingId: { in: bookingIds } },
          orderBy: { sentAt: 'desc' }
        })
      : [];

    // 4. Load restaurant Telegram chat IDs
    let chatIds = {};
    try {
      const s = await prisma.systemSetting.findUnique({ where: { key: 'MEAL_RESTAURANT_CHAT_IDS' } });
      if (s) chatIds = JSON.parse(s.value);
    } catch {}

    // 5. Build restaurant → bookings structure
    const restaurants = mealItems.map(meal => {
      // meal.dayOffset overrides auto-computed city offset (for same-city restaurants on different days)
      const dayOffset = meal.dayOffset != null ? meal.dayOffset : getMealDayOffset(tourType, meal.city);
      const bookings = allBookings.map(booking => {
        const conf = confirmations.find(
          c => c.bookingId === booking.id && c.restaurantName === meal.name
        );
        // Always use computed date (dep + city offset) — MealConf.mealDate can be wrong
        const computedDate = addDaysFmt(booking.departureDate, dayOffset);
        return {
          bookingId:     booking.id,
          bookingNumber: booking.bookingNumber,
          pax:           booking.pax || 0,
          departureDate: booking.departureDate,
          bookingStatus: booking.status,
          mealDate:      computedDate,
          confirmation:  conf ? {
            id:          conf.id,
            status:      conf.status,
            confirmedBy: conf.confirmedBy,
            mealDate:    conf.mealDate,
            sentAt:      conf.sentAt,
            respondedAt: conf.respondedAt
          } : null
        };
      });
      return {
        name:        meal.name,
        city:        meal.city || '',
        hasTelegram: !!chatIds[meal.name],
        bookings
      };
    });

    res.json({ restaurants, year: yearInt, tourType });
  } catch (err) {
    console.error('JP meals error:', err.message);
    res.status(500).json({ error: 'Server xatoligi' });
  }
});

// POST /api/jahresplanung/send-meal-telegram
router.post('/send-meal-telegram', authenticate, upload.single('pdf'), async (req, res) => {
  try {
    const { restaurantName, year, tourType } = req.body;
    const bookings = JSON.parse(req.body.bookings || '[]');

    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (!TELEGRAM_BOT_TOKEN) return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN sozlanmagan' });

    const s = await prisma.systemSetting.findUnique({ where: { key: 'MEAL_RESTAURANT_CHAT_IDS' } });
    const chatIds = s ? JSON.parse(s.value) : {};
    const chatId = chatIds[restaurantName];
    if (!chatId) return res.status(400).json({ error: `${restaurantName} uchun Telegram chat ID topilmadi` });

    const TG_BASE = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
    const tourLabel = { ER: 'ER', CO: 'CO', KAS: 'KAS', ZA: 'ZA' }[tourType] || tourType;

    // 1. Send PDF
    if (req.file) {
      const docForm = new FormData();
      docForm.append('chat_id', chatId);
      docForm.append('document', req.file.buffer, {
        filename: `${year}_${tourType}_${restaurantName}.pdf`,
        contentType: 'application/pdf'
      });
      docForm.append('caption', `🍽 Jahresplanung ${year} — ${tourLabel}\n🏪 ${restaurantName}`);
      await axios.post(`${TG_BASE}/sendDocument`, docForm, { headers: docForm.getHeaders() });
    }

    // 2. Intro message
    await axios.post(`${TG_BASE}/sendMessage`, {
      chat_id: chatId,
      text: `🍽 *Заявка ${year} — ${tourLabel}*\n🏪 *${restaurantName}*\n\nQuyida har bir guruh uchun tasdiqlash so'rovi:`,
      parse_mode: 'Markdown'
    });

    // 3. Per-booking: upsert MealConfirmation → send message with confirm/reject buttons
    for (const b of bookings) {
      // Upsert MealConfirmation
      let conf;
      const existing = await prisma.mealConfirmation.findFirst({
        where: { bookingId: b.bookingId, restaurantName }
      });
      if (existing) {
        conf = await prisma.mealConfirmation.update({
          where: { id: existing.id },
          data: { status: 'PENDING', sentAt: new Date(), mealDate: b.mealDate || null, pax: b.pax }
        });
      } else {
        conf = await prisma.mealConfirmation.create({
          data: { bookingId: b.bookingId, restaurantName, city: '', mealDate: b.mealDate || null, pax: b.pax, status: 'PENDING', sentAt: new Date() }
        });
      }

      // Send individual message with confirm/reject buttons
      const msgText = `🍽 *${restaurantName}*\n📋 *${b.bookingNumber}*\n📅 ${b.mealDate || '—'} | 👥 ${b.pax} pax`;
      await axios.post(`${TG_BASE}/sendMessage`, {
        chat_id: chatId,
        text: msgText,
        parse_mode: 'Markdown',
        reply_markup: JSON.stringify({
          inline_keyboard: [[
            { text: '✅ Tasdiqlash', callback_data: `meal_confirm:${conf.id}` },
            { text: '❌ Rad qilish', callback_data: `meal_reject:${conf.id}` }
          ]]
        })
      });
    }

    res.json({ success: true, count: bookings.length });
  } catch (err) {
    console.error('send-meal-telegram error:', err.message);
    res.status(500).json({ error: 'Server xatoligi' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Transport planning endpoints
// ─────────────────────────────────────────────────────────────────────────────

// Normalize route provider → 'sevil' | 'xayrulla' | 'nosir' | null
function normalizeProvider(p) {
  if (!p) return null;
  const s = p.toLowerCase();
  if (s.startsWith('sevil')) return 'sevil';
  if (s === 'xayrulla') return 'xayrulla';
  if (s === 'nosir') return 'nosir';
  return null;
}

// GET /api/jahresplanung/transport?year=2026&tourType=ER
router.get('/transport', authenticate, async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const tourType = req.query.tourType || 'ER';

    const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
    const endDate   = new Date(`${year + 1}-01-01T00:00:00.000Z`);

    const bookings = await prisma.booking.findMany({
      where: {
        tourType: { code: tourType },
        departureDate: { gte: startDate, lt: endDate }
      },
      select: {
        id: true,
        bookingNumber: true,
        pax: true,
        status: true,
        departureDate: true
      },
      orderBy: { bookingNumber: 'asc' }
    });

    const bookingIds = bookings.map(b => b.id);
    const routes = await prisma.route.findMany({
      where: { bookingId: { in: bookingIds }, date: { not: null } },
      select: {
        bookingId: true, date: true, provider: true, personCount: true,
        routeName: true, departureTime: true, transportType: true, itinerary: true, dayNumber: true
      },
      orderBy: [{ bookingId: 'asc' }, { date: 'asc' }, { dayNumber: 'asc' }]
    });

    // Cluster consecutive dates into segments.
    // Gap > maxGap days between consecutive route dates → new segment.
    function clusterDates(sortedEntries, maxGap = 1) {
      const segments = [];
      let segMin = null, segMax = null, segPax = 0;
      for (const { date: d, personCount: pc } of sortedEntries) {
        const pax = pc || 0;
        if (!segMin) {
          segMin = d; segMax = d; segPax = pax;
        } else {
          const gapDays = Math.round((d - segMax) / 86400000);
          if (gapDays > maxGap) {
            segments.push({ von: segMin.toISOString().slice(0, 10), bis: segMax.toISOString().slice(0, 10), pax: segPax });
            segMin = d; segMax = d; segPax = pax;
          } else {
            if (d > segMax) segMax = d;
            if (pax > segPax) segPax = pax;
          }
        }
      }
      if (segMin) segments.push({ von: segMin.toISOString().slice(0, 10), bis: segMax.toISOString().slice(0, 10), pax: segPax });
      return segments;
    }

    // No special gap overrides — CO/nosir routes are on day2+day3 (consecutive)
    // Template placeholders on day10-12 form separate cluster, filtered by MAX_MULTI_MAP on client
    const CLUSTER_GAP_OVERRIDE = {};

    // Collect all route dates per provider+booking
    const raw = { sevil: {}, xayrulla: {}, nosir: {} };
    for (const r of routes) {
      const norm = normalizeProvider(r.provider);
      if (!norm || !r.date) continue;
      const k = String(r.bookingId);
      if (!raw[norm][k]) raw[norm][k] = [];
      raw[norm][k].push({ date: new Date(r.date), personCount: r.personCount || 0 });
    }

    // Build routeMap: provider → bookingId → { segments: [{ von, bis, pax }, ...] }
    const routeMap = {};
    for (const [prov, bookMap] of Object.entries(raw)) {
      routeMap[prov] = {};
      for (const [bId, entries] of Object.entries(bookMap)) {
        entries.sort((a, b) => a.date - b.date);
        const maxGap = CLUSTER_GAP_OVERRIDE[tourType]?.[prov] ?? 1;
        routeMap[prov][bId] = { segments: clusterDates(entries, maxGap) };
      }
    }

    // Build routeDetails: provider → bookingId → [{ date, routeName, pax, time, vehicle, itinerary }]
    const routeDetails = { sevil: {}, xayrulla: {}, nosir: {} };
    for (const r of routes) {
      const norm = normalizeProvider(r.provider);
      if (!norm) continue;
      const k = String(r.bookingId);
      if (!routeDetails[norm][k]) routeDetails[norm][k] = [];
      routeDetails[norm][k].push({
        date: r.date.toISOString().slice(0, 10),
        routeName: r.routeName || '',
        pax: r.personCount || 0,
        time: r.departureTime || '',
        vehicle: r.transportType || '',
        itinerary: r.itinerary || ''
      });
    }

    // Manual overrides: key = "{provider}_{bookingId}_{segVon}" → { vonOverride, bisOverride, paxOverride }
    const setting = await prisma.systemSetting.findUnique({
      where: { key: `JP_TRANSPORT_${year}_${tourType}` }
    });
    const manualOverrides = setting ? JSON.parse(setting.value) : {};

    res.json({ bookings, routeMap, routeDetails, manualOverrides, year, tourType });
  } catch (err) {
    console.error('Jahresplanung transport error:', err);
    res.status(500).json({ error: 'Server xatoligi' });
  }
});

// PUT /api/jahresplanung/transport
router.put('/transport', authenticate, async (req, res) => {
  try {
    const { year, tourType, data } = req.body;
    const key = `JP_TRANSPORT_${year}_${tourType}`;
    await prisma.systemSetting.upsert({
      where: { key },
      create: { key, value: JSON.stringify(data) },
      update: { value: JSON.stringify(data) }
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Jahresplanung transport save error:', err);
    res.status(500).json({ error: 'Server xatoligi' });
  }
});

module.exports = router;
