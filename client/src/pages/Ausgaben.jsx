import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { bookingsApi, touristsApi, routesApi, railwaysApi, flightsApi, tourServicesApi, transportApi, opexApi, telegramApi, invoicesApi } from '../services/api';
import { useYear } from '../context/YearContext';
import toast from 'react-hot-toast';
import { Hotel, BarChart3, Users, Truck, FileSpreadsheet, FileText, Send, DollarSign, Train, Landmark } from 'lucide-react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const tourTypeModules = [
  { code: 'ALL', name: 'Barcha gruppalar', color: '#E5E7EB' },
  { code: 'ER', name: 'Erlebnisreisen', color: '#3B82F6' },
  { code: 'CO', name: 'Comfort', color: '#10B981' },
  { code: 'KAS', name: 'Karawanen Seidenstrasse', color: '#F59E0B' },
  { code: 'ZA', name: 'Zentralasien', color: '#8B5CF6' }
];

const expenseTabs = [
  { id: 'general',            name: 'General',            icon: BarChart3 },
  { id: 'hotels',             name: 'Hotels',             icon: Hotel },
  { id: 'hotel-analysis',     name: 'Hotel Analysis',     icon: Hotel },
  { id: 'transport',          name: 'Transport',          icon: Truck },
  { id: 'transport-analysis', name: 'Transport Analysis', icon: Truck },
  { id: 'guides',             name: 'Guides',             icon: Users },
  { id: 'uberweisung',        name: 'Überweisung',        icon: DollarSign },
  { id: 'bank',               name: 'Bank',               icon: Landmark },
  { id: 'railways',           name: 'Railways',           icon: Train },
];

