const express = require('express');
const router = express.Router();
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth.middleware');

const prisma = new PrismaClient();
const BOT_API = () => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const CHATS_SETTING_KEY = 'TELEGRAM_KNOWN_CHATS';

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

const PROVIDER_LABELS = { sevil: 'Sevil aka', xayrulla: 'Xayrulla', nosir: 'Nosir aka', hammasi: 'Hammasi' };

// ── Meal chat ID helpers ─────────────────────────────────────────────────────
const MEAL_CHAT_IDS_KEY = 'MEAL_RESTAURANT_CHAT_IDS';
async function getMealChatIds() {
  try {
    const s = await prisma.systemSetting.findUnique({ where: { key: MEAL_CHAT_IDS_KEY } });
    return s ? JSON.parse(s.value) : {};
  } catch { return {}; }
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

// POST /api/telegram/webhook - Receive updates from Telegram
router.post('/webhook', async (req, res) => {
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
      const chats = await loadKnownChats();
      chats[String(chat.id)] = {
        chatId: String(chat.id),
        name: chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' '),
        username: chat.username ? `@${chat.username}` : null,
        type: chat.type,
        lastMessage: msg.text || '[file]',
        date: new Date(msg.date * 1000).toISOString()
      };
      await saveKnownChats(chats);
      console.log(`📩 Telegram: saved chat from ${chats[String(chat.id)].name} (${chat.id})`);

      // Handle admin commands (only responds to TELEGRAM_ADMIN_CHAT_ID)
      const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
      const senderChatId = String(chat.id);
      if (adminChatId && senderChatId === String(adminChatId) && msg.text) {
        const text = msg.text.trim();

        // Persistent reply keyboard shown on /start, /menu, /menyu
        const MAIN_REPLY_KEYBOARD = JSON.stringify({
          keyboard: [
            [{ text: '🏨 Hotellar' }],
            [{ text: '🍽 Restoran' }, { text: '🚌 Transport' }],
            [{ text: '👤 Gidlar' }]
          ],
          resize_keyboard: true,
          is_persistent: true
        });

        // /start or /menu — attach persistent keyboard
        if (text === '/start' || text === '/menu' || text === '/menyu') {
          await axios.post(`${BOT_API()}/sendMessage`, {
            chat_id: adminChatId,
            text: '🤖 *Orient Insight — Admin Panel*\n\nPastdagi menyudan bo\'lim tanlang:',
            parse_mode: 'Markdown',
            reply_markup: MAIN_REPLY_KEYBOARD
          }).catch(() => {});
          return;
        }

        // 🏨 Hotellar button — show hotel list with inline keyboard
        if (text === '🏨 Hotellar') {
          const statusEmoji = { PENDING: '🕐', CONFIRMED: '✅', WAITING: '⏳', REJECTED: '❌' };
          const hotels = await prisma.hotel.findMany({
            where: { telegramConfirmations: { some: {} } },
            include: {
              telegramConfirmations: { select: { status: true } },
              city: { select: { name: true } }
            },
            orderBy: { name: 'asc' }
          });

          if (hotels.length === 0) {
            await axios.post(`${BOT_API()}/sendMessage`, {
              chat_id: adminChatId,
              text: '🏨 *Hotellar*\n\n📭 Hali hech qanday zayavka yuborilmagan.',
              parse_mode: 'Markdown',
              reply_markup: MAIN_REPLY_KEYBOARD
            }).catch(() => {});
            return;
          }

          const keyboard = hotels.slice(0, 20).map(hotel => {
            const counts = {};
            hotel.telegramConfirmations.forEach(c => { counts[c.status] = (counts[c.status] || 0) + 1; });
            const countStr = ['PENDING','CONFIRMED','WAITING','REJECTED']
              .filter(s => counts[s])
              .map(s => `${statusEmoji[s]}${counts[s]}`)
              .join(' ');
            const cityTag = hotel.city?.name ? ` · ${hotel.city.name}` : '';
            return [{ text: `${hotel.name}${cityTag}  ${countStr}`, callback_data: `admin:hotel:${hotel.id}` }];
          });

          await axios.post(`${BOT_API()}/sendMessage`, {
            chat_id: adminChatId,
            text: `🏨 *Hotellar* (${hotels.length} ta)\n\nHotelni tanlang:`,
            parse_mode: 'Markdown',
            reply_markup: JSON.stringify({ inline_keyboard: keyboard })
          }).catch(() => {});
          return;
        }

        // 🍽 Restoran / 🚌 Transport / 👤 Gidlar buttons
        if (text === '🍽 Restoran' || text === '🚌 Transport' || text === '👤 Gidlar') {
          await axios.post(`${BOT_API()}/sendMessage`, {
            chat_id: adminChatId,
            text: `${text}\n\n🚧 Bu bo'lim tez kunda...`,
            reply_markup: MAIN_REPLY_KEYBOARD
          }).catch(() => {});
          return;
        }

        // /status ER-01 — show confirmations for a specific booking
        if (text.startsWith('/status ')) {
          const bookingNum = text.replace('/status ', '').trim().toUpperCase();
          const booking = await prisma.booking.findUnique({ where: { bookingNumber: bookingNum } });

          if (!booking) {
            await axios.post(`${BOT_API()}/sendMessage`, {
              chat_id: adminChatId,
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
              chat_id: adminChatId,
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
            chat_id: adminChatId,
            text: lines.join('\n'),
            parse_mode: 'Markdown'
          }).catch(async () => {
            const plain = lines.join('\n').replace(/[*_`]/g, '');
            await axios.post(`${BOT_API()}/sendMessage`, { chat_id: adminChatId, text: plain }).catch(() => {});
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
    const fromName = [fromUser.first_name, fromUser.last_name].filter(Boolean).join(' ') || fromUser.username || 'Noma\'lum';
    const fromChatId = cb.message?.chat?.id;

    // Also save chat from callback
    if (fromChatId) {
      const chat = cb.message.chat;
      const chats = await loadKnownChats();
      if (!chats[String(chat.id)]) {
        chats[String(chat.id)] = {
          chatId: String(chat.id),
          name: chat.title || [fromUser.first_name, fromUser.last_name].filter(Boolean).join(' '),
          username: chat.username ? `@${chat.username}` : null,
          type: chat.type,
          lastMessage: '[button click]',
          date: new Date().toISOString()
        };
        await saveKnownChats(chats);
      }
    }

    // ── Admin interactive menu callbacks ──────────────────────────────────
    if (data.startsWith('admin:')) {
      const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
      // Security: only admin can use these buttons
      if (!adminChatId || String(fromChatId) !== String(adminChatId)) {
        await axios.post(`${BOT_API()}/answerCallbackQuery`, { callback_query_id: callbackQueryId, text: '⛔ Ruxsat yo\'q.' }).catch(() => {});
        return;
      }

      const parts = data.split(':'); // ['admin', 'hotels'] or ['admin', 'hotel', '123']
      const subAction = parts[1];
      const statusEmoji = { PENDING: '🕐', CONFIRMED: '✅', WAITING: '⏳', REJECTED: '❌' };
      const statusLabel = { PENDING: 'Kutilmoqda', CONFIRMED: 'Tasdiqladi', WAITING: 'Waiting List', REJECTED: 'Rad qildi' };

      await axios.post(`${BOT_API()}/answerCallbackQuery`, { callback_query_id: callbackQueryId }).catch(() => {});

      if (subAction === 'hotel') {
        // Show specific hotel's confirmations
        const hotelId = parseInt(parts[2]);
        const hotel = await prisma.hotel.findUnique({
          where: { id: hotelId },
          include: { city: { select: { name: true } } }
        });

        const confs = await prisma.telegramConfirmation.findMany({
          where: { hotelId },
          include: { booking: { select: { bookingNumber: true, departureDate: true } } },
          orderBy: { sentAt: 'desc' },
          take: 25
        });

        const hotelName = hotel?.name || `Hotel #${hotelId}`;
        const cityTag = hotel?.city?.name ? ` (${hotel.city.name})` : '';

        const lines = [`🏨 *${hotelName}*${cityTag}\n`];
        if (confs.length === 0) {
          lines.push('📭 Hali hech qanday zayavka yuborilmagan.');
        } else {
          // Group summary
          const counts = {};
          confs.forEach(c => { counts[c.status] = (counts[c.status] || 0) + 1; });
          const summary = ['PENDING','CONFIRMED','WAITING','REJECTED']
            .filter(s => counts[s])
            .map(s => `${statusEmoji[s]} ${statusLabel[s]}: ${counts[s]}`)
            .join('  |  ');
          lines.push(summary);
          lines.push('');
          // List each confirmation
          confs.forEach(c => {
            const em = statusEmoji[c.status] || '?';
            const lb = statusLabel[c.status] || c.status;
            const dep = c.booking?.departureDate ? ` · ${fmtDate(c.booking.departureDate)}` : '';
            const by = c.confirmedBy ? `  (${c.confirmedBy})` : '';
            lines.push(`${em} *${c.booking?.bookingNumber || `#${c.bookingId}`}*${dep} — ${lb}${by}`);
          });
        }

        await axios.post(`${BOT_API()}/editMessageText`, {
          chat_id: fromChatId,
          message_id: cb.message.message_id,
          text: lines.join('\n'),
          parse_mode: 'Markdown',
          reply_markup: JSON.stringify({
            inline_keyboard: [
              [{ text: '🔄 Yangilash', callback_data: `admin:hotel:${hotelId}` }]
            ]
          })
        }).catch(() => {});

      } else if (subAction === 'soon') {
        await axios.post(`${BOT_API()}/answerCallbackQuery`, {
          callback_query_id: callbackQueryId,
          text: '🚧 Bu bo\'lim tez kunda...',
          show_alert: true
        }).catch(() => {});
      }

      return; // Don't continue to hotel confirm/reject handler
    }
    // ── End admin menu callbacks ───────────────────────────────────────────

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
          ? `\n\n✅ ${fromName} tomonidan tasdiqlandi`
          : `\n\n❌ ${fromName} tomonidan rad qilindi`;
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
      const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
      if (adminChatId && mealConf) {
        const { booking, restaurantName, city, mealDate, pax } = mealConf;
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
        const adminMsg = [
          `${emoji} *${restaurantName}*`,
          `📋 ${booking?.bookingNumber || `#${mealConf.bookingId}`}`,
          city       ? `🏙 Shahar: *${city}*`    : null,
          mealDate   ? `📅 Sana: *${mealDate}*`  : null,
          pax        ? `👥 PAX: *${pax}* kishi`  : null,
          booking?.guide?.name ? `🧭 Gid: *${booking.guide.name}*${booking.guide.phone ? `  ${booking.guide.phone}` : ''}` : null,
          `👤 ${isConfirm ? 'TASDIQLADI' : 'RAD ETDI'}: ${fromName}`,
          `🕐 ${fmtDateUtil(now)} ${timeStr}`
        ].filter(Boolean).join('\n');
        await axios.post(`${BOT_API()}/sendMessage`, {
          chat_id: adminChatId,
          text: adminMsg,
          parse_mode: 'Markdown'
        }).catch(() => {});
      }

      console.log(`Meal callback: ${data} from ${fromName} confId=${confId}`);
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
            caption: originalCaption + `\n\n✅ ${fromName} tasdiqladi — ${providerLabel} ga yuborildi`,
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
            caption: originalCaption + `\n\n❌ ${fromName} tomonidan rad qilindi`,
            parse_mode: 'Markdown',
            reply_markup: JSON.stringify({ inline_keyboard: [] })
          }).catch(() => {});
        }

        // Notify admin
        const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
        if (adminChatId) {
          const booking = confirmation.booking;
          const adminMsg = [
            `❌ *${providerLabel}* uchun marshrut varaqasi rad etildi`,
            `📋 ${booking?.bookingNumber || `#${trBookingId}`}`,
            booking?.arrivalDate ? `📅 Boshlanishi: ${fmtDateUtil(booking.arrivalDate)}` : null,
            booking?.endDate     ? `🏁 Tugashi: ${fmtDateUtil(booking.endDate)}`         : null,
            `👤 RAD ETDI: ${fromName}`,
          ].filter(Boolean).join('\n');
          await axios.post(`${BOT_API()}/sendMessage`, {
            chat_id: adminChatId,
            text: adminMsg,
            parse_mode: 'Markdown'
          }).catch(() => {});
        }
      }

      console.log(`Transport approver callback: ${trAction} from ${fromName} for booking #${trBookingId} provider ${trProvider}`);
      return;
    }
    // ── End approver callbacks ──────────────────────────────────────────────

    // ── Transport (marshrut varaqasi) callbacks ────────────────────────────
    if (data.startsWith('tr_confirm:') || data.startsWith('tr_reject:')) {
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
          ? `\n\n✅ ${fromName} tomonidan tasdiqlandi`
          : `\n\n❌ ${fromName} tomonidan rad qilindi`;
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

      // Notify admin
      const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
      if (adminChatId) {
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
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
        const adminMsg = [
          `${emoji} *${providerLabel}*`,
          `📋 ${booking?.bookingNumber || `#${trBookingId}`}`,
          booking?.arrivalDate ? `📅 Boshlanishi: ${fmtDateUtil(booking.arrivalDate)}` : null,
          booking?.endDate     ? `🏁 Tugashi: ${fmtDateUtil(booking.endDate)}`         : null,
          booking?.guide?.name ? `🧭 Gid: *${booking.guide.name}*${booking.guide.phone ? `  ${booking.guide.phone}` : ''}` : null,
          trApprovedBy         ? `👁 TEKSHIRDI: ${trApprovedBy}`                       : null,
          `👤 ${isConfirm ? 'TASDIQLADI' : 'RAD ETDI'}: ${fromName}`,
          `🕐 ${fmtDateUtil(now)} ${timeStr}`
        ].filter(Boolean).join('\n');
        await axios.post(`${BOT_API()}/sendMessage`, {
          chat_id: adminChatId,
          text: adminMsg,
          parse_mode: 'Markdown'
        }).catch(() => {});
      }

      console.log(`Transport callback: ${trAction} from ${fromName} for booking #${trBookingId} provider ${trProvider}`);
      return;
    }
    // ── End transport callbacks ────────────────────────────────────────────

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

      // Load stored groups
      const setting = await prisma.systemSetting.findUnique({ where: { key: `JP_SECTIONS_${jpHotelId}` } });
      if (!setting) { console.warn(`JP_SECTIONS not found for hotelId ${jpHotelId}`); return; }
      const stored = JSON.parse(setting.value);
      const { year, tourType, hotelName, chatId: storedChatId, bulkMsgId } = stored;
      const groups = stored.groups;
      const editChatId = cb.message?.chat?.id || storedChatId;

      const TOUR_LABELS = { ER: 'Erlebnisreisen', CO: 'ComfortPlus', KAS: 'Kasachstan', ZA: 'Zentralasien' };
      const ST_ICON = { CONFIRMED: '✅', WAITING: '⏳', REJECTED: '❌', PENDING: '⬜' };
      const header = `📋 *Заявка ${year} — ${TOUR_LABELS[tourType] || tourType}*  🏨 *${hotelName}*`;

      // Helper — build one visit's message + keyboard (keyboard removed after action)
      function buildVisitMsg(grp, v, st) {
        const visitTitle = v.sectionLabel
          ? `*${grp.no}. ${grp.group} — ${v.sectionLabel}*`
          : `*${grp.no}. ${grp.group}*`;
        const lines = [header, '', visitTitle,
          `${ST_ICON[st]} ${v.checkIn} → ${v.checkOut} | ${v.pax} pax | DBL:${v.dbl} TWN:${v.twn} SNGL:${v.sngl}`
        ];
        // PENDING/WAITING — keep buttons; CONFIRMED/REJECTED — remove keyboard
        const showButtons = st === 'PENDING' || st === 'WAITING';
        return {
          text: lines.join('\n'),
          keyboard: showButtons ? [[
            { text: '✅ Tasdiqlash', callback_data: `jp_c:${grp.bookingId}:${jpHotelId}:${v.visitIdx}` },
            { text: '⏳ WL',        callback_data: `jp_w:${grp.bookingId}:${jpHotelId}:${v.visitIdx}` },
            { text: '❌ Rad etish', callback_data: `jp_r:${grp.bookingId}:${jpHotelId}:${v.visitIdx}` },
          ]] : []
        };
      }

      if (isBulk) {
        // Update status of ALL visits in SystemSetting
        for (const grp of groups) {
          for (const v of grp.visits) v.status = newStatus;
        }
        // Edit all visit messages
        for (const grp of groups) {
          for (const v of grp.visits) {
            if (!v.msgId) continue;
            const { text, keyboard } = buildVisitMsg(grp, v, newStatus);
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
          // Edit this visit's message
          const msgId = cb.message?.message_id;
          if (msgId && editChatId) {
            const { text, keyboard } = buildVisitMsg(targetGrp, targetVisit, newStatus);
            await axios.post(`${BOT_API()}/editMessageText`, {
              chat_id: editChatId, message_id: msgId,
              text, parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard }
            }).catch(e => console.warn('JP editMessageText error:', e.response?.data || e.message));
          }
        }
      }

      // Remove bulk action keyboard if all visits are now non-PENDING
      if (bulkMsgId && storedChatId) {
        const allActioned = groups.every(g => g.visits.every(v => v.status === 'CONFIRMED' || v.status === 'REJECTED'));
        if (allActioned) {
          await axios.post(`${BOT_API()}/editMessageReplyMarkup`, {
            chat_id: storedChatId,
            message_id: bulkMsgId,
            reply_markup: { inline_keyboard: [] }
          }).catch(() => {});
        }
      }

      // Save updated statuses back to SystemSetting
      stored.groups = groups;
      await prisma.systemSetting.update({
        where: { key: `JP_SECTIONS_${jpHotelId}` },
        data: { value: JSON.stringify(stored) }
      }).catch(() => {});

      // Admin notification
      const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
      if (adminChatId) {
        const emoji = newStatus === 'CONFIRMED' ? '✅' : newStatus === 'WAITING' ? '⏳' : '❌';
        const actionLabel = newStatus === 'CONFIRMED' ? 'Tasdiqladi' : newStatus === 'WAITING' ? 'WL ga qo\'shdi' : 'Rad etdi';
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

        let adminLines;
        if (isBulk) {
          const totalVisits = groups.reduce((s, g) => s + g.visits.length, 0);
          adminLines = [
            `${emoji} *${hotelName}* — ${actionLabel} (barcha)`,
            `📋 Заявка ${year} — ${TOUR_LABELS[tourType] || tourType}`,
            `📊 Jami ${totalVisits} ta zaezd`,
            `👤 ${fromName}`,
            `🕐 ${timeStr}`
          ];
        } else {
          const grp = groups.find(g => g.bookingId === jpBookingId);
          const v = grp?.visits.find(v => v.visitIdx === jpVisitIdx);
          adminLines = [
            `${emoji} *${hotelName}* — ${actionLabel}`,
            `📋 ${grp?.group || ''}${v?.sectionLabel ? ` — ${v.sectionLabel}` : ''}`,
            `📅 ${v?.checkIn || ''} → ${v?.checkOut || ''}`,
            `👤 ${fromName}`,
            `🕐 ${timeStr}`
          ];
        }
        await axios.post(`${BOT_API()}/sendMessage`, {
          chat_id: adminChatId,
          text: adminLines.join('\n'),
          parse_mode: 'Markdown'
        }).catch(() => {});
      }
      return;
    }
    // ── End JP callbacks ──────────────────────────────────────────────────

    const [action, bookingId, hotelId] = data.split(':');
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

    // 2. Edit the original message to show status (remove buttons)
    if (cb.message?.message_id && fromChatId) {
      const statusLine = isConfirm
        ? `\n\n✅ ${fromName} tomonidan tasdiqlandi`
        : isWaiting
        ? `\n\n⏳ ${fromName} - Waiting List`
        : `\n\n❌ ${fromName} tomonidan rad qilindi`;

      const originalCaption = cb.message.caption || '';
      await axios.post(`${BOT_API()}/editMessageCaption`, {
        chat_id: fromChatId,
        message_id: cb.message.message_id,
        caption: originalCaption + statusLine,
        parse_mode: 'Markdown'
      }).catch(() => {});
    }

    // 3. Notify admin (improved format with zaezd/viyezd)
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (adminChatId) {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      const dateStr = fmtDate(now);

      // Fetch accommodation dates for this booking+hotel
      const accs = await prisma.accommodation.findMany({
        where: { bookingId: parseInt(bookingId), hotelId: parseInt(hotelId) },
        orderBy: { checkInDate: 'asc' }
      });

      let datesStr = '';
      if (accs.length === 1) {
        datesStr = `\n🏠 Заезд: ${fmtDate(accs[0].checkInDate)}  |  Выезд: ${fmtDate(accs[0].checkOutDate)}`;
      } else if (accs.length > 1) {
        datesStr = accs.map((a, i) =>
          `\n🏠 ${i + 1}-заезд: ${fmtDate(a.checkInDate)} → ${fmtDate(a.checkOutDate)}`
        ).join('');
      }

      const adminMsg = `${emoji} *${hotelName}*\n📋 ${bookingNum}${datesStr}\n👤 ${actionText}: ${fromName}\n🕐 ${dateStr} ${timeStr}`;
      await axios.post(`${BOT_API()}/sendMessage`, {
        chat_id: adminChatId,
        text: adminMsg,
        parse_mode: 'Markdown'
      }).catch(() => {});
    }

    // 4. Update TelegramConfirmation status
    try {
      const newStatus = isConfirm ? 'CONFIRMED' : isWaiting ? 'WAITING' : 'REJECTED';
      await prisma.telegramConfirmation.updateMany({
        where: {
          bookingId: parseInt(bookingId),
          hotelId: parseInt(hotelId),
          status: 'PENDING'
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

    console.log(`Telegram callback: ${action} from ${fromName} for booking ${bookingNum} hotel ${hotelName}`);
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
    const confirmations = await prisma.telegramConfirmation.findMany({
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

    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (provider === 'hammasi') {
      // ── Direct send: no 2-stage for "hammasi" ──────────────────────────────
      const chatId = await getProviderChatId('hammasi');
      if (!chatId) {
        return res.status(400).json({ error: 'Hammasi uchun Telegram chat ID sozlanmagan' });
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
        return res.status(400).json({ error: 'Tasdiqlash uchun Hammasi chat ID sozlanmagan (GmailSettings → Transport)' });
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

// GET /api/telegram/transport-confirmations
router.get('/transport-confirmations', authenticate, async (req, res) => {
  try {
    const confirmations = await prisma.transportConfirmation.findMany({
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
    const [sevil, xayrulla, nosir, hammasi] = await Promise.all([
      getProviderChatId('sevil'),
      getProviderChatId('xayrulla'),
      getProviderChatId('nosir'),
      getProviderChatId('hammasi')
    ]);
    res.json({ sevil: sevil || '', xayrulla: xayrulla || '', nosir: nosir || '', hammasi: hammasi || '' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load transport settings' });
  }
});

// PUT /api/telegram/transport-settings
router.put('/transport-settings', authenticate, async (req, res) => {
  try {
    const { sevil, xayrulla, nosir, hammasi } = req.body;
    await Promise.all([
      setProviderChatId('sevil',    String(sevil    || '').trim()),
      setProviderChatId('xayrulla', String(xayrulla || '').trim()),
      setProviderChatId('nosir',    String(nosir    || '').trim()),
      setProviderChatId('hammasi',  String(hammasi  || '').trim())
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
    const bookings = await prisma.booking.findMany({
      select: {
        id: true,
        bookingNumber: true,
        departureDate: true,
        pax: true,
        status: true,
        guide: { select: { id: true, name: true, telegramChatId: true } }
      },
      orderBy: { bookingNumber: 'asc' }
    });

    const result = bookings.map(b => ({
      id: b.id,
      bookingId: b.id,
      bookingNumber: b.bookingNumber,
      departureDate: b.departureDate,
      pax: b.pax,
      bookingStatus: b.status,
      guideId: b.guide?.id || null,
      guideName: b.guide?.name || null,
      hasTelegram: !!(b.guide?.telegramChatId),
      status: b.guide ? 'ASSIGNED' : 'NO_GUIDE',
      booking: { bookingNumber: b.bookingNumber, departureDate: b.departureDate }
    }));

    res.json({ assignments: result });
  } catch (err) {
    console.error('guide-assignments error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/telegram/send-guide/:bookingId
router.post('/send-guide/:bookingId', authenticate, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { guideName, guideType, fullDays, halfDays, dayRate, halfDayRate, totalPayment } = req.body;

    if (!guideName) return res.status(400).json({ error: 'guideName required' });

    const guide = await prisma.guide.findFirst({ where: { name: guideName } });
    if (!guide?.telegramChatId) {
      return res.status(400).json({ error: `${guideName} uchun Telegram chat ID sozlanmagan (Guides sahifasida)` });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(bookingId) },
      include: { tourType: true }
    });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const guideTypeLabel =
      guideType === 'main'           ? 'Asosiy gid' :
      guideType === 'second'         ? 'Ikkinchi gid' :
      guideType === 'bergreiseleiter' ? 'Bergreiseleiter' : guideType;

    const fmtDate = (d) => {
      if (!d) return null;
      const dt = new Date(d);
      return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.${dt.getFullYear()}`;
    };

    const msgText = [
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

    await axios.post(`${BOT_API()}/sendMessage`, {
      chat_id: guide.telegramChatId,
      text: msgText,
      parse_mode: 'Markdown'
    });

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
        guide: { select: { name: true, phone: true } }
      }
    });
    if (!booking) return res.status(404).json({ error: 'Booking topilmadi' });

    // Create confirmation record first (need id for callback_data)
    const conf = await prisma.mealConfirmation.create({
      data: {
        bookingId: parseInt(bookingId),
        restaurantName,
        city: city || null,
        mealDate: mealDate || null,
        pax: parseInt(pax) || booking.pax || 0,
        status: 'PENDING',
        sentAt: new Date()
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

    const token = process.env.TELEGRAM_BOT_TOKEN;
    await axios.post(`${BOT_API()}/sendMessage`, {
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
    const where = bookingId ? { bookingId: parseInt(bookingId) } : {};
    const confirmations = await prisma.mealConfirmation.findMany({
      where,
      include: { booking: { select: { bookingNumber: true, departureDate: true } } },
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

module.exports = router;
