const crypto = require('crypto');
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const KEY_ENV = process.env.ENCRYPTION_KEY;
console.log('ENV KEY:', JSON.stringify(KEY_ENV));
console.log('ENV KEY length (chars):', KEY_ENV ? KEY_ENV.length : 'N/A');
console.log('ENV KEY Buffer.from length (bytes):', KEY_ENV ? Buffer.from(KEY_ENV).length : 'N/A');
console.log('ENV KEY Buffer.from hex length (bytes):', KEY_ENV ? Buffer.from(KEY_ENV, 'hex').length : 'N/A');
const DEFAULT_KEY = 'orient-insight-32char-secret-key';
console.log('DEFAULT KEY Buffer length:', Buffer.from(DEFAULT_KEY).length);

async function main() {
  const g = await prisma.guide.findFirst({ where: { passportNumber: { not: null } } });
  if (!g) { console.log('No guide found'); return; }
  console.log('\nGuide:', g.id, g.firstName, g.lastName);
  console.log('passportNumber raw:', g.passportNumber);

  const parts = g.passportNumber.split(':');
  if (parts.length !== 2) { console.log('Not encrypted format'); return; }
  const iv = Buffer.from(parts[0], 'hex');
  const enc = Buffer.from(parts[1], 'hex');

  // Try 1: default key
  try {
    const d = crypto.createDecipheriv('aes-256-cbc', Buffer.from(DEFAULT_KEY), iv);
    const result = Buffer.concat([d.update(enc), d.final()]).toString();
    console.log('\n[1] DEFAULT key works! Decrypted:', result);
  } catch(e) { console.log('\n[1] DEFAULT key failed:', e.message); }

  // Try 2: env key as UTF-8 (64 bytes → will fail AES-256)
  if (KEY_ENV) {
    try {
      const d = crypto.createDecipheriv('aes-256-cbc', Buffer.from(KEY_ENV), iv);
      const result = Buffer.concat([d.update(enc), d.final()]).toString();
      console.log('[2] ENV key UTF-8 works! Decrypted:', result);
    } catch(e) { console.log('[2] ENV key UTF-8 failed:', e.message); }
  }

  // Try 3: env key as hex (32 bytes)
  if (KEY_ENV) {
    try {
      const d = crypto.createDecipheriv('aes-256-cbc', Buffer.from(KEY_ENV, 'hex'), iv);
      const result = Buffer.concat([d.update(enc), d.final()]).toString();
      console.log('[3] ENV key hex-decoded works! Decrypted:', result);
    } catch(e) { console.log('[3] ENV key hex-decoded failed:', e.message); }
  }

  // Try 4: first 32 chars of env key
  if (KEY_ENV && KEY_ENV.length >= 32) {
    try {
      const k = Buffer.from(KEY_ENV.substring(0, 32));
      const d = crypto.createDecipheriv('aes-256-cbc', k, iv);
      const result = Buffer.concat([d.update(enc), d.final()]).toString();
      console.log('[4] ENV key first-32-chars works! Decrypted:', result);
    } catch(e) { console.log('[4] ENV key first-32-chars failed:', e.message); }
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
