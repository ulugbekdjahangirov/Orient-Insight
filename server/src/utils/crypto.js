const crypto = require('crypto');

// Ключ шифрования (в продакшене хранить в переменных окружения)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'orient-insight-32char-secret-key';
const IV_LENGTH = 16;
const ALGORITHM = 'aes-256-cbc';

/**
 * Шифрует текст
 * @param {string} text - Текст для шифрования
 * @returns {string} - Зашифрованный текст в формате iv:encrypted
 */
function encrypt(text) {
  if (!text) return null;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);

  let encrypted = cipher.update(text.toString());
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * Расшифровывает текст
 * @param {string} text - Зашифрованный текст
 * @returns {string} - Расшифрованный текст
 */
function decrypt(text) {
  if (!text) return null;

  try {
    const parts = text.split(':');
    if (parts.length !== 2) return text; // Не зашифровано

    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);

    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString();
  } catch (error) {
    // Если не удалось расшифровать, возвращаем как есть
    return text;
  }
}

/**
 * Маскирует номер паспорта (показывает только последние 4 символа)
 * @param {string} passport - Номер паспорта
 * @returns {string} - Замаскированный номер
 */
function maskPassport(passport) {
  if (!passport) return null;
  const decrypted = decrypt(passport);
  if (decrypted.length <= 4) return '****';
  return '*'.repeat(decrypted.length - 4) + decrypted.slice(-4);
}

/**
 * Маскирует номер карты (показывает только последние 4 цифры)
 * @param {string} cardNumber - Номер карты
 * @returns {string} - Замаскированный номер
 */
function maskCardNumber(cardNumber) {
  if (!cardNumber) return null;
  const decrypted = decrypt(cardNumber);
  const cleaned = decrypted.replace(/\D/g, '');
  if (cleaned.length <= 4) return '****';
  return '**** **** **** ' + cleaned.slice(-4);
}

/**
 * Маскирует номер счёта (показывает только последние 4 цифры)
 * @param {string} account - Номер счёта
 * @returns {string} - Замаскированный номер
 */
function maskAccountNumber(account) {
  if (!account) return null;
  const decrypted = decrypt(account);
  if (decrypted.length <= 4) return '****';
  return '*'.repeat(decrypted.length - 4) + decrypted.slice(-4);
}

/**
 * Шифрует чувствительные поля гида
 * @param {object} data - Данные гида
 * @returns {object} - Данные с зашифрованными полями
 */
function encryptGuideData(data) {
  const encrypted = { ...data };

  if (data.passportNumber) {
    encrypted.passportNumber = encrypt(data.passportNumber);
  }
  if (data.bankAccountNumber) {
    encrypted.bankAccountNumber = encrypt(data.bankAccountNumber);
  }
  if (data.bankCardNumber) {
    encrypted.bankCardNumber = encrypt(data.bankCardNumber);
  }

  return encrypted;
}

/**
 * Расшифровывает чувствительные поля гида (для админа)
 * @param {object} guide - Данные гида из БД
 * @returns {object} - Данные с расшифрованными полями
 */
function decryptGuideData(guide) {
  if (!guide) return null;

  return {
    ...guide,
    passportNumber: decrypt(guide.passportNumber),
    bankAccountNumber: decrypt(guide.bankAccountNumber),
    bankCardNumber: decrypt(guide.bankCardNumber),
  };
}

/**
 * Маскирует чувствительные поля гида (для менеджеров)
 * @param {object} guide - Данные гида из БД
 * @returns {object} - Данные с замаскированными полями
 */
function maskGuideData(guide) {
  if (!guide) return null;

  return {
    ...guide,
    passportNumber: maskPassport(guide.passportNumber),
    bankAccountNumber: maskAccountNumber(guide.bankAccountNumber),
    bankCardNumber: maskCardNumber(guide.bankCardNumber),
  };
}

/**
 * Проверяет срок действия паспорта
 * @param {Date} expiryDate - Дата окончания срока действия
 * @param {number} monthsWarning - За сколько месяцев предупреждать (по умолчанию 3)
 * @returns {object} - { isExpired, isExpiringSoon, daysLeft, message }
 */
function checkPassportExpiry(expiryDate, monthsWarning = 3) {
  if (!expiryDate) return { isExpired: false, isExpiringSoon: false, daysLeft: null, message: null };

  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry.getTime() - now.getTime();
  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const warningDate = new Date();
  warningDate.setMonth(warningDate.getMonth() + monthsWarning);

  if (daysLeft <= 0) {
    return {
      isExpired: true,
      isExpiringSoon: false,
      daysLeft: 0,
      status: 'EXPIRED',
      message: 'Паспорт истёк!'
    };
  }

  if (expiry <= warningDate) {
    return {
      isExpired: false,
      isExpiringSoon: true,
      daysLeft,
      status: 'EXPIRING_SOON',
      message: `Паспорт истекает через ${daysLeft} дней`
    };
  }

  return {
    isExpired: false,
    isExpiringSoon: false,
    daysLeft,
    status: 'VALID',
    message: null
  };
}

module.exports = {
  encrypt,
  decrypt,
  maskPassport,
  maskCardNumber,
  maskAccountNumber,
  encryptGuideData,
  decryptGuideData,
  maskGuideData,
  checkPassportExpiry
};
