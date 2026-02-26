const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CHATS_SETTING_KEY = 'TELEGRAM_KNOWN_CHATS';

// Recovered from PM2 server logs
const recoveredChats = {
  "5848652657": {
    chatId: "5848652657",
    name: "Hotel Ansi Boutique W&S Terrace",
    username: null,
    type: "private",
    lastMessage: "[recovered]",
    date: "2026-02-20T00:00:00.000Z"
  },
  "7522693839": {
    chatId: "7522693839",
    name: "Jahongir Premium Hotel",
    username: null,
    type: "private",
    lastMessage: "[recovered]",
    date: "2026-02-20T00:00:00.000Z"
  },
  "1797974": {
    chatId: "1797974",
    name: "Makhmud Baltayev",
    username: null,
    type: "private",
    lastMessage: "[recovered]",
    date: "2026-02-20T00:00:00.000Z"
  },
  "506066046": {
    chatId: "506066046",
    name: "Matluba",
    username: null,
    type: "private",
    lastMessage: "[recovered]",
    date: "2026-02-20T00:00:00.000Z"
  },
  "125691149": {
    chatId: "125691149",
    name: "Rahmat Sharipov",
    username: null,
    type: "private",
    lastMessage: "[recovered]",
    date: "2026-02-20T00:00:00.000Z"
  },
  "1108720007": {
    chatId: "1108720007",
    name: "Saodat",
    username: null,
    type: "private",
    lastMessage: "Hi",
    date: "2026-02-21T16:22:57.000Z"
  },
  "50417337": {
    chatId: "50417337",
    name: "Ulugbek Djahangirov",
    username: null,
    type: "private",
    lastMessage: "[recovered]",
    date: "2026-02-20T00:00:00.000Z"
  },
  "349130737": {
    chatId: "349130737",
    name: "stay safe",
    username: "@staysafe11",
    type: "private",
    lastMessage: "[button click]",
    date: "2026-02-21T16:32:58.812Z"
  },
  "1048726111": {
    chatId: "1048726111",
    name: "Рузиева Саида",
    username: null,
    type: "private",
    lastMessage: "[recovered]",
    date: "2026-02-20T00:00:00.000Z"
  }
};

async function main() {
  // Merge with existing chats (don't overwrite newer data)
  let existing = {};
  try {
    const s = await prisma.systemSetting.findUnique({ where: { key: CHATS_SETTING_KEY } });
    if (s) existing = JSON.parse(s.value);
  } catch {}

  const merged = { ...recoveredChats, ...existing }; // existing takes priority

  await prisma.systemSetting.upsert({
    where: { key: CHATS_SETTING_KEY },
    update: { value: JSON.stringify(merged) },
    create: { key: CHATS_SETTING_KEY, value: JSON.stringify(merged) }
  });

  console.log('TELEGRAM_KNOWN_CHATS restored with', Object.keys(merged).length, 'chats:');
  Object.values(merged).forEach(c => console.log('  ' + c.chatId + ' — ' + c.name));

  await prisma.$disconnect();
}
main().catch(console.error);
