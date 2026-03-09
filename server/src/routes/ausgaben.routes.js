const express = require('express');
const router = express.Router();
const multer = require('multer');
const FormData = require('form-data');
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const upload = multer({ storage: multer.memoryStorage() });
const AUSGABEN_API = () => `https://api.telegram.org/bot${process.env.TELEGRAM_AUSGABEN_TOKEN}`;

// ── Tab config ────────────────────────────────────────────────────────────────
const TABS = {
  'ausgaben': '💰 Ausgaben',
  'rl':       '👤 Reiseleiter',
  'bank':     '🏦 Bank',
  'spater':   '📅 Später',
  'karta':    '💳 Karta'
};

const MAIN_KEYBOARD = {
  keyboard: [
    ['💰 Ausgaben', '👤 Reiseleiter'],
    ['🏦 Bank', '📅 Später', '💳 Karta']
  ],
  resize_keyboard: true,
  persistent: true
};

// ── Telegram helpers ──────────────────────────────────────────────────────────
async function sendMessage(chatId, text, extra = {}) {
  await axios.post(`${AUSGABEN_API()}/sendMessage`, { chat_id: chatId, text, parse_mode: 'Markdown', ...extra })
    .catch(e => console.error('TG sendMessage error:', e.response?.data || e.message));
}

async function editMessage(chatId, messageId, text, inlineKeyboard) {
  await axios.post(`${AUSGABEN_API()}/editMessageText`, {
    chat_id: chatId, message_id: messageId, text, parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: inlineKeyboard }
  }).catch(e => console.error('TG editMessage error:', e.response?.data || e.message));
}

async function answerCallback(callbackQueryId, text = '') {
  await axios.post(`${AUSGABEN_API()}/answerCallbackQuery`, { callback_query_id: callbackQueryId, text })
    .catch(() => {});
}

// ── Tour type inline keyboard ─────────────────────────────────────────────────
function tourTypeKeyboard(tab) {
  return {
    inline_keyboard: [
      [
        { text: 'ER', callback_data: `type:${tab}:ER` },
        { text: 'CO', callback_data: `type:${tab}:CO` },
        { text: 'KAS', callback_data: `type:${tab}:KAS` },
        { text: 'ZA', callback_data: `type:${tab}:ZA` }
      ]
    ]
  };
}

// ── Sent log helpers ──────────────────────────────────────────────────────────
const SENT_LOG_KEY = 'AUSGABEN_SENT_LOG';

async function getSentLog() {
  try {
    const s = await prisma.systemSetting.findUnique({ where: { key: SENT_LOG_KEY } });
    return s ? JSON.parse(s.value) : [];
  } catch { return []; }
}

async function addToSentLog(bookingNumber, tab, fileId = null, messages = []) {
  // Read, deduplicate, upsert atomically
  const raw = await getSentLog();
  const deduped = [];
  const seen = new Set();
  for (const entry of raw) {
    const k = `${entry.bookingNumber}::${entry.tab}`;
    if (!seen.has(k)) { seen.add(k); deduped.push(entry); }
  }
  const existing = deduped.find(l => l.bookingNumber === bookingNumber && l.tab === tab);
  if (existing) {
    existing.sentAt = new Date().toISOString();
    if (fileId) existing.fileId = fileId;
    if (messages.length > 0) existing.messages = messages;
  } else {
    deduped.push({ bookingNumber, tab, sentAt: new Date().toISOString(), fileId, messages });
  }
  await prisma.systemSetting.upsert({
    where: { key: SENT_LOG_KEY },
    update: { value: JSON.stringify(deduped) },
    create: { key: SENT_LOG_KEY, value: JSON.stringify(deduped) }
  });
}

// ── Delete old Telegram messages for a log entry ──────────────────────────────
async function deleteOldMessages(logEntry) {
  if (!logEntry?.messages?.length) return;
  await Promise.all(logEntry.messages.map(async ({ chatId, messageId }) => {
    await axios.post(`${AUSGABEN_API()}/deleteMessage`, { chat_id: chatId, message_id: messageId })
      .catch(e => console.log('deleteMessage skip:', e.response?.data?.description || e.message));
  }));
}

