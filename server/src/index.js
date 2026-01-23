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

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
// Debug middleware to log all requests to /api/bookings
app.use('/api/bookings', (req, res, next) => {
  console.log('🔍 Request to /api/bookings:', req.method, req.path);
  next();
});
app.use('/api/bookings', touristRoutes); // Tourist routes MUST be before bookingRoutes to avoid :id catch-all
app.use('/api/bookings', routeRoutes);  // Route routes for transport planning
app.use('/api/bookings', bookingRoutes);
app.use('/api/guides', guideRoutes);
app.use('/api/tour-types', tourTypeRoutes);
app.use('/api/import', importRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/hotels', hotelRoutes);
app.use('/api/cities', cityRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Orient Insight API is running' });
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
  console.log(`🚀 Orient Insight сервер запущен на порту ${PORT}`);
});

