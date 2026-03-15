const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin, generatePreviewToken } = require('../middleware/auth.middleware');
const gmailService = require('../services/gmail.service');

const router = express.Router();
const prisma = new PrismaClient();

// POST /api/auth/login - Вход в систему
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email и пароль обязательны' });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    if (!user.isActive) {
      return res.status(401).json({ error: 'Аккаунт деактивирован' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Ошибка входа в систему' });
  }
});

// GET /api/auth/me - Получить текущего пользователя
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/register - Регистрация (только для админа)
router.post('/register', authenticate, requireAdmin, async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Parol kamida 8 belgidan iborat bo\'lishi kerak' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: ['MANAGER', 'ADMIN'].includes(role) ? role : 'MANAGER'
      },
      select: { id: true, email: true, name: true, role: true }
    });

    res.status(201).json({ user });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Ошибка регистрации' });
  }
});

// GET /api/auth/users - Список пользователей (только для админа)
router.get('/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Ошибка получения списка пользователей' });
  }
});

// PATCH /api/auth/users/:id - Обновить пользователя (только для админа)
router.patch('/users/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, isActive, password, personalEmail } = req.body;

    if (password && password.length < 8) {
      return res.status(400).json({ error: 'Parol kamida 8 belgidan iborat bo\'lishi kerak' });
    }

    const { name, role, isActive, password, personalEmail } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (role && ['MANAGER', 'ADMIN'].includes(role)) updateData.role = role;
    if (typeof isActive === 'boolean') updateData.isActive = isActive;
    if (password) updateData.password = await bcrypt.hash(password, 10);
    if (personalEmail !== undefined) updateData.personalEmail = personalEmail || null;

    const user = await prisma.user.update({
      where: { id: parseInt(id) },
      data: updateData,
      select: { id: true, email: true, name: true, role: true, isActive: true }
    });

    res.json({ user });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Ошибка обновления пользователя' });
  }
});

// GET /api/auth/preview-token — short-lived token for window.open() PDF previews
router.get('/preview-token', authenticate, (req, res) => {
  const token = generatePreviewToken(req.user.id);
  res.json({ token, uid: req.user.id });
});

// POST /api/auth/forgot-password — send reset code to personalEmail
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email kiritilmadi' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) return res.json({ message: 'Agar email to\'g\'ri bo\'lsa, kod yuborildi' });
    if (!user.personalEmail) return res.status(400).json({ error: 'Bu akkaunt uchun tiklash email manzili sozlanmagan. Admin bilan bog\'laning.' });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 daqiqa

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: code, resetTokenExpiry: expiry }
    });

    await gmailService.sendEmail({
      to: user.personalEmail,
      subject: 'Orient Insight — Parolni tiklash kodi',
      html: `
        <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:24px;">
          <h2 style="color:#1e3a5f;">Orient Insight</h2>
          <p>Salom, <strong>${user.name}</strong>!</p>
          <p>Parolni tiklash uchun quyidagi kodni kiriting:</p>
          <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#2563eb;text-align:center;padding:16px;background:#eff6ff;border-radius:8px;margin:16px 0;">${code}</div>
          <p style="color:#6b7280;font-size:13px;">Kod 15 daqiqa davomida amal qiladi. Agar siz so'rov yubormagan bo'lsangiz, bu xabarni e'tiborsiz qoldiring.</p>
        </div>
      `
    });

    res.json({ message: 'Kod yuborildi' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Xatolik yuz berdi' });
  }
});

// POST /api/auth/reset-password — verify code and set new password
router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) return res.status(400).json({ error: 'Barcha maydonlar to\'ldirilishi kerak' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'Parol kamida 8 belgidan iborat bo\'lishi kerak' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ error: 'Kod noto\'g\'ri yoki muddati o\'tgan' });

    if (user.resetToken !== code || !user.resetTokenExpiry || new Date() > user.resetTokenExpiry) {
      return res.status(400).json({ error: 'Kod noto\'g\'ri yoki muddati o\'tgan' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword, resetToken: null, resetTokenExpiry: null }
    });

    res.json({ message: 'Parol muvaffaqiyatli o\'zgartirildi' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Xatolik yuz berdi' });
  }
});

module.exports = router;