// ── Get sent bookings for tab + tourType ──────────────────────────────────────
async function getSentBookings(tab, tourTypeCode) {
  const log = await getSentLog();
  const sentNumbers = [...new Set(
    log
      .filter(l => l.tab === tab && l.bookingNumber.startsWith(tourTypeCode + '-'))
      .map(l => l.bookingNumber)
  )];
  if (sentNumbers.length === 0) return [];
  // DB may have multiple rows with same bookingNumber (different years) — deduplicate
  const rows = await prisma.booking.findMany({
    where: { bookingNumber: { in: sentNumbers } },
    include: { tourType: true },
    orderBy: { bookingNumber: 'asc' }
  });
  const seen = new Set();
  return rows.filter(b => { if (seen.has(b.bookingNumber)) return false; seen.add(b.bookingNumber); return true; });
}

// ── Bookings inline keyboard (3 per row) ─────────────────────────────────────
function bookingsKeyboard(bookings, tab, tourTypeCode) {
  const buttons = bookings.map(b => ({
    text: b.bookingNumber,
    callback_data: `bk:${tab}:${b.bookingNumber}`
  }));
  // 3 per row
  const rows = [];
  for (let i = 0; i < buttons.length; i += 3) rows.push(buttons.slice(i, i + 3));
  // Back button
  rows.push([{ text: '⬅️ Orqaga', callback_data: `back:${tab}` }]);
  return { inline_keyboard: rows };
}

// ── POST /api/ausgaben/webhook ────────────────────────────────────────────────
router.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  try {
    const { message, callback_query } = req.body;

    // ── Callback query (inline button press) ──────────────────────────────────
    if (callback_query) {
      const chatId = callback_query.message.chat.id;
      const msgId  = callback_query.message.message_id;
      const data   = callback_query.data;
      await answerCallback(callback_query.id);

      // back:<tab> → show tour type selection again
      if (data.startsWith('back:')) {
        const tab = data.split(':')[1];
        await editMessage(chatId, msgId,
          `${TABS[tab]} — tur turini tanlang:`,
          tourTypeKeyboard(tab).inline_keyboard
        );
        return;
      }

      // type:<tab>:<tourType> → show sent bookings list
      if (data.startsWith('type:')) {
        const [, tab, tourTypeCode] = data.split(':');
        const bookings = await getSentBookings(tab, tourTypeCode);
        if (bookings.length === 0) {
          await editMessage(chatId, msgId,
            `${TABS[tab]} — *${tourTypeCode}*\n\nHali hech qanday PDF yuborilmagan.`,
            [[{ text: '⬅️ Orqaga', callback_data: `back:${tab}` }]]
          );
          return;
        }
        await editMessage(chatId, msgId,
          `${TABS[tab]} — *${tourTypeCode}* yuborilgan gruppalar:`,
          bookingsKeyboard(bookings, tab, tourTypeCode).inline_keyboard
        );
        return;
      }

      // bk:<tab>:<bookingNumber> → resend PDF if file_id available, else show info
      if (data.startsWith('bk:')) {
        const [, tab, bookingNumber] = data.split(':');

        // Check log for stored file_id
        const log = await getSentLog();
        const logEntry = log.find(l => l.bookingNumber === bookingNumber && l.tab === tab);

        if (logEntry?.fileId) {
          // Resend the stored PDF document
          const sentDate = logEntry.sentAt
            ? new Date(logEntry.sentAt).toLocaleString('de-DE')
            : '';
          await axios.post(`${AUSGABEN_API()}/sendDocument`, {
            chat_id: chatId,
            document: logEntry.fileId,
            caption: `${TABS[tab]} — *${bookingNumber}*\n📤 Yuborilgan: ${sentDate}`,
            parse_mode: 'Markdown'
          }).catch(e => console.error('Resend error:', e.response?.data || e.message));
          return;
        }

        // Fallback: show info without file_id
        const booking = await prisma.booking.findFirst({
          where: { bookingNumber },
          include: { tourType: true }
        });
        const tourCode = booking?.tourType?.code || '';
        const sentDate = logEntry?.sentAt
          ? new Date(logEntry.sentAt).toLocaleString('de-DE')
          : '—';
        const text = [
          `${TABS[tab]} — *${bookingNumber}*`,
          `📅 Yuborilgan: ${sentDate}`
        ].join('\n');
        await editMessage(chatId, msgId, text, [
          [{ text: '⬅️ Orqaga', callback_data: `type:${tab}:${tourCode || bookingNumber.split('-')[0]}` }]
        ]);
        return;
      }
    }

    // ── Text message (Reply keyboard buttons) ────────────────────────────────
    if (message) {
      const chatId = message.chat.id;
      const text   = message.text || '';

      let tab = null;
      if (text.includes('Ausgaben'))    tab = 'ausgaben';
      else if (text.includes('Reiseleiter')) tab = 'rl';
      else if (text.includes('Bank'))   tab = 'bank';
      else if (text.includes('Später')) tab = 'spater';
      else if (text.includes('Karta'))  tab = 'karta';

      if (tab) {
        await sendMessage(chatId, `${TABS[tab]} — tur turini tanlang:`, {
          reply_markup: tourTypeKeyboard(tab)
        });
        return;
      }

      if (text === '/start' || text === '/menu') {
        await sendMessage(chatId, '📊 *Ausgaben Bot*\nQuyidagi bo\'limlarni tanlang:', {
          reply_markup: MAIN_KEYBOARD
        });
      }
    }
  } catch (e) {
    console.error('Ausgaben webhook error:', e.message);
  }
});

