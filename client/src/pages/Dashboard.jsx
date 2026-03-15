import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { dashboardApi, bookingsApi, touristsApi, routesApi, railwaysApi, flightsApi, tourServicesApi, transportApi, opexApi } from '../services/api';
import { calculateGrandTotal, calculateExpenses } from '../utils/ausgabenCalc';
import { useYear } from '../context/YearContext';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useIsMobile } from '../hooks/useMediaQuery';
import {
  CalendarDays,
  Users,
  MapPin,
  TrendingUp,
  ArrowRight,
  Clock,
  BarChart3,
  Hotel,
  Wallet,
  DollarSign,
  CheckCircle,
  XCircle,
  Activity,
  BadgeCheck,
  FileText,
  BarChart2,
  TrendingDown,
  RefreshCw
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

const statusLabels = {
  PENDING: 'Ожидает',
  CONFIRMED: 'Подтверждено',
  FINAL_CONFIRMED: 'Final Confirmed',
  IN_PROGRESS: 'В процессе',
  COMPLETED: 'Завершено',
  CANCELLED: 'Отменено'
};

const statusColors = {
  PENDING: '#F59E0B',      // Желтый (Ожидает)
  CONFIRMED: '#10B981',        // Зеленый (Подтверждено)
  FINAL_CONFIRMED: '#059669', // Темно-зеленый (Final Confirmed)
  IN_PROGRESS: '#8B5CF6',     // Фиолетовый (В процессе)
  COMPLETED: '#3B82F6',    // Синий (Завершено)
  CANCELLED: '#EF4444'     // Красный (Отменено)
};

const statusClasses = {
  PENDING: 'bg-gradient-to-r from-yellow-200 to-amber-300 text-yellow-900 border-2 border-yellow-400',
  CONFIRMED: 'bg-gradient-to-r from-green-200 to-emerald-300 text-green-900 border-2 border-green-400',
  FINAL_CONFIRMED: 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white border-2 border-emerald-700',
  IN_PROGRESS: 'bg-gradient-to-r from-purple-200 to-violet-300 text-purple-900 border-2 border-purple-400',
  COMPLETED: 'bg-gradient-to-r from-blue-200 to-indigo-300 text-blue-900 border-2 border-blue-400',
  CANCELLED: 'bg-gradient-to-r from-red-200 to-rose-300 text-red-900 border-2 border-red-400'
};

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

export default function Dashboard() {
  const { selectedYear } = useYear();
  const [stats, setStats] = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [totalPax, setTotalPax] = useState(0);
  const [loading, setLoading] = useState(true);
  const [financial, setFinancial] = useState(null);
  const [ausgaben, setAusgaben] = useState(null); // from Ausgaben localStorage cache
  const [exchangeRate, setExchangeRate] = useState(12700);
  const isMobile = useIsMobile();

  useEffect(() => { loadData(); }, [selectedYear]);

  const [ausgabenLoading, setAusgabenLoading] = useState(false);

  const computeTotalsFromDetailedData = (detailedData, bookingsList = []) => {
    const withHotels = detailedData.filter(b => { const e = b.expenses || {}; return e.hotelsUSD > 0 || e.hotelsUZS > 0; });
    const totalUSD = withHotels.reduce((s, b) => s + (b.expenses?.hotelsUSD || 0) + (b.expenses?.guide || 0), 0);
    const totalUZS = withHotels.reduce((s, b) => {
      const e = b.expenses || {};
      return s + (e.hotelsUZS || 0) + (e.transportSevil || 0) + (e.transportXayrulla || 0) + (e.transportNosir || 0) + (e.railway || 0) + (e.flights || 0) + (e.meals || 0) + (e.eintritt || 0) + (e.metro || 0) + (e.shou || 0) + (e.other || 0);
    }, 0);
    // Bank tab: FINAL_CONFIRMED bookings only, uberweisungUZS
    const finalIds = new Set(bookingsList.filter(b => b.status === 'FINAL_CONFIRMED').map(b => b.id));
    const bankUZS = detailedData
      .filter(b => finalIds.size === 0 ? false : finalIds.has(b.bookingId))
      .reduce((s, b) => s + (b.expenses?.uberweisungUZS || 0), 0);
    return { totalUSD: Math.round(totalUSD), totalUZS: Math.round(totalUZS), bankUZS: Math.round(bankUZS) };
  };

  const readAusgabenCache = (year) => {
    try {
      const raw = localStorage.getItem(`ausgaben_cache_v6_ALL_${year}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const detailedData = parsed.detailedData || [];
      if (detailedData.length === 0) return null;
      return computeTotalsFromDetailedData(detailedData, parsed.bookings || []);
    } catch { return null; }
  };

  const computeAusgabenTotals = async (year) => {
    setAusgabenLoading(true);
    try {
      const resp = await bookingsApi.getAll({ year });
      const allBookings = (resp.data.bookings || []).filter(b =>
        b.status !== 'CANCELLED' && ['ER', 'CO', 'KAS', 'ZA'].includes(b.tourType?.code)
      );

      // Pre-fetch OPEX
      const tourTypes = [...new Set(allBookings.map(b => (b.tourType?.code || 'ER').toUpperCase()))];
      const opexCache = {};
      await Promise.all(tourTypes.map(async (tt) => {
        const [mealRes, showsRes, sightsRes] = await Promise.all([
          opexApi.get(tt, 'meal').catch(() => ({ data: { items: [] } })),
          opexApi.get(tt, 'shows').catch(() => ({ data: { items: [] } })),
          opexApi.get(tt, 'sightseeing').catch(() => ({ data: { items: [] } })),
        ]);
        opexCache[tt] = { meal: mealRes.data?.items || [], shows: showsRes.data?.items || [], sightseeing: sightsRes.data?.items || [] };
      }));

      let metroVehicles = [];
      try { metroVehicles = (await transportApi.getAll(year)).data.grouped?.metro || []; } catch {}

      // Process in batches of 5
      const BATCH = 5;
      const detailedData = [];
      for (let i = 0; i < allBookings.length; i += BATCH) {
        const batch = allBookings.slice(i, i + BATCH);
        const results = await Promise.all(batch.map(async (booking) => {
          try {
            const [accRes, touristRes, routeRes, railRes, flightRes, svcRes] = await Promise.all([
              bookingsApi.getAccommodations(booking.id).catch(() => ({ data: { accommodations: [] } })),
              touristsApi.getAll(booking.id).catch(() => ({ data: { tourists: [] } })),
              routesApi.getAll(booking.id).catch(() => ({ data: { routes: [] } })),
              railwaysApi.getAll(booking.id).catch(() => ({ data: { railways: [] } })),
              flightsApi.getAll(booking.id).catch(() => ({ data: { flights: [] } })),
              tourServicesApi.getAll(booking.id).catch(() => ({ data: { services: [] } })),
            ]);
            const accommodations = accRes.data.accommodations || [];
            const tourists = touristRes.data.tourists || [];
            const routes = routeRes.data.routes || [];
            const railways = railRes.data.railways || [];
            const flights = flightRes.data.flights || [];
            const tourServices = svcRes.data.services || [];

            const roomingLists = {};
            await Promise.all(accommodations.map(async (acc) => {
              try { roomingLists[acc.id] = (await bookingsApi.getAccommodationRoomingList(booking.id, acc.id)).data.roomingList || []; }
              catch { roomingLists[acc.id] = []; }
            }));

            const grandTotalData = calculateGrandTotal(accommodations, tourists, roomingLists);
            const expenses = calculateExpenses(booking, tourists, grandTotalData, routes, railways, flights, tourServices, metroVehicles, opexCache);
            return { bookingId: booking.id, expenses };
          } catch { return null; }
        }));
        detailedData.push(...results.filter(Boolean));
      }

      const totals = computeTotalsFromDetailedData(detailedData, allBookings);
      setAusgaben(totals);

      // Save to same localStorage key so Ausgaben page can use it too
      try {
        localStorage.setItem(`ausgaben_cache_v6_ALL_${year}`, JSON.stringify({
          detailedData, timestamp: Date.now()
        }));
      } catch {}
    } catch (err) {
      console.error('Dashboard Ausgaben compute error:', err);
    } finally {
      setAusgabenLoading(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    // Try localStorage cache first (instant)
    const cached = readAusgabenCache(selectedYear);
    if (cached) setAusgaben(cached);
    try {
      const [statsRes, upcomingRes, monthlyRes, financialRes] = await Promise.all([
        dashboardApi.getStats(selectedYear),
        dashboardApi.getUpcoming(5, selectedYear),
        dashboardApi.getMonthly(selectedYear),
        dashboardApi.getFinancial(selectedYear)
      ]);
      setStats(statsRes.data);
      setUpcoming(upcomingRes.data.bookings);
      setMonthly(monthlyRes.data.monthlyStats);
      setTotalPax(statsRes.data?.overview?.totalPax || 0);
      setFinancial(financialRes.data);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
    // Fetch CBU exchange rate (non-blocking)
    try {
      const r = await fetch('https://cbu.uz/uz/arkhiv-kursov-valyut/json/USD/');
      const d = await r.json();
      const rate = parseFloat(d[0]?.Rate);
      if (rate > 0) setExchangeRate(Math.round(rate));
    } catch {}
    // If no cache found, compute Ausgaben totals in background
    if (!cached) computeAusgabenTotals(selectedYear);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-blue-200"></div>
            <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-blue-600 absolute top-0"></div>
          </div>
          <p className="text-gray-700 font-bold text-lg">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
  const chartData = monthly.map((m, i) => ({
    name: monthNames[i],
    bookings: m.bookings,
    pax: m.pax
  }));

  const fmtUSD = (n) => '$' + (n || 0).toLocaleString('en-US');
  const fmtUZS = (n) => (n || 0).toLocaleString('ru-RU');
  const inv = financial?.invoice || {};
  const shx = financial?.shamixon || {};
  const paidPct = inv.total > 0 ? Math.round((inv.paid / inv.total) * 100) : 0;
  const aus = ausgaben || {};
  const uzsToUSD = Math.round((aus.totalUZS || 0) / exchangeRate);
  const ausgabenTotal = (aus.totalUSD || 0) + uzsToUSD;
  const gewinn = (inv.total || 0) - ausgabenTotal;
  // Bank (Final) in USD
  const bankUSD = aus.bankUZS > 0 ? Math.round(aus.bankUZS / exchangeRate) : 0;
  const totalInBar = ausgabenTotal - bankUSD;
  // Gewinn in bar: biggest firma total (INFUTURESTORM) - Total in bar
  const infutureTotal = Object.values(inv.byFirma || {}).reduce((max, d) => d.total > max ? d.total : max, 0);
  const gewinnInBar = infutureTotal - totalInBar;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 space-y-4 md:space-y-6">
      {/* Page header */}
      <div className="relative overflow-hidden bg-white rounded-2xl md:rounded-3xl shadow-2xl border-2 border-blue-100 p-4 md:p-8">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-purple-500/10"></div>
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-blue-400/20 to-indigo-400/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-gradient-to-br from-purple-400/20 to-blue-400/20 rounded-full blur-3xl"></div>

        <div className="relative flex items-center gap-3 md:gap-6">
          <div className="w-14 h-14 md:w-20 md:h-20 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 rounded-2xl md:rounded-3xl shadow-lg flex items-center justify-center transform hover:scale-110 transition-all duration-300">
            <TrendingUp className="w-7 h-7 md:w-10 md:h-10 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-4xl font-black bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent mb-1 md:mb-2">
              Dashboard <span className="text-2xl md:text-3xl">{selectedYear}</span>
            </h1>
            <p className="text-sm md:text-base text-gray-600 font-semibold">Activity Overview & Statistics</p>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="space-y-4">
        {/* Row 1: totals */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <StatCard
            icon={CalendarDays}
            label="Всего бронирований"
            value={stats?.overview.totalBookings || 0}
            color="blue"
          />
          <StatCard
            icon={Users}
            label="Всего туристов"
            value={totalPax}
            color="green"
          />
        </div>
        {/* Row 2: by status */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard
            icon={BadgeCheck}
            label="Final Confirmed"
            value={stats?.overview.finalConfirmed || 0}
            color="green"
          />
          <StatCard
            icon={CheckCircle}
            label="Confirmed"
            value={stats?.overview.confirmed || 0}
            color="green"
          />
          <StatCard
            icon={Activity}
            label="In Progress"
            value={stats?.overview.inProgress || 0}
            color="purple"
          />
          <StatCard
            icon={Clock}
            label="Pending"
            value={stats?.overview.pending || 0}
            color="amber"
          />
          <StatCard
            icon={XCircle}
            label="Cancelled"
            value={stats?.overview.cancelled || 0}
            color="red"
          />
          <StatCard
            icon={BadgeCheck}
            label="Completed"
            value={stats?.overview.completed || 0}
            color="blue"
          />
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly chart */}
        <div className="lg:col-span-2 bg-white rounded-3xl shadow-2xl border-2 border-gray-100 p-8 hover:shadow-blue-500/20 transition-all duration-300">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-black text-gray-900">
              Бронирования по месяцам ({selectedYear})
            </h2>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="bookings" name="Бронирования" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pax" name="Туристы" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Financial summary card */}
        <div className="bg-white rounded-3xl shadow-2xl border-2 border-gray-100 p-6 hover:shadow-emerald-500/20 transition-all duration-300 flex flex-col gap-5">

          {/* ── Invoice section ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <span className="font-black text-gray-800 text-sm uppercase tracking-wide">Invoice</span>
              </div>
              <Link to="/rechnung" className="text-xs text-blue-500 hover:underline font-semibold">Ko'rish →</Link>
            </div>

            {/* Jami */}
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-xs text-gray-500">Jami</span>
              <span className="font-black text-gray-900 text-base">{fmtUSD(inv.total)}</span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 bg-gray-100 rounded-full mb-2 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-700"
                style={{ width: `${paidPct}%` }} />
            </div>

            {/* To'landi / Qoldi */}
            <div className="flex justify-between text-xs mb-2">
              <span className="text-emerald-600 font-semibold">✓ To'landi {fmtUSD(inv.paid)} ({paidPct}%)</span>
              <span className="text-red-500 font-semibold">⚠ {fmtUSD(inv.unpaid)}</span>
            </div>

            {/* By firma */}
            {Object.entries(inv.byFirma || {}).length > 0 && (
              <div className="space-y-1 mt-2">
                {Object.entries(inv.byFirma).map(([firma, d]) => (
                  <div key={firma} className="flex justify-between items-center px-2.5 py-1.5 bg-blue-50 rounded-lg">
                    <span className="text-xs text-blue-700 font-medium truncate max-w-[130px]">{firma}</span>
                    <div className="text-right">
                      <span className="text-xs font-black text-blue-900">{fmtUSD(d.paid)}</span>
                      <span className="text-xs text-gray-400"> / {fmtUSD(d.total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Shamixon — same style as byFirma rows */}
            {(shx.payment || shx.incoming) > 0 && (
              <div className="mt-1">
                <div className={`flex justify-between items-center px-2.5 py-1.5 rounded-lg ${shx.remaining > 0 ? 'bg-purple-50' : 'bg-purple-50'}`}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-purple-700 font-medium">Shamixon</span>
                    {shx.remaining > 0 && (
                      <span className="text-[10px] text-orange-500 font-semibold">⚠ ${(shx.remaining).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} qoldi</span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black text-purple-900">${(shx.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span className="text-xs text-gray-400"> / ${(shx.payment || shx.incoming || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-gray-100" />

          {/* ── Ausgaben section ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg flex items-center justify-center shadow">
                  <BarChart2 className="w-4 h-4 text-white" />
                </div>
                <span className="font-black text-gray-800 text-sm uppercase tracking-wide">Ausgaben</span>
              </div>
              <Link to="/ausgaben" className="text-xs text-emerald-600 hover:underline font-semibold">Ko'rish →</Link>
            </div>

            {ausgabenLoading && !ausgaben ? (
              <div className="flex items-center justify-center py-6 text-gray-400 text-xs gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Hisoblanmoqda...
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex justify-between items-center px-2.5 py-1.5 bg-blue-50 rounded-lg">
                  <span className="text-xs text-gray-600">USD xarajatlar</span>
                  <span className="font-black text-blue-700 text-sm">{fmtUSD(aus.totalUSD)}</span>
                </div>
                <div className="flex justify-between items-center px-2.5 py-1.5 bg-amber-50 rounded-lg">
                  <div>
                    <span className="text-xs text-gray-600 block">UZS xarajatlar</span>
                    <span className="text-[10px] text-gray-400">≈ {fmtUSD(uzsToUSD)} ({(exchangeRate).toLocaleString()} UZS/$)</span>
                  </div>
                  <span className="font-black text-amber-700 text-sm">{fmtUZS(aus.totalUZS)}</span>
                </div>
                <div className="flex justify-between items-center px-2.5 py-2 bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg mt-1">
                  <span className="text-xs text-gray-300 font-semibold">Jami ≈</span>
                  <span className="font-black text-white text-base">{fmtUSD(ausgabenTotal)}</span>
                </div>
                {aus.bankUZS > 0 && (
                  <>
                    <div className="flex justify-between items-center px-2.5 py-1.5 bg-emerald-50 rounded-lg border border-emerald-200 mt-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-emerald-700 font-semibold">Bank (Final)</span>
                        <span className="text-[10px] text-gray-400">{fmtUZS(aus.bankUZS)} UZS</span>
                      </div>
                      <span className="text-xs font-black text-emerald-700">≈ {fmtUSD(bankUSD)}</span>
                    </div>
                    <div className="flex justify-between items-center px-2.5 py-2 bg-gradient-to-r from-teal-700 to-teal-800 rounded-lg mt-1">
                      <div>
                        <span className="text-xs text-teal-200 font-semibold">Total in bar</span>
                        <p className="text-[10px] text-teal-300">{fmtUSD(ausgabenTotal)} − {fmtUSD(bankUSD)}</p>
                      </div>
                      <span className="font-black text-white text-base">{fmtUSD(totalInBar)}</span>
                    </div>
                  </>
                )}
              </div>
            )}
            <p className="text-[10px] text-gray-400 mt-1 text-right flex items-center justify-end gap-1">
              <RefreshCw className="w-2.5 h-2.5" />
              CBU kurs: {(exchangeRate).toLocaleString()} UZS/$
            </p>

            {/* Gewinn */}
            {inv.total > 0 && ausgabenTotal > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl ${gewinn >= 0 ? 'bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200' : 'bg-gradient-to-r from-red-50 to-rose-50 border border-red-200'}`}>
                  <div>
                    <span className={`text-xs font-black uppercase tracking-wider ${gewinn >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>Gewinn</span>
                    <p className="text-[10px] text-gray-400 mt-0.5">{fmtUSD(inv.total)} − {fmtUSD(ausgabenTotal)}</p>
                  </div>
                  <span className={`font-black text-lg ${gewinn >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {gewinn >= 0 ? '+' : ''}{fmtUSD(gewinn)}
                  </span>
                </div>
              </div>
            )}

            {/* Gewinn in bar */}
            {infutureTotal > 0 && ausgabenTotal > 0 && (
              <div className="mt-2">
                <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl ${gewinnInBar >= 0 ? 'bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200' : 'bg-gradient-to-r from-red-50 to-rose-50 border border-red-200'}`}>
                  <div>
                    <span className={`text-xs font-black uppercase tracking-wider ${gewinnInBar >= 0 ? 'text-teal-700' : 'text-red-700'}`}>Gewinn in bar</span>
                    <p className="text-[10px] text-gray-400 mt-0.5">{fmtUSD(infutureTotal)} − {fmtUSD(totalInBar)}</p>
                  </div>
                  <span className={`font-black text-lg ${gewinnInBar >= 0 ? 'text-teal-700' : 'text-red-600'}`}>
                    {gewinnInBar >= 0 ? '+' : ''}{fmtUSD(gewinnInBar)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upcoming bookings */}
      <div className="bg-white rounded-3xl shadow-2xl border-2 border-gray-100 overflow-hidden">
        <div className="p-4 md:p-8 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-b-2 border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg md:rounded-xl flex items-center justify-center shadow-lg">
              <CalendarDays className="w-4 h-4 md:w-5 md:h-5 text-white" />
            </div>
            <h2 className="text-lg md:text-xl font-black text-gray-900">Ближайшие бронирования</h2>
          </div>
          <Link
            to="/bookings"
            className="inline-flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl md:rounded-2xl shadow-lg hover:shadow-xl hover:from-blue-600 hover:to-indigo-700 hover:-translate-y-1 transition-all duration-300 font-bold text-xs md:text-sm w-full sm:w-auto justify-center sm:justify-start"
          >
            Все бронирования
            <ArrowRight className="w-4 h-4 md:w-5 md:h-5" />
          </Link>
        </div>

        {upcoming.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {upcoming.map((booking) => {
              const status = calculateStatus(booking.pax, booking.departureDate, booking.endDate);

              return (
              <Link
                key={booking.id}
                to={`/bookings/${booking.id}`}
                className={`p-4 md:p-6 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-300 group ${
                  isMobile ? 'flex flex-col gap-3' : 'flex items-center justify-between'
                }`}
              >
                <div className="flex items-center gap-3 md:gap-5">
                  <div
                    className="w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center text-white font-black text-sm md:text-base shadow-lg group-hover:scale-110 transition-all duration-300 flex-shrink-0"
                    style={{ backgroundColor: booking.tourType?.color || '#6B7280' }}
                  >
                    {booking.tourType?.code}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-900 text-base md:text-lg group-hover:text-blue-600 transition-colors">{booking.bookingNumber}</p>
                    <p className="text-xs md:text-sm text-gray-600 font-medium mt-0.5 md:mt-1">
                      {booking.guide?.name || 'Гид не назначен'}
                    </p>
                  </div>
                </div>

                <div className={`flex items-center gap-2 md:gap-5 text-xs md:text-sm ${isMobile ? 'flex-wrap' : ''}`}>
                  <div className="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1.5 md:py-2 bg-white rounded-lg md:rounded-xl shadow-md">
                    <Clock className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />
                    <span className="font-semibold text-gray-700 whitespace-nowrap">
                      {format(new Date(booking.departureDate), 'd MMM yyyy', { locale: ru })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1.5 md:py-2 bg-white rounded-lg md:rounded-xl shadow-md">
                    <Users className="w-4 h-4 md:w-5 md:h-5 text-green-500" />
                    <span className="font-semibold text-gray-700">{booking.pax} чел.</span>
                  </div>
                  <span className={`inline-flex items-center px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl text-xs md:text-sm font-bold shadow-md ${statusClasses[status]}`}>
                    {statusLabels[status]}
                  </span>
                </div>
              </Link>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-indigo-200 rounded-full flex items-center justify-center shadow-lg mb-4">
              <CalendarDays className="w-12 h-12 text-blue-500" />
            </div>
            <p className="text-xl font-bold text-gray-700 mb-2">Нет предстоящих бронирований</p>
            <p className="text-gray-500">Создайте новое бронирование для начала работы</p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  const colorClasses = {
    blue: {
      gradient: 'from-blue-500 to-indigo-600',
      shadow: 'shadow-blue-500/30',
      bg: 'bg-gradient-to-br from-blue-100 to-indigo-100',
      ring: 'ring-blue-200'
    },
    green: {
      gradient: 'from-green-500 to-emerald-600',
      shadow: 'shadow-green-500/30',
      bg: 'bg-gradient-to-br from-green-100 to-emerald-100',
      ring: 'ring-green-200'
    },
    purple: {
      gradient: 'from-purple-500 to-violet-600',
      shadow: 'shadow-purple-500/30',
      bg: 'bg-gradient-to-br from-purple-100 to-violet-100',
      ring: 'ring-purple-200'
    },
    amber: {
      gradient: 'from-amber-500 to-orange-600',
      shadow: 'shadow-amber-500/30',
      bg: 'bg-gradient-to-br from-amber-100 to-orange-100',
      ring: 'ring-amber-200'
    },
    red: {
      gradient: 'from-red-500 to-rose-600',
      shadow: 'shadow-red-500/30',
      bg: 'bg-gradient-to-br from-red-100 to-rose-100',
      ring: 'ring-red-200'
    }
  };

  const colors = colorClasses[color];

  return (
    <div className="relative group bg-white rounded-2xl md:rounded-3xl shadow-xl border-2 border-gray-100 p-4 md:p-6 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 overflow-hidden">
      <div className={`absolute inset-0 ${colors.bg} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>

      <div className="relative flex items-center gap-3 md:gap-5">
        <div className={`w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl flex items-center justify-center bg-gradient-to-br ${colors.gradient} shadow-lg ${colors.shadow} transform group-hover:scale-110 transition-all duration-300`}>
          <Icon className="w-6 h-6 md:w-8 md:h-8 text-white" />
        </div>
        <div>
          <p className="text-2xl md:text-3xl font-black text-gray-900 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:bg-clip-text group-hover:from-gray-900 group-hover:to-gray-700 transition-all duration-300">{value}</p>
          <p className="text-sm font-semibold text-gray-600 mt-1">{label}</p>
        </div>
      </div>
    </div>
  );
}
