const express = require('express');
const router = express.Router();
const axios = require('axios');
const { authenticate } = require('../middleware/auth');

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

module.exports = router;
