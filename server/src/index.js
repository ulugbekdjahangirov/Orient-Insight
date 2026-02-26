require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth.routes');
const bookingRoutes = require('./routes/booking.routes');
const guideRoutes = require('./routes/guide.routes');
const tourTypeRoutes = require('./routes/tourType.routes');
const importRoutes = require('./routes/import.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const hotelRoutes = require('./routes/hotel.routes');
const cityRoutes = require('./routes/city.routes');
const touristRoutes = require('./routes/tourist.routes');
const routeRoutes = require('./routes/route.routes');
const transportRoutes = require('./routes/transport.routes');
const gmailRoutes = require('./routes/gmail.routes');
const telegramRoutes = require('./routes/telegram.routes');
const tourServiceRoutes = require('./routes/tourservice.routes');
const invoiceRoutes = require('./routes/invoice.routes');
const priceRoutes = require('./routes/price.routes');
const opexRoutes = require('./routes/opex.routes');
const jahresplanungRoutes = require('./routes/jahresplanung.routes');
const searchRoutes = require('./routes/search.routes');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
const allowedOrigins = [
  'https://booking-calendar.uz',
  'http://localhost:3000',
  'http://localhost:5173'
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/bookings', touristRoutes); // Tourist routes MUST be before bookingRoutes to avoid :id catch-all
app.use('/api/bookings', routeRoutes);  // Route routes for transport planning
app.use('/api/routes', routeRoutes);     // Route template routes (standalone, not per booking)
app.use('/api/bookings', tourServiceRoutes); // Tour service routes (Eintritt, Metro, Shou, Other)
app.use('/api/accommodations', bookingRoutes); // Accommodation template routes
app.use('/api/bookings', bookingRoutes);
app.use('/api/guides', guideRoutes);
app.use('/api/tour-types', tourTypeRoutes);
app.use('/api/import', importRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/hotels', hotelRoutes);
app.use('/api/cities', cityRoutes);
app.use('/api/transport', transportRoutes);
app.use('/api/gmail', gmailRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/prices', priceRoutes);
app.use('/api/opex', opexRoutes);
app.use('/api/jahresplanung', jahresplanungRoutes);
app.use('/api/search', searchRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Orient Insight API is running' });
});

// Serve client static files (production)
const clientPath = path.join(__dirname, '../../client');
app.use(express.static(clientPath));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(clientPath, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Внутренняя ошибка сервера',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(PORT, () => {
});

// Migrate old Gmail whitelist if needed
const { PrismaClient } = require('@prisma/client');
const _prisma = new PrismaClient();
_prisma.systemSetting.findUnique({ where: { key: 'GMAIL_SENDER_WHITELIST' } }).then(setting => {
  if (setting) {
    const whitelist = JSON.parse(setting.value);
    if (whitelist.length === 1 && whitelist[0] === '@orient-tours.de') {
      _prisma.systemSetting.update({
        where: { key: 'GMAIL_SENDER_WHITELIST' },
        data: { value: JSON.stringify(['@world-insight.de']) }
      });
    }
  }
}).catch(() => {});

// Start Gmail polling cron job
const { startGmailPolling } = require('./jobs/gmailPoller.job');
startGmailPolling();
