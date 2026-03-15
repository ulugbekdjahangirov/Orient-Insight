const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/dashboard/stats - Общая статистика
router.get('/stats', authenticate, async (req, res) => {
  try {
    const yearFilter = req.query.year ? parseInt(req.query.year) : null;
    const bookingWhere = yearFilter ? { bookingYear: yearFilter } : {};

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Helper to calculate status based on PAX, departure date, and end date
    const calculateStatus = (pax, departureDate, endDate) => {
      const paxCount = parseInt(pax) || 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Check if tour has ended
      if (endDate) {
        const tourEndDate = new Date(endDate);
        tourEndDate.setHours(0, 0, 0, 0);
        if (tourEndDate < today) {
          return 'COMPLETED';
        }
      }

      if (departureDate) {
        const daysUntilDeparture = Math.ceil((new Date(departureDate) - today) / (1000 * 60 * 60 * 24));

        if (daysUntilDeparture < 30 && paxCount < 4) {
          return 'CANCELLED';
        }
      }

      if (paxCount >= 6) {
        return 'CONFIRMED';
      } else if (paxCount === 4 || paxCount === 5) {
        return 'IN_PROGRESS';
      } else {
        return 'PENDING';
      }
    };

    // Получаем все бронирования для расчета статусов
    const allBookings = await prisma.booking.findMany({
      where: bookingWhere,
      select: {
        id: true,
        pax: true,
        paxSource: true,
        departureDate: true,
        endDate: true,
        tourTypeId: true,
        status: true,
        tourists: { select: { id: true } }
      }
    });

    // Рассчитываем статусы динамически
    const statusCounts = {
      CONFIRMED: 0,
      FINAL_CONFIRMED: 0,
      IN_PROGRESS: 0,
      PENDING: 0,
      CANCELLED: 0,
      COMPLETED: 0
    };

    const statusPaxSums = {
      CONFIRMED: 0,
      FINAL_CONFIRMED: 0,
      IN_PROGRESS: 0,
      PENDING: 0,
      CANCELLED: 0,
      COMPLETED: 0
    };

    allBookings.forEach(booking => {
      const calculatedStatus = booking.status === 'CANCELLED'
        ? 'CANCELLED'
        : booking.status === 'FINAL_CONFIRMED'
        ? 'FINAL_CONFIRMED'
        : calculateStatus(booking.pax, booking.departureDate, booking.endDate);
      statusCounts[calculatedStatus]++;
      statusPaxSums[calculatedStatus] += booking.pax;
    });

    // Формируем массив для графика (как groupBy возвращает)
    const bookingsByStatus = Object.keys(statusCounts)
      .filter(status => statusCounts[status] > 0)
      .map(status => ({
        status,
        _count: { status: statusCounts[status] },
        _sum: { pax: statusPaxSums[status] }
      }));

    // Всего туристов: tourists.length if imported, else booking.pax (identical to Bookings page)
    const totalPaxCalc = allBookings.reduce((sum, b) => {
      if (b.status === 'CANCELLED') return sum;
      const touristCount = b.tourists ? b.tourists.length : 0;
      const isBookingOverview = b.paxSource === 'BOOKING_OVERVIEW';
      return sum + (isBookingOverview ? (b.pax || 0) : (touristCount > 0 ? touristCount : (b.pax || 0)));
    }, 0);

    // Остальная статистика
    const [
      bookingsByTourType,
      thisMonthBookings,
      upcomingBookings,
      guidesCount,
      tourTypesCount,
      hotelsCount,
      opexCount
    ] = await Promise.all([
      // По типам туров
      prisma.booking.groupBy({
        by: ['tourTypeId'],
        where: bookingWhere,
        _count: { tourTypeId: true },
        _sum: { pax: true }
      }),

      // Бронирования в этом месяце
      prisma.booking.count({
        where: {
          ...bookingWhere,
          departureDate: {
            gte: startOfMonth,
            lte: endOfMonth
          }
        }
      }),

      // Предстоящие бронирования (не завершенные и не отмененные)
      allBookings.filter(b => {
        const status = calculateStatus(b.pax, b.departureDate, b.endDate);
        return status !== 'CANCELLED' && status !== 'COMPLETED' && new Date(b.departureDate) >= now;
      }).length,

      // Количество гидов
      prisma.guide.count({ where: { isActive: true, ...(yearFilter ? { year: yearFilter } : {}) } }),

      // Количество типов туров
      prisma.tourType.count({ where: { isActive: true } }),

      // Количество отелей
      prisma.hotel.count({ where: { isActive: true } }),

      // Количество OPEX записей (транспорт)
      prisma.transportVehicle.count({ where: { isActive: true, ...(yearFilter ? { year: yearFilter } : {}) } })
    ]);

    // Получаем названия типов туров
    const tourTypes = await prisma.tourType.findMany({
      select: { id: true, code: true, name: true, color: true }
    });
    const tourTypeMap = new Map(tourTypes.map(t => [t.id, t]));

    const bookingsByTourTypeWithNames = bookingsByTourType.map(item => ({
      ...item,
      tourType: tourTypeMap.get(item.tourTypeId)
    }));

    res.json({
      overview: {
        totalBookings: allBookings.length,
        totalPax: totalPaxCalc,
        confirmed: statusCounts.CONFIRMED,
        finalConfirmed: statusCounts.FINAL_CONFIRMED,
        inProgress: statusCounts.IN_PROGRESS,
        pending: statusCounts.PENDING,
        cancelled: statusCounts.CANCELLED,
        completed: statusCounts.COMPLETED,
        thisMonthBookings,
        upcomingBookings,
        guidesCount,
        tourTypesCount,
        hotelsCount,
        opexCount
      },
      bookingsByStatus,
      bookingsByTourType: bookingsByTourTypeWithNames
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Ошибка получения статистики' });
  }
});

// GET /api/dashboard/upcoming - Ближайшие бронирования
router.get('/upcoming', authenticate, async (req, res) => {
  try {
    const { limit = 10, year } = req.query;
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const where = { departureDate: { gte: now }, status: { not: 'CANCELLED' } };
    if (year) where.bookingYear = parseInt(year);

    // Fetch all upcoming bookings (exclude cancelled)
    const bookings = await prisma.booking.findMany({
      where,
      include: {
        tourType: { select: { code: true, name: true, color: true } },
        guide: { select: { name: true } }
      },
      orderBy: { departureDate: 'asc' },
      take: parseInt(limit)
    });

    res.json({ bookings });
  } catch (error) {
    console.error('Upcoming bookings error:', error);
    res.status(500).json({ error: 'Ошибка получения ближайших бронирований' });
  }
});

// GET /api/dashboard/monthly - Статистика по месяцам
router.get('/monthly', authenticate, async (req, res) => {
  try {
    const { year = new Date().getFullYear() } = req.query;

    const startOfYear = new Date(parseInt(year), 0, 1);
    const endOfYear = new Date(parseInt(year), 11, 31);

    const bookings = await prisma.booking.findMany({
      where: {
        departureDate: {
          gte: startOfYear,
          lte: endOfYear
        }
      },
      select: {
        departureDate: true,
        pax: true,
        tourTypeId: true
      }
    });

    // Группируем по месяцам
    const monthlyStats = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      bookings: 0,
      pax: 0
    }));

    bookings.forEach(booking => {
      const month = booking.departureDate.getMonth();
      monthlyStats[month].bookings++;
      monthlyStats[month].pax += booking.pax;
    });

    res.json({ year: parseInt(year), monthlyStats });
  } catch (error) {
    console.error('Monthly stats error:', error);
    res.status(500).json({ error: 'Ошибка получения месячной статистики' });
  }
});