// ── POST /api/ausgaben/set-webhook ────────────────────────────────────────────
router.post('/set-webhook', async (req, res) => {
  try {
    const token = process.env.TELEGRAM_AUSGABEN_TOKEN;
    if (!token) return res.status(500).json({ error: 'Token sozlanmagan' });
    const webhookUrl = `${req.body.baseUrl || 'https://booking-calendar.uz'}/api/ausgaben/webhook`;
    const result = await axios.post(`https://api.telegram.org/bot${token}/setWebhook`, { url: webhookUrl });
    res.json({ success: true, result: result.data });
  } catch (e) {
    res.status(500).json({ error: e.response?.data || e.message });
  }
});

// ── GET /api/ausgaben/settings ────────────────────────────────────────────────
router.get('/settings', async (req, res) => {
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key: 'AUSGABEN_CHAT_IDS' } });
    res.json({ chatIds: setting?.value || '' });
  } catch (error) {
    res.status(500).json({ error: 'Sozlamalarni yuklashda xatolik' });
  }
});

// ── POST /api/ausgaben/settings ───────────────────────────────────────────────
router.post('/settings', async (req, res) => {
  try {
    const { chatIds } = req.body;
    await prisma.systemSetting.upsert({
      where: { key: 'AUSGABEN_CHAT_IDS' },
      update: { value: chatIds },
      create: { key: 'AUSGABEN_CHAT_IDS', value: chatIds }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Sozlamalarni saqlashda xatolik' });
  }
});

// ── POST /api/ausgaben/send-telegram ─────────────────────────────────────────
router.post('/send-telegram', upload.single('pdf'), async (req, res) => {
  try {
    const token = process.env.TELEGRAM_AUSGABEN_TOKEN;
    if (!token) return res.status(500).json({ error: 'TELEGRAM_AUSGABEN_TOKEN sozlanmagan' });

    const setting = await prisma.systemSetting.findUnique({ where: { key: 'AUSGABEN_CHAT_IDS' } });
    if (!setting?.value) return res.status(400).json({ error: 'AUSGABEN_CHAT_IDS sozlanmagan.' });

    const chatIds = setting.value.split(',').map(id => id.trim()).filter(Boolean);
    if (chatIds.length === 0) return res.status(400).json({ error: 'Hech qanday chat ID topilmadi' });

    const { filename, caption, bookingNumber, tab } = req.body;

    // Delete old messages for this booking+tab if they exist
    if (bookingNumber && tab) {
      const log = await getSentLog();
      const oldEntry = log.find(l => l.bookingNumber === bookingNumber && l.tab === tab);
      if (oldEntry) await deleteOldMessages(oldEntry);
    }

    let successCount = 0;
    let savedFileId = null;
    const sentMessages = [];
    await Promise.all(chatIds.map(async (chatId) => {
      try {
        const form = new FormData();
        form.append('chat_id', chatId);
        form.append('document', req.file.buffer, {
          filename: filename || 'ausgaben.pdf',
          contentType: 'application/pdf'
        });
        if (caption) form.append('caption', caption);
        const tgRes = await axios.post(`${AUSGABEN_API()}/sendDocument`, form, { headers: form.getHeaders() });
        const result = tgRes.data?.result;
        if (result?.document?.file_id && !savedFileId) savedFileId = result.document.file_id;
        if (result?.message_id) sentMessages.push({ chatId, messageId: result.message_id });
        successCount++;
      } catch (e) {
        console.error('Ausgaben send failed for chatId', chatId, e.response?.data || e.message);
      }
    }));

    // Save to sent log if at least one succeeded
    if (successCount > 0 && bookingNumber && tab) {
      await addToSentLog(bookingNumber, tab, savedFileId, sentMessages);
    }

    res.json({ success: true, sent: successCount });
  } catch (error) {
    console.error('Ausgaben TG send error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Telegram ga yuborishda xatolik' });
  }
});

module.exports = router;
