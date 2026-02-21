const express = require('express');
const router = express.Router();
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth.middleware');

const prisma = new PrismaClient();
const BOT_API = () => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

// GET /api/telegram/updates - Recent messages to find hotel chat IDs
router.get('/updates', authenticate, async (req, res) => {
  try {
    const response = await axios.get(`${BOT_API()}/getUpdates?limit=50`);
    const updates = response.data.result || [];

    const chats = {};
    for (const u of updates) {
      const msg = u.message || u.channel_post;
      if (!msg) continue;
      const chat = msg.chat;
      const key = chat.id;
      if (!chats[key]) {
        chats[key] = {
          chatId: String(chat.id),
          name: chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' '),
          username: chat.username ? `@${chat.username}` : null,
          type: chat.type,
          lastMessage: msg.text || '[file]',
          date: new Date(msg.date * 1000).toISOString()
        };
      }
    }

    res.json({ chats: Object.values(chats).sort((a, b) => b.date.localeCompare(a.date)) });
  } catch (error) {
    console.error('Telegram getUpdates error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch Telegram updates' });
  }
});

// POST /api/telegram/webhook - Receive callback_query from Telegram (inline keyboard buttons)
router.post('/webhook', async (req, res) => {
  // Respond immediately so Telegram doesn't retry
  res.sendStatus(200);

  try {
    const update = req.body;
    const cb = update.callback_query;
    if (!cb) return;

    const callbackQueryId = cb.id;
    const data = cb.data || '';
    const fromUser = cb.from;
    const fromName = [fromUser.first_name, fromUser.last_name].filter(Boolean).join(' ') || fromUser.username || 'Noma\'lum';
    const fromChatId = cb.message?.chat?.id;

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
    const actionText = isConfirm ? '✅ TASDIQLADI' : '❌ RAD QILDI';
    const emoji = isConfirm ? '✅' : '❌';

    // 1. Answer the callback (removes loading state on hotel's button)
    await axios.post(`${BOT_API()}/answerCallbackQuery`, {
      callback_query_id: callbackQueryId,
      text: isConfirm ? '✅ Tasdiqlandi! Rahmat.' : '❌ Rad qilindi.',
      show_alert: false
    });

    // 2. Edit the original message to show status (remove buttons)
    if (cb.message?.message_id && fromChatId) {
      const statusLine = isConfirm
        ? `\n\n✅ *${fromName} tomonidan tasdiqlandi*`
        : `\n\n❌ *${fromName} tomonidan rad qilindi*`;

      const originalCaption = cb.message.caption || '';
      await axios.post(`${BOT_API()}/editMessageCaption`, {
        chat_id: fromChatId,
        message_id: cb.message.message_id,
        caption: originalCaption + statusLine,
        parse_mode: 'Markdown'
      }).catch(() => {}); // ignore if caption too long or unchanged
    }

    // 3. Notify admin
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (adminChatId) {
      const adminMsg = `${emoji} *${hotelName}* zayavkani *${actionText}*\n\n📋 Zaявка: *${bookingNum}*\n👤 Kim: ${fromName}`;
      await axios.post(`${BOT_API()}/sendMessage`, {
        chat_id: adminChatId,
        text: adminMsg,
        parse_mode: 'Markdown'
      });
    }

    console.log(`Telegram callback: ${action} from ${fromName} for booking ${bookingNum} hotel ${hotelName}`);
  } catch (err) {
    console.error('Telegram webhook error:', err.response?.data || err.message);
  }
});

module.exports = router;