// GET /api/dashboard/guide-workload - Загрузка гидов
router.get('/guide-workload', authenticate, async (req, res) => {
  try {
    const now = new Date();
    const threeMonthsLater = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate());

    const guideStats = await prisma.guide.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: { bookings: true }
        },
        bookings: {
          where: {
            departureDate: {
              gte: now,
              lte: threeMonthsLater
            },
            status: { not: 'CANCELLED' }
          },
          select: {
            id: true,
            bookingNumber: true,
            departureDate: true,
            pax: true
          },
          orderBy: { departureDate: 'asc' }
        }
      }
    });

    const workload = guideStats.map(guide => ({
      id: guide.id,
      name: guide.name,
      totalBookings: guide._count.bookings,
      upcomingBookings: guide.bookings.length,
      upcomingPax: guide.bookings.reduce((sum, b) => sum + b.pax, 0),
      nextBookings: guide.bookings.slice(0, 3)
    }));

    res.json({ workload });
  } catch (error) {
    console.error('Guide workload error:', error);
    res.status(500).json({ error: 'Ошибка получения загрузки гидов' });
  }
});

// GET /api/dashboard/financial?year=X
router.get('/financial', authenticate, async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const bookingWhere = {
      bookingYear: year,
      status: { not: 'CANCELLED' },
      tourType: { code: { in: ['ER', 'CO', 'KAS', 'ZA'] } }
    };

    const [invoices, hotelsUSDResult, hotelsUZSResult, routesResult, railwaysResult, bookingsWithGuides, shamixonSetting] = await Promise.all([
      // Invoice totals — only invoices with firma set
      prisma.invoice.findMany({
        where: { booking: bookingWhere, firma: { not: null } },
        select: { totalAmount: true, isPaid: true, firma: true, currency: true }
      }),
      // Hotels USD (pricePerNight <= 10000)
      prisma.accommodationRoom.aggregate({
        where: { accommodation: { booking: bookingWhere }, pricePerNight: { lte: 10000 } },
        _sum: { totalCost: true }
      }),
      // Hotels UZS (pricePerNight > 10000)
      prisma.accommodationRoom.aggregate({
        where: { accommodation: { booking: bookingWhere }, pricePerNight: { gt: 10000 } },
        _sum: { totalCost: true }
      }),
      // Routes (transport) — UZS
      prisma.route.aggregate({
        where: { booking: bookingWhere },
        _sum: { price: true }
      }),
      // Railways — UZS
      prisma.railway.aggregate({
        where: { booking: bookingWhere },
        _sum: { price: true }
      }),
      // Bookings with guide info for USD guide cost
      prisma.booking.findMany({
        where: { ...bookingWhere, guideId: { not: null } },
        select: {
          guideFullDays: true, guideHalfDays: true,
          mainGuideData: true, additionalGuides: true, bergreiseleiter: true,
          guide: { select: { dayRate: true, halfDayRate: true } }
        }
      }),
      // Shamixon items (stored in SystemSetting)
      prisma.systemSetting.findUnique({ where: { key: 'SHAMIXON_ITEMS' } })
    ]);

    // ── Invoice summary ──────────────────────────────────────────────────
    let invoiceTotal = 0, invoicePaid = 0;
    const byFirma = {};
    for (const inv of invoices) {
      if ((inv.currency || 'USD') !== 'USD') continue;
      const amount = inv.totalAmount || 0;
      invoiceTotal += amount;
      if (inv.isPaid) invoicePaid += amount;
      const firma = inv.firma;
      if (!byFirma[firma]) byFirma[firma] = { total: 0, paid: 0 };
      byFirma[firma].total += amount;
      if (inv.isPaid) byFirma[firma].paid += amount;
    }

    // ── Guide USD ────────────────────────────────────────────────────────
    let guideTotalUSD = 0;
    for (const b of bookingsWithGuides) {
      try {
        if (b.mainGuideData) {
          const mg = typeof b.mainGuideData === 'string' ? JSON.parse(b.mainGuideData) : b.mainGuideData;
          if (mg) {
            const dr = mg.dayRate || mg.guide?.dayRate || b.guide?.dayRate || 110;
            const hdr = mg.halfDayRate || mg.guide?.halfDayRate || b.guide?.halfDayRate || 55;
            guideTotalUSD += (mg.fullDays || b.guideFullDays || 0) * dr + (mg.halfDays || b.guideHalfDays || 0) * hdr;
          }
        } else {
          const dr = b.guide?.dayRate || 110;
          const hdr = b.guide?.halfDayRate || 55;
          guideTotalUSD += (b.guideFullDays || 0) * dr + (b.guideHalfDays || 0) * hdr;
        }
      } catch {}
      try {
        if (b.additionalGuides) {
          const ag = JSON.parse(b.additionalGuides);
          for (const g of (Array.isArray(ag) ? ag : [])) {
            guideTotalUSD += (g.fullDays || 0) * (g.dayRate || g.guide?.dayRate || 110) + (g.halfDays || 0) * (g.halfDayRate || g.guide?.halfDayRate || 55);
          }
        }
      } catch {}
      try {
        if (b.bergreiseleiter) {
          const bg = typeof b.bergreiseleiter === 'string' ? JSON.parse(b.bergreiseleiter) : b.bergreiseleiter;
          guideTotalUSD += (bg.fullDays || 0) * (bg.dayRate || bg.guide?.dayRate || 50) + (bg.halfDays || 0) * (bg.halfDayRate || 0);
        }
      } catch {}
    }

    // ── Shamixon summary ─────────────────────────────────────────────────
    let shamixonPayment = 0, shamixonIncoming = 0, shamixonReceived = 0, shamixonTotal = 0;
    try {
      const shamixonItems = shamixonSetting ? JSON.parse(shamixonSetting.value) : [];
      for (const item of shamixonItems) {
        const payment = parseFloat(item.gruppe) || 0;
        const commission = payment * 0.01;
        const transferFee = 50;
        const incoming = payment - commission - transferFee;
        const received = parseFloat(item.receivedAmount) || 0;
        const serviceFee = parseFloat(item.serviceFee) || 0;
        shamixonPayment += payment;
        shamixonIncoming += incoming;
        shamixonReceived += received;
        shamixonTotal += received - serviceFee;
      }
    } catch {}

    res.json({
      invoice: {
        total: Math.round(invoiceTotal),
        paid: Math.round(invoicePaid),
        unpaid: Math.round(invoiceTotal - invoicePaid),
        byFirma
      },
      shamixon: {
        payment: Math.round(shamixonPayment * 100) / 100,
        incoming: Math.round(shamixonIncoming * 100) / 100,
        received: Math.round(shamixonReceived * 100) / 100,
        total: Math.round(shamixonTotal * 100) / 100,
        remaining: Math.round((shamixonIncoming - shamixonReceived) * 100) / 100
      },
      ausgaben: {
        totalUSD: Math.round((hotelsUSDResult._sum.totalCost || 0) + guideTotalUSD),
        totalUZS: Math.round((hotelsUZSResult._sum.totalCost || 0) + (routesResult._sum.price || 0) + (railwaysResult._sum.price || 0))
      }
    });
  } catch (err) {
    console.error('Financial stats error:', err);
    res.status(500).json({ error: 'Failed to load financial stats' });
  }
});

