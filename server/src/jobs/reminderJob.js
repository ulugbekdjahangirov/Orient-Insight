const cron = require('node-cron');
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const BOT_API = () => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

async function getHotelAdminIds() {
  try {
    const s = await prisma.systemSetting.findUnique({ where: { key: 'HOTEL_ADMIN_CHAT_IDS' } });
    const arr = s?.value ? JSON.parse(s.value) : [];
    return arr.length ? arr : [process.env.TELEGRAM_ADMIN_CHAT_ID].filter(Boolean);
  } catch { return [process.env.TELEGRAM_ADMIN_CHAT_ID].filter(Boolean); }
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}.${String(dt.getMonth() + 1).padStart(2, '0')}.${dt.getFullYear()}`;
}

async function sendReminders(daysAhead) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(today);
  target.setDate(today.getDate() + daysAhead);
  const targetEnd = new Date(target);
  targetEnd.setHours(23, 59, 59, 999);

  const accommodations = await prisma.accommodation.findMany({
    where: {
      checkInDate: { gte: target, lte: targetEnd },
      booking: { status: { not: 'CANCELLED' } }
    },
    include: {
      hotel: true,
      rooms: true,
      booking: {
        include: {
          guide: true,
          secondGuide: true,
          tourType: true
        }
      }
    }
  });

  if (!accommodations.length) return;

  const adminIds = await getHotelAdminIds();

  for (const acc of accommodations) {
    const { hotel, booking, rooms } = acc;
    if (!hotel?.telegramChatId) continue;

    const bookingNum = booking.bookingNumber || `#${booking.id}`;
    const tourType = booking.tourType?.code || '';
    const checkin = fmtDate(acc.checkInDate);
    const checkout = fmtDate(acc.checkOutDate);
    const nights = acc.nights || 0;
    const pax = acc.totalGuests || 0;

    // Room breakdown
    const dbl = rooms.filter(r => r.roomTypeCode === 'DBL').reduce((s, r) => s + r.roomsCount, 0);
    const twn = rooms.filter(r => r.roomTypeCode === 'TWN').reduce((s, r) => s + r.roomsCount, 0);
    const ez  = rooms.filter(r => ['SNGL', 'EZ'].includes(r.roomTypeCode)).reduce((s, r) => s + r.roomsCount, 0);

    // Guide info
    const guide = booking.guide;
    const guideInfo = guide
      ? `\n\n👤 Guide: ${guide.firstName || ''} ${guide.lastName || ''}`.trim() +
        (guide.phone ? `\n📞 ${guide.phone}` : '')
      : '';

    // Header line differs for hotel vs admin, and 1 day vs 3 days
    const headerHotel = daysAhead === 1
      ? '🔔 Напоминание: Заезд завтра!'
      : `📅 Заезд через ${daysAhead} дня`;

    const headerAdmin = daysAhead === 1
      ? '🔔 Напоминание: Заезд завтра!'
      : `📅 Заезд через ${daysAhead} дня`;

    // Confirmation status for admin
    const conf = await prisma.telegramConfirmation.findFirst({
      where: { bookingId: booking.id, hotelId: hotel.id },
      orderBy: { sentAt: 'desc' }
    });
    const confStatus = conf
      ? conf.status === 'CONFIRMED' ? '✅ Tasdiqlangan: Ha'
        : conf.status === 'REJECTED' ? '❌ Tasdiqlangan: Yo\'q'
        : conf.status === 'WAITING' ? '⏳ Kutilmoqda'
        : '📨 Yuborilgan'
      : '—';

    const baseMsg =
      `📋 Group: ${bookingNum} (${tourType})\n` +
      `🏨 Hotel: ${hotel.name}\n` +
      `📅 Check-in: ${checkin}\n` +
      `📅 Check-out: ${checkout}\n` +
      `🌙 Nights: ${nights}\n\n` +
      `👥 PAX: ${pax}\n` +
      `🛏 DBL: ${dbl} | TWN: ${twn} | EZ: ${ez}` +
      guideInfo;

    const hotelMsg = `${headerHotel}\n\n${baseMsg}`;
    const adminMsg = `${headerAdmin}\n\n${baseMsg}\n\n${confStatus}`;

    // Send to hotel
    await axios.post(`${BOT_API()}/sendMessage`, {
      chat_id: hotel.telegramChatId,
      text: hotelMsg,
      parse_mode: 'Markdown'
    }).catch(e => console.warn(`Reminder to hotel ${hotel.name} failed:`, e.message));

    // Send to all admins
    for (const adminId of adminIds) {
      await axios.post(`${BOT_API()}/sendMessage`, {
        chat_id: adminId,
        text: adminMsg,
        parse_mode: 'Markdown'
      }).catch(e => console.warn(`Reminder to admin ${adminId} failed:`, e.message));
    }
  }
}

function startReminderJob() {
  // Run every day at 08:00 AM server time
  cron.schedule('0 8 * * *', async () => {
    try {
      await sendReminders(1); // 1 day before
      await sendReminders(3); // 3 days before
    } catch (err) {
      console.error('Reminder job error:', err.message);
    }
  });
}

module.exports = { startReminderJob };
