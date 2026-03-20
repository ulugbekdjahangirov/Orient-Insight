const express = require('express');
const router = express.Router();
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const prisma = new PrismaClient();

// Shared webhook secret validator middleware (timing-safe)
const verifyWebhookSecret = (req, res, next) => {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    console.error('TELEGRAM_WEBHOOK_SECRET is not set — webhook rejected');
    return res.sendStatus(403);
  }
  const received = req.headers['x-telegram-bot-api-secret-token'] || '';
  try {
    const crypto = require('crypto');
    const a = Buffer.from(received);
    const b = Buffer.from(secret);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.sendStatus(401);
    }
  } catch {
    return res.sendStatus(401);
  }
  next();
};

const BOT_API = () => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const TRANSPORT_API = () => `https://api.telegram.org/bot${process.env.TELEGRAM_TRANSPORT_TOKEN}`;
const RESTAURANT_API = () => `https://api.telegram.org/bot${process.env.TELEGRAM_RESTAURANT_TOKEN}`;
const GUIDE_API = () => `https://api.telegram.org/bot${process.env.TELEGRAM_GUIDE_TOKEN}`;
const CHATS_SETTING_KEY = 'TELEGRAM_KNOWN_CHATS';

// In-memory state: admin Telegram dan javob berish uchun (adminChatId → { targetChatId, targetName })
const adminPendingReply = {};

// multer: accept PDF blob in memory
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// Helper: get/set provider chat ID from SystemSetting
async function getProviderChatId(provider) {
  const key = `TRANSPORT_${provider.toUpperCase()}_CHAT_ID`;
  const s = await prisma.systemSetting.findUnique({ where: { key } });
  return s?.value || null;
}
async function setProviderChatId(provider, chatId) {
  const key = `TRANSPORT_${provider.toUpperCase()}_CHAT_ID`;
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value: chatId },
    create: { key, value: chatId }
  });
}

// Helper: get/set provider phone from SystemSetting
async function getProviderPhone(provider) {
  const key = `TRANSPORT_${provider.toUpperCase()}_PHONE`;
  const s = await prisma.systemSetting.findUnique({ where: { key } });
  return s?.value || null;
}
async function setProviderPhone(provider, phone) {
  const key = `TRANSPORT_${provider.toUpperCase()}_PHONE`;
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value: phone },
    create: { key, value: phone }
  });
}

const PROVIDER_LABELS = { sevil: 'Sevil aka', xayrulla: 'Xayrulla', nosir: 'Nosir aka', hammasi: 'Siroj' };
// Escape Markdown v1 special chars in user-provided strings (prevents caption edit failures)
const mdSafe = s => (s || '').replace(/[_*[\]`]/g, '\\$&');

// ── Per-bot admin chat ID helpers ─────────────────────────────────────────────
// Returns array of admin chat IDs for a bot type
async function getBotAdminIds(botType) {
  const keyMap = { hotel: 'HOTEL_ADMIN_CHAT_IDS', transport: 'TRANSPORT_ADMIN_CHAT_IDS', restaurant: 'RESTAURANT_ADMIN_CHAT_IDS', guide: 'GUIDE_ADMIN_CHAT_IDS' };
  const key = keyMap[botType];
  if (!key) return [process.env.TELEGRAM_ADMIN_CHAT_ID].filter(Boolean);
  const s = await prisma.systemSetting.findUnique({ where: { key } });
  try {
    const arr = s?.value ? JSON.parse(s.value) : [];
    return arr.length ? arr : [process.env.TELEGRAM_ADMIN_CHAT_ID].filter(Boolean);
  } catch { return [process.env.TELEGRAM_ADMIN_CHAT_ID].filter(Boolean); }
}
// Toggle a chatId in the admin list for a bot type
async function toggleBotAdmin(botType, chatId) {
  const keyMap = { hotel: 'HOTEL_ADMIN_CHAT_IDS', transport: 'TRANSPORT_ADMIN_CHAT_IDS', restaurant: 'RESTAURANT_ADMIN_CHAT_IDS', guide: 'GUIDE_ADMIN_CHAT_IDS' };
  const key = keyMap[botType];
  if (!key) return;
  const s = await prisma.systemSetting.findUnique({ where: { key } });
  let arr = [];
  try { arr = s?.value ? JSON.parse(s.value) : []; } catch {}
  const idx = arr.indexOf(String(chatId));
  if (idx >= 0) arr.splice(idx, 1); else arr.push(String(chatId));
  await prisma.systemSetting.upsert({ where: { key }, update: { value: JSON.stringify(arr) }, create: { key, value: JSON.stringify(arr) } });
  return arr;
}
// Helper: notify all bot admins via a given bot API
async function notifyBotAdmins(botType, apiUrl, text) {
  const ids = await getBotAdminIds(botType);
  for (const id of ids) {
    await axios.post(`${apiUrl}/sendMessage`, { chat_id: id, text, parse_mode: 'Markdown' }).catch(() => {});
  }
}
// Aliases for backward compat (returns first admin or null)
const getTransportAdminChatId  = async () => { const ids = await getBotAdminIds('transport');  return ids[0] || null; };
const getRestaurantAdminChatId = async () => { const ids = await getBotAdminIds('restaurant'); return ids[0] || null; };
const getGuideAdminChatId      = async () => { const ids = await getBotAdminIds('guide');      return ids[0] || null; };

// ── Meal chat ID helpers ─────────────────────────────────────────────────────
const MEAL_CHAT_IDS_KEY = 'MEAL_RESTAURANT_CHAT_IDS';
async function getMealChatIds() {
  try {
    const s = await prisma.systemSetting.findUnique({ where: { key: MEAL_CHAT_IDS_KEY } });
    return s ? JSON.parse(s.value) : {};
  } catch { return {}; }
}
async function getRestaurantByChatId(chatId) {
  const map = await getMealChatIds();
  const entry = Object.entries(map).find(([, v]) => String(v) === String(chatId));
  return entry ? entry[0] : null;
}
async function saveMealChatIds(map) {
  await prisma.systemSetting.upsert({
    where: { key: MEAL_CHAT_IDS_KEY },
    update: { value: JSON.stringify(map) },
    create: { key: MEAL_CHAT_IDS_KEY, value: JSON.stringify(map) }
  });
}

function fmtDateUtil(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.${dt.getFullYear()}`;
}

// Translations
const T = {
  langKeyboard: {
    uz: "Iltimos, tilni tanlang:",
    ru: "Пожалуйста, выберите язык:"
  },
  langSelected: {
    uz: "🇺🇿 *O'zbek tili* tanlandi! Keyingi xabarlar o'zbek tilida yuboriladi.",
    ru: "🇷🇺 *Русский язык* выбран! Следующие сообщения будут на русском."
  },
  phoneButton: {
    uz: "📱 Telefon raqamni ulashish",
    ru: "📱 Поделиться номером телефона"
  },
  phoneSaved: {
    uz: "✅ Telefon raqamingiz saqlandi! Rahmat.",
    ru: "✅ Номер телефона сохранён! Спасибо."
  },
  roleAssigned: {
    hotel: {
      uz: "🏨 Sizga *Hotel* roli tayinlandi.\n\nEndi bu bot orqali mehmonxona zayavkalarini qabul qilasiz. ✅",
      ru: "🏨 Вам назначена роль *Hotel*.\n\nТеперь через этот бот вы будете получать заявки на гостиницу. ✅"
    },
    transport: {
      uz: "🚌 Sizga *Transport* roli tayinlandi.\n\nEndi bu bot orqali marshrut varaqalarini qabul qilasiz. ✅",
      ru: "🚌 Вам назначена роль *Transport*.\n\nТеперь через этот бот вы будете получать маршрутные листы. ✅"
    },
    restaurant: {
      uz: "🍽 Sizga *Restaurant* roli tayinlandi.\n\nEndi bu bot orqali ovqat buyurtmalarini qabul qilasiz. ✅",
      ru: "🍽 Вам назначена роль *Restaurant*.\n\nТеперь через этот бот вы будете получать заказы питания. ✅"
    },
    guide: {
      uz: "👤 Sizga *Gid* roli tayinlandi.\n\nEndi bu bot orqali tur yo'riqnomalarini qabul qilasiz. ✅",
      ru: "👤 Вам назначена роль *Гид*.\n\nТеперь через этот бот вы будете получать туристические маршруты. ✅"
    },
    admin: {
      uz: "🤖 Sizga *Admin* roli tayinlandi.\n\nEndi Orient Insight admin panelidan foydalanishingiz mumkin. ✅",
      ru: "🤖 Вам назначена роль *Admin*.\n\nТеперь вы можете использовать панель администратора. ✅"
    }
  }
};

// Helper: get saved language for a chat (default: uz)
async function getChatLang(chatId) {
  try {
    const chats = await loadKnownChats();
    return chats[String(chatId)]?.lang || 'uz';
  } catch { return 'uz'; }
}

// Helper: send persistent admin menu keyboard
async function sendAdminMenu(chatId) {
  const year = new Date().getFullYear();
  await axios.post(`${BOT_API()}/sendMessage`, {
    chat_id: chatId,
    text: '🤖 *Orient Insight — Admin Panel*\n\nPastdagi menyudan bo\'lim tanlang:',
    parse_mode: 'Markdown',
    reply_markup: JSON.stringify({
      keyboard: [
        [{ text: `📋 Заявка ${year}` }, { text: "📝 Изменения к Заявке" }],
        [{ text: '⏳ Waiting List' }, { text: '🚫 Rad etilgan' }],
        [{ text: '❌ Ануляция' }]
      ],
      resize_keyboard: true,
      is_persistent: true
    })
  }).catch(() => {});
}

// Helper: find provider name by chatId (reverse lookup from SystemSetting)
async function getProviderByChatId(chatId) {
  for (const p of ['sevil', 'xayrulla', 'nosir', 'hammasi']) {
    const id = await getProviderChatId(p);
    if (id && String(id) === String(chatId)) return p;
  }
  return null;
}

// Helper: send transport provider menu (dynamic year buttons)
async function sendTransportMenu(chatId) {
  const curYear = new Date().getFullYear();
  const provider = await getProviderByChatId(chatId);
  let availYears = [curYear];
  if (provider && provider !== 'hammasi') {
    const keys = await prisma.systemSetting.findMany({ where: { key: { startsWith: 'JP_TRANSPORT_CONFIRM_' } } });
    const years = [...new Set(
      keys
        .filter(s => { try { const d = JSON.parse(s.value); return d.provider === provider && !d.cleared; } catch { return false; } })
        .map(s => parseInt(s.key.split('_')[3]))
        .filter(y => y && y >= curYear)
    )].sort();
    if (years.length) availYears = years;
  }
  const zpBtnText = availYears.length > 1 ? '📄 Заявка' : `📄 Заявка ${availYears[0]}`;
  const keyboard = [
    [{ text: zpBtnText }, { text: '❌ Ануляция' }],
    [{ text: '📋 Marshrut List' }, { text: '✅ Tasdiqlangan' }]
  ];
  await axios.post(`${TRANSPORT_API()}/sendMessage`, {
    chat_id: chatId,
    text: '🚌 *Transport menyu:*',
    parse_mode: 'Markdown',
    reply_markup: JSON.stringify({ keyboard, resize_keyboard: true, is_persistent: true })
  }).catch(() => {});
}

// Helper: send transport admin menu (dynamic year buttons)
async function sendTransportAdminMenu(chatId) {
  const curYear = new Date().getFullYear();
  const keys = await prisma.systemSetting.findMany({ where: { key: { startsWith: 'JP_TRANSPORT_CONFIRM_' } } });
  const years = [...new Set(
    keys
      .filter(s => { try { return !JSON.parse(s.value).cleared; } catch { return false; } })
      .map(s => parseInt(s.key.split('_')[3]))
      .filter(y => y && y >= curYear)
  )].sort();
  const availYears = years.length ? years : [curYear];
  // Single year: show "📄 Заявка 2026" | multiple years: show "📄 Заявка" (year picker on press)
  const zpBtnText = availYears.length > 1 ? '📄 Заявка' : `📄 Заявка ${availYears[0]}`;
  const keyboard = [
    [{ text: zpBtnText }, { text: '🚫 Rad etilgan' }],
    [{ text: '📋 Marshrut List' }, { text: '✅ Tasdiqlangan' }],
    [{ text: '❌ Ануляция' }]
  ];
  await axios.post(`${TRANSPORT_API()}/sendMessage`, {
    chat_id: chatId,
    text: '🤖 *Transport Admin Panel*',
    parse_mode: 'Markdown',
    reply_markup: JSON.stringify({ keyboard, resize_keyboard: true, is_persistent: true })
  }).catch(() => {});
}

// Helper: send guide menu keyboard (dynamic year buttons)
async function sendGuideMenu(chatId, isAdmin = false) {
  const curYear = new Date().getFullYear();
  let availYears = [curYear];
  // Check if this chatId is also a guide (even if admin)
  const guideRecord = await prisma.guide.findFirst({ where: { telegramChatId: String(chatId) } });
  const isAdminOnly = isAdmin && !guideRecord;
  if (isAdminOnly) {
    // Pure admin (no guide record): collect years from all JP_GUIDE_YEARS_ keys
    const allGuideYearKeys = await prisma.systemSetting.findMany({
      where: { key: { startsWith: 'JP_GUIDE_YEARS_' } }, select: { value: true }
    });
    const adminYears = [...new Set(
      allGuideYearKeys.flatMap(s => { try { return JSON.parse(s.value); } catch { return []; } })
        .filter(y => y >= curYear)
    )].sort();
    if (adminYears.length) availYears = adminYears;
  } else if (guideRecord) {
    const s = await prisma.systemSetting.findUnique({ where: { key: `JP_GUIDE_YEARS_${guideRecord.id}` } });
    if (s) {
      const years = JSON.parse(s.value).filter(y => y >= curYear).sort();
      if (years.length) availYears = years;
    }
  }
  // If multiple years: single "📋 Gruppalar" button (year picker shown on press)
  // If single year: "📋 Gruppalar {year}" button (direct)
  const grpBtnText = availYears.length > 1 ? '📋 Gruppalar' : `📋 Gruppalar ${availYears[0]}`;
  const keyboard = isAdmin
    ? [[{ text: grpBtnText }], [{ text: '✅ Tasdiqlangan' }, { text: '❌ Anulyatsiya' }], [{ text: '👤 Gidlar' }]]
    : [[{ text: grpBtnText }, { text: '✅ Tasdiqlangan' }], [{ text: '❌ Anulyatsiya' }]];
  await axios.post(`${GUIDE_API()}/sendMessage`, {
    chat_id: chatId,
    text: '🧭 *Gid menyu:*',
    parse_mode: 'Markdown',
    reply_markup: JSON.stringify({ keyboard, resize_keyboard: true, is_persistent: true })
  }).catch(() => {});
}

// Helper: send restaurant menu keyboard (dynamic year buttons)
async function sendRestaurantMenu(chatId, isAdmin = false) {
  const curYear = new Date().getFullYear();
  let availYears = [curYear];
  if (isAdmin) {
    // Admin: collect years from all JP_MEAL_YEARS_ keys
    const allMealYearKeys = await prisma.systemSetting.findMany({
      where: { key: { startsWith: 'JP_MEAL_YEARS_' } }, select: { value: true }
    });
    const adminYears = [...new Set(
      allMealYearKeys.flatMap(s => { try { return JSON.parse(s.value); } catch { return []; } })
        .filter(y => y >= curYear)
    )].sort();
    if (adminYears.length) availYears = adminYears;
  } else {
    const restaurantName = await getRestaurantByChatId(chatId);
    if (restaurantName) {
      const s = await prisma.systemSetting.findUnique({ where: { key: `JP_MEAL_YEARS_${restaurantName}` } });
      if (s) {
        const years = JSON.parse(s.value).filter(y => y >= curYear).sort();
        if (years.length) availYears = years;
      }
    }
  }
  const zpRows = availYears.length > 1
    ? [availYears.map(y => ({ text: `📄 Заявка ${y}` }))]
    : [[{ text: `📄 Заявка ${availYears[0]}` }, { text: '✅ Tasdiqlangan' }]];
  const keyboard = isAdmin
    ? availYears.length > 1
      ? [...zpRows, [{ text: '✅ Tasdiqlangan' }, { text: '🚫 Rad etilgan' }], [{ text: '❌ Anulyatsiya' }]]
      : [...zpRows, [{ text: '🚫 Rad etilgan' }, { text: '❌ Anulyatsiya' }]]
    : availYears.length > 1
      ? [...zpRows, [{ text: '✅ Tasdiqlangan' }, { text: '❌ Anulyatsiya' }]]
      : [...zpRows, [{ text: '❌ Anulyatsiya' }]];
  await axios.post(`${RESTAURANT_API()}/sendMessage`, {
    chat_id: chatId,
    text: '🍽 *Restoran menyu:*',
    parse_mode: 'Markdown',
    reply_markup: JSON.stringify({ keyboard, resize_keyboard: true, is_persistent: true })
  }).catch(() => {});
}

// Helper: send persistent hotel menu keyboard (dynamic year buttons from JP_SECTIONS)
async function sendHotelMenu(chatId) {
  const curYear = new Date().getFullYear();
  // Find available JP years for this hotel (year >= curYear)
  const hotel = await prisma.hotel.findFirst({ where: { telegramChatId: String(chatId) } });
  let availYears = [curYear];
  if (hotel) {
    const jpSettings = await prisma.systemSetting.findMany({ where: { key: { startsWith: `JP_SECTIONS_${hotel.id}_` } } });
    const years = [...new Set(
      jpSettings
        .filter(s => {
          try {
            const d = JSON.parse(s.value);
            // Only show if TG was actually sent (has bulkMsgId or any visit msgId)
            return d.bulkMsgId != null || (d.groups || []).some(g => (g.visits || []).some(v => v.msgId != null));
          } catch { return false; }
        })
        .map(s => { try { return parseInt(JSON.parse(s.value).year); } catch { return null; } })
        .filter(y => y && y >= curYear)
    )].sort();
    if (years.length) availYears = years;
  }
  // One row per year if multiple, else single row
  const jpRows = availYears.length > 1
    ? [availYears.map(y => ({ text: `📋 Заявка ${y}` }))]
    : [[{ text: `📋 Заявка ${availYears[0]}` }, { text: '📝 Изменения к Заявке' }]];
  const keyboard = availYears.length > 1
    ? [...jpRows, [{ text: '📝 Изменения к Заявке' }, { text: '⏳ Waiting List' }], [{ text: '❌ Ануляция' }]]
    : [...jpRows, [{ text: '⏳ Waiting List' }, { text: '❌ Ануляция' }]];
  await axios.post(`${BOT_API()}/sendMessage`, {
    chat_id: chatId,
    text: '🏨 Asosiy menyu:',
    reply_markup: JSON.stringify({ keyboard, resize_keyboard: true, is_persistent: true })
  }).catch(() => {});
}

// Helper: find hotel by Telegram chatId
async function getHotelByChatId(chatId) {
  return await prisma.hotel.findFirst({ where: { telegramChatId: String(chatId) } });
}

// Helper: find all JP_SECTIONS for a chatId
// Primary: look up hotel by telegramChatId (hotel table) → use hotel.id
// Fallback: scan JP_SECTIONS JSON chatId field (if hotel not found in table)
async function findJpSectionsByChatId(chatId) {
  const hotel = await prisma.hotel.findFirst({ where: { telegramChatId: String(chatId) } });
  if (hotel) {
    return await prisma.systemSetting.findMany({ where: { key: { startsWith: `JP_SECTIONS_${hotel.id}_` } } });
  }
  // Fallback: scan by chatId stored in JSON value
  const all = await prisma.systemSetting.findMany({ where: { key: { startsWith: 'JP_SECTIONS_' } } });
  return all.filter(s => {
    try { return String(JSON.parse(s.value).chatId) === String(chatId); } catch { return false; }
  });
}

// Helper: Rad etilgan — show hotel buttons for CHG (TelegramConfirmation) rejected
async function sendAdminRejChgHotels(chatId, tourType) {
  const year = new Date().getFullYear();
  const confs = await prisma.telegramConfirmation.findMany({
    where: { status: 'REJECTED', type: 'CHANGE' },
    include: {
      hotel: { select: { id: true, name: true } },
      booking: { select: { tourType: { select: { code: true } } } }
    }
  });
  const hotels = {};
  for (const c of confs) {
    if (c.booking?.tourType?.code !== tourType) continue;
    if (!hotels[c.hotelId]) hotels[c.hotelId] = c.hotel?.name || `Hotel #${c.hotelId}`;
  }
  const entries = Object.entries(hotels);
  if (!entries.length) {
    await axios.post(`${BOT_API()}/sendMessage`, {
      chat_id: chatId,
      text: `🚫 *Rad etilgan — Изменения (${tourType} ${year})*\n\n✅ Rad etilgan zaявka yo'q.`,
      parse_mode: 'Markdown'
    }).catch(() => {});
    return;
  }
  const rows = [];
  for (let i = 0; i < entries.length; i += 2) {
    const row = [{ text: `🏨 ${entries[i][1]}`, callback_data: `admin:rej_chg_h:${tourType}:${entries[i][0]}` }];
    if (entries[i + 1]) row.push({ text: `🏨 ${entries[i + 1][1]}`, callback_data: `admin:rej_chg_h:${tourType}:${entries[i + 1][0]}` });
    rows.push(row);
  }
  await axios.post(`${BOT_API()}/sendMessage`, {
    chat_id: chatId,
    text: `🚫 *Rad etilgan — Изменения (${tourType} ${year})*\nHotelni tanlang:`,
    parse_mode: 'Markdown',
    reply_markup: JSON.stringify({ inline_keyboard: rows })
  }).catch(() => {});
}

// Helper: Rad etilgan — show hotel buttons for JP (JP_SECTIONS) rejected
async function sendAdminRejJpHotels(chatId, tourType) {
  const year = new Date().getFullYear();
  const allJp = await prisma.systemSetting.findMany({ where: { key: { startsWith: 'JP_SECTIONS_' } } });
  const hotels = {};
  for (const s of allJp) {
    try {
      const d = JSON.parse(s.value);
      if (d.tourType !== tourType) continue;
      const hasRejected = (d.groups || []).some(grp => (grp.visits || []).some(v => v.status === 'REJECTED'));
      if (!hasRejected) continue;
      // Extract hotelId from key: JP_SECTIONS_16_KAS → 16
      const hotelId = parseInt(s.key.replace('JP_SECTIONS_', '').split('_')[0]);
      if (!hotels[hotelId]) hotels[hotelId] = d.hotelName || `Hotel #${hotelId}`;
    } catch {}
  }
  const entries = Object.entries(hotels);
  if (!entries.length) {
    await axios.post(`${BOT_API()}/sendMessage`, {
      chat_id: chatId,
      text: `🚫 *Rad etilgan — Заявка ${year} (${tourType})*\n\n✅ Rad etilgan zaявka yo'q.`,
      parse_mode: 'Markdown'
    }).catch(() => {});
    return;
  }
  const rows = [];
  for (let i = 0; i < entries.length; i += 2) {
    const row = [{ text: `🏨 ${entries[i][1]}`, callback_data: `admin:rej_jp_h:${tourType}:${entries[i][0]}` }];
    if (entries[i + 1]) row.push({ text: `🏨 ${entries[i + 1][1]}`, callback_data: `admin:rej_jp_h:${tourType}:${entries[i + 1][0]}` });
    rows.push(row);
  }
  await axios.post(`${BOT_API()}/sendMessage`, {
    chat_id: chatId,
    text: `🚫 *Rad etilgan — Заявка ${year} (${tourType})*\nHotelni tanlang:`,
    parse_mode: 'Markdown',
    reply_markup: JSON.stringify({ inline_keyboard: rows })
  }).catch(() => {});
}

// Helper: Rad etilgan — show CHG rejected confirmations for a specific hotel+tourType
async function sendAdminRejChgForHotel(chatId, tourType, hotelId) {
  const year = new Date().getFullYear();
  const fmt = d => { if (!d) return '—'; const dt = new Date(d); return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.${dt.getFullYear()}`; };
  const hotel = await prisma.hotel.findUnique({ where: { id: hotelId }, include: { city: { select: { name: true } } } });
  const confs = await prisma.telegramConfirmation.findMany({
    where: { status: 'REJECTED', type: 'CHANGE', hotelId },
    include: { booking: { select: { id: true, bookingNumber: true, pax: true, tourType: { select: { code: true } } } } },
    orderBy: { sentAt: 'asc' }
  });
  const seen = new Set();
  const filtered = confs.filter(c => {
    if (c.booking?.tourType?.code !== tourType) return false;
    const key = `${c.bookingId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const cityName = hotel?.city?.name ? ` (${hotel.city.name})` : '';
  const lines = [`🚫 *Rad etilgan — Изменения (${tourType} ${year})*`, `🏨 *${hotel?.name || '?'}*${cityName}`, ''];
  if (!filtered.length) {
    lines.push('✅ Rad etilgan zaявka yo\'q.');
  } else {
    for (const c of filtered) {
      const accs = await prisma.accommodation.findMany({ where: { bookingId: c.bookingId, hotelId }, orderBy: { checkInDate: 'asc' } });
      const block = [`❌ *ЗАЯВКА ${c.booking?.bookingNumber || '—'}*`];
      accs.forEach((acc, i) => {
        if (accs.length > 1) block.push(`  *${i + 1}-заезд:*`);
        block.push(`  📅 Заезд: ${fmt(acc.checkInDate)}`);
        block.push(`  📅 Выезд: ${fmt(acc.checkOutDate)}`);
        block.push(`  👥 PAX: ${c.booking?.pax || 0}`);
      });
      lines.push(block.join('\n'));
      lines.push('');
    }
  }
  await axios.post(`${BOT_API()}/sendMessage`, {
    chat_id: chatId, text: lines.join('\n'), parse_mode: 'Markdown'
  }).catch(() => {});
}

// Helper: Rad etilgan — show JP_SECTIONS rejected visits for a specific hotel+tourType
async function sendAdminRejJpForHotel(chatId, tourType, hotelId) {
  const year = new Date().getFullYear();
  // Find all year variants (JP_SECTIONS_{hotelId}_{tourType}_{year}) and merge groups
  const allS = await prisma.systemSetting.findMany({ where: { key: { startsWith: `JP_SECTIONS_${hotelId}_${tourType}` } } });
  const s = allS[0] || null; // take first for header info; iterate all for visits
  const hotel = await prisma.hotel.findUnique({ where: { id: hotelId }, include: { city: { select: { name: true } } } });
  const cityName = hotel?.city?.name ? ` (${hotel.city.name})` : '';
  const hotelName = hotel?.name || `Hotel #${hotelId}`;
  const lines = [`🚫 *Rad etilgan — ${tourType}*`, `🏨 *${hotelName}*${cityName}`, ''];
  if (!allS.length) {
    lines.push('✅ Rad etilgan zaявka yo\'q.');
  } else {
    let found = false;
    for (const entry of allS) {
      try {
        const d = JSON.parse(entry.value);
        const entryYear = d.year || year;
        for (const grp of (d.groups || [])) {
          for (const v of (grp.visits || [])) {
            if (v.status !== 'REJECTED') continue;
            found = true;
            const label = v.sectionLabel ? `❌ *${entryYear} — ЗАЯВКА ${grp.group} — ${v.sectionLabel}*` : `❌ *${entryYear} — ЗАЯВКА ${grp.group}*`;
            lines.push([label, `  📅 Заезд: ${v.checkIn}`, `  📅 Выезд: ${v.checkOut}`, `  👥 PAX: ${v.pax}`, `  🛏 DBL:${v.dbl||0}  |  TWN:${v.twn||0}  |  SNGL:${v.sngl||0}`].join('\n'));
            lines.push('');
          }
        }
      } catch {}
    }
    if (!found) lines.push('✅ Rad etilgan zaявka yo\'q.');
  }
  await axios.post(`${BOT_API()}/sendMessage`, {
    chat_id: chatId, text: lines.join('\n'), parse_mode: 'Markdown'
  }).catch(() => {});
}

// Helper: show Izmeneniye for admin — all hotels, filtered by tourType (CONFIRMED, non-cancelled)
async function sendAdminChangesForTourType(chatId, tourType, replyMarkup) {
  const year = new Date().getFullYear();
  const fmt = d => { if (!d) return '—'; const dt = new Date(d); return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.${dt.getFullYear()}`; };
  const confs = await prisma.telegramConfirmation.findMany({
    where: { status: { in: ['CONFIRMED', 'REJECTED'] } },
    include: {
      hotel: { select: { id: true, name: true } },
      booking: { select: { bookingNumber: true, status: true, pax: true, tourType: { select: { code: true } } } }
    },
    orderBy: { sentAt: 'asc' }
  });
  // For each booking+hotel, find the latest sent record type.
  // If latest type = ANNULMENT → belongs to Anulyatsiya, exclude from Izmeneniya.
  // If latest type = CHANGE → belongs to Izmeneniya (even if annulment existed before).
  const allConfsForType = await prisma.telegramConfirmation.findMany({
    where: { booking: { tourType: { code: tourType } } },
    select: { bookingId: true, hotelId: true, type: true, sentAt: true }
  });
  // Find latest type per booking+hotel
  const latestTypeMap = {};
  for (const c of allConfsForType) {
    const key = `${c.bookingId}_${c.hotelId}`;
    if (!latestTypeMap[key] || c.sentAt > latestTypeMap[key].sentAt) {
      latestTypeMap[key] = { type: c.type, sentAt: c.sentAt };
    }
  }

  const seen = new Set();
  const filtered = confs.filter(c => {
    if (c.type === 'ANNULMENT') return false;
    const key = `${c.bookingId}_${c.hotelId}`;
    if (latestTypeMap[key]?.type === 'ANNULMENT') return false; // latest was annulment → skip
    if (c.booking?.tourType?.code !== tourType) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!filtered.length) {
    await axios.post(`${BOT_API()}/sendMessage`, {
      chat_id: chatId,
      text: `📝 ${tourType} ${year} uchun tasdiqlangan o'zgarish yo'q.`,
      reply_markup: replyMarkup
    }).catch(() => {});
    return;
  }
  // Group by hotel
  const byHotel = {};
  for (const c of filtered) {
    const key = c.hotelId;
    if (!byHotel[key]) byHotel[key] = { hotelName: c.hotel?.name || '?', items: [] };
    const accs = await prisma.accommodation.findMany({
      where: { bookingId: c.bookingId, hotelId: c.hotelId },
      include: { rooms: true },
      orderBy: { checkInDate: 'asc' }
    });
    const si = c.status === 'REJECTED' ? '❌' : '✅';
    const block = [`${si} *ЗАЯВКА ${c.booking?.bookingNumber || '—'}*`];
    if (accs.length > 0) {
      accs.forEach((acc, i) => {
        if (accs.length > 1) block.push(`  *${i + 1}-заезд:*`);
        block.push(`  📅 Заезд: ${fmt(acc.checkInDate)}`);
        block.push(`  📅 Выезд: ${fmt(acc.checkOutDate)}`);
        block.push(`  👥 PAX: ${c.booking?.pax || 0}`);
      });
    }
    byHotel[key].items.push(block.join('\n'));
  }
  const lines = [`📝 *Изменения к Заявке — ${tourType} ${year}*`];
  for (const { hotelName, items } of Object.values(byHotel)) {
    lines.push('');
    lines.push(`🏨 *${hotelName}*`);
    items.forEach(item => { lines.push(''); lines.push(item); });
  }
  await axios.post(`${BOT_API()}/sendMessage`, {
    chat_id: chatId, text: lines.join('\n'), parse_mode: 'Markdown', reply_markup: replyMarkup
  }).catch(() => {});
}

// Helper: show Izmeneniye for admin — single booking (filtered by bookingNumber)
async function sendAdminChangesForBooking(chatId, tourType, bookingNumber, replyMarkup) {
  const year = new Date().getFullYear();
  const fmt = d => { if (!d) return '—'; const dt = new Date(d); return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.${dt.getFullYear()}`; };
  const confs = await prisma.telegramConfirmation.findMany({
    where: { status: { in: ['CONFIRMED', 'REJECTED'] } },
    include: {
      hotel: { select: { id: true, name: true } },
      booking: { select: { bookingNumber: true, bookingYear: true, status: true, pax: true, tourType: { select: { code: true } } } }
    },
    orderBy: { sentAt: 'asc' }
  });
  const allConfsForType = await prisma.telegramConfirmation.findMany({
    where: { booking: { tourType: { code: tourType } } },
    select: { bookingId: true, hotelId: true, type: true, sentAt: true }
  });
  const latestTypeMap = {};
  for (const c of allConfsForType) {
    const key = `${c.bookingId}_${c.hotelId}`;
    if (!latestTypeMap[key] || c.sentAt > latestTypeMap[key].sentAt) {
      latestTypeMap[key] = { type: c.type, sentAt: c.sentAt };
    }
  }
  const seen = new Set();
  const filtered = confs.filter(c => {
    if (c.type === 'ANNULMENT') return false;
    const key = `${c.bookingId}_${c.hotelId}`;
    if (latestTypeMap[key]?.type === 'ANNULMENT') return false;
    if (c.booking?.tourType?.code !== tourType) return false;
    if (c.booking?.bookingNumber !== bookingNumber) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!filtered.length) {
    await axios.post(`${BOT_API()}/sendMessage`, {
      chat_id: chatId,
      text: `📝 *${bookingNumber}* uchun tasdiqlangan o'zgarish yo'q.`,
      parse_mode: 'Markdown', reply_markup: replyMarkup
    }).catch(() => {});
    return;
  }
  const byHotel = {};
  for (const c of filtered) {
    const key = c.hotelId;
    if (!byHotel[key]) byHotel[key] = { hotelName: c.hotel?.name || '?', items: [] };
    const accs = await prisma.accommodation.findMany({
      where: { bookingId: c.bookingId, hotelId: c.hotelId },
      include: { rooms: true },
      orderBy: { checkInDate: 'asc' }
    });
    const si = c.status === 'REJECTED' ? '❌' : '✅';
    const block = [`${si} *ЗАЯВКА ${c.booking?.bookingNumber || '—'}*`];
    if (accs.length > 0) {
      accs.forEach((acc, i) => {
        if (accs.length > 1) block.push(`  *${i + 1}-заезд:*`);
        block.push(`  📅 Заезд: ${fmt(acc.checkInDate)}`);
        block.push(`  📅 Выезд: ${fmt(acc.checkOutDate)}`);
        block.push(`  👥 PAX: ${c.booking?.pax || 0}`);
      });
    }
    byHotel[key].items.push(block.join('\n'));
  }
  const lines = [`📝 *Изменения к Заявке — ${bookingNumber}*`];
  for (const { hotelName, items } of Object.values(byHotel)) {
    lines.push('');
    lines.push(`🏨 *${hotelName}*`);
    items.forEach(item => { lines.push(''); lines.push(item); });
  }
  await axios.post(`${BOT_API()}/sendMessage`, {
    chat_id: chatId, text: lines.join('\n'), parse_mode: 'Markdown', reply_markup: replyMarkup
  }).catch(() => {});
}

// Helper: admin WL — JP_SECTIONS WAITING for a specific tourType
async function sendAdminWlJp(chatId, tourType) {
  const year = new Date().getFullYear();
  const allJp = await prisma.systemSetting.findMany({ where: { key: { startsWith: 'JP_SECTIONS_' } } });
  const hotelBlocks = {};
  for (const s of allJp) {
    try {
      const d = JSON.parse(s.value);
      if (d.tourType !== tourType) continue;
      const hotelName = d.hotelName || '?';
      for (const grp of (d.groups || [])) {
        for (const v of grp.visits) {
          if (v.status !== 'WAITING') continue;
          if (!hotelBlocks[hotelName]) hotelBlocks[hotelName] = [];
          const title = v.sectionLabel ? `⏳ *ЗАЯВКА ${grp.group} — ${v.sectionLabel}*` : `⏳ *ЗАЯВКА ${grp.group}*`;
          hotelBlocks[hotelName].push([title, `📅 Заезд: ${v.checkIn}`, `📅 Выезд: ${v.checkOut}`, `👥 PAX: ${v.pax}`, `🛏 DBL:${v.dbl||0}  |  TWN:${v.twn||0}  |  SNGL:${v.sngl||0}`].join('\n'));
        }
      }
    } catch {}
  }
  if (Object.keys(hotelBlocks).length === 0) {
    await axios.post(`${BOT_API()}/sendMessage`, { chat_id: chatId, text: `⏳ *Waiting List — Заявка ${tourType} ${year}*\n\n✅ Hech narsa yo'q.`, parse_mode: 'Markdown' }).catch(() => {});
    return;
  }
  await axios.post(`${BOT_API()}/sendMessage`, { chat_id: chatId, text: `⏳ *Waiting List — Заявка ${tourType} ${year}*`, parse_mode: 'Markdown' }).catch(() => {});
  for (const [hotelName, items] of Object.entries(hotelBlocks)) {
    const text = [`🏨 *${hotelName}*`, '', ...items].join('\n\n');
    await axios.post(`${BOT_API()}/sendMessage`, { chat_id: chatId, text, parse_mode: 'Markdown' }).catch(() => {});
  }
}

// Helper: admin WL — TelegramConfirmation WAITING for a specific tourType
async function sendAdminWlChg(chatId, tourType) {
  const year = new Date().getFullYear();
  const confs = await prisma.telegramConfirmation.findMany({
    where: { status: 'WAITING' },
    include: {
      hotel: { select: { name: true } },
      booking: { select: { bookingNumber: true, pax: true, status: true, tourType: { select: { code: true } } } }
    },
    orderBy: { sentAt: 'asc' }
  });
  const seen = new Set();
  const hotelBlocks = {};
  for (const c of confs) {
    if (c.booking?.tourType?.code !== tourType) continue;
    if (c.booking?.status === 'CANCELLED') continue;
    const key = `${c.hotelId}_${c.bookingId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const hotelName = c.hotel?.name || `Hotel #${c.hotelId}`;
    if (!hotelBlocks[hotelName]) hotelBlocks[hotelName] = [];
    hotelBlocks[hotelName].push(`⏳ *${c.booking?.bookingNumber || `#${c.bookingId}`}* — ${c.booking?.pax || 0} PAX`);
  }
  if (Object.keys(hotelBlocks).length === 0) {
    await axios.post(`${BOT_API()}/sendMessage`, { chat_id: chatId, text: `⏳ *Waiting List — Изменения ${tourType}*\n\n✅ Hech narsa yo'q.`, parse_mode: 'Markdown' }).catch(() => {});
    return;
  }
  await axios.post(`${BOT_API()}/sendMessage`, { chat_id: chatId, text: `⏳ *Waiting List — Изменения к Заявке (${tourType})*`, parse_mode: 'Markdown' }).catch(() => {});
  for (const [hotelName, items] of Object.entries(hotelBlocks)) {
    const text = [`🏨 *${hotelName}*`, '', ...items].join('\n\n');
    await axios.post(`${BOT_API()}/sendMessage`, { chat_id: chatId, text, parse_mode: 'Markdown' }).catch(() => {});
  }
}

// Helper: admin Ануляция — show hotel buttons for a specific tourType
async function sendAdminAnnulmentForTourType(chatId, tourType, replyMarkup) {
  const year = new Date().getFullYear();
  const confs = await prisma.telegramConfirmation.findMany({
    include: {
      hotel: { select: { id: true, name: true, city: { select: { name: true } } } },
      booking: { select: { bookingNumber: true, status: true, tourType: { select: { code: true } } } }
    },
    orderBy: { sentAt: 'desc' }
  });
  // Find latest type per booking+hotel
  const latestTypeMap = {};
  for (const c of confs) {
    const key = `${c.bookingId}_${c.hotelId}`;
    if (!latestTypeMap[key] || c.sentAt > latestTypeMap[key].sentAt) {
      latestTypeMap[key] = { type: c.type, sentAt: c.sentAt };
    }
  }
  const seen = new Set();
  const byHotel = {};
  for (const c of confs) {
    if (c.type !== 'ANNULMENT') continue;
    if (c.booking?.tourType?.code !== tourType) continue;
    const key = `${c.bookingId}_${c.hotelId}`;
    if (latestTypeMap[key]?.type !== 'ANNULMENT') continue; // later CHANGE sent → skip
    if (seen.has(key)) continue;
    seen.add(key);
    if (!byHotel[c.hotelId]) byHotel[c.hotelId] = { hotel: c.hotel, count: 0 };
    byHotel[c.hotelId].count++;
  }
  if (Object.keys(byHotel).length === 0) {
    await axios.post(`${BOT_API()}/sendMessage`, {
      chat_id: chatId,
      text: `❌ *Ануляция — ${tourType} ${year}*\n\n📭 Bekor qilingan zaявkalar yo'q.`,
      parse_mode: 'Markdown',
      reply_markup: replyMarkup
    }).catch(() => {});
    return;
  }
  // Show hotel list as inline buttons
  const hotelList = Object.values(byHotel);
  const rows = [];
  for (let i = 0; i < hotelList.length; i += 2) {
    rows.push(hotelList.slice(i, i + 2).map(({ hotel, count }) => ({
      text: `🏨 ${hotel?.name || '?'} (${count})`,
      callback_data: `admin:ann_hotel:${tourType}:${hotel.id}`
    })));
  }
  await axios.post(`${BOT_API()}/sendMessage`, {
    chat_id: chatId,
    text: `❌ *Ануляция — ${tourType} ${year}*\nHotelni tanlang:`,
    parse_mode: 'Markdown',
    reply_markup: JSON.stringify({ inline_keyboard: rows })
  }).catch(() => {});
}

// Helper: admin Ануляция — show bookings for specific hotel+tourType
async function sendAdminAnnulmentForHotel(chatId, tourType, hotelId) {
  const year = new Date().getFullYear();
  const hotel = await prisma.hotel.findUnique({ where: { id: hotelId }, include: { city: true } });
  const confs = await prisma.telegramConfirmation.findMany({
    where: { hotelId, type: 'ANNULMENT' },
    include: { booking: { select: { bookingNumber: true, tourType: { select: { code: true } } } } },
    orderBy: { sentAt: 'desc' }
  });
  const seen = new Set();
  const bookings = [];
  for (const c of confs) {
    if (c.booking?.tourType?.code !== tourType) continue;
    if (seen.has(c.bookingId)) continue;
    seen.add(c.bookingId);
    bookings.push({ bookingNumber: c.booking?.bookingNumber || `#${c.bookingId}`, status: c.status });
  }
  const cityName = hotel?.city?.name ? ` (${hotel.city.name})` : '';
  const statusLabel = s => {
    if (s === 'CONFIRMED') return '✅ tasdiqlandi';
    if (s === 'REJECTED')  return '❌ rad etildi';
    if (s === 'WAITING')   return '⏳ WL';
    return '🔲 javob kutilmoqda';
  };
  const lines = [
    `❌ *Ануляция — ${tourType} ${year}*`,
    `🏨 *${hotel?.name || '?'}*${cityName}`,
    ''
  ];
  bookings.forEach(b => lines.push(`${b.bookingNumber} — ${statusLabel(b.status)}`));
  await axios.post(`${BOT_API()}/sendMessage`, {
    chat_id: chatId, text: lines.join('\n'), parse_mode: 'Markdown'
  }).catch(() => {});
}

// Helper: hotel Ануляция — show details for specific hotel + booking number
async function sendHotelAnnulmentForBooking(chatId, hotel, tourType, bookingNumber) {
  const fmt = d => { if (!d) return '—'; const dt = new Date(d); return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.${dt.getFullYear()}`; };
  const confs = await prisma.telegramConfirmation.findMany({
    where: { hotelId: hotel.id, type: 'ANNULMENT', booking: { bookingNumber } },
    include: { booking: { select: { bookingNumber: true, status: true, pax: true, tourType: { select: { code: true } } } } },
    orderBy: { sentAt: 'asc' }
  });
  const seen = new Set();
  const filtered = confs.filter(c => { if (seen.has(c.bookingId)) return false; seen.add(c.bookingId); return true; });
  if (!filtered.length) {
    await axios.post(`${BOT_API()}/sendMessage`, { chat_id: chatId, text: `❌ ${bookingNumber} uchun Аннуляций пока нет.` }).catch(() => {});
    return;
  }
  const lines = [`❌ *Ануляция — ${hotel.name} (${bookingNumber})*`];
  for (const c of filtered) {
    const accs = await prisma.accommodation.findMany({ where: { bookingId: c.bookingId, hotelId: hotel.id }, orderBy: { checkInDate: 'asc' } });
    lines.push('');
    lines.push(`❌ *ЗАЯВКА ${c.booking?.bookingNumber || '—'}*`);
    accs.forEach((acc, i) => {
      if (accs.length > 1) lines.push(`  *${i + 1}-заезд:*`);
      lines.push(`  📅 Заезд: ${fmt(acc.checkInDate)}`);
      lines.push(`  📅 Выезд: ${fmt(acc.checkOutDate)}`);
      lines.push(`  👥 PAX: ${c.booking?.pax || 0}`);
    });
    if (!accs.length) lines.push(`  📅 Yuborilgan: ${fmt(c.sentAt)}`);
  }
  await axios.post(`${BOT_API()}/sendMessage`, { chat_id: chatId, text: lines.join('\n'), parse_mode: 'Markdown' }).catch(() => {});
}

// Helper: admin Ануляция — show group buttons for a tourType
async function sendAdminAnnulmentGroups(chatId, tourType, replyMarkup) {
  const year = new Date().getFullYear();
  const confs = await prisma.telegramConfirmation.findMany({
    where: { type: 'ANNULMENT', booking: { tourType: { code: tourType } } },
    include: { booking: { select: { bookingNumber: true, bookingYear: true } } },
    orderBy: { sentAt: 'asc' }
  });
  const groupSet = new Set();
  for (const c of confs) {
    if (c.booking?.bookingNumber && (!c.booking.bookingYear || c.booking.bookingYear === year)) {
      groupSet.add(c.booking.bookingNumber);
    }
  }
  const groups = [...groupSet].sort();
  if (!groups.length) {
    await axios.post(`${BOT_API()}/sendMessage`, {
      chat_id: chatId,
      text: `❌ *Ануляция — ${tourType} ${year}*\n\n📭 Bekor qilingan zaявkalar yo'q.`,
      parse_mode: 'Markdown',
      reply_markup: replyMarkup
    }).catch(() => {});
    return;
  }
  const keyboard = [];
  for (let i = 0; i < groups.length; i += 3) {
    keyboard.push(groups.slice(i, i + 3).map(g => ({ text: g, callback_data: `admin:ann_grp:${tourType}:${g}` })));
  }
  await axios.post(`${BOT_API()}/sendMessage`, {
    chat_id: chatId,
    text: `❌ *Ануляция — ${tourType} ${year}*\n\nGruppani tanlang:`,
    parse_mode: 'Markdown',
    reply_markup: JSON.stringify({ inline_keyboard: keyboard })
  }).catch(() => {});
}

// Helper: admin Ануляция — show details for a specific booking number
async function sendAdminAnnulmentForBooking(chatId, tourType, bookingNumber) {
  const year = new Date().getFullYear();
  const fmt = d => { if (!d) return '—'; const dt = new Date(d); return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.${dt.getFullYear()}`; };
  const confs = await prisma.telegramConfirmation.findMany({
    where: { type: 'ANNULMENT', booking: { bookingNumber } },
    include: {
      hotel: { select: { id: true, name: true, city: { select: { name: true } } } },
      booking: { select: { bookingNumber: true, pax: true } }
    },
    orderBy: { sentAt: 'asc' }
  });
  const seen = new Set();
  const filtered = confs.filter(c => { const k = `${c.bookingId}_${c.hotelId}`; if (seen.has(k)) return false; seen.add(k); return true; });
  if (!filtered.length) {
    await axios.post(`${BOT_API()}/sendMessage`, { chat_id: chatId, text: `❌ ${bookingNumber} uchun anulyatsiya yo'q.`, parse_mode: 'Markdown' }).catch(() => {});
    return;
  }
  const statusLabel = s => ({ CONFIRMED: '✅ tasdiqlandi', REJECTED: '❌ rad etildi', WAITING: '⏳ WL' }[s] || '🔲 javob kutilmoqda');
  const lines = [`❌ *Ануляция — ${bookingNumber} (${tourType} ${year})*`];
  for (const c of filtered) {
    const accs = await prisma.accommodation.findMany({ where: { bookingId: c.bookingId, hotelId: c.hotelId }, orderBy: { checkInDate: 'asc' } });
    const cityName = c.hotel?.city?.name ? ` (${c.hotel.city.name})` : '';
    lines.push('');
    lines.push(`🏨 *${c.hotel?.name || '?'}*${cityName} — ${statusLabel(c.status)}`);
    accs.forEach((acc, i) => {
      if (accs.length > 1) lines.push(`  *${i + 1}-заезд:*`);
      lines.push(`  📅 Заезд: ${fmt(acc.checkInDate)}`);
      lines.push(`  📅 Выезд: ${fmt(acc.checkOutDate)}`);
      lines.push(`  👥 PAX: ${c.booking?.pax || 0}`);
    });
    if (!accs.length) lines.push(`  📅 Yuborilgan: ${fmt(c.sentAt)}`);
  }
  await axios.post(`${BOT_API()}/sendMessage`, { chat_id: chatId, text: lines.join('\n'), parse_mode: 'Markdown' }).catch(() => {});
}

// Helper: hotel WL — JP_SECTIONS WAITING for hotel+tourType (with confirm/reject buttons)
async function sendHotelWlJp(chatId, hotel, tourType, yearFilter = null) {
  const settings = await findJpSectionsByChatId(chatId);
  let found = false;
  for (const s of settings) {
    try {
      const d = JSON.parse(s.value);
      if (d.tourType !== tourType) continue;
      if (yearFilter && parseInt(d.year) !== yearFilter) continue;
      for (const grp of (d.groups || [])) {
        for (const v of grp.visits) {
          if (v.status !== 'WAITING') continue;
          found = true;
          const label = v.sectionLabel ? `${grp.group} — ${v.sectionLabel}` : grp.group;
          const text = [`⏳ *ЗАЯВКА ${label}*`, `📅 Заезд: ${v.checkIn}`, `📅 Выезд: ${v.checkOut}`, `👥 PAX: ${v.pax}`, `🛏 DBL:${v.dbl||0}  |  TWN:${v.twn||0}  |  SNGL:${v.sngl||0}`].join('\n');
          await axios.post(`${BOT_API()}/sendMessage`, {
            chat_id: chatId, text, parse_mode: 'Markdown',
            reply_markup: JSON.stringify({ inline_keyboard: [[
              { text: '✅ Tasdiqlash', callback_data: `jp_c:${grp.bookingId}:${hotel.id}:${v.visitIdx}` },
              { text: '❌ Rad qilish', callback_data: `jp_r:${grp.bookingId}:${hotel.id}:${v.visitIdx}` }
            ]] })
          }).catch(() => {});
        }
      }
    } catch {}
  }
  if (!found) {
    await axios.post(`${BOT_API()}/sendMessage`, { chat_id: chatId, text: `⏳ ${tourType} uchun Waiting List bo'sh.` }).catch(() => {});
  }
}

// Helper: hotel WL — TelegramConfirmation WAITING for hotel+tourType (with confirm/reject buttons)
async function sendHotelWlChg(chatId, hotel, tourType) {
  const fmt = d => { if (!d) return '—'; const dt = new Date(d); return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.${dt.getFullYear()}`; };
  const confs = await prisma.telegramConfirmation.findMany({
    where: { hotelId: hotel.id, status: 'WAITING' },
    include: { booking: { select: { bookingNumber: true, pax: true, status: true, tourType: { select: { code: true } } } } },
    orderBy: { sentAt: 'asc' }
  });
  const seen = new Set();
  const items = confs.filter(c => {
    if (c.booking?.tourType?.code !== tourType) return false;
    if (seen.has(c.bookingId)) return false;
    seen.add(c.bookingId); return true;
  });
  if (!items.length) {
    await axios.post(`${BOT_API()}/sendMessage`, { chat_id: chatId, text: `⏳ ${tourType} uchun Waiting List bo'sh.` }).catch(() => {});
    return;
  }
  for (const c of items) {
    const accs = await prisma.accommodation.findMany({ where: { bookingId: c.bookingId, hotelId: hotel.id }, include: { rooms: true }, orderBy: { checkInDate: 'asc' } });
    const lines = [`⏳ *ЗАЯВКА ${c.booking?.bookingNumber || '—'}*`];
    if (accs.length > 0) {
      accs.forEach((acc, i) => {
        const dbl = acc.rooms.filter(r => r.roomTypeCode === 'DBL').reduce((s, r) => s + r.roomsCount, 0);
        const twn = acc.rooms.filter(r => r.roomTypeCode === 'TWN').reduce((s, r) => s + r.roomsCount, 0);
        const sngl = acc.rooms.filter(r => r.roomTypeCode === 'SNGL').reduce((s, r) => s + r.roomsCount, 0);
        if (accs.length > 1) lines.push(`  *${i + 1}-заезд:*`);
        lines.push(`  📅 Заезд: ${fmt(acc.checkInDate)}`);
        lines.push(`  📅 Выезд: ${fmt(acc.checkOutDate)}`);
        lines.push(`  👥 PAX: ${c.booking?.pax || 0}`);
        lines.push(`  🛏 DBL: ${dbl}  |  TWN: ${twn}  |  SNGL: ${sngl}`);
      });
    }
    await axios.post(`${BOT_API()}/sendMessage`, {
      chat_id: chatId, text: lines.join('\n'), parse_mode: 'Markdown',
      reply_markup: JSON.stringify({ inline_keyboard: [[
        { text: '✅ Tasdiqlash', callback_data: `confirm:${c.bookingId}:${hotel.id}` },
        { text: '❌ Rad qilish', callback_data: `reject:${c.bookingId}:${hotel.id}` }
      ]] })
    }).catch(() => {});
  }
}

// Helper: hotel Ануляция for hotel+tourType
async function sendHotelAnnulment(chatId, hotel, tourType) {
  const fmt = d => { if (!d) return '—'; const dt = new Date(d); return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.${dt.getFullYear()}`; };
  const confs = await prisma.telegramConfirmation.findMany({
    where: { hotelId: hotel.id },
    include: { booking: { select: { bookingNumber: true, status: true, pax: true, tourType: { select: { code: true } } } } },
    orderBy: { sentAt: 'asc' }
  });
  // Find latest type per bookingId for this hotel
  const latestTypeMap = {};
  for (const c of confs) {
    if (!latestTypeMap[c.bookingId] || c.sentAt > latestTypeMap[c.bookingId].sentAt) {
      latestTypeMap[c.bookingId] = { type: c.type, sentAt: c.sentAt };
    }
  }
  const seen = new Set();
  const filtered = confs.filter(c => {
    if (c.type !== 'ANNULMENT') return false;
    if (latestTypeMap[c.bookingId]?.type !== 'ANNULMENT') return false; // later CHANGE sent → skip
    if (c.booking?.tourType?.code !== tourType) return false;
    if (seen.has(c.bookingId)) return false;
    seen.add(c.bookingId); return true;
  });
  if (!filtered.length) {
    await axios.post(`${BOT_API()}/sendMessage`, { chat_id: chatId, text: `❌ ${tourType} uchun Аннуляций пока нет.` }).catch(() => {});
    return;
  }
  const lines = [`❌ *Ануляция — ${hotel.name} (${tourType})*`];
  for (const c of filtered) {
    const accs = await prisma.accommodation.findMany({ where: { bookingId: c.bookingId, hotelId: hotel.id }, orderBy: { checkInDate: 'asc' } });
    lines.push('');
    lines.push(`❌ *ЗАЯВКА ${c.booking?.bookingNumber || '—'}*`);
    accs.forEach((acc, i) => {
      if (accs.length > 1) lines.push(`  *${i + 1}-заезд:*`);
      lines.push(`  📅 Заезд: ${fmt(acc.checkInDate)}`);
      lines.push(`  📅 Выезд: ${fmt(acc.checkOutDate)}`);
      lines.push(`  👥 PAX: ${c.booking?.pax || 0}`);
    });
    if (!accs.length) lines.push(`  📅 Yuborilgan: ${fmt(c.sentAt)}`);
  }
  await axios.post(`${BOT_API()}/sendMessage`, { chat_id: chatId, text: lines.join('\n'), parse_mode: 'Markdown' }).catch(() => {});
}

// Helper: show Izmeneniye k Zayavke for a specific hotel + tourType
async function sendHotelChangesForTourType(chatId, hotel, tourType) {
  const year = new Date().getFullYear();
  const fmt = d => { if (!d) return '—'; const dt = new Date(d); return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.${dt.getFullYear()}`; };
  const confs = await prisma.telegramConfirmation.findMany({
    where: { hotelId: hotel.id, status: { in: ['CONFIRMED', 'REJECTED'] } },
    include: { booking: { select: { bookingNumber: true, status: true, pax: true, tourType: { select: { code: true } } } } },
    orderBy: { sentAt: 'desc' }
  });
  // For each bookingId, find the latest sent record type for this hotel.
  // If latest type = ANNULMENT → belongs to Anulyatsiya.
  // If latest type = CHANGE → belongs to Izmeneniya (even if annulment existed before).
  const allConfsForHotel = await prisma.telegramConfirmation.findMany({
    where: { hotelId: hotel.id },
    select: { bookingId: true, type: true, sentAt: true }
  });
  const latestTypeMap = {};
  for (const c of allConfsForHotel) {
    if (!latestTypeMap[c.bookingId] || c.sentAt > latestTypeMap[c.bookingId].sentAt) {
      latestTypeMap[c.bookingId] = { type: c.type, sentAt: c.sentAt };
    }
  }

  // Keep only the latest TelegramConfirmation per bookingId, then sort by bookingNumber
  const seen = new Set();
  const latest = confs.filter(c => {
    if (c.type === 'ANNULMENT') return false;
    if (latestTypeMap[c.bookingId]?.type === 'ANNULMENT') return false; // latest was annulment → skip
    if (c.booking?.tourType?.code !== tourType) return false;
    if (seen.has(c.bookingId)) return false;
    seen.add(c.bookingId);
    return true;
  });
  const filtered = latest.sort((a, b) => {
    const na = a.booking?.bookingNumber || '';
    const nb = b.booking?.bookingNumber || '';
    return na.localeCompare(nb);
  });
  if (!filtered.length) {
    await axios.post(`${BOT_API()}/sendMessage`, { chat_id: chatId, text: `📝 ${tourType} ${year} uchun o'zgarish yo'q.` }).catch(() => {});
    return;
  }
  const lines = [`📝 *Изменения к Заявке — ${hotel.name} (${tourType} ${year})*`];
  for (const c of filtered) {
    const accs = await prisma.accommodation.findMany({
      where: { bookingId: c.bookingId, hotelId: hotel.id },
      include: { rooms: true },
      orderBy: { checkInDate: 'asc' }
    });
    const statusIcon = c.status === 'REJECTED' ? '❌' : '✅';
    lines.push('');
    lines.push(`${statusIcon} *ЗАЯВКА ${c.booking?.bookingNumber || '—'}*`);
    if (accs.length > 0) {
      accs.forEach((acc, i) => {
        const dbl = acc.rooms.filter(r => r.roomTypeCode === 'DBL').reduce((s, r) => s + r.roomsCount, 0);
        const twn = acc.rooms.filter(r => r.roomTypeCode === 'TWN').reduce((s, r) => s + r.roomsCount, 0);
        const sngl = acc.rooms.filter(r => r.roomTypeCode === 'SNGL').reduce((s, r) => s + r.roomsCount, 0);
        if (accs.length > 1) lines.push(`  *${i + 1}-заезд:*`);
        lines.push(`  📅 Заезд: ${fmt(acc.checkInDate)}`);
        lines.push(`  📅 Выезд: ${fmt(acc.checkOutDate)}`);
        lines.push(`  👥 PAX: ${c.booking?.pax || 0}`);
        lines.push(`  🛏 DBL: ${dbl}  |  TWN: ${twn}  |  SNGL: ${sngl}`);
      });
    } else {
      lines.push(`  📅 Yuborilgan: ${fmt(c.sentAt)}`);
    }
  }
  await axios.post(`${BOT_API()}/sendMessage`, { chat_id: chatId, text: lines.join('\n'), parse_mode: 'Markdown' }).catch(() => {});
}

// Helper: show Izmeneniye k Zayavke for a specific hotel + booking number
async function sendHotelChangesForBooking(chatId, hotel, tourType, bookingNumber) {
  const year = new Date().getFullYear();
  const fmt = d => { if (!d) return '—'; const dt = new Date(d); return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.${dt.getFullYear()}`; };
  const confs = await prisma.telegramConfirmation.findMany({
    where: { hotelId: hotel.id, status: { in: ['CONFIRMED', 'REJECTED'] }, type: 'CHANGE', booking: { bookingNumber } },
    include: { booking: { select: { bookingNumber: true, status: true, pax: true, tourType: { select: { code: true } } } } },
    orderBy: { sentAt: 'desc' }
  });
  const seen = new Set();
  const filtered = confs.filter(c => {
    if (seen.has(c.bookingId)) return false;
    seen.add(c.bookingId);
    return true;
  });
  if (!filtered.length) {
    await axios.post(`${BOT_API()}/sendMessage`, { chat_id: chatId, text: `📝 ${bookingNumber} uchun o'zgarish yo'q.` }).catch(() => {});
    return;
  }
  const lines = [`📝 *Изменения к Заявке — ${hotel.name} (${bookingNumber})*`];
  for (const c of filtered) {
    const accs = await prisma.accommodation.findMany({
      where: { bookingId: c.bookingId, hotelId: hotel.id },
      include: { rooms: true },
      orderBy: { checkInDate: 'asc' }
    });
    const statusIcon = c.status === 'REJECTED' ? '❌' : '✅';
    lines.push('');
    lines.push(`${statusIcon} *ЗАЯВКА ${c.booking?.bookingNumber || '—'}*`);
    if (accs.length > 0) {
      accs.forEach((acc, i) => {
        const dbl = acc.rooms.filter(r => r.roomTypeCode === 'DBL').reduce((s, r) => s + r.roomsCount, 0);
        const twn = acc.rooms.filter(r => r.roomTypeCode === 'TWN').reduce((s, r) => s + r.roomsCount, 0);
        const ez  = acc.rooms.filter(r => r.roomTypeCode === 'EZ').reduce((s, r) => s + r.roomsCount, 0);
        if (accs.length > 1) lines.push(`  *${i + 1}-заезд:*`);
        lines.push(`  📅 Заезд: ${fmt(acc.checkInDate)}`);
        lines.push(`  📅 Выезд: ${fmt(acc.checkOutDate)}`);
        lines.push(`  👥 PAX: ${c.booking?.pax || 0}`);
        if (dbl) lines.push(`  🛏 DBL: ${dbl}`);
        if (twn) lines.push(`  🛏 TWN: ${twn}`);
        if (ez)  lines.push(`  🛏 EZ: ${ez}`);
      });
    }
    lines.push(`  📅 Yuborilgan: ${fmt(c.sentAt)}`);
  }
  await axios.post(`${BOT_API()}/sendMessage`, { chat_id: chatId, text: lines.join('\n'), parse_mode: 'Markdown' }).catch(() => {});
}

// Helper: handle /start command — save chat, set role=user
async function handleStart(chat, msg, botApiUrl, defaultRole = 'user') {
  try {
    const chats = await loadKnownChats();
    const existing = chats[String(chat.id)] || {};
    const telegramName = chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ');
    chats[String(chat.id)] = {
      ...existing,
      chatId: String(chat.id),
      name: existing.nameCustomized ? existing.name : telegramName,
      username: chat.username ? `@${chat.username}` : (existing.username || null),
      type: chat.type,
      role: existing.role || defaultRole,
      lastMessage: '/start',
      date: new Date(msg.date * 1000).toISOString()
    };
    await saveKnownChats(chats);
    const firstName = chat.first_name || chat.title || 'Foydalanuvchi';
    if (existing.role === 'admin') {
      if (botApiUrl === RESTAURANT_API()) await sendRestaurantMenu(chat.id, true);
      else if (botApiUrl === TRANSPORT_API()) await sendTransportAdminMenu(chat.id);
      else if (botApiUrl === GUIDE_API()) await sendGuideMenu(chat.id, true);
      else await sendAdminMenu(chat.id);
    } else if (existing.role === 'hotel') {
      await sendHotelMenu(chat.id);
    } else if (existing.role === 'transport') {
      await sendTransportMenu(chat.id);
    } else if (existing.role === 'restaurant') {
      await sendRestaurantMenu(chat.id);
    } else if (existing.role === 'guide') {
      await sendGuideMenu(chat.id);
    } else {
      await axios.post(`${botApiUrl}/sendMessage`, {
        chat_id: chat.id,
        text: `Assalomu alaykum, *${firstName}!* 👋\n\nSiz ro'yxatga qo'shildingiz. Admin tez orada sizga rol tayinlaydi.`,
        parse_mode: 'Markdown',
        reply_markup: JSON.stringify({ remove_keyboard: true })
      }).catch(() => {});
    }
  } catch (e) { console.error('handleStart error:', e.message); }
}

// Helper: load known chats from DB
async function loadKnownChats() {
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key: CHATS_SETTING_KEY } });
    return setting ? JSON.parse(setting.value) : {};
  } catch { return {}; }
}

// Helper: save known chats to DB
async function saveKnownChats(chats) {
  await prisma.systemSetting.upsert({
    where: { key: CHATS_SETTING_KEY },
    update: { value: JSON.stringify(chats) },
    create: { key: CHATS_SETTING_KEY, value: JSON.stringify(chats) }
  });
}

// GET /api/telegram/restaurant-list - Restaurant names for linking
router.get('/restaurant-list', authenticate, async (req, res) => {
  try {
    const chatIds = await getMealChatIds(); // { restaurantName: chatId }
    // Also get unique names from MealConfirmation history
    const history = await prisma.mealConfirmation.findMany({
      select: { restaurantName: true },
      distinct: ['restaurantName']
    });
    const namesFromHistory = history.map(r => r.restaurantName).filter(Boolean);
    const namesFromSettings = Object.keys(chatIds);
    const allNames = [...new Set([...namesFromSettings, ...namesFromHistory])].sort();
    const restaurants = allNames.map(name => ({ name, chatId: chatIds[name] || null }));
    res.json({ restaurants });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/telegram/link-restaurant - Link a chat to a restaurant
router.put('/link-restaurant', authenticate, async (req, res) => {
  try {
    const { chatId, restaurantName } = req.body;
    const chatIds = await getMealChatIds();
    // Clear this chatId from any restaurant
    for (const name of Object.keys(chatIds)) {
      if (chatIds[name] === String(chatId)) delete chatIds[name];
    }
    if (restaurantName) chatIds[restaurantName] = String(chatId);
    await saveMealChatIds(chatIds);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/telegram/guides-list - All guides for linking
router.get('/guides-list', authenticate, async (req, res) => {
  try {
    const year = new Date().getFullYear();
    const guides = await prisma.guide.findMany({
      where: { year },
      select: { id: true, name: true, telegramChatId: true },
      orderBy: { name: 'asc' }
    });
    res.json({ guides });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/telegram/link-guide - Link a chat to a guide
router.put('/link-guide', authenticate, async (req, res) => {
  try {
    const { chatId, guideId } = req.body;
    // Clear chatId from any other guide
    await prisma.guide.updateMany({
      where: { telegramChatId: String(chatId) },
      data: { telegramChatId: null }
    });
    if (guideId) {
      await prisma.guide.update({
        where: { id: parseInt(guideId) },
        data: { telegramChatId: String(chatId) }
      });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/telegram/link-transport - Link a chat to a transport provider
router.put('/link-transport', authenticate, async (req, res) => {
  try {
    const { chatId, provider } = req.body;
    // Clear this chatId from all providers first
    const allProviders = ['sevil', 'xayrulla', 'nosir', 'hammasi'];
    for (const p of allProviders) {
      const current = await getProviderChatId(p);
      if (current === String(chatId)) await setProviderChatId(p, '');
    }
    if (provider) await setProviderChatId(provider, String(chatId));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/telegram/hotels-list - Active hotels for linking
router.get('/hotels-list', authenticate, async (req, res) => {
  try {
    const hotels = await prisma.hotel.findMany({
      where: { isActive: true },
      select: { id: true, name: true, telegramChatId: true },
      orderBy: { name: 'asc' }
    });
    res.json({ hotels });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/telegram/link-hotel - Link a chat to a hotel (sets hotel.telegramChatId)
router.put('/link-hotel', authenticate, async (req, res) => {
  try {
    const { chatId, hotelId } = req.body;
    // Clear chatId from any other hotel that had it
    await prisma.hotel.updateMany({
      where: { telegramChatId: String(chatId) },
      data: { telegramChatId: null }
    });
    if (hotelId) {
      await prisma.hotel.update({
        where: { id: parseInt(hotelId) },
        data: { telegramChatId: String(chatId) }
      });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/telegram/updates - Known chats from DB (populated by webhook)
router.get('/updates', authenticate, async (req, res) => {
  try {
    const chats = await loadKnownChats();
    const list = Object.values(chats).sort((a, b) => b.date.localeCompare(a.date));
    res.json({ chats: list });
  } catch (error) {
    console.error('Telegram updates error:', error.message);
    res.status(500).json({ error: 'Failed to fetch Telegram updates' });
  }
});

// GET /api/telegram/messages - Get chat message history
router.get('/messages', authenticate, async (req, res) => {
  try {
    const { chatId } = req.query;
    const where = chatId ? { chatId: String(chatId) } : {};
    const messages = await prisma.telegramMessage.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: 200
    });
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/telegram/send-message - Send message to a specific chat
router.post('/send-message', authenticate, requireAdmin, async (req, res) => {
  try {
    const { chatId, text } = req.body;
    if (!chatId || !text?.trim()) return res.status(400).json({ error: 'chatId va text kerak' });
    const response = await axios.post(`${BOT_API()}/sendMessage`, {
      chat_id: chatId,
      text: text.trim(),
      parse_mode: 'HTML'
    });
    if (!response.data.ok) return res.status(400).json({ error: 'Telegram xatosi: ' + response.data.description });
    const msgId = response.data.result.message_id;
    // Save outgoing message to chat history
    const chatsData = await loadKnownChats().catch(() => ({}));
    await prisma.telegramMessage.create({
      data: {
        chatId: String(chatId),
        chatName: chatsData[String(chatId)]?.name || null,
        role: chatsData[String(chatId)]?.role || null,
        text: text.trim(),
        direction: 'OUT'
      }
    }).catch(() => {});
    res.json({ success: true, messageId: msgId });
  } catch (error) {
    const desc = error.response?.data?.description || error.message;
    console.error('Send message error:', desc);
    res.status(500).json({ error: desc || 'Xabar yuborishda xatolik' });
  }
});

// PUT /api/telegram/chats/:chatId - Update chat name, role and phone
router.put('/chats/:chatId', authenticate, requireAdmin, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { role, phone, name, isChecker } = req.body;
    const chats = await loadKnownChats();
    if (!chats[chatId]) return res.status(404).json({ error: 'Chat topilmadi' });
    if (name !== undefined && name.trim()) {
      chats[chatId].name = name.trim();
      chats[chatId].nameCustomized = true; // Prevent webhook from overwriting
    }
    const prevRole = chats[chatId].role;
    if (role !== undefined) chats[chatId].role = role;
    if (phone !== undefined) chats[chatId].phone = phone;
    if (isChecker !== undefined) {
      // Clear isChecker from any previously checked admin
      if (isChecker) {
        for (const [cid, chat] of Object.entries(chats)) {
          if (cid !== chatId && chat.isChecker) chat.isChecker = false;
        }
      }
      chats[chatId].isChecker = isChecker;
      // Sync with TRANSPORT_HAMMASI_CHAT_ID (Tekshiruvchi transport setting)
      if (isChecker) {
        await setProviderChatId('hammasi', String(chatId));
      } else {
        const current = await getProviderChatId('hammasi');
        if (String(current) === String(chatId)) await setProviderChatId('hammasi', '');
      }
    }
    await saveKnownChats(chats);
    // Send bot-specific welcome message when admin assigns a role
    if (role !== undefined && role !== prevRole && T.roleAssigned[role]) {
      const roleApis = { hotel: BOT_API(), transport: TRANSPORT_API(), restaurant: RESTAURANT_API(), guide: GUIDE_API(), admin: BOT_API() };
      const api = roleApis[role];
      if (api) {
        const lang = await getChatLang(chatId);
        const text = T.roleAssigned[role][lang] || T.roleAssigned[role].uz;
        await axios.post(`${api}/sendMessage`, {
          chat_id: chatId,
          text,
          parse_mode: 'Markdown',
          reply_markup: JSON.stringify({ remove_keyboard: true })
        }).catch(() => {});
        if (role === 'admin') await sendAdminMenu(chatId);
        else if (role === 'hotel') await sendHotelMenu(chatId);
        else if (role === 'transport') await sendTransportMenu(chatId);
        else if (role === 'restaurant') await sendRestaurantMenu(chatId);
        else if (role === 'guide') await sendGuideMenu(chatId);
      }
    }
    res.json({ chat: chats[chatId] });
  } catch (error) {
    console.error('Update chat error:', error.message);
    res.status(500).json({ error: 'Xatolik yuz berdi' });
  }
});

// DELETE /api/telegram/chats/:chatId - Remove a chat from known chats
router.delete('/chats/:chatId', authenticate, requireAdmin, async (req, res) => {
  try {
    const { chatId } = req.params;
    const chats = await loadKnownChats();
    if (!chats[chatId]) return res.status(404).json({ error: 'Chat topilmadi' });
    const userRole = chats[chatId].role;
    delete chats[chatId];
    await saveKnownChats(chats);

    // Remove from all 4 bot admin notification lists
    for (const botType of ['hotel', 'transport', 'restaurant', 'guide']) {
      const keyMap = { hotel: 'HOTEL_ADMIN_CHAT_IDS', transport: 'TRANSPORT_ADMIN_CHAT_IDS', restaurant: 'RESTAURANT_ADMIN_CHAT_IDS', guide: 'GUIDE_ADMIN_CHAT_IDS' };
      const key = keyMap[botType];
      const s = await prisma.systemSetting.findUnique({ where: { key } });
      if (!s?.value) continue;
      try {
        const arr = JSON.parse(s.value).filter(id => String(id) !== String(chatId));
        await prisma.systemSetting.update({ where: { key }, data: { value: JSON.stringify(arr) } });
      } catch {}
    }

    // Notify the removed user and show /start button
    let botApi = BOT_API();
    if (userRole === 'restaurant') botApi = RESTAURANT_API();
    else if (userRole === 'transport') botApi = TRANSPORT_API();
    else if (userRole === 'guide') botApi = GUIDE_API();

    // First remove all menus
    await axios.post(`${botApi}/sendMessage`, {
      chat_id: chatId,
      text: `❌ Sizning ruxsatingiz bekor qilindi.`,
      reply_markup: { remove_keyboard: true }
    }).catch(() => {});
    // Then show /start prompt
    await axios.post(`${botApi}/sendMessage`, {
      chat_id: chatId,
      text: `Qayta ro'yxatdan o'tish uchun /start ni bosing.`,
      reply_markup: { keyboard: [[{ text: '/start' }]], resize_keyboard: true, one_time_keyboard: true }
    }).catch(() => {});

    res.json({ success: true });
  } catch (error) {
    console.error('Delete chat error:', error.message);
    res.status(500).json({ error: 'Xatolik yuz berdi' });
  }
});

// POST /api/telegram/webhook - Receive updates from Telegram
router.post('/webhook', (req, res, next) => {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    console.error('TELEGRAM_WEBHOOK_SECRET is not set — webhook rejected');
    return res.sendStatus(403);
  }
  const received = req.headers['x-telegram-bot-api-secret-token'] || '';
  try {
    const crypto = require('crypto');
    const a = Buffer.from(received);
    const b = Buffer.from(secret);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.sendStatus(401);
    }
  } catch {
    return res.sendStatus(401);
  }
  next();
}, async (req, res) => {
  // Respond immediately so Telegram doesn't retry
  res.sendStatus(200);

  try {
    const update = req.body;

    // Date formatter helper
    const fmtDate = (d) => {
      if (!d) return '—';
      const dt = new Date(d);
      return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.${dt.getFullYear()}`;
    };

    // Save any chat that messages the bot
    const msg = update.message || update.channel_post;
    if (msg) {
      const chat = msg.chat;

      // /start — welcome message + auto role=user
      if (msg.text === '/start') {
        await handleStart(chat, msg, BOT_API());
        return;
      }

      // Language selection (eski userlar uchun saqlash, javob bermaydi)
      if (msg.text === "🇺🇿 O'zbek tili" || msg.text === "🇷🇺 Русский язык") {
        const lang = msg.text.includes("O'zbek") ? 'uz' : 'ru';
        const chats = await loadKnownChats();
        if (chats[String(chat.id)]) { chats[String(chat.id)].lang = lang; await saveKnownChats(chats); }
        const userRole = chats[String(chat.id)]?.role;
        if (userRole === 'hotel') await sendHotelMenu(chat.id);
        return;
      }

      // Contact shared — save phone number (agar kimdir yuborsa)
      if (msg.contact) {
        const phone = msg.contact.phone_number;
        const chats = await loadKnownChats();
        const role = chats[String(chat.id)]?.role;
        if (chats[String(chat.id)]) {
          chats[String(chat.id)].phone = phone;
          await saveKnownChats(chats);
        }
        if (role === 'hotel') await sendHotelMenu(chat.id);
        return;
      }

      const chats = await loadKnownChats();
      const existing = chats[String(chat.id)] || {};
      const telegramName = chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ');
      chats[String(chat.id)] = {
        ...existing,
        chatId: String(chat.id),
        name: existing.nameCustomized ? existing.name : telegramName,
        username: chat.username ? `@${chat.username}` : (existing.username || null),
        type: chat.type,
        lastMessage: msg.text || '[file]',
        date: new Date(msg.date * 1000).toISOString()
      };
      await saveKnownChats(chats);

      // Block users without an assigned role (only hotel/transport/restaurant/guide/admin allowed)
      const assignedRole = chats[String(chat.id)]?.role;
      const ALLOWED_ROLES = ['hotel', 'transport', 'restaurant', 'guide', 'admin'];
      const isAllowedByEnv = process.env.TELEGRAM_ADMIN_CHAT_ID && String(chat.id) === String(process.env.TELEGRAM_ADMIN_CHAT_ID);
      if (!isAllowedByEnv && (!assignedRole || !ALLOWED_ROLES.includes(assignedRole))) {
        await axios.post(`${BOT_API()}/sendMessage`, {
          chat_id: chat.id,
          text: '❌ Sizga bu botdan foydalanish ruxsati yo\'q.\n\nAdmin bilan bog\'laning.'
        }).catch(() => {});
        return;
      }

      // Save incoming text message to chat history + notify admins
      if (msg.text) {
        await prisma.telegramMessage.create({
          data: {
            chatId: String(chat.id),
            chatName: chats[String(chat.id)]?.name || null,
            role: chats[String(chat.id)]?.role || null,
            text: msg.text,
            direction: 'IN'
          }
        }).catch(() => {});

        // Skip admin notification for menu/keyboard button presses
        // Commands start with '/', menu buttons start with known emoji prefixes
        const MENU_PREFIXES = [
          '📋 ', '📄 ', '📝 ', '⏳ ', '❌ ', '✅ ', '🏨 ', '🍽 ', '🚌 ', '👤 ', '🍴 ', '⬅️ ', '◀️ ', '🚫 ',
        ];
        const isMenuButton = msg.text.startsWith('/') ||
          MENU_PREFIXES.some(prefix => msg.text.startsWith(prefix));

        // Notify all admins about incoming message with reply button (skip menu navigation)
        if (!isMenuButton) {
          const senderInfo = chats[String(chat.id)];
          const senderName = senderInfo?.name || telegramName;
          const senderRoleLabel = senderInfo?.role
            ? (senderInfo.role.charAt(0).toUpperCase() + senderInfo.role.slice(1))
            : 'User';
          const adminEnvId = process.env.TELEGRAM_ADMIN_CHAT_ID;
          const adminRoleIds = Object.values(chats).filter(c => c.role === 'admin').map(c => c.chatId);
          const allAdmins = [...new Set([...(adminEnvId ? [String(adminEnvId)] : []), ...adminRoleIds])];
          for (const aId of allAdmins) {
            if (String(aId) === String(chat.id)) continue;
            await axios.post(`${BOT_API()}/sendMessage`, {
              chat_id: aId,
              text: `💬 *${senderRoleLabel}: ${senderName}*\n\n📩 Yangi xabar:\n"${msg.text}"`,
              parse_mode: 'Markdown',
              reply_markup: JSON.stringify({
                inline_keyboard: [[
                  { text: '✏️ Javob berish', callback_data: `reply_to:${chat.id}:${senderName.substring(0, 30)}` }
                ]]
              })
            }).catch(() => {});
          }
        }
      }

      // Hotel menu commands (for hotel users — admin skip qiladi)
      const senderRole = chats[String(chat.id)]?.role;
      const senderIsAdmin = (process.env.TELEGRAM_ADMIN_CHAT_ID && String(chat.id) === String(process.env.TELEGRAM_ADMIN_CHAT_ID)) || senderRole === 'admin';
      if (msg.text && !senderIsAdmin) {
        const year = new Date().getFullYear();
        if (msg.text === '/menu') {
          await sendHotelMenu(chat.id);
          return;
        }
        if (msg.text.startsWith('📋 Заявка')) {
          // Parse year from button text: "📋 Заявка 2027" → 2027
          const pressedYear = parseInt(msg.text.replace('📋 Заявка', '').trim()) || year;
          const allZvSettings = await findJpSectionsByChatId(chat.id);
          // Filter by pressed year AND only show sent sections (bulkMsgId or visit msgId)
          const zvSettings = allZvSettings.filter(s => {
            try {
              const d = JSON.parse(s.value);
              if (parseInt(d.year) !== pressedYear) return false;
              if (d.bulkMsgId != null) return true;
              return (d.groups || []).some(g => g.visits.some(v => v.msgId != null));
            } catch { return false; }
          });
          if (zvSettings.length === 0) {
            await axios.post(`${BOT_API()}/sendMessage`, { chat_id: chat.id, text: '📋 Hali hech qanday zayavka yuborilmagan.', parse_mode: 'Markdown' }).catch(() => {});
            return;
          }
          if (zvSettings.length === 1) {
            const jpData = JSON.parse(zvSettings[0].value);
            const tt = jpData.tourType || '';
            const ST1 = { CONFIRMED: '✅', WAITING: '⏳', REJECTED: '❌' };
            const visitBlocks = [];
            for (const grp of (jpData.groups || [])) {
              for (const v of grp.visits) {
                const si = ST1[v.status] || '⬜';
                const title = v.sectionLabel ? `${si} *ЗАЯВКА ${grp.group} — ${v.sectionLabel}*` : `${si} *ЗАЯВКА ${grp.group}*`;
                visitBlocks.push([title, `📅 Заезд: ${v.checkIn}`, `📅 Выезд: ${v.checkOut}`, `👥 PAX: ${v.pax}`, `🛏 DBL:${v.dbl||0}  |  TWN:${v.twn||0}  |  SNGL:${v.sngl||0}`].join('\n'));
              }
            }
            await axios.post(`${BOT_API()}/sendMessage`, { chat_id: chat.id, text: `📋 *${tt} ${pressedYear} — ${jpData.hotelName || ''}*`, parse_mode: 'Markdown' }).catch(() => {});
            let chunk1 = [], chunkLen1 = 0;
            for (let i = 0; i < visitBlocks.length; i++) {
              if (chunkLen1 + visitBlocks[i].length > 3500 && chunk1.length > 0) {
                await axios.post(`${BOT_API()}/sendMessage`, { chat_id: chat.id, text: chunk1.join('\n\n'), parse_mode: 'Markdown' }).catch(() => {});
                chunk1 = []; chunkLen1 = 0;
              }
              chunk1.push(visitBlocks[i]); chunkLen1 += visitBlocks[i].length;
            }
            if (chunk1.length > 0) {
              await axios.post(`${BOT_API()}/sendMessage`, { chat_id: chat.id, text: chunk1.join('\n\n'), parse_mode: 'Markdown' }).catch(() => {});
            }
            return;
          }
          const ORDER = ['ER', 'CO', 'KAS', 'ZA'];
          const availTypes = zvSettings.map(s => { try { return JSON.parse(s.value).tourType; } catch { return null; } }).filter(Boolean);
          const sorted = ORDER.filter(t => availTypes.includes(t));
          const rows = [];
          for (let i = 0; i < sorted.length; i += 2) {
            rows.push(sorted.slice(i, i + 2).map(t => ({ text: `${t} ${pressedYear}`, callback_data: `zv:${t}:${pressedYear}` })));
          }
          await axios.post(`${BOT_API()}/sendMessage`, {
            chat_id: chat.id,
            text: `📋 *${pressedYear} yil zayavkalari*\nQaysi tur turini tanlang:`,
            parse_mode: 'Markdown',
            reply_markup: JSON.stringify({ inline_keyboard: rows })
          }).catch(() => {});
          return;
        }
        if (msg.text === '⏳ Waiting List') {
          const hotel = await prisma.hotel.findFirst({ where: { telegramChatId: String(chat.id) } });
          if (!hotel) return;
          // Dynamically find available years from JP_SECTIONS keys for this hotel
          const curYear = new Date().getFullYear();
          const jpSettings = await prisma.systemSetting.findMany({ where: { key: { startsWith: `JP_SECTIONS_${hotel.id}_` } } });
          const availYears = [...new Set(
            jpSettings.map(s => { try { return parseInt(JSON.parse(s.value).year); } catch { return null; } }).filter(y => y && y >= curYear)
          )].sort();
          const jpRows = availYears.length
            ? availYears.map(y => [{ text: `📋 Заявка ${y}`, callback_data: `hwl_jp:${hotel.id}:${y}` }])
            : [[{ text: `📋 Заявка ${curYear}`, callback_data: `hwl_jp:${hotel.id}:${curYear}` }]];
          await axios.post(`${BOT_API()}/sendMessage`, {
            chat_id: chat.id,
            text: '⏳ *Waiting List*\nQaysi bo\'limni tanlang:',
            parse_mode: 'Markdown',
            reply_markup: JSON.stringify({ inline_keyboard: [
              ...jpRows,
              [{ text: '📝 Изменения к Заявке', callback_data: `hwl_chg:${hotel.id}` }]
            ]})
          }).catch(() => {});
          return;
        }
        if (msg.text === '📝 Изменения к Заявке' || msg.text === "📝 O'zgarishlar" || msg.text === '❌ Ануляция' || msg.text === "❌ Bekor qilish") {
          const isAnn = msg.text === '❌ Ануляция' || msg.text === "❌ Bekor qilish";
          const hotel = await prisma.hotel.findFirst({ where: { telegramChatId: String(chat.id) } });
          if (!hotel) { await axios.post(`${BOT_API()}/sendMessage`, { chat_id: chat.id, text: '🏨 Hotel topilmadi.' }).catch(() => {}); return; }

          if (!isAnn) {
            // 📝 Изменения: tour type selection
            const confs = await prisma.telegramConfirmation.findMany({
              where: { hotelId: hotel.id, status: { in: ['CONFIRMED', 'REJECTED'] } },
              include: { booking: { select: { status: true, tourType: { select: { code: true } } } } }
            });
            const validTourTypes = [...new Set(
              confs.filter(c => c.type !== 'ANNULMENT')
                   .map(c => c.booking?.tourType?.code).filter(Boolean)
            )];
            if (!validTourTypes.length) {
              await axios.post(`${BOT_API()}/sendMessage`, { chat_id: chat.id, text: '📝 Изменения к Заявке пока нет.' }).catch(() => {});
              return;
            }
            const ORDER = ['ER', 'CO', 'KAS', 'ZA'];
            const sorted = ORDER.filter(t => validTourTypes.includes(t));
            const rows = [];
            for (let i = 0; i < sorted.length; i += 2) {
              rows.push(sorted.slice(i, i + 2).map(t => ({ text: t, callback_data: `chg_tt:${t}:${hotel.id}` })));
            }
            await axios.post(`${BOT_API()}/sendMessage`, {
              chat_id: chat.id,
              text: '📝 *Изменения к Заявке*\nQaysi tur turini tanlang:',
              parse_mode: 'Markdown',
              reply_markup: JSON.stringify({ inline_keyboard: rows })
            }).catch(() => {});
            return;
          }

          // ❌ Ануляция — tour type selection filtered by ANNULMENT type TelegramConfirmations
          const annConfs = await prisma.telegramConfirmation.findMany({
            where: { hotelId: hotel.id, type: 'ANNULMENT' },
            include: { booking: { select: { status: true, tourType: { select: { code: true } } } } }
          });
          const annSeen = new Set();
          const annTourTypes = [];
          for (const c of annConfs) {
            const code = c.booking?.tourType?.code;
            if (code && !annSeen.has(code)) { annSeen.add(code); annTourTypes.push(code); }
          }
          if (!annTourTypes.length) {
            await axios.post(`${BOT_API()}/sendMessage`, { chat_id: chat.id, text: '❌ Аннуляций пока нет.' }).catch(() => {});
            return;
          }
          const ORDER_ANN = ['ER', 'CO', 'KAS', 'ZA'];
          const sortedAnn = ORDER_ANN.filter(t => annTourTypes.includes(t));
          const annRows = [];
          for (let i = 0; i < sortedAnn.length; i += 2) {
            annRows.push(sortedAnn.slice(i, i + 2).map(t => ({ text: t, callback_data: `hann:${hotel.id}:${t}` })));
          }
          await axios.post(`${BOT_API()}/sendMessage`, {
            chat_id: chat.id,
            text: '❌ *Ануляция*\nQaysi tur turini tanlang:',
            parse_mode: 'Markdown',
            reply_markup: JSON.stringify({ inline_keyboard: annRows })
          }).catch(() => {});
          return;
        }
      }

      // Handle admin commands — TELEGRAM_ADMIN_CHAT_ID (env) yoki role='admin' (KNOWN_CHATS)
      const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
      const senderChatId = String(chat.id);
      const senderChats = await loadKnownChats();
      const isAdmin = (adminChatId && senderChatId === String(adminChatId)) || senderChats[senderChatId]?.role === 'admin';
      if (isAdmin && msg.text) {
        const text = msg.text.trim();
        const adminSendId = senderChatId;
        const year = new Date().getFullYear();

        // ── Pending reply mode: admin Telegram dan to'g'ridan javob beradi ──
        if (adminPendingReply[adminSendId]) {
          if (text === '/cancel') {
            delete adminPendingReply[adminSendId];
            await axios.post(`${BOT_API()}/sendMessage`, {
              chat_id: adminSendId,
              text: '❌ Javob bekor qilindi.'
            }).catch(() => {});
            return;
          }
          const { targetChatId, targetName } = adminPendingReply[adminSendId];
          delete adminPendingReply[adminSendId];
          // Send reply to target via bot
          await axios.post(`${BOT_API()}/sendMessage`, {
            chat_id: targetChatId,
            text: `💬 Admin:\n${text}`
          }).catch(() => {});
          // Save outgoing message to DB
          await prisma.telegramMessage.create({
            data: {
              chatId: String(targetChatId),
              chatName: targetName,
              role: null,
              text: text,
              direction: 'OUT'
            }
          }).catch(() => {});
          // Confirm to admin
          await axios.post(`${BOT_API()}/sendMessage`, {
            chat_id: adminSendId,
            text: `✅ *${targetName}* ga javob yuborildi.`,
            parse_mode: 'Markdown'
          }).catch(() => {});
          return;
        }

        // Admin persistent reply keyboard — dynamic year detection from JP_SECTIONS
        const _yr = new Date().getFullYear();
        const _allJpKeys = await prisma.systemSetting.findMany({
          where: { key: { startsWith: 'JP_SECTIONS_' } }, select: { key: true, value: true }
        });
        const _jpYears = [...new Set(
          _allJpKeys.map(s => {
            const km = s.key.match(/JP_SECTIONS_\d+_\w+_(\d{4})$/);
            if (km) return parseInt(km[1]);
            try { const y = JSON.parse(s.value).year; return y ? parseInt(y) : null; } catch { return null; }
          }).filter(y => y && y >= _yr)
        )].sort();
        const _adminJpYears = _jpYears.length ? _jpYears : [_yr];
        const _jpBtnText = _adminJpYears.length > 1 ? '📋 Заявка' : `📋 Заявка ${_adminJpYears[0]}`;
        const MAIN_REPLY_KEYBOARD = JSON.stringify({
          keyboard: [
            [{ text: _jpBtnText }, { text: "📝 Изменения к Заявке" }],
            [{ text: '⏳ Waiting List' }, { text: '🚫 Rad etilgan' }],
            [{ text: '❌ Ануляция' }]
          ],
          resize_keyboard: true,
          is_persistent: true
        });

        // /start or /menu — attach persistent keyboard
        if (text === '/start' || text === '/menu' || text === '/menyu') {
          await axios.post(`${BOT_API()}/sendMessage`, {
            chat_id: adminSendId,
            text: '🤖 *Orient Insight — Admin Panel*\n\nPastdagi menyudan bo\'lim tanlang:',
            parse_mode: 'Markdown',
            reply_markup: MAIN_REPLY_KEYBOARD
          }).catch(() => {});
          return;
        }

        // 📋 Заявка — tur turi tanlash (with or without year)
        if (text.startsWith('📋 Заявка')) {
          const yearMatch = text.match(/📋 Заявка (\d{4})/);
          const pressedYear = yearMatch ? parseInt(yearMatch[1]) : null;
          if (!pressedYear) {
            // Multiple years — show inline year picker
            const yearButtons = _adminJpYears.map(y => ({ text: String(y), callback_data: `admin:zv_year:${y}` }));
            await axios.post(`${BOT_API()}/sendMessage`, {
              chat_id: adminSendId,
              text: `📋 *Заявка*\n\nQaysi yilni tanlang:`,
              parse_mode: 'Markdown',
              reply_markup: JSON.stringify({ inline_keyboard: [yearButtons] })
            }).catch(() => {});
            return;
          }
          const year = pressedYear;
          await axios.post(`${BOT_API()}/sendMessage`, {
            chat_id: adminSendId,
            text: `📋 *Заявка ${year}*\n\nQaysi tur turini tanlang:`,
            parse_mode: 'Markdown',
            reply_markup: JSON.stringify({
              inline_keyboard: [
                [{ text: `ER ${year}`, callback_data: `admin:zv:ER:${year}` }, { text: `CO ${year}`, callback_data: `admin:zv:CO:${year}` }],
                [{ text: `KAS ${year}`, callback_data: `admin:zv:KAS:${year}` }, { text: `ZA ${year}`, callback_data: `admin:zv:ZA:${year}` }]
              ]
            })
          }).catch(() => {});
          return;
        }

        // 📝 Изменения к Заявке — tour type tanlash (CONFIRMED bo'lgan)
        if (text === "📝 Изменения к Заявке") {
          await axios.post(`${BOT_API()}/sendMessage`, {
            chat_id: adminSendId,
            text: '📝 *Изменения к Заявке*\nQaysi tur turini tanlang:',
            parse_mode: 'Markdown',
            reply_markup: JSON.stringify({ inline_keyboard: [
              [{ text: 'ER', callback_data: 'admin:chg_tt:ER' }, { text: 'CO', callback_data: 'admin:chg_tt:CO' }],
              [{ text: 'KAS', callback_data: 'admin:chg_tt:KAS' }, { text: 'ZA', callback_data: 'admin:chg_tt:ZA' }]
            ]})
          }).catch(() => {});
          return;
        }

        // ⏳ Waiting List — avval Заявка yoki Изменения tanlash
        if (text === '⏳ Waiting List') {
          const _wlJpText = _adminJpYears.length > 1 ? '📋 Заявка' : `📋 Заявка ${_adminJpYears[0]}`;
          await axios.post(`${BOT_API()}/sendMessage`, {
            chat_id: adminSendId,
            text: '⏳ *Waiting List*\nQaysi bo\'limni tanlang:',
            parse_mode: 'Markdown',
            reply_markup: JSON.stringify({ inline_keyboard: [
              [{ text: _wlJpText, callback_data: 'admin:wl:jp' }],
              [{ text: '📝 Изменения к Заявке', callback_data: 'admin:wl:chg' }]
            ]})
          }).catch(() => {});
          return;
        }

        // 🚫 Rad etilgan — bo'lim tanlash (Заявка yoki Изменения)
        if (text === '🚫 Rad etilgan') {
          const _rejJpText = _adminJpYears.length > 1 ? '📋 Заявка' : `📋 Заявка ${_adminJpYears[0]}`;
          await axios.post(`${BOT_API()}/sendMessage`, {
            chat_id: adminSendId,
            text: '🚫 *Rad etilgan*\nQaysi bo\'limni tanlang:',
            parse_mode: 'Markdown',
            reply_markup: JSON.stringify({ inline_keyboard: [
              [{ text: _rejJpText, callback_data: 'admin:rej:jp' }],
              [{ text: '📝 Изменения к Заявке', callback_data: 'admin:rej:chg' }]
            ]})
          }).catch(() => {});
          return;
        }

        // ❌ Ануляция — tour type tanlash (har doim 4 ta)
        if (text === '❌ Ануляция') {
          await axios.post(`${BOT_API()}/sendMessage`, {
            chat_id: adminSendId,
            text: '❌ *Ануляция*\nQaysi tur turini tanlang:',
            parse_mode: 'Markdown',
            reply_markup: JSON.stringify({ inline_keyboard: [
              [{ text: 'ER', callback_data: 'admin:ann_tt:ER' }, { text: 'CO', callback_data: 'admin:ann_tt:CO' }],
              [{ text: 'KAS', callback_data: 'admin:ann_tt:KAS' }, { text: 'ZA', callback_data: 'admin:ann_tt:ZA' }]
            ]})
          }).catch(() => {});
          return;
        }

        // /status ER-01 — show confirmations for a specific booking
        if (text.startsWith('/status ')) {
          const bookingNum = text.replace('/status ', '').trim().toUpperCase();
          const booking = await prisma.booking.findUnique({ where: { bookingNumber: bookingNum } });

          if (!booking) {
            await axios.post(`${BOT_API()}/sendMessage`, {
              chat_id: adminSendId,
              text: `❌ Booking *${bookingNum}* topilmadi.`,
              parse_mode: 'Markdown'
            }).catch(() => {});
            return;
          }

          const confs = await prisma.telegramConfirmation.findMany({
            where: { bookingId: booking.id },
            include: { hotel: { select: { name: true, city: { select: { name: true } } } } },
            orderBy: { sentAt: 'desc' }
          });

          if (confs.length === 0) {
            await axios.post(`${BOT_API()}/sendMessage`, {
              chat_id: adminSendId,
              text: `📭 *${bookingNum}* uchun hech qanday zayavka yuborilmagan.`,
              parse_mode: 'Markdown'
            }).catch(() => {});
            return;
          }

          const statusEmoji = { PENDING: '🕐', CONFIRMED: '✅', WAITING: '⏳', REJECTED: '❌' };
          const statusLabel = { PENDING: 'Kutilmoqda', CONFIRMED: 'Tasdiqladi', WAITING: 'Waiting List', REJECTED: 'Rad qildi' };
          const lines = [`📋 *${bookingNum}*`];
          if (booking.departureDate) lines.push(`📅 Yo'lga chiqish: ${fmtDate(booking.departureDate)}`);
          lines.push('');
          confs.forEach(c => {
            const em = statusEmoji[c.status] || '?';
            const lb = statusLabel[c.status] || c.status;
            const city = c.hotel?.city?.name ? ` (${c.hotel.city.name})` : '';
            lines.push(`${em} *${c.hotel?.name || `#${c.hotelId}`}*${city}`);
            lines.push(`   ${lb}${c.confirmedBy ? ` — ${c.confirmedBy}` : ''}`);
            lines.push(`   Jo'natildi: ${fmtDate(c.sentAt)}${c.respondedAt ? `  |  Javob: ${fmtDate(c.respondedAt)}` : ''}`);
            lines.push('');
          });

          await axios.post(`${BOT_API()}/sendMessage`, {
            chat_id: adminSendId,
            text: lines.join('\n'),
            parse_mode: 'Markdown'
          }).catch(async () => {
            const plain = lines.join('\n').replace(/[*_`]/g, '');
            await axios.post(`${BOT_API()}/sendMessage`, { chat_id: adminSendId, text: plain }).catch(() => {});
          });
          return;
        }
      }
    }

    // Handle callback_query (inline keyboard button press)
    const cb = update.callback_query;
    if (!cb) return;

    const callbackQueryId = cb.id;
    const data = cb.data || '';
    const fromUser = cb.from;
    const fromDisplayName = [fromUser.first_name, fromUser.last_name].filter(Boolean).join(' ');
    const fromName = [fromDisplayName, fromUser.username ? `@${fromUser.username}` : ''].filter(Boolean).join(' ') || 'Noma\'lum';
    const fromChatId = cb.message?.chat?.id;

    // Update lastMessage for existing chats only — do NOT auto-create deleted users
    if (fromChatId) {
      const chat = cb.message.chat;
      const chats = await loadKnownChats();
      if (chats[String(chat.id)]) {
        chats[String(chat.id)].lastMessage = '[button click]';
        chats[String(chat.id)].date = new Date().toISOString();
        await saveKnownChats(chats);
      }
    }

    // ── Reply-to callback (admin "Javob berish" tugmasini bosdi) ─────────
    if (data.startsWith('reply_to:')) {
      const parts = data.split(':');
      const targetChatId = parts[1];
      const targetName = parts.slice(2).join(':') || 'Foydalanuvchi';
      const adminCbId = String(fromChatId);
      const adminEnvId = process.env.TELEGRAM_ADMIN_CHAT_ID;
      const cbChats = await loadKnownChats();
      const isAdminCb = (adminEnvId && adminCbId === String(adminEnvId)) || cbChats[adminCbId]?.role === 'admin';
      if (!isAdminCb) {
        await axios.post(`${BOT_API()}/answerCallbackQuery`, { callback_query_id: callbackQueryId, text: '⛔ Ruxsat yo\'q.' }).catch(() => {});
        return;
      }
      adminPendingReply[adminCbId] = { targetChatId, targetName };
      await axios.post(`${BOT_API()}/answerCallbackQuery`, { callback_query_id: callbackQueryId }).catch(() => {});
      await axios.post(`${BOT_API()}/sendMessage`, {
        chat_id: adminCbId,
        text: `✏️ *${targetName}* ga javob yozing:\n_(Bekor qilish uchun /cancel)_`,
        parse_mode: 'Markdown'
      }).catch(() => {});
      return;
    }

    // ── gd_schedule_ok / gd_schedule_reject — guide confirms schedule (main bot) ─
    if (data.startsWith('gd_schedule_ok:') || data.startsWith('gd_schedule_reject:')) {
      const parts = data.split(':');
      const newStatus = data.startsWith('gd_schedule_ok:') ? 'CONFIRMED' : 'REJECTED';
      const guideId   = parseInt(parts[1]);
      const year      = parseInt(parts[2]);

      await axios.post(`${BOT_API()}/answerCallbackQuery`, {
        callback_query_id: callbackQueryId,
        text: newStatus === 'CONFIRMED' ? '✅ Qabul qilindi!' : '❌ Rad etildi.',
        show_alert: false
      }).catch(() => {});

      try {
        const guide = await prisma.guide.findUnique({ where: { id: guideId }, select: { name: true } });
        const bookings = await prisma.booking.findMany({
          where: { guideId, bookingYear: year, status: { not: 'CANCELLED' } },
          select: { id: true }
        });
        for (const b of bookings) {
          await prisma.guideConfirmation.upsert({
            where: { bookingId_guideId: { bookingId: b.id, guideId } },
            create: { bookingId: b.id, guideId, status: newStatus, respondedAt: new Date(), confirmedBy: guide?.name || '' },
            update: { status: newStatus, respondedAt: new Date(), confirmedBy: guide?.name || '' }
          });
        }
        const emoji = newStatus === 'CONFIRMED' ? '✅' : '❌';
        const label = newStatus === 'CONFIRMED' ? 'Qabul qilindi' : 'Rad etildi';
        await axios.post(`${BOT_API()}/editMessageReplyMarkup`, {
          chat_id: fromChatId, message_id: cb.message?.message_id,
          reply_markup: JSON.stringify({ inline_keyboard: [[{ text: `${emoji} ${label}`, callback_data: 'noop' }]] })
        }).catch(() => {});
        const guideAdminIds = await getBotAdminIds('guide');
        for (const id of guideAdminIds) {
          await axios.post(`${GUIDE_API()}/sendMessage`, {
            chat_id: id,
            text: `${emoji} *${guide?.name || 'Gid'}* — ${year} yil jadvali: ${label.toLowerCase()} (${bookings.length} guruh)`,
            parse_mode: 'Markdown'
          }).catch(() => {});
        }
      } catch (e) { console.error('gd_schedule (main bot) error:', e.message); }
      return;
    }

    // ── Admin interactive menu callbacks ──────────────────────────────────
    if (data.startsWith('admin:')) {
      // Security: only hotel admins can use these buttons
      const hotelAdminIds = await getBotAdminIds('hotel');
      if (!hotelAdminIds.map(String).includes(String(fromChatId))) {
        await axios.post(`${BOT_API()}/answerCallbackQuery`, { callback_query_id: callbackQueryId, text: '⛔ Ruxsat yo\'q.' }).catch(() => {});
        return;
      }

      const parts = data.split(':');
      const subAction = parts[1];
      const ST = { CONFIRMED: '✅', WAITING: '⏳', REJECTED: '❌', PENDING: '🕐' };

      await axios.post(`${BOT_API()}/answerCallbackQuery`, { callback_query_id: callbackQueryId }).catch(() => {});

      // admin:zv_year:{year} — yil tanlandi, tur turi picker
      if (subAction === 'zv_year') {
        const year = parseInt(parts[2]);
        await axios.post(`${BOT_API()}/editMessageText`, {
          chat_id: fromChatId, message_id: cb.message.message_id,
          text: `📋 *Заявка ${year}*\n\nQaysi tur turini tanlang:`,
          parse_mode: 'Markdown',
          reply_markup: JSON.stringify({ inline_keyboard: [
            [{ text: `ER ${year}`, callback_data: `admin:zv:ER:${year}` }, { text: `CO ${year}`, callback_data: `admin:zv:CO:${year}` }],
            [{ text: `KAS ${year}`, callback_data: `admin:zv:KAS:${year}` }, { text: `ZA ${year}`, callback_data: `admin:zv:ZA:${year}` }]
          ]})
        }).catch(() => {});
        return;
      }

      // admin:zv:CO:{year} — CO gruppa ro'yxatini ko'rsatish
      if (subAction === 'zv') {
        const tourType = parts[2];
        const year = parts[3] ? parseInt(parts[3]) : new Date().getFullYear();
        const allJp = await prisma.systemSetting.findMany({ where: { key: { startsWith: 'JP_SECTIONS_' } } });
        const settings = allJp.filter(s => {
          try {
            const d = JSON.parse(s.value);
            if (d.tourType !== tourType) return false;
            if (d.year && parseInt(d.year) !== year) return false;
            const km = s.key.match(/_(\d{4})$/);
            if (km && parseInt(km[1]) !== year) return false;
            if (d.bulkMsgId != null) return true;
            return (d.groups || []).some(g => g.visits.some(v => v.msgId != null));
          } catch { return false; }
        });

        if (settings.length === 0) {
          await axios.post(`${BOT_API()}/editMessageText`, {
            chat_id: fromChatId, message_id: cb.message.message_id,
            text: `📋 *${tourType} ${year}*\n\n📭 Bu tur uchun hali заявка yuborilmagan.`,
            parse_mode: 'Markdown',
            reply_markup: JSON.stringify({ inline_keyboard: [[{ text: '⬅️ Orqaga', callback_data: `admin:zvback:${year}` }]] })
          }).catch(() => {});
          return;
        }

        // Unique group names from all hotels
        const groupSet = new Set();
        for (const s of settings) {
          try {
            const d = JSON.parse(s.value);
            for (const grp of (d.groups || [])) { if (grp.group) groupSet.add(grp.group); }
          } catch {}
        }
        const groups = [...groupSet].sort();

        // Build keyboard: 3 per row
        const keyboard = [];
        for (let i = 0; i < groups.length; i += 3) {
          keyboard.push(groups.slice(i, i + 3).map(g => ({ text: g, callback_data: `admin:zvg:${tourType}:${g}:${year}` })));
        }
        keyboard.push([{ text: '🔄 Yangilash', callback_data: `admin:zv:${tourType}:${year}` }, { text: '⬅️ Orqaga', callback_data: `admin:zvback:${year}` }]);

        console.log('admin:zv groups:', groups, 'settings:', settings.length);
        await axios.post(`${BOT_API()}/editMessageText`, {
          chat_id: fromChatId, message_id: cb.message.message_id,
          text: `📋 *${tourType} ${year} — Gruppalar*\n\nGruppani tanlang:`,
          parse_mode: 'Markdown',
          reply_markup: JSON.stringify({ inline_keyboard: keyboard })
        }).then(() => console.log('admin:zv editMessage OK')).catch(e => console.error('admin:zv editMessage ERR:', e.response?.data || e.message));
        return;
      }

      // admin:zvg:ER:ER-01:{year} — bitta gruppa uchun barcha hotel zaявkalari
      if (subAction === 'zvg') {
        const tourType = parts[2];
        const groupNum = parts[3];
        const year = parts[4] ? parseInt(parts[4]) : new Date().getFullYear();
        const allJp = await prisma.systemSetting.findMany({ where: { key: { startsWith: 'JP_SECTIONS_' } } });
        const settings = allJp.filter(s => {
          try {
            const d = JSON.parse(s.value);
            if (d.tourType !== tourType) return false;
            if (d.year && parseInt(d.year) !== year) return false;
            const km = s.key.match(/_(\d{4})$/);
            if (km && parseInt(km[1]) !== year) return false;
            return true;
          } catch { return false; }
        });

        const visitBlocks = [];
        for (const s of settings) {
          try {
            const d = JSON.parse(s.value);
            const grpData = (d.groups || []).find(g => g.group === groupNum);
            if (!grpData || !grpData.visits || grpData.visits.length === 0) continue;
            for (const v of grpData.visits) {
              const si = ST[v.status] || '🕐';
              const title = v.sectionLabel
                ? `${si} <b>${d.hotelName} — ${v.sectionLabel}</b>`
                : `${si} <b>${d.hotelName}</b>`;
              const by = v.confirmedBy ? `\n👤 ${v.confirmedBy}` : '';
              visitBlocks.push([
                title,
                `📅 Заезд: ${v.checkIn}`,
                `📅 Выезд: ${v.checkOut}`,
                `👥 PAX: ${v.pax}`,
                `🛏 DBL:${v.dbl||0}  |  TWN:${v.twn||0}  |  SNGL:${v.sngl||0}${by}`
              ].join('\n'));
            }
          } catch {}
        }

        const headerText = `📋 <b>ЗАЯВКА ${groupNum} — ${tourType} ${year}</b>`;
        await axios.post(`${BOT_API()}/editMessageText`, {
          chat_id: fromChatId, message_id: cb.message.message_id,
          text: visitBlocks.length > 0 ? headerText : `${headerText}\n\n<i>Ma'lumot topilmadi.</i>`,
          parse_mode: 'HTML',
          reply_markup: JSON.stringify({ inline_keyboard: [[
            { text: '🔄 Yangilash', callback_data: `admin:zvg:${tourType}:${groupNum}:${year}` },
            { text: '⬅️ Orqaga', callback_data: `admin:zv:${tourType}:${year}` }
          ]] })
        }).catch(() => {});

        // Send blocks as chunks
        let chunk = [], chunkLen = 0;
        for (const block of visitBlocks) {
          if (chunkLen + block.length > 3500 && chunk.length > 0) {
            await axios.post(`${BOT_API()}/sendMessage`, {
              chat_id: fromChatId, text: chunk.join('\n\n'), parse_mode: 'HTML'
            }).catch(() => {});
            chunk = []; chunkLen = 0;
          }
          chunk.push(block); chunkLen += block.length;
        }
        if (chunk.length > 0) {
          await axios.post(`${BOT_API()}/sendMessage`, {
            chat_id: fromChatId, text: chunk.join('\n\n'), parse_mode: 'HTML'
          }).catch(() => {});
        }
        return;
      }

      // admin:zvh:CO:16:{year} — hotel 16ning CO visit holati (batafsil format, split by chunks)
      if (subAction === 'zvh') {
        const tourType = parts[2];
        const hotelId = parseInt(parts[3]);
        const year = parts[4] ? parseInt(parts[4]) : new Date().getFullYear();
        // Try year-specific key first, then old format
        const setting = await prisma.systemSetting.findFirst({ where: { key: `JP_SECTIONS_${hotelId}_${tourType}_${year}` } })
          || await prisma.systemSetting.findFirst({ where: { key: `JP_SECTIONS_${hotelId}_${tourType}` } });

        if (!setting) {
          await axios.post(`${BOT_API()}/answerCallbackQuery`, { callback_query_id: callbackQueryId, text: "Ma'lumot topilmadi.", show_alert: true }).catch(() => {});
          return;
        }
        const d = JSON.parse(setting.value);

        // Har bir visit uchun batafsil blok yasash (HTML mode — avoids Markdown _ issues)
        const visitBlocks = [];
        for (const grp of (d.groups || [])) {
          for (const v of grp.visits) {
            const si = ST[v.status] || '🕐';
            const title = v.sectionLabel
              ? `${si} <b>ЗАЯВКА ${grp.group} — ${v.sectionLabel}</b>`
              : `${si} <b>ЗАЯВКА ${grp.group}</b>`;
            const by = v.confirmedBy ? `\n👤 ${v.confirmedBy}` : '';
            visitBlocks.push([
              title,
              `📅 Заезд: ${v.checkIn}`,
              `📅 Выезд: ${v.checkOut}`,
              `👥 PAX: ${v.pax}`,
              `🛏 DBL:${v.dbl||0}  |  TWN:${v.twn||0}  |  SNGL:${v.sngl||0}${by}`
            ].join('\n'));
          }
        }

        // Header xabar (editMessageText bilan — asl xabarni o'zgartiradi)
        const headerText = `📋 <b>${tourType} ${year} — ${d.hotelName}</b>`;
        await axios.post(`${BOT_API()}/editMessageText`, {
          chat_id: fromChatId, message_id: cb.message.message_id,
          text: headerText, parse_mode: 'HTML',
          reply_markup: JSON.stringify({ inline_keyboard: [[
            { text: '🔄 Yangilash', callback_data: `admin:zvh:${tourType}:${hotelId}:${year}` },
            { text: '⬅️ Orqaga', callback_data: `admin:zv:${tourType}:${year}` }
          ]] })
        }).catch(() => {});

        // Visit bloklarini chunk qilib yuborish (har chunk ~3500 belgi)
        let chunk = [];
        let chunkLen = 0;
        for (let i = 0; i < visitBlocks.length; i++) {
          const block = visitBlocks[i];
          if (chunkLen + block.length > 3500 && chunk.length > 0) {
            await axios.post(`${BOT_API()}/sendMessage`, {
              chat_id: fromChatId, text: chunk.join('\n\n'), parse_mode: 'HTML'
            }).catch(() => {});
            chunk = [];
            chunkLen = 0;
          }
          chunk.push(block);
          chunkLen += block.length;
        }
        if (chunk.length > 0) {
          await axios.post(`${BOT_API()}/sendMessage`, {
            chat_id: fromChatId, text: chunk.join('\n\n'), parse_mode: 'HTML'
          }).catch(() => {});
        }
        return;
      }

      // admin:zvback:{year} — tur turi tanlash sahifasiga qaytish
      if (subAction === 'zvback') {
        const year = parts[2] ? parseInt(parts[2]) : new Date().getFullYear();
        await axios.post(`${BOT_API()}/editMessageText`, {
          chat_id: fromChatId, message_id: cb.message.message_id,
          text: `📋 *Заявка ${year}*\n\nQaysi tur turini tanlang:`,
          parse_mode: 'Markdown',
          reply_markup: JSON.stringify({ inline_keyboard: [
            [{ text: `ER ${year}`, callback_data: `admin:zv:ER:${year}` }, { text: `CO ${year}`, callback_data: `admin:zv:CO:${year}` }],
            [{ text: `KAS ${year}`, callback_data: `admin:zv:KAS:${year}` }, { text: `ZA ${year}`, callback_data: `admin:zv:ZA:${year}` }]
          ] })
        }).catch(() => {});
        return;
      }

      // admin:chg_tt:ER — admin Изменения к Заявке tur tanlash → gruppa ro'yxati
      if (subAction === 'chg_tt') {
        const tourType = parts[2];
        await axios.post(`${BOT_API()}/answerCallbackQuery`, { callback_query_id: callbackQueryId }).catch(() => {});
        const year = new Date().getFullYear();
        // Unique booking numbers for this tourType from TelegramConfirmation (CHANGE type only)
        const allConfs = await prisma.telegramConfirmation.findMany({
          where: { booking: { tourType: { code: tourType } }, type: 'CHANGE' },
          include: { booking: { select: { bookingNumber: true, bookingYear: true } } },
          orderBy: { sentAt: 'asc' }
        });
        const groupSet = new Set();
        for (const c of allConfs) {
          if (c.booking?.bookingNumber && (!c.booking.bookingYear || c.booking.bookingYear === year)) {
            groupSet.add(c.booking.bookingNumber);
          }
        }
        const groups = [...groupSet].sort();
        if (groups.length === 0) {
          await axios.post(`${BOT_API()}/sendMessage`, {
            chat_id: fromChatId,
            text: `📝 *${tourType} ${year}*\n\n📭 Hali zaявka yuborilmagan.`,
            parse_mode: 'Markdown',
            reply_markup: JSON.stringify({ keyboard: [[{ text: '📋 Заявка' }, { text: '📝 Изменения к Заявке' }],[{ text: '⏳ Waiting List' }, { text: '🚫 Rad etilgan' }],[{ text: '❌ Ануляция' }]], resize_keyboard: true, is_persistent: true })
          }).catch(() => {});
          return;
        }
        const keyboard = [];
        for (let i = 0; i < groups.length; i += 3) {
          keyboard.push(groups.slice(i, i + 3).map(g => ({ text: g, callback_data: `admin:chg_grp:${tourType}:${g}` })));
        }
        await axios.post(`${BOT_API()}/sendMessage`, {
          chat_id: fromChatId,
          text: `📝 *${tourType} ${year} — Изменения к Заявке*\n\nGruppani tanlang:`,
          parse_mode: 'Markdown',
          reply_markup: JSON.stringify({ inline_keyboard: keyboard })
        }).catch(() => {});
        return;
      }

      // admin:chg_grp:ER:ER-01 — bitta gruppa uchun Изменения к Заявке
      if (subAction === 'chg_grp') {
        const tourType = parts[2];
        const bookingNumber = parts[3];
        await axios.post(`${BOT_API()}/answerCallbackQuery`, { callback_query_id: callbackQueryId }).catch(() => {});
        const ADMIN_KB = JSON.stringify({
          keyboard: [
            [{ text: '📋 Заявка' }, { text: '📝 Изменения к Заявке' }],
            [{ text: '⏳ Waiting List' }, { text: '🚫 Rad etilgan' }],
            [{ text: '❌ Ануляция' }]
          ],
          resize_keyboard: true, is_persistent: true
        });
        await sendAdminChangesForBooking(fromChatId, tourType, bookingNumber, ADMIN_KB);
        return;
      }

      // admin:wl:jp — Waiting List > Заявка 2026 → tour type tanlash
      if (subAction === 'wl' && parts[2] === 'jp' && !parts[3]) {
        await axios.post(`${BOT_API()}/answerCallbackQuery`, { callback_query_id: callbackQueryId }).catch(() => {});
        const yr = new Date().getFullYear();
        await axios.post(`${BOT_API()}/editMessageText`, {
          chat_id: fromChatId, message_id: cb.message.message_id,
          text: `⏳ *Waiting List — Заявка ${yr}*\nQaysi tur turini tanlang:`,
          parse_mode: 'Markdown',
          reply_markup: JSON.stringify({ inline_keyboard: [
            [{ text: `ER ${yr}`, callback_data: 'admin:wl:jp:ER' }, { text: `CO ${yr}`, callback_data: 'admin:wl:jp:CO' }],
            [{ text: `KAS ${yr}`, callback_data: 'admin:wl:jp:KAS' }, { text: `ZA ${yr}`, callback_data: 'admin:wl:jp:ZA' }]
          ]})
        }).catch(() => {});
        return;
      }

      // admin:wl:chg — Waiting List > Изменения → tour type tanlash
      if (subAction === 'wl' && parts[2] === 'chg' && !parts[3]) {
        await axios.post(`${BOT_API()}/answerCallbackQuery`, { callback_query_id: callbackQueryId }).catch(() => {});
        await axios.post(`${BOT_API()}/editMessageText`, {
          chat_id: fromChatId, message_id: cb.message.message_id,
          text: '⏳ *Waiting List — Изменения к Заявке*\nQaysi tur turini tanlang:',
          parse_mode: 'Markdown',
          reply_markup: JSON.stringify({ inline_keyboard: [
            [{ text: 'ER', callback_data: 'admin:wl:chg:ER' }, { text: 'CO', callback_data: 'admin:wl:chg:CO' }],
            [{ text: 'KAS', callback_data: 'admin:wl:chg:KAS' }, { text: 'ZA', callback_data: 'admin:wl:chg:ZA' }]
          ]})
        }).catch(() => {});
        return;
      }

      // admin:wl:jp:ER — JP_SECTIONS WAITING for tourType
      if (subAction === 'wl' && parts[2] === 'jp' && parts[3]) {
        await axios.post(`${BOT_API()}/answerCallbackQuery`, { callback_query_id: callbackQueryId }).catch(() => {});
        await sendAdminWlJp(fromChatId, parts[3]);
        return;
      }

      // admin:wl:chg:ER — TelegramConfirmation WAITING for tourType
      if (subAction === 'wl' && parts[2] === 'chg' && parts[3]) {
        await axios.post(`${BOT_API()}/answerCallbackQuery`, { callback_query_id: callbackQueryId }).catch(() => {});
        await sendAdminWlChg(fromChatId, parts[3]);
        return;
      }

      // admin:ann_tt:ER — admin Ануляция tur tanlash → group buttons
      if (subAction === 'ann_tt') {
        const tourType = parts[2];
        await axios.post(`${BOT_API()}/answerCallbackQuery`, { callback_query_id: callbackQueryId }).catch(() => {});
        const ADMIN_KB = JSON.stringify({
          keyboard: [
            [{ text: '📋 Заявка' }, { text: '📝 Изменения к Заявке' }],
            [{ text: '⏳ Waiting List' }, { text: '🚫 Rad etilgan' }],
            [{ text: '❌ Ануляция' }]
          ],
          resize_keyboard: true, is_persistent: true
        });
        await sendAdminAnnulmentGroups(fromChatId, tourType, ADMIN_KB);
        return;
      }

      // admin:ann_grp:ER:ER-01 — admin Ануляция group tanlash → show booking details
      if (subAction === 'ann_grp') {
        const tourType = parts[2];
        const bookingNumber = parts[3];
        await axios.post(`${BOT_API()}/answerCallbackQuery`, { callback_query_id: callbackQueryId }).catch(() => {});
        await sendAdminAnnulmentForBooking(fromChatId, tourType, bookingNumber);
        return;
      }

      // admin:rej:jp — Rad etilgan > Заявка 2026 → tour type tanlash
      if (subAction === 'rej' && parts[2] === 'jp') {
        await axios.post(`${BOT_API()}\answerCallbackQuery`, { callback_query_id: callbackQueryId }).catch(() => {});
        await axios.post(`${BOT_API()}/editMessageText`, {
          chat_id: fromChatId, message_id: cb.message.message_id,
          text: `🚫 *Rad etilgan — Заявка ${new Date().getFullYear()}*\nQaysi tur turini tanlang:`,
          parse_mode: 'Markdown',
          reply_markup: JSON.stringify({ inline_keyboard: [
            [{ text: 'ER', callback_data: 'admin:rej_jp_tt:ER' }, { text: 'CO', callback_data: 'admin:rej_jp_tt:CO' }],
            [{ text: 'KAS', callback_data: 'admin:rej_jp_tt:KAS' }, { text: 'ZA', callback_data: 'admin:rej_jp_tt:ZA' }]
          ]})
        }).catch(() => {});
        return;
      }

      // admin:rej:chg — Rad etilgan > Изменения → tour type tanlash
      if (subAction === 'rej' && parts[2] === 'chg') {
        await axios.post(`${BOT_API()}\answerCallbackQuery`, { callback_query_id: callbackQueryId }).catch(() => {});
        await axios.post(`${BOT_API()}/editMessageText`, {
          chat_id: fromChatId, message_id: cb.message.message_id,
          text: '🚫 *Rad etilgan — Изменения к Заявке*\nQaysi tur turini tanlang:',
          parse_mode: 'Markdown',
          reply_markup: JSON.stringify({ inline_keyboard: [
            [{ text: 'ER', callback_data: 'admin:rej_chg_tt:ER' }, { text: 'CO', callback_data: 'admin:rej_chg_tt:CO' }],
            [{ text: 'KAS', callback_data: 'admin:rej_chg_tt:KAS' }, { text: 'ZA', callback_data: 'admin:rej_chg_tt:ZA' }]
          ]})
        }).catch(() => {});
        return;
      }

      // admin:rej_jp_tt:ER — Заявка 2026 rejected → show hotel buttons
      if (subAction === 'rej_jp_tt') {
        const tourType = parts[2];
        await axios.post(`${BOT_API()}\answerCallbackQuery`, { callback_query_id: callbackQueryId }).catch(() => {});
        await sendAdminRejJpHotels(fromChatId, tourType);
        return;
      }

      // admin:rej_chg_tt:ER — Изменения rejected → show hotel buttons
      if (subAction === 'rej_chg_tt') {
        const tourType = parts[2];
        await axios.post(`${BOT_API()}\answerCallbackQuery`, { callback_query_id: callbackQueryId }).catch(() => {});
        await sendAdminRejChgHotels(fromChatId, tourType);
        return;
      }

      // admin:rej_jp_h:ER:16 — show JP rejected visits for hotel
      if (subAction === 'rej_jp_h') {
        const tourType = parts[2];
        const hotelId = parseInt(parts[3]);
        await axios.post(`${BOT_API()}\answerCallbackQuery`, { callback_query_id: callbackQueryId }).catch(() => {});
        await sendAdminRejJpForHotel(fromChatId, tourType, hotelId);
        return;
      }

      // admin:rej_chg_h:ER:16 — show CHG rejected confirmations for hotel
      if (subAction === 'rej_chg_h') {
        const tourType = parts[2];
        const hotelId = parseInt(parts[3]);
        await axios.post(`${BOT_API()}\answerCallbackQuery`, { callback_query_id: callbackQueryId }).catch(() => {});
        await sendAdminRejChgForHotel(fromChatId, tourType, hotelId);
        return;
      }

      return; // Don't continue to hotel confirm/reject handler
    }
    // ── End admin menu callbacks ───────────────────────────────────────────

    // ── chg_tt: — hotel Izmeneniye tour type → show group buttons ──────────
    if (data.startsWith('chg_tt:')) {
      const parts = data.split(':');
      const tourType = parts[1];
      const hotelId  = parseInt(parts[2]);
      await axios.post(`${BOT_API()}/answerCallbackQuery`, { callback_query_id: callbackQueryId }).catch(() => {});
      const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });
      if (!hotel) return;
      const year = new Date().getFullYear();
      const confs = await prisma.telegramConfirmation.findMany({
        where: { hotelId, type: 'CHANGE', booking: { tourType: { code: tourType } } },
        include: { booking: { select: { bookingNumber: true, bookingYear: true } } },
        orderBy: { sentAt: 'asc' }
      });
      const groupSet = new Set();
      for (const c of confs) {
        if (c.booking?.bookingNumber && (!c.booking.bookingYear || c.booking.bookingYear === year)) {
          groupSet.add(c.booking.bookingNumber);
        }
      }
      const groups = [...groupSet].sort();
      if (!groups.length) {
        await axios.post(`${BOT_API()}/sendMessage`, { chat_id: fromChatId, text: `📝 ${tourType} ${year} uchun o'zgarish yo'q.` }).catch(() => {});
        return;
      }
      const keyboard = [];
      for (let i = 0; i < groups.length; i += 3) {
        keyboard.push(groups.slice(i, i + 3).map(g => ({ text: g, callback_data: `chg_grp:${tourType}:${hotelId}:${g}` })));
      }
      await axios.post(`${BOT_API()}/sendMessage`, {
        chat_id: fromChatId,
        text: `📝 *${tourType} ${year} — Изменения к Заявке*\n\nGruppani tanlang:`,
        parse_mode: 'Markdown',
        reply_markup: JSON.stringify({ inline_keyboard: keyboard })
      }).catch(() => {});
      return;
    }
    // ── chg_grp: — hotel Izmeneniye group selection → show details ──────────
    if (data.startsWith('chg_grp:')) {
      const parts = data.split(':');
      const tourType = parts[1];
      const hotelId  = parseInt(parts[2]);
      const bookingNumber = parts[3];
      await axios.post(`${BOT_API()}/answerCallbackQuery`, { callback_query_id: callbackQueryId }).catch(() => {});
      const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });
      if (!hotel) return;
      await sendHotelChangesForBooking(fromChatId, hotel, tourType, bookingNumber);
      return;
    }
    // ── End chg_tt / chg_grp ──────────────────────────────────────────────

    // ── hwl_jp: — hotel Waiting List > Заявка callbacks ───────────────────
    if (data.startsWith('hwl_jp:')) {
      const parts = data.split(':');
      const hotelId = parseInt(parts[1]);
      await axios.post(`${BOT_API()}/answerCallbackQuery`, { callback_query_id: callbackQueryId }).catch(() => {});
      const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });
      if (!hotel) return;

      if (parts.length >= 4) {
        // hwl_jp:{hotelId}:{year}:{tourType} — send WL for specific year+tourType
        await sendHotelWlJp(fromChatId, hotel, parts[3], parseInt(parts[2]));

      } else if (parts.length === 3 && parseInt(parts[2]) > 2000) {
        // hwl_jp:{hotelId}:{year} — show tourType picker for that year
        const year = parseInt(parts[2]);
        const settings = await findJpSectionsByChatId(fromChatId);
        const ORDER = ['ER', 'CO', 'KAS', 'ZA'];
        const jpTourTypes = [...new Set(
          settings.map(s => {
            try {
              const d = JSON.parse(s.value);
              if (parseInt(d.year) !== year) return null;
              const hasWaiting = (d.groups || []).some(g => (g.visits || []).some(v => v.status === 'WAITING'));
              return hasWaiting ? d.tourType : null;
            } catch { return null; }
          }).filter(Boolean)
        )];
        const sorted = ORDER.filter(t => jpTourTypes.includes(t));
        if (!sorted.length) {
          await axios.post(`${BOT_API()}/sendMessage`, { chat_id: fromChatId, text: `⏳ ${year} yil uchun Waiting List bo'sh.` }).catch(() => {});
          return;
        }
        const rows = [];
        for (let i = 0; i < sorted.length; i += 2) {
          rows.push(sorted.slice(i, i + 2).map(t => ({ text: t, callback_data: `hwl_jp:${hotel.id}:${year}:${t}` })));
        }
        await axios.post(`${BOT_API()}/sendMessage`, {
          chat_id: fromChatId,
          text: `📋 *Заявка ${year} — Waiting List*\nQaysi tur turini tanlang:`,
          parse_mode: 'Markdown',
          reply_markup: JSON.stringify({ inline_keyboard: rows })
        }).catch(() => {});

      } else if (parts.length === 3) {
        // hwl_jp:{hotelId}:{tourType} — backward compat (all years)
        await sendHotelWlJp(fromChatId, hotel, parts[2]);
      }
      return;
    }
    // ── End hwl_jp ─────────────────────────────────────────────────────────

    // ── hwl_chg: — hotel Waiting List > Изменения callbacks ────────────────
    if (data.startsWith('hwl_chg:')) {
      const parts = data.split(':');
      const hotelId = parseInt(parts[1]);
      await axios.post(`${BOT_API()}/answerCallbackQuery`, { callback_query_id: callbackQueryId }).catch(() => {});
      const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });
      if (!hotel) return;
      if (parts.length >= 3) {
        // hwl_chg:{hotelId}:{tourType} — send WL Chg for selected tour type
        await sendHotelWlChg(fromChatId, hotel, parts[2]);
      } else {
        // hwl_chg:{hotelId} — show tour type selection (filter by hotel's TelegramConfirmation WAITING)
        const wlConfs = await prisma.telegramConfirmation.findMany({
          where: { hotelId: hotel.id, status: 'WAITING' },
          include: { booking: { select: { tourType: { select: { code: true } } } } }
        });
        const ORDER = ['ER', 'CO', 'KAS', 'ZA'];
        const chgTourTypes = [...new Set(wlConfs.map(c => c.booking?.tourType?.code).filter(Boolean))];
        const sorted = ORDER.filter(t => chgTourTypes.includes(t));
        if (sorted.length === 0) {
          await axios.post(`${BOT_API()}/sendMessage`, { chat_id: fromChatId, text: '⏳ Waiting List bo\'sh.' }).catch(() => {});
          return;
        }
        const rows = [];
        for (let i = 0; i < sorted.length; i += 2) {
          rows.push(sorted.slice(i, i + 2).map(t => ({ text: t, callback_data: `hwl_chg:${hotel.id}:${t}` })));
        }
        await axios.post(`${BOT_API()}/sendMessage`, {
          chat_id: fromChatId,
          text: '📝 *Изменения — Waiting List*\nQaysi tur turini tanlang:',
          parse_mode: 'Markdown',
          reply_markup: JSON.stringify({ inline_keyboard: rows })
        }).catch(() => {});
      }
      return;
    }
    // ── End hwl_chg ────────────────────────────────────────────────────────

    // ── hann: — hotel Ануляция tour type → show group buttons ────────────
    if (data.startsWith('hann:') && !data.startsWith('hann_grp:')) {
      const parts = data.split(':');
      const hotelId = parseInt(parts[1]);
      const tourType = parts[2];
      await axios.post(`${BOT_API()}/answerCallbackQuery`, { callback_query_id: callbackQueryId }).catch(() => {});
      const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });
      if (!hotel || !tourType) return;
      const year = new Date().getFullYear();
      const confs = await prisma.telegramConfirmation.findMany({
        where: { hotelId, type: 'ANNULMENT', booking: { tourType: { code: tourType } } },
        include: { booking: { select: { bookingNumber: true, bookingYear: true } } },
        orderBy: { sentAt: 'asc' }
      });
      const groupSet = new Set();
      for (const c of confs) {
        if (c.booking?.bookingNumber && (!c.booking.bookingYear || c.booking.bookingYear === year)) {
          groupSet.add(c.booking.bookingNumber);
        }
      }
      const groups = [...groupSet].sort();
      if (!groups.length) {
        await axios.post(`${BOT_API()}/sendMessage`, { chat_id: fromChatId, text: `❌ ${tourType} ${year} uchun Аннуляций пока нет.` }).catch(() => {});
        return;
      }
      const keyboard = [];
      for (let i = 0; i < groups.length; i += 3) {
        keyboard.push(groups.slice(i, i + 3).map(g => ({ text: g, callback_data: `hann_grp:${hotelId}:${tourType}:${g}` })));
      }
      await axios.post(`${BOT_API()}/sendMessage`, {
        chat_id: fromChatId,
        text: `❌ *${tourType} ${year} — Ануляция*\n\nGruppani tanlang:`,
        parse_mode: 'Markdown',
        reply_markup: JSON.stringify({ inline_keyboard: keyboard })
      }).catch(() => {});
      return;
    }
    // ── hann_grp: — hotel Ануляция group → show details ──────────────────
    if (data.startsWith('hann_grp:')) {
      const parts = data.split(':');
      const hotelId = parseInt(parts[1]);
      const tourType = parts[2];
      const bookingNumber = parts[3];
      await axios.post(`${BOT_API()}/answerCallbackQuery`, { callback_query_id: callbackQueryId }).catch(() => {});
      const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });
      if (!hotel) return;
      await sendHotelAnnulmentForBooking(fromChatId, hotel, tourType, bookingNumber);
      return;
    }
    // ── End hann / hann_grp ────────────────────────────────────────────────

    // ── Meal (restoran) callbacks ──────────────────────────────────────────
    if (data.startsWith('meal_confirm:') || data.startsWith('meal_reject:')) {
      const parts = data.split(':');
      const confId    = parseInt(parts[1]);
      const isConfirm = data.startsWith('meal_confirm:');
      const emoji     = isConfirm ? '✅' : '❌';

      await axios.post(`${BOT_API()}/answerCallbackQuery`, {
        callback_query_id: callbackQueryId,
        text: isConfirm ? '✅ Tasdiqlandi! Rahmat.' : '❌ Rad qilindi.',
        show_alert: false
      }).catch(() => {});

      // Edit original message — remove buttons, show status
      if (cb.message?.message_id && fromChatId) {
        const statusLine = isConfirm
          ? `\n\n✅ ${mdSafe(fromName)} tomonidan tasdiqlandi`
          : `\n\n❌ ${mdSafe(fromName)} tomonidan rad qilindi`;
        const original = cb.message.text || '';
        await axios.post(`${BOT_API()}/editMessageText`, {
          chat_id: fromChatId,
          message_id: cb.message.message_id,
          text: original + statusLine,
          parse_mode: 'Markdown',
          reply_markup: JSON.stringify({ inline_keyboard: [] })
        }).catch(() => {});
      }

      // Update MealConfirmation
      let mealConf = null;
      try {
        mealConf = await prisma.mealConfirmation.update({
          where: { id: confId },
          data: {
            status: isConfirm ? 'CONFIRMED' : 'REJECTED',
            confirmedBy: fromName,
            respondedAt: new Date()
          },
          include: {
            booking: { select: { bookingNumber: true, arrivalDate: true, endDate: true, guide: { select: { name: true, phone: true } } } }
          }
        });
      } catch (e) {
        console.warn('MealConfirmation update warn:', e.message);
      }

      // Notify admin
      const restaurantAdminIds = await getBotAdminIds('restaurant');
      if (restaurantAdminIds.length && mealConf) {
        const { booking, restaurantName, city, mealDate, pax } = mealConf;
        const tzNow = new Date(Date.now() + 5 * 60 * 60 * 1000); // UTC+5 Tashkent
        const timeStr = `${String(tzNow.getUTCHours()).padStart(2,'0')}:${String(tzNow.getUTCMinutes()).padStart(2,'0')}`;
        const adminMsg = [
          `${emoji} *${restaurantName}*`,
          `📋 ${booking?.bookingNumber || `#${mealConf.bookingId}`}`,
          city       ? `🏙 Shahar: *${city}*`    : null,
          mealDate   ? `📅 Sana: *${mealDate}*`  : null,
          pax        ? `👥 PAX: *${pax}* kishi`  : null,
          booking?.guide?.name ? `🧭 Gid: *${booking.guide.name}*${booking.guide.phone ? `  ${booking.guide.phone}` : ''}` : null,
          `👤 ${isConfirm ? 'TASDIQLADI' : 'RAD ETDI'}: ${mdSafe(fromName)}`,
          `🕐 ${fmtDateUtil(new Date())} ${timeStr}`
        ].filter(Boolean).join('\n');
        for (const id of restaurantAdminIds) {
          await axios.post(`${RESTAURANT_API()}/sendMessage`, {
            chat_id: id, text: adminMsg, parse_mode: 'Markdown'
          }).catch(e => console.warn('meal admin notify err:', e.response?.data || e.message));
        }
      }

      return;
    }
    // ── End meal callbacks ──────────────────────────────────────────────────

    // ── Transport: approver callbacks (tr_approve / tr_decline) ───────────
    if (data.startsWith('tr_approve:') || data.startsWith('tr_decline:')) {
      const parts = data.split(':');
      const trAction   = parts[0]; // tr_approve | tr_decline
      const trBookingId = parseInt(parts[1]);
      const trProvider  = parts[2]; // sevil | xayrulla | nosir
      const isApprove   = trAction === 'tr_approve';
      const providerLabel = PROVIDER_LABELS[trProvider] || trProvider;

      // Find pending confirmation
      const confirmation = await prisma.transportConfirmation.findFirst({
        where: { bookingId: trBookingId, provider: trProvider, status: 'PENDING_APPROVAL' },
        include: {
          booking: { select: { bookingNumber: true, arrivalDate: true, endDate: true, pax: true, guide: { select: { name: true, phone: true } } } }
        }
      });

      if (!confirmation) {
        await axios.post(`${BOT_API()}/answerCallbackQuery`, {
          callback_query_id: callbackQueryId,
          text: '⚠️ Allaqachon ishlov berilgan yoki topilmadi.',
          show_alert: true
        }).catch(() => {});
        return;
      }

      await axios.post(`${BOT_API()}/answerCallbackQuery`, {
        callback_query_id: callbackQueryId,
        text: isApprove ? `✅ ${providerLabel} ga yuborilmoqda...` : '❌ Rad qilindi.',
        show_alert: false
      }).catch(() => {});

      if (isApprove) {
        // Get provider's chat ID
        const providerChatId = await getProviderChatId(trProvider);
        if (!providerChatId) {
          await axios.post(`${BOT_API()}/answerCallbackQuery`, {
            callback_query_id: callbackQueryId,
            text: `❌ ${providerLabel} uchun chat ID topilmadi!`,
            show_alert: true
          }).catch(() => {});
          return;
        }

        // Re-use Telegram file_id from the approver's document message
        const fileId = cb.message?.document?.file_id;
        if (!fileId) {
          console.error('tr_approve: no document file_id in callback message');
          return;
        }

        const booking = confirmation.booking;
        const providerCaption = [
          `🚌 *Marshrut varaqasi*`,
          `📋 Booking: *${booking.bookingNumber}*`,
          `🚗 Transport: *${providerLabel}*`,
          booking.pax         ? `👥 PAX: *${booking.pax}* kishi`                      : null,
          booking.arrivalDate ? `📅 Boshlanishi: ${fmtDateUtil(booking.arrivalDate)}`  : null,
          booking.endDate     ? `🏁 Tugashi: ${fmtDateUtil(booking.endDate)}`          : null,
          booking.guide?.name ? `🧭 Gid: *${booking.guide.name}*${booking.guide.phone ? `  ${booking.guide.phone}` : ''}` : null,
        ].filter(Boolean).join('\n');

        // Send to provider using Telegram file_id (no re-upload needed)
        await axios.post(`${BOT_API()}/sendDocument`, {
          chat_id: providerChatId,
          document: fileId,
          caption: providerCaption,
          parse_mode: 'Markdown',
          reply_markup: JSON.stringify({
            inline_keyboard: [[
              { text: '✅ Tasdiqlash', callback_data: `tr_confirm:${trBookingId}:${trProvider}` },
              { text: '❌ Rad qilish', callback_data: `tr_reject:${trBookingId}:${trProvider}` }
            ]]
          })
        }).catch(err => console.error('tr_approve sendDocument error:', err.response?.data || err.message));

        // Update confirmation: APPROVED — store approver name in approvedBy
        await prisma.transportConfirmation.update({
          where: { id: confirmation.id },
          data: { status: 'APPROVED', approvedBy: fromName, respondedAt: new Date() }
        });

        // Edit approver message: remove buttons, show result
        if (cb.message?.message_id && fromChatId) {
          const originalCaption = cb.message.caption || '';
          await axios.post(`${BOT_API()}/editMessageCaption`, {
            chat_id: fromChatId,
            message_id: cb.message.message_id,
            caption: originalCaption + `\n\n✅ ${mdSafe(fromName)} tasdiqladi — ${providerLabel} ga yuborildi`,
            parse_mode: 'Markdown',
            reply_markup: JSON.stringify({ inline_keyboard: [] })
          }).catch(() => {});
        }

      } else {
        // Declined by approver
        await prisma.transportConfirmation.update({
          where: { id: confirmation.id },
          data: { status: 'REJECTED_BY_APPROVER', approvedBy: fromName, respondedAt: new Date() }
        });

        // Edit approver message
        if (cb.message?.message_id && fromChatId) {
          const originalCaption = cb.message.caption || '';
          await axios.post(`${BOT_API()}/editMessageCaption`, {
            chat_id: fromChatId,
            message_id: cb.message.message_id,
            caption: originalCaption + `\n\n❌ ${mdSafe(fromName)} tomonidan rad qilindi`,
            parse_mode: 'Markdown',
            reply_markup: JSON.stringify({ inline_keyboard: [] })
          }).catch(() => {});
        }

        // Notify transport admins
        const trDeclineAdminIds = await getBotAdminIds('transport');
        if (trDeclineAdminIds.length) {
          const booking = confirmation.booking;
          const adminMsg = [
            `❌ *${providerLabel}* uchun marshrut varaqasi rad etildi`,
            `📋 ${booking?.bookingNumber || `#${trBookingId}`}`,
            booking?.arrivalDate ? `📅 Boshlanishi: ${fmtDateUtil(booking.arrivalDate)}` : null,
            booking?.endDate     ? `🏁 Tugashi: ${fmtDateUtil(booking.endDate)}`         : null,
            `👤 RAD ETDI: ${mdSafe(fromName)}`,
          ].filter(Boolean).join('\n');
          for (const id of trDeclineAdminIds) {
            await axios.post(`${TRANSPORT_API()}/sendMessage`, {
              chat_id: id, text: adminMsg, parse_mode: 'Markdown'
            }).catch(() => {});
          }
        }
      }

      return;
    }
    // ── End approver callbacks ──────────────────────────────────────────────

    // ── Transport (marshrut varaqasi) callbacks ────────────────────────────
    if (data.startsWith('tr_confirm:') || data.startsWith('tr_reject:')) {
      console.log('[WEBHOOK/tr_confirm] data:', data, '| from:', fromName);
      const parts = data.split(':');
      const trAction = parts[0]; // tr_confirm | tr_reject
      const trBookingId = parseInt(parts[1]);
      const trProvider = parts[2]; // sevil | xayrulla | nosir

      const isConfirm = trAction === 'tr_confirm';
      const answerText = isConfirm ? '✅ Tasdiqlandi! Rahmat.' : '❌ Rad qilindi.';
      const emoji = isConfirm ? '✅' : '❌';

      await axios.post(`${BOT_API()}/answerCallbackQuery`, {
        callback_query_id: callbackQueryId,
        text: answerText,
        show_alert: false
      }).catch(() => {});

      // Edit caption to show status + remove buttons (document message uses editMessageCaption)
      if (cb.message?.message_id && fromChatId) {
        const statusLine = isConfirm
          ? `\n\n✅ ${mdSafe(fromName)} tomonidan tasdiqlandi`
          : `\n\n❌ ${mdSafe(fromName)} tomonidan rad qilindi`;
        const originalCaption = cb.message.caption || '';
        await axios.post(`${BOT_API()}/editMessageCaption`, {
          chat_id: fromChatId,
          message_id: cb.message.message_id,
          caption: originalCaption + statusLine,
          parse_mode: 'Markdown',
          reply_markup: JSON.stringify({ inline_keyboard: [] })
        }).catch(() => {});
      }

      // Fetch confirmation to get approvedBy (tekshirdi) before updating
      let trApprovedBy = null;
      try {
        const existing = await prisma.transportConfirmation.findFirst({
          where: { bookingId: trBookingId, provider: trProvider, status: { in: ['PENDING', 'APPROVED'] } },
          select: { approvedBy: true }
        });
        trApprovedBy = existing?.approvedBy || null;
      } catch (e) { /* ignore */ }

      // Update TransportConfirmation (handles both hammasi PENDING and 2-stage APPROVED)
      try {
        await prisma.transportConfirmation.updateMany({
          where: { bookingId: trBookingId, provider: trProvider, status: { in: ['PENDING', 'APPROVED'] } },
          data: {
            status: isConfirm ? 'CONFIRMED' : 'REJECTED',
            confirmedBy: fromName,
            respondedAt: new Date()
          }
        });
      } catch (e) {
        console.warn('TransportConfirmation update warn:', e.message);
      }

      // Notify transport admins
      const trAdminIds = await getBotAdminIds('transport');
      if (trAdminIds.length) {
        const booking = await prisma.booking.findUnique({
          where: { id: trBookingId },
          select: {
            bookingNumber: true,
            arrivalDate: true,
            endDate: true,
            guide: { select: { name: true, phone: true } }
          }
        });
        const providerLabel = PROVIDER_LABELS[trProvider] || trProvider;
        const tzNow = new Date(Date.now() + 5 * 60 * 60 * 1000); // UTC+5 Tashkent
        const timeStr = `${String(tzNow.getUTCHours()).padStart(2,'0')}:${String(tzNow.getUTCMinutes()).padStart(2,'0')}`;
        const adminMsg = [
          `${emoji} *${providerLabel}*`,
          `📋 ${booking?.bookingNumber || `#${trBookingId}`}`,
          booking?.arrivalDate ? `📅 Boshlanishi: ${fmtDateUtil(booking.arrivalDate)}` : null,
          booking?.endDate     ? `🏁 Tugashi: ${fmtDateUtil(booking.endDate)}`         : null,
          booking?.guide?.name ? `🧭 Gid: *${booking.guide.name}*${booking.guide.phone ? `  ${booking.guide.phone}` : ''}` : null,
          trApprovedBy         ? `👁 TEKSHIRDI: ${mdSafe(trApprovedBy)}`                : null,
          `👤 ${isConfirm ? 'TASDIQLADI' : 'RAD ETDI'}: ${mdSafe(fromName)}`,
          `🕐 ${fmtDateUtil(new Date())} ${timeStr}`
        ].filter(Boolean).join('\n');
        for (const id of trAdminIds) {
          await axios.post(`${TRANSPORT_API()}/sendMessage`, {
            chat_id: id, text: adminMsg, parse_mode: 'Markdown'
          }).catch(async (e) => {
            console.warn('tr admin notify err:', e.response?.data || e.message);
            await axios.post(`${TRANSPORT_API()}/sendMessage`, { chat_id: id, text: adminMsg.replace(/[*_`]/g, '') }).catch(() => {});
          });
        }
      }

      return;
    }
    // ── End transport callbacks ────────────────────────────────────────────

    // ── Transport 2026: approver callbacks (tp26_approve / tp26_decline) ──
    if (data.startsWith('tp26_approve:') || data.startsWith('tp26_decline:')) {
      const parts = data.split(':');
      // tp26_approve:{year}:{tourType}:{provider}
      const isApprove    = data.startsWith('tp26_approve:');
      const tp26Year     = parts[1];
      const tp26TourType = parts[2];
      const tp26Provider = parts[3];
      const providerLabel = { sevil: 'Sevil', xayrulla: 'Xayrulla', nosir: 'Nosir' }[tp26Provider] || tp26Provider;
      const tourLabel     = { ER: 'ER', CO: 'CO', KAS: 'KAS', ZA: 'ZA' }[tp26TourType] || tp26TourType;

      await axios.post(`${BOT_API()}/answerCallbackQuery`, {
        callback_query_id: callbackQueryId,
        text: isApprove ? `✅ ${providerLabel} ga yuborilmoqda...` : '❌ Rad qilindi.',
        show_alert: false
      }).catch(() => {});

      const confKey = `JP_TRANSPORT_CONFIRM_${tp26Year}_${tp26TourType}_${tp26Provider}`;
      const setting = await prisma.systemSetting.findUnique({ where: { key: confKey } });
      if (!setting) return;
      const stored = JSON.parse(setting.value || '{}');

      if (isApprove) {
        // Re-use Telegram file_id from the approver's document message
        const fileId = cb.message?.document?.file_id;
        if (!fileId) {
          console.error('tp26_approve: no document file_id in callback message');
          return;
        }

        const providerChatId = stored.providerChatId;
        if (!providerChatId) {
          console.error('tp26_approve: providerChatId not stored in SystemSetting');
          return;
        }

        const providerCaption = [
          `🚌 *Transport Rejasi ${tp26Year} — ${tourLabel}*`,
          `👤 *${providerLabel}*`,
          ``,
          `Yillik transport rejasini tasdiqlaysizmi?`
        ].join('\n');

        // Send PDF to actual provider using Telegram file_id (no re-upload needed)
        await axios.post(`${BOT_API()}/sendDocument`, {
          chat_id: providerChatId,
          document: fileId,
          caption: providerCaption,
          parse_mode: 'Markdown',
          reply_markup: JSON.stringify({
            inline_keyboard: [[
              { text: '✅ Tasdiqlash', callback_data: `tp26_c:${tp26Year}:${tp26TourType}:${tp26Provider}` },
              { text: '❌ Rad etish',  callback_data: `tp26_r:${tp26Year}:${tp26TourType}:${tp26Provider}` },
            ]]
          })
        }).catch(err => console.error('tp26_approve sendDocument error:', err.response?.data || err.message));

        // Send formatted table to provider as a separate text message
        if (stored.messageText) {
          const tableText = [
            `🚌 *Transport Rejasi ${tp26Year} — ${tourLabel}* | 👤 *${providerLabel}*`,
            ``,
            `\`\`\`\n${stored.messageText}\n\`\`\``
          ].join('\n');
          await axios.post(`${BOT_API()}/sendMessage`, {
            chat_id: providerChatId,
            text: tableText,
            parse_mode: 'Markdown'
          }).catch(err => console.warn('tp26_approve table message warn:', err.response?.data?.description || err.message));
        }

        // Update stored status to APPROVED
        stored.status     = 'APPROVED';
        stored.approvedBy = fromName;
        stored.approvedAt = new Date().toISOString();
        await prisma.systemSetting.update({ where: { key: confKey }, data: { value: JSON.stringify(stored) } });

        // Edit approver's document caption: remove buttons, show result
        if (cb.message?.message_id && fromChatId) {
          const originalCaption = cb.message.caption || '';
          await axios.post(`${BOT_API()}/editMessageCaption`, {
            chat_id: fromChatId,
            message_id: cb.message.message_id,
            caption: originalCaption + `\n\n✅ ${mdSafe(fromName)} tasdiqladi — ${providerLabel} ga yuborildi`,
            parse_mode: 'Markdown',
            reply_markup: JSON.stringify({ inline_keyboard: [] })
          }).catch(() => {});
        }

      } else {
        // Declined by approver
        stored.status     = 'REJECTED_BY_APPROVER';
        stored.approvedBy = fromName;
        stored.approvedAt = new Date().toISOString();
        await prisma.systemSetting.update({ where: { key: confKey }, data: { value: JSON.stringify(stored) } });

        // Edit approver's document caption
        if (cb.message?.message_id && fromChatId) {
          const originalCaption = cb.message.caption || '';
          await axios.post(`${BOT_API()}/editMessageCaption`, {
            chat_id: fromChatId,
            message_id: cb.message.message_id,
            caption: originalCaption + `\n\n❌ ${mdSafe(fromName)} tomonidan rad qilindi`,
            parse_mode: 'Markdown',
            reply_markup: JSON.stringify({ inline_keyboard: [] })
          }).catch(() => {});
        }
      }

      return;
    }
    // ── End Transport 2026 approver callbacks ─────────────────────────────

    // ── Transport 2026 (Jahresplanung) confirmation callbacks ────────────
    if (data.startsWith('tp26_c:') || data.startsWith('tp26_r:')) {
      const parts = data.split(':');
      // tp26_c:{year}:{tourType}:{provider}
      const isConfirm = data.startsWith('tp26_c:');
      const tp26Year     = parts[1];
      const tp26TourType = parts[2];
      const tp26Provider = parts[3];
      const emoji        = isConfirm ? '✅' : '❌';

      await axios.post(`${BOT_API()}/answerCallbackQuery`, {
        callback_query_id: callbackQueryId,
        text: isConfirm ? '✅ Tasdiqlandi!' : '❌ Rad qilindi.',
        show_alert: false
      }).catch(() => {});

      const confKey = `JP_TRANSPORT_CONFIRM_${tp26Year}_${tp26TourType}_${tp26Provider}`;
      const setting = await prisma.systemSetting.findUnique({ where: { key: confKey } });
      if (setting) {
        const stored = JSON.parse(setting.value || '{}');
        stored.status      = isConfirm ? 'CONFIRMED' : 'REJECTED';
        stored.confirmedBy = fromName;
        stored.respondedAt = new Date().toISOString();
        await prisma.systemSetting.update({ where: { key: confKey }, data: { value: JSON.stringify(stored) } });

        // Edit the provider's document message caption (remove buttons, show result)
        if (fromChatId && cb.message?.message_id) {
          const providerLabel = { sevil: 'Sevil', xayrulla: 'Xayrulla', nosir: 'Nosir' }[tp26Provider] || tp26Provider;
          const originalCaption = cb.message.caption || '';
          const resultLine = `\n\n${isConfirm ? '✅ TASDIQLADI' : '❌ RAD ETDI'}: *${fromName}*`;
          await axios.post(`${BOT_API()}/editMessageCaption`, {
            chat_id: fromChatId,
            message_id: cb.message.message_id,
            caption: originalCaption + resultLine,
            parse_mode: 'Markdown',
            reply_markup: JSON.stringify({ inline_keyboard: [] })
          }).catch(() => {});
        }
      }
      return;
    }
    // ── End Transport 2026 callbacks ──────────────────────────────────────

    // ── Jahresplanung (JP) confirmation callbacks ─────────────────────────
    if (data.startsWith('jp_')) {
      const parts = data.split(':');
      const action = parts[0];
      const isBulk = action === 'jp_ca' || action === 'jp_wa' || action === 'jp_ra';
      const jpHotelId  = parseInt(isBulk ? parts[1] : parts[2]);
      const jpBookingId = isBulk ? null : parseInt(parts[1]);
      const jpVisitIdx  = isBulk ? null : (parts[3] !== undefined ? parseInt(parts[3]) : null);

      const newStatus = (action === 'jp_c' || action === 'jp_ca') ? 'CONFIRMED'
                      : (action === 'jp_w' || action === 'jp_wa') ? 'WAITING'
                      : 'REJECTED';
      const answerText = newStatus === 'CONFIRMED' ? '✅ Tasdiqlandi!'
                       : newStatus === 'WAITING'   ? "⏳ WL ga qo'shildi."
                       : '❌ Rad qilindi.';

      await axios.post(`${BOT_API()}/answerCallbackQuery`, {
        callback_query_id: callbackQueryId, text: answerText, show_alert: false
      }).catch(() => {});

      // Load stored groups — support both new format (JP_SECTIONS_{id}_{tourType}) and old format
      let setting = null;
      if (!isBulk) {
        // For individual visit: find the JP_SECTIONS that contains this bookingId
        const candidates = await prisma.systemSetting.findMany({
          where: { key: { startsWith: `JP_SECTIONS_${jpHotelId}` } }
        });
        for (const c of candidates) {
          try {
            const d = JSON.parse(c.value);
            if ((d.groups || []).some(g => g.bookingId === jpBookingId)) { setting = c; break; }
          } catch {}
        }
      } else {
        // For bulk: find the JP_SECTIONS whose bulkMsgId matches this callback message
        const candidates = await prisma.systemSetting.findMany({
          where: { key: { startsWith: `JP_SECTIONS_${jpHotelId}` } }
        });
        const cbMsgId = cb.message?.message_id;
        // Match by bulkMsgId to find the correct tourType entry
        setting = candidates.find(c => {
          try {
            const d = JSON.parse(c.value);
            return d.bulkMsgId != null && d.bulkMsgId === cbMsgId;
          } catch { return false; }
        }) || candidates[0] || null;
      }
      if (!setting) { console.warn(`JP_SECTIONS not found for hotelId ${jpHotelId}`); return; }
      const stored = JSON.parse(setting.value);
      const { year, tourType, hotelName, chatId: storedChatId, bulkMsgId } = stored;
      const groups = stored.groups;
      const editChatId = cb.message?.chat?.id || storedChatId;

      const TOUR_LABELS = { ER: 'ER', CO: 'CO', KAS: 'KAS', ZA: 'ZA' };
      const ST_ICON = { CONFIRMED: '✅', WAITING: '⏳', REJECTED: '❌', PENDING: '⬜' };
      const header = `📋 *Заявка ${year} — ${TOUR_LABELS[tourType] || tourType}*`;

      // Helper — build one visit's message + keyboard (keyboard removed after action)
      function buildVisitMsg(grp, v, st) {
        const statusIcon = st === 'CONFIRMED' ? '✅ ' : st === 'WAITING' ? '⏳ ' : st === 'REJECTED' ? '❌ ' : '';
        const visitTitle = v.sectionLabel
          ? `${statusIcon}*${grp.no}. ЗАЯВКА ${grp.group} — ${v.sectionLabel}*`
          : `${statusIcon}*${grp.no}. ЗАЯВКА ${grp.group}*`;
        const lines = [visitTitle,
          `🏨 ${hotelName}`,
          '',
          `📅 Заезд: ${v.checkIn}`,
          `📅 Выезд: ${v.checkOut}`,
          `👥 PAX: ${v.pax}`,
          `🛏 DBL:${v.dbl}  |  TWN:${v.twn}  |  SNGL:${v.sngl}`
        ];
        // PENDING — 3 buttons; WAITING — 2 buttons (no WL); CONFIRMED/REJECTED — no buttons
        const keyboard = st === 'PENDING' ? [[
            { text: '✅ Tasdiqlash', callback_data: `jp_c:${grp.bookingId}:${jpHotelId}:${v.visitIdx}` },
            { text: '⏳ WL',        callback_data: `jp_w:${grp.bookingId}:${jpHotelId}:${v.visitIdx}` },
            { text: '❌ Rad etish', callback_data: `jp_r:${grp.bookingId}:${jpHotelId}:${v.visitIdx}` },
          ]] : st === 'WAITING' ? [[
            { text: '✅ Tasdiqlash', callback_data: `jp_c:${grp.bookingId}:${jpHotelId}:${v.visitIdx}` },
            { text: '❌ Rad etish', callback_data: `jp_r:${grp.bookingId}:${jpHotelId}:${v.visitIdx}` },
          ]] : [];
        return { text: lines.join('\n'), keyboard };
      }

      const respondedAt = new Date().toISOString();
      if (isBulk) {
        // Update status — skip visits already CONFIRMED or REJECTED (don't overwrite final decisions)
        for (const grp of groups) {
          for (const v of grp.visits) {
            if (v.status === 'CONFIRMED' || v.status === 'REJECTED') continue;
            v.status = newStatus;
            v.confirmedBy = fromName;
            v.respondedAt = respondedAt;
          }
        }
        // Edit visit messages (only those whose status changed, i.e. not already CONFIRMED/REJECTED before bulk)
        for (const grp of groups) {
          for (const v of grp.visits) {
            if (!v.msgId) continue;
            const { text, keyboard } = buildVisitMsg(grp, v, v.status);
            await axios.post(`${BOT_API()}/editMessageText`, {
              chat_id: storedChatId, message_id: v.msgId,
              text, parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard }
            }).catch(() => {});
          }
        }
      } else {
        // Find and update this specific visit
        let targetGrp = null, targetVisit = null;
        for (const grp of groups) {
          const v = grp.visits.find(v => v.visitIdx === jpVisitIdx && grp.bookingId === jpBookingId);
          if (v) { targetGrp = grp; targetVisit = v; break; }
        }
        if (targetVisit) {
          targetVisit.status = newStatus;
          targetVisit.confirmedBy = fromName;
          targetVisit.respondedAt = respondedAt;
          // Edit this visit's message
          const msgId = cb.message?.message_id;
          if (msgId && editChatId) {
            const { text, keyboard } = buildVisitMsg(targetGrp, targetVisit, newStatus);
            console.log('JP editMessageText attempt:', { editChatId, msgId, newStatus });
            await axios.post(`${BOT_API()}/editMessageText`, {
              chat_id: editChatId, message_id: msgId,
              text, parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard }
            }).then(() => console.log('JP editMessageText OK')).catch(e => console.error('JP editMessageText error:', e.response?.data || e.message));
          }
        }
      }

      // Remove bulk action keyboard if all visits are now non-PENDING (CONFIRMED, WAITING, or REJECTED)
      const noPending = groups.every(g => g.visits.every(v => v.status === 'CONFIRMED' || v.status === 'WAITING' || v.status === 'REJECTED'));
      if (isBulk && cb.message?.message_id && editChatId) {
        if (noPending) {
          await axios.post(`${BOT_API()}/editMessageReplyMarkup`, {
            chat_id: editChatId,
            message_id: cb.message.message_id,
            reply_markup: { inline_keyboard: [] }
          }).catch(() => {});
        }
      } else if (!isBulk && bulkMsgId && storedChatId) {
        // After individual confirm — check if all done and remove bulk button
        if (noPending) {
          await axios.post(`${BOT_API()}/editMessageReplyMarkup`, {
            chat_id: storedChatId,
            message_id: bulkMsgId,
            reply_markup: { inline_keyboard: [] }
          }).catch(() => {});
        }
      }

      // Save updated statuses back to SystemSetting
      stored.groups = groups;
      try {
        await prisma.systemSetting.update({
          where: { key: setting.key },
          data: { value: JSON.stringify(stored) }
        });
        console.log(`JP_SECTIONS saved: key=${setting.key}, status=${newStatus}, visitIdx=${jpVisitIdx}`);
      } catch (e) {
        console.error('JP_SECTIONS save FAILED:', e.message, '| key:', setting.key);
      }

      // Sync to JP_STATE statuses (so Jahresplanung page reflects Telegram responses)
      try {
        const JP_TO_ROW = { CONFIRMED: 'confirmed', WAITING: 'waiting', REJECTED: 'cancelled', PENDING: null };
        // For bulk: carry each visit's actual status (some may be skipped/unchanged)
        const affected = isBulk
          ? groups.flatMap(g => (g.visits || []).map(v => ({ bookingId: g.bookingId, checkIn: v.checkIn, status: v.status })))
          : (() => {
              const g = groups.find(g => g.bookingId === jpBookingId);
              const v = g?.visits.find(v => v.visitIdx === jpVisitIdx);
              return v ? [{ bookingId: jpBookingId, checkIn: v.checkIn, status: v.status }] : [];
            })();

        const stateSetting = await prisma.systemSetting.findUnique({
          where: { key: `JP_STATE_${year}_${tourType}` }
        });
        if (stateSetting && affected.length > 0) {
          const stateData = JSON.parse(stateSetting.value);
          const rowSt = stateData.statuses || {};

          for (const { bookingId, checkIn, status } of affected) {
            // Convert "DD.MM.YYYY" → "YYYY-MM-DD"
            const parts = (checkIn || '').split('.');
            const isoDate = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : '';
            const prefix = `${jpHotelId}_${bookingId}_`;
            const rowVal = JP_TO_ROW[status]; // use each visit's actual status

            Object.keys(rowSt).forEach(k => {
              if (k.startsWith(prefix) && (!isoDate || k.includes(isoDate))) {
                if (rowVal === null) delete rowSt[k];
                else rowSt[k] = rowVal;
              }
            });
          }

          stateData.statuses = rowSt;
          await prisma.systemSetting.update({
            where: { key: `JP_STATE_${year}_${tourType}` },
            data: { value: JSON.stringify(stateData) }
          }).catch(() => {});
        }
      } catch (syncErr) {
        console.warn('JP_STATE sync warn:', syncErr.message);
      }

      // Admin notification
      const jpAdminIds = await getBotAdminIds('hotel');
      if (jpAdminIds.length) {
        const emoji = newStatus === 'CONFIRMED' ? '✅' : newStatus === 'WAITING' ? '⏳' : '❌';
        const actionLabel = newStatus === 'CONFIRMED' ? 'Tasdiqladi' : newStatus === 'WAITING' ? "WL ga qo'shdi" : 'Rad etdi';
        const tzNow = new Date(Date.now() + 5 * 60 * 60 * 1000); // UTC+5 Tashkent
        const timeStr = `${String(tzNow.getUTCHours()).padStart(2,'0')}:${String(tzNow.getUTCMinutes()).padStart(2,'0')}`;

        let adminText;
        if (isBulk) {
          const totalVisits = groups.reduce((s, g) => s + g.visits.length, 0);
          adminText = [
            `${emoji} *Barcha ${totalVisits} ta zaezd — ${actionLabel}*`,
            `🏨 ${hotelName}`,
            `📋 Заявка ${year} — ${TOUR_LABELS[tourType] || tourType}`,
            ``,
            `👤 ${mdSafe(fromName)}`,
            `🕐 ${timeStr}`
          ].join('\n');
        } else {
          const grp = groups.find(g => g.bookingId === jpBookingId);
          const v = grp?.visits.find(v => v.visitIdx === jpVisitIdx);
          const title = v?.sectionLabel
            ? `${emoji} *${grp?.no ? grp.no + '. ' : ''}ЗАЯВКА ${grp?.group || ''} — ${v.sectionLabel}*`
            : `${emoji} *${grp?.no ? grp.no + '. ' : ''}ЗАЯВКА ${grp?.group || ''}*`;
          adminText = [
            title,
            `🏨 ${hotelName}`,
            ``,
            `📅 Заезд: ${v?.checkIn || '—'}`,
            `📅 Выезд: ${v?.checkOut || '—'}`,
            `👥 PAX: ${v?.pax || 0}`,
            `🛏 DBL:${v?.dbl || 0}  |  TWN:${v?.twn || 0}  |  SNGL:${v?.sngl || 0}`,
            ``,
            `👤 ${mdSafe(fromName)}`,
            `🕐 ${timeStr}`
          ].join('\n');
        }
        for (const id of jpAdminIds) {
          await axios.post(`${BOT_API()}/sendMessage`, {
            chat_id: id, text: adminText, parse_mode: 'Markdown'
          }).catch(e => console.warn('JP admin notify error:', e.response?.data || e.message));
        }
      }
      return;
    }
    // ── End JP callbacks ──────────────────────────────────────────────────

    // ── Zayavka view callbacks (hotel taps ER/CO/KAS/ZA year) ─────────────
    if (data.startsWith('zv:')) {
      const [, tourType, year] = data.split(':');
      await axios.post(`${BOT_API()}/answerCallbackQuery`, { callback_query_id: callbackQueryId }).catch(() => {});
      const allForChat = await findJpSectionsByChatId(fromChatId);
      const setting = allForChat.find(s => { try { return JSON.parse(s.value).tourType === tourType; } catch { return false; } });
      if (!setting) {
        await axios.post(`${BOT_API()}/sendMessage`, {
          chat_id: fromChatId,
          text: `📋 *${tourType} ${year}* uchun zayavka hali yuborilmagan.`,
          parse_mode: 'Markdown'
        }).catch(() => {});
        return;
      }
      const jpData = JSON.parse(setting.value);
      const ST_ZV = { CONFIRMED: '✅', WAITING: '⏳', REJECTED: '❌' };
      const zvBlocks = [];
      for (const grp of (jpData.groups || [])) {
        for (const v of grp.visits) {
          const si = ST_ZV[v.status] || '⬜';
          const title = v.sectionLabel ? `${si} *ЗАЯВКА ${grp.group} — ${v.sectionLabel}*` : `${si} *ЗАЯВКА ${grp.group}*`;
          zvBlocks.push([title, `📅 Заезд: ${v.checkIn}`, `📅 Выезд: ${v.checkOut}`, `👥 PAX: ${v.pax}`, `🛏 DBL:${v.dbl||0}  |  TWN:${v.twn||0}  |  SNGL:${v.sngl||0}`].join('\n'));
        }
      }
      await axios.post(`${BOT_API()}/sendMessage`, { chat_id: fromChatId, text: `📋 *${tourType} ${year} — ${jpData.hotelName || ''}*`, parse_mode: 'Markdown' }).catch(() => {});
      let zvChunk = [], zvChunkLen = 0;
      for (let i = 0; i < zvBlocks.length; i++) {
        if (zvChunkLen + zvBlocks[i].length > 3500 && zvChunk.length > 0) {
          await axios.post(`${BOT_API()}/sendMessage`, { chat_id: fromChatId, text: zvChunk.join('\n\n'), parse_mode: 'Markdown' }).catch(() => {});
          zvChunk = []; zvChunkLen = 0;
        }
        zvChunk.push(zvBlocks[i]); zvChunkLen += zvBlocks[i].length;
      }
      if (zvChunk.length > 0) {
        await axios.post(`${BOT_API()}/sendMessage`, { chat_id: fromChatId, text: zvChunk.join('\n\n'), parse_mode: 'Markdown' }).catch(() => {});
      }
      return;
    }

    // chg_c / chg_r — Izmeneniye k zayavke confirm/reject
    if (data.startsWith('chg_c:') || data.startsWith('chg_r:')) {
      const parts = data.split(':');
      const chgBookingId = parseInt(parts[1]);
      const chgHotelId   = parseInt(parts[2]);
      const isConfirm    = data.startsWith('chg_c:');
      const chgEmoji     = isConfirm ? '✅' : '❌';
      const chgLabel     = isConfirm ? 'Tasdiqlandi!' : 'Rad qilindi.';
      const chgStatus    = isConfirm ? 'CONFIRMED' : 'REJECTED';

      await axios.post(`${BOT_API()}/answerCallbackQuery`, {
        callback_query_id: callbackQueryId,
        text: `${chgEmoji} ${chgLabel}`,
        show_alert: false
      }).catch(() => {});

      // Edit caption: add status, remove buttons
      if (cb.message?.message_id) {
        const origCaption = cb.message.caption || cb.message.text || '';
        const newCaption  = (origCaption + `\n\n${chgEmoji} ${chgLabel}`).slice(0, 1024);
        const editMethod  = cb.message.caption !== undefined ? 'editMessageCaption' : 'editMessageText';
        const editKey     = cb.message.caption !== undefined ? 'caption' : 'text';
        await axios.post(`${BOT_API()}/${editMethod}`, {
          chat_id: fromChatId,
          message_id: cb.message.message_id,
          [editKey]: newCaption,
          parse_mode: 'Markdown',
          reply_markup: JSON.stringify({ inline_keyboard: [] })
        }).catch(() => {});
      }

      // Update TelegramConfirmation
      try {
        await prisma.telegramConfirmation.updateMany({
          where: { bookingId: chgBookingId, hotelId: chgHotelId, status: 'PENDING' },
          data: { status: chgStatus, confirmedBy: fromName, respondedAt: new Date() }
        });
      } catch (e) { console.warn('chg confirmation update:', e.message); }

      // Notify hotel admins
      const chgAdminIds = await getBotAdminIds('hotel');
      if (chgAdminIds.length) {
        const chgBooking = await prisma.booking.findUnique({ where: { id: chgBookingId } });
        const chgHotel   = await prisma.hotel.findUnique({ where: { id: chgHotelId } });
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
        const chgAdminText = [
          `${chgEmoji} *Izmeneniye — ЗАЯВКА ${chgBooking?.bookingNumber || chgBookingId}*`,
          `🏨 ${chgHotel?.name || chgHotelId}`,
          ``,
          `👤 ${mdSafe(fromName)}`,
          `🕐 ${timeStr}`
        ].join('\n');
        for (const id of chgAdminIds) {
          await axios.post(`${BOT_API()}/sendMessage`, {
            chat_id: id, text: chgAdminText, parse_mode: 'Markdown'
          }).catch(e => console.warn('chg admin notify err:', e.response?.data || e.message));
        }
      }
      return;
    }

    // ann_c — Anulyatsiya tasdiqlash
    if (data.startsWith('ann_c:')) {
      const parts = data.split(':');
      const annBookingId = parseInt(parts[1]);
      const annHotelId   = parseInt(parts[2]);

      await axios.post(`${BOT_API()}/answerCallbackQuery`, {
        callback_query_id: callbackQueryId,
        text: '✅ Anulyatsiya tasdiqlandi!',
        show_alert: false
      }).catch(() => {});

      // Edit message: add confirmed label, remove button
      if (cb.message?.message_id) {
        const origText = cb.message.text || '';
        const newText  = (origText + `\n\n✅ Tasdiqlandi`).slice(0, 4096);
        await axios.post(`${BOT_API()}/editMessageText`, {
          chat_id: fromChatId,
          message_id: cb.message.message_id,
          text: newText,
          parse_mode: 'Markdown',
          reply_markup: JSON.stringify({ inline_keyboard: [] })
        }).catch(() => {});
      }

      // Update TelegramConfirmation
      try {
        await prisma.telegramConfirmation.updateMany({
          where: { bookingId: annBookingId, hotelId: annHotelId, status: 'PENDING' },
          data: { status: 'CONFIRMED', confirmedBy: fromName, respondedAt: new Date() }
        });
      } catch (e) { console.warn('ann confirmation update:', e.message); }

      // Notify hotel admins
      const annAdminIds = await getBotAdminIds('hotel');
      if (annAdminIds.length) {
        const annBooking = await prisma.booking.findUnique({ where: { id: annBookingId } });
        const annHotel   = await prisma.hotel.findUnique({ where: { id: annHotelId } });
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
        const annAdminText = [
          `✅ *Anulyatsiya tasdiqlandi — ЗАЯВКА ${annBooking?.bookingNumber || annBookingId}*`,
          `🏨 ${annHotel?.name || annHotelId}`,
          ``,
          `👤 ${mdSafe(fromName)}`,
          `🕐 ${timeStr}`
        ].join('\n');
        for (const id of annAdminIds) {
          await axios.post(`${BOT_API()}/sendMessage`, {
            chat_id: id, text: annAdminText, parse_mode: 'Markdown'
          }).catch(() => {});
        }
      }
      return;
    }

    const [action, bookingId, hotelId] = data.split(':');
    console.log('Hotel confirm/reject handler:', { action, bookingId, hotelId, data });
    if (!action || !bookingId || !hotelId) return;

    // Fetch booking + hotel info
    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(bookingId) },
      include: { tourType: true }
    });
    const hotel = await prisma.hotel.findUnique({ where: { id: parseInt(hotelId) } });

    const bookingNum = booking?.bookingNumber || `#${bookingId}`;
    const hotelName = hotel?.name || `Hotel #${hotelId}`;

    const isConfirm = action === 'confirm';
    const isWaiting = action === 'waiting';
    const emoji = isConfirm ? '✅' : isWaiting ? '⏳' : '❌';
    const actionText = isConfirm ? 'TASDIQLADI' : isWaiting ? 'WAITING LIST GA QOSHDI' : 'RAD QILDI';
    const answerText = isConfirm ? '✅ Tasdiqlandi! Rahmat.' : isWaiting ? '⏳ Waiting List ga qo\'shildi.' : '❌ Rad qilindi.';

    // 1. Answer the callback (removes loading state on hotel's button)
    await axios.post(`${BOT_API()}/answerCallbackQuery`, {
      callback_query_id: callbackQueryId,
      text: answerText,
      show_alert: false
    });

    // 2. Edit caption to add status; remove buttons only on confirm/reject (waiting keeps buttons)
    if (cb.message?.message_id && fromChatId) {
      const statusEmoji = isConfirm ? '✅' : isWaiting ? '⏳' : '❌';
      const statusLabel = isConfirm ? 'Tasdiqlandi!' : isWaiting ? "Waiting List ga qo'shildi." : 'Rad qilindi.';
      const originalCaption = cb.message.caption || '';
      const originalEntities = cb.message.caption_entities || [];
      const newCaption = (originalCaption + `\n\n${statusEmoji} ${statusLabel}`).slice(0, 1024);
      // On waiting: keep ✅ and ❌ buttons (remove ⏳ WL); on confirm/reject: remove all
      const newReplyMarkup = isWaiting ? {
        inline_keyboard: [[
          { text: '✅ Tasdiqlash', callback_data: `confirm:${bookingId}:${hotelId}` },
          { text: '❌ Rad qilish', callback_data: `reject:${bookingId}:${hotelId}` }
        ]]
      } : { inline_keyboard: [] };

      await axios.post(`${BOT_API()}/editMessageCaption`, {
        chat_id: fromChatId,
        message_id: cb.message.message_id,
        caption: newCaption,
        caption_entities: originalEntities,
        reply_markup: newReplyMarkup
      }).catch(e => console.warn('editCaption err:', e.response?.data || e.message));
    }

    // 3. Notify hotel admins
    const hotelAdminIds = await getBotAdminIds('hotel');
    if (hotelAdminIds.length) {
    const adminChatId = hotelAdminIds[0]; // use first for building message, then send to all
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      const dateStr = fmtDate(now);

      // Fetch accommodation dates for this booking+hotel
      const accs = await prisma.accommodation.findMany({
        where: { bookingId: parseInt(bookingId), hotelId: parseInt(hotelId) },
        orderBy: { checkInDate: 'asc' }
      });

      const dateLines = [];
      if (accs.length === 1) {
        dateLines.push(`📅 Заезд: ${fmtDate(accs[0].checkInDate)}`);
        dateLines.push(`📅 Выезд: ${fmtDate(accs[0].checkOutDate)}`);
      } else {
        accs.forEach((a, i) => {
          dateLines.push(`*${i + 1}-zaezd:*`);
          dateLines.push(`📅 Заезд: ${fmtDate(a.checkInDate)}`);
          dateLines.push(`📅 Выезд: ${fmtDate(a.checkOutDate)}`);
        });
      }

      const adminMsg = [
        `${emoji} *ЗАЯВКА ${bookingNum}*`,
        `🏨 ${hotelName}`,
        ``,
        ...dateLines,
        ``,
        `👤 ${mdSafe(fromName)}`,
        `🕐 ${timeStr}`
      ].join('\n');
      for (const id of hotelAdminIds) {
        await axios.post(`${BOT_API()}/sendMessage`, { chat_id: id, text: adminMsg, parse_mode: 'Markdown' })
          .catch(async (e) => {
            console.error('Hotel admin notify error:', e.response?.data || e.message);
            // Fallback: send without markdown
            await axios.post(`${BOT_API()}/sendMessage`, { chat_id: id, text: adminMsg.replace(/[*_`]/g, '') }).catch(() => {});
          });
      }
    }

    // 4. Update TelegramConfirmation status
    try {
      const newStatus = isConfirm ? 'CONFIRMED' : isWaiting ? 'WAITING' : 'REJECTED';
      await prisma.telegramConfirmation.updateMany({
        where: {
          bookingId: parseInt(bookingId),
          hotelId: parseInt(hotelId),
          status: { in: ['PENDING', 'WAITING'] }
        },
        data: {
          status: newStatus,
          confirmedBy: fromName,
          respondedAt: new Date()
        }
      });
    } catch (confErr) {
      console.warn('TelegramConfirmation update warn:', confErr.message);
    }

  } catch (err) {
    console.error('Telegram webhook error:', err.response?.data || err.message);
  }
});

// DELETE /api/telegram/confirmations/:id
router.delete('/confirmations/:id', authenticate, async (req, res) => {
  try {
    await prisma.telegramConfirmation.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete confirmation error:', err.message);
    res.status(500).json({ error: 'Failed to delete confirmation' });
  }
});

// GET /api/telegram/confirmations
router.get('/confirmations', authenticate, async (req, res) => {
  try {
    const year = req.query.year ? parseInt(req.query.year) : null;
    const where = year ? { booking: { bookingYear: year } } : {};
    const confirmations = await prisma.telegramConfirmation.findMany({
      where,
      include: {
        booking: { select: { bookingNumber: true, departureDate: true } },
        hotel: { select: { name: true, city: { select: { name: true } } } }
      },
      orderBy: { sentAt: 'desc' }
    });
    res.json({ confirmations });
  } catch (err) {
    console.error('Get confirmations error:', err.message);
    res.status(500).json({ error: 'Failed to fetch confirmations' });
  }
});

// ============================================================
// Transport Bot Webhook
// ============================================================

// POST /api/telegram/webhook-transport - Receive updates from Transport Bot
router.post('/webhook-transport', verifyWebhookSecret, async (req, res) => {
  res.sendStatus(200);
  try {
    const update = req.body;

    // Save any chat that messages the transport bot to known chats
    const msg = update.message || update.channel_post;
    if (msg) {
      const chat = msg.chat;

      const adminEnvId = process.env.TELEGRAM_ADMIN_CHAT_ID;

      // /start — register + send menu based on role
      if (msg.text === '/start' || msg.text === '/menu') {
        const chats = await loadKnownChats();
        const existing = chats[String(chat.id)] || {};
        const telegramName = chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ');
        const newRole = existing.role || 'user';
        chats[String(chat.id)] = {
          ...existing,
          chatId: String(chat.id),
          name: existing.nameCustomized ? existing.name : telegramName,
          username: chat.username ? `@${chat.username}` : (existing.username || null),
          type: chat.type,
          role: newRole,
          lastMessage: msg.text,
          date: new Date(msg.date * 1000).toISOString()
        };
        await saveKnownChats(chats);
        const isAdminUser = (adminEnvId && String(chat.id) === String(adminEnvId)) || newRole === 'admin';
        if (isAdminUser) {
          await sendTransportAdminMenu(chat.id);
        } else if (newRole === 'transport') {
          await sendTransportMenu(chat.id);
        } else {
          await axios.post(`${TRANSPORT_API()}/sendMessage`, {
            chat_id: chat.id,
            text: `👋 Assalomu alaykum!\n\nSiz ro'yxatdan o'tdingiz. Admin tez orada sizga rol tayinlaydi.`,
            parse_mode: 'Markdown'
          }).catch(() => {});
        }
        return;
      }

      // Language selection
      if (msg.text === "🇺🇿 O'zbek tili" || msg.text === "🇷🇺 Русский язык") {
        const lang = msg.text.includes("O'zbek") ? 'uz' : 'ru';
        const chats = await loadKnownChats();
        if (chats[String(chat.id)]) { chats[String(chat.id)].lang = lang; await saveKnownChats(chats); }
        await axios.post(`${TRANSPORT_API()}/sendMessage`, {
          chat_id: chat.id, text: T.langSelected[lang], parse_mode: 'Markdown',
          reply_markup: JSON.stringify({ remove_keyboard: true })
        }).catch(() => {});
        return;
      }

      // Contact shared — save phone number
      if (msg.contact) {
        const phone = msg.contact.phone_number;
        const chats = await loadKnownChats();
        if (chats[String(chat.id)]) { chats[String(chat.id)].phone = phone; await saveKnownChats(chats); }
        await axios.post(`${TRANSPORT_API()}/sendMessage`, {
          chat_id: chat.id, text: T.phoneSaved[chats[String(chat.id)]?.lang || 'uz'],
          parse_mode: 'Markdown', reply_markup: JSON.stringify({ remove_keyboard: true })
        }).catch(() => {});
        return;
      }

      const chats = await loadKnownChats();
      const existing = chats[String(chat.id)] || {};
      const telegramName = chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ');
      chats[String(chat.id)] = {
        ...existing,
        chatId: String(chat.id),
        name: existing.nameCustomized ? existing.name : telegramName,
        username: chat.username ? `@${chat.username}` : (existing.username || null),
        type: chat.type,
        lastMessage: msg.text || '[file]',
        date: new Date(msg.date * 1000).toISOString()
      };
      await saveKnownChats(chats);

      // "📋 Marshrut List" — show inline ER/CO/KAS/ZA keyboard
      if (msg.text === '📋 Marshrut List') {
        await axios.post(`${TRANSPORT_API()}/sendMessage`, {
          chat_id: chat.id,
          text: '📋 *Marshrut List* — Tur turini tanlang:',
          parse_mode: 'Markdown',
          reply_markup: JSON.stringify({
            inline_keyboard: [[
              { text: 'ER',  callback_data: 'tr_list:ER'  },
              { text: 'CO',  callback_data: 'tr_list:CO'  },
              { text: 'KAS', callback_data: 'tr_list:KAS' },
              { text: 'ZA',  callback_data: 'tr_list:ZA'  }
            ]]
          })
        }).catch(() => {});
        return;
      }

      // Menu button handlers — show inline ER/CO/KAS/ZA sub-menu
      const isZayavkaBtn = msg.text?.startsWith('📄 Заявка');
      const pressedZayavkaYear = isZayavkaBtn ? (parseInt(msg.text.replace('📄 Заявка', '').trim()) || null) : null;
      const STATUS_BTN_MAP_STATIC = {
        '✅ Tasdiqlangan': { key: 'CONFIRMED',   emoji: '✅' },
        '🚫 Rad etilgan':  { key: 'RAD_ETILGAN', emoji: '🚫' },
      };
      // Ануляция — explicit check (multiple text variants for keyboard compatibility)
      const isAnulyatsiya = msg.text === '❌ Ануляция' || msg.text === '❌ Аннуляция' || msg.text === '❌ Anulyatsiya';
      if (isAnulyatsiya) {
        await axios.post(`${TRANSPORT_API()}/sendMessage`, {
          chat_id: chat.id,
          text: `❌ *Anulyatsiya* — Tur turini tanlang:`,
          parse_mode: 'Markdown',
          reply_markup: JSON.stringify({
            inline_keyboard: [[
              { text: 'ER',  callback_data: 'tr_conf:REJECTED:ER'  },
              { text: 'CO',  callback_data: 'tr_conf:REJECTED:CO'  },
              { text: 'KAS', callback_data: 'tr_conf:REJECTED:KAS' },
              { text: 'ZA',  callback_data: 'tr_conf:REJECTED:ZA'  }
            ]]
          })
        }).catch(() => {});
        return;
      }
      if (msg.text && STATUS_BTN_MAP_STATIC[msg.text]) {
        const { key, emoji } = STATUS_BTN_MAP_STATIC[msg.text];
        await axios.post(`${TRANSPORT_API()}/sendMessage`, {
          chat_id: chat.id,
          text: `${emoji} *${msg.text}* — Tur turini tanlang:`,
          parse_mode: 'Markdown',
          reply_markup: JSON.stringify({
            inline_keyboard: [[
              { text: 'ER',  callback_data: `tr_conf:${key}:ER`  },
              { text: 'CO',  callback_data: `tr_conf:${key}:CO`  },
              { text: 'KAS', callback_data: `tr_conf:${key}:KAS` },
              { text: 'ZA',  callback_data: `tr_conf:${key}:ZA`  }
            ]]
          })
        }).catch(() => {});
        return;
      }
      if (isZayavkaBtn) {
        if (!pressedZayavkaYear) {
          // No year in button text → find available years and show picker
          const curYr = new Date().getFullYear();
          const jpKeys = await prisma.systemSetting.findMany({ where: { key: { startsWith: 'JP_TRANSPORT_CONFIRM_' } } });
          const availYrs = [...new Set(
            jpKeys
              .filter(s => { try { return !JSON.parse(s.value).cleared; } catch { return false; } })
              .map(s => parseInt(s.key.split('_')[3]))
              .filter(y => y && y >= curYr)
          )].sort();
          const yrsToShow = availYrs.length ? availYrs : [curYr];
          if (yrsToShow.length === 1) {
            // Only one year — proceed directly
            const y = yrsToShow[0];
            await axios.post(`${TRANSPORT_API()}/sendMessage`, {
              chat_id: chat.id,
              text: `📄 *Заявка ${y}* — Tur turini tanlang:`,
              parse_mode: 'Markdown',
              reply_markup: JSON.stringify({ inline_keyboard: [[
                { text: 'ER', callback_data: `tr_conf:PENDING_${y}:ER` },
                { text: 'CO', callback_data: `tr_conf:PENDING_${y}:CO` },
                { text: 'KAS', callback_data: `tr_conf:PENDING_${y}:KAS` },
                { text: 'ZA', callback_data: `tr_conf:PENDING_${y}:ZA` }
              ]]})
            }).catch(() => {});
          } else {
            // Multiple years — show inline year picker
            await axios.post(`${TRANSPORT_API()}/sendMessage`, {
              chat_id: chat.id,
              text: '📄 *Qaysi yilni tanlang:*',
              parse_mode: 'Markdown',
              reply_markup: JSON.stringify({
                inline_keyboard: [yrsToShow.map(y => ({ text: `${y}`, callback_data: `tr_zayavka_year:${y}` }))]
              })
            }).catch(() => {});
          }
          return;
        }
        // Year specified directly in button text
        await axios.post(`${TRANSPORT_API()}/sendMessage`, {
          chat_id: chat.id,
          text: `📄 *Заявка ${pressedZayavkaYear}* — Tur turini tanlang:`,
          parse_mode: 'Markdown',
          reply_markup: JSON.stringify({
            inline_keyboard: [[
              { text: 'ER',  callback_data: `tr_conf:PENDING_${pressedZayavkaYear}:ER`  },
              { text: 'CO',  callback_data: `tr_conf:PENDING_${pressedZayavkaYear}:CO`  },
              { text: 'KAS', callback_data: `tr_conf:PENDING_${pressedZayavkaYear}:KAS` },
              { text: 'ZA',  callback_data: `tr_conf:PENDING_${pressedZayavkaYear}:ZA`  }
            ]]
          })
        }).catch(() => {});
        return;
      }

      // Save incoming text + notify admin (only non-menu messages)
      if (msg.text) {
        await prisma.telegramMessage.create({
          data: {
            chatId: String(chat.id),
            chatName: chats[String(chat.id)]?.name || null,
            role: chats[String(chat.id)]?.role || 'transport',
            text: msg.text,
            direction: 'IN'
          }
        }).catch(() => {});

        const senderName = chats[String(chat.id)]?.name || telegramName;
        const adminRoleIds = Object.values(chats).filter(c => c.role === 'admin').map(c => c.chatId);
        const allAdmins = [...new Set([...(adminEnvId ? [String(adminEnvId)] : []), ...adminRoleIds])];
        for (const aId of allAdmins) {
          if (String(aId) === String(chat.id)) continue;
          await axios.post(`${BOT_API()}/sendMessage`, {
            chat_id: aId,
            text: `🚌 *Transport: ${senderName}*\n\n📩 Yangi xabar:\n"${msg.text}"`,
            parse_mode: 'Markdown',
            reply_markup: JSON.stringify({
              inline_keyboard: [[{ text: '✏️ Javob berish', callback_data: `reply_to:${chat.id}:${senderName.substring(0, 30)}` }]]
            })
          }).catch(() => {});
        }
      }
    }

    const cb = update.callback_query;
    if (!cb) return;

    console.log('[WEBHOOK-TRANSPORT] ANY callback received:', cb.data, '| from:', cb.from?.username || cb.from?.first_name, '| chat:', cb.message?.chat?.id);

    const callbackQueryId = cb.id;
    const data = cb.data || '';
    const fromUser = cb.from;
    const fromDisplayName = [fromUser.first_name, fromUser.last_name].filter(Boolean).join(' ');
    const fromName = [fromDisplayName, fromUser.username ? `@${fromUser.username}` : ''].filter(Boolean).join(' ') || 'Noma\'lum';
    const fromChatId = cb.message?.chat?.id;
    const adminChatId = await getTransportAdminChatId();

    // ── tr_approve / tr_decline (Siroj approving marshrut for provider) ────
    if (data.startsWith('tr_approve:') || data.startsWith('tr_decline:')) {
      const parts = data.split(':');
      const isApprove   = data.startsWith('tr_approve:');
      const trBookingId = parseInt(parts[1]);
      const trProvider  = parts[2];
      const providerLabel = PROVIDER_LABELS[trProvider] || trProvider;

      const confirmation = await prisma.transportConfirmation.findFirst({
        where: { bookingId: trBookingId, provider: trProvider, status: 'PENDING_APPROVAL' },
        include: {
          booking: { select: { bookingNumber: true, arrivalDate: true, endDate: true, pax: true, guide: { select: { name: true, phone: true } } } }
        }
      });

      if (!confirmation) {
        await axios.post(`${TRANSPORT_API()}/answerCallbackQuery`, {
          callback_query_id: callbackQueryId, text: '⚠️ Allaqachon ishlov berilgan.', show_alert: true
        }).catch(() => {});
        return;
      }

      await axios.post(`${TRANSPORT_API()}/answerCallbackQuery`, {
        callback_query_id: callbackQueryId,
        text: isApprove ? `✅ ${providerLabel} ga yuborilmoqda...` : '❌ Rad qilindi.',
        show_alert: false
      }).catch(() => {});

      if (isApprove) {
        const providerChatId = await getProviderChatId(trProvider);
        if (!providerChatId) return;

        const fileId = cb.message?.document?.file_id;
        if (!fileId) return;

        const booking = confirmation.booking;
        const providerCaption = [
          `🚌 *Marshrut varaqasi*`,
          `📋 Booking: *${booking.bookingNumber}*`,
          `🚗 Transport: *${providerLabel}*`,
          booking.pax         ? `👥 PAX: *${booking.pax}* kishi`                     : null,
          booking.arrivalDate ? `📅 Boshlanishi: ${fmtDateUtil(booking.arrivalDate)}` : null,
          booking.endDate     ? `🏁 Tugashi: ${fmtDateUtil(booking.endDate)}`         : null,
          booking.guide?.name ? `🧭 Gid: *${booking.guide.name}*${booking.guide.phone ? `  ${booking.guide.phone}` : ''}` : null,
        ].filter(Boolean).join('\n');

        await axios.post(`${TRANSPORT_API()}/sendDocument`, {
          chat_id: providerChatId,
          document: fileId,
          caption: providerCaption,
          parse_mode: 'Markdown',
          reply_markup: JSON.stringify({
            inline_keyboard: [[
              { text: '✅ Tasdiqlash', callback_data: `tr_confirm:${trBookingId}:${trProvider}` },
              { text: '❌ Rad qilish', callback_data: `tr_reject:${trBookingId}:${trProvider}` }
            ]]
          })
        }).catch(err => console.error('tr_approve sendDocument error:', err.response?.data || err.message));

        await prisma.transportConfirmation.update({
          where: { id: confirmation.id },
          data: { status: 'APPROVED', approvedBy: fromName, respondedAt: new Date() }
        });

        if (cb.message?.message_id && fromChatId) {
          const originalCaption = cb.message.caption || '';
          await axios.post(`${TRANSPORT_API()}/editMessageCaption`, {
            chat_id: fromChatId, message_id: cb.message.message_id,
            caption: originalCaption + `\n\n✅ ${mdSafe(fromName)} tasdiqladi — ${providerLabel} ga yuborildi`,
            parse_mode: 'Markdown', reply_markup: JSON.stringify({ inline_keyboard: [] })
          }).catch(() => {});
        }
      } else {
        await prisma.transportConfirmation.update({
          where: { id: confirmation.id },
          data: { status: 'REJECTED_BY_APPROVER', approvedBy: fromName, respondedAt: new Date() }
        });
        if (cb.message?.message_id && fromChatId) {
          const originalCaption = cb.message.caption || '';
          await axios.post(`${TRANSPORT_API()}/editMessageCaption`, {
            chat_id: fromChatId, message_id: cb.message.message_id,
            caption: originalCaption + `\n\n❌ ${mdSafe(fromName)} tomonidan rad qilindi`,
            parse_mode: 'Markdown', reply_markup: JSON.stringify({ inline_keyboard: [] })
          }).catch(() => {});
        }
        if (adminChatId) {
          const booking = confirmation.booking;
          await axios.post(`${TRANSPORT_API()}/sendMessage`, {
            chat_id: adminChatId,
            text: [`❌ *${providerLabel}* uchun marshrut varaqasi rad etildi`,
              `📋 ${booking?.bookingNumber || `#${trBookingId}`}`,
              `👤 RAD ETDI: ${fromName}`].join('\n'),
            parse_mode: 'Markdown'
          }).catch(() => {});
        }
      }
      return;
    }

    // ── tr_confirm / tr_reject (provider confirming marshrut) ────────────
    if (data.startsWith('tr_confirm:') || data.startsWith('tr_reject:')) {
      console.log('[WEBHOOK-TRANSPORT/tr_confirm] data:', data, '| from:', fromName);
      const parts = data.split(':');
      const isConfirm  = data.startsWith('tr_confirm:');
      const trBookingId = parseInt(parts[1]);
      const trProvider  = parts[2];
      const emoji = isConfirm ? '✅' : '❌';

      await axios.post(`${TRANSPORT_API()}/answerCallbackQuery`, {
        callback_query_id: callbackQueryId,
        text: isConfirm ? '✅ Tasdiqlandi! Rahmat.' : '❌ Rad qilindi.',
        show_alert: false
      }).catch(() => {});

      if (cb.message?.message_id && fromChatId) {
        const statusLine = isConfirm
          ? `\n\n✅ ${mdSafe(fromName)} tomonidan tasdiqlandi`
          : `\n\n❌ ${mdSafe(fromName)} tomonidan rad qilindi`;
        await axios.post(`${TRANSPORT_API()}/editMessageCaption`, {
          chat_id: fromChatId, message_id: cb.message.message_id,
          caption: (cb.message.caption || '') + statusLine,
          parse_mode: 'Markdown', reply_markup: JSON.stringify({ inline_keyboard: [] })
        }).catch(() => {});
      }

      let trApprovedBy = null;
      try {
        const existing = await prisma.transportConfirmation.findFirst({
          where: { bookingId: trBookingId, provider: trProvider, status: { in: ['PENDING', 'APPROVED'] } },
          select: { approvedBy: true }
        });
        trApprovedBy = existing?.approvedBy || null;
      } catch {}

      try {
        await prisma.transportConfirmation.updateMany({
          where: { bookingId: trBookingId, provider: trProvider, status: { in: ['PENDING', 'APPROVED'] } },
          data: { status: isConfirm ? 'CONFIRMED' : 'REJECTED', confirmedBy: fromName, respondedAt: new Date() }
        });
      } catch (e) { console.warn('TransportConfirmation update warn:', e.message); }

      const trAdminIds = await getBotAdminIds('transport');
      console.log('[TR_CONFIRM] trAdminIds:', trAdminIds, '| bookingId:', trBookingId, '| provider:', trProvider, '| isConfirm:', isConfirm);
      if (trAdminIds.length) {
        const booking = await prisma.booking.findUnique({
          where: { id: trBookingId },
          select: { bookingNumber: true, arrivalDate: true, endDate: true, guide: { select: { name: true, phone: true } } }
        });
        const providerLabel = PROVIDER_LABELS[trProvider] || trProvider;
        const tzNow = new Date(Date.now() + 5 * 60 * 60 * 1000);
        const timeStr = `${String(tzNow.getUTCHours()).padStart(2,'0')}:${String(tzNow.getUTCMinutes()).padStart(2,'0')}`;
        const adminMsg = [
          `${emoji} *${providerLabel}*`,
          `📋 ${booking?.bookingNumber || `#${trBookingId}`}`,
          booking?.arrivalDate ? `📅 Boshlanishi: ${fmtDateUtil(booking.arrivalDate)}` : null,
          booking?.endDate     ? `🏁 Tugashi: ${fmtDateUtil(booking.endDate)}`         : null,
          booking?.guide?.name ? `🧭 Gid: *${booking.guide.name}*${booking.guide.phone ? `  ${booking.guide.phone}` : ''}` : null,
          trApprovedBy         ? `👁 TEKSHIRDI: ${mdSafe(trApprovedBy)}`                : null,
          `👤 ${isConfirm ? 'TASDIQLADI' : 'RAD ETDI'}: ${mdSafe(fromName)}`,
          `🕐 ${fmtDateUtil(new Date())} ${timeStr}`
        ].filter(Boolean).join('\n');
        for (const id of trAdminIds) {
          console.log('[TR_CONFIRM] Sending admin notify to:', id, 'via TRANSPORT_API');
          await axios.post(`${TRANSPORT_API()}/sendMessage`, { chat_id: id, text: adminMsg, parse_mode: 'Markdown' })
            .then(() => console.log('[TR_CONFIRM] Admin notify OK:', id))
            .catch(async (e) => {
              console.warn('[TR_CONFIRM] Markdown fail, trying plain:', e.response?.data || e.message);
              await axios.post(`${TRANSPORT_API()}/sendMessage`, { chat_id: id, text: adminMsg.replace(/[*_`]/g, '') })
                .then(() => console.log('[TR_CONFIRM] Plain text OK:', id))
                .catch(e2 => console.error('[TR_CONFIRM] Both failed:', e2.response?.data || e2.message));
            });
        }
      }
      return;
    }

    // ── tr_zayavka_year:{year} — year picker for 📄 Заявка ──────────────────
    if (data.startsWith('tr_zayavka_year:')) {
      const year = parseInt(data.split(':')[1]);
      await axios.post(`${TRANSPORT_API()}/answerCallbackQuery`, { callback_query_id: callbackQueryId, show_alert: false }).catch(() => {});
      await axios.post(`${TRANSPORT_API()}/sendMessage`, {
        chat_id: fromChatId,
        text: `📄 *Заявка ${year}* — Tur turini tanlang:`,
        parse_mode: 'Markdown',
        reply_markup: JSON.stringify({ inline_keyboard: [[
          { text: 'ER',  callback_data: `tr_conf:PENDING_${year}:ER`  },
          { text: 'CO',  callback_data: `tr_conf:PENDING_${year}:CO`  },
          { text: 'KAS', callback_data: `tr_conf:PENDING_${year}:KAS` },
          { text: 'ZA',  callback_data: `tr_conf:PENDING_${year}:ZA`  }
        ]]})
      }).catch(() => {});
      return;
    }

    // ── tr_conf:{statusKey}:{tourType} / tr_conf_p:{statusKey}:{tourType}:{provider} ─
    if (data.startsWith('tr_conf:') || data.startsWith('tr_conf_p:')) {
      const parts = data.split(':');
      const isProviderConf = data.startsWith('tr_conf_p:');
      const rawStatusKey = parts[1]; // CONFIRMED | PENDING | PENDING_2027 | REJECTED
      // Extract year from PENDING_2027 → statusKey=PENDING, yearFilter=2027
      const pendingYearMatch = rawStatusKey.match(/^PENDING_(\d{4})$/);
      const statusKey = pendingYearMatch ? 'PENDING' : rawStatusKey;
      const yearFilter = pendingYearMatch ? parseInt(pendingYearMatch[1]) : null;
      const tourType  = parts[2]; // ER | CO | KAS | ZA
      const selectedProvider = isProviderConf ? parts[3] : null;
      const chatId = fromChatId || cb.from?.id;
      const isAdminCb = (adminChatId && String(chatId) === String(adminChatId));

      // Admin clicking tr_conf (no provider yet) → show provider submenu
      if (!isProviderConf && isAdminCb) {
        await axios.post(`${TRANSPORT_API()}/answerCallbackQuery`, {
          callback_query_id: callbackQueryId, text: `${tourType} — provider tanlang`, show_alert: false
        }).catch(() => {});
        const hasNosir = tourType === 'CO' || tourType === 'KAS';
        const cbStatusKey = yearFilter ? `PENDING_${yearFilter}` : rawStatusKey;
        const pButtons = hasNosir
          ? [[{ text: '🚌 Hammasi', callback_data: `tr_conf_p:${cbStatusKey}:${tourType}:hammasi` }, { text: '👤 Xayrulla', callback_data: `tr_conf_p:${cbStatusKey}:${tourType}:xayrulla` }],
             [{ text: '👤 Sevil',   callback_data: `tr_conf_p:${cbStatusKey}:${tourType}:sevil`    }, { text: '👤 Nosir',    callback_data: `tr_conf_p:${cbStatusKey}:${tourType}:nosir`    }]]
          : [[{ text: '🚌 Hammasi', callback_data: `tr_conf_p:${cbStatusKey}:${tourType}:hammasi` }, { text: '👤 Xayrulla', callback_data: `tr_conf_p:${cbStatusKey}:${tourType}:xayrulla` }],
             [{ text: '👤 Sevil',   callback_data: `tr_conf_p:${cbStatusKey}:${tourType}:sevil`    }]];
        const confLabel = yearFilter ? `📄 Заявка ${yearFilter}` : { CONFIRMED: '✅ Tasdiqlangan', PENDING: `📄 Заявка ${new Date().getFullYear()}`, REJECTED: '❌ Ануляция', RAD_ETILGAN: '🚫 Rad etilgan' }[statusKey] || statusKey;
        await axios.post(`${TRANSPORT_API()}/sendMessage`, {
          chat_id: chatId,
          text: `${confLabel} — *${tourType}*\nProvider tanlang:`,
          parse_mode: 'Markdown',
          reply_markup: JSON.stringify({ inline_keyboard: pButtons })
        }).catch(() => {});
        return;
      }

      // Determine effective provider
      let providerName;
      if (isProviderConf) {
        providerName = selectedProvider === 'hammasi' ? null : selectedProvider;
      } else {
        providerName = isAdminCb ? null : await getProviderByChatId(chatId);
      }

      // Tasdiqlangan  = MARSHRUT CONFIRMED (admin) or CONFIRMED+REJECTED (provider)
      // Rad etilgan   = MARSHRUT REJECTED (admin only)
      // Заявка 2026   = JP only
      // Anulyatsiya   = STORNO source (all statuses)
      const STATUS_FILTERS = {
        CONFIRMED:   isAdminCb ? ['CONFIRMED'] : ['CONFIRMED', 'REJECTED', 'REJECTED_BY_APPROVER'],
        PENDING:     [],
        REJECTED:    ['PENDING_APPROVAL', 'APPROVED', 'CONFIRMED', 'REJECTED', 'REJECTED_BY_APPROVER'],
        RAD_ETILGAN: ['REJECTED', 'REJECTED_BY_APPROVER'],
      };
      const SOURCE_FILTERS = {
        CONFIRMED:   'MARSHRUT',
        PENDING:     null,
        REJECTED:    'STORNO',
        RAD_ETILGAN: 'MARSHRUT',
      };
      const JP_STATUS_FILTERS = {
        CONFIRMED:   [],
        PENDING:     ['PENDING_APPROVAL', 'APPROVED', 'CONFIRMED', 'REJECTED'],
        REJECTED:    [],
        RAD_ETILGAN: [],
      };
      const STATUS_EMOJI = { PENDING_APPROVAL: '🔄', APPROVED: '⏳', PENDING: '⏳', CONFIRMED: '✅', REJECTED: '❌', REJECTED_BY_APPROVER: '❌' };
      const statusFilter = STATUS_FILTERS[statusKey] || ['CONFIRMED'];
      const sourceFilter = SOURCE_FILTERS[statusKey] || null;
      const jpStatusFilter = JP_STATUS_FILTERS[statusKey] || ['CONFIRMED'];
      const displayYear = yearFilter || new Date().getFullYear();
      const statusLabel  = { CONFIRMED: '✅ Tasdiqlangan', PENDING: `📄 Заявка ${displayYear}`, REJECTED: '❌ Ануляция', RAD_ETILGAN: '🚫 Rad etilgan' }[statusKey] || statusKey;

      await axios.post(`${TRANSPORT_API()}/answerCallbackQuery`, {
        callback_query_id: callbackQueryId, text: `${tourType} yuklanmoqda...`, show_alert: false
      }).catch(() => {});

      // Build where clause — filter by status + source + tourType via booking relation
      const tourTypeRecord = await prisma.tourType.findUnique({ where: { code: tourType } });
      if (!tourTypeRecord) return;

      const where = {
        booking: { tourTypeId: tourTypeRecord.id }
      };
      if (statusFilter.length > 0) where.status = { in: statusFilter };
      if (sourceFilter) where.source = sourceFilter;
      if (providerName && providerName !== 'hammasi') {
        where.provider = providerName;
      }

      const confs = statusFilter.length === 0 ? [] : await prisma.transportConfirmation.findMany({
        where,
        include: {
          booking: { select: { bookingNumber: true, arrivalDate: true, endDate: true, pax: true } }
        },
        orderBy: { sentAt: 'desc' },
        take: 25
      });

      // Fetch Jahresplanung annual plan confirmations from SystemSetting (filter by pressed year)
      const jpRows = await prisma.systemSetting.findMany({
        where: { key: { startsWith: `JP_TRANSPORT_CONFIRM_${displayYear}_${tourType}_` } }
      });
      const jpEntries = jpRows.map(r => { try { return JSON.parse(r.value); } catch { return null; } })
        .filter(e => e && jpStatusFilter.includes(e.status))
        .filter(e => !providerName || providerName === 'hammasi' || e.provider === providerName);

      const cancelledBookings = [];

      const fmt = d => { if (!d) return '—'; const dt = new Date(d); return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.${dt.getFullYear()}`; };

      if (!confs.length && !jpEntries.length && !cancelledBookings.length) {
        await axios.post(`${TRANSPORT_API()}/sendMessage`, {
          chat_id: chatId,
          text: `${statusLabel} — *${tourType}*\n\nHech narsa topilmadi.`,
          parse_mode: 'Markdown'
        }).catch(() => {});
        return;
      }

      const provLabel = providerName && providerName !== 'hammasi'
        ? ` (${PROVIDER_LABELS[providerName] || providerName})` : '';
      const lines = [`${statusLabel} — *${tourType}${provLabel}*`];

      // Individual booking marshrut confirmations (MARSHRUT source) or storno (STORNO source)
      for (const c of confs) {
        const b = c.booking;
        const st = STATUS_EMOJI[c.status] || '❓';
        lines.push(`\n${st} *${b?.bookingNumber || '#'+c.bookingId}*`);
        if (c.source === 'STORNO') lines.push(`🚫 Аннуляция`);
        if (b?.arrivalDate) lines.push(`📅 ${fmt(b.arrivalDate)} – ${fmt(b.endDate)}`);
        if (b?.pax) lines.push(`👥 ${b.pax} kishi`);
        if (c.confirmedBy) lines.push(`👤 Tasdiqladi: ${c.confirmedBy}`);
        else if (c.approvedBy) lines.push(`👤 Tekshirdi: ${c.approvedBy}`);
      }

      // Cancelled bookings section — only for Anulyatsiya (REJECTED key)
      if (cancelledBookings.length) {
        if (confs.length) lines.push(`\n━━━━━━━━━━━━━━━━━━`);
        lines.push(`\n🚫 *Bekor qilingan gruppalar ${displayYear}*`);
        for (const b of cancelledBookings) {
          lines.push(`\n❌ *${b.bookingNumber}*`);
          if (b.departureDate) lines.push(`📅 ${fmt(b.departureDate)} – ${fmt(b.endDate)}`);
        }
      }

      // Jahresplanung annual plan confirmations — only for Заявка 2026 (PENDING)
      if (jpEntries.length) {
        if (confs.length || cancelledBookings.length) lines.push(`\n━━━━━━━━━━━━━━━━━━`);
        lines.push(`📅 *Yillik reja ${displayYear} — ${tourType}*`);
        for (const jp of jpEntries) {
          const st = STATUS_EMOJI[jp.status] || '⏳';
          const pLabel = PROVIDER_LABELS[jp.provider] || jp.provider;
          const statusText = {
            PENDING_APPROVAL: '⏳ Kutilmoqda',
            APPROVED:         '🔄 Admin tasdiqladi, provayder kutmoqda',
            CONFIRMED:        '✅ Tasdiqlandi',
            REJECTED:         '❌ Rad etildi'
          }[jp.status] || jp.status;
          lines.push(`\n${st} *${pLabel}* — ${statusText}`);
          if (jp.sentAt) lines.push(`📤 Yuborildi: ${fmt(jp.sentAt)}`);
          if (jp.confirmedBy) lines.push(`👤 ${jp.confirmedBy}`);
          if (jp.messageText) {
            lines.push(`\`\`\`\n${jp.messageText.substring(0, 2500)}\n\`\`\``);
          }
        }
      }

      await axios.post(`${TRANSPORT_API()}/sendMessage`, {
        chat_id: chatId, text: lines.join('\n').substring(0, 4000), parse_mode: 'Markdown'
      }).catch(async () => {
        const plain = lines.join('\n').replace(/[*_`]/g, '').substring(0, 4000);
        await axios.post(`${TRANSPORT_API()}/sendMessage`, { chat_id: chatId, text: plain }).catch(() => {});
      });
      return;
    }

    // ── tr_list:{tourType} / tr_list_p:{tourType}:{provider} ─────────────────
    if (data.startsWith('tr_list:') || data.startsWith('tr_list_p:')) {
      const parts = data.split(':');
      const isProviderList = data.startsWith('tr_list_p:');
      const tourType = parts[1]; // ER, CO, KAS, ZA
      const selectedProvider = isProviderList ? parts[2] : null;
      const chatId = fromChatId || cb.from?.id;
      console.log('[tr_list] callback received:', { tourType, chatId, isProviderList, selectedProvider });

      const isAdminCb = (adminChatId && String(chatId) === String(adminChatId));

      // Admin clicking tr_list (no provider yet) → show provider submenu
      if (!isProviderList && isAdminCb) {
        await axios.post(`${TRANSPORT_API()}/answerCallbackQuery`, {
          callback_query_id: callbackQueryId, text: `📋 ${tourType} — provider tanlang`, show_alert: false
        }).catch(() => {});
        const hasNosir = tourType === 'CO' || tourType === 'KAS';
        const pButtons = hasNosir
          ? [[{ text: '🚌 Hammasi', callback_data: `tr_list_p:${tourType}:hammasi` }, { text: '👤 Xayrulla', callback_data: `tr_list_p:${tourType}:xayrulla` }],
             [{ text: '👤 Sevil',   callback_data: `tr_list_p:${tourType}:sevil`    }, { text: '👤 Nosir',    callback_data: `tr_list_p:${tourType}:nosir`    }]]
          : [[{ text: '🚌 Hammasi', callback_data: `tr_list_p:${tourType}:hammasi` }, { text: '👤 Xayrulla', callback_data: `tr_list_p:${tourType}:xayrulla` }],
             [{ text: '👤 Sevil',   callback_data: `tr_list_p:${tourType}:sevil`    }]];
        await axios.post(`${TRANSPORT_API()}/sendMessage`, {
          chat_id: chatId,
          text: `📋 *Marshrut List — ${tourType}*\nProvider tanlang:`,
          parse_mode: 'Markdown',
          reply_markup: JSON.stringify({ inline_keyboard: pButtons })
        }).catch(() => {});
        return;
      }

      // Determine effective provider
      let effectiveProvider;
      if (isProviderList) {
        effectiveProvider = selectedProvider === 'hammasi' ? null : selectedProvider;
      } else {
        const providerName = await getProviderByChatId(chatId);
        effectiveProvider = (providerName && providerName !== 'hammasi') ? providerName : null;
      }
      console.log('[tr_list] effectiveProvider:', effectiveProvider);

      await axios.post(`${TRANSPORT_API()}/answerCallbackQuery`, {
        callback_query_id: callbackQueryId,
        text: `📋 ${tourType} marshruti yuklanmoqda...`,
        show_alert: false
      }).catch(e => console.error('[tr_list] answerCB error:', e.message));

      // Resolve tourTypeId first (avoid nested relation filter issues)
      const tourTypeRecord = await prisma.tourType.findUnique({ where: { code: tourType } });
      console.log('[tr_list] tourTypeRecord:', tourTypeRecord?.id, tourTypeRecord?.code);

      if (!tourTypeRecord) {
        await axios.post(`${TRANSPORT_API()}/sendMessage`, {
          chat_id: chatId,
          text: `❌ "${tourType}" tur turi topilmadi.`,
          parse_mode: 'Markdown'
        }).catch(() => {});
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Find ONE representative booking (upcoming, prefer future; fallback to most recent)
      let sampleBooking = await prisma.booking.findFirst({
        where: { tourTypeId: tourTypeRecord.id, arrivalDate: { gte: today }, status: { not: 'CANCELLED' } },
        orderBy: { arrivalDate: 'asc' }
      });
      if (!sampleBooking) {
        // Fallback: most recent booking of this type regardless of date
        sampleBooking = await prisma.booking.findFirst({
          where: { tourTypeId: tourTypeRecord.id, status: { not: 'CANCELLED' } },
          orderBy: { arrivalDate: 'desc' }
        });
      }
      console.log('[tr_list] sampleBooking:', sampleBooking?.id, sampleBooking?.bookingNumber);

      if (!sampleBooking) {
        await axios.post(`${TRANSPORT_API()}/sendMessage`, {
          chat_id: chatId,
          text: `📋 *${tourType}* uchun hech qanday booking topilmadi.`,
          parse_mode: 'Markdown'
        }).catch(() => {});
        return;
      }

      // Get routes for this booking, filtered by provider
      // provider field in DB can be 'sevil', 'sevil-er', 'sevil-co', etc.
      const routeWhere = { bookingId: sampleBooking.id };
      if (effectiveProvider) {
        routeWhere.provider = {
          in: [effectiveProvider, `${effectiveProvider}-${tourType.toLowerCase()}`]
        };
      }
      console.log('[tr_list] routeWhere:', JSON.stringify(routeWhere));

      const routes = await prisma.route.findMany({
        where: routeWhere,
        orderBy: [{ sortOrder: 'asc' }, { dayNumber: 'asc' }]
      });
      console.log('[tr_list] routes count:', routes.length);

      if (!routes.length) {
        await axios.post(`${TRANSPORT_API()}/sendMessage`, {
          chat_id: chatId,
          text: `📋 *${tourType}* uchun sizning marshrutingiz topilmadi.`,
          parse_mode: 'Markdown'
        }).catch(() => {});
        return;
      }

      const provLabel = effectiveProvider ? ` (${PROVIDER_LABELS[effectiveProvider] || effectiveProvider})` : '';
      const title = `Marshrut — ${tourType}${provLabel}`;

      // Translate route name for Telegram display only (DB unchanged)
      const translateRoute = (name) => {
        if (!name) return name;
        let t = name;
        t = t.replace(/\s*City Tour\s*/gi, '').trim();
        t = t.replace(/\bTashkent\b/g, 'Toshkent');
        t = t.replace(/\bSamarkand\b/g, 'Samarqand');
        t = t.replace(/\bBukhara\b/g, 'Buxoro');
        t = t.replace(/\bKhiva\b/g, 'Xiva');
        t = t.replace(/\bUrgench\b/g, 'Urganch');
        t = t.replace(/\bChimgan\b/g, 'Chimyon');
        t = t.replace(/\bFergana\b/g, "Farg'ona");
        t = t.replace(/\bAndijan\b/g, 'Andijon');
        t = t.replace(/\bNamangan\b/g, 'Namangan');
        t = t.replace(/Airport Pickup/gi, 'Aeroportdan kutib olish');
        t = t.replace(/Airport Drop-?off/gi, 'Aeroportga yetkazish');
        t = t.replace(/Train Station Drop-?off/gi, 'Vokzalga yetkazish');
        t = t.replace(/Train Station/gi, 'Vokzal');
        t = t.replace(/\bAirport\b/gi, 'Aeroport');
        return t || name;
      };

      // 1. Text message — days re-numbered 1, 2, 3...
      const lines = [`📋 <b>${title}</b>`, `${'─'.repeat(22)}`];
      routes.forEach((r, i) => {
        lines.push(`<b>${i + 1}.</b> ${translateRoute(r.routeName || r.city || '—')}`);
      });

      await axios.post(`${TRANSPORT_API()}/sendMessage`, {
        chat_id: chatId,
        text: lines.join('\n').substring(0, 4000),
        parse_mode: 'HTML'
      }).catch(async () => {
        const plain = lines.join('\n').replace(/<[^>]+>/g, '').substring(0, 4000);
        await axios.post(`${TRANSPORT_API()}/sendMessage`, { chat_id: chatId, text: plain }).catch(() => {});
      });

      // 2. PDF — full marshrut varaqasi template, no dates, PAX=16
      try {
        const FIXED_PAX = 16;
        const providerTitle = PROVIDER_LABELS[effectiveProvider] || effectiveProvider || 'Hammasi';

        // Fetch railways, flights, accommodations for the sample booking
        const [railways, flights, bookingFull, accommodations] = await Promise.all([
          prisma.railway.findMany({ where: { bookingId: sampleBooking.id }, orderBy: { sortOrder: 'asc' } }).catch(() => []),
          prisma.flight.findMany({ where: { bookingId: sampleBooking.id }, orderBy: { sortOrder: 'asc' } }).catch(() => []),
          prisma.booking.findFirst({ where: { id: sampleBooking.id }, include: { guide: true } }).catch(() => null),
          prisma.accommodation.findMany({
            where: { bookingId: sampleBooking.id },
            include: { hotel: { include: { city: true } } },
            orderBy: { checkInDate: 'asc' }
          }).catch(() => [])
        ]);

        const guide = bookingFull?.guide;
        const [nosirPhone, sevilPhone, xayrullaPhone] = await Promise.all([
          getProviderPhone('nosir'),
          getProviderPhone('sevil'),
          getProviderPhone('xayrulla'),
        ]);
        const nosirContact = nosirPhone || "Nosir aka (+998 91 151 11 10) Farg\u2019ona";
        const sevilContact  = sevilPhone  || "Sevil aka (+998 90 445 10 92) Marshrutda";
        const xayrullaContact = xayrullaPhone || "Xayrulla (+998 93 133 00 03) Toshkentda";

        const findAccByCity = (cityName) => accommodations.find(a => {
          const c = (a.hotel?.city?.name || '').toLowerCase();
          const cn = (cityName || '').toLowerCase();
          return c && cn && (c.includes(cn) || cn.includes(c));
        });

        // Routes rows
        const routeRowsHtml = routes.map((r, i) => `
          <tr>
            <td class="c">${i + 1}</td><td class="c">—</td>
            <td>${r.routeName || r.city || '—'}</td>
            <td class="c">${FIXED_PAX}</td>
            <td class="c">${r.departureTime || '—'}</td>
            <td class="c">${r.transportType || '—'}</td>
            <td>${r.itinerary || '—'}</td>
          </tr>`).join('');

        // Railway rows
        const railwayRowsHtml = railways.map(r => {
          const acc = findAccByCity(r.arrival);
          return `<tr>
            <td>—</td><td>${r.departure} - ${r.arrival}</td>
            <td class="c">${r.trainNumber || r.trainName || '—'}</td>
            <td class="c">${r.departureTime || ''}${r.arrivalTime ? '-'+r.arrivalTime : ''}</td>
            <td>${r.arrival || '—'}</td>
            <td>${acc?.hotel?.name || '—'}</td>
            <td>${acc?.hotel?.phone || '—'}</td>
          </tr>`;
        }).join('');

        // Domestic flights
        const domFlights = flights.filter(f => f.type === 'DOMESTIC');
        const domRowsHtml = domFlights.map(f => {
          const rs = f.route || (f.departure && f.arrival ? `${f.departure}-${f.arrival}` : '—');
          const acc = findAccByCity(f.arrival);
          return `<tr>
            <td>—</td><td>${rs}</td>
            <td class="c">${f.flightNumber || '—'}</td>
            <td class="c">${f.departureTime && f.arrivalTime ? f.departureTime+'-'+f.arrivalTime : '—'}</td>
            <td>${f.arrival || '—'}</td>
            <td>${acc?.hotel?.name || '—'}</td>
            <td>${acc?.hotel?.phone || '—'}</td>
          </tr>`;
        }).join('');

        // International flights
        const intlFlights = flights.filter(f => f.type === 'INTERNATIONAL');
        const intlRowsHtml = intlFlights.map(f => {
          const rs = f.route || (f.departure && f.arrival ? `${f.departure}-${f.arrival}` : '—');
          return `<tr>
            <td>—</td><td>${rs}</td>
            <td class="c">${f.flightNumber || '—'}</td>
            <td class="c">${f.departureTime && f.arrivalTime ? f.departureTime+'-'+f.arrivalTime : '—'}</td>
          </tr>`;
        }).join('');

        // Unique hotels
        const seenH = new Set();
        const hotelRowsHtml = accommodations.filter(a => {
          if (!a.hotelId || seenH.has(a.hotelId)) return false;
          seenH.add(a.hotelId); return true;
        }).map(a => `<tr>
          <td>${a.hotel?.city?.name || '—'}</td>
          <td>${a.hotel?.name || '—'}</td>
          <td>${a.hotel?.phone || '—'}</td>
        </tr>`).join('');

        const pdfHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
          body{font-family:Arial,sans-serif;padding:18px;font-size:10px;margin:0}
          h1{text-align:center;font-size:15px;font-weight:bold;margin-bottom:12px}
          h3{text-align:center;font-size:11px;font-weight:bold;margin:12px 0 4px}
          table{width:100%;border-collapse:collapse;margin-bottom:6px}
          th{background:#e5e7eb;color:#000;padding:4px 6px;border:1px solid #000;font-size:9px;font-weight:bold;text-align:left}
          td{padding:3px 6px;border:1px solid #aaa;font-size:9px;vertical-align:middle}
          .c{text-align:center}
          .yellow{background:#fef3c7}
          .blue{background:#eff6ff}
        </style></head><body>
        <h1>Marshrut varaqasi (${providerTitle})</h1>
        <table>
          <tr><td>Transport turi</td><td></td><td>Gruppa</td><td>${tourType}</td></tr>
          <tr class="blue"><td>${nosirContact}</td><td></td><td>Davlat</td><td>Germaniya</td></tr>
          <tr><td class="yellow">${sevilContact}</td><td></td><td>Turistlar soni</td><td>${FIXED_PAX}</td></tr>
          <tr><td>${xayrullaContact}</td><td></td><td>gid: ${guide?.name || '—'}</td><td>${guide?.phone || '—'}</td></tr>
        </table>
        ${routes.length > 0 ? `
        <table>
          <thead><tr>
            <th style="width:18px">!</th><th style="width:45px">Sana</th>
            <th style="width:90px">Yo'nalish</th><th style="width:26px" class="c">PAX</th>
            <th style="width:36px" class="c">Vaqt</th><th style="width:58px" class="c">Avtomobil</th>
            <th>Sayohat dasturi</th>
          </tr></thead>
          <tbody>${routeRowsHtml}</tbody>
        </table>` : ''}
        ${railways.length > 0 ? `<h3>Poyezd bileti</h3>
        <table><thead><tr>
          <th>Sana</th><th>Yo'nalish</th><th>Poyezd</th><th class="c">Vaqti</th><th>Shahar</th><th>Hotel</th><th>Telefon</th>
        </tr></thead><tbody>${railwayRowsHtml}</tbody></table>` : ''}
        ${domFlights.length > 0 ? `<h3>Ichki aviareys</h3>
        <table><thead><tr>
          <th>Sana</th><th>Yo'nalish</th><th>Reys</th><th class="c">Vaqti</th><th>Shahar</th><th>Hotel</th><th>Telefon</th>
        </tr></thead><tbody>${domRowsHtml}</tbody></table>` : ''}
        ${intlFlights.length > 0 ? `<h3>Xalqaro aviareys</h3>
        <table><thead><tr>
          <th>Sana</th><th>Yo'nalish</th><th>Reys</th><th class="c">Vaqti</th>
        </tr></thead><tbody>${intlRowsHtml}</tbody></table>` : ''}
        ${hotelRowsHtml ? `<h3>Hotels</h3>
        <table><thead><tr><th>Shahar</th><th>Hotel</th><th>Telefon</th></tr></thead>
        <tbody>${hotelRowsHtml}</tbody></table>` : ''}
        </body></html>`;

        const browser = await puppeteer.launch({ env: { ...process.env, HOME: '/tmp' }, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        await page.setContent(pdfHtml, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({ format: 'A4', margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' } });
        await browser.close();

        const formData = new FormData();
        formData.append('chat_id', String(chatId));
        formData.append('document', Buffer.from(pdfBuffer), {
          filename: `Marshrut_${tourType}_${providerTitle}.pdf`, contentType: 'application/pdf'
        });
        formData.append('caption', `📋 Marshrut varaqasi — ${tourType} (${providerTitle})`);
        await axios.post(`${TRANSPORT_API()}/sendDocument`, formData, { headers: formData.getHeaders() })
          .catch(e => console.error('[tr_list] PDF send error:', e.message));
      } catch (pdfErr) {
        console.error('[tr_list] PDF generation error:', pdfErr.message);
      }
      return;
    }

    // ── tp26_approve / tp26_decline (Jahresplanung transport approval) ───
    if (data.startsWith('tp26_approve:') || data.startsWith('tp26_decline:')) {
      const parts = data.split(':');
      const isApprove    = data.startsWith('tp26_approve:');
      const tp26Year     = parts[1];
      const tp26TourType = parts[2];
      const tp26Provider = parts[3];
      const providerLabel = { sevil: 'Sevil', xayrulla: 'Xayrulla', nosir: 'Nosir' }[tp26Provider] || tp26Provider;

      await axios.post(`${TRANSPORT_API()}/answerCallbackQuery`, {
        callback_query_id: callbackQueryId,
        text: isApprove ? `✅ ${providerLabel} ga yuborilmoqda...` : '❌ Rad qilindi.',
        show_alert: false
      }).catch(() => {});

      const confKey = `JP_TRANSPORT_CONFIRM_${tp26Year}_${tp26TourType}_${tp26Provider}`;
      const setting = await prisma.systemSetting.findUnique({ where: { key: confKey } });
      if (!setting) return;
      const stored = JSON.parse(setting.value || '{}');

      if (isApprove) {
        const fileId = cb.message?.document?.file_id;
        if (!fileId) return;
        const providerChatId = stored.providerChatId;
        if (!providerChatId) return;

        const providerCaption = [
          `🚌 *Transport Rejasi ${tp26Year} — ${tp26TourType}*`,
          `👤 *${providerLabel}*`,
          ``,
          `Qabul qildingizmi?`
        ].join('\n');

        await axios.post(`${TRANSPORT_API()}/sendDocument`, {
          chat_id: providerChatId,
          document: fileId,
          caption: providerCaption,
          parse_mode: 'Markdown',
          reply_markup: JSON.stringify({
            inline_keyboard: [[
              { text: '✅ Tasdiqlash', callback_data: `tp26_confirm:${tp26Year}:${tp26TourType}:${tp26Provider}` },
              { text: '❌ Rad etish',  callback_data: `tp26_reject:${tp26Year}:${tp26TourType}:${tp26Provider}` }
            ]]
          })
        }).catch(err => console.error('tp26_approve sendDocument error:', err.response?.data || err.message));

        // Send formatted table as separate text message
        if (stored.messageText) {
          const tourLabel = { ER: 'ER', CO: 'CO', KAS: 'KAS', ZA: 'ZA' }[tp26TourType] || tp26TourType;
          const tableText = [
            `🚌 *Transport Rejasi ${tp26Year} — ${tourLabel}* | 👤 *${providerLabel}*`,
            ``,
            `\`\`\`\n${stored.messageText}\n\`\`\``
          ].join('\n');
          await axios.post(`${TRANSPORT_API()}/sendMessage`, {
            chat_id: providerChatId,
            text: tableText,
            parse_mode: 'Markdown'
          }).catch(err => console.warn('tp26_approve table warn:', err.response?.data?.description || err.message));
        }

        stored.status = 'APPROVED'; stored.approvedBy = fromName; stored.approvedAt = new Date().toISOString();
        await prisma.systemSetting.update({ where: { key: confKey }, data: { value: JSON.stringify(stored) } });

        if (cb.message?.message_id && fromChatId) {
          await axios.post(`${TRANSPORT_API()}/editMessageCaption`, {
            chat_id: fromChatId, message_id: cb.message.message_id,
            caption: (cb.message.caption || '') + `\n\n✅ ${mdSafe(fromName)} tasdiqladi — ${providerLabel} ga yuborildi`,
            parse_mode: 'Markdown', reply_markup: JSON.stringify({ inline_keyboard: [] })
          }).catch(() => {});
        }
      } else {
        stored.status = 'DECLINED'; stored.approvedBy = fromName; stored.approvedAt = new Date().toISOString();
        await prisma.systemSetting.update({ where: { key: confKey }, data: { value: JSON.stringify(stored) } });

        if (cb.message?.message_id && fromChatId) {
          await axios.post(`${TRANSPORT_API()}/editMessageCaption`, {
            chat_id: fromChatId, message_id: cb.message.message_id,
            caption: (cb.message.caption || '') + `\n\n❌ ${mdSafe(fromName)} tomonidan rad qilindi`,
            parse_mode: 'Markdown', reply_markup: JSON.stringify({ inline_keyboard: [] })
          }).catch(() => {});
        }
      }
      return;
    }

    // ── st_approve / st_decline (Siroj approving storno for provider) ────
    if (data.startsWith('st_approve:') || data.startsWith('st_decline:')) {
      const parts     = data.split(':');
      const isApprove = data.startsWith('st_approve:');
      const stBookingId = parseInt(parts[1]);
      const stProvider  = parts[2];
      const providerLabel = PROVIDER_LABELS[stProvider] || stProvider;

      const confirmation = await prisma.transportConfirmation.findFirst({
        where: { bookingId: stBookingId, provider: stProvider, source: 'STORNO', status: 'PENDING_APPROVAL' },
        include: { booking: { select: { bookingNumber: true, arrivalDate: true, endDate: true, pax: true, guide: { select: { name: true, phone: true } } } } }
      });

      await axios.post(`${TRANSPORT_API()}/answerCallbackQuery`, {
        callback_query_id: callbackQueryId,
        text: isApprove ? `✅ ${providerLabel} ga yuborilmoqda...` : '❌ Rad qilindi.',
        show_alert: false
      }).catch(() => {});

      if (!confirmation) return;

      const fmtD = d => { if (!d) return '—'; const dt = new Date(d); return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.${dt.getFullYear()}`; };

      if (isApprove) {
        const providerChatId = await getProviderChatId(stProvider);
        if (!providerChatId) return;

        const booking = confirmation.booking;
        const providerText = [
          `🚫 *АННУЛЯЦИЯ*`,
          `📋 Gruppa: *${booking.bookingNumber}*`,
          `🚗 Transport: *${providerLabel}*`,
          booking.pax         ? `👥 PAX: *${booking.pax}* kishi`                    : null,
          booking.arrivalDate ? `📅 Boshlanishi: ${fmtD(booking.arrivalDate)}`       : null,
          booking.endDate     ? `🏁 Tugashi: ${fmtD(booking.endDate)}`               : null,
        ].filter(v => v !== null).join('\n');

        await axios.post(`${TRANSPORT_API()}/sendMessage`, {
          chat_id: providerChatId,
          text: providerText,
          parse_mode: 'Markdown',
          reply_markup: JSON.stringify({ inline_keyboard: [[
            { text: '✅ Qabul qildim', callback_data: `st_confirm:${stBookingId}:${stProvider}` },
            { text: '❌ Rad etish',    callback_data: `st_reject:${stBookingId}:${stProvider}`  }
          ]] })
        }).catch(err => console.error('st_approve sendMessage error:', err.response?.data || err.message));

        await prisma.transportConfirmation.update({
          where: { id: confirmation.id },
          data: { status: 'APPROVED', approvedBy: fromName, respondedAt: new Date() }
        });

        if (fromChatId && cb.message?.message_id) {
          await axios.post(`${TRANSPORT_API()}/editMessageText`, {
            chat_id: fromChatId, message_id: cb.message.message_id,
            text: (cb.message.text || '') + `\n\n✅ ${mdSafe(fromName)} tasdiqladi — ${providerLabel} ga yuborildi`,
            parse_mode: 'Markdown', reply_markup: JSON.stringify({ inline_keyboard: [] })
          }).catch(() => {});
        }
      } else {
        await prisma.transportConfirmation.update({
          where: { id: confirmation.id },
          data: { status: 'REJECTED_BY_APPROVER', approvedBy: fromName, respondedAt: new Date() }
        });
        if (fromChatId && cb.message?.message_id) {
          await axios.post(`${TRANSPORT_API()}/editMessageText`, {
            chat_id: fromChatId, message_id: cb.message.message_id,
            text: (cb.message.text || '') + `\n\n❌ ${fromName} rad qildi`,
            parse_mode: 'Markdown', reply_markup: JSON.stringify({ inline_keyboard: [] })
          }).catch(() => {});
        }
      }
      return;
    }

    // ── st_confirm / st_reject (provider confirming storno) ──────────────
    if (data.startsWith('st_confirm:') || data.startsWith('st_reject:')) {
      const parts    = data.split(':');
      const isConfirm = data.startsWith('st_confirm:');
      const stBookingId = parseInt(parts[1]);
      const stProvider  = parts[2];

      await axios.post(`${TRANSPORT_API()}/answerCallbackQuery`, {
        callback_query_id: callbackQueryId,
        text: isConfirm ? '✅ Qabul qilindi!' : '❌ Rad etildi.',
        show_alert: false
      }).catch(() => {});

      const conf = await prisma.transportConfirmation.findFirst({
        where: { bookingId: stBookingId, provider: stProvider, source: 'STORNO', status: 'APPROVED' }
      });
      if (!conf) return;

      await prisma.transportConfirmation.update({
        where: { id: conf.id },
        data: { status: isConfirm ? 'CONFIRMED' : 'REJECTED', confirmedBy: fromName, respondedAt: new Date() }
      });

      if (fromChatId && cb.message?.message_id) {
        const resultLine = `\n\n${isConfirm ? '✅ QABUL QILDI' : '❌ RAD ETDI'}: *${fromName}*`;
        await axios.post(`${TRANSPORT_API()}/editMessageText`, {
          chat_id: fromChatId, message_id: cb.message.message_id,
          text: (cb.message.text || '') + resultLine,
          parse_mode: 'Markdown', reply_markup: JSON.stringify({ inline_keyboard: [] })
        }).catch(() => {});
      }

      if (adminChatId) {
        const booking = await prisma.booking.findUnique({ where: { id: stBookingId }, select: { bookingNumber: true } });
        await axios.post(`${TRANSPORT_API()}/sendMessage`, {
          chat_id: adminChatId,
          text: `${isConfirm ? '✅' : '❌'} *АННУЛЯЦИЯ ${isConfirm ? 'tasdiqlandi' : 'rad etildi'}*\n📋 ${booking?.bookingNumber || '#'+stBookingId}\n🚗 ${PROVIDER_LABELS[stProvider] || stProvider}\n👤 ${mdSafe(fromName)}`,
          parse_mode: 'Markdown'
        }).catch(e => console.warn('st admin notify err:', e.response?.data || e.message));
      }
      return;
    }

    // ── tp26_confirm / tp26_reject (provider confirming Jahresplanung) ───
    if (data.startsWith('tp26_confirm:') || data.startsWith('tp26_reject:')) {
      const parts = data.split(':');
      const isConfirm    = data.startsWith('tp26_confirm:');
      const tp26Year     = parts[1];
      const tp26TourType = parts[2];
      const tp26Provider = parts[3];

      await axios.post(`${TRANSPORT_API()}/answerCallbackQuery`, {
        callback_query_id: callbackQueryId,
        text: isConfirm ? '✅ Tasdiqlandi!' : '❌ Rad qilindi.',
        show_alert: false
      }).catch(() => {});

      const confKey = `JP_TRANSPORT_CONFIRM_${tp26Year}_${tp26TourType}_${tp26Provider}`;
      const setting = await prisma.systemSetting.findUnique({ where: { key: confKey } });
      if (setting) {
        const stored = JSON.parse(setting.value || '{}');
        stored.status = isConfirm ? 'CONFIRMED' : 'REJECTED';
        stored.confirmedBy = fromName; stored.respondedAt = new Date().toISOString();
        await prisma.systemSetting.update({ where: { key: confKey }, data: { value: JSON.stringify(stored) } });

        if (fromChatId && cb.message?.message_id) {
          const resultLine = `\n\n${isConfirm ? '✅ TASDIQLADI' : '❌ RAD ETDI'}: *${mdSafe(fromName)}*`;
          await axios.post(`${TRANSPORT_API()}/editMessageCaption`, {
            chat_id: fromChatId, message_id: cb.message.message_id,
            caption: (cb.message.caption || '') + resultLine,
            parse_mode: 'Markdown', reply_markup: JSON.stringify({ inline_keyboard: [] })
          }).catch(() => {});
        }

        // Notify transport admin
        const tpAdminIds = await getBotAdminIds('transport');
        if (tpAdminIds.length) {
          const emoji = isConfirm ? '✅' : '❌';
          const providerLabel = PROVIDER_LABELS[tp26Provider] || tp26Provider;
          const tzNow = new Date(Date.now() + 5 * 60 * 60 * 1000);
          const timeStr = `${String(tzNow.getUTCHours()).padStart(2,'0')}:${String(tzNow.getUTCMinutes()).padStart(2,'0')}`;
          const adminMsg = [
            `${emoji} *Jahresplanung ${tp26Year} — ${tp26TourType}*`,
            `🚌 Transport: *${providerLabel}*`,
            `👤 ${isConfirm ? 'TASDIQLADI' : 'RAD ETDI'}: ${mdSafe(fromName)}`,
            `🕐 ${timeStr}`
          ].filter(Boolean).join('\n');
          for (const id of tpAdminIds) {
            await axios.post(`${TRANSPORT_API()}/sendMessage`, { chat_id: id, text: adminMsg, parse_mode: 'Markdown' })
              .catch(async () => {
                await axios.post(`${TRANSPORT_API()}/sendMessage`, { chat_id: id, text: adminMsg.replace(/[*_`]/g, '') }).catch(() => {});
              });
          }
        }
      }
      return;
    }

  } catch (err) {
    console.error('Transport webhook error:', err.response?.data || err.message);
  }
});

// ============================================================
// Restaurant Bot Webhook
// ============================================================

// POST /api/telegram/webhook-restaurant - Receive updates from Restaurant Bot
router.post('/webhook-restaurant', verifyWebhookSecret, async (req, res) => {
  res.sendStatus(200);
  try {
    const update = req.body;

    // Save incoming chat to known chats
    const msg = update.message || update.channel_post;
    if (msg) {
      const chat = msg.chat;

      // /start — welcome message, menu based on role
      if (msg.text === '/start') {
        await handleStart(chat, msg, RESTAURANT_API());
        return;
      }

      // Language selection
      if (msg.text === "🇺🇿 O'zbek tili" || msg.text === "🇷🇺 Русский язык") {
        const lang = msg.text.includes("O'zbek") ? 'uz' : 'ru';
        const chats = await loadKnownChats();
        if (chats[String(chat.id)]) { chats[String(chat.id)].lang = lang; await saveKnownChats(chats); }
        await axios.post(`${RESTAURANT_API()}/sendMessage`, {
          chat_id: chat.id, text: T.langSelected[lang], parse_mode: 'Markdown',
          reply_markup: JSON.stringify({ remove_keyboard: true })
        }).catch(() => {});
        return;
      }

      // Contact shared — save phone number
      if (msg.contact) {
        const phone = msg.contact.phone_number;
        const chats = await loadKnownChats();
        const lang = chats[String(chat.id)]?.lang || 'uz';
        if (chats[String(chat.id)]) {
          chats[String(chat.id)].phone = phone;
          await saveKnownChats(chats);
        }
        await axios.post(`${RESTAURANT_API()}/sendMessage`, {
          chat_id: chat.id,
          text: T.phoneSaved[lang],
          parse_mode: 'Markdown',
          reply_markup: JSON.stringify({ remove_keyboard: true })
        }).catch(() => {});
        return;
      }

      const chats = await loadKnownChats();
      const existing = chats[String(chat.id)] || {};
      const telegramName = chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ');
      chats[String(chat.id)] = {
        ...existing,
        chatId: String(chat.id),
        name: existing.nameCustomized ? existing.name : telegramName,
        username: chat.username ? `@${chat.username}` : (existing.username || null),
        type: chat.type,
        lastMessage: msg.text || '[file]',
        date: new Date(msg.date * 1000).toISOString()
      };
      await saveKnownChats(chats);

      // /menu command — show menu based on role
      if (msg.text === '/menu') {
        const chatsForMenu = await loadKnownChats();
        const roleForMenu = chatsForMenu[String(chat.id)]?.role;
        if (roleForMenu === 'restaurant') await sendRestaurantMenu(chat.id);
        else if (roleForMenu === 'admin') await sendRestaurantMenu(chat.id, true);
        else await axios.post(`${RESTAURANT_API()}/sendMessage`, {
          chat_id: chat.id,
          text: `👋 Siz ro'yxatdan o'tdingiz. Admin tez orada sizga rol tayinlaydi.`,
          parse_mode: 'Markdown'
        }).catch(() => {});
        return;
      }

      // Menu button handlers — direct data display, no tour type sub-menu
      const fmtD = d => { if (!d) return '—'; const dt = new Date(d); return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.${dt.getFullYear()}`; };
      const isRestAnulyatsiya = msg.text === '❌ Ануляция' || msg.text === '❌ Аннуляция' || msg.text === '❌ Anulyatsiya';
      const isRestZayavka     = msg.text?.startsWith('📄 Заявка ');
      const restZayavkaYear   = isRestZayavka ? (parseInt(msg.text.replace('📄 Заявка', '').trim()) || new Date().getFullYear()) : null;
      const isTasdiqlangan    = msg.text === '✅ Tasdiqlangan';
      const isRadEtilgan      = msg.text === '🚫 Rad etilgan';

      if (isRestZayavka || isTasdiqlangan || isRestAnulyatsiya || isRadEtilgan) {
        const isAdminUser  = existing.role === 'admin';
        const restaurantName = isAdminUser ? null : await getRestaurantByChatId(chat.id);
        const lines = [];

        // 🚫 Rad etilgan — admin only: BOOKING source REJECTED records
        if (isRadEtilgan) {
          await axios.post(`${RESTAURANT_API()}/sendMessage`, {
            chat_id: chat.id,
            text: `🚫 *Rad etilgan* — Tur turini tanlang:`,
            parse_mode: 'Markdown',
            reply_markup: JSON.stringify({
              inline_keyboard: [[
                { text: 'ER', callback_data: 'rest_rad_tt:ER' },
                { text: 'CO', callback_data: 'rest_rad_tt:CO' },
                { text: 'KAS', callback_data: 'rest_rad_tt:KAS' },
                { text: 'ZA', callback_data: 'rest_rad_tt:ZA' }
              ]]
            })
          }).catch(() => {});
          return;
        }

        if (isRestAnulyatsiya) {
          if (isAdminUser) {
            // Admin: show ER/CO/KAS tour type selector
            await axios.post(`${RESTAURANT_API()}/sendMessage`, {
              chat_id: chat.id,
              text: `❌ *Anulyatsiya* — Tur turini tanlang:`,
              parse_mode: 'Markdown',
              reply_markup: JSON.stringify({
                inline_keyboard: [[
                  { text: 'ER', callback_data: 'rest_anu_tt:ER' },
                  { text: 'CO', callback_data: 'rest_anu_tt:CO' },
                  { text: 'KAS', callback_data: 'rest_anu_tt:KAS' }
                ]]
              })
            }).catch(() => {});
            return;
          }
          // Non-admin: show their own storno confirmations (source: STORNO)
          const stornoWhere = { source: 'STORNO' };
          if (restaurantName) stornoWhere.restaurantName = restaurantName;
          const stornoConfs = await prisma.mealConfirmation.findMany({
            where: stornoWhere,
            include: { booking: { select: { bookingNumber: true, departureDate: true, endDate: true } } },
            orderBy: { sentAt: 'desc' }, take: 30
          });
          const ST = { PENDING: '⏳', CONFIRMED: '✅', REJECTED: '❌' };
          lines.push(`❌ *Anulyatsiya*`);
          if (!stornoConfs.length) {
            lines.push('\nHech narsa topilmadi.');
          } else {
            for (const c of stornoConfs) {
              lines.push(`\n${ST[c.status] || '⏳'} ${c.booking?.bookingNumber || '#' + c.bookingId}`);
              if (c.mealDate) lines.push(`📅 ${c.mealDate}`);
              if (c.restaurantName) lines.push(`🍴 ${c.restaurantName}`);
              if (c.confirmedBy) lines.push(`👤 ${c.confirmedBy}`);
            }
          }

        } else {
          // Zaявka 2026: all statuses | Tasdiqlangan: CONFIRMED only
          // split: isTasdiqlangan = BOOKING source, isZayavka2026 = JP source
          if (isTasdiqlangan) {
            if (isAdminUser) {
              // Admin: show ER/CO/KAS tour type selector
              await axios.post(`${RESTAURANT_API()}/sendMessage`, {
                chat_id: chat.id,
                text: `✅ *Tasdiqlangan* — Tur turini tanlang:`,
                parse_mode: 'Markdown',
                reply_markup: JSON.stringify({
                  inline_keyboard: [[
                    { text: 'ER', callback_data: 'rest_tasd_tt:ER' },
                    { text: 'CO', callback_data: 'rest_tasd_tt:CO' },
                    { text: 'KAS', callback_data: 'rest_tasd_tt:KAS' }
                  ]]
                })
              }).catch(() => {});
              return;
            }
            // Non-admin: show their own confirmed booking confirmations (non-storno only)
            const confWhere = { source: 'BOOKING', status: 'CONFIRMED' };
            if (restaurantName) confWhere.restaurantName = restaurantName;
            const confs = await prisma.mealConfirmation.findMany({
              where: confWhere,
              include: {
                booking: { select: { bookingNumber: true, guide: { select: { name: true, phone: true } } } }
              },
              orderBy: { sentAt: 'desc' }, take: 30
            });
            lines.push(`✅ *Tasdiqlangan*`);
            if (!confs.length) {
              lines.push('\nHech narsa topilmadi.');
            } else {
              for (const c of confs) {
                lines.push(`\n✅ *${c.booking?.bookingNumber || '#' + c.bookingId}*`);
                if (c.mealDate) lines.push(`📅 ${c.mealDate}`);
                if (c.pax) lines.push(`👥 ${c.pax} kishi`);
                if (c.pricePerPerson) lines.push(`💰 Narx: ${Number(c.pricePerPerson).toLocaleString('ru-RU')} UZS/kishi`);
                if (c.pricePerPerson && c.pax) lines.push(`💵 Jami: ${(c.pricePerPerson * c.pax).toLocaleString('ru-RU')} UZS`);
                const guide = c.booking?.guide;
                if (guide?.name) lines.push(`🧭 Gid: ${guide.name}${guide.phone ? '  ' + guide.phone : ''}`);
                if (c.confirmedBy) lines.push(`👤 Tasdiqladi: ${c.confirmedBy}`);
              }
            }
          } else {
            // Zaявка {year}
            if (isAdminUser) {
              // Admin: show ER/CO/KAS tour type selector (pass year in callback)
              await axios.post(`${RESTAURANT_API()}/sendMessage`, {
                chat_id: chat.id,
                text: `📄 *Zaявка ${restZayavkaYear}* — Tur turini tanlang:`,
                parse_mode: 'Markdown',
                reply_markup: JSON.stringify({
                  inline_keyboard: [[
                    { text: 'ER', callback_data: `rest_jp_tt:ER:${restZayavkaYear}` },
                    { text: 'CO', callback_data: `rest_jp_tt:CO:${restZayavkaYear}` },
                    { text: 'KAS', callback_data: `rest_jp_tt:KAS:${restZayavkaYear}` }
                  ]]
                })
              }).catch(() => {});
              return;
            }
            // Non-admin: show their own JP confirmations for pressed year
            const confWhere = { source: 'JP' };
            if (restaurantName) confWhere.restaurantName = restaurantName;
            if (restZayavkaYear) {
              const startOfYear = new Date(`${restZayavkaYear}-01-01`);
              const endOfYear   = new Date(`${restZayavkaYear}-12-31`);
              confWhere.booking = { arrivalDate: { gte: startOfYear, lte: endOfYear } };
            }
            const confs = await prisma.mealConfirmation.findMany({
              where: confWhere,
              include: { booking: { select: { bookingNumber: true, arrivalDate: true, endDate: true } } },
              orderBy: { mealDate: 'asc' }, take: 50
            });
            confs.sort((a, b) => {
              const an = a.booking?.bookingNumber || '';
              const bn = b.booking?.bookingNumber || '';
              return an.localeCompare(bn, undefined, { numeric: true });
            });
            lines.push(`📄 *Заявка ${restZayavkaYear}*`);
            if (!confs.length) {
              lines.push('\nHech narsa topilmadi.');
            } else {
              const ST = { PENDING: '⏳', CONFIRMED: '✅', REJECTED: '❌' };
              for (const c of confs) {
                lines.push(`\n${ST[c.status] || '⏳'} ${c.booking?.bookingNumber || '#' + c.bookingId}`);
                if (c.mealDate) lines.push(`📅 ${c.mealDate}`);
                if (c.pax) lines.push(`👥 ${c.pax} kishi`);
                if (c.confirmedBy) lines.push(`👤 ${c.confirmedBy}`);
              }
            }
          }
        }

        await axios.post(`${RESTAURANT_API()}/sendMessage`, {
          chat_id: chat.id, text: lines.join('\n').substring(0, 4000), parse_mode: 'Markdown'
        }).catch(async () => {
          const plain = lines.join('\n').replace(/[*_`]/g, '').substring(0, 4000);
          await axios.post(`${RESTAURANT_API()}/sendMessage`, { chat_id: chat.id, text: plain }).catch(() => {});
        });
        return;
      }
    }

    const cb = update.callback_query;
    if (!cb) return;

    const callbackQueryId = cb.id;
    const data = cb.data || '';
    const fromUser = cb.from;
    const fromDisplayName = [fromUser.first_name, fromUser.last_name].filter(Boolean).join(' ');
    const fromName = [fromDisplayName, fromUser.username ? `@${fromUser.username}` : ''].filter(Boolean).join(' ') || 'Noma\'lum';
    const fromChatId = cb.message?.chat?.id;
    const adminChatId = await getRestaurantAdminChatId();

    // ── rest_conf:{statusKey}:{tourType} — Show meal confirmations by status + tour type ─
    if (data.startsWith('rest_conf:')) {
      const parts = data.split(':');
      const statusKey = parts[1]; // CONFIRMED | PENDING | REJECTED
      const tourType  = parts[2]; // ER | CO | KAS | ZA
      const chatId = fromChatId || cb.from?.id;
      const isAdminCb = (adminChatId && String(chatId) === String(adminChatId));
      const restaurantName = isAdminCb ? null : await getRestaurantByChatId(chatId);

      const STATUS_FILTERS = {
        CONFIRMED: ['CONFIRMED'],
        PENDING:   ['PENDING'],
        REJECTED:  ['REJECTED']
      };
      const statusFilter = STATUS_FILTERS[statusKey] || ['CONFIRMED'];
      const statusLabel = { CONFIRMED: '✅ Tasdiqlangan', PENDING: `📄 Заявка ${new Date().getFullYear()}`, REJECTED: '❌ Ануляция' }[statusKey] || statusKey;

      await axios.post(`${RESTAURANT_API()}/answerCallbackQuery`, {
        callback_query_id: callbackQueryId, text: `${tourType} yuklanmoqda...`, show_alert: false
      }).catch(() => {});

      const tourTypeRecord = await prisma.tourType.findUnique({ where: { code: tourType } });
      if (!tourTypeRecord) return;

      const fmt = d => { if (!d) return '—'; const dt = new Date(d); return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.${dt.getFullYear()}`; };
      const restLabel = restaurantName ? ` (${restaurantName})` : '';
      const lines = [`${statusLabel} — *${tourType}${restLabel}*`];

      if (statusKey === 'REJECTED') {
        // Anulyatsiya — show STORNO source MealConfirmations
        const stornoWhere = { source: 'STORNO', booking: { tourTypeId: tourTypeRecord.id } };
        if (restaurantName) stornoWhere.restaurantName = restaurantName;
        const stornoConfs = await prisma.mealConfirmation.findMany({
          where: stornoWhere,
          include: { booking: { select: { bookingNumber: true, arrivalDate: true, endDate: true } } },
          orderBy: { sentAt: 'desc' }, take: 30
        });
        const ST = { PENDING: '⏳', CONFIRMED: '✅', REJECTED: '❌' };
        if (!stornoConfs.length) {
          lines.push('\nHech narsa topilmadi.');
        } else {
          for (const c of stornoConfs) {
            lines.push(`\n${ST[c.status] || '⏳'} ${c.booking?.bookingNumber || '#'+c.bookingId}`);
            if (!restaurantName && c.restaurantName) lines.push(`🍽 ${c.restaurantName}`);
            if (c.mealDate) lines.push(`📅 ${c.mealDate}`);
            if (c.confirmedBy) lines.push(`👤 ${c.confirmedBy}`);
          }
        }
      } else if (statusKey === 'CONFIRMED') {
        // Tasdiqlangan: individual booking confirmations (BOOKING source)
        const where = { source: 'BOOKING', status: 'CONFIRMED', booking: { tourTypeId: tourTypeRecord.id } };
        if (restaurantName) where.restaurantName = restaurantName;
        const confs = await prisma.mealConfirmation.findMany({
          where,
          include: {
            booking: {
              select: {
                bookingNumber: true,
                guide: { select: { name: true, phone: true } }
              }
            }
          },
          orderBy: { sentAt: 'desc' }, take: 30
        });
        if (!confs.length) {
          lines.push('\nHech narsa topilmadi.');
        } else {
          for (const c of confs) {
            lines.push(`\n✅ *${c.booking?.bookingNumber || '#'+c.bookingId}*`);
            if (!restaurantName && c.restaurantName) lines.push(`🍽 ${c.restaurantName}`);
            if (c.mealDate) lines.push(`📅 ${c.mealDate}`);
            if (c.pax) lines.push(`👥 ${c.pax} kishi`);
            if (c.pricePerPerson) lines.push(`💰 Narx: ${Number(c.pricePerPerson).toLocaleString('ru-RU')} UZS/kishi`);
            if (c.pricePerPerson && c.pax) lines.push(`💵 Jami: ${(c.pricePerPerson * c.pax).toLocaleString('ru-RU')} UZS`);
            const guide = c.booking?.guide;
            if (guide?.name) lines.push(`🧭 Gid: ${guide.name}${guide.phone ? '  ' + guide.phone : ''}`);
            if (c.confirmedBy) lines.push(`👤 Tasdiqladi: ${c.confirmedBy}`);
          }
        }
      } else {
        // Zaявка 2026: JP meal confirmations (all statuses)
        const where = { source: 'JP', booking: { tourTypeId: tourTypeRecord.id } };
        if (restaurantName) where.restaurantName = restaurantName;
        const confs = await prisma.mealConfirmation.findMany({
          where,
          include: { booking: { select: { bookingNumber: true, arrivalDate: true, endDate: true } } },
          orderBy: { mealDate: 'asc' }, take: 50
        });
        confs.sort((a, b) => {
          const an = a.booking?.bookingNumber || '';
          const bn = b.booking?.bookingNumber || '';
          return an.localeCompare(bn, undefined, { numeric: true });
        });
        if (!confs.length) {
          lines.push('\nHech narsa topilmadi.');
        } else {
          const ST = { PENDING: '⏳', CONFIRMED: '✅', REJECTED: '❌' };
          for (const c of confs) {
            lines.push(`\n${ST[c.status] || '⏳'} ${c.booking?.bookingNumber || '#'+c.bookingId}`);
            if (!restaurantName && c.restaurantName) lines.push(`🍽 ${c.restaurantName}`);
            if (c.mealDate) lines.push(`📅 ${c.mealDate}`);
            if (c.pax) lines.push(`👥 ${c.pax} kishi`);
            if (c.confirmedBy) lines.push(`👤 ${c.confirmedBy}`);
          }
        }
      }

      await axios.post(`${RESTAURANT_API()}/sendMessage`, {
        chat_id: chatId, text: lines.join('\n').substring(0, 4000), parse_mode: 'Markdown'
      }).catch(async () => {
        const plain = lines.join('\n').replace(/[*_`]/g, '').substring(0, 4000);
        await axios.post(`${RESTAURANT_API()}/sendMessage`, { chat_id: chatId, text: plain }).catch(() => {});
      });
      return;
    }

    // ── rest_jp_tt:{tourType}:{year} — Admin: show restaurants for this tour type + year ──
    if (data.startsWith('rest_jp_tt:')) {
      const jpParts = data.split(':');
      const tourType = jpParts[1]; // ER | CO | KAS
      const year = jpParts[2] ? parseInt(jpParts[2]) : new Date().getFullYear();
      await axios.post(`${RESTAURANT_API()}/answerCallbackQuery`, {
        callback_query_id: callbackQueryId, text: `${tourType} yuklanmoqda...`, show_alert: false
      }).catch(() => {});

      const tourTypeRecord = await prisma.tourType.findUnique({ where: { code: tourType } });
      if (!tourTypeRecord) return;

      // Find distinct restaurants that have JP confirmations for this tour type + year
      const startOfYear = new Date(`${year}-01-01`);
      const endOfYear   = new Date(`${year}-12-31`);
      const confs = await prisma.mealConfirmation.findMany({
        where: { source: 'JP', booking: { tourTypeId: tourTypeRecord.id, arrivalDate: { gte: startOfYear, lte: endOfYear } } },
        select: { restaurantName: true },
        distinct: ['restaurantName'],
        orderBy: { restaurantName: 'asc' }
      });

      if (!confs.length) {
        await axios.post(`${RESTAURANT_API()}/sendMessage`, {
          chat_id: fromChatId, text: `📄 *${tourType} ${year}* — Hech qanday restoran topilmadi.`, parse_mode: 'Markdown'
        }).catch(() => {});
        return;
      }

      // Build inline keyboard — one button per restaurant (year in callback)
      const rows = confs.map(c => [{
        text: `🍽 ${c.restaurantName}`,
        callback_data: `rest_jp_rest:${tourType}:${year}:${c.restaurantName}`.substring(0, 64)
      }]);

      await axios.post(`${RESTAURANT_API()}/sendMessage`, {
        chat_id: fromChatId,
        text: `📄 *Заявка ${year} — ${tourType}*\nRestoranni tanlang:`,
        parse_mode: 'Markdown',
        reply_markup: JSON.stringify({ inline_keyboard: rows })
      }).catch(() => {});
      return;
    }

    // ── rest_jp_rest:{tourType}:{year}:{restaurantName} — show JP confirmations ──
    if (data.startsWith('rest_jp_rest:')) {
      const jpRestParts = data.split(':');
      const tourType = jpRestParts[1];
      const year = jpRestParts[2] ? parseInt(jpRestParts[2]) : new Date().getFullYear();
      // restName starts after third colon: rest_jp_rest:ER:2026:RestName
      const thirdColon = data.indexOf(':', data.indexOf(':', data.indexOf(':') + 1) + 1);
      const restName = thirdColon !== -1 ? data.substring(thirdColon + 1) : jpRestParts.slice(2).join(':');
      await axios.post(`${RESTAURANT_API()}/answerCallbackQuery`, {
        callback_query_id: callbackQueryId, text: `${restName} yuklanmoqda...`, show_alert: false
      }).catch(() => {});

      const tourTypeRecord = await prisma.tourType.findUnique({ where: { code: tourType } });
      if (!tourTypeRecord) return;

      const startOfYear = new Date(`${year}-01-01`);
      const endOfYear   = new Date(`${year}-12-31`);
      const confs = await prisma.mealConfirmation.findMany({
        where: { source: 'JP', restaurantName: restName, booking: { tourTypeId: tourTypeRecord.id, arrivalDate: { gte: startOfYear, lte: endOfYear } } },
        include: { booking: { select: { bookingNumber: true } } },
        orderBy: { mealDate: 'asc' }
      });
      confs.sort((a, b) => {
        const an = a.booking?.bookingNumber || '';
        const bn = b.booking?.bookingNumber || '';
        return an.localeCompare(bn, undefined, { numeric: true });
      });

      const ST = { PENDING: '⏳', CONFIRMED: '✅', REJECTED: '❌' };
      const lines = [`📄 *${tourType} ${year} — ${restName}*`];
      if (!confs.length) {
        lines.push('\nHech narsa topilmadi.');
      } else {
        for (const c of confs) {
          lines.push(`\n${ST[c.status] || '⏳'} ${c.booking?.bookingNumber || '#' + c.bookingId}`);
          if (c.mealDate) lines.push(`📅 ${c.mealDate}`);
          if (c.pax) lines.push(`👥 ${c.pax} kishi`);
          if (c.confirmedBy) lines.push(`👤 ${c.confirmedBy}`);
        }
      }

      await axios.post(`${RESTAURANT_API()}/sendMessage`, {
        chat_id: fromChatId, text: lines.join('\n').substring(0, 4000), parse_mode: 'Markdown'
      }).catch(async () => {
        const plain = lines.join('\n').replace(/[*_`]/g, '').substring(0, 4000);
        await axios.post(`${RESTAURANT_API()}/sendMessage`, { chat_id: fromChatId, text: plain }).catch(() => {});
      });
      return;
    }

    // ── rest_anu_tt:{tourType} — Admin: show restaurants for Anulyatsiya ──
    if (data.startsWith('rest_anu_tt:')) {
      const tourType = data.split(':')[1];
      await axios.post(`${RESTAURANT_API()}/answerCallbackQuery`, {
        callback_query_id: callbackQueryId, text: `${tourType} yuklanmoqda...`, show_alert: false
      }).catch(() => {});

      const tourTypeRecord = await prisma.tourType.findUnique({ where: { code: tourType } });
      if (!tourTypeRecord) return;

      // Distinct restaurants from STORNO meal confirmations for this tour type
      const rejConfs = await prisma.mealConfirmation.findMany({
        where: { source: 'STORNO', booking: { tourTypeId: tourTypeRecord.id } },
        select: { restaurantName: true },
        distinct: ['restaurantName'],
        orderBy: { restaurantName: 'asc' }
      });

      if (!rejConfs.length) {
        await axios.post(`${RESTAURANT_API()}/sendMessage`, {
          chat_id: fromChatId, text: `❌ *${tourType}* — Hech qanday restoran topilmadi.`, parse_mode: 'Markdown'
        }).catch(() => {});
        return;
      }

      const rows = rejConfs.map(c => [{
        text: `🍽 ${c.restaurantName}`,
        callback_data: `rest_anu_rest:${tourType}:${c.restaurantName}`.substring(0, 64)
      }]);

      await axios.post(`${RESTAURANT_API()}/sendMessage`, {
        chat_id: fromChatId,
        text: `❌ *Anulyatsiya — ${tourType}*\nRestoranni tanlang:`,
        parse_mode: 'Markdown',
        reply_markup: JSON.stringify({ inline_keyboard: rows })
      }).catch(() => {});
      return;
    }

    // ── rest_anu_rest:{tourType}:{restaurantName} — show rejected + cancelled ──
    if (data.startsWith('rest_anu_rest:')) {
      const idx = data.indexOf(':', data.indexOf(':') + 1) + 1;
      const tourType = data.split(':')[1];
      const restName = data.substring(idx);
      await axios.post(`${RESTAURANT_API()}/answerCallbackQuery`, {
        callback_query_id: callbackQueryId, text: `${restName} yuklanmoqda...`, show_alert: false
      }).catch(() => {});

      const tourTypeRecord = await prisma.tourType.findUnique({ where: { code: tourType } });
      if (!tourTypeRecord) return;

      const stornoConfs = await prisma.mealConfirmation.findMany({
        where: { source: 'STORNO', restaurantName: restName, booking: { tourTypeId: tourTypeRecord.id } },
        include: { booking: { select: { bookingNumber: true, arrivalDate: true, endDate: true } } },
        orderBy: { sentAt: 'desc' }
      });

      const ST2 = { PENDING: '⏳', CONFIRMED: '✅', REJECTED: '❌' };
      const lines = [`❌ *${tourType} — ${restName}*`];
      if (!stornoConfs.length) {
        lines.push('\nHech narsa topilmadi.');
      } else {
        for (const c of stornoConfs) {
          lines.push(`\n${ST2[c.status] || '⏳'} *${c.booking?.bookingNumber || '#' + c.bookingId}*`);
          if (c.mealDate) lines.push(`📅 ${c.mealDate}`);
          if (c.confirmedBy) lines.push(`👤 ${c.confirmedBy}`);
        }
      }

      await axios.post(`${RESTAURANT_API()}/sendMessage`, {
        chat_id: fromChatId, text: lines.join('\n').substring(0, 4000), parse_mode: 'Markdown'
      }).catch(async () => {
        const plain = lines.join('\n').replace(/[*_`]/g, '').substring(0, 4000);
        await axios.post(`${RESTAURANT_API()}/sendMessage`, { chat_id: fromChatId, text: plain }).catch(() => {});
      });
      return;
    }

    // ── rest_rad_tt:{tourType} — Admin: show restaurants for Rad etilgan ──
    if (data.startsWith('rest_rad_tt:')) {
      const tourType = data.split(':')[1];
      await axios.post(`${RESTAURANT_API()}/answerCallbackQuery`, {
        callback_query_id: callbackQueryId, text: `${tourType} yuklanmoqda...`, show_alert: false
      }).catch(() => {});

      const tourTypeRecord = await prisma.tourType.findUnique({ where: { code: tourType } });
      if (!tourTypeRecord) return;

      const rejConfs = await prisma.mealConfirmation.findMany({
        where: { source: 'BOOKING', status: 'REJECTED', booking: { tourTypeId: tourTypeRecord.id } },
        select: { restaurantName: true },
        distinct: ['restaurantName'],
        orderBy: { restaurantName: 'asc' }
      });

      if (!rejConfs.length) {
        await axios.post(`${RESTAURANT_API()}/sendMessage`, {
          chat_id: fromChatId, text: `🚫 *${tourType}* — Rad etilgan zayavka topilmadi.`, parse_mode: 'Markdown'
        }).catch(() => {});
        return;
      }

      const rows = rejConfs.map(c => [{
        text: `🍽 ${c.restaurantName}`,
        callback_data: `rest_rad_rest:${tourType}:${c.restaurantName}`.substring(0, 64)
      }]);

      await axios.post(`${RESTAURANT_API()}/sendMessage`, {
        chat_id: fromChatId,
        text: `🚫 *Rad etilgan — ${tourType}*\nRestoranni tanlang:`,
        parse_mode: 'Markdown',
        reply_markup: JSON.stringify({ inline_keyboard: rows })
      }).catch(() => {});
      return;
    }

    // ── rest_rad_rest:{tourType}:{restaurantName} — show BOOKING REJECTED records ──
    if (data.startsWith('rest_rad_rest:')) {
      const idx = data.indexOf(':', data.indexOf(':') + 1) + 1;
      const tourType = data.split(':')[1];
      const restName = data.substring(idx);
      await axios.post(`${RESTAURANT_API()}/answerCallbackQuery`, {
        callback_query_id: callbackQueryId, text: `${restName} yuklanmoqda...`, show_alert: false
      }).catch(() => {});

      const tourTypeRecord = await prisma.tourType.findUnique({ where: { code: tourType } });
      if (!tourTypeRecord) return;

      const rejConfs = await prisma.mealConfirmation.findMany({
        where: { source: 'BOOKING', status: 'REJECTED', restaurantName: restName, booking: { tourTypeId: tourTypeRecord.id } },
        include: { booking: { select: { bookingNumber: true, arrivalDate: true, endDate: true } } },
        orderBy: { sentAt: 'desc' }
      });

      const lines = [`🚫 *${tourType} — ${restName}*`];
      if (!rejConfs.length) {
        lines.push('\nHech narsa topilmadi.');
      } else {
        for (const c of rejConfs) {
          lines.push(`\n❌ *${c.booking?.bookingNumber || '#' + c.bookingId}*`);
          if (c.mealDate) lines.push(`📅 ${c.mealDate}`);
          if (c.pax) lines.push(`👥 ${c.pax} kishi`);
          if (c.confirmedBy) lines.push(`👤 Rad etdi: ${c.confirmedBy}`);
        }
      }

      await axios.post(`${RESTAURANT_API()}/sendMessage`, {
        chat_id: fromChatId, text: lines.join('\n').substring(0, 4000), parse_mode: 'Markdown'
      }).catch(async () => {
        const plain = lines.join('\n').replace(/[*_`]/g, '').substring(0, 4000);
        await axios.post(`${RESTAURANT_API()}/sendMessage`, { chat_id: fromChatId, text: plain }).catch(() => {});
      });
      return;
    }

    // ── rest_tasd_tt:{tourType} — Admin: show restaurants for Tasdiqlangan ──
    if (data.startsWith('rest_tasd_tt:')) {
      const tourType = data.split(':')[1];
      await axios.post(`${RESTAURANT_API()}/answerCallbackQuery`, {
        callback_query_id: callbackQueryId, text: `${tourType} yuklanmoqda...`, show_alert: false
      }).catch(() => {});

      const tourTypeRecord = await prisma.tourType.findUnique({ where: { code: tourType } });
      if (!tourTypeRecord) return;

      const confs = await prisma.mealConfirmation.findMany({
        where: { source: 'BOOKING', status: 'CONFIRMED', booking: { tourTypeId: tourTypeRecord.id } },
        select: { restaurantName: true },
        distinct: ['restaurantName'],
        orderBy: { restaurantName: 'asc' }
      });

      if (!confs.length) {
        await axios.post(`${RESTAURANT_API()}/sendMessage`, {
          chat_id: fromChatId, text: `✅ *${tourType}* — Hech qanday restoran topilmadi.`, parse_mode: 'Markdown'
        }).catch(() => {});
        return;
      }

      const rows = confs.map(c => [{
        text: `🍽 ${c.restaurantName}`,
        callback_data: `rest_tasd_rest:${tourType}:${c.restaurantName}`.substring(0, 64)
      }]);

      await axios.post(`${RESTAURANT_API()}/sendMessage`, {
        chat_id: fromChatId,
        text: `✅ *Tasdiqlangan — ${tourType}*\nRestoranni tanlang:`,
        parse_mode: 'Markdown',
        reply_markup: JSON.stringify({ inline_keyboard: rows })
      }).catch(() => {});
      return;
    }

    // ── rest_tasd_rest:{tourType}:{restaurantName} — show confirmed bookings ──
    if (data.startsWith('rest_tasd_rest:')) {
      const idx = data.indexOf(':', data.indexOf(':') + 1) + 1;
      const tourType = data.split(':')[1];
      const restName = data.substring(idx);
      await axios.post(`${RESTAURANT_API()}/answerCallbackQuery`, {
        callback_query_id: callbackQueryId, text: `${restName} yuklanmoqda...`, show_alert: false
      }).catch(() => {});

      const tourTypeRecord = await prisma.tourType.findUnique({ where: { code: tourType } });
      if (!tourTypeRecord) return;

      const confs = await prisma.mealConfirmation.findMany({
        where: { source: 'BOOKING', status: 'CONFIRMED', restaurantName: restName, booking: { tourTypeId: tourTypeRecord.id } },
        include: {
          booking: { select: { bookingNumber: true, guide: { select: { name: true, phone: true } } } }
        },
        orderBy: { sentAt: 'desc' }
      });

      const lines = [`✅ *${tourType} — ${restName}*`];
      if (!confs.length) {
        lines.push('\nHech narsa topilmadi.');
      } else {
        for (const c of confs) {
          lines.push(`\n✅ *${c.booking?.bookingNumber || '#' + c.bookingId}*`);
          if (c.mealDate) lines.push(`📅 ${c.mealDate}`);
          if (c.pax) lines.push(`👥 ${c.pax} kishi`);
          if (c.pricePerPerson) lines.push(`💰 Narx: ${Number(c.pricePerPerson).toLocaleString('ru-RU')} UZS/kishi`);
          if (c.pricePerPerson && c.pax) lines.push(`💵 Jami: ${(c.pricePerPerson * c.pax).toLocaleString('ru-RU')} UZS`);
          const guide = c.booking?.guide;
          if (guide?.name) lines.push(`🧭 Gid: ${guide.name}${guide.phone ? '  ' + guide.phone : ''}`);
          if (c.confirmedBy) lines.push(`👤 Tasdiqladi: ${c.confirmedBy}`);
        }
      }

      await axios.post(`${RESTAURANT_API()}/sendMessage`, {
        chat_id: fromChatId, text: lines.join('\n').substring(0, 4000), parse_mode: 'Markdown'
      }).catch(async () => {
        const plain = lines.join('\n').replace(/[*_`]/g, '').substring(0, 4000);
        await axios.post(`${RESTAURANT_API()}/sendMessage`, { chat_id: fromChatId, text: plain }).catch(() => {});
      });
      return;
    }

    // ── meal_confirm / meal_reject ───────────────────────────────────────
    if (data.startsWith('meal_confirm:') || data.startsWith('meal_reject:')) {
      const parts = data.split(':');
      const confId    = parseInt(parts[1]);
      const isConfirm = data.startsWith('meal_confirm:');
      const emoji     = isConfirm ? '✅' : '❌';

      await axios.post(`${RESTAURANT_API()}/answerCallbackQuery`, {
        callback_query_id: callbackQueryId,
        text: isConfirm ? '✅ Tasdiqlandi! Rahmat.' : '❌ Rad qilindi.',
        show_alert: false
      }).catch(() => {});

      if (cb.message?.message_id && fromChatId) {
        const statusLine = isConfirm
          ? `\n\n✅ ${mdSafe(fromName)} tomonidan tasdiqlandi`
          : `\n\n❌ ${mdSafe(fromName)} tomonidan rad qilindi`;
        // First remove buttons
        await axios.post(`${RESTAURANT_API()}/editMessageReplyMarkup`, {
          chat_id: fromChatId,
          message_id: cb.message.message_id,
          reply_markup: { inline_keyboard: [] }
        }).catch(() => {});
        // Then send status as new message
        await axios.post(`${RESTAURANT_API()}/sendMessage`, {
          chat_id: fromChatId,
          text: statusLine.trim(),
          parse_mode: 'Markdown'
        }).catch(() => {});
      }

      let mealConf = null;
      try {
        mealConf = await prisma.mealConfirmation.update({
          where: { id: confId },
          data: { status: isConfirm ? 'CONFIRMED' : 'REJECTED', confirmedBy: fromName, respondedAt: new Date() },
          include: {
            booking: { select: { bookingNumber: true, arrivalDate: true, endDate: true, guide: { select: { name: true, phone: true } } } }
          }
        });
      } catch (e) { console.warn('MealConfirmation update warn:', e.message); }

      const restAdminIds = await getBotAdminIds('restaurant');
      if (restAdminIds.length && mealConf) {
        const { booking, restaurantName, city, mealDate, pax } = mealConf;
        const tzNow = new Date(Date.now() + 5 * 60 * 60 * 1000);
        const timeStr = `${String(tzNow.getUTCHours()).padStart(2,'0')}:${String(tzNow.getUTCMinutes()).padStart(2,'0')}`;
        const adminMsg = [
          `${emoji} *${restaurantName}*`,
          `📋 ${booking?.bookingNumber || `#${mealConf.bookingId}`}`,
          city     ? `🏙 Shahar: *${city}*`   : null,
          mealDate ? `📅 Sana: *${mealDate}*` : null,
          pax      ? `👥 PAX: *${pax}* kishi` : null,
          booking?.guide?.name ? `🧭 Gid: *${booking.guide.name}*${booking.guide.phone ? `  ${booking.guide.phone}` : ''}` : null,
          `👤 ${isConfirm ? 'TASDIQLADI' : 'RAD ETDI'}: ${mdSafe(fromName)}`,
          `🕐 ${fmtDateUtil(new Date())} ${timeStr}`
        ].filter(Boolean).join('\n');
        for (const id of restAdminIds) {
          await axios.post(`${RESTAURANT_API()}/sendMessage`, { chat_id: id, text: adminMsg, parse_mode: 'Markdown' })
            .catch(async () => {
              await axios.post(`${RESTAURANT_API()}/sendMessage`, { chat_id: id, text: adminMsg.replace(/[*_`]/g, '') }).catch(() => {});
            });
        }
      }
      return;
    }

  } catch (err) {
    console.error('Restaurant webhook error:', err.response?.data || err.message);
  }
});

// ============================================================
// Guide Bot Webhook
// ============================================================

// POST /api/telegram/webhook-guide - Receive updates from Guide Bot
router.post('/webhook-guide', verifyWebhookSecret, async (req, res) => {
  res.sendStatus(200);
  try {
    const update = req.body;

    // Save incoming chat to known chats
    const msg = update.message || update.channel_post;
    if (msg) {
      const chat = msg.chat;

      // /start — welcome message + send guide menu (only if already has a role)
      if (msg.text === '/start') {
        await handleStart(chat, msg, GUIDE_API());
        const startChats = await loadKnownChats();
        const startRole = startChats[String(chat.id)]?.role;
        if (startRole === 'guide' || startRole === 'admin') {
          const startAdminIds = await getBotAdminIds('guide');
          await sendGuideMenu(chat.id, startAdminIds.map(String).includes(String(chat.id)));
        }
        return;
      }

      // Language selection
      if (msg.text === "🇺🇿 O'zbek tili" || msg.text === "🇷🇺 Русский язык") {
        const lang = msg.text.includes("O'zbek") ? 'uz' : 'ru';
        const chats = await loadKnownChats();
        if (chats[String(chat.id)]) { chats[String(chat.id)].lang = lang; await saveKnownChats(chats); }
        await axios.post(`${GUIDE_API()}/sendMessage`, {
          chat_id: chat.id, text: T.langSelected[lang], parse_mode: 'Markdown',
          reply_markup: JSON.stringify({ remove_keyboard: true })
        }).catch(() => {});
        return;
      }

      // Contact shared — save phone number
      if (msg.contact) {
        const phone = msg.contact.phone_number;
        const chats = await loadKnownChats();
        const lang = chats[String(chat.id)]?.lang || 'uz';
        if (chats[String(chat.id)]) {
          chats[String(chat.id)].phone = phone;
          await saveKnownChats(chats);
        }
        await axios.post(`${GUIDE_API()}/sendMessage`, {
          chat_id: chat.id,
          text: T.phoneSaved[lang],
          parse_mode: 'Markdown',
          reply_markup: JSON.stringify({ remove_keyboard: true })
        }).catch(() => {});
        return;
      }

      const chats = await loadKnownChats();
      const existing = chats[String(chat.id)] || {};
      const telegramName = chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ');
      chats[String(chat.id)] = {
        ...existing,
        chatId: String(chat.id),
        name: existing.nameCustomized ? existing.name : telegramName,
        username: chat.username ? `@${chat.username}` : (existing.username || null),
        type: chat.type,
        lastMessage: msg.text || '[file]',
        date: new Date(msg.date * 1000).toISOString()
      };
      await saveKnownChats(chats);

      // /menu command
      if (msg.text === '/menu') {
        const menuAdminIds = await getBotAdminIds('guide');
        await sendGuideMenu(chat.id, menuAdminIds.map(String).includes(String(chat.id)));
        return;
      }

      // Menu button handlers — directly show bookings for this guide (or all if admin)
      const GUIDE_MENU_BTNS_STATIC = ['✅ Tasdiqlangan', '❌ Anulyatsiya', '👤 Gidlar'];
      const isGruppalar = msg.text?.startsWith('📋 Gruppalar');
      const grpYearParsed = isGruppalar ? parseInt(msg.text.replace('📋 Gruppalar', '').trim()) : null;
      const grpYear = grpYearParsed || null; // null means no year in button text
      if (msg.text && (isGruppalar || GUIDE_MENU_BTNS_STATIC.includes(msg.text))) {
        const curYr = new Date().getFullYear();
        const guideAdminIds = await getBotAdminIds('guide');
        const isAdmin = guideAdminIds.map(String).includes(String(chat.id));
        const guide = await prisma.guide.findFirst({
          where: { telegramChatId: String(chat.id) },
          select: { id: true, name: true }
        });

        if (!isAdmin && !guide) {
          await axios.post(`${GUIDE_API()}/sendMessage`, { chat_id: chat.id, text: '⚠️ Siz tizimda gid sifatida ro\'yxatga olinmagan.' }).catch(() => {});
          return;
        }
        // If user is both admin AND a guide — act as guide (show own bookings only)
        const isAdminOnly = isAdmin && !guide;

        // If "📋 Gruppalar" pressed without a year → check available years
        if (isGruppalar && !grpYear) {
          let availYrs = [curYr];
          if (isAdminOnly) {
            const allGuideYearKeys = await prisma.systemSetting.findMany({
              where: { key: { startsWith: 'JP_GUIDE_YEARS_' } }, select: { value: true }
            });
            const yrs = [...new Set(
              allGuideYearKeys.flatMap(s => { try { return JSON.parse(s.value); } catch { return []; } })
                .filter(y => y >= curYr)
            )].sort();
            if (yrs.length) availYrs = yrs;
          } else if (guide) {
            const s = await prisma.systemSetting.findUnique({ where: { key: `JP_GUIDE_YEARS_${guide.id}` } });
            if (s) {
              const yrs = JSON.parse(s.value).filter(y => y >= curYr).sort();
              if (yrs.length) availYrs = yrs;
            }
          }
          if (availYrs.length === 1) {
            // Only one year — show bookings directly
            msg.text = `📋 Gruppalar ${availYrs[0]}`;
          } else {
            // Multiple years — show inline year picker
            await axios.post(`${GUIDE_API()}/sendMessage`, {
              chat_id: chat.id,
              text: '📋 *Qaysi yilni tanlang:*',
              parse_mode: 'Markdown',
              reply_markup: JSON.stringify({
                inline_keyboard: [availYrs.map(y => ({ text: `${y}`, callback_data: `grp_year:${y}` }))]
              })
            }).catch(() => {});
            return;
          }
        }

        const year = parseInt(msg.text.replace('📋 Gruppalar', '').trim()) || curYr;

        const fmtD  = d => { if (!d) return '—    '; const dt = new Date(d); return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}`; };
        const fmtDY = d => { if (!d) return '—'; const dt = new Date(d); return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.${dt.getFullYear()}`; };

        let bookings = [];
        let headerText = '';

        // For non-admin guides: show all sent bookings (both SCHEDULE and BOOKING sources)
        let sentBookingIds = null;
        if (!isAdminOnly && guide) {
          const sentRows = await prisma.guideConfirmation.findMany({
            where: { guideId: guide.id },
            select: { bookingId: true },
            distinct: ['bookingId']
          });
          sentBookingIds = sentRows.map(r => r.bookingId);
        }

        if (isGruppalar) {
          if (!isAdminOnly && sentBookingIds !== null && sentBookingIds.length === 0) {
            await axios.post(`${GUIDE_API()}/sendMessage`, {
              chat_id: chat.id,
              text: `📋 <b>${guide.name}</b>\n📅 ${year} yil\n\n<i>Hali jadval yuborilmagan.</i>`,
              parse_mode: 'HTML'
            }).catch(() => {});
            return;
          }
          const where = isAdminOnly
            ? { bookingYear: year, status: { not: 'CANCELLED' } }
            : { id: { in: sentBookingIds }, bookingYear: year, status: { not: 'CANCELLED' } };
          bookings = await prisma.booking.findMany({
            where,
            select: {
              bookingNumber: true, departureDate: true, arrivalDate: true, endDate: true,
              guide: { select: { name: true } }
            },
            orderBy: { arrivalDate: 'asc' }
          });
          headerText = isAdminOnly
            ? `📋 <b>Barcha gruppalar</b>\n📅 ${year} yil — jami <b>${bookings.length}</b> ta`
            : `📋 <b>${guide.name}</b>\n📅 ${year} yil jadvali — jami <b>${bookings.length}</b> ta guruh`;

        } else if (msg.text === '✅ Tasdiqlangan') {
          if (isAdminOnly) {
            // Admin: show ALL active guides as inline buttons
            const allGuides = await prisma.guide.findMany({
              where: { isActive: true },
              select: { id: true, name: true },
              orderBy: { name: 'asc' }
            });
            const seenNames = new Set();
            const uniqueGuides = allGuides.filter(g => { if (seenNames.has(g.name)) return false; seenNames.add(g.name); return true; });

            if (!uniqueGuides.length) {
              await axios.post(`${GUIDE_API()}/sendMessage`, {
                chat_id: chat.id,
                text: `✅ <b>Tasdiqlangan gruppalar</b>\n📅 ${year} yil\n\n<i>Hech narsa topilmadi.</i>`,
                parse_mode: 'HTML'
              }).catch(() => {});
            } else {
              const rows = [];
              for (let i = 0; i < uniqueGuides.length; i += 2) {
                rows.push(uniqueGuides.slice(i, i + 2).map(g => ({
                  text: g.name,
                  callback_data: `gfc:${g.id}:${year}`
                })));
              }
              await axios.post(`${GUIDE_API()}/sendMessage`, {
                chat_id: chat.id,
                text: `✅ <b>Tasdiqlangan gruppalar</b>\n📅 ${year} yil — <b>${uniqueGuides.length}</b> ta gid\n\nGidni tanlang:`,
                parse_mode: 'HTML',
                reply_markup: JSON.stringify({ inline_keyboard: rows })
              }).catch(() => {});
            }
            return;
          }
          // Guide: show bookings sent from Bookings section (source='BOOKING') regardless of booking status
          const bookingSentRows = await prisma.guideConfirmation.findMany({
            where: { guideId: guide.id, source: 'BOOKING' },
            select: { bookingId: true },
            distinct: ['bookingId']
          });
          const bookingSentIds = bookingSentRows.map(r => r.bookingId);
          const confirmedWhere = { id: { in: bookingSentIds }, bookingYear: year };
          bookings = await prisma.booking.findMany({
            where: confirmedWhere,
            select: {
              bookingNumber: true, departureDate: true, arrivalDate: true, endDate: true,
              guide: { select: { name: true } }
            },
            orderBy: { arrivalDate: 'asc' }
          });
          headerText = `✅ <b>Tasdiqlangan gruppalar</b>\n📅 ${year} yil — jami <b>${bookings.length}</b> ta`;

        } else if (msg.text === '❌ Anulyatsiya') {
          if (isAdminOnly) {
            const allGuidesRaw = await prisma.guide.findMany({
              where: { isActive: true },
              select: { id: true, name: true },
              orderBy: { name: 'asc' }
            });
            const seenNamesAnn = new Set();
            const allGuides = allGuidesRaw.filter(g => { if (seenNamesAnn.has(g.name)) return false; seenNamesAnn.add(g.name); return true; });
            const rows = [];
            for (let i = 0; i < allGuides.length; i += 2) {
              rows.push(allGuides.slice(i, i + 2).map(g => ({
                text: g.name,
                callback_data: `gann:${g.id}:${year}`
              })));
            }
            await axios.post(`${GUIDE_API()}/sendMessage`, {
              chat_id: chat.id,
              text: `❌ <b>Anulyatsiya qilingan gruppalar</b>\n📅 ${year} yil — <b>${allGuides.length}</b> ta gid\n\nGidni tanlang:`,
              parse_mode: 'HTML',
              reply_markup: JSON.stringify({ inline_keyboard: rows })
            }).catch(() => {});
            return;
          }
          // Guide: show own cancelled bookings (only JP-sent ones)
          const cancelledWhere = sentBookingIds !== null
            ? { id: { in: sentBookingIds }, status: 'CANCELLED' }
            : { guideId: guide.id, status: 'CANCELLED' };
          bookings = await prisma.booking.findMany({
            where: cancelledWhere,
            select: {
              bookingNumber: true, departureDate: true, arrivalDate: true, endDate: true,
              guide: { select: { name: true } }
            },
            orderBy: { arrivalDate: 'asc' }
          });
          headerText = `❌ <b>Anulyatsiya qilingan gruppalar</b>\n📅 ${year} yil — jami <b>${bookings.length}</b> ta`;

        } else if (msg.text === '👤 Gidlar') {
          const allGuidesRaw = await prisma.guide.findMany({
            where: { isActive: true },
            select: { id: true, name: true },
            orderBy: { name: 'asc' }
          });
          const seenNamesAll = new Set();
          const allGuides = allGuidesRaw.filter(g => { if (seenNamesAll.has(g.name)) return false; seenNamesAll.add(g.name); return true; });
          if (!allGuides.length) {
            await axios.post(`${GUIDE_API()}/sendMessage`, {
              chat_id: chat.id,
              text: `👤 <b>Gidlar</b>\n📅 ${year} yil\n\n<i>Hech narsa topilmadi.</i>`,
              parse_mode: 'HTML'
            }).catch(() => {});
          } else {
            const rows = [];
            for (let i = 0; i < allGuides.length; i += 2) {
              rows.push(allGuides.slice(i, i + 2).map(g => ({
                text: g.name,
                callback_data: `gall:${g.id}:${year}`
              })));
            }
            await axios.post(`${GUIDE_API()}/sendMessage`, {
              chat_id: chat.id,
              text: `👤 <b>Gidlar</b>\n📅 ${year} yil — <b>${allGuides.length}</b> ta gid\n\nGidni tanlang:`,
              parse_mode: 'HTML',
              reply_markup: JSON.stringify({ inline_keyboard: rows })
            }).catch(() => {});
          }
          return;
        }

        const SEP = '─'.repeat(24);
        const rows = bookings.map((b, i) => {
          const num   = String(i + 1).padStart(2);
          const grp   = (b.bookingNumber || '').padEnd(7);
          const start = fmtD(b.arrivalDate || b.departureDate).padEnd(6);
          const end   = fmtD(b.endDate);
          if (isAdmin) {
            const gName = (b.guide?.name || '—').substring(0, 9);
            return `<code>${num}. ${grp}${start}${end}</code> <i>${gName}</i>`;
          }
          return `<code>${num}. ${grp}${start}${end}</code>`;
        });

        const header = `<code> #  Guruh   Kelish Tugash</code>`;

        const lines = [
          headerText,
          '',
          header,
          `<code>${SEP}</code>`,
          ...(rows.length ? rows : [`<i>Hech narsa topilmadi.</i>`]),
        ];

        await axios.post(`${GUIDE_API()}/sendMessage`, {
          chat_id: chat.id,
          text: lines.join('\n').substring(0, 4096),
          parse_mode: 'HTML'
        }).catch(() => {});
        return;
      }

    }

    const cb = update.callback_query;
    if (!cb) return;

    const callbackQueryId = cb.id;
    const data = cb.data || '';
    const fromChatId = cb.message?.chat?.id;
    const adminChatId = await getGuideAdminChatId();

    // ── grp_year:{year} — admin/guide selects year from inline year picker ─
    if (data.startsWith('grp_year:')) {
      const year = parseInt(data.split(':')[1]);
      await axios.post(`${GUIDE_API()}/answerCallbackQuery`, { callback_query_id: callbackQueryId, show_alert: false }).catch(() => {});
      const guideAdminIds = await getBotAdminIds('guide');
      const isAdminCb = guideAdminIds.map(String).includes(String(fromChatId));
      const guide = await prisma.guide.findFirst({ where: { telegramChatId: String(fromChatId) }, select: { id: true, name: true } });
      const fmtD = d => { if (!d) return '—    '; const dt = new Date(d); return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}`; };
      const SEP = '─'.repeat(24);
      const where = isAdminCb
        ? { bookingYear: year, status: { not: 'CANCELLED' } }
        : { guideId: guide?.id, bookingYear: year, status: { not: 'CANCELLED' } };
      const bookings = await prisma.booking.findMany({
        where,
        select: { bookingNumber: true, arrivalDate: true, endDate: true, guide: { select: { name: true } } },
        orderBy: { arrivalDate: 'asc' }
      });
      const headerText = isAdminCb
        ? `📋 <b>Barcha gruppalar</b>\n📅 ${year} yil — jami <b>${bookings.length}</b> ta`
        : `📋 <b>${guide?.name || ''}</b>\n📅 ${year} yil jadvali — jami <b>${bookings.length}</b> ta guruh`;
      const rows = bookings.map((b, i) => {
        const num = String(i + 1).padStart(2);
        const grp = (b.bookingNumber || '').padEnd(7);
        const start = fmtD(b.arrivalDate || b.departureDate).padEnd(6);
        const end = fmtD(b.endDate);
        if (isAdminCb) {
          const gName = (b.guide?.name || '—').substring(0, 9);
          return `<code>${num}. ${grp}${start}${end}</code> <i>${gName}</i>`;
        }
        return `<code>${num}. ${grp}${start}${end}</code>`;
      });
      const lines = [headerText, '', `<code> #  Guruh   Kelish Tugash</code>`, `<code>${SEP}</code>`, ...(rows.length ? rows : [`<i>Hech narsa topilmadi.</i>`])];
      await axios.post(`${GUIDE_API()}/sendMessage`, {
        chat_id: fromChatId,
        text: lines.join('\n').substring(0, 4096),
        parse_mode: 'HTML'
      }).catch(() => {});
      return;
    }

    // ── gd_schedule_ok / gd_schedule_reject — guide confirms full schedule ─
    if (data.startsWith('gd_schedule_ok:') || data.startsWith('gd_schedule_reject:')) {
      const parts = data.split(':');
      const newStatus = data.startsWith('gd_schedule_ok:') ? 'CONFIRMED' : 'REJECTED';
      const guideId   = parseInt(parts[1]);
      const year      = parseInt(parts[2]);

      await axios.post(`${GUIDE_API()}/answerCallbackQuery`, {
        callback_query_id: callbackQueryId,
        text: newStatus === 'CONFIRMED' ? '✅ Qabul qilindi!' : '❌ Rad etildi.',
        show_alert: false
      }).catch(() => {});

      try {
        const guide = await prisma.guide.findUnique({ where: { id: guideId }, select: { name: true } });
        const bookings = await prisma.booking.findMany({
          where: { guideId, bookingYear: year, status: { not: 'CANCELLED' } },
          select: { id: true }
        });
        for (const b of bookings) {
          await prisma.guideConfirmation.upsert({
            where: { bookingId_guideId: { bookingId: b.id, guideId } },
            create: { bookingId: b.id, guideId, status: newStatus, respondedAt: new Date(), confirmedBy: guide?.name || '' },
            update: { status: newStatus, respondedAt: new Date(), confirmedBy: guide?.name || '' }
          });
        }
        const emoji = newStatus === 'CONFIRMED' ? '✅' : '❌';
        const label = newStatus === 'CONFIRMED' ? 'Qabul qilindi' : 'Rad etildi';
        await axios.post(`${GUIDE_API()}/editMessageReplyMarkup`, {
          chat_id: fromChatId, message_id: cb.message?.message_id,
          reply_markup: JSON.stringify({ inline_keyboard: [[{ text: `${emoji} ${label}`, callback_data: 'noop' }]] })
        }).catch(() => {});
        const guideAdminIds = await getBotAdminIds('guide');
        for (const adminId of guideAdminIds) {
          await axios.post(`${GUIDE_API()}/sendMessage`, {
            chat_id: adminId,
            text: `${emoji} <b>${guide?.name || 'Gid'}</b> — ${year} yil jadvali: ${label.toLowerCase()} (${bookings.length} guruh)`,
            parse_mode: 'HTML'
          }).catch(() => {});
        }
      } catch (e) { console.error('gd_schedule error:', e.message); }
      return;
    }

    // ── gd_ok / gd_reject — guide confirms/rejects booking ────────────────
    // ── gfc:{guideId}:{year} — admin taps guide name → show confirmed bookings ─
    if (data.startsWith('gfc:')) {
      const parts = data.split(':');
      const guideId = parseInt(parts[1]);
      const year    = parseInt(parts[2]);

      await axios.post(`${GUIDE_API()}/answerCallbackQuery`, {
        callback_query_id: callbackQueryId, show_alert: false
      }).catch(() => {});

      const guide = await prisma.guide.findUnique({ where: { id: guideId }, select: { name: true } });
      const bookings = await prisma.booking.findMany({
        where: { guideId, bookingYear: year, status: { in: ['FINAL_CONFIRMED', 'COMPLETED'] } },
        select: { bookingNumber: true, arrivalDate: true, endDate: true },
        orderBy: { arrivalDate: 'asc' }
      });

      const fmtD = d => { if (!d) return '——'; const dt = new Date(d); return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}`; };
      const SEP = '─'.repeat(24);

      const rows = bookings.map((b, i) => {
        const num   = String(i + 1).padStart(2);
        const grp   = (b.bookingNumber || '').padEnd(7);
        const start = fmtD(b.arrivalDate).padEnd(6);
        const end   = fmtD(b.endDate);
        return `<code>${num}. ${grp}${start}${end}</code>`;
      });

      const lines = [
        `✅ <b>${guide?.name || 'Gid'}</b> — tasdiqlangan`,
        `📅 ${year} yil — jami <b>${bookings.length}</b> ta`,
        '',
        `<code> #  Guruh   Kelish Tugash</code>`,
        `<code>${SEP}</code>`,
        ...(rows.length ? rows : [`<i>Hech narsa topilmadi.</i>`]),
      ];

      await axios.post(`${GUIDE_API()}/sendMessage`, {
        chat_id: fromChatId,
        text: lines.join('\n').substring(0, 4096),
        parse_mode: 'HTML'
      }).catch(() => {});
      return;
    }

    // ── gann:{guideId}:{year} — admin taps guide → show cancelled bookings ──
    if (data.startsWith('gann:')) {
      const parts = data.split(':');
      const guideId = parseInt(parts[1]);
      const year    = parseInt(parts[2]);

      await axios.post(`${GUIDE_API()}/answerCallbackQuery`, {
        callback_query_id: callbackQueryId, show_alert: false
      }).catch(() => {});

      const guide = await prisma.guide.findUnique({ where: { id: guideId }, select: { name: true } });
      const bookings = await prisma.booking.findMany({
        where: { guideId, status: 'CANCELLED', bookingYear: year },
        select: { bookingNumber: true, arrivalDate: true, endDate: true },
        orderBy: { arrivalDate: 'asc' }
      });

      const fmtD = d => { if (!d) return '——'; const dt = new Date(d); return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}`; };
      const SEP = '─'.repeat(24);

      const rows = bookings.map((b, i) => {
        const num   = String(i + 1).padStart(2);
        const grp   = (b.bookingNumber || '').padEnd(7);
        const start = fmtD(b.arrivalDate).padEnd(6);
        const end   = fmtD(b.endDate);
        return `<code>${num}. ${grp}${start}${end}</code>`;
      });

      const lines = [
        `❌ <b>${guide?.name || 'Gid'}</b> — anulyatsiya`,
        `📅 ${year} yil — jami <b>${bookings.length}</b> ta`,
        '',
        `<code> #  Guruh   Kelish Tugash</code>`,
        `<code>${SEP}</code>`,
        ...(rows.length ? rows : [`<i>Hech narsa topilmadi.</i>`]),
      ];

      await axios.post(`${GUIDE_API()}/sendMessage`, {
        chat_id: fromChatId,
        text: lines.join('\n').substring(0, 4096),
        parse_mode: 'HTML'
      }).catch(() => {});
      return;
    }

    // ── gall:{guideId}:{year} — admin taps guide → show all bookings ──
    if (data.startsWith('gall:')) {
      const parts = data.split(':');
      const guideId = parseInt(parts[1]);
      const year    = parseInt(parts[2]);

      await axios.post(`${GUIDE_API()}/answerCallbackQuery`, {
        callback_query_id: callbackQueryId, show_alert: false
      }).catch(() => {});

      const guide = await prisma.guide.findUnique({ where: { id: guideId }, select: { name: true } });
      const bookings = await prisma.booking.findMany({
        where: { guideId, bookingYear: year },
        select: { bookingNumber: true, arrivalDate: true, endDate: true, status: true },
        orderBy: { arrivalDate: 'asc' }
      });

      const fmtD = d => { if (!d) return '——'; const dt = new Date(d); return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}`; };
      const SEP = '─'.repeat(24);

      const rows = bookings.map((b, i) => {
        const num   = String(i + 1).padStart(2);
        const grp   = (b.bookingNumber || '').padEnd(7);
        const start = fmtD(b.arrivalDate).padEnd(6);
        const end   = fmtD(b.endDate);
        const tag   = b.status === 'CANCELLED' ? ' ❌' : '';
        return `<code>${num}. ${grp}${start}${end}</code>${tag}`;
      });

      const lines = [
        `👤 <b>${guide?.name || 'Gid'}</b>`,
        `📅 ${year} yil — jami <b>${bookings.length}</b> ta guruh`,
        '',
        `<code> #  Guruh   Kelish Tugash</code>`,
        `<code>${SEP}</code>`,
        ...(rows.length ? rows : [`<i>Hech narsa topilmadi.</i>`]),
      ];

      await axios.post(`${GUIDE_API()}/sendMessage`, {
        chat_id: fromChatId,
        text: lines.join('\n').substring(0, 4096),
        parse_mode: 'HTML'
      }).catch(() => {});
      return;
    }

    if (data.startsWith('gd_ok:') || data.startsWith('gd_reject:')) {
      const parts = data.split(':');
      const newStatus = data.startsWith('gd_ok:') ? 'CONFIRMED' : 'REJECTED';
      const bookingId = parseInt(parts[1]);
      const guideId   = parseInt(parts[2]);

      await axios.post(`${GUIDE_API()}/answerCallbackQuery`, {
        callback_query_id: callbackQueryId,
        text: newStatus === 'CONFIRMED' ? '✅ Qabul qilindi!' : '❌ Rad etildi.',
        show_alert: false
      }).catch(() => {});

      try {
        const guide = await prisma.guide.findUnique({ where: { id: guideId }, select: { name: true } });
        const booking = await prisma.booking.findUnique({ where: { id: bookingId }, select: { bookingNumber: true } });

        await prisma.guideConfirmation.upsert({
          where: { bookingId_guideId: { bookingId, guideId } },
          create: { bookingId, guideId, status: newStatus, respondedAt: new Date(), confirmedBy: guide?.name || '' },
          update: { status: newStatus, respondedAt: new Date(), confirmedBy: guide?.name || '' }
        });

        // Edit the original message to show result
        const emoji = newStatus === 'CONFIRMED' ? '✅' : '❌';
        const label = newStatus === 'CONFIRMED' ? 'Qabul qilindi' : 'Rad etildi';
        await axios.post(`${GUIDE_API()}/editMessageReplyMarkup`, {
          chat_id: fromChatId,
          message_id: cb.message?.message_id,
          reply_markup: JSON.stringify({ inline_keyboard: [[{ text: `${emoji} ${label}`, callback_data: 'noop' }]] })
        }).catch(() => {});

        // Notify guide admins
        const guideAdminIds = await getBotAdminIds('guide');
        for (const adminId of guideAdminIds) {
          await axios.post(`${GUIDE_API()}/sendMessage`, {
            chat_id: adminId,
            text: `${emoji} *${guide?.name || 'Gid'}* — *${booking?.bookingNumber || bookingId}* ga ${label.toLowerCase()}`,
            parse_mode: 'Markdown'
          }).catch(() => {});
        }
      } catch (e) { console.error('gd_ok/reject error:', e.message); }
      return;
    }

    // ── guide_conf:{statusKey}:{tourType} ─────────────────────────────────
    if (data.startsWith('guide_conf:')) {
      const parts = data.split(':');
      const statusKey = parts[1]; // CONFIRMED | PENDING | REJECTED
      const tourType  = parts[2]; // ER | CO | KAS | ZA
      const chatId = fromChatId || cb.from?.id;
      const isAdminCb = (adminChatId && String(chatId) === String(adminChatId));
      const statusLabel = { CONFIRMED: '✅ Tasdiqlangan', PENDING: `📄 Заявка ${new Date().getFullYear()}`, REJECTED: '❌ Ануляция' }[statusKey] || statusKey;

      await axios.post(`${GUIDE_API()}/answerCallbackQuery`, {
        callback_query_id: callbackQueryId, text: `${tourType} yuklanmoqda...`, show_alert: false
      }).catch(() => {});

      const tourTypeRecord = await prisma.tourType.findUnique({ where: { code: tourType } });
      if (!tourTypeRecord) return;

      const fmt = d => { if (!d) return '—'; const dt = new Date(d); return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.${dt.getFullYear()}`; };
      const year = new Date().getFullYear();

      // Find guide by chatId (unless admin)
      let guideId = null;
      let guideName = null;
      if (!isAdminCb) {
        const guide = await prisma.guide.findFirst({ where: { telegramChatId: String(chatId) }, select: { id: true, name: true } });
        guideId = guide?.id || null;
        guideName = guide?.name || null;
      }

      const guideLabel = guideName ? ` (${guideName})` : '';
      const lines = [`${statusLabel} — *${tourType}${guideLabel}*`];

      if (statusKey === 'REJECTED') {
        // Ануляция — CANCELLED bookings
        const cancelled = await prisma.booking.findMany({
          where: { status: 'CANCELLED', tourTypeId: tourTypeRecord.id },
          select: { bookingNumber: true, departureDate: true, endDate: true, pax: true },
          orderBy: { arrivalDate: 'asc' }
        });
        if (cancelled.length) {
          lines.push(`\n🚫 *Отменённые группы ${year}*`);
          for (const b of cancelled) {
            lines.push(`\n❌ *${b.bookingNumber}*`);
            if (b.departureDate) lines.push(`📅 ${fmt(b.departureDate)} – ${fmt(b.endDate)}`);
          }
        } else {
          lines.push('\nHech narsa topilmadi.');
        }
      } else {
        // Заявка 2026 → IN_PROGRESS bookings | Tasdiqlangan → COMPLETED
        const statusFilter = statusKey === 'CONFIRMED' ? ['COMPLETED'] : ['IN_PROGRESS', 'CONFIRMED'];
        const where = {
          status: { in: statusFilter },
          tourTypeId: tourTypeRecord.id,
          bookingYear: year
        };
        if (guideId) where.guideId = guideId;

        const bookings = await prisma.booking.findMany({
          where,
          select: {
            bookingNumber: true, departureDate: true, endDate: true, pax: true,
            guide: { select: { name: true } }
          },
          orderBy: { departureDate: 'asc' },
          take: 30
        });

        if (!bookings.length) {
          lines.push('\nHech narsa topilmadi.');
        } else {
          for (const b of bookings) {
            const st = statusKey === 'CONFIRMED' ? '✅' : '📋';
            lines.push(`\n${st} *${b.bookingNumber}*`);
            if (b.departureDate) lines.push(`📅 ${fmt(b.departureDate)} – ${fmt(b.endDate)}`);
            if (b.pax) lines.push(`👥 ${b.pax} kishi`);
            if (!guideId && b.guide?.name) lines.push(`🧭 ${b.guide.name}`);
          }
        }
      }

      await axios.post(`${GUIDE_API()}/sendMessage`, {
        chat_id: chatId, text: lines.join('\n').substring(0, 4000), parse_mode: 'Markdown'
      }).catch(async () => {
        const plain = lines.join('\n').replace(/[*_`]/g, '').substring(0, 4000);
        await axios.post(`${GUIDE_API()}/sendMessage`, { chat_id: chatId, text: plain }).catch(() => {});
      });
      return;
    }

  } catch (err) {
    console.error('Guide webhook error:', err.response?.data || err.message);
  }
});

// ============================================================
// Hotel Notifications — Izmeneniya & Anulyatsiya
// ============================================================

// POST /api/telegram/send-changes/:bookingId/:hotelId
router.post('/send-changes/:bookingId/:hotelId', authenticate, upload.single('pdf'), async (req, res) => {
  try {
    const bookingId = parseInt(req.params.bookingId);
    const hotelId   = parseInt(req.params.hotelId);
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        tourType: true,
        accommodations: { where: { hotelId }, include: { rooms: true } }
      }
    });
    const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel?.telegramChatId) return res.status(400).json({ error: 'Hotel Telegram chat ID yo\'q' });

    const acc = booking?.accommodations?.[0];
    const dbl  = acc?.rooms?.filter(r => r.type === 'DBL').length || 0;
    const twn  = acc?.rooms?.filter(r => r.type === 'TWN').length || 0;
    const sngl = acc?.rooms?.filter(r => r.type === 'SNGL').length || 0;
    const checkIn  = fmtDateUtil(acc?.checkIn  || booking?.arrivalDate);
    const checkOut = fmtDateUtil(acc?.checkOut || booking?.endDate);
    const caption = [
      `📝 *Izmeneniye k Zayavke ${booking?.bookingNumber}*`,
      `🏨 ${hotel.name}`,
      '',
      `📅 Заезд: ${checkIn}`,
      `📅 Выезд: ${checkOut}`,
      `👥 PAX: ${booking?.pax || 0}`,
      `🛏 DBL: ${dbl}  |  TWN: ${twn}  |  SNGL: ${sngl}`,
    ].join('\n');

    const chgButtons = JSON.stringify({
      inline_keyboard: [[
        { text: '✅ Tasdiqlash', callback_data: `chg_c:${bookingId}:${hotelId}` },
        { text: '❌ Rad qilish', callback_data: `chg_r:${bookingId}:${hotelId}` }
      ]]
    });

    if (req.file?.buffer) {
      const form = new FormData();
      form.append('chat_id', hotel.telegramChatId);
      form.append('document', req.file.buffer, {
        filename: `Izmeneniye_${booking.bookingNumber}_${hotel.name}.pdf`,
        contentType: 'application/pdf'
      });
      form.append('caption', caption);
      form.append('parse_mode', 'Markdown');
      form.append('reply_markup', chgButtons);
      await axios.post(`${BOT_API()}/sendDocument`, form, { headers: form.getHeaders() });
    } else {
      await axios.post(`${BOT_API()}/sendMessage`, {
        chat_id: hotel.telegramChatId, text: caption, parse_mode: 'Markdown', reply_markup: chgButtons
      });
    }

    // Create TelegramConfirmation so admin "O'zgarishlar" shows it
    await prisma.telegramConfirmation.create({
      data: { bookingId, hotelId, status: 'PENDING' }
    });

    res.json({ success: true });
  } catch (e) {
    console.error('send-changes error:', e.message);
    res.status(500).json({ error: 'Yuborishda xatolik' });
  }
});

// POST /api/telegram/send-annulment/:bookingId/:hotelId
router.post('/send-annulment/:bookingId/:hotelId', authenticate, async (req, res) => {
  try {
    const bookingId = parseInt(req.params.bookingId);
    const hotelId   = parseInt(req.params.hotelId);
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { tourType: true, accommodations: { where: { hotelId } } }
    });
    const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel?.telegramChatId) return res.status(400).json({ error: 'Hotel Telegram chat ID yo\'q' });

    // Generate Storno PDF via Puppeteer
    const browser = await puppeteer.launch({ env: { ...process.env, HOME: '/tmp' }, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    const internalUrl = `http://localhost:${process.env.PORT || 3001}/api/bookings/${bookingId}/storno-combined/${hotelId}`;
    await page.setExtraHTTPHeaders({ 'x-internal-secret': process.env.INTERNAL_API_SECRET || '' });
    await page.goto(internalUrl, { waitUntil: 'networkidle0', timeout: 30000 });
    const pdfBuffer = Buffer.from(await page.pdf({ format: 'A4', printBackground: true }));
    await browser.close();

    const caption = `❌ АННУЛЯЦИЯ\n🏨 ${hotel.name}\n📋 ${booking?.bookingNumber}`;
    const filename = `storno_${booking?.bookingNumber}_${hotel.name.replace(/\s+/g, '_')}.pdf`;

    const annButtons = JSON.stringify({
      inline_keyboard: [[
        { text: '✅ Tasdiqlash', callback_data: `ann_c:${bookingId}:${hotelId}` }
      ]]
    });

    const formData = new FormData();
    formData.append('chat_id', hotel.telegramChatId);
    formData.append('document', pdfBuffer, { filename, contentType: 'application/pdf' });
    formData.append('caption', caption);
    formData.append('parse_mode', 'Markdown');
    formData.append('reply_markup', annButtons);

    await axios.post(`${BOT_API()}/sendDocument`, formData, { headers: formData.getHeaders() });

    // Create TelegramConfirmation so admin "Anulyatsiya" tab shows it
    await prisma.telegramConfirmation.create({
      data: { bookingId, hotelId, type: 'ANNULMENT', status: 'PENDING' }
    });

    res.json({ success: true });
  } catch (e) {
    console.error('send-annulment error:', e.message);
    res.status(500).json({ error: 'Yuborishda xatolik' });
  }
});

// ============================================================
// Transport Confirmations (Marshrut varaqasi)
// ============================================================

// POST /api/telegram/send-marshrut/:bookingId/:provider
router.post('/send-marshrut/:bookingId/:provider', authenticate, upload.single('pdf'), async (req, res) => {
  try {
    const { bookingId, provider } = req.params;
    const VALID_PROVIDERS = ['sevil', 'xayrulla', 'nosir', 'hammasi'];
    if (!VALID_PROVIDERS.includes(provider)) {
      return res.status(400).json({ error: 'Invalid provider' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'PDF file required' });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(bookingId) },
      select: {
        bookingNumber: true,
        departureDate: true,
        arrivalDate: true,
        endDate: true,
        pax: true,
        guide: { select: { name: true, phone: true } }
      }
    });
    if (!booking) {
      return res.status(404).json({ error: 'Booking topilmadi' });
    }

    const providerLabel = PROVIDER_LABELS[provider] || provider;
    const buildCaption = (label) => [
      `🚌 *Marshrut varaqasi*`,
      `📋 Booking: *${booking.bookingNumber}*`,
      `🚗 Transport: *${label}*`,
      booking.pax         ? `👥 PAX: *${booking.pax}* kishi`                      : null,
      booking.arrivalDate ? `📅 Boshlanishi: ${fmtDateUtil(booking.arrivalDate)}`  : null,
      booking.endDate     ? `🏁 Tugashi: ${fmtDateUtil(booking.endDate)}`          : null,
      booking.guide?.name ? `🧭 Gid: *${booking.guide.name}*${booking.guide.phone ? `  ${booking.guide.phone}` : ''}` : null,
    ].filter(Boolean).join('\n');

    const token = process.env.TELEGRAM_TRANSPORT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;

    if (provider === 'hammasi') {
      // ── Direct send: no 2-stage for "hammasi" ──────────────────────────────
      const chatId = await getProviderChatId('hammasi');
      if (!chatId) {
        return res.status(400).json({ error: 'Siroj uchun Telegram chat ID sozlanmagan' });
      }
      const replyMarkup = JSON.stringify({
        inline_keyboard: [[
          { text: '✅ Tasdiqlash', callback_data: `tr_confirm:${bookingId}:hammasi` },
          { text: '❌ Rad qilish', callback_data: `tr_reject:${bookingId}:hammasi` }
        ]]
      });
      const form = new FormData();
      form.append('chat_id', chatId);
      form.append('caption', buildCaption(providerLabel));
      form.append('parse_mode', 'Markdown');
      form.append('reply_markup', replyMarkup);
      form.append('document', req.file.buffer, {
        filename: req.file.originalname || `${booking.bookingNumber}_marshrut.pdf`,
        contentType: 'application/pdf'
      });
      await axios.post(`https://api.telegram.org/bot${token}/sendDocument`, form, {
        headers: form.getHeaders()
      });
      await prisma.transportConfirmation.create({
        data: { bookingId: parseInt(bookingId), provider: 'hammasi', status: 'PENDING', sentAt: new Date() }
      });

    } else {
      // ── 2-stage: send to approver (hammasi) first ──────────────────────────
      const approverChatId = await getProviderChatId('hammasi');
      if (!approverChatId) {
        return res.status(400).json({ error: 'Tasdiqlash uchun Siroj chat ID sozlanmagan (GmailSettings → Transport)' });
      }
      const approveMarkup = JSON.stringify({
        inline_keyboard: [[
          { text: `✅ ${providerLabel} ga yuborish`, callback_data: `tr_approve:${bookingId}:${provider}` },
          { text: '❌ Rad qilish',                   callback_data: `tr_decline:${bookingId}:${provider}` }
        ]]
      });
      const approverCaption = buildCaption(providerLabel) +
        `\n\n⚠️ _Tasdiqlasangiz, ${providerLabel} ga avtomatik yuboriladi_`;

      const form = new FormData();
      form.append('chat_id', approverChatId);
      form.append('caption', approverCaption);
      form.append('parse_mode', 'Markdown');
      form.append('reply_markup', approveMarkup);
      form.append('document', req.file.buffer, {
        filename: req.file.originalname || `${booking.bookingNumber}_marshrut.pdf`,
        contentType: 'application/pdf'
      });
      await axios.post(`https://api.telegram.org/bot${token}/sendDocument`, form, {
        headers: form.getHeaders()
      });
      await prisma.transportConfirmation.create({
        data: { bookingId: parseInt(bookingId), provider, status: 'PENDING_APPROVAL', sentAt: new Date() }
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Send marshrut telegram error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.description || err.message });
  }
});

// POST /api/telegram/send-storno-transport/:bookingId/:provider
router.post('/send-storno-transport/:bookingId/:provider', authenticate, async (req, res) => {
  try {
    const bookingId = parseInt(req.params.bookingId);
    const provider  = req.params.provider.toLowerCase();
    if (!['sevil', 'xayrulla', 'nosir'].includes(provider)) {
      return res.status(400).json({ error: 'Noto\'g\'ri provider' });
    }
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_TRANSPORT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
    if (!TELEGRAM_BOT_TOKEN) return res.status(500).json({ error: 'TELEGRAM_TRANSPORT_TOKEN sozlanmagan' });
    const TG_BASE = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { bookingNumber: true, arrivalDate: true, endDate: true, pax: true, status: true }
    });
    if (!booking) return res.status(404).json({ error: 'Booking topilmadi' });
    if (booking.status !== 'CANCELLED') return res.status(400).json({ error: 'Booking bekor qilinmagan' });

    const hammasiChatId = await getProviderChatId('hammasi');
    if (!hammasiChatId) return res.status(400).json({ error: 'Hammasi chat ID sozlanmagan' });

    const providerLabel = PROVIDER_LABELS[provider] || provider;
    const fmtD = d => { if (!d) return '—'; const dt = new Date(d); return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.${dt.getFullYear()}`; };

    const approvalText = [
      `🚫 *АННУЛЯЦИЯ — ${booking.bookingNumber}*`,
      `🚗 Transport: *${providerLabel}*`,
      booking.pax         ? `👥 PAX: *${booking.pax}* kishi`                    : null,
      booking.arrivalDate ? `📅 Boshlanishi: ${fmtD(booking.arrivalDate)}`       : null,
      booking.endDate     ? `🏁 Tugashi: ${fmtD(booking.endDate)}`               : null,
      ``,
      `Tasdiqlasangiz, *${providerLabel}* ga avtomatik yuboriladi.`
    ].filter(v => v !== null).join('\n');

    await axios.post(`${TG_BASE}/sendMessage`, {
      chat_id: hammasiChatId,
      text: approvalText,
      parse_mode: 'Markdown',
      reply_markup: JSON.stringify({ inline_keyboard: [[
        { text: `✅ ${providerLabel} ga yuborish`, callback_data: `st_approve:${bookingId}:${provider}` },
        { text: '❌ Rad etish',                    callback_data: `st_decline:${bookingId}:${provider}` }
      ]] })
    });

    await prisma.transportConfirmation.create({
      data: { bookingId, provider, source: 'STORNO', status: 'PENDING_APPROVAL' }
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Send storno transport error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.description || err.message });
  }
});

// GET /api/telegram/transport-confirmations
router.get('/transport-confirmations', authenticate, async (req, res) => {
  try {
    const year = req.query.year ? parseInt(req.query.year) : null;
    const where = year ? { booking: { bookingYear: year } } : {};
    const confirmations = await prisma.transportConfirmation.findMany({
      where,
      include: {
        booking: { select: { bookingNumber: true, departureDate: true } }
      },
      orderBy: { sentAt: 'desc' }
    });
    res.json({ confirmations });
  } catch (err) {
    console.error('Get transport confirmations error:', err.message);
    res.status(500).json({ error: 'Failed to fetch transport confirmations' });
  }
});

// DELETE /api/telegram/transport-confirmations/:id
router.delete('/transport-confirmations/:id', authenticate, async (req, res) => {
  try {
    await prisma.transportConfirmation.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete transport confirmation error:', err.message);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

// GET /api/telegram/transport-settings
router.get('/transport-settings', authenticate, async (req, res) => {
  try {
    const [sevil, xayrulla, nosir, hammasi, sevilPhone, xayrullaPhone, nosirPhone] = await Promise.all([
      getProviderChatId('sevil'),
      getProviderChatId('xayrulla'),
      getProviderChatId('nosir'),
      getProviderChatId('hammasi'),
      getProviderPhone('sevil'),
      getProviderPhone('xayrulla'),
      getProviderPhone('nosir'),
    ]);
    res.json({
      sevil: sevil || '', xayrulla: xayrulla || '', nosir: nosir || '', hammasi: hammasi || '',
      sevilPhone: sevilPhone || '', xayrullaPhone: xayrullaPhone || '', nosirPhone: nosirPhone || ''
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load transport settings' });
  }
});

// PUT /api/telegram/transport-settings
router.put('/transport-settings', authenticate, async (req, res) => {
  try {
    const { sevil, xayrulla, nosir, hammasi, sevilPhone, xayrullaPhone, nosirPhone } = req.body;
    await Promise.all([
      setProviderChatId('sevil',    String(sevil    || '').trim()),
      setProviderChatId('xayrulla', String(xayrulla || '').trim()),
      setProviderChatId('nosir',    String(nosir    || '').trim()),
      setProviderChatId('hammasi',  String(hammasi  || '').trim()),
      setProviderPhone('sevil',    String(sevilPhone    || '').trim()),
      setProviderPhone('xayrulla', String(xayrullaPhone || '').trim()),
      setProviderPhone('nosir',    String(nosirPhone    || '').trim()),
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save transport settings' });
  }
});

// ============================================================
// Guide Notifications (Gid Telegram)
// ============================================================

// GET /api/telegram/guide-assignments — bookings with guide info
router.get('/guide-assignments', authenticate, async (req, res) => {
  try {
    const year = req.query.year ? parseInt(req.query.year) : null;
    const where = year ? { booking: { bookingYear: year } } : {};
    const confs = await prisma.guideConfirmation.findMany({
      where,
      include: {
        booking: { select: { bookingNumber: true, departureDate: true, pax: true, status: true } },
        guide: { select: { id: true, name: true, telegramChatId: true } }
      },
      orderBy: { booking: { bookingNumber: 'asc' } }
    });

    const result = confs.map(c => ({
      id: c.id,
      bookingId: c.bookingId,
      bookingNumber: c.booking?.bookingNumber || '',
      departureDate: c.booking?.departureDate || null,
      pax: c.booking?.pax || 0,
      bookingStatus: c.booking?.status || null,
      guideId: c.guideId,
      guideName: c.guide?.name || null,
      hasTelegram: !!(c.guide?.telegramChatId),
      status: c.status,
      booking: { bookingNumber: c.booking?.bookingNumber, departureDate: c.booking?.departureDate }
    }));

    res.json({ assignments: result });
  } catch (err) {
    console.error('guide-assignments error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/telegram/guide-confirmations/:bookingId
router.delete('/guide-confirmations/:bookingId', authenticate, async (req, res) => {
  try {
    await prisma.guideConfirmation.deleteMany({ where: { bookingId: parseInt(req.params.bookingId) } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/telegram/send-guide/:bookingId
router.post('/send-guide/:bookingId', authenticate, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { guideName, guideType, fullDays, halfDays, dayRate, halfDayRate, totalPayment } = req.body;

    if (!guideName) return res.status(400).json({ error: 'guideName required' });

    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(bookingId) },
      include: {
        tourType: true,
        guide: true,
        secondGuide: true
      }
    });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    // Find guide by booking relation first (avoids duplicate name issue), fallback to name search
    let guide = null;
    if (guideType === 'main' && booking.guide?.name === guideName) {
      guide = booking.guide;
    } else if (guideType === 'second' && booking.secondGuide?.name === guideName) {
      guide = booking.secondGuide;
    }
    if (!guide) {
      guide = await prisma.guide.findFirst({ where: { name: guideName, telegramChatId: { not: null } } });
    }
    if (!guide?.telegramChatId) {
      return res.status(400).json({ error: `${guideName} uchun Telegram chat ID sozlanmagan (Guides sahifasida)` });
    }

    const guideTypeLabel =
      guideType === 'main'           ? 'Asosiy gid' :
      guideType === 'second'         ? 'Ikkinchi gid' :
      guideType === 'bergreiseleiter' ? 'Bergreiseleiter' : guideType;

    const fmtDate = (d) => {
      if (!d) return null;
      const dt = new Date(d);
      return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.${dt.getFullYear()}`;
    };

    const isCancelled = booking.status === 'CANCELLED';

    const msgText = isCancelled
      ? [
          `❌ *GRUPPA BEKOR QILINDI*`,
          `📋 Booking: *${booking.bookingNumber}*`,
          `👤 Gid: *${guideName}*`,
          `🏷 Tur: *${guideTypeLabel}*`,
          booking.arrivalDate ? `📅 Boshlanish: *${fmtDate(booking.arrivalDate)}*` : null,
          booking.endDate     ? `🏁 Tugash: *${fmtDate(booking.endDate)}*`         : null,
          ``,
          `⚠️ Bu guruh anulyatsiya qilindi.`,
        ].filter(v => v !== null).join('\n')
      : [
          `🧭 *Gid so'rovi*`,
          `📋 Booking: *${booking.bookingNumber}*`,
          `👤 Gid: *${guideName}*`,
          `🏷 Tur: *${guideTypeLabel}*`,
          booking.departureDate ? `📅 Jo'nash: *${fmtDate(booking.departureDate)}*` : null,
          booking.arrivalDate   ? `🏁 Kelish: *${fmtDate(booking.arrivalDate)}*`   : null,
          fullDays  ? `☀️ To'liq kunlar: *${fullDays}*`  : null,
          halfDays  ? `🌤 Yarim kunlar: *${halfDays}*`   : null,
          dayRate   ? `💰 Kunlik to'lov: *$${dayRate}*`  : null,
          totalPayment ? `💵 Jami to'lov: *$${Math.round(totalPayment)}*` : null,
        ].filter(Boolean).join('\n');

    // Save/update GuideConfirmation (source: 'BOOKING' = sent from Bookings Tour Services tab)
    await prisma.guideConfirmation.upsert({
      where: { bookingId_guideId: { bookingId: parseInt(bookingId), guideId: guide.id } },
      create: { bookingId: parseInt(bookingId), guideId: guide.id, status: isCancelled ? 'REJECTED' : 'PENDING', sentAt: new Date(), source: 'BOOKING' },
      update: { status: isCancelled ? 'REJECTED' : 'PENDING', sentAt: new Date(), respondedAt: null, confirmedBy: null, source: 'BOOKING' }
    });

    const messagePayload = {
      chat_id: guide.telegramChatId,
      text: msgText,
      parse_mode: 'Markdown',
    };
    if (!isCancelled) {
      messagePayload.reply_markup = JSON.stringify({
        inline_keyboard: [[
          { text: '✅ Qabul qilaman', callback_data: `gd_ok:${bookingId}:${guide.id}` },
          { text: '❌ Rad etaman',    callback_data: `gd_reject:${bookingId}:${guide.id}` }
        ]]
      });
    }
    await axios.post(`${GUIDE_API()}/sendMessage`, messagePayload);

    res.json({ ok: true });
  } catch (err) {
    console.error('send-guide error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.description || err.message });
  }
});

// Meal Confirmations (Restoran Telegram)
// ============================================================

// POST /api/telegram/send-meal/:bookingId
router.post('/send-meal/:bookingId', authenticate, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { restaurantName, city, mealDate, pax, pricePerPerson } = req.body;

    if (!restaurantName) return res.status(400).json({ error: 'restaurantName required' });

    const chatIds = await getMealChatIds();
    const chatId = chatIds[restaurantName];
    if (!chatId) {
      return res.status(400).json({ error: `${restaurantName} uchun Telegram chat ID sozlanmagan (GmailSettings → Restoran)` });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(bookingId) },
      select: {
        bookingNumber: true,
        pax: true,
        status: true,
        departureDate: true,
        endDate: true,
        guide: { select: { name: true, phone: true } }
      }
    });
    if (!booking) return res.status(404).json({ error: 'Booking topilmadi' });

    const isCancelled = booking.status === 'CANCELLED';

    if (isCancelled) {
      // Send anulyatsiya with confirm buttons (Orient sends manually, provider confirms)
      const conf = await prisma.mealConfirmation.create({
        data: {
          bookingId: parseInt(bookingId),
          restaurantName,
          city: city || null,
          mealDate: mealDate || null,
          pax: 0,
          status: 'PENDING',
          sentAt: new Date(),
          source: 'STORNO',
          pricePerPerson: null
        }
      });

      const fmtD = d => { if (!d) return '—'; const dt = new Date(d); return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.${dt.getFullYear()}`; };
      const anuMsg = [
        `❌ *ANULYATSIYA*`,
        `📋 Booking: *${booking.bookingNumber}*`,
        `🍴 Restoran: *${restaurantName}*`,
        city     ? `🏙 Shahar: *${city}*` : null,
        mealDate ? `📅 Sana: *${mealDate}*` : null,
        booking.departureDate ? `🗓 Guruh: *${fmtD(booking.departureDate)} – ${fmtD(booking.endDate)}*` : null,
      ].filter(Boolean).join('\n');

      await axios.post(`${RESTAURANT_API()}/sendMessage`, {
        chat_id: chatId,
        text: anuMsg,
        parse_mode: 'Markdown',
        reply_markup: JSON.stringify({ inline_keyboard: [[
          { text: '✅ Qabul qildim', callback_data: `meal_confirm:${conf.id}` },
          { text: '❌ Rad etish',    callback_data: `meal_reject:${conf.id}` }
        ]] })
      });

      return res.json({ success: true, cancelled: true });
    }

    // Normal booking: create confirmation record and send with buttons
    const conf = await prisma.mealConfirmation.create({
      data: {
        bookingId: parseInt(bookingId),
        restaurantName,
        city: city || null,
        mealDate: mealDate || null,
        pax: parseInt(pax) || booking.pax || 0,
        status: 'PENDING',
        sentAt: new Date(),
        source: 'BOOKING',
        pricePerPerson: pricePerPerson ? parseFloat(pricePerPerson) : null
      }
    });

    const msgText = [
      `🍽 *Restoran so'rovi*`,
      `📋 Booking: *${booking.bookingNumber}*`,
      `🍴 Restoran: *${restaurantName}*`,
      city     ? `🏙 Shahar: *${city}*`   : null,
      mealDate ? `📅 Sana: *${mealDate}*` : null,
      pax             ? `👥 Turist: *${pax}* kishi` : null,
      pricePerPerson  ? `💰 Narx: *${Number(pricePerPerson).toLocaleString('ru-RU')}* UZS/kishi` : null,
      (pricePerPerson && pax) ? `💵 Jami: *${(Number(pricePerPerson) * Number(pax)).toLocaleString('ru-RU')}* UZS` : null,
      booking.guide?.name ? `🧭 Gid: *${booking.guide.name}*${booking.guide.phone ? `  ${booking.guide.phone}` : ''}` : null,
    ].filter(Boolean).join('\n');

    await axios.post(`${RESTAURANT_API()}/sendMessage`, {
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

    res.json({ success: true });
  } catch (err) {
    console.error('Send meal telegram error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.description || err.message });
  }
});

// GET /api/telegram/meal-confirmations
router.get('/meal-confirmations', authenticate, async (req, res) => {
  try {
    const { bookingId } = req.query;
    const year = req.query.year ? parseInt(req.query.year) : null;
    const where = {};
    if (bookingId) where.bookingId = parseInt(bookingId);
    if (year) where.booking = { bookingYear: year };
    const confirmations = await prisma.mealConfirmation.findMany({
      where,
      include: { booking: { select: { bookingNumber: true, departureDate: true, tourType: { select: { code: true } } } } },
      orderBy: { sentAt: 'desc' }
    });
    res.json({ confirmations });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch meal confirmations' });
  }
});

// DELETE /api/telegram/meal-confirmations/:id
router.delete('/meal-confirmations/:id', authenticate, async (req, res) => {
  try {
    await prisma.mealConfirmation.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete' });
  }
});

// GET /api/telegram/meal-settings
router.get('/meal-settings', authenticate, async (req, res) => {
  try {
    const chatIds = await getMealChatIds();
    res.json({ chatIds });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load meal settings' });
  }
});

// PUT /api/telegram/meal-settings
router.put('/meal-settings', authenticate, async (req, res) => {
  try {
    const { chatIds } = req.body;
    await saveMealChatIds(chatIds || {});
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save meal settings' });
  }
});

// GET /api/telegram/bot-admins — returns {hotel:[...], transport:[...], restaurant:[...], guide:[...]}
router.get('/bot-admins', authenticate, async (req, res) => {
  try {
    const keys = ['HOTEL_ADMIN_CHAT_IDS', 'TRANSPORT_ADMIN_CHAT_IDS', 'RESTAURANT_ADMIN_CHAT_IDS', 'GUIDE_ADMIN_CHAT_IDS'];
    const rows = await prisma.systemSetting.findMany({ where: { key: { in: keys } } });
    const result = { hotel: [], transport: [], restaurant: [], guide: [] };
    for (const r of rows) {
      try {
        const arr = JSON.parse(r.value);
        if (r.key === 'HOTEL_ADMIN_CHAT_IDS')      result.hotel      = arr;
        if (r.key === 'TRANSPORT_ADMIN_CHAT_IDS')  result.transport  = arr;
        if (r.key === 'RESTAURANT_ADMIN_CHAT_IDS') result.restaurant = arr;
        if (r.key === 'GUIDE_ADMIN_CHAT_IDS')      result.guide      = arr;
      } catch {}
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/telegram/bot-admins/:botType — toggle chatId in admin list
router.put('/bot-admins/:botType', authenticate, async (req, res) => {
  try {
    const { botType } = req.params;
    const { chatId } = req.body;
    if (!chatId) return res.status(400).json({ error: 'chatId required' });
    const arr = await toggleBotAdmin(botType, chatId);
    res.json({ success: true, botType, admins: arr });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Keep old bot-admin-ids routes for backward compat (GmailSettings)
router.get('/bot-admin-ids', authenticate, async (req, res) => {
  try {
    const keys = ['TRANSPORT_ADMIN_CHAT_ID', 'RESTAURANT_ADMIN_CHAT_ID', 'GUIDE_ADMIN_CHAT_ID'];
    const rows = await prisma.systemSetting.findMany({ where: { key: { in: keys } } });
    const result = { transport: '', restaurant: '', guide: '' };
    for (const r of rows) {
      if (r.key === 'TRANSPORT_ADMIN_CHAT_ID')  result.transport  = r.value;
      if (r.key === 'RESTAURANT_ADMIN_CHAT_ID') result.restaurant = r.value;
      if (r.key === 'GUIDE_ADMIN_CHAT_ID')      result.guide      = r.value;
    }
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.put('/bot-admin-ids', authenticate, async (req, res) => {
  try {
    const { transport, restaurant, guide } = req.body;
    const upsert = async (key, value) => {
      if (value === undefined) return;
      await prisma.systemSetting.upsert({ where: { key }, update: { value: value || '' }, create: { key, value: value || '' } });
    };
    await upsert('TRANSPORT_ADMIN_CHAT_ID',  transport);
    await upsert('RESTAURANT_ADMIN_CHAT_ID', restaurant);
    await upsert('GUIDE_ADMIN_CHAT_ID',      guide);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/telegram/bot-admins-bulk — save full admin lists for all bot types (comma-separated → JSON array)
router.put('/bot-admins-bulk', authenticate, async (req, res) => {
  try {
    const keyMap = { hotel: 'HOTEL_ADMIN_CHAT_IDS', transport: 'TRANSPORT_ADMIN_CHAT_IDS', restaurant: 'RESTAURANT_ADMIN_CHAT_IDS', guide: 'GUIDE_ADMIN_CHAT_IDS' };
    for (const [type, key] of Object.entries(keyMap)) {
      if (req.body[type] === undefined) continue;
      const ids = req.body[type].split(',').map(s => s.trim()).filter(Boolean);
      await prisma.systemSetting.upsert({ where: { key }, update: { value: JSON.stringify(ids) }, create: { key, value: JSON.stringify(ids) } });
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/telegram/send-eintritt/:bookingId — receive PDF blob from frontend and send to Siroj
router.post('/send-eintritt/:bookingId', authenticate, upload.single('pdf'), async (req, res) => {
  try {
    const bookingId = parseInt(req.params.bookingId);

    const chatId = await getProviderChatId('hammasi');
    if (!chatId) return res.status(400).json({ error: 'Siroj uchun chat ID sozlanmagan (GmailSettings → Transport → Siroj)' });
    if (!req.file) return res.status(400).json({ error: 'PDF fayl topilmadi' });

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { bookingNumber: true, _count: { select: { tourists: true } } }
    });
    if (!booking) return res.status(404).json({ error: 'Booking topilmadi' });

    const paxCount = booking._count.tourists;
    const entriesCount = parseInt(req.body.count) || 0;

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('caption', `🎫 *Eintritt Vouchers*\n📋 Booking: *${booking.bookingNumber}*\n👥 PAX: *${paxCount}* kishi\n📄 ${entriesCount} ta attraksion`);
    form.append('parse_mode', 'Markdown');
    form.append('document', Buffer.from(req.file.buffer), {
      filename: `${booking.bookingNumber}_Eintritt.pdf`,
      contentType: 'application/pdf'
    });
    await axios.post(`https://api.telegram.org/bot${token}/sendDocument`, form, { headers: form.getHeaders() });

    res.json({ success: true });
  } catch (err) {
    console.error('send-eintritt error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/telegram/send-cost-pdfs/:bookingId — receive up to 5 Cost PDFs and send as media group to Siroj
router.post('/send-cost-pdfs/:bookingId', authenticate, upload.fields([
  { name: 'pdf_0', maxCount: 1 },
  { name: 'pdf_1', maxCount: 1 },
  { name: 'pdf_2', maxCount: 1 },
  { name: 'pdf_3', maxCount: 1 },
  { name: 'pdf_4', maxCount: 1 },
]), async (req, res) => {
  try {
    const bookingId = parseInt(req.params.bookingId);

    const chatId = await getProviderChatId('hammasi');
    if (!chatId) return res.status(400).json({ error: 'Siroj uchun chat ID sozlanmagan (GmailSettings → Transport → Siroj)' });

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { bookingNumber: true }
    });
    if (!booking) return res.status(404).json({ error: 'Booking topilmadi' });

    // Collect uploaded files in order
    const files = [];
    for (let i = 0; i < 5; i++) {
      const f = req.files[`pdf_${i}`];
      if (f && f[0]) files.push(f[0]);
    }
    if (files.length === 0) return res.status(400).json({ error: 'PDF topilmadi' });

    const token = process.env.TELEGRAM_BOT_TOKEN;

    // 1. Send caption text first
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text: `💰 *Cost PDFs*\n📋 Booking: *${booking.bookingNumber}*\n📄 ${files.length} ta fayl`,
      parse_mode: 'Markdown'
    });

    // 2. Send all PDFs as media group (no caption)
    const form = new FormData();
    form.append('chat_id', chatId);
    const media = files.map((f, i) => ({ type: 'document', media: `attach://doc_${i}` }));
    form.append('media', JSON.stringify(media));
    files.forEach((f, i) => {
      form.append(`doc_${i}`, Buffer.from(f.buffer), {
        filename: f.originalname,
        contentType: 'application/pdf'
      });
    });
    await axios.post(`https://api.telegram.org/bot${token}/sendMediaGroup`, form, { headers: form.getHeaders() });

    res.json({ success: true });
  } catch (err) {
    console.error('send-cost-pdfs error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/telegram/send-ausgaben-pdf — send Ausgaben PDF to Siroj
router.post('/send-ausgaben-pdf', authenticate, upload.single('pdf'), async (req, res) => {
  try {
    const chatId = await getProviderChatId('hammasi');
    if (!chatId) return res.status(400).json({ error: 'Siroj uchun chat ID sozlanmagan (GmailSettings → Transport → Siroj)' });
    if (!req.file) return res.status(400).json({ error: 'PDF fayl topilmadi' });

    const { title, tourType, tab, year } = req.body;
    const token = process.env.TELEGRAM_BOT_TOKEN;

    const tabLabels = { general: 'General', hotels: 'Hotels', transport: 'Transport', guides: 'Guides' };
    const tourLabels = { ALL: 'Barcha gruppalar', ER: 'Erlebnisreisen', CO: 'Comfort', KAS: 'Karawanen Seidenstrasse', ZA: 'Zentralasien' };

    const caption = `📊 *Ausgaben Hisoboti*\n🗂 Guruh: *${tourLabels[tourType] || tourType}*\n📋 Tab: *${tabLabels[tab] || tab}*\n📅 Yil: *${year}*`;

    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('caption', caption);
    form.append('parse_mode', 'Markdown');
    form.append('document', Buffer.from(req.file.buffer), {
      filename: req.file.originalname || `Ausgaben_${tourType}_${tab}_${year}.pdf`,
      contentType: 'application/pdf'
    });
    await axios.post(`https://api.telegram.org/bot${token}/sendDocument`, form, { headers: form.getHeaders() });

    res.json({ success: true });
  } catch (err) {
    console.error('send-ausgaben-pdf error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/telegram/send-guide-schedule/:guideId?year=2026
// Sends all bookings for a guide as one formatted schedule message
router.post('/send-guide-schedule/:guideId', authenticate, async (req, res) => {
  try {
    const guideId = parseInt(req.params.guideId);
    const year = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();

    const guide = await prisma.guide.findUnique({ where: { id: guideId } });
    if (!guide?.telegramChatId) {
      return res.status(400).json({ error: `${guide?.name || 'Gid'} uchun Telegram chat ID sozlanmagan` });
    }

    const bookings = await prisma.booking.findMany({
      where: { guideId, bookingYear: year, status: { not: 'CANCELLED' } },
      select: {
        id: true, bookingNumber: true, departureDate: true, arrivalDate: true, endDate: true, pax: true, status: true,
        tourType: { select: { code: true } }
      },
      orderBy: { departureDate: 'asc' }
    });

    if (!bookings.length) {
      return res.status(400).json({ error: `${guide.name} uchun ${year} yilda guruhlar topilmadi` });
    }

    const fmtD  = d => { if (!d) return '—    '; const dt = new Date(d); return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}`; };
    const fmtDY = d => { if (!d) return '—'; const dt = new Date(d); return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.${dt.getFullYear()}`; };

    const SEP = '─'.repeat(26);
    const rows = bookings.map((b, i) => {
      const num   = String(i + 1).padStart(2);
      const grp   = (b.bookingNumber || '').padEnd(7);
      const start = fmtD(b.arrivalDate).padEnd(6);
      const end   = fmtD(b.endDate);
      return `<code>${num}. ${grp} ${start}─ ${end}</code>`;
    });

    const lines = [
      `🧭 <b>${guide.name}</b>`,
      `📅 ${year} yil jadvali — jami <b>${bookings.length}</b> ta guruh`,
      ``,
      `<code> #  Guruh    Kelish Tugash</code>`,
      `<code>${SEP}</code>`,
      ...rows,
      ``,
      `✅ Ushbu jadval bilan tanishdingizmi?`,
    ];

    await axios.post(`${GUIDE_API()}/sendMessage`, {
      chat_id: guide.telegramChatId,
      text: lines.join('\n'),
      parse_mode: 'HTML',
      reply_markup: JSON.stringify({
        inline_keyboard: [[
          { text: '✅ Ha, qabul qildim', callback_data: `gd_schedule_ok:${guideId}:${year}` },
          { text: '❌ Rad etaman',        callback_data: `gd_schedule_reject:${guideId}:${year}` }
        ]]
      })
    });

    // Mark all bookings as PENDING in GuideConfirmation (source: 'SCHEDULE' = sent from JP)
    for (const b of bookings) {
      await prisma.guideConfirmation.upsert({
        where: { bookingId_guideId: { bookingId: b.id, guideId } },
        create: { bookingId: b.id, guideId, status: 'PENDING', sentAt: new Date(), source: 'SCHEDULE' },
        update: { status: 'PENDING', sentAt: new Date(), respondedAt: null, confirmedBy: null, source: 'SCHEDULE' }
      });
    }

    // Track sent year for dynamic guide menu (merge with existing GuideConfirmation years)
    const guideYearsKey = `JP_GUIDE_YEARS_${guideId}`;
    const gys = await prisma.systemSetting.findUnique({ where: { key: guideYearsKey } });
    const existingTracked = gys ? JSON.parse(gys.value) : [];
    // Also collect years from GuideConfirmation history (handles pre-tracking sends)
    const histConfs = await prisma.guideConfirmation.findMany({
      where: { guideId },
      include: { booking: { select: { bookingYear: true } } }
    });
    const histYears = histConfs.map(c => c.booking?.bookingYear).filter(Boolean);
    const gyears = [...new Set([...existingTracked, ...histYears, year])].sort();
    await prisma.systemSetting.upsert({
      where: { key: guideYearsKey },
      update: { value: JSON.stringify(gyears) },
      create: { key: guideYearsKey, value: JSON.stringify(gyears) }
    });

    res.json({ ok: true, sent: bookings.length });

    // Refresh guide keyboard so new year button appears immediately
    try {
      const curYear = new Date().getFullYear();
      const allYears = gyears.filter(y => y >= curYear).sort();
      const grpRows = allYears.length > 1
        ? [allYears.map(y => ({ text: `📋 Gruppalar ${y}` }))]
        : [[{ text: `📋 Gruppalar ${allYears[0] || curYear}` }, { text: '✅ Tasdiqlangan' }]];
      const refreshKeyboard = allYears.length > 1
        ? [...grpRows, [{ text: '✅ Tasdiqlangan' }, { text: '❌ Anulyatsiya' }]]
        : [...grpRows, [{ text: '❌ Anulyatsiya' }]];
      await axios.post(`${GUIDE_API()}/sendMessage`, {
        chat_id: guide.telegramChatId,
        text: `🔄 Menu yangilandi (${allYears.join(', ')} yil uchun jadvallar mavjud):`,
        reply_markup: JSON.stringify({ keyboard: refreshKeyboard, resize_keyboard: true, is_persistent: true })
      }).catch(() => {});
    } catch (menuErr) {
      console.warn('Guide menu refresh error:', menuErr.message);
    }
  } catch (err) {
    console.error('send-guide-schedule error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.description || err.message });
  }
});

// ============================================
// SHOU (FOLKLORE SHOW) TELEGRAM SEND
// ============================================

// GET /api/telegram/shou-settings
router.get('/shou-settings', authenticate, async (req, res) => {
  try {
    const s = await prisma.systemSetting.findUnique({ where: { key: 'SHOU_TELEGRAM_CHAT_ID' } });
    res.json({ chatId: s?.value || '' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/telegram/shou-settings
router.put('/shou-settings', authenticate, async (req, res) => {
  try {
    const { chatId } = req.body;
    await prisma.systemSetting.upsert({
      where: { key: 'SHOU_TELEGRAM_CHAT_ID' },
      update: { value: chatId },
      create: { key: 'SHOU_TELEGRAM_CHAT_ID', value: chatId }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/telegram/send-shou/:bookingId
router.post('/send-shou/:bookingId', authenticate, async (req, res) => {
  try {
    const bookingId = parseInt(req.params.bookingId);

    // 1. Get chat ID
    const chatIdSetting = await prisma.systemSetting.findUnique({ where: { key: 'SHOU_TELEGRAM_CHAT_ID' } });
    const chatId = chatIdSetting?.value;
    if (!chatId) return res.status(400).json({ error: "Shou Telegram chat ID sozlanmagan (Settings → Telegram)" });

    // 2. Booking info for caption
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { tourType: true }
    });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const touristCount = await prisma.tourist.count({ where: { bookingId } });

    // 3. Generate PDF via Puppeteer (shou-request-preview)
    const browser = await puppeteer.launch({
      env: { ...process.env, HOME: '/tmp' },
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    let pdfBuffer;
    try {
      await page.setExtraHTTPHeaders({ 'x-internal-secret': process.env.INTERNAL_API_SECRET || '' });
      const internalUrl = `http://localhost:${process.env.PORT || 3001}/api/bookings/${bookingId}/shou-request-preview`;
      await page.goto(internalUrl, { waitUntil: 'networkidle0', timeout: 30000 });
      const pdfUint8 = await page.pdf({ format: 'A4', printBackground: true });
      pdfBuffer = Buffer.from(pdfUint8);
    } finally {
      await page.close();
      await browser.close();
    }

    // 4. Send via Restaurant bot
    const bookingNum = booking.bookingNumber || String(bookingId);
    const caption = `🎭 *ЗАЯВКА ${bookingNum}*\nФольклорное шоу — медресе Нодир Девонбеги\n👥 PAX: ${touristCount}`;
    const filename = `Shou-Zayvka-${bookingNum}.pdf`;

    const FormData = require('form-data');
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('document', pdfBuffer, { filename, contentType: 'application/pdf' });
    form.append('caption', caption);
    form.append('parse_mode', 'Markdown');

    await axios.post(`${RESTAURANT_API()}/sendDocument`, form, { headers: form.getHeaders() });

    res.json({ success: true, sentTo: chatId });
  } catch (err) {
    console.error('send-shou error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.description || err.message });
  }
});

module.exports = router;