// GET /api/dashboard/notifications
router.get('/notifications', authenticate, async (req, res) => {
  try {
    const now = new Date();
    const in7days = new Date(now);
    in7days.setDate(in7days.getDate() + 7);

    // Arrival = departureDate + 1, so "1 kun qoldi" = departureDate is today
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999);

    const [pendingHotels, upcomingBookings, pendingTransport, arrivingTomorrow] = await Promise.all([
      // Pending hotel Telegram confirmations
      prisma.telegramConfirmation.findMany({
        where: { status: 'PENDING' },
        include: {
          booking: { select: { id: true, bookingNumber: true } },
          hotel:   { select: { name: true } }
        },
        orderBy: { sentAt: 'desc' },
        take: 20
      }),

      // Bookings departing within 7 days (not cancelled)
      prisma.booking.findMany({
        where: {
          departureDate: { gte: now, lte: in7days },
          status: { not: 'CANCELLED' }
        },
        select: { id: true, bookingNumber: true, departureDate: true, pax: true },
        orderBy: { departureDate: 'asc' },
        take: 10
      }),

      // Pending transport confirmations
      prisma.transportConfirmation.findMany({
        where: { status: 'PENDING' },
        include: {
          booking: { select: { id: true, bookingNumber: true } }
        },
        orderBy: { sentAt: 'desc' },
        take: 20
      }),

      // Groups arriving tomorrow (departureDate = today)
      prisma.booking.findMany({
        where: {
          departureDate: { gte: todayStart, lte: todayEnd },
          status: { not: 'CANCELLED' }
        },
        select: { id: true, bookingNumber: true, departureDate: true, pax: true },
        orderBy: { departureDate: 'asc' }
      })
    ]);

    const items = [];

    // Hotel confirmations
    for (const c of pendingHotels) {
      const sentDate = c.sentAt ? new Date(c.sentAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : '';
      items.push({
        id: `hotel_${c.id}`,
        type: 'hotel',
        message: `${c.booking.bookingNumber}: ${c.hotel.name}`,
        subtitle: `Tasdiqlash kutilmoqda${sentDate ? ' • ' + sentDate : ''}`,
        url: '/partners',
        time: c.sentAt
      });
    }

    // Upcoming departures
    for (const b of upcomingBookings) {
      const diff = Math.ceil((new Date(b.departureDate) - now) / (1000 * 60 * 60 * 24));
      const label = diff === 0 ? 'bugun' : diff === 1 ? 'ertaga' : `${diff} kundan keyin`;
      const dateStr = new Date(b.departureDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
      items.push({
        id: `departure_${b.id}`,
        type: 'departure',
        message: `${b.bookingNumber} — ${label} jo'naydi`,
        subtitle: `${dateStr} • ${b.pax} kishi`,
        url: `/bookings/${b.id}`,
        time: b.departureDate
      });
    }

    // Groups arriving tomorrow
    for (const b of arrivingTomorrow) {
      const arrivalDate = new Date(b.departureDate);
      arrivalDate.setDate(arrivalDate.getDate() + 1);
      const dateStr = arrivalDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
      items.push({
        id: `arrival_${b.id}`,
        type: 'arrival',
        message: `${b.bookingNumber} — ertaga keladi`,
        subtitle: `${dateStr} • ${b.pax} kishi`,
        url: `/bookings/${b.id}`,
        time: b.departureDate
      });
    }

    // Transport confirmations
    for (const c of pendingTransport) {
      const sentDate = c.sentAt ? new Date(c.sentAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : '';
      items.push({
        id: `transport_${c.id}`,
        type: 'transport',
        message: `${c.booking.bookingNumber}: ${c.provider}`,
        subtitle: `Marshrut tasdiqlash kutilmoqda${sentDate ? ' • ' + sentDate : ''}`,
        url: '/partners',
        time: c.sentAt
      });
    }

    res.json({ items, total: items.length });
  } catch (err) {
    console.error('Notifications error:', err);
    res.status(500).json({ error: 'Failed to load notifications' });
  }
});

module.exports = router;
