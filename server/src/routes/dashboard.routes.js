const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/dashboard/stats - Общая статистика
router.get('/stats', authenticate, async (req, res) => {
  try {
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
      select: {
        id: true,
        pax: true,
        departureDate: true,
        endDate: true,
        tourTypeId: true,
        status: true
      }
    });

    // Рассчитываем статусы динамически
    const statusCounts = {
      CONFIRMED: 0,
      IN_PROGRESS: 0,
      PENDING: 0,
      CANCELLED: 0,
      COMPLETED: 0
    };

    const statusPaxSums = {
      CONFIRMED: 0,
      IN_PROGRESS: 0,
      PENDING: 0,
      CANCELLED: 0,
      COMPLETED: 0
    };

    allBookings.forEach(booking => {
      const calculatedStatus = booking.status === 'CANCELLED'
        ? 'CANCELLED'
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

    // Остальная статистика
    const [
      totalPax,
      bookingsByTourType,
      thisMonthBookings,
      upcomingBookings,
      guidesCount,
      tourTypesCount,
      hotelsCount,
      opexCount
    ] = await Promise.all([
      // Всего туристов
      prisma.booking.aggregate({ _sum: { pax: true } }),

      // По типам туров
      prisma.booking.groupBy({
        by: ['tourTypeId'],
        _count: { tourTypeId: true },
        _sum: { pax: true }
      }),

      // Бронирования в этом месяце
      prisma.booking.count({
        where: {
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
      prisma.guide.count({ where: { isActive: true } }),

      // Количество типов туров
      prisma.tourType.count({ where: { isActive: true } }),

      // Количество отелей
      prisma.hotel.count({ where: { isActive: true } }),

      // Количество OPEX записей (транспорт)
      prisma.transportVehicle.count({ where: { isActive: true } })
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
        totalPax: totalPax._sum.pax || 0,
        confirmed: statusCounts.CONFIRMED,
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
    const { limit = 10 } = req.query;
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Fetch all upcoming bookings (exclude cancelled)
    const bookings = await prisma.booking.findMany({
      where: {
        departureDate: { gte: now },
        status: { not: 'CANCELLED' }
      },
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

module.exports = router;
