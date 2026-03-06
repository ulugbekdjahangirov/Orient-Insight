const cron = require('node-cron');
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const BOT_API       = () => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const TRANSPORT_API = () => `https://api.telegram.org/bot${process.env.TELEGRAM_TRANSPORT_TOKEN}`;
const RESTAURANT_API= () => `https://api.telegram.org/bot${process.env.TELEGRAM_RESTAURANT_TOKEN}`;
const GUIDE_API     = () => `https://api.telegram.org/bot${process.env.TELEGRAM_GUIDE_TOKEN}`;

const ROUTE_NAME_UZ = {
  'Airport Drop-off':          'Aeroportga olib borish',
  'Airport Pickup':            'Aeroportdan kutib olish',
  'Bukhara City Tour':         'Buxoro shahar sayohati',
  'Samarkand City Tour':       'Samarqand shahar sayohati',
  'Tashkent City Tour':        'Toshkent shahar sayohati',
  'Train Station Drop-off':    'Vokzalga olib borish',
  'Train Station Pickup':      'Vokzaldan kutib olish',
};

async function getAdminIds(botType) {
  const keyMap = { hotel: 'HOTEL_ADMIN_CHAT_IDS', transport: 'TRANSPORT_ADMIN_CHAT_IDS', restaurant: 'RESTAURANT_ADMIN_CHAT_IDS', guide: 'GUIDE_ADMIN_CHAT_IDS' };
  try {
    const s = await prisma.systemSetting.findUnique({ where: { key: keyMap[botType] } });
    const arr = s?.value ? JSON.parse(s.value) : [];
    return arr.length ? arr : [process.env.TELEGRAM_ADMIN_CHAT_ID].filter(Boolean);
  } catch { return [process.env.TELEGRAM_ADMIN_CHAT_ID].filter(Boolean); }
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.${dt.getFullYear()}`;
}

function targetRange(today, daysAhead) {
  const target = new Date(today); target.setDate(today.getDate() + daysAhead);
  const targetEnd = new Date(target); targetEnd.setHours(23,59,59,999);
  return { target, targetEnd };
}

// ── HOTEL reminders ────────────────────────────────────────────────────────────
async function sendHotelReminders(today, daysAhead) {
  const { target, targetEnd } = targetRange(today, daysAhead);
  const accommodations = await prisma.accommodation.findMany({
    where: { checkInDate: { gte: target, lte: targetEnd }, booking: { status: { not: 'CANCELLED' } } },
    include: { hotel: true, rooms: true, booking: { include: { guide: true, tourType: true } } }
  });
  if (!accommodations.length) return;
  const adminIds = await getAdminIds('hotel');

  for (const acc of accommodations) {
    const { hotel, booking, rooms } = acc;
    if (!hotel?.telegramChatId) continue;

    const dbl = rooms.filter(r => r.roomTypeCode === 'DBL').reduce((s,r) => s+r.roomsCount, 0);
    const twn = rooms.filter(r => r.roomTypeCode === 'TWN').reduce((s,r) => s+r.roomsCount, 0);
    const ez  = rooms.filter(r => ['SNGL','EZ'].includes(r.roomTypeCode)).reduce((s,r) => s+r.roomsCount, 0);
    const guide = booking.guide;
    const guideInfo = guide
      ? `\n\n👤 Guide: ${(guide.firstName||'')} ${(guide.lastName||'')}`.trim() + (guide.phone ? `\n📞 ${guide.phone}` : '')
      : '';

    const header = daysAhead === 1 ? '🔔 Напоминание: Заезд завтра!' : `📅 Заезд через ${daysAhead} дня`;
    const baseMsg =
      `📋 Group: ${booking.bookingNumber} (${booking.tourType?.code||''})\n🏨 Hotel: ${hotel.name}\n` +
      `📅 Check-in: ${fmtDate(acc.checkInDate)}\n📅 Check-out: ${fmtDate(acc.checkOutDate)}\n🌙 Nights: ${acc.nights||0}\n\n` +
      `👥 PAX: ${acc.totalGuests||0}\n🛏 DBL: ${dbl} | TWN: ${twn} | EZ: ${ez}` + guideInfo;

    const conf = await prisma.telegramConfirmation.findFirst({ where: { bookingId: booking.id, hotelId: hotel.id }, orderBy: { sentAt: 'desc' } });
    const confStatus = conf
      ? conf.status === 'CONFIRMED' ? '✅ Tasdiqlangan: Ha' : conf.status === 'REJECTED' ? "❌ Tasdiqlangan: Yo'q" : '⏳ Kutilmoqda'
      : '—';

    await axios.post(`${BOT_API()}/sendMessage`, { chat_id: hotel.telegramChatId, text: `${header}\n\n${baseMsg}` }).catch(()=>{});
    for (const id of adminIds) {
      await axios.post(`${BOT_API()}/sendMessage`, { chat_id: id, text: `${header}\n\n${baseMsg}\n\n${confStatus}` }).catch(()=>{});
    }
  }
}

// ── TRANSPORT reminders ────────────────────────────────────────────────────────
async function sendTransportReminders(today, daysAhead) {
  const { target, targetEnd } = targetRange(today, daysAhead);
  const routes = await prisma.route.findMany({
    where: { date: { gte: target, lte: targetEnd }, provider: { not: null }, booking: { status: { not: 'CANCELLED' } } },
    include: { booking: { include: { tourType: true } } }
  });
  if (!routes.length) return;
  const adminIds = await getAdminIds('transport');

  // Group by provider + bookingId (one message per booking per provider)
  const grouped = {};
  for (const r of routes) {
    const key = `${r.provider}_${r.bookingId}`;
    if (!grouped[key]) grouped[key] = { provider: r.provider, booking: r.booking, routes: [], date: r.date };
    grouped[key].routes.push(r);
  }

  for (const { provider, booking, routes: provRoutes, date } of Object.values(grouped)) {
    const chatId = await getProviderChatId(provider);
    if (!chatId) continue;

    const header = daysAhead === 1 ? '🔔 Напоминание: Marshrut ertaga!' : `📅 Marshrut через ${daysAhead} дня`;
    const routeList = provRoutes.map(r => `• ${ROUTE_NAME_UZ[r.routeName] || r.routeName}${r.departureTime ? ` (${r.departureTime})` : ''}`).join('\n');

    const baseMsg =
      `📋 Group: ${booking.bookingNumber} (${booking.tourType?.code||''})\n` +
      `📅 Sana: ${fmtDate(date)}\n👥 PAX: ${provRoutes[0]?.personCount||0}\n\n` +
      `🗺 Marshrutlar:\n${routeList}`;

    const conf = await prisma.transportConfirmation.findFirst({
      where: { bookingId: booking.id, provider },
      orderBy: { sentAt: 'desc' }
    });
    const confStatus = conf
      ? conf.status === 'CONFIRMED' ? '✅ Tasdiqlangan: Ha' : conf.status === 'REJECTED' ? "❌ Tasdiqlangan: Yo'q" : '⏳ Kutilmoqda'
      : '—';

    await axios.post(`${TRANSPORT_API()}/sendMessage`, { chat_id: chatId, text: `${header}\n\n${baseMsg}` }).catch(()=>{});
    for (const id of adminIds) {
      await axios.post(`${TRANSPORT_API()}/sendMessage`, { chat_id: id, text: `${header}\n\n${baseMsg}\n\n${confStatus}` }).catch(()=>{});
    }
  }
}

async function getProviderChatId(provider) {
  const key = `TRANSPORT_${provider.toUpperCase()}_CHAT_ID`;
  const s = await prisma.systemSetting.findUnique({ where: { key } });
  return s?.value || null;
}

// ── GUIDE reminders ────────────────────────────────────────────────────────────
async function sendGuideReminders(today, daysAhead) {
  const { target, targetEnd } = targetRange(today, daysAhead);
  const bookings = await prisma.booking.findMany({
    where: { arrivalDate: { gte: target, lte: targetEnd }, status: { not: 'CANCELLED' }, guideId: { not: null } },
    include: { guide: true, tourType: true }
  });
  if (!bookings.length) return;
  const adminIds = await getAdminIds('guide');

  for (const booking of bookings) {
    const guide = booking.guide;
    if (!guide?.telegramChatId) continue;

    const header = daysAhead === 1 ? '🔔 Напоминание: Tur ertaga boshlanadi!' : `📅 Tur ${daysAhead} kundan keyin`;
    const baseMsg =
      `📋 Group: ${booking.bookingNumber} (${booking.tourType?.code||''})\n` +
      `📅 Arrival: ${fmtDate(booking.arrivalDate)}\n📅 Departure: ${fmtDate(booking.departureDate)}\n` +
      `👥 PAX: ${booking.pax||0}`;

    await axios.post(`${GUIDE_API()}/sendMessage`, { chat_id: guide.telegramChatId, text: `${header}\n\n${baseMsg}` }).catch(()=>{});
    for (const id of adminIds) {
      await axios.post(`${GUIDE_API()}/sendMessage`, { chat_id: id, text: `${header}\n\n${baseMsg}\n\n👤 Gid: ${guide.firstName||''} ${guide.lastName||''}\n📞 ${guide.phone||'—'}` }).catch(()=>{});
    }
  }
}

// ── RESTAURANT reminders ───────────────────────────────────────────────────────
async function sendRestaurantReminders(today, daysAhead) {
  const { target } = targetRange(today, daysAhead);
  // mealDate stored as "DD.MM.YYYY" string
  const dd = String(target.getDate()).padStart(2,'0');
  const mm = String(target.getMonth()+1).padStart(2,'0');
  const yyyy = target.getFullYear();
  const targetStr = `${dd}.${mm}.${yyyy}`;

  const confirmations = await prisma.mealConfirmation.findMany({
    where: { mealDate: targetStr, booking: { status: { not: 'CANCELLED' } } },
    include: { booking: { include: { tourType: true } } }
  });
  if (!confirmations.length) return;
  const adminIds = await getAdminIds('restaurant');

  // Get restaurant chat IDs
  const chatIdMap = await prisma.systemSetting.findUnique({ where: { key: 'MEAL_RESTAURANT_CHAT_IDS' } });
  const chatIds = chatIdMap ? JSON.parse(chatIdMap.value) : {};

  // Group by restaurantName + bookingId
  const grouped = {};
  for (const c of confirmations) {
    const key = `${c.restaurantName}_${c.bookingId}`;
    if (!grouped[key]) grouped[key] = { restaurantName: c.restaurantName, booking: c.booking, confs: [], city: c.city };
    grouped[key].confs.push(c);
  }

  for (const { restaurantName, booking, confs, city } of Object.values(grouped)) {
    const chatId = chatIds[restaurantName];
    if (!chatId) continue;

    const totalPax = confs.reduce((s,c) => s+c.pax, 0);
    const header = daysAhead === 1 ? '🔔 Напоминание: Ovqat ertaga!' : `📅 Ovqat ${daysAhead} kundan keyin`;
    const baseMsg =
      `📋 Group: ${booking.bookingNumber} (${booking.tourType?.code||''})\n` +
      `🍽 Restoran: ${restaurantName}${city ? ` (${city})` : ''}\n` +
      `📅 Sana: ${targetStr}\n👥 PAX: ${totalPax}`;

    const confStatus = confs[0]?.status === 'CONFIRMED' ? '✅ Tasdiqlangan: Ha'
      : confs[0]?.status === 'REJECTED' ? "❌ Tasdiqlangan: Yo'q" : '⏳ Kutilmoqda';

    await axios.post(`${RESTAURANT_API()}/sendMessage`, { chat_id: chatId, text: `${header}\n\n${baseMsg}` }).catch(()=>{});
    for (const id of adminIds) {
      await axios.post(`${RESTAURANT_API()}/sendMessage`, { chat_id: id, text: `${header}\n\n${baseMsg}\n\n${confStatus}` }).catch(()=>{});
    }
  }
}

// ── Main runner ────────────────────────────────────────────────────────────────
async function runAllReminders(fakeToday) {
  const today = fakeToday ? new Date(fakeToday) : new Date();
  today.setHours(0,0,0,0);

  for (const days of [1, 3]) {
    await sendHotelReminders(today, days);
    await sendTransportReminders(today, days);
    await sendGuideReminders(today, days);
    await sendRestaurantReminders(today, days);
  }
}

function startReminderJob() {
  // Run every day at 08:00 AM server time
  cron.schedule('0 8 * * *', async () => {
    try { await runAllReminders(); }
    catch (err) { console.error('Reminder job error:', err.message); }
  });
}

module.exports = { startReminderJob, runAllReminders };