export default function Ausgaben() {
  const { selectedYear } = useYear();
  const [searchParams, setSearchParams] = useSearchParams();

  // Get state from URL or use defaults
  const activeTourType = searchParams.get('tour') || 'ALL';
  const activeExpenseTab = searchParams.get('tab') || 'general';

  // Function to update URL params
  const updateParams = (updates) => {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      newParams.set(key, value);
    });
    setSearchParams(newParams);
  };
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookingsDetailedData, setBookingsDetailedData] = useState([]);
  const [selectedGuide, setSelectedGuide] = useState(null);
  const [openHotels, setOpenHotels] = useState(new Set());
  const [openMonths, setOpenMonths] = useState(new Set());
  const toggleHotel = (name) => setOpenHotels(prev => { const s = new Set(prev); s.has(name) ? s.delete(name) : s.add(name); return s; });
  const toggleMonth = (key) => setOpenMonths(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });
  const [paidAccs, setPaidAccs] = useState({});
  const [paidTransport, setPaidTransport] = useState({});

  // Load paid status from DB (with one-time localStorage migration)
  useEffect(() => {
    invoicesApi.getAusgabenPaid().then(res => {
      let hotel = res.data.hotel || {};
      let transport = res.data.transport || {};
      // One-time migration from localStorage
      if (Object.keys(hotel).length === 0) {
        try {
          const legacy = localStorage.getItem('ausgaben_hotel_paid_v1');
          if (legacy) { hotel = JSON.parse(legacy); invoicesApi.saveAusgabenHotelPaid(hotel); localStorage.removeItem('ausgaben_hotel_paid_v1'); }
        } catch {}
      }
      if (Object.keys(transport).length === 0) {
        try {
          const legacy = localStorage.getItem('ausgaben_transport_paid_v1');
          if (legacy) { transport = JSON.parse(legacy); invoicesApi.saveAusgabenTransportPaid(transport); localStorage.removeItem('ausgaben_transport_paid_v1'); }
        } catch {}
      }
      setPaidAccs(hotel);
      setPaidTransport(transport);
    }).catch(() => {});
  }, []);

  const togglePaid = (e, accId) => {
    e.stopPropagation();
    setPaidAccs(prev => {
      const next = { ...prev, [String(accId)]: !prev[String(accId)] };
      invoicesApi.saveAusgabenHotelPaid(next).catch(() => {});
      return next;
    });
  };
  const [openMobileCards, setOpenMobileCards] = useState(new Set());
  const toggleMobileCard = (id) => setOpenMobileCards(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const [openTransportProviders, setOpenTransportProviders] = useState(new Set());
  const [openTransportMonths, setOpenTransportMonths] = useState(new Set());
  const toggleTransportProvider = (key) => setOpenTransportProviders(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });
  const toggleTransportMonth = (key) => setOpenTransportMonths(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });
  const toggleTransportPaid = (e, bookingId, providerKey) => {
    e.stopPropagation();
    const tkey = `${bookingId}_${providerKey}`;
    setPaidTransport(prev => {
      const next = { ...prev, [tkey]: !prev[tkey] };
      invoicesApi.saveAusgabenTransportPaid(next).catch(() => {});
      return next;
    });
  };

  const handleRailwayPaidToggle = async (e, bookingId, railwayId, currentPaid) => {
    e.stopPropagation();
    const newPaid = !currentPaid;
    // Optimistic update
    setBookingsDetailedData(prev => prev.map(b =>
      b.bookingId !== bookingId ? b : {
        ...b,
        railways: (b.railways || []).map(r => r.id === railwayId ? { ...r, paid: newPaid } : r)
      }
    ));
    try {
      await railwaysApi.update(bookingId, railwayId, { paid: newPaid });
    } catch {
      // Rollback
      setBookingsDetailedData(prev => prev.map(b =>
        b.bookingId !== bookingId ? b : {
          ...b,
          railways: (b.railways || []).map(r => r.id === railwayId ? { ...r, paid: currentPaid } : r)
        }
      ));
    }
  };

  // Cache: { tourTypeCode: { bookings: [], detailedData: [] } }
  const [cache, setCache] = useState({});
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    loadBookingsAndExpenses();
  }, [activeTourType, selectedYear]);

  const handleRefresh = () => {
    // Clear localStorage cache for current tour+year
    const cacheKey = `ausgaben_cache_v6_${activeTourType}_${selectedYear}`;
    localStorage.removeItem(cacheKey);
    // Clear in-memory cache
    setCache({});
    loadBookingsAndExpenses(true);
  };

  const loadBookingsAndExpenses = async (forceRefresh = false) => {
    // Check cache first
    const cacheKey = `${activeTourType}_${selectedYear}`;
    const needsDetailedData = ['general', 'hotels', 'hotel-analysis', 'guides', 'transport', 'transport-analysis', 'uberweisung', 'bank', 'railways'].includes(activeExpenseTab);

    // Try localStorage first (persists across page reloads)
    if (!forceRefresh) try {
      const localStorageKey = `ausgaben_cache_v6_${cacheKey}`;
      const cachedData = localStorage.getItem(localStorageKey);

      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        const cacheAge = Date.now() - (parsed.timestamp || 0);
        const maxAge = 1 * 60 * 1000; // 1 minute cache

        if (cacheAge < maxAge && parsed.bookings && (!needsDetailedData || parsed.detailedData)) {
          const nonCancelledBookings = parsed.bookings.filter(b => b.status !== 'CANCELLED');
          setBookings(nonCancelledBookings);
          if (parsed.detailedData) {
            const nonCancelledDetailedData = parsed.detailedData.filter(d =>
              nonCancelledBookings.some(b => b.id === d.bookingId)
            );
            setBookingsDetailedData(nonCancelledDetailedData);
          }
          // Also update in-memory cache
          setCache(prev => ({
            ...prev,
            [cacheKey]: { bookings: nonCancelledBookings, detailedData: parsed.detailedData }
          }));
          setLoading(false);
          return;
        }
      }
    } catch (e) {
      console.warn('Failed to load from localStorage:', e);
    }

    // Check in-memory cache
    if (!forceRefresh && cache[cacheKey]?.bookings && (!needsDetailedData || cache[cacheKey]?.detailedData)) {
      const nonCancelledBookings = cache[cacheKey].bookings.filter(b => b.status !== 'CANCELLED');
      setBookings(nonCancelledBookings);
      if (cache[cacheKey].detailedData) {
        setBookingsDetailedData(cache[cacheKey].detailedData.filter(d =>
          nonCancelledBookings.some(b => b.id === d.bookingId)
        ));
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    try {

      // Load bookings for active tour type
      const response = await bookingsApi.getAll({ year: selectedYear });
      const allBookings = response.data.bookings;

      const noTourType = [];
      allBookings.forEach(b => {
        if (!b.tourType?.code) {
          noTourType.push(b.bookingNumber || `ID-${b.id}`);
        }
      });

      if (noTourType.length > 0) {
        console.warn(`⚠️ ${noTourType.length} bookings WITHOUT tourType:`, noTourType);
      }

      // Filter by tour type, exclude cancelled bookings
      const filteredBookings = allBookings.filter(booking => {
        if (booking.status === 'CANCELLED') return false;
        if (activeTourType === 'ALL') return ['ER','CO','KAS','ZA'].includes(booking.tourType?.code);
        return booking.tourType?.code === activeTourType;
      });


      setBookings(filteredBookings);

      // Load detailed data with hotel calculations for general and hotels tabs
      let detailedData = null;
      if (needsDetailedData) {
        detailedData = await loadDetailedBookingsData(filteredBookings);
      }

      // Cache the results in memory
      const cacheData = {
        bookings: filteredBookings,
        detailedData: detailedData || cache[cacheKey]?.detailedData || null
      };

      setCache(prev => ({
        ...prev,
        [cacheKey]: cacheData
      }));

      // Also save to localStorage for persistence
      try {
        const localStorageKey = `ausgaben_cache_v6_${cacheKey}`;
        localStorage.setItem(localStorageKey, JSON.stringify({
          ...cacheData,
          timestamp: Date.now()
        }));
        setLastUpdated(new Date());
      } catch (e) {
        console.warn('Failed to save to localStorage:', e);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error loading data');
    } finally {
      setLoading(false);
    }
  };

  // Core computation — process bookings in batches of 5 to avoid rate limiting
  const computeDetailedDataRaw = async (bookingsData, metroVehiclesData, opexCache = {}) => {
    const BATCH_SIZE = 5;
    const results = [];
    for (let i = 0; i < bookingsData.length; i += BATCH_SIZE) {
      const batch = bookingsData.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map(async (booking) => {
      try {
        const [accResponse, touristsResponse, routesResponse, railwaysResponse, flightsResponse, tourServicesResponse] = await Promise.all([
          bookingsApi.getAccommodations(booking.id).catch(() => ({ data: { accommodations: [] } })),
          touristsApi.getAll(booking.id).catch(() => ({ data: { tourists: [] } })),
          routesApi.getAll(booking.id).catch(() => ({ data: { routes: [] } })),
          railwaysApi.getAll(booking.id).catch(() => ({ data: { railways: [] } })),
          flightsApi.getAll(booking.id).catch(() => ({ data: { flights: [] } })),
          tourServicesApi.getAll(booking.id).catch(() => ({ data: { services: [] } }))
        ]);

        const accommodations = accResponse.data.accommodations || [];
        const tourists = touristsResponse.data.tourists || [];
        const routes = routesResponse.data.routes || [];
        const railways = railwaysResponse.data.railways || [];
        const flights = flightsResponse.data.flights || [];
        const tourServices = tourServicesResponse.data.services || [];

        const accommodationRoomingLists = {};
        await Promise.all(accommodations.map(async (acc) => {
          try {
            const r = await bookingsApi.getAccommodationRoomingList(booking.id, acc.id);
            accommodationRoomingLists[acc.id] = r.data.roomingList || [];
          } catch { accommodationRoomingLists[acc.id] = []; }
        }));

        const grandTotalData = calculateGrandTotal(accommodations, tourists, accommodationRoomingLists);
        const expenses = await calculateExpensesLikeTotalTab(booking, tourists, grandTotalData, routes, railways, flights, tourServices, metroVehiclesData, opexCache);

        return {
          bookingId: booking.id,
          bookingName: booking.bookingNumber || `${booking.tourType?.code || 'Tour'}-${booking.id}`,
          grandTotalData,
          expenses,
          railways
        };
      } catch (err) {
        console.error(`Error loading data for booking ${booking.id}:`, err);
        return null;
      }
      }));
      results.push(...batchResults);
    }
    return results.filter(d => d !== null);
  };

  const loadDetailedBookingsData = async (bookingsData) => {
    try {
      let metroVehiclesData = [];
      try {
        const transportResponse = await transportApi.getAll(selectedYear);
        metroVehiclesData = transportResponse.data.grouped.metro || [];
      } catch (error) {
        console.error('Error loading metro vehicles:', error);
      }

      // Pre-fetch OPEX data once per tour type (not per booking)
      const tourTypes = [...new Set(bookingsData.map(b => (b.tourType?.code || 'ER').toUpperCase()))];
      const opexCache = {};
      await Promise.all(tourTypes.map(async (ttCode) => {
        const [mealRes, showsRes, sightsRes] = await Promise.all([
          opexApi.get(ttCode, 'meal').catch(() => ({ data: { items: [] } })),
          opexApi.get(ttCode, 'shows').catch(() => ({ data: { items: [] } })),
          opexApi.get(ttCode, 'sightseeing').catch(() => ({ data: { items: [] } })),
        ]);
        opexCache[ttCode] = {
          meal: mealRes.data?.items || [],
          shows: showsRes.data?.items || [],
          sightseeing: sightsRes.data?.items || [],
        };
      }));

      const validData = await computeDetailedDataRaw(bookingsData, metroVehiclesData, opexCache);
      setBookingsDetailedData(validData);
      return validData;
    } catch (error) {
      console.error('Error loading detailed bookings data:', error);
      return [];
    }
  };


  // Calculate expenses using EXACT SAME LOGIC as Costs → Total tab (BookingDetail.jsx:11146-11264)
  const calculateExpensesLikeTotalTab = async (booking, tourists, grandTotalData, routes, railways, flights, tourServices = [], metroVehicles = [], opexCache = {}) => {
    const pax = tourists?.length || 0;
    const tourTypeCode = booking?.tourType?.code?.toLowerCase() || 'er';


    // Parse JSON fields for guide data
    let mainGuide = null;
    let secondGuide = null;
    let bergreiseleiter = null;

    // Tour type default days helper
    const getDefaultDays = (code) => {
      if (code === 'er' || code === 'co') return { fullDays: 12, halfDays: 1 };
      if (code === 'kas') return { fullDays: 8, halfDays: 1 };
      if (code === 'za') return { fullDays: 5, halfDays: 1 };
      return { fullDays: 0, halfDays: 0 };
    };

    // 1. Try mainGuideData JSON first (most accurate - explicitly saved by user in BookingDetail)
    try {
      if (booking.mainGuideData) {
        const mgData = typeof booking.mainGuideData === 'string'
          ? JSON.parse(booking.mainGuideData)
          : booking.mainGuideData;
        if (mgData) {
          const dr = mgData.dayRate || mgData.guide?.dayRate || 110;
          const hdr = mgData.halfDayRate || mgData.guide?.halfDayRate || 55;
          let fullDays = mgData.fullDays || 0;
          let halfDays = mgData.halfDays || 0;

          // If saved days are 0, use tour type defaults (handles old data saved before KAS fix)
          if (fullDays === 0 && halfDays === 0 && mgData.guide) {
            const defaults = getDefaultDays(tourTypeCode);
            fullDays = defaults.fullDays;
            halfDays = defaults.halfDays;
          }

          let totalPayment = (fullDays * dr) + (halfDays * hdr);
          if (totalPayment > 0) {
            mainGuide = { totalPayment };
          }
        }
      }
    } catch (e) {
      console.error('  ❌ Error parsing mainGuideData:', e);
    }

    try {
      if (booking.additionalGuides && typeof booking.additionalGuides === 'string') {
        const additionalGuides = JSON.parse(booking.additionalGuides);
        secondGuide = additionalGuides[0] || null;

        // Always recalculate totalPayment from days × rate (in case rate changed)
        if (secondGuide) {
          const dayRate = secondGuide.dayRate || secondGuide.guide?.dayRate || 110;
          const halfDayRate = secondGuide.halfDayRate || secondGuide.guide?.halfDayRate || 55;
          const fullDays = secondGuide.fullDays || 0;
          const halfDays = secondGuide.halfDays || 0;
          if (fullDays > 0 || halfDays > 0) {
            secondGuide.totalPayment = (fullDays * dayRate) + (halfDays * halfDayRate);
          }
        }
      }
    } catch (e) {
      console.error('  ❌ Error parsing additionalGuides:', e);
    }

    try {
      if (booking.bergreiseleiter && typeof booking.bergreiseleiter === 'string') {
        bergreiseleiter = JSON.parse(booking.bergreiseleiter);
      } else if (booking.bergreiseleiter && typeof booking.bergreiseleiter === 'object') {
        bergreiseleiter = booking.bergreiseleiter;
      }

      // Calculate totalPayment if missing
      if (bergreiseleiter && !bergreiseleiter.totalPayment) {
        const dayRate = bergreiseleiter.dayRate || bergreiseleiter.guide?.dayRate || 50;
        const halfDayRate = bergreiseleiter.halfDayRate || bergreiseleiter.guide?.halfDayRate || 0;
        const fullDays = bergreiseleiter.fullDays || 0;
        const halfDays = bergreiseleiter.halfDays || 0;
        bergreiseleiter.totalPayment = (fullDays * dayRate) + (halfDays * halfDayRate);
      }
    } catch (e) {
      console.error('  ❌ Error parsing bergreiseleiter:', e);
    }

    // Calculate main guide payment (fallback if mainGuideData not available)
    // If guide is assigned, calculate payment even if days are 0 (use defaults for ER/CO tours)
    if (!mainGuide && (booking.guide || (booking.guideFullDays !== undefined && booking.guideFullDays !== null) ||
        (booking.guideHalfDays !== undefined && booking.guideHalfDays !== null))) {
      const dayRate = booking.guide?.dayRate || 110;
      const halfDayRate = booking.guide?.halfDayRate || 55;
      let fullDays = booking.guideFullDays || 0;
      let halfDays = booking.guideHalfDays || 0;

      // AUTO-CALCULATE: If guide is assigned but days are 0, use tour type defaults
      if (booking.guide && fullDays === 0 && halfDays === 0) {
        const defaults = getDefaultDays(tourTypeCode);
        if (defaults.fullDays > 0 || defaults.halfDays > 0) {
          fullDays = defaults.fullDays;
          halfDays = defaults.halfDays;
        }
      }

      // Calculate if at least one day is set (including auto-calculated)
      if (fullDays > 0 || halfDays > 0) {
        mainGuide = {
          totalPayment: (fullDays * dayRate) + (halfDays * halfDayRate)
        };
      } else {
      }
    } else {
    }

    const expenses = {
      // 1. Hotels - from grandTotalData
      hotelsUSD: grandTotalData?.grandTotalUSD || 0,
      hotelsUZS: grandTotalData?.grandTotalUZS || 0,

      // 2. Transport & Routes - from routes array
      transportSevil: routes.filter(r => r.provider?.toLowerCase().includes('sevil')).reduce((sum, r) => sum + (r.price || 0), 0),
      transportXayrulla: routes.filter(r => r.provider?.toLowerCase().includes('xayrulla')).reduce((sum, r) => sum + (r.price || 0), 0),
      transportNosir: routes.filter(r => r.provider?.toLowerCase().includes('nosir')).reduce((sum, r) => sum + (r.price || 0), 0),
      // Date ranges per provider (first and last route date)
      transportSevilDates: (() => { const d = routes.filter(r => r.provider?.toLowerCase().includes('sevil') && r.date).map(r => r.date).sort(); return { from: d[0] || null, to: d[d.length-1] || null }; })(),
      transportXayrullaDates: (() => { const d = routes.filter(r => r.provider?.toLowerCase().includes('xayrulla') && r.date).map(r => r.date).sort(); return { from: d[0] || null, to: d[d.length-1] || null }; })(),
      transportNosirDates: (() => { const d = routes.filter(r => r.provider?.toLowerCase().includes('nosir') && r.date).map(r => r.date).sort(); return { from: d[0] || null, to: d[d.length-1] || null }; })(),

      // 3. Railway - from railways array
      railway: railways.reduce((sum, r) => sum + (r.price || 0), 0),

      // 4. Flights - from flights array
      flights: flights.reduce((sum, f) => sum + (f.price || 0), 0),

      // 5. Guide - from mainGuide, secondGuide, bergreiseleiter
      guide: (mainGuide?.totalPayment || 0) + (secondGuide?.totalPayment || 0) + (bergreiseleiter?.totalPayment || 0),
      guideMainCost: mainGuide?.totalPayment || 0,
      guideMainName: booking.guide?.name || '',
      guideSecondCost: secondGuide?.totalPayment || 0,
      guideSecondName: secondGuide?.guide?.name || secondGuide?.guideName || '',
      guideBergrCost: bergreiseleiter?.totalPayment || 0,
      guideBergrName: bergreiseleiter?.guide?.name || bergreiseleiter?.guideName || '',

      // 6. Meals - from localStorage
      meals: 0,

      // 7. Metro - from Opex Transport API (skip for ZA tours)
      metro: (() => {
        // Skip Metro for ZA tours
        if (booking.tourType?.code === 'ZA') {
          return 0;
        }

        const metroData = metroVehicles || [];
        const metroPax = pax + 1; // +1 for guide (tourists + guide)
        const metroTotal = metroData.reduce((sum, metro) => {
          const rawPrice = metro.economPrice || metro.price || metro.pricePerPerson || 0;
          const priceStr = rawPrice.toString().replace(/\s/g, '');
          const pricePerPerson = parseFloat(priceStr) || 0;
          return sum + (pricePerPerson * metroPax);
        }, 0);
        return metroTotal;
      })(),

      // 8. Shows - from tourServices (type='SHOU')
      shou: tourServices.filter(ts => ts.type?.toUpperCase() === 'SHOU').reduce((sum, ts) => sum + (parseFloat(ts.price) || 0), 0),

      // 9. Eintritt - from tourServices (type='EINTRITT')
      eintritt: tourServices.filter(ts => ts.type?.toUpperCase() === 'EINTRITT').reduce((sum, ts) => sum + (parseFloat(ts.price) || 0), 0),

      // 10. Other - from tourServices (type='OTHER')
      other: (() => {
        const otherServices = tourServices.filter(ts => ts.type?.toUpperCase() === 'OTHER');
        const otherTotal = otherServices.reduce((sum, ts) => sum + (parseFloat(ts.price) || 0), 0);
        return otherTotal;
      })()
    };

    // Load Meals from OPEX cache (pre-fetched once per tour type)
    const ttCodeUpper = tourTypeCode.toUpperCase();
    const cachedOpex = opexCache[ttCodeUpper] || {};

    const mealsData = cachedOpex.meal || [];
    if (mealsData.length > 0) {
      expenses.meals = mealsData.reduce((sum, meal) => {
        const priceStr = (meal.price || meal.pricePerPerson || '0').toString().replace(/\s/g, '');
        const pricePerPerson = parseFloat(priceStr) || 0;
        return sum + (pricePerPerson * pax);
      }, 0);
    }

    // ADD Shows from OPEX cache (in addition to tourServices)
    const showsData = cachedOpex.shows || [];
    if (showsData.length > 0) {
      const opexShows = showsData.reduce((sum, show) => {
        const rawPrice = show.price || show.pricePerPerson || 0;
        const priceStr = rawPrice.toString().replace(/\s/g, '');
        const pricePerPerson = parseFloat(priceStr) || 0;
        return sum + (pricePerPerson * pax);
      }, 0);
      expenses.shou += opexShows; // ADD to existing tourServices value
    }

    // ADD Eintritt from OPEX cache (in addition to tourServices)
    const sightseeingData = cachedOpex.sightseeing || [];
    if (sightseeingData.length > 0) {
      const opexEintritt = sightseeingData.reduce((sum, item) => {
        const pricePerPerson = parseFloat((item.price || '0').toString().replace(/\s/g, '')) || 0;
        return sum + (pricePerPerson * pax);
      }, 0);
      expenses.eintritt += opexEintritt; // ADD to existing tourServices value
    }


    // Überweisung total (mirrors BookingDetail exportUberweisungToPDF)
    // 1. Sightseeing from OPEX
    const uberSightseeingUZS = (cachedOpex.sightseeing || []).reduce((sum, item) => {
      const pricePerPerson = parseFloat((item.price || '0').toString().replace(/\s/g, '')) || 0;
      return sum + (pricePerPerson * pax);
    }, 0);

    // 2. Folklore Show from OPEX (only Nadir Divan/Folklore Show)
    const uberFolkloreUZS = (cachedOpex.shows || []).reduce((sum, show) => {
      const name = (show.name || '').toLowerCase();
      if (!name.includes('folklore show') && !name.includes('nadir divan')) return sum;
      const pricePerPerson = parseFloat((show.price || show.pricePerPerson || '0').toString().replace(/\s/g, '')) || 0;
      const showPax = show.pax || pax;
      return sum + (pricePerPerson * showPax);
    }, 0);

    // 3. Railway UZS
    const uberRailwayUZS = railways.reduce((sum, r) => sum + (r.price || 0), 0);

    expenses.uberweisungUZS = uberSightseeingUZS + uberFolkloreUZS + uberRailwayUZS;
    expenses.uberweisungEintritt = uberSightseeingUZS;
    expenses.uberweisungFolklore = uberFolkloreUZS;
    expenses.uberweisungRailway = uberRailwayUZS;

    return expenses;
  };

  // Same calculation logic as BookingDetail's grandTotalData useMemo
  const calculateGrandTotal = (accommodations, tourists, accommodationRoomingLists) => {
    if (accommodations.length === 0) return null;

    let grandTotalUSD = 0;
    let grandTotalUZS = 0;
    const hotelBreakdown = [];

    accommodations.forEach(acc => {
      if (!acc.rooms?.length || !acc.checkInDate || !acc.checkOutDate) return;

      // Use accommodation-specific rooming list if available
      let accTourists = accommodationRoomingLists[acc.id] || [];

      // Fallback: filter tourists by hotel name and date overlap if rooming list not loaded
      if (accTourists.length === 0) {
        accTourists = tourists.filter(t => {
          if (!t.hotelName || !acc.hotel?.name) return false;

          const hotelFirstWord = acc.hotel.name.toLowerCase().split(' ')[0];
          if (!t.hotelName.toLowerCase().includes(hotelFirstWord)) return false;

          if (t.checkInDate && t.checkOutDate && acc.checkInDate && acc.checkOutDate) {
            const touristCheckIn = new Date(t.checkInDate);
            const touristCheckOut = new Date(t.checkOutDate);
            const accCheckIn = new Date(acc.checkInDate);
            const accCheckOut = new Date(acc.checkOutDate);

            touristCheckIn.setHours(0, 0, 0, 0);
            touristCheckOut.setHours(0, 0, 0, 0);
            accCheckIn.setHours(0, 0, 0, 0);
            accCheckOut.setHours(0, 0, 0, 0);

            return touristCheckIn < accCheckOut && touristCheckOut > accCheckIn;
          }

          return true;
        });
      }

      if (accTourists.length === 0) return;

      const accCheckIn = new Date(acc.checkInDate);
      accCheckIn.setHours(0, 0, 0, 0);
      const accCheckOut = new Date(acc.checkOutDate);
      accCheckOut.setHours(0, 0, 0, 0);

      // Calculate guest-nights per room type FROM FINAL LIST
      const guestNightsPerRoomType = {};
      accTourists.forEach(tourist => {
        const checkIn = tourist.checkInDate ? new Date(tourist.checkInDate) : accCheckIn;
        const checkOut = tourist.checkOutDate ? new Date(tourist.checkOutDate) : accCheckOut;
        checkIn.setHours(0, 0, 0, 0);
        checkOut.setHours(0, 0, 0, 0);

        const nights = Math.max(0, Math.round((checkOut - checkIn) / (1000 * 60 * 60 * 24)));

        let roomType = (tourist.roomPreference || '').toUpperCase();
        if (roomType === 'DOUBLE' || roomType === 'DZ') roomType = 'DBL';
        if (roomType === 'TWIN') roomType = 'TWN';
        if (roomType === 'SINGLE' || roomType === 'EZ') roomType = 'SNGL';

        if (!guestNightsPerRoomType[roomType]) {
          guestNightsPerRoomType[roomType] = 0;
        }
        guestNightsPerRoomType[roomType] += nights;
      });

      // Determine currency for this hotel
      const firstRoom = acc.rooms?.[0];
      const roomType = firstRoom ? acc.hotel?.roomTypes?.find(rt => rt.name === firstRoom.roomTypeCode) : null;
      let hotelCurrency = roomType?.currency || acc.hotel?.roomTypes?.[0]?.currency || 'UZS';

      // Auto-detect from room prices
      if (acc.rooms?.length > 0) {
        const firstRoomPrice = parseFloat(acc.rooms[0].pricePerNight) || 0;
        if (firstRoomPrice > 10000) {
          hotelCurrency = 'UZS';
        }
      }

      let hotelTotalUSD = 0;
      let hotelTotalUZS = 0;

      // Calculate cost from rooming list data
      acc.rooms.forEach(room => {
        const pricePerNight = parseFloat(room.pricePerNight) || 0;
        let normalizedRoomType = room.roomTypeCode?.toUpperCase();
        if (normalizedRoomType === 'DOUBLE') normalizedRoomType = 'DBL';
        if (normalizedRoomType === 'TWIN') normalizedRoomType = 'TWN';
        if (normalizedRoomType === 'SINGLE') normalizedRoomType = 'SNGL';

        const guestNights = guestNightsPerRoomType[normalizedRoomType] || 0;

        if (guestNights === 0 && normalizedRoomType !== 'PAX') return;

        // Convert guest-nights to room-nights
        let roomNights;
        if (normalizedRoomType === 'PAX') {
          roomNights = guestNights || accTourists.length;
        } else if (normalizedRoomType === 'TWN' || normalizedRoomType === 'DBL') {
          roomNights = guestNights / 2;
        } else {
          roomNights = guestNights;
        }

        const roomCost = roomNights * pricePerNight;

        if (hotelCurrency === 'USD' || hotelCurrency === 'EUR') {
          grandTotalUSD += roomCost;
          hotelTotalUSD += roomCost;
        } else {
          grandTotalUZS += roomCost;
          hotelTotalUZS += roomCost;
        }
      });

      // Store breakdown with accommodation ID
      hotelBreakdown.push({
        accommodationId: acc.id,
        hotel: acc.hotel?.name,
        city: acc.hotel?.city?.name,
        checkInDate: acc.checkInDate,
        checkOutDate: acc.checkOutDate,
        USD: hotelTotalUSD,
        UZS: hotelTotalUZS
      });
    });

    if (grandTotalUSD === 0 && grandTotalUZS === 0) return null;

    return {
      hotelBreakdown,
      grandTotalUSD,
      grandTotalUZS
    };
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return '-';
    }
  };

  // Merge certain hotel names into a single display column
  // e.g. "Jahongir Premium" → "Jahongir" (same hotel, different room category)
  const normalizeHotel = (name) => {
    if (!name) return name;
    if (name.toLowerCase().trim().includes('jahongir')) return 'Jahongir';
    return name.trim();
  };

  // Pivot data: Hotels as columns, bookings as rows
  const getPivotData = () => {
    // Use filtered bookings (only with Hotels data)
    const dataToUse = filteredBookingsWithHotels;

    // Get unique hotels across all bookings (using normalized names)
    const uniqueHotels = new Set();
    dataToUse.forEach(booking => {
      if (booking.grandTotalData?.hotelBreakdown) {
        booking.grandTotalData.hotelBreakdown.forEach(h => {
          if (h.hotel) uniqueHotels.add(normalizeHotel(h.hotel));
        });
      }
    });

    const hotels = Array.from(uniqueHotels).sort();

    // Create booking rows with hotel costs
    const bookingRows = dataToUse.map(booking => {
      const hotelCosts = {}; // { normalizedHotelName: { usd, uzs } }

      if (booking.grandTotalData?.hotelBreakdown) {
        // Sum costs, merging aliases (e.g. Jahongir + Jahongir Premium → Jahongir)
        booking.grandTotalData.hotelBreakdown.forEach(h => {
          if (!h.hotel) return;
          const key = normalizeHotel(h.hotel);
          if (!hotelCosts[key]) hotelCosts[key] = { usd: 0, uzs: 0 };
          hotelCosts[key].usd += (h.USD || 0);
          hotelCosts[key].uzs += (h.UZS || 0);
        });
      }

      return {
        bookingId: booking.bookingId,
        bookingName: booking.bookingName,
        hotelCosts,
        totalUSD: booking.grandTotalData?.grandTotalUSD || 0,
        totalUZS: booking.grandTotalData?.grandTotalUZS || 0
      };
    });

    return {
      hotels,
      bookingRows
    };
  };

  const getHotelGrandTotal = (hotelName, currency) => {
    // Use filtered bookings (only with Hotels data)
    const dataToUse = filteredBookingsWithHotels;
    return dataToUse.reduce((sum, booking) => {
      if (!booking.grandTotalData?.hotelBreakdown) return sum;

      // Match by normalized name so aliases (e.g. Jahongir Premium) are included
      const hotelMatches = booking.grandTotalData.hotelBreakdown.filter(h => normalizeHotel(h.hotel) === hotelName);

      // Sum all occurrences of this hotel
      const hotelTotal = hotelMatches.reduce((hotelSum, h) => {
        return hotelSum + (currency === 'usd' ? (h.USD || 0) : (h.UZS || 0));
      }, 0);

      return sum + hotelTotal;
    }, 0);
  };

  const getGrandTotalUSD = () => {
    if (activeExpenseTab === 'general') {
      return bookingsDetailedData.reduce((sum, b) => {
        const e = b.expenses || {};
        return sum + (e.hotelsUSD || 0) + (e.guide || 0);
      }, 0);
    }
    if (activeExpenseTab === 'hotels') {
      return filteredBookingsWithHotels.reduce((sum, b) => sum + (b.grandTotalData?.grandTotalUSD || 0), 0);
    }
    if (activeExpenseTab === 'guides') {
      return bookingsDetailedData.reduce((sum, b) => sum + (b.expenses?.guide || 0), 0);
    }
    return 0; // transport is UZS only
  };

  const getGrandTotalUZS = () => {
    if (activeExpenseTab === 'general') {
      return bookingsDetailedData.reduce((sum, b) => {
        const e = b.expenses || {};
        return sum + (e.hotelsUZS || 0) + (e.transportSevil || 0) + (e.transportXayrulla || 0) +
               (e.transportNosir || 0) + (e.railway || 0) + (e.flights || 0) +
               (e.meals || 0) + (e.eintritt || 0) + (e.metro || 0) + (e.shou || 0) + (e.other || 0);
      }, 0);
    }
    if (activeExpenseTab === 'hotels') {
      return filteredBookingsWithHotels.reduce((sum, b) => sum + (b.grandTotalData?.grandTotalUZS || 0), 0);
    }
    if (activeExpenseTab === 'transport') {
      return bookingsDetailedData.reduce((sum, b) =>
        sum + (b.expenses?.transportSevil || 0) + (b.expenses?.transportXayrulla || 0) +
              (b.expenses?.transportNosir || 0) + (b.expenses?.railway || 0), 0);
    }
    if (activeExpenseTab === 'uberweisung') {
      return bookingsDetailedData.reduce((sum, b) => sum + (b.expenses?.uberweisungUZS || 0), 0);
    }
    if (activeExpenseTab === 'bank') {
      const finalIds = new Set(bookings.filter(b => b.status === 'FINAL_CONFIRMED').map(b => b.id));
      return bookingsDetailedData.filter(b => finalIds.has(b.bookingId)).reduce((sum, b) => sum + (b.expenses?.uberweisungUZS || 0), 0);
    }
    return 0; // guides is USD only
  };

  const formatNumber = (num) => {
    // Format number with spaces every 3 digits: 4618200 → 4 618 200
    const rounded = Math.round(num).toString();
    return rounded.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  const activeModule = tourTypeModules.find(m => m.code === activeTourType);

  // ── EXPORT FUNCTIONS ──

  const getExportTitle = () => {
    const tabName = expenseTabs.find(t => t.id === activeExpenseTab)?.name || activeExpenseTab;
    return `Ausgaben — ${activeModule?.name} — ${tabName} (${selectedYear})`;
  };

  const getExportFilename = (ext) => {
    const tab = activeExpenseTab;
    const tour = activeTourType;
    return `Ausgaben_${tour}_${tab}_${selectedYear}.${ext}`;
  };

  const exportToExcel = async () => {
    let headers = [];
    let rows = [];
    let footerRow = null;
    // Track which column indices are numeric (for number formatting)
    let numericCols = [];

    if (activeExpenseTab === 'general') {
      const data = bookingsDetailedData.filter(b => { const e = b.expenses||{}; return e.hotelsUSD>0||e.hotelsUZS>0; });
      headers = ['#', 'Booking', 'Hotels USD', 'Hotels UZS', 'Sevil', 'Xayrulla', 'Nosir', 'Train', 'Flights', 'Guide USD', 'Meals', 'Eintritt', 'Metro', 'Shou', 'Other', 'Total UZS', 'Total USD'];
      rows = data.map((b, i) => {
        const e = b.expenses||{};
        const totalUZS = (e.hotelsUZS||0)+(e.transportSevil||0)+(e.transportXayrulla||0)+(e.transportNosir||0)+(e.railway||0)+(e.flights||0)+(e.meals||0)+(e.eintritt||0)+(e.metro||0)+(e.shou||0)+(e.other||0);
        return [i+1, b.bookingName, e.hotelsUSD||0, e.hotelsUZS||0, e.transportSevil||0, e.transportXayrulla||0, e.transportNosir||0, e.railway||0, e.flights||0, e.guide||0, e.meals||0, e.eintritt||0, e.metro||0, e.shou||0, e.other||0, totalUZS, (e.hotelsUSD||0)+(e.guide||0)];
      });
      const totals = headers.slice(2).map((_, i) => rows.reduce((s,r) => s+(r[i+2]||0), 0));
      footerRow = ['', 'TOTAL', ...totals];
      numericCols = [2,3,4,5,6,7,8,9,10,11,12,13,14,15,16];
    }
    else if (activeExpenseTab === 'hotels') {
      const pd = getPivotData();
      headers = ['#', 'Booking', ...pd.hotels, 'Total UZS', 'Total USD'];
      rows = pd.bookingRows.map((br, i) => {
        const hotelVals = pd.hotels.map(h => { const hc = br.hotelCosts[h]; return hc?.uzs||hc?.usd||0; });
        return [i+1, br.bookingName, ...hotelVals, br.totalUZS, br.totalUSD];
      });
      const hotelTotals = pd.hotels.map(h => { const uzs=getHotelGrandTotal(h,'uzs'); const usd=getHotelGrandTotal(h,'usd'); return uzs>0?uzs:usd; });
      footerRow = ['', 'TOTAL', ...hotelTotals, getGrandTotalUZS(), getGrandTotalUSD()];
      numericCols = headers.slice(2).map((_,i)=>i+2);
    }
    else if (activeExpenseTab === 'guides') {
      headers = ['#', 'Booking', 'Main Guide', 'Price USD', 'Second Guide', 'Price USD', 'Bergreiseleiter', 'Price USD', 'Total USD'];
      rows = filteredBookingsWithHotels.map((item, i) => {
        const e = item.expenses||{};
        return [i+1, item.bookingName, e.guideMainName||'—', e.guideMainCost||0, e.guideSecondName||'—', e.guideSecondCost||0, e.guideBergrName||'—', e.guideBergrCost||0, (e.guideMainCost||0)+(e.guideSecondCost||0)+(e.guideBergrCost||0)];
      });
      footerRow = ['', 'TOTAL', '', filteredBookingsWithHotels.reduce((s,i)=>s+(i.expenses?.guideMainCost||0),0), '', filteredBookingsWithHotels.reduce((s,i)=>s+(i.expenses?.guideSecondCost||0),0), '', filteredBookingsWithHotels.reduce((s,i)=>s+(i.expenses?.guideBergrCost||0),0), filteredBookingsWithHotels.reduce((s,i)=>s+(i.expenses?.guide||0),0)];
      numericCols = [3,5,7,8];
    }
    else if (activeExpenseTab === 'uberweisung' || activeExpenseTab === 'bank') {
      const bankFinalIds = activeExpenseTab === 'bank' ? new Set(bookings.filter(b => b.status === 'FINAL_CONFIRMED').map(b => b.id)) : null;
      const uberData = activeExpenseTab === 'bank' ? bookingsDetailedData.filter(b => bankFinalIds.has(b.bookingId)) : bookingsDetailedData;
      headers = ['#', 'Booking', 'Eintritt (UZS)', 'Folklore (UZS)', 'Railway (UZS)', 'Total UZS'];
      rows = uberData.map((b, i) => { const e=b.expenses||{}; return [i+1, b.bookingName, e.uberweisungEintritt||0, e.uberweisungFolklore||0, e.uberweisungRailway||0, e.uberweisungUZS||0]; });
      const totals = rows.reduce((acc,r) => { for(let i=2;i<=5;i++) acc[i-2]=(acc[i-2]||0)+(r[i]||0); return acc; }, []);
      footerRow = ['', 'TOTAL', ...totals];
      numericCols = [2,3,4,5];
    }
    else if (activeExpenseTab === 'transport') {
      headers = ['#', 'Booking', 'Sevil', 'Xayrulla', 'Total'];
      rows = filteredBookingsWithHotels.map((item, i) => { const s=item.expenses?.transportSevil||0; const x=item.expenses?.transportXayrulla||0; return [i+1, item.bookingName, s, x, s+x]; });
      footerRow = ['', 'TOTAL', filteredBookingsWithHotels.reduce((s,i)=>s+(i.expenses?.transportSevil||0),0), filteredBookingsWithHotels.reduce((s,i)=>s+(i.expenses?.transportXayrulla||0),0), filteredBookingsWithHotels.reduce((s,i)=>s+(i.expenses?.transportSevil||0)+(i.expenses?.transportXayrulla||0),0)];
      numericCols = [2,3,4];
    }
    else if (activeExpenseTab === 'railways') {
      const railwayBookings = bookingsDetailedData.filter(b => (b.railways?.length > 0)||(b.expenses?.railway||0)>0);
      const allRailwayRows = railwayBookings.flatMap(b => (b.railways||[]).filter(r=>(r.price||0)>0).map(r=>({...r, bookingId:b.bookingId, bookingName:b.bookingName})));
      headers = ['#', 'Booking', "Yo'nalish", 'Poyezd', 'PAX', 'Bilet narxi', 'Summa (UZS)', "To'landi"];
      rows = allRailwayRows.map((r, i) => [
        i+1, r.bookingName,
        r.departure && r.arrival ? `${r.departure} → ${r.arrival}` : r.route||'—',
        r.trainName||r.trainNumber||'—',
        r.pax||0,
        r.pax>0&&r.price>0 ? Math.round(r.price/r.pax) : 0,
        r.price||0,
        r.paid ? "To'landi" : "To'lanmadi"
      ]);
      const totalPaxEx = allRailwayRows.reduce((s,r)=>s+(r.pax||0),0);
      const grandTotalEx = allRailwayRows.reduce((s,r)=>s+(r.price||0),0);
      const paidTotalEx = allRailwayRows.filter(r=>r.paid).reduce((s,r)=>s+(r.price||0),0);
      footerRow = ['', 'TOTAL', '', '', totalPaxEx, '', grandTotalEx, `To'landi: ${paidTotalEx}`];
      numericCols = [4,5,6];
    }

    // ── Build styled workbook with ExcelJS ──
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Orient Insight';
    const ws = wb.addWorksheet(activeExpenseTab, { views: [{ state: 'frozen', ySplit: 3 }] });

    const colCount = headers.length;

    // Colors
    const DARK_BLUE = '0F172A';
    const MID_BLUE  = '1E3A8A';
    const ACCENT    = '3B82F6';
    const TOTAL_BG  = '1E40AF';
    const ROW_ODD   = 'F0F4FF';
    const ROW_EVEN  = 'FFFFFF';

    const headerFill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF'+MID_BLUE } };
    const totalFill  = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF'+TOTAL_BG } };
    const titleFill  = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF'+DARK_BLUE } };

    const boldWhite  = { bold:true, color:{ argb:'FFFFFFFF' }, size:11, name:'Calibri' };
    const boldDark   = { bold:true, color:{ argb:'FF0F172A' }, size:11, name:'Calibri' };
    const normalFont = { size:10, name:'Calibri', color:{ argb:'FF1E293B' } };
    const border = {
      top:    { style:'thin', color:{ argb:'FFBFDBFE' } },
      left:   { style:'thin', color:{ argb:'FFBFDBFE' } },
      bottom: { style:'thin', color:{ argb:'FFBFDBFE' } },
      right:  { style:'thin', color:{ argb:'FFBFDBFE' } },
    };
    const thickBorder = {
      top:    { style:'medium', color:{ argb:'FF1E3A8A' } },
      left:   { style:'medium', color:{ argb:'FF1E3A8A' } },
      bottom: { style:'medium', color:{ argb:'FF1E3A8A' } },
      right:  { style:'medium', color:{ argb:'FF1E3A8A' } },
    };

    // Row 1: Title (merged)
    const titleRow2 = ws.addRow([getExportTitle()]);
    ws.mergeCells(1, 1, 1, colCount);
    const titleCell = titleRow2.getCell(1);
    titleCell.font = { ...boldWhite, size:13 };
    titleCell.fill = titleFill;
    titleCell.alignment = { vertical:'middle', horizontal:'center' };
    titleCell.border = thickBorder;
    titleRow2.height = 28;

    // Row 2: empty spacer
    ws.addRow([]);

    // Row 3: Headers
    const headerRow = ws.addRow(headers);
    headerRow.height = 22;
    headerRow.eachCell((cell, colNum) => {
      cell.font = boldWhite;
      cell.fill = headerFill;
      cell.alignment = { vertical:'middle', horizontal: colNum<=2 ? 'left' : 'center' };
      cell.border = border;
    });

    // Data rows
    rows.forEach((rowData, idx) => {
      const dataRow = ws.addRow(rowData);
      dataRow.height = 18;
      const bgColor = idx % 2 === 0 ? ROW_ODD : ROW_EVEN;
      dataRow.eachCell({ includeEmpty:true }, (cell, colNum) => {
        cell.font = normalFont;
        cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF'+bgColor } };
        cell.alignment = { vertical:'middle', horizontal: colNum<=2 ? 'left' : 'center' };
        cell.border = border;
        if (numericCols.includes(colNum-1)) {
          cell.numFmt = '#,##0';
        }
      });
      // Booking name: bold blue
      const bookingCell = dataRow.getCell(2);
      bookingCell.font = { ...normalFont, bold:true, color:{ argb:'FF2563EB' } };
    });

    // Footer / TOTAL row
    if (footerRow) {
      const totRow = ws.addRow(footerRow);
      totRow.height = 22;
      totRow.eachCell({ includeEmpty:true }, (cell, colNum) => {
        cell.font = { ...boldWhite, size:11 };
        cell.fill = totalFill;
        cell.alignment = { vertical:'middle', horizontal: colNum<=2 ? 'left' : 'center' };
        cell.border = thickBorder;
        if (numericCols.includes(colNum-1)) {
          cell.numFmt = '#,##0';
        }
      });
    }

    // Column widths
    const colWidths = headers.map((h, i) => {
      if (i === 0) return 5;
      if (i === 1) return 14;
      const maxDataLen = rows.reduce((max, r) => Math.max(max, String(r[i]||'').length), h.length);
      return Math.min(Math.max(maxDataLen + 3, h.length + 2), 30);
    });
    ws.columns = colWidths.map(w => ({ width: w }));

    // Save
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = getExportFilename('xlsx'); a.click();
    URL.revokeObjectURL(url);
    toast.success('Excel fayl yuklab olindi');
  };

  // ── PDF helpers ───────────────────────────────────────────────────────────
  const fmtN = v => typeof v === 'number' ? (v === 0 ? '—' : String(v)) : (v || '—');

  const buildPdfData = () => {
    let head = [], body = [], foot = [];

    if (activeExpenseTab === 'general') {
      const data = bookingsDetailedData.filter(b => { const e = b.expenses||{}; return e.hotelsUSD>0||e.hotelsUZS>0; });
      head = [['#', 'Booking', 'Hotels USD', 'Hotels UZS', 'Sevil', 'Xayrulla', 'Nosir', 'Train', 'Flights', 'Guide', 'Meals', 'Eintritt', 'Metro', 'Shou', 'Other', 'Total UZS', 'Total USD']];
      body = data.map((b, i) => {
        const e = b.expenses || {};
        const tUZS = (e.hotelsUZS||0)+(e.transportSevil||0)+(e.transportXayrulla||0)+(e.transportNosir||0)+(e.railway||0)+(e.flights||0)+(e.meals||0)+(e.eintritt||0)+(e.metro||0)+(e.shou||0)+(e.other||0);
        return [i+1, b.bookingName, fmtN(e.hotelsUSD), fmtN(e.hotelsUZS), fmtN(e.transportSevil), fmtN(e.transportXayrulla), fmtN(e.transportNosir), fmtN(e.railway), fmtN(e.flights), fmtN(e.guide), fmtN(e.meals), fmtN(e.eintritt), fmtN(e.metro), fmtN(e.shou), fmtN(e.other), fmtN(tUZS), fmtN((e.hotelsUSD||0)+(e.guide||0))];
      });
      const sf = (f) => data.reduce((s,b)=>s+(b.expenses?.[f]||0),0);
      const gUZS = data.reduce((s,b)=>{const e=b.expenses||{}; return s+(e.hotelsUZS||0)+(e.transportSevil||0)+(e.transportXayrulla||0)+(e.transportNosir||0)+(e.railway||0)+(e.flights||0)+(e.meals||0)+(e.eintritt||0)+(e.metro||0)+(e.shou||0)+(e.other||0);},0);
      foot = [['', 'TOTAL', fmtN(sf('hotelsUSD')), fmtN(sf('hotelsUZS')), fmtN(sf('transportSevil')), fmtN(sf('transportXayrulla')), fmtN(sf('transportNosir')), fmtN(sf('railway')), fmtN(sf('flights')), fmtN(sf('guide')), fmtN(sf('meals')), fmtN(sf('eintritt')), fmtN(sf('metro')), fmtN(sf('shou')), fmtN(sf('other')), fmtN(gUZS), fmtN(sf('hotelsUSD')+sf('guide'))]];
    }
    else if (activeExpenseTab === 'hotels') {
      const pd = getPivotData();
      head = [['#', 'Booking', ...pd.hotels, 'Total UZS', 'Total USD']];
      body = pd.bookingRows.map((br, i) => {
        const hotelVals = pd.hotels.map(h => { const hc = br.hotelCosts[h]; return fmtN(hc?.uzs||hc?.usd||0); });
        return [i+1, br.bookingName, ...hotelVals, fmtN(br.totalUZS), fmtN(br.totalUSD)];
      });
      const hotelTotals = pd.hotels.map(h => { const uzs = getHotelGrandTotal(h,'uzs'); const usd = getHotelGrandTotal(h,'usd'); return fmtN(uzs>0?uzs:usd); });
      foot = [['', 'TOTAL', ...hotelTotals, fmtN(getGrandTotalUZS()), fmtN(getGrandTotalUSD())]];
    }
    else if (activeExpenseTab === 'guides') {
      head = [['#', 'Booking', 'Main Guide', 'Price USD', 'Second Guide', 'Price USD', 'Bergreiseleiter', 'Price USD', 'Total USD']];
      body = filteredBookingsWithHotels.map((item, i) => {
        const e = item.expenses || {};
        return [i+1, item.bookingName, e.guideMainName||'—', fmtN(e.guideMainCost), e.guideSecondName||'—', fmtN(e.guideSecondCost), e.guideBergrName||'—', fmtN(e.guideBergrCost), fmtN((e.guideMainCost||0)+(e.guideSecondCost||0)+(e.guideBergrCost||0))];
      });
      foot = [['', 'TOTAL', '', fmtN(filteredBookingsWithHotels.reduce((s,i)=>s+(i.expenses?.guideMainCost||0),0)), '', fmtN(filteredBookingsWithHotels.reduce((s,i)=>s+(i.expenses?.guideSecondCost||0),0)), '', fmtN(filteredBookingsWithHotels.reduce((s,i)=>s+(i.expenses?.guideBergrCost||0),0)), fmtN(filteredBookingsWithHotels.reduce((s,i)=>s+(i.expenses?.guide||0),0))]];
    }
    else if (activeExpenseTab === 'uberweisung' || activeExpenseTab === 'bank') {
      const pdfFinalIds = activeExpenseTab === 'bank' ? new Set(bookings.filter(b => b.status === 'FINAL_CONFIRMED').map(b => b.id)) : null;
      const pdfUberData = activeExpenseTab === 'bank' ? bookingsDetailedData.filter(b => pdfFinalIds.has(b.bookingId)) : bookingsDetailedData;
      head = [['#', 'Booking', 'Eintritt (UZS)', 'Folklore (UZS)', 'Railway (UZS)', 'Total UZS']];
      body = pdfUberData.map((b, i) => {
        const e = b.expenses || {};
        return [i+1, b.bookingName, fmtN(e.uberweisungEintritt||0), fmtN(e.uberweisungFolklore||0), fmtN(e.uberweisungRailway||0), fmtN(e.uberweisungUZS||0)];
      });
      foot = [['', 'TOTAL', fmtN(pdfUberData.reduce((s,b)=>s+(b.expenses?.uberweisungEintritt||0),0)), fmtN(pdfUberData.reduce((s,b)=>s+(b.expenses?.uberweisungFolklore||0),0)), fmtN(pdfUberData.reduce((s,b)=>s+(b.expenses?.uberweisungRailway||0),0)), fmtN(pdfUberData.reduce((s,b)=>s+(b.expenses?.uberweisungUZS||0),0))]];
    }
    else if (activeExpenseTab === 'transport') {
      head = [['#', 'Booking', 'Sevil', 'Xayrulla', 'Total']];
      body = filteredBookingsWithHotels.map((item, i) => {
        const s = item.expenses?.transportSevil||0; const x = item.expenses?.transportXayrulla||0;
        return [i+1, item.bookingName, fmtN(s), fmtN(x), fmtN(s+x)];
      });
      foot = [['', 'TOTAL', fmtN(filteredBookingsWithHotels.reduce((s,i)=>s+(i.expenses?.transportSevil||0),0)), fmtN(filteredBookingsWithHotels.reduce((s,i)=>s+(i.expenses?.transportXayrulla||0),0)), fmtN(filteredBookingsWithHotels.reduce((s,i)=>s+(i.expenses?.transportSevil||0)+(i.expenses?.transportXayrulla||0),0))]];
    }
    else if (activeExpenseTab === 'railways') {
      const railwayBookings = bookingsDetailedData.filter(b => (b.railways?.length > 0)||(b.expenses?.railway||0)>0);
      const allRows = railwayBookings.flatMap(b => (b.railways||[]).filter(r=>(r.price||0)>0).map(r=>({...r, bookingName:b.bookingName})));
      head = [['#', 'Booking', "Yo'nalish", 'Poyezd', 'PAX', 'Bilet narxi', 'Summa (UZS)', "To'landi"]];
      body = allRows.map((r, i) => [
        i+1, r.bookingName,
        r.departure && r.arrival ? `${r.departure} → ${r.arrival}` : r.route||'—',
        r.trainName||r.trainNumber||'—',
        r.pax||'—',
        fmtN(r.pax>0&&r.price>0 ? Math.round(r.price/r.pax) : 0),
        fmtN(r.price||0),
        r.paid ? '✓' : '—',
      ]);
      const totalPax = allRows.reduce((s,r)=>s+(r.pax||0),0);
      const grandTotal = allRows.reduce((s,r)=>s+(r.price||0),0);
      const paidTotal = allRows.filter(r=>r.paid).reduce((s,r)=>s+(r.price||0),0);
      foot = [['', 'TOTAL', '', '', totalPax, '', fmtN(grandTotal), `${fmtN(paidTotal)}`]];
    }

    return { head, body, foot };
  };

  const buildPDFDoc = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const title = getExportTitle();
    const { head, body, foot } = buildPdfData();
    const pageW = doc.internal.pageSize.getWidth();
    const colCount = head[0]?.length || 1;

    const MARGIN = 7;

    // Dark title bar
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(title, MARGIN + 1, 14);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Orient Insight', pageW - MARGIN - 1, 14, { align: 'right' });

    // Column styles — explicit widths to prevent wrapping
    // Usable width: 297 - 2*MARGIN = 283mm
    // # = 7, Booking = 16, then distribute rest equally among numeric cols
    const numericColCount = colCount - 2;
    const numericColW = Math.floor((pageW - 2 * MARGIN - 7 - 16) / Math.max(numericColCount, 1));
    const columnStyles = {
      0: { cellWidth: 7, halign: 'center' },
      1: { cellWidth: 16, halign: 'left' },
    };
    for (let i = 2; i < colCount; i++) columnStyles[i] = { cellWidth: numericColW, halign: 'right' };
    if (activeExpenseTab === 'guides') {
      columnStyles[2] = { cellWidth: numericColW, halign: 'left' };
      columnStyles[4] = { cellWidth: numericColW, halign: 'left' };
      columnStyles[6] = { cellWidth: numericColW, halign: 'left' };
    }
    if (activeExpenseTab === 'railways') {
      columnStyles[2] = { cellWidth: numericColW * 2, halign: 'left' };
      columnStyles[3] = { cellWidth: numericColW * 1.5, halign: 'left' };
      columnStyles[7] = { cellWidth: numericColW, halign: 'center' };
    }

    autoTable(doc, {
      head, body, foot,
      startY: 26,
      margin: { top: 26, right: MARGIN, bottom: 10, left: MARGIN },
      tableWidth: pageW - 2 * MARGIN,
      styles: {
        fontSize: 7.5,
        cellPadding: { top: 2, right: 2, bottom: 2, left: 2 },
        textColor: [30, 41, 59],
        lineColor: [191, 219, 254],
        lineWidth: 0.15,
      },
      headStyles: {
        fillColor: [30, 58, 138],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
        halign: 'center',
        cellPadding: { top: 3, right: 2, bottom: 3, left: 2 },
      },
      footStyles: {
        fillColor: [30, 64, 175],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
      },
      alternateRowStyles: { fillColor: [240, 244, 255] },
      columnStyles,
      didParseCell: (data) => {
        if (data.section === 'foot') {
          data.cell.styles.halign = data.column.index <= 1 ? 'left' : 'right';
        }
        // Booking name bold blue
        if (data.section === 'body' && data.column.index === 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = [37, 99, 235];
        }
      },
      didDrawPage: (data) => {
        const pageH = doc.internal.pageSize.getHeight();
        const pageNum = doc.getCurrentPageInfo().pageNumber;
        const totalPages = doc.getNumberOfPages();
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.setFont('helvetica', 'normal');
        doc.text(`${pageNum} / ${totalPages}`, pageW - MARGIN - 1, pageH - 4, { align: 'right' });
        doc.text(`Orient Insight — ${title}`, MARGIN + 1, pageH - 4);
      },
    });

    return doc;
  };

  const exportToPDF = () => {
    const doc = buildPDFDoc();
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    toast.success('PDF fayl yuklab olindi');
  };

  const [sendingTelegram, setSendingTelegram] = useState(false);

  const sendToTelegram = async () => {
    setSendingTelegram(true);
    try {
      const blob = generatePDFBlob();
      const filename = getExportFilename('pdf');
      await telegramApi.sendAusgabenPdf(blob, filename, {
        title: getExportTitle(),
        tourType: activeTourType,
        tab: activeExpenseTab,
        year: selectedYear,
      });
      toast.success('PDF Sirojga yuborildi ✅');
    } catch (err) {
      toast.error('Yuborishda xatolik: ' + (err.response?.data?.error || err.message));
    } finally {
      setSendingTelegram(false);
    }
  };

  const generatePDFBlob = () => buildPDFDoc().output('blob');

  // Filter bookings with Hotels data (for General tab statistics)
  const filteredBookingsWithHotels = useMemo(() => {
    return bookingsDetailedData.filter(booking => {
      const exp = booking.expenses || {};
      return (exp.hotelsUSD > 0 || exp.hotelsUZS > 0);
    });
  }, [bookingsDetailedData]);

  // Filter bookings with any Transport data (hotel not required — CO/KAS may have Nosir routes but no hotels yet)
  const bookingsWithTransport = useMemo(() => {
    return bookingsDetailedData.filter(booking => {
      const e = booking.expenses || {};
      return (e.transportSevil || 0) + (e.transportXayrulla || 0) + (e.transportNosir || 0) > 0;
    });
  }, [bookingsDetailedData]);

  const tabGradients = {
    general:   { from: '#6366f1', to: '#8b5cf6', light: '#eef2ff' },
    hotels:    { from: '#7c3aed', to: '#a855f7', light: '#f5f3ff' },
    transport: { from: '#1d4ed8', to: '#3b82f6', light: '#eff6ff' },
    guides:    { from: '#047857', to: '#10b981', light: '#ecfdf5' },
  };
  const activeTabGrad = tabGradients[activeExpenseTab] || tabGradients.general;

  const GuideSummary = ({ data, formatNumber, selected, onSelect }) => {
    const guideTotals = {};
    data.forEach(item => {
      const e = item.expenses || {};
      if (e.guideMainName && e.guideMainCost > 0)
        guideTotals[e.guideMainName] = (guideTotals[e.guideMainName] || 0) + e.guideMainCost;
      if (e.guideSecondName && e.guideSecondCost > 0)
        guideTotals[e.guideSecondName] = (guideTotals[e.guideSecondName] || 0) + e.guideSecondCost;
      if (e.guideBergrName && e.guideBergrCost > 0)
        guideTotals[e.guideBergrName] = (guideTotals[e.guideBergrName] || 0) + e.guideBergrCost;
    });
    const entries = Object.entries(guideTotals).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) return null;
    return (
      <div className="mt-6 mb-2">
        <div className="flex items-center gap-2 mb-3 px-1">
          <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg,transparent,#6ee7b7,transparent)' }} />
          <span className="text-xs font-bold text-emerald-700 uppercase tracking-widest px-2">
            Gidlar bo'yicha jami
            {selected && <span className="ml-2 normal-case font-normal text-emerald-500">— {selected} filtrlangan</span>}
          </span>
          <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg,transparent,#6ee7b7,transparent)' }} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 px-1">
          {entries.map(([name, total]) => {
            const isActive = selected === name;
            return (
              <button key={name} onClick={() => onSelect(isActive ? null : name)}
                className="flex flex-col items-center rounded-xl px-3 py-3 w-full transition-all duration-150"
                style={{
                  background: isActive ? 'linear-gradient(135deg,#065f46,#059669)' : 'linear-gradient(135deg,#ecfdf5,#d1fae5)',
                  border: isActive ? '2px solid #059669' : '1px solid #6ee7b7',
                  boxShadow: isActive ? '0 4px 14px #05966944' : 'none',
                  transform: isActive ? 'translateY(-2px)' : 'none',
                }}>
                <span className="text-xs font-semibold text-center leading-tight mb-1.5 w-full"
                  style={{ color: isActive ? '#d1fae5' : '#065f46', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                <span className="text-base font-black" style={{ color: isActive ? '#ffffff' : '#064e3b' }}>${formatNumber(total)}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const EmptyState = ({ icon: Icon, label }) => (
    <div className="py-20 text-center">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-5"
        style={{ background: `linear-gradient(135deg, ${activeModule?.color}20, ${activeModule?.color}10)` }}>
        <Icon size={36} style={{ color: activeModule?.color }} />
      </div>
      <p className="text-gray-400 font-medium">{label}</p>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: '#f1f5f9' }}>

      {/* ═══ HERO HEADER ═══ */}
      <div className="relative overflow-hidden mx-3 mt-3" style={{
        background: 'linear-gradient(160deg, #14532d 0%, #166534 35%, #15803d 65%, #166534 100%)',
        borderRadius: '28px',
      }}>
        {/* Glow blobs */}
        <div className="absolute top-0 right-0 rounded-full pointer-events-none"
          style={{ width: '600px', height: '600px', background: activeModule?.color, opacity: 0.22, filter: 'blur(90px)', transform: 'translate(40%,-40%)' }} />
        <div className="absolute bottom-0 left-0 rounded-full pointer-events-none"
          style={{ width: '400px', height: '400px', background: '#10b981', opacity: 0.25, filter: 'blur(70px)', transform: 'translate(-30%,40%)' }} />
        {/* Shimmer */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 60% 80% at 50% 50%, rgba(255,255,255,0.06) 0%, transparent 70%)' }} />

        <div className="relative px-4 md:px-6 pt-5 md:pt-7 pb-5 md:pb-6">
          {/* Eyebrow */}
          <div className="flex items-center gap-2 mb-3 md:mb-5">
            <span className="text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
              style={{ background: `${activeModule?.color}35`, color: 'white', border: `1px solid ${activeModule?.color}60` }}>
              {activeModule?.code}
            </span>
            <span className="text-green-300 text-xs opacity-70">›</span>
            <span className="text-green-200 text-xs font-medium opacity-80">{activeModule?.name}</span>
          </div>

          {/* Title + Quick Totals */}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 md:gap-4 mb-4 md:mb-6">
            <div>
              <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-none" style={{ textShadow: '0 0 40px rgba(255,255,255,0.25)' }}>Ausgaben <span className="text-2xl md:text-4xl">{selectedYear}</span></h1>
              <p className="text-green-200 text-xs md:text-sm mt-1.5 md:mt-2 opacity-75">Barcha xarajatlar va to'lovlar tahlili</p>
            </div>
            {!loading && (
              <div className="flex flex-wrap items-center gap-3 md:gap-4">
                <div>
                  <p className="text-xs text-green-200 mb-0.5 uppercase tracking-wider opacity-70">Jami USD</p>
                  <p className="text-xl md:text-2xl font-black text-white">
                    ${formatNumber(filteredBookingsWithHotels.reduce((sum,b)=>{const e=b.expenses||{};return sum+(e.hotelsUSD||0)+(e.guide||0);},0))}
                  </p>
                </div>
                <div className="w-px h-8" style={{ background: 'rgba(255,255,255,0.2)' }} />
                <div>
                  <p className="text-xs text-green-200 mb-0.5 uppercase tracking-wider opacity-70">Jami UZS</p>
                  <p className="text-xl md:text-2xl font-black text-amber-400">
                    {formatNumber(filteredBookingsWithHotels.reduce((sum,b)=>{const e=b.expenses||{};return sum+(e.hotelsUZS||0)+(e.transportSevil||0)+(e.transportXayrulla||0)+(e.transportNosir||0)+(e.railway||0)+(e.flights||0)+(e.meals||0)+(e.eintritt||0)+(e.metro||0)+(e.shou||0)+(e.other||0);},0))}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button onClick={handleRefresh} disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)' }}
                    onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.25)'}
                    onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.15)'}>
                    {loading ? '⏳' : '🔄 Yangilash'}
                  </button>
                  {bookingsDetailedData.length > 0 && (
                    <>
                      <button onClick={exportToExcel} title="Excel yuklab olish"
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
                        style={{ background: 'rgba(22,163,74,0.35)', color: '#bbf7d0', border: '1px solid rgba(74,222,128,0.4)' }}
                        onMouseEnter={e=>e.currentTarget.style.background='rgba(22,163,74,0.55)'}
                        onMouseLeave={e=>e.currentTarget.style.background='rgba(22,163,74,0.35)'}>
                        <FileSpreadsheet size={13} /> Excel
                      </button>
                      <button onClick={exportToPDF} title="PDF yuklab olish"
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
                        style={{ background: 'rgba(220,38,38,0.35)', color: '#fecaca', border: '1px solid rgba(248,113,113,0.4)' }}
                        onMouseEnter={e=>e.currentTarget.style.background='rgba(220,38,38,0.55)'}
                        onMouseLeave={e=>e.currentTarget.style.background='rgba(220,38,38,0.35)'}>
                        <FileText size={13} /> PDF
                      </button>
                      <button onClick={sendToTelegram} disabled={sendingTelegram} title="Sirojga Telegram orqali yuborish"
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
                        style={{ background: 'rgba(37,99,235,0.35)', color: '#bfdbfe', border: '1px solid rgba(96,165,250,0.4)', opacity: sendingTelegram ? 0.6 : 1 }}
                        onMouseEnter={e=>{ if(!sendingTelegram) e.currentTarget.style.background='rgba(37,99,235,0.55)'; }}
                        onMouseLeave={e=>e.currentTarget.style.background='rgba(37,99,235,0.35)'}>
                        <Send size={13} /> {sendingTelegram ? '...' : 'TG'}
                      </button>
                    </>
                  )}
                  {lastUpdated && (
                    <p className="text-xs opacity-50 text-green-100 w-full">
                      {lastUpdated.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Tour Type Cards */}
          <div className="grid grid-cols-5 gap-2 md:gap-3">
            {tourTypeModules.map((module) => {
              const isActive = activeTourType === module.code;
              const isTotal = module.code === 'ALL';
              const activeBg = isTotal
                ? 'linear-gradient(135deg, #4b5563, #1f2937)'
                : `linear-gradient(135deg, ${module.color}, ${module.color}99)`;
              const activeColor = isTotal ? '#f9fafb' : 'white';
              const inactiveColor = isTotal ? 'rgba(255,255,255,0.55)' : module.color;
              return (
                <button
                  key={module.code}
                  onClick={() => { updateParams({ tour: module.code }); setSelectedGuide(null); }}
                  className="relative overflow-hidden rounded-xl md:rounded-2xl p-2 md:p-4 text-left transition-all duration-300 group"
                  style={{
                    background: isActive ? activeBg : 'rgba(255,255,255,0.1)',
                    border: `1px solid ${isActive ? (isTotal ? '#6b7280aa' : module.color + 'aa') : 'rgba(255,255,255,0.2)'}`,
                    boxShadow: isActive ? `0 0 35px ${isTotal ? '#6b728045' : module.color + '45'}, 0 8px 25px rgba(0,0,0,0.4)` : 'none',
                    transform: isActive ? 'translateY(-3px)' : 'none',
                  }}
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl"
                    style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 70%)' }} />
                  <div className="absolute top-[-15px] right-[-15px] w-20 h-20 rounded-full pointer-events-none"
                    style={{ background: 'white', opacity: isActive ? 0.12 : 0.03 }} />
                  <p className="text-base md:text-2xl font-black leading-none"
                    style={{ color: isActive ? activeColor : inactiveColor }}>
                    {isTotal ? 'ALL' : module.code}
                  </p>
                  <p className="text-xs mt-1 font-medium leading-tight hidden md:block"
                    style={{ color: isActive ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.28)' }}>
                    {module.name}
                  </p>
                  {isActive && <div className="absolute bottom-3 right-3 w-1.5 h-1.5 rounded-full bg-white opacity-70" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══ STATS + CONTENT ═══ */}
      <div style={{ background: '#f1f5f9' }} className="min-h-screen">
        <div className="px-3 md:px-6 py-4 md:py-6 pb-20 md:pb-8">

          {/* Main Content Card */}
          <div className="rounded-2xl overflow-hidden shadow-lg border border-white/40" style={{ background: 'white' }}>

            {/* Sub-tabs — Mobile: 3-col card grid */}
            <div className="sm:hidden grid grid-cols-3 gap-2 p-2" style={{ background: '#f0fdf4', borderBottom: '2px solid #bbf7d0' }}>
              {expenseTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeExpenseTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => updateParams({ tab: tab.id })}
                    className="flex flex-col items-center justify-center gap-1 py-2.5 px-1 rounded-xl text-xs font-semibold transition-all"
                    style={isActive ? {
                      background: 'linear-gradient(135deg, #16a34a, #15803d)',
                      color: 'white',
                      boxShadow: '0 2px 8px #16a34a44',
                    } : {
                      background: 'white',
                      color: '#374151',
                      border: '1px solid #d1fae5',
                    }}
                  >
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={isActive ? { background: 'rgba(255,255,255,0.2)' } : { background: '#d1fae5' }}>
                      <Icon size={15} color={isActive ? 'white' : '#059669'} />
                    </span>
                    <span className="text-center leading-tight">{tab.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Sub-tabs — Desktop: horizontal tab bar */}
            <div className="hidden sm:flex" style={{ background: '#f0fdf4', borderBottom: '2px solid #bbf7d0' }}>
              {expenseTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeExpenseTab === tab.id;
                const tg = tabGradients[tab.id];
                return (
                  <button
                    key={tab.id}
                    onClick={() => updateParams({ tab: tab.id })}
                    className="flex-1 flex items-center justify-center gap-2 py-4 text-sm font-semibold transition-all relative"
                    style={isActive ? {
                      background: 'linear-gradient(180deg, #dcfce7 0%, white 100%)',
                      color: '#15803d',
                      borderBottom: `3px solid #16a34a`,
                      marginBottom: '-2px',
                    } : {
                      color: '#4b5563',
                      borderBottom: '3px solid transparent',
                    }}
                  >
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                      style={isActive
                        ? { background: 'linear-gradient(135deg, #16a34a, #15803d)' }
                        : { background: '#d1fae5' }}>
                      <Icon size={14} color={isActive ? 'white' : '#059669'} />
                    </span>
                    {tab.name}
                  </button>
                );
              })}
            </div>

            {loading ? (
              <div className="py-24 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5"
                  style={{ background: `linear-gradient(135deg, ${activeModule?.color}20, ${activeModule?.color}10)` }}>
                  <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: `${activeModule?.color}40`, borderTopColor: activeModule?.color }} />
                </div>
                <p className="text-slate-400 font-medium">Ma'lumotlar yuklanmoqda...</p>
              </div>
            ) : (
              <>
                {/* ── GENERAL TAB ── */}
                {activeExpenseTab === 'general' && (
                  <div className="w-full">
                    {bookingsDetailedData.length === 0 ? (
                      <EmptyState icon={BarChart3} label={`${activeModule?.name} uchun ma'lumot yo'q`} />
                    ) : (
                      <>
                        {/* Mobile cards */}
                        <div className="sm:hidden px-3 py-2 flex flex-col gap-2">
                          {bookingsDetailedData
                            .filter(b => { const e = b.expenses||{}; return e.hotelsUSD>0||e.hotelsUZS>0; })
                            .map((booking, idx) => {
                              const e = booking.expenses || {};
                              const totalUSD = (e.hotelsUSD||0)+(e.guide||0);
                              const totalUZS = (e.hotelsUZS||0)+(e.transportSevil||0)+(e.transportXayrulla||0)+(e.transportNosir||0)+(e.railway||0)+(e.flights||0)+(e.meals||0)+(e.eintritt||0)+(e.metro||0)+(e.shou||0)+(e.other||0);
                              const rows = [
                                e.hotelsUSD>0 && ['🏨 Hotels USD', `$${formatNumber(e.hotelsUSD)}`],
                                e.hotelsUZS>0 && ['🏨 Hotels UZS', formatNumber(e.hotelsUZS)],
                                e.transportSevil>0 && ['🚌 Sevil', formatNumber(e.transportSevil)],
                                e.transportXayrulla>0 && ['🚌 Xayrulla', formatNumber(e.transportXayrulla)],
                                e.transportNosir>0 && ['🚌 Nosir', formatNumber(e.transportNosir)],
                                e.railway>0 && ['🚂 Train', formatNumber(e.railway)],
                                e.flights>0 && ['✈️ Flights', formatNumber(e.flights)],
                                e.guide>0 && ['👤 Guide', `$${formatNumber(e.guide)}`],
                                e.meals>0 && ['🍽 Meals', formatNumber(e.meals)],
                                e.eintritt>0 && ['🎫 Eintritt', formatNumber(e.eintritt)],
                                e.metro>0 && ['🚇 Metro', formatNumber(e.metro)],
                                e.shou>0 && ['🎭 Shou', formatNumber(e.shou)],
                                e.other>0 && ['Other', formatNumber(e.other)],
                              ].filter(Boolean);
                              const isOpen = openMobileCards.has(`gen_${booking.bookingId}`);
                              return (
                                <div key={booking.bookingId} className="rounded-xl overflow-hidden border border-green-100 bg-white" style={{ boxShadow: '0 1px 4px rgba(16,185,129,0.08)' }}>
                                  <div className="h-0.5 bg-gradient-to-r from-green-400 to-emerald-500" />
                                  <div className="px-3 py-2">
                                    <div className="flex items-center justify-between gap-2 cursor-pointer"
                                      onClick={() => toggleMobileCard(`gen_${booking.bookingId}`)}>
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="w-5 h-5 rounded-full bg-green-50 text-green-600 text-[10px] font-bold flex items-center justify-center shrink-0 border border-green-200">{idx+1}</span>
                                        <Link to={`/bookings/${booking.bookingId}`} className="font-bold text-blue-600 text-sm truncate" onClick={ev=>ev.stopPropagation()}>{booking.bookingName}</Link>
                                      </div>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        {totalUZS>0 && <span className="bg-amber-50 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-lg border border-amber-100">{formatNumber(totalUZS)}</span>}
                                        {totalUSD>0 && <span className="bg-green-50 text-green-700 text-[10px] font-bold px-1.5 py-0.5 rounded-lg border border-green-100">${formatNumber(totalUSD)}</span>}
                                        <span className="text-slate-400 text-[10px]">{isOpen ? '▲' : '▼'}</span>
                                      </div>
                                    </div>
                                    {isOpen && (
                                      <div className="mt-2 grid grid-cols-2 gap-1">
                                        {rows.map(([label, val]) => (
                                          <div key={label} className="bg-gray-50 rounded-lg px-2 py-1 border border-gray-100">
                                            <div className="text-[10px] text-gray-400 font-medium">{label}</div>
                                            <div className="text-xs font-bold text-gray-900">{val}</div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          <div className="rounded-xl px-3 py-2.5 flex justify-between font-bold" style={{ background: 'linear-gradient(90deg,#14532d,#166534)' }}>
                            <span className="text-[10px] text-white uppercase tracking-widest self-center">TOTAL</span>
                            <div className="flex gap-2 text-xs font-black text-white">
                              <span>{formatNumber(filteredBookingsWithHotels.reduce((sum,b)=>{const e=b.expenses||{};return sum+(e.hotelsUZS||0)+(e.transportSevil||0)+(e.transportXayrulla||0)+(e.transportNosir||0)+(e.railway||0)+(e.flights||0)+(e.meals||0)+(e.eintritt||0)+(e.metro||0)+(e.shou||0)+(e.other||0);},0))}</span>
                              <span>${formatNumber(filteredBookingsWithHotels.reduce((sum,b)=>{const e=b.expenses||{};return sum+(e.hotelsUSD||0)+(e.guide||0);},0))}</span>
                            </div>
                          </div>
                        </div>
                        {/* Desktop table */}
                        <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full table-fixed text-xs">
                          <colgroup>
                            <col style={{ width: '3%' }} />
                            <col style={{ width: '8%' }} />
                            <col style={{ width: '6%' }} />
                            <col style={{ width: '7%' }} />
                            <col style={{ width: '5%' }} />
                            <col style={{ width: '6%' }} />
                            <col style={{ width: '4%' }} />
                            <col style={{ width: '7%' }} />
                            <col style={{ width: '6%' }} />
                            <col style={{ width: '5%' }} />
                            <col style={{ width: '6%' }} />
                            <col style={{ width: '7%' }} />
                            <col style={{ width: '5%' }} />
                            <col style={{ width: '5%' }} />
                            <col style={{ width: '5%' }} />
                            <col style={{ width: '8%' }} />
                            <col style={{ width: '7%' }} />
                          </colgroup>
                          <thead>
                            <tr>
                              <th rowSpan="2" className="px-2 py-3.5 text-center font-bold text-slate-700 uppercase tracking-wider border-r border-blue-200" style={{ background: '#dbeafe' }}>#</th>
                              <th rowSpan="2" className="px-2 py-3.5 text-left font-bold text-slate-700 uppercase tracking-wider border-r border-blue-200" style={{ background: '#dbeafe' }}>Booking</th>
                              <th colSpan="2" className="px-2 py-2 text-center font-bold text-slate-700 uppercase tracking-wider border-r border-blue-200" style={{ background: '#bfdbfe' }}>🏨 Hotels</th>
                              <th colSpan="3" className="px-2 py-2 text-center font-bold text-slate-700 uppercase tracking-wider border-r border-blue-200" style={{ background: '#bfdbfe' }}>🚌 Transport</th>
                              <th rowSpan="2" className="px-2 py-3.5 text-center font-bold text-slate-700 uppercase tracking-wider border-r border-blue-200" style={{ background: '#dbeafe' }}>🚂 Train</th>
                              <th rowSpan="2" className="px-2 py-3.5 text-center font-bold text-slate-700 uppercase tracking-wider border-r border-blue-200" style={{ background: '#dbeafe' }}>✈️ Flights</th>
                              <th rowSpan="2" className="px-2 py-3.5 text-center font-bold text-slate-700 uppercase tracking-wider border-r border-blue-200" style={{ background: '#dbeafe' }}>👤 Guide</th>
                              <th rowSpan="2" className="px-2 py-3.5 text-center font-bold text-slate-700 uppercase tracking-wider border-r border-blue-200" style={{ background: '#dbeafe' }}>🍽 Meals</th>
                              <th rowSpan="2" className="px-2 py-3.5 text-center font-bold text-slate-700 uppercase tracking-wider border-r border-blue-200" style={{ background: '#dbeafe' }}>🎫 Eintritt</th>
                              <th rowSpan="2" className="px-2 py-3.5 text-center font-bold text-slate-700 uppercase tracking-wider border-r border-blue-200" style={{ background: '#dbeafe' }}>🚇 Metro</th>
                              <th rowSpan="2" className="px-2 py-3.5 text-center font-bold text-slate-700 uppercase tracking-wider border-r border-blue-200" style={{ background: '#dbeafe' }}>🎭 Shou</th>
                              <th rowSpan="2" className="px-2 py-3.5 text-center font-bold text-slate-700 uppercase tracking-wider border-r border-blue-200" style={{ background: '#dbeafe' }}>Other</th>
                              <th rowSpan="2" className="px-3 py-3.5 text-center font-bold text-white uppercase tracking-wider border-r border-amber-700" style={{ background: 'linear-gradient(180deg,#b45309,#d97706)' }}>Σ UZS</th>
                              <th rowSpan="2" className="px-3 py-3.5 text-center font-bold text-white uppercase tracking-wider" style={{ background: 'linear-gradient(180deg,#065f46,#059669)' }}>Σ USD</th>
                            </tr>
                            <tr>
                              <th className="px-3 py-2 text-center font-semibold text-slate-600 border-r border-blue-200" style={{ background: '#bfdbfe' }}>USD</th>
                              <th className="px-3 py-2 text-center font-semibold text-slate-600 border-r border-blue-200" style={{ background: '#bfdbfe' }}>UZS</th>
                              <th className="px-3 py-2 text-center font-semibold text-slate-600 border-r border-blue-200" style={{ background: '#bfdbfe' }}>Sevil</th>
                              <th className="px-3 py-2 text-center font-semibold text-slate-600 border-r border-blue-200" style={{ background: '#bfdbfe' }}>Xayrulla</th>
                              <th className="px-3 py-2 text-center font-semibold text-slate-600 border-r border-blue-200" style={{ background: '#bfdbfe' }}>Nosir</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bookingsDetailedData
                              .filter(b => { const e = b.expenses||{}; return e.hotelsUSD>0||e.hotelsUZS>0; })
                              .map((booking, idx) => {
                                const e = booking.expenses || {};
                                const totalUZS = (e.hotelsUZS||0)+(e.transportSevil||0)+(e.transportXayrulla||0)+(e.transportNosir||0)+(e.railway||0)+(e.flights||0)+(e.meals||0)+(e.eintritt||0)+(e.metro||0)+(e.shou||0)+(e.other||0);
                                const totalUSD = (e.hotelsUSD||0)+(e.guide||0);
                                const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
                                return (
                                  <tr key={idx} style={{ background: rowBg }}
                                    className="transition-colors duration-150 hover:bg-blue-50"
                                    onMouseEnter={e2 => e2.currentTarget.style.background='#eff6ff'}
                                    onMouseLeave={e2 => e2.currentTarget.style.background=rowBg}>
                                    <td className="px-2 py-2.5 text-center text-slate-400 border-r border-slate-100">{idx+1}</td>
                                    <td className="px-2 py-2.5 border-r border-slate-100 truncate">
                                      <Link to={`/bookings/${booking.bookingId}`} className="font-bold text-blue-600 hover:text-blue-800 hover:underline">{booking.bookingName}</Link>
                                    </td>
                                    <td className="px-2 py-2.5 text-center border-r border-slate-100">
                                      {e.hotelsUSD>0 ? <span className="font-semibold text-gray-800">${formatNumber(e.hotelsUSD)}</span> : <span className="text-slate-300">—</span>}
                                    </td>
                                    <td className="px-2 py-2.5 text-center border-r border-slate-100">
                                      {e.hotelsUZS>0 ? <span className="font-semibold text-gray-800">{formatNumber(e.hotelsUZS)}</span> : <span className="text-slate-300">—</span>}
                                    </td>
                                    <td className="px-2 py-2.5 text-center border-r border-slate-100">
                                      {e.transportSevil>0 ? <span className="font-semibold text-gray-800">{formatNumber(e.transportSevil)}</span> : <span className="text-slate-300">—</span>}
                                    </td>
                                    <td className="px-2 py-2.5 text-center border-r border-slate-100">
                                      {e.transportXayrulla>0 ? <span className="font-semibold text-gray-800">{formatNumber(e.transportXayrulla)}</span> : <span className="text-slate-300">—</span>}
                                    </td>
                                    <td className="px-2 py-2.5 text-center border-r border-slate-100">
                                      {e.transportNosir>0 ? <span className="font-semibold text-gray-800">{formatNumber(e.transportNosir)}</span> : <span className="text-slate-300">—</span>}
                                    </td>
                                    <td className="px-2 py-2.5 text-center border-r border-slate-100">
                                      {e.railway>0 ? <span className="font-semibold text-gray-800">{formatNumber(e.railway)}</span> : <span className="text-slate-300">—</span>}
                                    </td>
                                    <td className="px-2 py-2.5 text-center border-r border-slate-100">
                                      {e.flights>0 ? <span className="font-semibold text-gray-800">{formatNumber(e.flights)}</span> : <span className="text-slate-300">—</span>}
                                    </td>
                                    <td className="px-2 py-2.5 text-center border-r border-slate-100">
                                      {e.guide>0 ? <span className="font-semibold text-gray-800">${formatNumber(e.guide)}</span> : <span className="text-slate-300">—</span>}
                                    </td>
                                    <td className="px-2 py-2.5 text-center border-r border-slate-100">
                                      {e.meals>0 ? <span className="font-semibold text-gray-800">{formatNumber(e.meals)}</span> : <span className="text-slate-300">—</span>}
                                    </td>
                                    <td className="px-2 py-2.5 text-center border-r border-slate-100">
                                      {e.eintritt>0 ? <span className="font-semibold text-gray-800">{formatNumber(e.eintritt)}</span> : <span className="text-slate-300">—</span>}
                                    </td>
                                    <td className="px-2 py-2.5 text-center border-r border-slate-100">
                                      {e.metro>0 ? <span className="font-semibold text-gray-800">{formatNumber(e.metro)}</span> : <span className="text-slate-300">—</span>}
                                    </td>
                                    <td className="px-2 py-2.5 text-center border-r border-slate-100">
                                      {e.shou>0 ? <span className="font-semibold text-gray-800">{formatNumber(e.shou)}</span> : <span className="text-slate-300">—</span>}
                                    </td>
                                    <td className="px-2 py-2.5 text-center border-r border-slate-100">
                                      {e.other>0 ? <span className="font-semibold text-gray-800">{formatNumber(e.other)}</span> : <span className="text-slate-300">—</span>}
                                    </td>
                                    <td className="px-2 py-2.5 text-center border-r border-slate-100">
                                      {totalUZS>0 ? <span className="font-black text-gray-900">{formatNumber(totalUZS)}</span> : <span className="text-slate-300">—</span>}
                                    </td>
                                    <td className="px-3 py-2.5 text-center">
                                      {totalUSD>0 ? <span className="font-black text-gray-900">${formatNumber(totalUSD)}</span> : <span className="text-slate-300">—</span>}
                                    </td>
                                  </tr>
                                );
                              })}
                            {/* TOTAL row */}
                            <tr style={{ background: 'linear-gradient(90deg,#14532d,#166534)', borderTop: '3px solid #15803d' }}>
                              <td className="px-2 py-3.5 border-r border-green-700"></td>
                              <td className="px-2 py-3.5 text-xs font-black text-white uppercase tracking-widest border-r border-green-700"
                                style={{ background: '#14532d' }}>TOTAL</td>
                              <td className="px-2 py-3.5 text-center text-xs font-black text-white border-r border-green-700">
                                ${formatNumber(filteredBookingsWithHotels.reduce((s,b)=>s+(b.expenses?.hotelsUSD||0),0))}
                              </td>
                              <td className="px-2 py-3.5 text-center text-xs font-black text-white border-r border-green-700">
                                {formatNumber(filteredBookingsWithHotels.reduce((s,b)=>s+(b.expenses?.hotelsUZS||0),0))}
                              </td>
                              <td className="px-2 py-3.5 text-center text-xs font-black text-white border-r border-green-700">
                                {formatNumber(filteredBookingsWithHotels.reduce((s,b)=>s+(b.expenses?.transportSevil||0),0))}
                              </td>
                              <td className="px-2 py-3.5 text-center text-xs font-black text-white border-r border-green-700">
                                {formatNumber(filteredBookingsWithHotels.reduce((s,b)=>s+(b.expenses?.transportXayrulla||0),0))}
                              </td>
                              <td className="px-2 py-3.5 text-center text-xs font-black text-white border-r border-green-700">
                                {formatNumber(filteredBookingsWithHotels.reduce((s,b)=>s+(b.expenses?.transportNosir||0),0))}
                              </td>
                              <td className="px-2 py-3.5 text-center text-xs font-black text-white border-r border-green-700">
                                {formatNumber(filteredBookingsWithHotels.reduce((s,b)=>s+(b.expenses?.railway||0),0))}
                              </td>
                              <td className="px-2 py-3.5 text-center text-xs font-black text-white border-r border-green-700">
                                {formatNumber(filteredBookingsWithHotels.reduce((s,b)=>s+(b.expenses?.flights||0),0))}
                              </td>
                              <td className="px-2 py-3.5 text-center text-xs font-black text-white border-r border-green-700">
                                ${formatNumber(filteredBookingsWithHotels.reduce((s,b)=>s+(b.expenses?.guide||0),0))}
                              </td>
                              <td className="px-2 py-3.5 text-center text-xs font-black text-white border-r border-green-700">
                                {formatNumber(filteredBookingsWithHotels.reduce((s,b)=>s+(b.expenses?.meals||0),0))}
                              </td>
                              <td className="px-2 py-3.5 text-center text-xs font-black text-white border-r border-green-700">
                                {formatNumber(filteredBookingsWithHotels.reduce((s,b)=>s+(b.expenses?.eintritt||0),0))}
                              </td>
                              <td className="px-2 py-3.5 text-center text-xs font-black text-white border-r border-green-700">
                                {formatNumber(filteredBookingsWithHotels.reduce((s,b)=>s+(b.expenses?.metro||0),0))}
                              </td>
                              <td className="px-2 py-3.5 text-center text-xs font-black text-white border-r border-green-700">
                                {formatNumber(filteredBookingsWithHotels.reduce((s,b)=>s+(b.expenses?.shou||0),0))}
                              </td>
                              <td className="px-2 py-3.5 text-center text-xs font-black text-white border-r border-green-700">
                                {formatNumber(filteredBookingsWithHotels.reduce((s,b)=>s+(b.expenses?.other||0),0))}
                              </td>
                              <td className="px-2 py-3.5 text-center text-xs font-black text-sky-900 border-r border-sky-300"
                                style={{ background: '#bae6fd' }}>
                                {formatNumber(filteredBookingsWithHotels.reduce((sum,b)=>{const e=b.expenses||{};return sum+(e.hotelsUZS||0)+(e.transportSevil||0)+(e.transportXayrulla||0)+(e.transportNosir||0)+(e.railway||0)+(e.flights||0)+(e.meals||0)+(e.eintritt||0)+(e.metro||0)+(e.shou||0)+(e.other||0);},0))}
                              </td>
                              <td className="px-3 py-3.5 text-center text-xs font-black text-sky-900"
                                style={{ background: '#bae6fd' }}>
                                ${formatNumber(filteredBookingsWithHotels.reduce((sum,b)=>{const e=b.expenses||{};return sum+(e.hotelsUSD||0)+(e.guide||0);},0))}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* ── HOTELS TAB ── */}
                {activeExpenseTab === 'hotels' && (
                  <div>
                    {bookingsDetailedData.length === 0 ? (
                      <EmptyState icon={Hotel} label={`${activeModule?.name} uchun mehmonxona ma'lumoti yo'q`} />
                    ) : (() => {
                      const pivotData = getPivotData();
                      return (<>
                        {/* Mobile cards */}
                        <div className="sm:hidden px-3 py-2 flex flex-col gap-2">
                          {pivotData.bookingRows.map((bookingRow, idx) => {
                            const isOpen = openMobileCards.has(`htl_${bookingRow.bookingId}`);
                            return (
                              <div key={bookingRow.bookingId} className="rounded-xl overflow-hidden border border-blue-100 bg-white" style={{ boxShadow: '0 1px 4px rgba(59,130,246,0.08)' }}>
                                <div className="h-0.5 bg-gradient-to-r from-blue-400 to-indigo-500" />
                                <div className="px-3 py-2">
                                  <div className="flex items-center justify-between gap-2 cursor-pointer"
                                    onClick={() => toggleMobileCard(`htl_${bookingRow.bookingId}`)}>
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold flex items-center justify-center shrink-0 border border-blue-200">{idx+1}</span>
                                      <Link to={`/bookings/${bookingRow.bookingId}`} className="font-bold text-blue-600 text-sm truncate" onClick={ev=>ev.stopPropagation()}>{bookingRow.bookingName}</Link>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {bookingRow.totalUZS>0 && <span className="bg-amber-50 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-lg border border-amber-100">{formatNumber(bookingRow.totalUZS)}</span>}
                                      {bookingRow.totalUSD>0 && <span className="bg-green-50 text-green-700 text-[10px] font-bold px-1.5 py-0.5 rounded-lg border border-green-100">${formatNumber(bookingRow.totalUSD)}</span>}
                                      <span className="text-slate-400 text-[10px]">{isOpen ? '▲' : '▼'}</span>
                                    </div>
                                  </div>
                                  {isOpen && (
                                    <div className="mt-2 flex flex-col gap-1">
                                      {pivotData.hotels.map(hotelName => {
                                        const hc = bookingRow.hotelCosts[hotelName];
                                        const uzs = hc?.uzs||0; const usd = hc?.usd||0;
                                        if (!uzs && !usd) return null;
                                        return (
                                          <div key={hotelName} className="bg-gray-50 rounded-lg px-2 py-1 border border-gray-100 flex justify-between">
                                            <span className="text-[10px] text-gray-500 truncate pr-2">🏨 {hotelName}</span>
                                            <span className="text-xs font-bold text-gray-900 shrink-0">{uzs>0 ? formatNumber(uzs) : `$${formatNumber(usd)}`}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          <div className="rounded-xl px-3 py-2.5 flex justify-between font-bold" style={{ background: 'linear-gradient(90deg,#14532d,#166534)' }}>
                            <span className="text-[10px] text-white uppercase tracking-widest self-center">TOTAL</span>
                            <div className="flex gap-2 text-xs font-black text-white">
                              <span>{formatNumber(getGrandTotalUZS())}</span>
                              <span>${formatNumber(getGrandTotalUSD())}</span>
                            </div>
                          </div>
                        </div>
                        {/* Desktop table */}
                        <div className="hidden sm:block overflow-x-auto">
                        <table className="min-w-full text-xs">
                          <thead>
                            <tr>
                              <th className="px-2 py-3.5 text-center font-bold text-slate-700 w-8 border-r border-blue-200"
                                style={{ background: '#dbeafe' }}>#</th>
                              <th className="px-3 py-3.5 text-left font-bold text-slate-700 sticky left-0 z-10 border-r border-blue-200"
                                style={{ background: '#dbeafe', minWidth: '110px' }}>Booking</th>
                              {pivotData.hotels.map((hotelName, idx) => (
                                <th key={idx} className="px-2 py-3.5 text-center font-bold text-slate-700 uppercase tracking-wider border-r border-blue-200"
                                  style={{ minWidth: '90px', background: '#dbeafe' }}>
                                  {hotelName}
                                </th>
                              ))}
                              <th className="px-3 py-3.5 text-center font-bold text-white uppercase tracking-wider border-r border-amber-700"
                                style={{ background: 'linear-gradient(180deg,#b45309,#d97706)', minWidth: '130px' }}>Σ UZS</th>
                              <th className="px-3 py-3.5 text-center font-bold text-white uppercase tracking-wider"
                                style={{ background: 'linear-gradient(180deg,#065f46,#059669)', minWidth: '100px' }}>Σ USD</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pivotData.bookingRows.map((bookingRow, bookingIdx) => {
                              const rowBg = bookingIdx % 2 === 0 ? '#ffffff' : '#f8fafc';
                              return (
                                <tr key={bookingIdx} style={{ background: rowBg }}
                                  onMouseEnter={e => e.currentTarget.style.background='#eff6ff'}
                                  onMouseLeave={e => e.currentTarget.style.background=rowBg}>
                                  <td className="px-2 py-2.5 text-center text-slate-400 border-r border-slate-100">{bookingIdx+1}</td>
                                  <td className="px-3 py-2.5 sticky left-0 z-10 border-r border-slate-100" style={{ background: rowBg }}>
                                    <Link to={`/bookings/${bookingRow.bookingId}`} className="font-bold text-blue-600 hover:text-blue-800 hover:underline">
                                      {bookingRow.bookingName}
                                    </Link>
                                  </td>
                                  {pivotData.hotels.map((hotelName, hotelIdx) => {
                                    const hc = bookingRow.hotelCosts[hotelName];
                                    const uzs = hc?.uzs||0; const usd = hc?.usd||0;
                                    const val = uzs>0 ? uzs : usd;
                                    const isUZS = uzs>0;
                                    return (
                                      <td key={hotelIdx} className="px-2 py-2.5 text-center border-r border-slate-100 whitespace-nowrap">
                                        {val>0
                                          ? <span className="font-semibold text-gray-800">{isUZS ? formatNumber(val) : `$${formatNumber(val)}`}</span>
                                          : <span className="text-slate-300">—</span>}
                                      </td>
                                    );
                                  })}
                                  <td className="px-3 py-2.5 text-center border-r border-slate-100 whitespace-nowrap">
                                    <span className="font-black text-gray-800">{formatNumber(bookingRow.totalUZS)}</span>
                                  </td>
                                  <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                    <span className="font-black text-gray-800">${formatNumber(bookingRow.totalUSD)}</span>
                                  </td>
                                </tr>
                              );
                            })}
                            <tr style={{ background: '#dcfce7', borderTop: '2px solid #86efac' }}>
                              <td className="px-2 py-3.5 border-r border-green-200"></td>
                              <td className="px-3 py-3.5 text-xs font-black text-green-800 uppercase tracking-widest sticky left-0 z-10 border-r border-green-200"
                                style={{ background: '#dcfce7' }}>TOTAL</td>
                              {pivotData.hotels.map((hotelName, hotelIdx) => {
                                const usd = getHotelGrandTotal(hotelName,'usd');
                                const uzs = getHotelGrandTotal(hotelName,'uzs');
                                const val = uzs>0 ? uzs : usd;
                                const isUZS = uzs>0;
                                return (
                                  <td key={hotelIdx} className="px-2 py-3.5 text-center border-r border-green-200 whitespace-nowrap">
                                    <span className="font-black text-xs text-green-900">
                                      {isUZS ? formatNumber(val) : `$${formatNumber(val)}`}
                                    </span>
                                  </td>
                                );
                              })}
                              <td className="px-3 py-3.5 text-center text-sm font-black text-sky-900 border-r border-sky-300 whitespace-nowrap"
                                style={{ background: '#bae6fd' }}>
                                {formatNumber(getGrandTotalUZS())}
                              </td>
                              <td className="px-3 py-3.5 text-center text-sm font-black text-sky-900 whitespace-nowrap"
                                style={{ background: '#bae6fd' }}>
                                ${formatNumber(getGrandTotalUSD())}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        </div>
                      </>);
                    })()}
                  </div>
                )}

                {/* ── HOTEL ANALYSIS TAB ── */}
                {activeExpenseTab === 'hotel-analysis' && (() => {
                  // Build: { hotelName: { city, months: { "2026-03": [{ bookingName, bookingId, USD, UZS, checkIn, checkOut, nights }] } } }
                  const hotelMap = {};
                  filteredBookingsWithHotels.forEach(booking => {
                    const breakdown = booking.grandTotalData?.hotelBreakdown || [];
                    breakdown.forEach(h => {
                      if (!h.hotel || (h.USD === 0 && h.UZS === 0)) return;
                      const name = normalizeHotel(h.hotel);
                      if (!hotelMap[name]) hotelMap[name] = { city: h.city, months: {} };
                      const dateKey = h.checkOutDate
                        ? new Date(h.checkOutDate).toISOString().slice(0, 7) // "2026-03"
                        : 'unknown';
                      if (!hotelMap[name].months[dateKey]) hotelMap[name].months[dateKey] = [];
                      hotelMap[name].months[dateKey].push({
                        bookingId: booking.bookingId,
                        bookingName: booking.bookingName,
                        accommodationId: h.accommodationId,
                        USD: h.USD || 0,
                        UZS: h.UZS || 0,
                        checkIn: h.checkInDate,
                        checkOut: h.checkOutDate,
                      });
                    });
                  });

                  const hotelNames = Object.keys(hotelMap).sort();

                  const fmtShort = (d) => {
                    if (!d) return '—';
                    const dt = new Date(d);
                    return dt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                  };
                  const monthLabel = (key) => {
                    if (key === 'unknown') return 'Sana noma\'lum';
                    const [y, m] = key.split('-');
                    const names = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];
                    return `${names[parseInt(m)-1]} ${y}`;
                  };

                  if (hotelNames.length === 0) return (
                    <EmptyState icon={Hotel} label={`${activeModule?.name} uchun mehmonxona ma'lumoti yo'q`} />
                  );

                  return (
                    <div className="w-full space-y-2">
                      {hotelNames.map(hotelName => {
                        const hotel = hotelMap[hotelName];
                        const sortedMonths = Object.keys(hotel.months).sort();
                        const allRows = sortedMonths.flatMap(mk => hotel.months[mk]);
                        const hotelTotalUSD = allRows.reduce((s, b) => s + b.USD, 0);
                        const hotelTotalUZS = allRows.reduce((s, b) => s + b.UZS, 0);
                        const paidUSD = allRows.filter(b => paidAccs[String(b.accommodationId)]).reduce((s, b) => s + b.USD, 0);
                        const paidUZS = allRows.filter(b => paidAccs[String(b.accommodationId)]).reduce((s, b) => s + b.UZS, 0);
                        const debtUSD = hotelTotalUSD - paidUSD;
                        const debtUZS = hotelTotalUZS - paidUZS;
                        const hotelOpen = openHotels.has(hotelName);

                        return (
                          <div key={hotelName} className="rounded-xl overflow-hidden" style={{ border: '1px solid #e2e8f0' }}>
                            {/* Hotel header — clickable */}
                            <button className="w-full flex items-center justify-between px-4 py-3 text-left"
                              style={{ background: hotelOpen ? 'linear-gradient(135deg,#1e3a8a,#1d4ed8)' : 'linear-gradient(135deg,#1e40af,#2563eb)' }}
                              onClick={() => toggleHotel(hotelName)}>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-white font-bold text-sm">🏨 {hotelName}</span>
                                {hotel.city && <span className="text-blue-200 text-xs">— {hotel.city}</span>}
                                <span className="text-blue-300 text-xs ml-1">({sortedMonths.length} oy)</span>
                                {(paidUZS > 0 || paidUSD > 0) && (
                                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ background: '#16a34a22', color: '#86efac' }}>
                                    ✓ {paidUZS > 0 ? `${formatNumber(paidUZS)} UZS` : `$${formatNumber(paidUSD)}`}
                                  </span>
                                )}
                                {(debtUZS > 0 || debtUSD > 0) && (
                                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ background: '#ef444422', color: '#fca5a5' }}>
                                    ✗ {debtUZS > 0 ? `${formatNumber(debtUZS)} UZS` : `$${formatNumber(debtUSD)}`}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                {hotelTotalUZS > 0 && <span className="text-amber-300 text-xs font-bold">{formatNumber(hotelTotalUZS)} UZS</span>}
                                {hotelTotalUSD > 0 && <span className="text-green-300 text-xs font-bold">${formatNumber(hotelTotalUSD)}</span>}
                                <span className="text-white text-xs ml-1">{hotelOpen ? '▲' : '▼'}</span>
                              </div>
                            </button>

                            {/* Months — visible only when hotel is open */}
                            {hotelOpen && sortedMonths.map(mk => {
                              const rows = hotel.months[mk];
                              const mTotalUSD = rows.reduce((s, b) => s + b.USD, 0);
                              const mTotalUZS = rows.reduce((s, b) => s + b.UZS, 0);
                              const mPaidUSD = rows.filter(b => paidAccs[String(b.accommodationId)]).reduce((s, b) => s + b.USD, 0);
                              const mPaidUZS = rows.filter(b => paidAccs[String(b.accommodationId)]).reduce((s, b) => s + b.UZS, 0);
                              const mDebtUSD = mTotalUSD - mPaidUSD;
                              const mDebtUZS = mTotalUZS - mPaidUZS;
                              const monthKey = `${hotelName}__${mk}`;
                              const monthOpen = openMonths.has(monthKey);

                              return (
                                <div key={mk}>
                                  {/* Month row — clickable */}
                                  <button className="w-full flex items-center justify-between px-4 py-2.5 text-left"
                                    style={{ background: monthOpen ? '#bfdbfe' : '#dbeafe', borderTop: '1px solid #bfdbfe' }}
                                    onClick={() => toggleMonth(monthKey)}>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs font-bold text-blue-800 uppercase tracking-wide">
                                        📅 {monthLabel(mk)}
                                      </span>
                                      <span className="text-blue-500 text-xs normal-case">{rows.length} gruppa</span>
                                      {(mPaidUZS > 0 || mPaidUSD > 0) && (
                                        <span className="text-xs font-semibold text-green-700">
                                          ✓ {mPaidUZS > 0 ? `${formatNumber(mPaidUZS)} UZS` : `$${formatNumber(mPaidUSD)}`}
                                        </span>
                                      )}
                                      {(mDebtUZS > 0 || mDebtUSD > 0) && (
                                        <span className="text-xs font-semibold text-red-500">
                                          ✗ {mDebtUZS > 0 ? `${formatNumber(mDebtUZS)} UZS` : `$${formatNumber(mDebtUSD)}`}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3">
                                      {mTotalUZS > 0 && <span className="text-xs font-bold text-amber-700">{formatNumber(mTotalUZS)} UZS</span>}
                                      {mTotalUSD > 0 && <span className="text-xs font-bold text-green-700">${formatNumber(mTotalUSD)}</span>}
                                      <span className="text-blue-500 text-xs">{monthOpen ? '▲' : '▼'}</span>
                                    </div>
                                  </button>

                                  {/* Booking rows — visible only when month is open */}
                                  {monthOpen && rows.map((b, i) => {
                                    const isPaid = !!paidAccs[String(b.accommodationId)];
                                    return (
                                      <div key={i} className="flex items-center justify-between px-4 py-2.5 text-xs"
                                        style={{ background: isPaid ? '#f0fdf4' : (i % 2 === 0 ? '#ffffff' : '#f8fafc'), borderTop: '1px solid #f1f5f9' }}>
                                        <div className="flex items-center gap-3">
                                          {/* Checkbox */}
                                          <button
                                            onClick={(e) => togglePaid(e, b.accommodationId)}
                                            title={isPaid ? 'To\'landi — bekor qilish' : 'To\'landi deb belgilash'}
                                            className="w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all"
                                            style={{
                                              background: isPaid ? '#16a34a' : 'white',
                                              borderColor: isPaid ? '#16a34a' : '#cbd5e1',
                                            }}>
                                            {isPaid && <span className="text-white font-bold" style={{ fontSize: 10 }}>✓</span>}
                                          </button>
                                          <Link to={`/bookings/${b.bookingId}`}
                                            className="font-bold text-blue-600 hover:underline w-16 shrink-0">{b.bookingName}</Link>
                                          <span className="text-slate-400">{fmtShort(b.checkIn)} → {fmtShort(b.checkOut)}</span>
                                          {isPaid && <span className="text-green-600 font-semibold">To'landi</span>}
                                        </div>
                                        <div className="font-semibold" style={{ color: isPaid ? '#16a34a' : '#334155' }}>
                                          {b.UZS > 0 ? <span>{formatNumber(b.UZS)} UZS</span> : <span>${formatNumber(b.USD)}</span>}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}

                      {/* ── TOTAL FOOTER ── */}
                      {(() => {
                        const allHotelRows = Object.values(hotelMap).flatMap(h =>
                          Object.values(h.months).flat()
                        );
                        const grandUZS = allHotelRows.reduce((s, r) => s + r.UZS, 0);
                        const grandUSD = allHotelRows.reduce((s, r) => s + r.USD, 0);
                        const paidUZS  = allHotelRows.filter(r => paidAccs[String(r.accommodationId)]).reduce((s, r) => s + r.UZS, 0);
                        const paidUSD  = allHotelRows.filter(r => paidAccs[String(r.accommodationId)]).reduce((s, r) => s + r.USD, 0);
                        const debtUZS  = grandUZS - paidUZS;
                        const debtUSD  = grandUSD - paidUSD;
                        return (
                          <div className="rounded-xl overflow-hidden mt-2" style={{ border: '2px solid #1e3a8a' }}>
                            <div className="grid grid-cols-3 text-xs font-bold text-center"
                              style={{ background: 'linear-gradient(135deg,#0f172a,#1e3a8a)' }}>
                              <div className="px-4 py-3 flex flex-col gap-0.5">
                                <span className="text-slate-400 uppercase tracking-widest text-[10px]">JAMI</span>
                                {grandUZS > 0 && <span className="text-white text-sm">{formatNumber(grandUZS)} UZS</span>}
                                {grandUSD > 0 && <span className="text-yellow-300 text-sm">${formatNumber(grandUSD)}</span>}
                              </div>
                              <div className="px-4 py-3 flex flex-col gap-0.5 border-x border-blue-700">
                                <span className="text-slate-400 uppercase tracking-widest text-[10px]">TO'LANDI</span>
                                {paidUZS > 0 ? <span className="text-green-400 text-sm">{formatNumber(paidUZS)} UZS</span> : <span className="text-slate-600 text-sm">—</span>}
                                {paidUSD > 0 ? <span className="text-green-300 text-sm">${formatNumber(paidUSD)}</span> : null}
                              </div>
                              <div className="px-4 py-3 flex flex-col gap-0.5">
                                <span className="text-slate-400 uppercase tracking-widest text-[10px]">QARZ</span>
                                {debtUZS > 0 ? <span className="text-red-400 text-sm">{formatNumber(debtUZS)} UZS</span> : <span className="text-slate-600 text-sm">—</span>}
                                {debtUSD > 0 ? <span className="text-red-300 text-sm">${formatNumber(debtUSD)}</span> : null}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}

                {/* ── GUIDES TAB ── */}
                {activeExpenseTab === 'guides' && (
                  <div className="w-full">
                    {bookingsDetailedData.length === 0 ? (
                      <EmptyState icon={Users} label={`${activeModule?.name} uchun gid ma'lumoti yo'q`} />
                    ) : (<>
                      {/* Mobile cards */}
                      <div className="sm:hidden px-3 py-2 flex flex-col gap-2">
                        {filteredBookingsWithHotels.filter(item => {
                          if (!selectedGuide) return true;
                          const e = item.expenses || {};
                          return e.guideMainName === selectedGuide || e.guideSecondName === selectedGuide || e.guideBergrName === selectedGuide;
                        }).map((item, idx) => {
                          const e = item.expenses || {};
                          const total = (e.guideMainCost||0)+(e.guideSecondCost||0)+(e.guideBergrCost||0);
                          const isOpen = openMobileCards.has(`gd_${item.bookingId}`);
                          return (
                            <div key={item.bookingId} className="rounded-xl overflow-hidden border border-emerald-100 bg-white" style={{ boxShadow: '0 1px 4px rgba(16,185,129,0.08)' }}>
                              <div className="h-0.5 bg-gradient-to-r from-emerald-400 to-teal-500" />
                              <div className="px-3 py-2">
                                <div className="flex items-center justify-between gap-2 cursor-pointer"
                                  onClick={() => toggleMobileCard(`gd_${item.bookingId}`)}>
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold flex items-center justify-center shrink-0 border border-emerald-200">{idx+1}</span>
                                    <Link to={`/bookings/${item.bookingId}`} className="font-bold text-blue-600 text-sm truncate" onClick={ev=>ev.stopPropagation()}>{item.bookingName}</Link>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="bg-green-50 text-green-700 text-[10px] font-bold px-1.5 py-0.5 rounded-lg border border-green-100">${formatNumber(total)}</span>
                                    <span className="text-slate-400 text-[10px]">{isOpen ? '▲' : '▼'}</span>
                                  </div>
                                </div>
                                {isOpen && (
                                  <div className="mt-2 flex flex-col gap-1">
                                    {e.guideMainName && (
                                      <div className="bg-gray-50 rounded-lg px-2 py-1 border border-gray-100 flex justify-between">
                                        <span className="text-[10px] text-gray-500 truncate pr-2">👤 {e.guideMainName}</span>
                                        {e.guideMainCost>0 && <span className="text-xs font-bold text-gray-900 shrink-0">${formatNumber(e.guideMainCost)}</span>}
                                      </div>
                                    )}
                                    {e.guideSecondName && (
                                      <div className="bg-gray-50 rounded-lg px-2 py-1 border border-gray-100 flex justify-between">
                                        <span className="text-[10px] text-gray-500 truncate pr-2">👤 {e.guideSecondName}</span>
                                        {e.guideSecondCost>0 && <span className="text-xs font-bold text-gray-900 shrink-0">${formatNumber(e.guideSecondCost)}</span>}
                                      </div>
                                    )}
                                    {e.guideBergrName && (
                                      <div className="bg-gray-50 rounded-lg px-2 py-1 border border-gray-100 flex justify-between">
                                        <span className="text-[10px] text-gray-500 truncate pr-2">🏔 {e.guideBergrName}</span>
                                        {e.guideBergrCost>0 && <span className="text-xs font-bold text-gray-900 shrink-0">${formatNumber(e.guideBergrCost)}</span>}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        <div className="rounded-xl px-3 py-2.5 flex justify-between font-bold" style={{ background: 'linear-gradient(90deg,#14532d,#166534)' }}>
                          <span className="text-[10px] text-white uppercase tracking-widest self-center">TOTAL</span>
                          <span className="font-black text-white text-xs">${formatNumber(filteredBookingsWithHotels.reduce((s,i)=>s+(i.expenses?.guide||0),0))}</span>
                        </div>
                      </div>
                      {/* Desktop table */}
                      <div className="hidden sm:block">
                      <table className="w-full table-fixed text-xs">
                        <colgroup>
                          <col style={{ width: '4%' }} />
                          <col style={{ width: '11%' }} />
                          <col style={{ width: '15%' }} />
                          <col style={{ width: '9%' }} />
                          <col style={{ width: '15%' }} />
                          <col style={{ width: '9%' }} />
                          <col style={{ width: '15%' }} />
                          <col style={{ width: '9%' }} />
                          <col style={{ width: '13%' }} />
                        </colgroup>
                        <thead>
                          <tr>
                            <th className="px-3 py-3.5 text-center font-bold text-slate-700 border-r border-blue-200"
                              style={{ background: '#dbeafe' }}>#</th>
                            <th className="px-3 py-3.5 text-left font-bold text-slate-700 border-r border-blue-200"
                              style={{ background: '#dbeafe' }}>Booking</th>
                            <th className="px-3 py-3.5 text-left font-bold text-slate-700 border-r border-blue-200"
                              style={{ background: '#dbeafe' }}>Main Guide</th>
                            <th className="px-3 py-3.5 text-center font-bold text-slate-700 border-r border-blue-200"
                              style={{ background: '#dbeafe' }}>Price</th>
                            <th className="px-3 py-3.5 text-left font-bold text-slate-700 border-r border-blue-200"
                              style={{ background: '#dbeafe' }}>Second Guide</th>
                            <th className="px-3 py-3.5 text-center font-bold text-slate-700 border-r border-blue-200"
                              style={{ background: '#dbeafe' }}>Price</th>
                            <th className="px-3 py-3.5 text-left font-bold text-slate-700 border-r border-blue-200"
                              style={{ background: '#dbeafe' }}>Bergreiseleiter</th>
                            <th className="px-3 py-3.5 text-center font-bold text-slate-700 border-r border-blue-200"
                              style={{ background: '#dbeafe' }}>Price</th>
                            <th className="px-3 py-3.5 text-center font-bold text-white"
                              style={{ background: 'linear-gradient(180deg,#065f46,#059669)' }}>Total (USD)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredBookingsWithHotels.filter(item => {
                            if (!selectedGuide) return true;
                            const e = item.expenses || {};
                            return e.guideMainName === selectedGuide || e.guideSecondName === selectedGuide || e.guideBergrName === selectedGuide;
                          }).map((item, idx) => {
                            const e = item.expenses || {};
                            const total = (e.guideMainCost||0)+(e.guideSecondCost||0)+(e.guideBergrCost||0);
                            const rowBg = idx%2===0 ? '#ffffff' : '#f8fafc';
                            return (
                              <tr key={item.bookingId} style={{ background: rowBg }}
                                onMouseEnter={ev => ev.currentTarget.style.background='#ecfdf5'}
                                onMouseLeave={ev => ev.currentTarget.style.background=rowBg}>
                                <td className="px-3 py-2.5 text-center text-slate-400 border-r border-slate-100">{idx+1}</td>
                                <td className="px-3 py-2.5 border-r border-slate-100 truncate">
                                  <Link to={`/bookings/${item.bookingId}`} className="font-bold text-blue-600 hover:text-blue-800 hover:underline">{item.bookingName}</Link>
                                </td>
                                <td className="px-3 py-2.5 text-slate-700 font-medium border-r border-slate-100 truncate">{e.guideMainName||'—'}</td>
                                <td className="px-2 py-2.5 text-center border-r border-slate-100">
                                  {e.guideMainCost>0 ? <span className="font-semibold text-gray-800">${formatNumber(e.guideMainCost)}</span> : <span className="text-slate-200">—</span>}
                                </td>
                                <td className="px-3 py-2.5 text-slate-700 font-medium border-r border-slate-100 truncate">{e.guideSecondName||'—'}</td>
                                <td className="px-2 py-2.5 text-center border-r border-slate-100">
                                  {e.guideSecondCost>0 ? <span className="font-semibold text-gray-800">${formatNumber(e.guideSecondCost)}</span> : <span className="text-slate-200">—</span>}
                                </td>
                                <td className="px-3 py-2.5 text-slate-700 font-medium border-r border-slate-100 truncate">{e.guideBergrName||'—'}</td>
                                <td className="px-2 py-2.5 text-center border-r border-slate-100">
                                  {e.guideBergrCost>0 ? <span className="font-semibold text-gray-800">${formatNumber(e.guideBergrCost)}</span> : <span className="text-slate-200">—</span>}
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  {total>0 ? <span className="font-black text-gray-900">${formatNumber(total)}</span> : <span className="text-slate-200">—</span>}
                                </td>
                              </tr>
                            );
                          })}
                          <tr style={{ background: '#dcfce7', borderTop: '2px solid #86efac' }}>
                            <td className="px-4 py-3.5 border-r border-green-200" colSpan={2}></td>
                            <td className="px-4 py-3.5 border-r border-green-200"></td>
                            <td className="px-4 py-3.5 text-center text-xs font-black text-green-900 border-r border-green-200">
                              ${formatNumber(filteredBookingsWithHotels.reduce((s,i)=>s+(i.expenses?.guideMainCost||0),0))}
                            </td>
                            <td className="px-4 py-3.5 border-r border-green-200"></td>
                            <td className="px-4 py-3.5 text-center text-xs font-black text-green-900 border-r border-green-200">
                              ${formatNumber(filteredBookingsWithHotels.reduce((s,i)=>s+(i.expenses?.guideSecondCost||0),0))}
                            </td>
                            <td className="px-4 py-3.5 border-r border-green-200"></td>
                            <td className="px-4 py-3.5 text-center text-xs font-black text-green-900 border-r border-green-200">
                              ${formatNumber(filteredBookingsWithHotels.reduce((s,i)=>s+(i.expenses?.guideBergrCost||0),0))}
                            </td>
                            <td className="px-4 py-3.5 text-center text-xs font-black text-green-900">
                              ${formatNumber(filteredBookingsWithHotels.reduce((s,i)=>s+(i.expenses?.guide||0),0))}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      </div>
                    </>)}

                    {/* ── Per-guide earnings summary ── */}
                    <GuideSummary data={filteredBookingsWithHotels} formatNumber={formatNumber} selected={selectedGuide} onSelect={setSelectedGuide} />
                  </div>
                )}

                {/* ── ÜBERWEISUNG TAB ── */}
                {activeExpenseTab === 'uberweisung' && (
                  <div className="w-full">
                    {bookingsDetailedData.length === 0 ? (
                      <EmptyState icon={DollarSign} label="Überweisung ma'lumoti yo'q" />
                    ) : (
                      <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr>
                              <th className="px-3 py-3.5 text-center font-bold text-slate-700 border-r border-purple-200" style={{ background: '#f3e8ff' }}>#</th>
                              <th className="px-3 py-3.5 text-left font-bold text-slate-700 border-r border-purple-200" style={{ background: '#f3e8ff' }}>Booking</th>
                              <th className="px-3 py-3.5 text-right font-bold text-slate-700 border-r border-purple-200" style={{ background: '#f3e8ff' }}>Eintritt (UZS)</th>
                              <th className="px-3 py-3.5 text-right font-bold text-slate-700 border-r border-purple-200" style={{ background: '#f3e8ff' }}>Folklore (UZS)</th>
                              <th className="px-3 py-3.5 text-right font-bold text-slate-700 border-r border-purple-200" style={{ background: '#f3e8ff' }}>Railway (UZS)</th>
                              <th className="px-3 py-3.5 text-right font-bold text-white" style={{ background: 'linear-gradient(180deg,#6d28d9,#7c3aed)' }}>Total UZS</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bookingsDetailedData.map((item, idx) => {
                              const e = item.expenses || {};
                              const rowBg = idx % 2 === 0 ? '#ffffff' : '#faf5ff';
                              return (
                                <tr key={item.bookingId} style={{ background: rowBg }}
                                  onMouseEnter={ev => ev.currentTarget.style.background = '#ede9fe'}
                                  onMouseLeave={ev => ev.currentTarget.style.background = rowBg}>
                                  <td className="px-3 py-2.5 text-center text-slate-400 border-r border-slate-100">{idx + 1}</td>
                                  <td className="px-3 py-2.5 border-r border-slate-100">
                                    <Link to={`/bookings/${item.bookingId}`} className="font-bold text-blue-600 hover:text-blue-800 hover:underline">{item.bookingName}</Link>
                                  </td>
                                  <td className="px-3 py-2.5 text-right border-r border-slate-100">
                                    {e.uberweisungEintritt > 0 ? <span className="font-semibold text-gray-800">{formatNumber(e.uberweisungEintritt)}</span> : <span className="text-slate-200">—</span>}
                                  </td>
                                  <td className="px-3 py-2.5 text-right border-r border-slate-100">
                                    {e.uberweisungFolklore > 0 ? <span className="font-semibold text-gray-800">{formatNumber(e.uberweisungFolklore)}</span> : <span className="text-slate-200">—</span>}
                                  </td>
                                  <td className="px-3 py-2.5 text-right border-r border-slate-100">
                                    {e.uberweisungRailway > 0 ? <span className="font-semibold text-gray-800">{formatNumber(e.uberweisungRailway)}</span> : <span className="text-slate-200">—</span>}
                                  </td>
                                  <td className="px-3 py-2.5 text-right">
                                    {e.uberweisungUZS > 0 ? <span className="font-black text-purple-700">{formatNumber(e.uberweisungUZS)}</span> : <span className="text-slate-200">—</span>}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr style={{ background: 'linear-gradient(90deg,#4c1d95,#5b21b6)' }}>
                              <td className="px-3 py-3.5 text-center text-white font-black text-xs" colSpan={2}>TOTAL</td>
                              <td className="px-3 py-3.5 text-right text-white font-bold text-xs border-r border-purple-400">{formatNumber(bookingsDetailedData.reduce((s,b)=>s+(b.expenses?.uberweisungEintritt||0),0))}</td>
                              <td className="px-3 py-3.5 text-right text-white font-bold text-xs border-r border-purple-400">{formatNumber(bookingsDetailedData.reduce((s,b)=>s+(b.expenses?.uberweisungFolklore||0),0))}</td>
                              <td className="px-3 py-3.5 text-right text-white font-bold text-xs border-r border-purple-400">{formatNumber(bookingsDetailedData.reduce((s,b)=>s+(b.expenses?.uberweisungRailway||0),0))}</td>
                              <td className="px-3 py-3.5 text-right text-white font-black text-xs">{formatNumber(bookingsDetailedData.reduce((s,b)=>s+(b.expenses?.uberweisungUZS||0),0))}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* ── BANK TAB ── */}
                {activeExpenseTab === 'bank' && (() => {
                  const finalIds = new Set(bookings.filter(b => b.status === 'FINAL_CONFIRMED').map(b => b.id));
                  const bankData = bookingsDetailedData.filter(b => finalIds.has(b.bookingId));
                  return (
                    <div className="w-full">
                      {bankData.length === 0 ? (
                        <div className="p-10 text-center text-slate-400">
                          <Landmark className="w-12 h-12 mx-auto mb-3 opacity-30" />
                          <p>Final Confirmed gruppalar yo'q</p>
                        </div>
                      ) : (
                        <div className="hidden sm:block overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr>
                                <th className="px-3 py-3.5 text-center font-bold text-slate-700 border-r border-emerald-200" style={{ background: '#d1fae5' }}>#</th>
                                <th className="px-3 py-3.5 text-left font-bold text-slate-700 border-r border-emerald-200" style={{ background: '#d1fae5' }}>Booking</th>
                                <th className="px-3 py-3.5 text-right font-bold text-slate-700 border-r border-emerald-200" style={{ background: '#d1fae5' }}>Eintritt (UZS)</th>
                                <th className="px-3 py-3.5 text-right font-bold text-slate-700 border-r border-emerald-200" style={{ background: '#d1fae5' }}>Folklore (UZS)</th>
                                <th className="px-3 py-3.5 text-right font-bold text-slate-700 border-r border-emerald-200" style={{ background: '#d1fae5' }}>Railway (UZS)</th>
                                <th className="px-3 py-3.5 text-right font-bold text-white" style={{ background: 'linear-gradient(180deg,#059669,#10b981)' }}>Total UZS</th>
                              </tr>
                            </thead>
                            <tbody>
                              {bankData.map((item, idx) => {
                                const e = item.expenses || {};
                                const rowBg = idx % 2 === 0 ? '#ffffff' : '#f0fdf4';
                                return (
                                  <tr key={item.bookingId} style={{ background: rowBg }}
                                    onMouseEnter={ev => ev.currentTarget.style.background = '#dcfce7'}
                                    onMouseLeave={ev => ev.currentTarget.style.background = rowBg}>
                                    <td className="px-3 py-2.5 text-center text-slate-400 border-r border-slate-100">{idx + 1}</td>
                                    <td className="px-3 py-2.5 border-r border-slate-100">
                                      <Link to={`/bookings/${item.bookingId}`} className="font-bold text-blue-600 hover:text-blue-800 hover:underline">{item.bookingName}</Link>
                                    </td>
                                    <td className="px-3 py-2.5 text-right border-r border-slate-100">
                                      {e.uberweisungEintritt > 0 ? <span className="font-semibold text-gray-800">{formatNumber(e.uberweisungEintritt)}</span> : <span className="text-slate-200">—</span>}
                                    </td>
                                    <td className="px-3 py-2.5 text-right border-r border-slate-100">
                                      {e.uberweisungFolklore > 0 ? <span className="font-semibold text-gray-800">{formatNumber(e.uberweisungFolklore)}</span> : <span className="text-slate-200">—</span>}
                                    </td>
                                    <td className="px-3 py-2.5 text-right border-r border-slate-100">
                                      {e.uberweisungRailway > 0 ? <span className="font-semibold text-gray-800">{formatNumber(e.uberweisungRailway)}</span> : <span className="text-slate-200">—</span>}
                                    </td>
                                    <td className="px-3 py-2.5 text-right">
                                      {e.uberweisungUZS > 0 ? <span className="font-black text-emerald-700">{formatNumber(e.uberweisungUZS)}</span> : <span className="text-slate-200">—</span>}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr style={{ background: 'linear-gradient(90deg,#065f46,#047857)' }}>
                                <td className="px-3 py-3.5 text-center text-white font-black text-xs" colSpan={2}>TOTAL ({bankData.length} gruppa)</td>
                                <td className="px-3 py-3.5 text-right text-white font-bold text-xs border-r border-emerald-600">{formatNumber(bankData.reduce((s,b)=>s+(b.expenses?.uberweisungEintritt||0),0))}</td>
                                <td className="px-3 py-3.5 text-right text-white font-bold text-xs border-r border-emerald-600">{formatNumber(bankData.reduce((s,b)=>s+(b.expenses?.uberweisungFolklore||0),0))}</td>
                                <td className="px-3 py-3.5 text-right text-white font-bold text-xs border-r border-emerald-600">{formatNumber(bankData.reduce((s,b)=>s+(b.expenses?.uberweisungRailway||0),0))}</td>
                                <td className="px-3 py-3.5 text-right text-white font-black text-xs">{formatNumber(bankData.reduce((s,b)=>s+(b.expenses?.uberweisungUZS||0),0))}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* ── RAILWAYS TAB ── */}
                {activeExpenseTab === 'railways' && (() => {
                  const railwayBookings = bookingsDetailedData.filter(b => (b.railways?.length > 0) || (b.expenses?.railway || 0) > 0);
                  // Flatten to per-railway rows (skip 0-price entries)
                  const allRows = railwayBookings.flatMap(b =>
                    (b.railways || [])
                      .filter(r => (r.price || 0) > 0)
                      .map(r => ({ ...r, bookingId: b.bookingId, bookingName: b.bookingName }))
                  );
                  const grandTotal = allRows.reduce((s, r) => s + (r.price || 0), 0);
                  const paidTotal  = allRows.filter(r => r.paid).reduce((s, r) => s + (r.price || 0), 0);
                  const debtTotal  = grandTotal - paidTotal;
                  const totalPax   = allRows.reduce((s, r) => s + (r.pax || 0), 0);
                  return (
                    <div className="w-full">
                      {allRows.length === 0 ? (
                        <div className="p-10 text-center text-slate-400">
                          <Train className="w-12 h-12 mx-auto mb-3 opacity-30" />
                          <p>Railway ma'lumoti yo'q</p>
                        </div>
                      ) : (
                        <>
                          {/* Desktop table */}
                          <div className="hidden sm:block overflow-x-auto">
                            <table className="w-full text-xs table-fixed">
                              <colgroup>
                                <col style={{ width: '3%' }} />
                                <col style={{ width: '9%' }} />
                                <col style={{ width: '20%' }} />
                                <col style={{ width: '12%' }} />
                                <col style={{ width: '6%' }} />
                                <col style={{ width: '12%' }} />
                                <col style={{ width: '14%' }} />
                                <col style={{ width: '12%' }} />
                              </colgroup>
                              <thead>
                                <tr style={{ background: 'linear-gradient(135deg,#0f172a,#1e3a8a)' }}>
                                  <th className="px-3 py-3.5 text-center text-white font-bold">#</th>
                                  <th className="px-3 py-3.5 text-left text-white font-bold border-l border-blue-700">Booking</th>
                                  <th className="px-3 py-3.5 text-left text-white font-bold border-l border-blue-700">Yo'nalish</th>
                                  <th className="px-3 py-3.5 text-left text-white font-bold border-l border-blue-700">Poyezd</th>
                                  <th className="px-3 py-3.5 text-center text-white font-bold border-l border-blue-700">PAX</th>
                                  <th className="px-3 py-3.5 text-right text-white font-bold border-l border-blue-700">Bilet narxi</th>
                                  <th className="px-3 py-3.5 text-right text-white font-bold border-l border-blue-700">Summa (UZS)</th>
                                  <th className="px-3 py-3.5 text-center text-white font-bold border-l border-blue-700">To'landi</th>
                                </tr>
                              </thead>
                              <tbody>
                                {allRows.map((row, idx) => {
                                  const rowBg = idx % 2 === 0 ? '#f8fafc' : '#ffffff';
                                  return (
                                    <tr key={`${row.bookingId}_${row.id}`}
                                      style={{ background: row.paid ? '#f0fdf4' : rowBg }}
                                      onMouseEnter={ev => ev.currentTarget.style.background = '#eff6ff'}
                                      onMouseLeave={ev => ev.currentTarget.style.background = row.paid ? '#f0fdf4' : rowBg}>
                                      <td className="px-3 py-2.5 text-center text-slate-400 border-r border-slate-100">{idx + 1}</td>
                                      <td className="px-3 py-2.5 border-r border-slate-100">
                                        <Link to={`/bookings/${row.bookingId}?tab=rooming&subTab=railway`} className="font-bold text-blue-600 hover:underline">{row.bookingName}</Link>
                                      </td>
                                      <td className="px-3 py-2.5 border-r border-slate-100 text-slate-600">
                                        {row.departure && row.arrival ? `${row.departure} → ${row.arrival}` : row.route || row.name || '—'}
                                      </td>
                                      <td className="px-3 py-2.5 border-r border-slate-100">
                                        <span className="text-slate-700 font-medium">{row.trainName || row.trainNumber || '—'}</span>
                                      </td>
                                      <td className="px-3 py-2.5 text-center border-r border-slate-100">
                                        <span className="font-bold text-slate-700">{row.pax || '—'}</span>
                                      </td>
                                      <td className="px-3 py-2.5 text-right border-r border-slate-100 text-slate-600">
                                        {row.pax > 0 && row.price > 0 ? formatNumber(Math.round(row.price / row.pax)) : '—'}
                                      </td>
                                      <td className="px-3 py-2.5 text-right border-r border-slate-100">
                                        <span className={`font-bold ${row.paid ? 'text-green-700' : 'text-blue-800'}`}>{formatNumber(row.price || 0)}</span>
                                      </td>
                                      <td className="px-3 py-2.5 text-center">
                                        <button
                                          onClick={(e) => handleRailwayPaidToggle(e, row.bookingId, row.id, row.paid)}
                                          className={`px-3 py-1 rounded-xl text-[10px] font-bold border-2 transition-all ${row.paid ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm' : 'bg-white text-gray-400 border-gray-200 hover:border-emerald-300 hover:text-emerald-600'}`}
                                          title={row.paid ? "To'landi — bekor qilish" : "To'landi deb belgilash"}
                                        >
                                          {row.paid ? "✓ To'landi" : "To'lanmadi"}
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {/* Mobile cards */}
                          <div className="sm:hidden px-3 py-2 flex flex-col gap-2">
                            {allRows.map((row, idx) => (
                              <div key={`${row.bookingId}_${row.id}`} className="rounded-2xl overflow-hidden border-2 bg-white"
                                style={{ borderColor: row.paid ? '#86efac' : '#bfdbfe' }}>
                                <div className="h-1.5" style={{ background: row.paid ? 'linear-gradient(90deg,#16a34a,#22c55e)' : 'linear-gradient(90deg,#1e3a8a,#2563eb)' }} />
                                <div className="px-4 py-3 space-y-2">
                                  {/* Row 1: Booking name + Total */}
                                  <div className="flex items-center justify-between gap-2">
                                    <Link to={`/bookings/${row.bookingId}?tab=rooming&subTab=railway`}
                                      className="font-black text-blue-600 text-sm">{row.bookingName}</Link>
                                    <span className={`text-sm font-black whitespace-nowrap ${row.paid ? 'text-green-700' : 'text-blue-800'}`}>
                                      {formatNumber(row.price || 0)} UZS
                                    </span>
                                  </div>
                                  {/* Row 2: Route */}
                                  <div className="text-sm font-semibold text-slate-700">
                                    {row.departure && row.arrival ? `${row.departure} → ${row.arrival}` : row.route || '—'}
                                  </div>
                                  {/* Row 3: Train + PAX + per-ticket | To'landi button */}
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {(row.trainName || row.trainNumber) && (
                                        <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                                          {row.trainName || row.trainNumber}
                                        </span>
                                      )}
                                      {row.pax > 0 && (
                                        <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg">
                                          {row.pax} pax
                                        </span>
                                      )}
                                      {row.pax > 0 && row.price > 0 && (
                                        <span className="text-xs text-slate-400 whitespace-nowrap">
                                          {formatNumber(Math.round(row.price / row.pax))}/bilet
                                        </span>
                                      )}
                                    </div>
                                    <button onClick={(e) => handleRailwayPaidToggle(e, row.bookingId, row.id, row.paid)}
                                      className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all whitespace-nowrap ${row.paid ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm' : 'bg-white text-gray-400 border-gray-200'}`}>
                                      {row.paid ? "✓ To'landi" : "To'lanmadi"}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Total footer */}
                          <div className="rounded-xl overflow-hidden mt-2" style={{ border: '2px solid #1e3a8a' }}>
                            {/* Mobile: 2x2 grid */}
                            <div className="sm:hidden grid grid-cols-2 text-xs font-bold text-center"
                              style={{ background: 'linear-gradient(135deg,#0f172a,#1e3a8a)' }}>
                              <div className="px-3 py-3 flex flex-col gap-0.5 border-r border-b border-blue-700">
                                <span className="text-slate-400 uppercase tracking-widest text-[9px]">JAMI PAX</span>
                                <span className="text-sky-300 text-lg font-black">{totalPax > 0 ? totalPax : '—'}</span>
                              </div>
                              <div className="px-3 py-3 flex flex-col gap-0.5 border-b border-blue-700">
                                <span className="text-slate-400 uppercase tracking-widest text-[9px]">JAMI</span>
                                <span className="text-white text-sm whitespace-nowrap">{formatNumber(grandTotal)}</span>
                                <span className="text-slate-400 text-[9px]">UZS</span>
                              </div>
                              <div className="px-3 py-3 flex flex-col gap-0.5 border-r border-blue-700">
                                <span className="text-slate-400 uppercase tracking-widest text-[9px]">TO'LANDI</span>
                                {paidTotal > 0 ? <><span className="text-green-400 text-sm whitespace-nowrap">{formatNumber(paidTotal)}</span><span className="text-slate-400 text-[9px]">UZS</span></> : <span className="text-slate-600 text-sm">—</span>}
                              </div>
                              <div className="px-3 py-3 flex flex-col gap-0.5">
                                <span className="text-slate-400 uppercase tracking-widest text-[9px]">QARZ</span>
                                {debtTotal > 0 ? <><span className="text-red-400 text-sm whitespace-nowrap">{formatNumber(debtTotal)}</span><span className="text-slate-400 text-[9px]">UZS</span></> : <span className="text-green-400 text-xs">✓</span>}
                              </div>
                            </div>
                            {/* Desktop: 4 cols */}
                            <div className="hidden sm:grid grid-cols-4 text-xs font-bold text-center"
                              style={{ background: 'linear-gradient(135deg,#0f172a,#1e3a8a)' }}>
                              <div className="px-2 py-3 flex flex-col gap-0.5 border-r border-blue-700">
                                <span className="text-slate-400 uppercase tracking-widest text-[10px]">JAMI PAX</span>
                                <span className="text-sky-300 text-sm">{totalPax > 0 ? totalPax : '—'}</span>
                              </div>
                              <div className="px-2 py-3 flex flex-col gap-0.5 border-r border-blue-700">
                                <span className="text-slate-400 uppercase tracking-widest text-[10px]">JAMI</span>
                                <span className="text-white text-sm whitespace-nowrap">{formatNumber(grandTotal)} UZS</span>
                              </div>
                              <div className="px-2 py-3 flex flex-col gap-0.5 border-r border-blue-700">
                                <span className="text-slate-400 uppercase tracking-widest text-[10px]">TO'LANDI</span>
                                {paidTotal > 0 ? <span className="text-green-400 text-sm whitespace-nowrap">{formatNumber(paidTotal)} UZS</span> : <span className="text-slate-600 text-sm">—</span>}
                              </div>
                              <div className="px-2 py-3 flex flex-col gap-0.5">
                                <span className="text-slate-400 uppercase tracking-widest text-[10px]">QARZ</span>
                                {debtTotal > 0 ? <span className="text-red-400 text-sm whitespace-nowrap">{formatNumber(debtTotal)} UZS</span> : <span className="text-green-400 text-sm text-[10px]">✓ To'langan</span>}
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}

                {/* ── TRANSPORT TAB ── */}
                {activeExpenseTab === 'transport' && (
                  <div>
                    {bookingsDetailedData.length === 0 ? (
                      <EmptyState icon={Truck} label={`${activeModule?.name} uchun transport ma'lumoti yo'q`} />
                    ) : (<>
                        {/* Mobile cards */}
                        <div className="sm:hidden px-3 py-2 flex flex-col gap-2">
                          {filteredBookingsWithHotels.map((item, idx) => {
                            const sevil=item.expenses?.transportSevil||0;
                            const xayrulla=item.expenses?.transportXayrulla||0;
                            const nosir=item.expenses?.transportNosir||0;
                            const total=sevil+xayrulla+nosir;
                            const isOpen = openMobileCards.has(`tr_${item.bookingId}`);
                            return (
                              <div key={item.bookingId} className="rounded-xl overflow-hidden border border-indigo-100 bg-white" style={{ boxShadow: '0 1px 4px rgba(99,102,241,0.08)' }}>
                                <div className="h-0.5 bg-gradient-to-r from-indigo-400 to-blue-500" />
                                <div className="px-3 py-2">
                                  <div className="flex items-center justify-between gap-2 cursor-pointer"
                                    onClick={() => toggleMobileCard(`tr_${item.bookingId}`)}>
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-bold flex items-center justify-center shrink-0 border border-indigo-200">{idx+1}</span>
                                      <Link to={`/bookings/${item.bookingId}`} className="font-bold text-blue-600 text-sm truncate" onClick={ev=>ev.stopPropagation()}>{item.bookingName}</Link>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {total>0 && <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded-lg border border-indigo-100">{formatNumber(total)}</span>}
                                      <span className="text-slate-400 text-[10px]">{isOpen ? '▲' : '▼'}</span>
                                    </div>
                                  </div>
                                  {isOpen && (
                                    <div className="mt-2 grid grid-cols-3 gap-1">
                                      {sevil>0 && (
                                        <div className="bg-blue-50 rounded-lg px-2 py-1 border border-blue-100">
                                          <div className="text-[10px] text-blue-500 font-medium">🚌 Sevil</div>
                                          <div className="text-xs font-bold text-gray-900">{formatNumber(sevil)}</div>
                                        </div>
                                      )}
                                      {xayrulla>0 && (
                                        <div className="bg-green-50 rounded-lg px-2 py-1 border border-green-100">
                                          <div className="text-[10px] text-green-600 font-medium">🚌 Xayrulla</div>
                                          <div className="text-xs font-bold text-gray-900">{formatNumber(xayrulla)}</div>
                                        </div>
                                      )}
                                      {nosir>0 && (
                                        <div className="bg-purple-50 rounded-lg px-2 py-1 border border-purple-100">
                                          <div className="text-[10px] text-purple-500 font-medium">🚌 Nosir</div>
                                          <div className="text-xs font-bold text-gray-900">{formatNumber(nosir)}</div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          <div className="rounded-xl px-3 py-2.5 flex justify-between font-bold" style={{ background: 'linear-gradient(90deg,#14532d,#166534)' }}>
                            <span className="text-[10px] text-white uppercase tracking-widest self-center">TOTAL</span>
                            <span className="font-black text-white text-xs">{formatNumber(filteredBookingsWithHotels.reduce((s,i)=>s+(i.expenses?.transportSevil||0)+(i.expenses?.transportXayrulla||0)+(i.expenses?.transportNosir||0),0))}</span>
                          </div>
                        </div>
                        {/* Desktop table */}
                        <div className="hidden sm:block overflow-x-auto">
                        <table className="min-w-full text-xs">
                        <thead>
                          <tr>
                            <th className="px-4 py-3.5 text-center font-bold text-slate-700 w-12 border-r border-blue-200"
                              style={{ background: '#dbeafe' }}>#</th>
                            <th className="px-4 py-3.5 text-left font-bold text-slate-700 border-r border-blue-200"
                              style={{ background: '#dbeafe' }}>Booking</th>
                            <th className="px-4 py-3.5 text-center font-bold text-white border-r border-blue-700"
                              style={{ background: 'linear-gradient(180deg,#1e3a8a,#1d4ed8)' }}>🚌 Sevil</th>
                            <th className="px-4 py-3.5 text-center font-bold text-white border-r border-blue-700"
                              style={{ background: 'linear-gradient(180deg,#1e3a8a,#1d4ed8)' }}>🚌 Xayrulla</th>
                            <th className="px-4 py-3.5 text-center font-bold text-white border-r border-purple-700"
                              style={{ background: 'linear-gradient(180deg,#4c1d95,#6d28d9)' }}>🚌 Nosir</th>
                            <th className="px-4 py-3.5 text-center font-bold text-white"
                              style={{ background: 'linear-gradient(180deg,#065f46,#059669)' }}>Total (USD)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredBookingsWithHotels.map((item, idx) => {
                            const sevil=item.expenses?.transportSevil||0;
                            const xayrulla=item.expenses?.transportXayrulla||0;
                            const nosir=item.expenses?.transportNosir||0;
                            const total=sevil+xayrulla+nosir;
                            const rowBg = idx%2===0 ? '#ffffff' : '#f8fafc';
                            return (
                              <tr key={item.bookingId} style={{ background: rowBg }}
                                onMouseEnter={e => e.currentTarget.style.background='#eff6ff'}
                                onMouseLeave={e => e.currentTarget.style.background=rowBg}>
                                <td className="px-4 py-2.5 text-center text-slate-400 border-r border-slate-100">{idx+1}</td>
                                <td className="px-4 py-2.5 border-r border-slate-100">
                                  <Link to={`/bookings/${item.bookingId}`} className="font-bold text-blue-600 hover:text-blue-800 hover:underline">{item.bookingName}</Link>
                                </td>
                                <td className="px-4 py-2.5 text-center border-r border-slate-100">
                                  {sevil>0 ? <span className="font-semibold text-gray-800">{formatNumber(sevil)}</span> : <span className="text-slate-200">—</span>}
                                </td>
                                <td className="px-4 py-2.5 text-center border-r border-slate-100">
                                  {xayrulla>0 ? <span className="font-semibold text-gray-800">{formatNumber(xayrulla)}</span> : <span className="text-slate-200">—</span>}
                                </td>
                                <td className="px-4 py-2.5 text-center border-r border-slate-100">
                                  {nosir>0 ? <span className="font-semibold text-gray-800">{formatNumber(nosir)}</span> : <span className="text-slate-200">—</span>}
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                  {total>0 ? <span className="font-black text-gray-900">${formatNumber(total)}</span> : <span className="text-slate-200">—</span>}
                                </td>
                              </tr>
                            );
                          })}
                          <tr style={{ background: '#dcfce7', borderTop: '2px solid #86efac' }}>
                            <td className="px-4 py-3.5 border-r border-green-200"></td>
                            <td className="px-4 py-3.5 text-xs font-black text-green-800 uppercase tracking-widest border-r border-green-200">TOTAL</td>
                            {['transportSevil','transportXayrulla','transportNosir'].map(key => (
                              <td key={key} className="px-4 py-3.5 text-center text-xs font-black text-green-900 border-r border-green-200">
                                {formatNumber(filteredBookingsWithHotels.reduce((s,i)=>s+(i.expenses?.[key]||0),0))}
                              </td>
                            ))}
                            <td className="px-4 py-3.5 text-center text-xs font-black text-green-900">
                              ${formatNumber(filteredBookingsWithHotels.reduce((s,i)=>s+(i.expenses?.transportSevil||0)+(i.expenses?.transportXayrulla||0)+(i.expenses?.transportNosir||0),0))}
                            </td>
                          </tr>
                        </tbody>
                        </table>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* ── TRANSPORT ANALYSIS TAB ── */}
                {activeExpenseTab === 'transport-analysis' && (() => {
                  const PROVIDERS = [
                    { key: 'sevil',    label: 'Sevil',    expenseKey: 'transportSevil',    datesKey: 'transportSevilDates',
                      headerBg: 'linear-gradient(135deg,#1e3a8a,#1d4ed8)', monthBg: '#dbeafe', monthBgOpen: '#bfdbfe', textColor: '#1e40af' },
                    { key: 'xayrulla', label: 'Xayrulla', expenseKey: 'transportXayrulla', datesKey: 'transportXayrullaDates',
                      headerBg: 'linear-gradient(135deg,#064e3b,#065f46)', monthBg: '#dcfce7', monthBgOpen: '#bbf7d0', textColor: '#065f46' },
                    { key: 'nosir',    label: 'Nosir',    expenseKey: 'transportNosir',    datesKey: 'transportNosirDates',
                      headerBg: 'linear-gradient(135deg,#4c1d95,#6d28d9)', monthBg: '#ede9fe', monthBgOpen: '#ddd6fe', textColor: '#6d28d9' },
                  ];

                  // Departure date lookup from bookings state
                  const deptDates = {};
                  bookings.forEach(b => { deptDates[b.id] = b.departureDate; });

                  const fmtShort = (d) => {
                    if (!d) return '—';
                    return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                  };
                  const monthLabel = (key) => {
                    if (key === 'unknown') return 'Sana noma\'lum';
                    const [y, m] = key.split('-');
                    const names = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];
                    return `${names[parseInt(m)-1]} ${y}`;
                  };

                  // Build providerMap: { providerKey: { months: { "2026-03": [rows] } } }
                  const providerMap = {};
                  PROVIDERS.forEach(p => {
                    filteredBookingsWithHotels.forEach(booking => {
                      const amount = booking.expenses?.[p.expenseKey] || 0;
                      if (amount === 0) return;
                      const depDate = deptDates[booking.bookingId];
                      const dateRange = booking.expenses?.[p.datesKey] || { from: null, to: null };
                      // Group by last route date (dateTo), fallback to depDate
                      const groupDate = dateRange.to || depDate;
                      const mk = groupDate ? new Date(groupDate).toISOString().slice(0, 7) : 'unknown';
                      if (!providerMap[p.key]) providerMap[p.key] = { months: {} };
                      if (!providerMap[p.key].months[mk]) providerMap[p.key].months[mk] = [];
                      providerMap[p.key].months[mk].push({
                        bookingId: booking.bookingId,
                        bookingName: booking.bookingName,
                        amount,
                        depDate,
                        dateFrom: dateRange.from,
                        dateTo: dateRange.to,
                      });
                    });
                  });

                  if (filteredBookingsWithHotels.length === 0) return (
                    <EmptyState icon={Truck} label={`${activeModule?.name} uchun ma'lumot yo'q`} />
                  );

                  return (
                    <div className="w-full space-y-2">
                      {PROVIDERS.map(p => {
                        const pData = providerMap[p.key] || { months: {} };
                        const sortedMonths = Object.keys(pData.months).sort();
                        const allRows = sortedMonths.flatMap(mk => pData.months[mk]);
                        const totalAmt = allRows.reduce((s, b) => s + b.amount, 0);
                        const paidAmt = allRows.filter(b => paidTransport[`${b.bookingId}_${p.key}`]).reduce((s, b) => s + b.amount, 0);
                        const debtAmt = totalAmt - paidAmt;
                        const isOpen = openTransportProviders.has(p.key);

                        return (
                          <div key={p.key} className="rounded-xl overflow-hidden" style={{ border: '1px solid #e2e8f0' }}>
                            {/* Provider header */}
                            <button className="w-full flex items-center justify-between px-4 py-3 text-left"
                              style={{ background: p.headerBg }}
                              onClick={() => toggleTransportProvider(p.key)}>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-white font-bold text-sm">🚌 {p.label}</span>
                                <span className="text-white/60 text-xs">
                                  {sortedMonths.length > 0 ? `(${sortedMonths.length} oy)` : '(gruppa yo\'q)'}
                                </span>
                                {paidAmt > 0 && (
                                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ background: '#16a34a22', color: '#86efac' }}>
                                    ✓ ${formatNumber(paidAmt)}
                                  </span>
                                )}
                                {debtAmt > 0 && (
                                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ background: '#ef444422', color: '#fca5a5' }}>
                                    ✗ ${formatNumber(debtAmt)}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-white font-bold text-sm">${formatNumber(totalAmt)}</span>
                                <span className="text-white text-xs">{isOpen ? '▲' : '▼'}</span>
                              </div>
                            </button>

                            {/* Months — only shown when open and data exists */}
                            {isOpen && sortedMonths.length === 0 && (
                              <div className="px-6 py-3 text-xs text-slate-400 italic" style={{ background: '#f8fafc' }}>
                                Bu gruppada {p.label} transport xarajati yo'q
                              </div>
                            )}
                            {isOpen && sortedMonths.map(mk => {
                              const rows = pData.months[mk];
                              const mTotal = rows.reduce((s, b) => s + b.amount, 0);
                              const mPaid = rows.filter(b => paidTransport[`${b.bookingId}_${p.key}`]).reduce((s, b) => s + b.amount, 0);
                              const mDebt = mTotal - mPaid;
                              const monthKey = `${p.key}__${mk}`;
                              const monthOpen = openTransportMonths.has(monthKey);

                              return (
                                <div key={mk}>
                                  <button className="w-full flex items-center justify-between px-4 py-2.5 text-left"
                                    style={{ background: monthOpen ? p.monthBgOpen : p.monthBg, borderTop: '1px solid #e2e8f0' }}
                                    onClick={() => toggleTransportMonth(monthKey)}>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs font-bold uppercase tracking-wide" style={{ color: p.textColor }}>
                                        📅 {monthLabel(mk)}
                                      </span>
                                      <span className="text-xs" style={{ color: p.textColor + '99' }}>{rows.length} gruppa</span>
                                      {mPaid > 0 && <span className="text-xs font-semibold text-green-700">✓ ${formatNumber(mPaid)}</span>}
                                      {mDebt > 0 && <span className="text-xs font-semibold text-red-500">✗ ${formatNumber(mDebt)}</span>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold" style={{ color: p.textColor }}>${formatNumber(mTotal)}</span>
                                      <span className="text-xs" style={{ color: p.textColor + '99' }}>{monthOpen ? '▲' : '▼'}</span>
                                    </div>
                                  </button>

                                  {/* Booking rows */}
                                  {monthOpen && rows.map((b, i) => {
                                    const tkey = `${b.bookingId}_${p.key}`;
                                    const isPaid = !!paidTransport[tkey];
                                    return (
                                      <div key={i} className="flex items-center justify-between px-4 py-2.5 text-xs"
                                        style={{ background: isPaid ? '#f0fdf4' : (i % 2 === 0 ? '#ffffff' : '#f8fafc'), borderTop: '1px solid #f1f5f9' }}>
                                        <div className="flex items-center gap-3">
                                          <button
                                            onClick={(e) => toggleTransportPaid(e, b.bookingId, p.key)}
                                            title={isPaid ? 'To\'landi — bekor qilish' : 'To\'landi deb belgilash'}
                                            className="w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all"
                                            style={{ background: isPaid ? '#16a34a' : 'white', borderColor: isPaid ? '#16a34a' : '#cbd5e1' }}>
                                            {isPaid && <span className="text-white font-bold" style={{ fontSize: 10 }}>✓</span>}
                                          </button>
                                          <Link to={`/bookings/${b.bookingId}`}
                                            className="font-bold text-blue-600 hover:underline w-16 shrink-0">{b.bookingName}</Link>
                                          <span className="text-slate-400">
                                            {b.dateFrom ? fmtShort(b.dateFrom) : fmtShort(b.depDate)}
                                            {b.dateTo && b.dateTo !== b.dateFrom ? ` → ${fmtShort(b.dateTo)}` : ''}
                                          </span>
                                          {isPaid && <span className="text-green-600 font-semibold">To'landi</span>}
                                        </div>
                                        <div className="font-semibold" style={{ color: isPaid ? '#16a34a' : '#334155' }}>
                                          ${formatNumber(b.amount)}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
