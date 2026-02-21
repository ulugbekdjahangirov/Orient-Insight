const express = require('express');
const router = express.Router();
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth.middleware');

const prisma = new PrismaClient();
const BOT_API = () => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const CHATS_SETTING_KEY = 'TELEGRAM_KNOWN_CHATS';

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

module.exports = router;
