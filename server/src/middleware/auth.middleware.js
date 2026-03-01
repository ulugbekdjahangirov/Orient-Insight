const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Проверка JWT токена
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Токен не предоставлен' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true, role: true, isActive: true }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Пользователь не найден или деактивирован' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Недействительный токен' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Токен истёк' });
    }
    return res.status(500).json({ error: 'Ошибка аутентификации' });
  }
};

// Проверка роли администратора
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Требуются права администратора' });
  }
  next();
};

// Проверка ролей (admin или manager)
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Недостаточно прав доступа' });
    }
    next();
  };
};

// ── Preview Token: for window.open() PDF endpoints ──
// Token = HMAC(secret, userId:slot) where slot changes every 30 min
const PREVIEW_SLOT_MS = 30 * 60 * 1000;

const generatePreviewToken = (userId) => {
  const slot = Math.floor(Date.now() / PREVIEW_SLOT_MS);
  return crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(`${userId}:${slot}`)
    .digest('hex');
};

// Middleware: accepts JWT, preview token, or internal server secret
const authenticatePreview = async (req, res, next) => {
  // 0. Internal server-to-server calls (Puppeteer)
  const internalSecret = process.env.INTERNAL_API_SECRET;
  if (internalSecret && req.headers['x-internal-secret'] === internalSecret) {
    return next();
  }

  // 1. Try standard JWT first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authenticate(req, res, next);
  }

  // 2. Try preview token from query string
  const pt = req.query._pt;
  const uid = req.query._uid;
  if (pt && uid) {
    const userId = parseInt(uid, 10);
    if (!isNaN(userId)) {
      const slot = Math.floor(Date.now() / PREVIEW_SLOT_MS);
      // Check current slot and previous slot (handles boundary case)
      const validTokens = [slot, slot - 1].map(s =>
        crypto.createHmac('sha256', process.env.JWT_SECRET)
          .update(`${userId}:${s}`)
          .digest('hex')
      );
      if (validTokens.includes(pt)) {
        try {
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, name: true, role: true, isActive: true }
          });
          if (user && user.isActive) {
            req.user = user;
            return next();
          }
        } catch {}
      }
    }
  }

  return res.status(401).json({ error: 'Autentifikatsiya talab qilinadi' });
};

module.exports = { authenticate, requireAdmin, requireRole, generatePreviewToken, authenticatePreview };
