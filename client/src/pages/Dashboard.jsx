import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { dashboardApi, bookingsApi, touristsApi, routesApi, railwaysApi, flightsApi, tourServicesApi, transportApi, opexApi, jahresplanungApi, hotelsApi } from '../services/api';
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
  const [rateLoading, setRateLoading] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => { loadData(); }, [selectedYear]);

  const fetchCbuRate = async () => {
    setRateLoading(true);
    try {
      const r = await dashboardApi.getCbuRate();
      if (r.data?.rate > 0) setExchangeRate(r.data.rate);
    } catch {} finally {
      setRateLoading(false);
    }
  };

  const [ausgabenLoading, setAusgabenLoading] = useState(false);
  const [hotelStatusData, setHotelStatusData] = useState({});
  const [hotelStatusLoading, setHotelStatusLoading] = useState(false);

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

  const loadHotelStatus = async (year) => {
    setHotelStatusLoading(true);
    try {
      const tourTypes = ['ER', 'CO', 'KAS', 'ZA'];
      // Pre-load all hotels once (for extra hotel name lookup)
      let allHotelsMap = {};
      try {
        const hr = await hotelsApi.getAll();
        const list = hr.data.hotels || hr.data || [];
        for (const h of list) allHotelsMap[String(h.id)] = h;
      } catch {}

      const result = {};
      await Promise.all(tourTypes.map(async (tt) => {
        try {
          const [res, stateRes] = await Promise.all([
            jahresplanungApi.getHotels(year, tt),
            jahresplanungApi.getState(year, tt).catch(() => ({ data: null })),
          ]);
          const hotels = res.data.hotels || [];
          const state = stateRes.data || {};
          // Use DB state (cross-device), fall back to localStorage as offline cache
          const fromLS = (key) => { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; } catch { return null; } };
          const rowStatuses = state.statuses || fromLS(`jp_statuses_${year}_${tt}`) || {};
          const rawEx = state.excludedHotels || fromLS(`jp_excluded_${year}_${tt}`);
          const excludedHotelIds = new Set(Array.isArray(rawEx) ? rawEx.map(String) : Object.keys(rawEx || {}));
          const cityExtras = state.cityExtras || fromLS(`jp_cityExtras_${year}_${tt}`) || {}; // { cityName: [hotelId, ...] }

          // Pre-build statusedPairs set: "hotelId_bookingId" — checkInDate-independent matching
          // Avoids false negatives when virtual checkInDate shifts (departure date changed)
          const statusedPairs = new Set();
          for (const key of Object.keys(rowStatuses)) {
            const uIdx = key.indexOf('_');
            if (uIdx === -1) continue;
            const u2Idx = key.indexOf('_', uIdx + 1);
            if (u2Idx === -1) continue;
            statusedPairs.add(key.slice(0, u2Idx)); // "hotelId_bookingId"
          }

          // Collect ALL year bookings from ALL hotels first (before hotelMeta filter)
          // Ensures unassigned/WL bookings in virtual-only hotels are not missed
          const allYearBookings = {}; // bookingId → { bookingNumber, bookingStatus }
          for (const entry of hotels) {
            for (const b of (entry.bookings || [])) {
              if (!allYearBookings[b.bookingId]) {
                allYearBookings[b.bookingId] = { bookingNumber: b.bookingNumber, bookingStatus: b.status };
              }
            }
          }

          // Step 1: build hotelMeta from API (valid hotels only)
          const hotelMeta = {}; // hotelId → { name, city }
          for (const entry of hotels) {
            const hotelId = String(entry.hotel?.id);
            if (excludedHotelIds.has(hotelId)) continue;
            const bookings = entry.bookings || [];
            const hasReal = bookings.some(b => !b.isVirtual);
            // Use statusedPairs for robust match (ignores checkInDate format/value changes)
            const hasSt = bookings.some(b => statusedPairs.has(`${hotelId}_${b.bookingId}`));
            if (!hasReal && !hasSt) continue;
            hotelMeta[hotelId] = { name: entry.hotel?.name || 'Hotel', city: entry.hotel?.city?.name || 'Noma\'lum' };
          }

          // Add extra hotels from jp_cityExtras (manually added — may not be in API response)
          for (const [cityName, extraIds] of Object.entries(cityExtras)) {
            for (const extraId of (Array.isArray(extraIds) ? extraIds : [])) {
              const hid = String(extraId);
              if (excludedHotelIds.has(hid) || hotelMeta[hid]) continue;
              const hasSt = Object.keys(rowStatuses).some(k => k.startsWith(`${hid}_`));
              if (!hasSt) continue;
              const hotelInfo = allHotelsMap[hid];
              hotelMeta[hid] = { name: hotelInfo?.name || `Hotel ${hid}`, city: cityName };
            }
          }

          // Also recover hotels from rowStatuses not in API or cityExtras (e.g. hotel removed from template)
          for (const key of Object.keys(rowStatuses)) {
            const uIdx = key.indexOf('_');
            if (uIdx === -1) continue;
            const hid = key.slice(0, uIdx);
            if (hotelMeta[hid] || excludedHotelIds.has(hid)) continue;
            const hotelInfo = allHotelsMap[hid];
            if (hotelInfo?.city?.name) {
              hotelMeta[hid] = { name: hotelInfo.name, city: hotelInfo.city.name };
            }
          }

          // Step 2: Build visitIndex map per city-booking
          // For each booking in each city, sorted checkInDates = zaezd order
          const cityBookingVisits = {}; // city → { bookingId → sortedDates[] }
          for (const entry of hotels) {
            const hotelId = String(entry.hotel?.id);
            if (excludedHotelIds.has(hotelId)) continue;
            const city = entry.hotel?.city?.name || 'Noma\'lum';
            if (!cityBookingVisits[city]) cityBookingVisits[city] = {};
            for (const b of (entry.bookings || [])) {
              const bid = String(b.bookingId);
              const d = String(b.checkInDate);
              if (!cityBookingVisits[city][bid]) cityBookingVisits[city][bid] = new Set();
              cityBookingVisits[city][bid].add(d);
            }
          }
          for (const city of Object.keys(cityBookingVisits)) {
            for (const bid of Object.keys(cityBookingVisits[city])) {
              cityBookingVisits[city][bid] = [...cityBookingVisits[city][bid]].sort();
            }
          }

          // Step 3: Build per-zaezd status map
          // byCZB[city][zaezdIdx][bookingId] = best status ('confirmed'|'waiting'|'cancelled')
          // A booking with 2 stays in same city: zaezd 0 = first stay, zaezd 1 = second stay, etc.
          // Across all hotels in city: pick BEST status (confirmed > waiting > cancelled)
          const STATUS_RANK = { confirmed: 3, waiting: 2, cancelled: 1 };
          const byCZB = {}; // city → zaezdIdx → bookingId → bestStatus
          const byCZBHotel = {}; // city → zaezdIdx → bookingId → hotelName (of confirming hotel)
          const globalAssignedIds = new Set();

          for (const [key, st] of Object.entries(rowStatuses)) {
            const u1 = key.indexOf('_'); if (u1 === -1) continue;
            const u2 = key.indexOf('_', u1 + 1); if (u2 === -1) continue;
            const hid = key.slice(0, u1);
            const bid = key.slice(u1 + 1, u2);
            const dateStr = key.slice(u2 + 1);
            globalAssignedIds.add(bid);
            if (!hotelMeta[hid]) continue;
            const city = hotelMeta[hid].city;
            const visits = cityBookingVisits[city]?.[bid] || [];
            const zaezdIdx = Math.max(visits.indexOf(dateStr), 0);
            if (!byCZB[city]) byCZB[city] = {};
            if (!byCZB[city][zaezdIdx]) byCZB[city][zaezdIdx] = {};
            const existing = byCZB[city][zaezdIdx][bid];
            if (!existing || (STATUS_RANK[st] || 0) > (STATUS_RANK[existing] || 0)) {
              byCZB[city][zaezdIdx][bid] = st;
              // Track which hotel confirmed/WL'd this booking
              if (!byCZBHotel[city]) byCZBHotel[city] = {};
              if (!byCZBHotel[city][zaezdIdx]) byCZBHotel[city][zaezdIdx] = {};
              byCZBHotel[city][zaezdIdx][bid] = hotelMeta[hid].name;
            }
          }

          // Step 4: Group hotels by city
          const cityHotelSets = {};
          for (const [hotelId, meta] of Object.entries(hotelMeta)) {
            if (!cityHotelSets[meta.city]) cityHotelSets[meta.city] = new Set();
            cityHotelSets[meta.city].add(hotelId);
          }

          // Step 5: Build byCity — per-booking data (unique counts, not zaezd sums)
          const WORST_RANK = { confirmed: 0, waiting: 1, cancelled: 2, unassigned: 3 };
          const byCity = {};
          for (const [city, hotelSet] of Object.entries(cityHotelSets)) {
            // Collect all unique non-CANCELLED bookings for this city
            const cityBookings = new Map(); // bookingId → bookingNumber
            for (const entry of hotels) {
              const hotelId = String(entry.hotel?.id);
              if (!hotelSet.has(hotelId)) continue;
              for (const b of (entry.bookings || [])) {
                const bdata = allYearBookings[b.bookingId];
                if (!bdata || bdata.bookingStatus === 'CANCELLED') continue;
                if (!cityBookings.has(String(b.bookingId))) cityBookings.set(String(b.bookingId), bdata.bookingNumber);
              }
            }
            // Also from byCZB (extra hotels with statuses)
            for (const zaezdStatuses of Object.values(byCZB[city] || {})) {
              for (const bid of Object.keys(zaezdStatuses)) {
                const bdata = allYearBookings[bid];
                if (!bdata || bdata.bookingStatus === 'CANCELLED') continue;
                if (!cityBookings.has(bid)) cityBookings.set(bid, bdata.bookingNumber);
              }
            }

            const maxZaezdCount = Math.max(
              1,
              ...Object.values(cityBookingVisits[city] || {}).map(d => d.length)
            );

            // Per-booking: collect zaezd statuses + hotel names, compute worst status
            let confirmed = 0, waiting = 0, cancelled = 0, unassigned = 0;
            const bookingList = [];
            for (const [bookingId, bookingNumber] of cityBookings) {
              const zaezdList = [];
              let worstRank = -1;
              let worstStatus = 'confirmed';
              for (let zi = 0; zi < maxZaezdCount; zi++) {
                const st = byCZB[city]?.[zi]?.[bookingId] || 'unassigned';
                const hotelName = byCZBHotel[city]?.[zi]?.[bookingId] || '';
                zaezdList.push({ status: st, hotelName });
                const rank = WORST_RANK[st] ?? 3;
                if (rank > worstRank) { worstRank = rank; worstStatus = st; }
              }
              if (worstStatus === 'confirmed') confirmed++;
              else if (worstStatus === 'waiting') waiting++;
              else if (worstStatus === 'cancelled') cancelled++;
              else unassigned++;
              bookingList.push({ bookingNumber, worstStatus, zaezds: zaezdList });
            }
            bookingList.sort((a, b) => a.bookingNumber.localeCompare(b.bookingNumber));
            byCity[city] = { confirmed, waiting, cancelled, unassigned, bookings: bookingList };
          }

          // Handle bookings not in any hotelMeta city (virtual-only, no status set)
          for (const [bookingId, bdata] of Object.entries(allYearBookings)) {
            if (bdata.bookingStatus === 'CANCELLED') continue;
            if (globalAssignedIds.has(String(bookingId))) continue;
            const alreadyCounted = Object.values(byCity).some(c =>
              c.bookings.some(b => b.bookingNumber === bdata.bookingNumber)
            );
            if (alreadyCounted) continue;
            for (const entry of hotels) {
              const hotelId = String(entry.hotel?.id);
              if (excludedHotelIds.has(hotelId)) continue;
              const city = entry.hotel?.city?.name || 'Noma\'lum';
              const found = (entry.bookings || []).some(b => String(b.bookingId) === String(bookingId));
              if (found) {
                const newBooking = { bookingNumber: bdata.bookingNumber, worstStatus: 'unassigned', zaezds: [{ status: 'unassigned', hotelName: '' }] };
                if (!byCity[city]) byCity[city] = { confirmed: 0, waiting: 0, cancelled: 0, unassigned: 1, bookings: [newBooking] };
                else { byCity[city].unassigned++; byCity[city].bookings.push(newBooking); }
                break;
              }
            }
          }
          result[tt] = byCity;
        } catch {
          result[tt] = {};
        }
      }));
      setHotelStatusData(result);
    } catch {}
    setHotelStatusLoading(false);
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
    // Fetch CBU exchange rate via backend proxy (avoids CORS)
    fetchCbuRate();
    // If no cache found, compute Ausgaben totals in background
    if (!cached) computeAusgabenTotals(selectedYear);
    // Load hotel status from Jahresplanung data
    loadHotelStatus(selectedYear);
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
      <div className="relative overflow-hidden bg-white rounded-xl md:rounded-2xl shadow-lg border border-blue-100 p-3 md:p-5">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-purple-500/10"></div>
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 rounded-xl shadow-md flex items-center justify-center">
            <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Dashboard <span>{selectedYear}</span>
            </h1>
            <p className="text-xs text-gray-500 font-semibold">Activity Overview & Statistics</p>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="space-y-3">
        {/* Row 1: totals */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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
        <div className="lg:col-span-2 bg-white rounded-3xl shadow-2xl border-2 border-gray-100 p-3 md:p-8 hover:shadow-blue-500/20 transition-all duration-300">
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
          {/* Hotel status grid — inside chart card, below the chart */}
          <div className="mt-6 pt-5 border-t border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <Hotel className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-black text-gray-700">Hotel holati — Jahresplanung</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {['ER', 'CO', 'KAS', 'ZA'].map(tt => (
                <HotelStatusCard key={tt} tourType={tt} byCity={hotelStatusData[tt] || {}} loading={hotelStatusLoading} />
              ))}
            </div>
          </div>
        </div>

        {/* Financial summary card */}
        <div className="bg-white rounded-3xl shadow-2xl border-2 border-gray-100 p-6 hover:shadow-emerald-500/20 transition-all duration-300 flex flex-col gap-5">

          {/* ── Invoice section ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <span className="font-black text-gray-800 text-base uppercase tracking-wide">Invoice</span>
              </div>
              <Link to="/rechnung" className="text-sm text-blue-500 hover:underline font-semibold">Ko'rish →</Link>
            </div>

            {/* Jami */}
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-sm text-gray-500">Jami</span>
              <span className="font-black text-gray-900 text-xl">{fmtUSD(inv.total)}</span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2.5 bg-gray-100 rounded-full mb-2 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-700"
                style={{ width: `${paidPct}%` }} />
            </div>

            {/* To'landi / Qoldi */}
            <div className="flex justify-between text-sm mb-2">
              <span className="text-emerald-600 font-semibold">✓ To'landi {fmtUSD(inv.paid)} ({paidPct}%)</span>
              <span className="text-red-500 font-semibold">⚠ {fmtUSD(inv.unpaid)}</span>
            </div>

            {/* By firma */}
            {Object.entries(inv.byFirma || {}).length > 0 && (
              <div className="space-y-1.5 mt-2">
                {Object.entries(inv.byFirma).map(([firma, d]) => (
                  <div key={firma} className="flex justify-between items-center px-3 py-2 bg-blue-50 rounded-lg">
                    <span className="text-sm text-blue-700 font-medium truncate max-w-[150px]">{firma}</span>
                    <div className="text-right">
                      <span className="text-sm font-black text-blue-900">{fmtUSD(d.paid)}</span>
                      <span className="text-sm text-gray-400"> / {fmtUSD(d.total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Shamixon — same style as byFirma rows */}
            {(shx.payment || shx.incoming) > 0 && (
              <div className="mt-1.5">
                <div className="flex justify-between items-center px-3 py-2 bg-purple-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-purple-700 font-medium">Shamixon</span>
                    {shx.remaining > 0 && (
                      <span className="text-xs text-orange-500 font-semibold">⚠ ${(shx.remaining).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} qoldi</span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-purple-900">${(shx.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span className="text-sm text-gray-400"> / ${(shx.payment || shx.incoming || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center shadow">
                  <BarChart2 className="w-5 h-5 text-white" />
                </div>
                <span className="font-black text-gray-800 text-base uppercase tracking-wide">Ausgaben</span>
              </div>
              <Link to="/ausgaben" className="text-sm text-emerald-600 hover:underline font-semibold">Ko'rish →</Link>
            </div>

            {ausgabenLoading && !ausgaben ? (
              <div className="flex items-center justify-center py-6 text-gray-400 text-sm gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Hisoblanmoqda...
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex justify-between items-center px-3 py-2 bg-blue-50 rounded-lg">
                  <span className="text-sm text-gray-600">USD xarajatlar</span>
                  <span className="font-black text-blue-700 text-base">{fmtUSD(aus.totalUSD)}</span>
                </div>
                <div className="flex justify-between items-center px-3 py-2 bg-amber-50 rounded-lg">
                  <div>
                    <span className="text-sm text-gray-600 block">UZS xarajatlar</span>
                    <span className="text-xs text-gray-400">≈ {fmtUSD(uzsToUSD)} ({(exchangeRate).toLocaleString()} UZS/$)</span>
                  </div>
                  <span className="font-black text-amber-700 text-base">{fmtUZS(aus.totalUZS)}</span>
                </div>
                <div className="flex justify-between items-center px-3 py-2.5 bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg mt-1">
                  <span className="text-sm text-gray-300 font-semibold">Jami ≈</span>
                  <span className="font-black text-white text-lg">{fmtUSD(ausgabenTotal)}</span>
                </div>
                {aus.bankUZS > 0 && (
                  <>
                    <div className="flex justify-between items-center px-3 py-2 bg-emerald-50 rounded-lg border border-emerald-200 mt-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-emerald-700 font-semibold">Bank (Final)</span>
                        <span className="text-xs text-gray-400">{fmtUZS(aus.bankUZS)} UZS</span>
                      </div>
                      <span className="text-sm font-black text-emerald-700">≈ {fmtUSD(bankUSD)}</span>
                    </div>
                    <div className="flex justify-between items-center px-3 py-2.5 bg-gradient-to-r from-teal-700 to-teal-800 rounded-lg mt-1">
                      <div>
                        <span className="text-sm text-teal-200 font-semibold">Total in bar</span>
                        <p className="text-xs text-teal-300">{fmtUSD(ausgabenTotal)} − {fmtUSD(bankUSD)}</p>
                      </div>
                      <span className="font-black text-white text-lg">{fmtUSD(totalInBar)}</span>
                    </div>
                  </>
                )}
              </div>
            )}
            <button onClick={fetchCbuRate} className="text-xs text-gray-400 mt-1.5 w-full text-right flex items-center justify-end gap-1 hover:text-blue-500 transition-colors">
              <RefreshCw className={`w-3 h-3 ${rateLoading ? 'animate-spin' : ''}`} />
              CBU kurs: {(exchangeRate).toLocaleString()} UZS/$
            </button>

            {/* Gewinn */}
            {inv.total > 0 && ausgabenTotal > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className={`flex items-center justify-between px-3 py-3 rounded-xl ${gewinn >= 0 ? 'bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200' : 'bg-gradient-to-r from-red-50 to-rose-50 border border-red-200'}`}>
                  <div>
                    <span className={`text-sm font-black uppercase tracking-wider ${gewinn >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>Gewinn</span>
                    <p className="text-xs text-gray-400 mt-0.5">{fmtUSD(inv.total)} − {fmtUSD(ausgabenTotal)}</p>
                  </div>
                  <span className={`font-black text-xl ${gewinn >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {gewinn >= 0 ? '+' : ''}{fmtUSD(gewinn)}
                  </span>
                </div>
              </div>
            )}

            {/* Gewinn in bar */}
            {infutureTotal > 0 && ausgabenTotal > 0 && (
              <div className="mt-2">
                <div className={`flex items-center justify-between px-3 py-3 rounded-xl ${gewinnInBar >= 0 ? 'bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200' : 'bg-gradient-to-r from-red-50 to-rose-50 border border-red-200'}`}>
                  <div>
                    <span className={`text-sm font-black uppercase tracking-wider ${gewinnInBar >= 0 ? 'text-teal-700' : 'text-red-700'}`}>Gewinn in bar</span>
                    <p className="text-xs text-gray-400 mt-0.5">{fmtUSD(infutureTotal)} − {fmtUSD(totalInBar)}</p>
                  </div>
                  <span className={`font-black text-xl ${gewinnInBar >= 0 ? 'text-teal-700' : 'text-red-600'}`}>
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

const TOUR_TYPE_META = {
  ER:  { bg: 'from-blue-500 to-indigo-600', dot: 'bg-blue-500', label: 'ER', cityOrder: ['tashkent','samarkand','asraf','bukhara','khiva'] },
  CO:  { bg: 'from-emerald-500 to-green-600', dot: 'bg-emerald-500', label: 'CO', cityOrder: ['tashkent','fergana','samarkand','bukhara','khiva'] },
  KAS: { bg: 'from-purple-500 to-violet-600', dot: 'bg-purple-500', label: 'KAS', cityOrder: ['fergana','bukhara','samarkand','tashkent'] },
  ZA:  { bg: 'from-orange-500 to-amber-600', dot: 'bg-orange-500', label: 'ZA', cityOrder: ['bukhara','samarkand','tashkent'] },
};

function sortCities(byCity, cityOrder) {
  const keys = Object.keys(byCity);
  return keys.sort((a, b) => {
    const ai = cityOrder.findIndex(c => a.toLowerCase().includes(c));
    const bi = cityOrder.findIndex(c => b.toLowerCase().includes(c));
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

const ST_ICON = { confirmed: '✅', waiting: '🟡', cancelled: '✕', unassigned: '⬜' };
const ST_TAG = {
  confirmed: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  waiting:   'bg-amber-50 text-amber-700 border border-amber-200',
  cancelled: 'bg-red-50 text-red-600 border border-red-200',
  unassigned:'bg-gray-100 text-gray-500 border border-gray-200',
};

function HotelStatusCard({ tourType, byCity, loading }) {
  const meta = TOUR_TYPE_META[tourType];
  const sortedCities = sortCities(byCity, meta.cityOrder);
  const [openCity, setOpenCity] = useState(null);
  const [openBooking, setOpenBooking] = useState(null); // "city::bookingNumber"

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Header */}
      <div className={`bg-gradient-to-r ${meta.bg} px-3 py-2.5 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <Hotel className="w-4 h-4 text-white/80" />
          <span className="font-black text-white text-base">{meta.label} Gruppe</span>
        </div>
        {loading && <RefreshCw className="w-3.5 h-3.5 text-white/60 animate-spin" />}
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-6 text-xs font-bold text-gray-400 uppercase px-3 pt-2 pb-1.5 border-b border-gray-100">
        <span className="col-span-2">Shahar</span>
        <span className="text-center text-emerald-600">✅</span>
        <span className="text-center text-amber-500">🟡</span>
        <span className="text-center text-red-500">✕</span>
        <span className="text-center text-gray-400">⬜</span>
      </div>

      {/* City rows */}
      <div className="divide-y divide-gray-50">
        {sortedCities.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-3">Ma'lumot yo'q</p>
        ) : sortedCities.map(city => {
          const c = byCity[city] || {};
          const hasIssue = c.waiting > 0 || c.unassigned > 0;
          const isOpen = openCity === city;
          const bookings = c.bookings || [];
          const isMultiZaezd = bookings.some(b => b.zaezds && b.zaezds.length > 1);

          return (
            <div key={city}>
              {/* City row */}
              <button
                onClick={() => { setOpenCity(isOpen ? null : city); setOpenBooking(null); }}
                className={`w-full grid grid-cols-6 items-center px-3 py-2 text-sm text-left transition-colors ${hasIssue ? 'bg-amber-50/60 hover:bg-amber-50' : 'hover:bg-gray-50'}`}
              >
                <span className="col-span-2 font-semibold text-gray-700 flex items-center gap-1.5 truncate">
                  <span className={`transition-transform text-gray-400 text-xs ${isOpen ? 'rotate-90' : ''}`}>▶</span>
                  {city}
                </span>
                <span className={`text-center font-bold ${c.confirmed > 0 ? 'text-emerald-600' : 'text-gray-200'}`}>{c.confirmed || '–'}</span>
                <span className={`text-center font-bold ${c.waiting > 0 ? 'text-amber-500' : 'text-gray-200'}`}>{c.waiting || '–'}</span>
                <span className={`text-center font-bold ${c.cancelled > 0 ? 'text-red-500' : 'text-gray-200'}`}>{c.cancelled || '–'}</span>
                <span className={`text-center font-bold ${c.unassigned > 0 ? 'text-gray-500' : 'text-gray-200'}`}>{c.unassigned || '–'}</span>
              </button>

              {/* Expanded: flat booking list */}
              {isOpen && bookings.length > 0 && (
                <div className="bg-gray-50 border-t border-gray-100 px-3 py-2 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {bookings.map((b, i) => {
                      const bKey = `${city}::${b.bookingNumber}`;
                      const isSelected = openBooking === bKey;
                      return (
                        <button
                          key={i}
                          onClick={() => isMultiZaezd ? setOpenBooking(isSelected ? null : bKey) : undefined}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${ST_TAG[b.worstStatus] || ST_TAG.unassigned} ${isMultiZaezd ? 'hover:opacity-75' : 'cursor-default'} ${isSelected ? 'ring-2 ring-current ring-offset-1' : ''}`}
                        >
                          <span>{b.bookingNumber}</span>
                          {isMultiZaezd ? (
                            <span className="flex items-center gap-0.5">
                              {b.zaezds.map((z, zi) => (
                                <span key={zi} className="text-[10px] opacity-80">{zi + 1}{ST_ICON[z.status] || '⬜'}</span>
                              ))}
                            </span>
                          ) : (
                            <span className="font-normal">
                              {ST_ICON[b.zaezds[0]?.status] || '⬜'}
                              {b.zaezds[0]?.hotelName ? ` ${b.zaezds[0].hotelName}` : ''}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Detail panel — shown when a multi-zaezd booking is clicked */}
                  {isMultiZaezd && openBooking && openBooking.startsWith(`${city}::`) && (() => {
                    const bNum = openBooking.slice(`${city}::`.length);
                    const b = bookings.find(b => b.bookingNumber === bNum);
                    if (!b) return null;
                    return (
                      <div className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                        <p className="text-xs font-black text-gray-700 mb-2">{b.bookingNumber} — zaezdlar:</p>
                        <div className="space-y-1.5">
                          {b.zaezds.map((z, zi) => (
                            <div key={zi} className="flex items-center gap-2 text-xs">
                              <span className="text-gray-400 font-semibold w-14 shrink-0">{zi + 1}-zaezd</span>
                              <span>{ST_ICON[z.status]}</span>
                              <span className={`font-semibold truncate ${z.status === 'confirmed' ? 'text-emerald-700' : z.status === 'waiting' ? 'text-amber-700' : z.status === 'cancelled' ? 'text-red-600' : 'text-gray-400'}`}>
                                {z.hotelName || (z.status === 'unassigned' ? 'Belgilanmagan' : z.status === 'waiting' ? 'WL / Kutilmoqda' : z.status === 'cancelled' ? 'Bekor' : '—')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })}
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
    <div className="relative group bg-white rounded-xl shadow-md border border-gray-100 p-3 md:p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 overflow-hidden">
      <div className={`absolute inset-0 ${colors.bg} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>

      <div className="relative flex items-center gap-3">
        <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${colors.gradient} shadow-md ${colors.shadow} transform group-hover:scale-105 transition-all duration-300`}>
          <Icon className="w-5 h-5 md:w-6 md:h-6 text-white" />
        </div>
        <div>
          <p className="text-xl md:text-2xl font-black text-gray-900">{value}</p>
          <p className="text-xs font-semibold text-gray-500 mt-0.5">{label}</p>
        </div>
      </div>
    </div>
  );
}
