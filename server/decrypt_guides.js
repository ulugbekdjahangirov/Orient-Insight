const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

// Encryption was done with DEFAULT key (not env key)
const ENCRYPTION_KEY = 'orient-insight-32char-secret-key';
const ALGORITHM = 'aes-256-cbc';

function isEncrypted(text) {
  if (!text || typeof text !== 'string') return false;
  const parts = text.split(':');
  if (parts.length !== 2) return false;
  return /^[0-9a-f]{32}$/i.test(parts[0]) && /^[0-9a-f]+$/i.test(parts[1]);
}

function decrypt(text) {
  if (!text) return text;
  try {
    const parts = text.split(':');
    if (parts.length !== 2) return text;
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (e) {
    console.log('  DECRYPT ERROR:', e.message, '— keeping original');
    return text;
  }
}

async function main() {
  const guides = await prisma.guide.findMany({ orderBy: { id: 'asc' } });
  console.log('Total guides:', guides.length);

  let updated = 0;
  for (const g of guides) {
    const passportEncrypted = isEncrypted(g.passportNumber);
    const bankAccEncrypted  = isEncrypted(g.bankAccountNumber);
    const bankCardEncrypted = isEncrypted(g.bankCardNumber);

    if (!passportEncrypted && !bankAccEncrypted && !bankCardEncrypted) {
      console.log(`  [${g.id}] ${g.firstName} ${g.lastName} — no encrypted fields, skip`);
      continue;
    }

    const newPassport = passportEncrypted ? decrypt(g.passportNumber)    : g.passportNumber;
    const newBankAcc  = bankAccEncrypted  ? decrypt(g.bankAccountNumber)  : g.bankAccountNumber;
    const newBankCard = bankCardEncrypted ? decrypt(g.bankCardNumber)     : g.bankCardNumber;

    console.log(`  [${g.id}] ${g.firstName} ${g.lastName}:`);
    if (passportEncrypted)  console.log(`    passport:    "${newPassport}"`);
    if (bankAccEncrypted)   console.log(`    bankAccount: "${newBankAcc}"`);
    if (bankCardEncrypted)  console.log(`    bankCard:    "${newBankCard}"`);

    await prisma.guide.update({
      where: { id: g.id },
      data: {
        passportNumber:    newPassport,
        bankAccountNumber: newBankAcc,
        bankCardNumber:    newBankCard,
      }
    });
    console.log(`    ✅ Updated`);
    updated++;
  }

  console.log('\nDone. Updated:', updated, '/', guides.length);
}

main().catch(console.error).finally(() => prisma.$disconnect());
