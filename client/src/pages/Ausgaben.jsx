import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { bookingsApi, touristsApi, routesApi, railwaysApi, flightsApi, tourServicesApi, transportApi, opexApi } from '../services/api';
import { useIsMobile } from '../hooks/useMediaQuery';
import toast from 'react-hot-toast';
import { Hotel, DollarSign, BarChart3 } from 'lucide-react';

const tourTypeModules = [
  { code: 'ER', name: 'Erlebnisreisen', color: '#3B82F6' },
  { code: 'CO', name: 'Comfort', color: '#10B981' },
  { code: 'KAS', name: 'Karawanen Seidenstrasse', color: '#F59E0B' },
  { code: 'ZA', name: 'Zentralasien', color: '#8B5CF6' }
];

const expenseTabs = [
  { id: 'general', name: 'General', icon: BarChart3 },
  { id: 'hotels', name: 'Hotels', icon: Hotel },
  // Future: { id: 'transport', name: 'Transport', icon: Truck },
  // Future: { id: 'guides', name: 'Guides', icon: Users },
];

export default function Ausgaben() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Get state from URL or use defaults
  const activeTourType = searchParams.get('tour') || 'ER';
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
  const [bookingsDetailedData, setBookingsDetailedData] = useState([]); // Store all booking data with calculations
  const [metroVehicles, setMetroVehicles] = useState([]); // Metro data from Opex Transport API

  // Cache: { tourTypeCode: { bookings: [], detailedData: [] } }
  const [cache, setCache] = useState({});

  useEffect(() => {
    loadVehiclesFromApi();
  }, []);

  useEffect(() => {
    loadBookingsAndExpenses();
  }, [activeTourType, activeExpenseTab]);

  // Load Metro vehicles from Opex Transport API
  const loadVehiclesFromApi = async () => {
    try {
      const response = await transportApi.getAll();
      const { grouped } = response.data;
      if (grouped.metro?.length > 0) {
        setMetroVehicles(grouped.metro);
      } else {
        console.warn('⚠️ No Metro vehicles found in OPEX Transport');
      }
    } catch (error) {
      console.error('Error loading metro vehicles from API:', error);
      toast.error('Failed to load Metro data from OPEX');
    }
  };

  const loadBookingsAndExpenses = async () => {
    // Check cache first
    const cacheKey = activeTourType;
    const needsDetailedData = activeExpenseTab === 'general' || activeExpenseTab === 'hotels';

    // Try localStorage first (persists across page reloads)
    try {
      const localStorageKey = `ausgaben_cache_v3_${cacheKey}`;
      const cachedData = localStorage.getItem(localStorageKey);

      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        const cacheAge = Date.now() - (parsed.timestamp || 0);
        const maxAge = 5 * 60 * 1000; // 5 minutes cache

        if (cacheAge < maxAge && parsed.bookings && (!needsDetailedData || parsed.detailedData)) {
          console.log(`✅ Using localStorage cache for ${cacheKey} (age: ${Math.round(cacheAge / 1000)}s)`);
          setBookings(parsed.bookings);
          if (parsed.detailedData) {
            setBookingsDetailedData(parsed.detailedData);
          }
          // Also update in-memory cache
          setCache(prev => ({
            ...prev,
            [cacheKey]: { bookings: parsed.bookings, detailedData: parsed.detailedData }
          }));
          setLoading(false);
          return;
        }
      }
    } catch (e) {
      console.warn('Failed to load from localStorage:', e);
    }

    // Check in-memory cache
    if (cache[cacheKey]?.bookings && (!needsDetailedData || cache[cacheKey]?.detailedData)) {
      console.log(`✅ Using in-memory cache for ${cacheKey}`);
      setBookings(cache[cacheKey].bookings);
      if (cache[cacheKey].detailedData) {
        setBookingsDetailedData(cache[cacheKey].detailedData);
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      console.log(`🔄 Loading fresh data for ${cacheKey}`);

      // Load bookings for active tour type
      const response = await bookingsApi.getAll();
      const allBookings = response.data.bookings;

      // DEBUG: Log all bookings with tourType info
      console.log(`📊 Total bookings from API: ${allBookings.length}`);

      // Count bookings by tourType
      const tourTypeCounts = {};
      const noTourType = [];
      allBookings.forEach(b => {
        const code = b.tourType?.code;
        if (code) {
          tourTypeCounts[code] = (tourTypeCounts[code] || 0) + 1;
        } else {
          noTourType.push(b.bookingNumber || `ID-${b.id}`);
        }
      });

      console.log(`📊 Bookings by tourType:`, tourTypeCounts);
      if (noTourType.length > 0) {
        console.warn(`⚠️ ${noTourType.length} bookings WITHOUT tourType:`, noTourType);
      }

      // Filter by tour type
      const filteredBookings = allBookings.filter(
        booking => booking.tourType?.code === activeTourType
      );

      console.log(`✅ Filtered ${filteredBookings.length} bookings for ${activeTourType}`);

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
        const localStorageKey = `ausgaben_cache_v3_${cacheKey}`;
        localStorage.setItem(localStorageKey, JSON.stringify({
          ...cacheData,
          timestamp: Date.now()
        }));
        console.log(`💾 Saved to localStorage: ${localStorageKey}`);
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

  const loadDetailedBookingsData = async (bookingsData) => {
    try {
      // Load Metro vehicles from Opex Transport API (once for all bookings)
      let metroVehiclesData = [];
      try {
        const transportResponse = await transportApi.getAll();
        const { grouped } = transportResponse.data;
        metroVehiclesData = grouped.metro || [];
        console.log('🚇 Loaded Metro vehicles from Opex:', metroVehiclesData.length);
      } catch (error) {
        console.error('Error loading metro vehicles:', error);
      }

      // Load data for all bookings in parallel (OPTIMIZED)
      console.log(`📊 Loading detailed data for ${bookingsData.length} bookings`);
      const detailedData = await Promise.all(bookingsData.map(async (booking) => {
        try {
          // Load all data in parallel for this booking
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

          // Load rooming lists in parallel
          const accommodationRoomingLists = {};
          const roomingPromises = accommodations.map(async (acc) => {
            try {
              const roomingResponse = await bookingsApi.getAccommodationRoomingList(booking.id, acc.id);
              accommodationRoomingLists[acc.id] = roomingResponse.data.roomingList || [];
            } catch (err) {
              accommodationRoomingLists[acc.id] = [];
            }
          });
          await Promise.all(roomingPromises);

          // Calculate hotels total
          const grandTotalDataRaw = calculateGrandTotal(accommodations, tourists, accommodationRoomingLists);
          // Override hotel totals to 0 for cancelled bookings
          const grandTotalData = booking.status === 'CANCELLED'
            ? { grandTotalUSD: 0, grandTotalUZS: 0, hotelBreakdown: [] }
            : grandTotalDataRaw;

          // Calculate expenses using EXACT SAME LOGIC as Costs → Total tab
          const expenses = await calculateExpensesLikeTotalTab(booking, tourists, grandTotalData, routes, railways, flights, tourServices, metroVehiclesData);

          return {
            bookingId: booking.id,
            bookingName: booking.bookingNumber || `${booking.tourType?.code || 'Tour'}-${booking.id}`,
            grandTotalData,
            expenses
          };
        } catch (err) {
          console.error(`Error loading data for booking ${booking.id}:`, err);
          return null;
        }
      }));

      // Filter out null results (failed bookings)
      const validData = detailedData.filter(d => d !== null);
      console.log(`✅ Loaded ${validData.length} bookings in parallel`);

      setBookingsDetailedData(validData);
      return validData;
    } catch (error) {
      console.error('Error loading detailed bookings data:', error);
      return [];
    }
  };

  // Calculate expenses using EXACT SAME LOGIC as Costs → Total tab (BookingDetail.jsx:11146-11264)
  const calculateExpensesLikeTotalTab = async (booking, tourists, grandTotalData, routes, railways, flights, tourServices = [], metroVehicles = []) => {
    const pax = tourists?.length || 0;
    const tourTypeCode = booking?.tourType?.code?.toLowerCase() || 'er';

    console.log(`\n🔍 DEBUG ${booking.bookingNumber}:`);
    console.log(`  PAX: ${pax}`);
    console.log(`  Tour Type Code: ${tourTypeCode}`);
    console.log(`  📦 tourServices (${tourServices?.length || 0} items):`, tourServices);
    console.log(`  booking.guide:`, booking.guide);
    console.log(`  booking.guideFullDays:`, booking.guideFullDays);
    console.log(`  booking.guideHalfDays:`, booking.guideHalfDays);
    console.log(`  booking.additionalGuides:`, booking.additionalGuides);
    console.log(`  booking.bergreiseleiter:`, booking.bergreiseleiter);

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
            console.log(`  ✅ mainGuideData totalPayment: $${totalPayment}`);
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
        console.log(`  ✅ Parsed secondGuide:`, secondGuide);

        // Always recalculate totalPayment from days × rate (in case rate changed)
        if (secondGuide) {
          const dayRate = secondGuide.dayRate || secondGuide.guide?.dayRate || 110;
          const halfDayRate = secondGuide.halfDayRate || secondGuide.guide?.halfDayRate || 55;
          const fullDays = secondGuide.fullDays || 0;
          const halfDays = secondGuide.halfDays || 0;
          if (fullDays > 0 || halfDays > 0) {
            secondGuide.totalPayment = (fullDays * dayRate) + (halfDays * halfDayRate);
          }
          console.log(`  🔧 Second guide payment: ${fullDays} days × $${dayRate} = $${secondGuide.totalPayment}`);
        }
      }
    } catch (e) {
      console.error('  ❌ Error parsing additionalGuides:', e);
    }

    try {
      if (booking.bergreiseleiter && typeof booking.bergreiseleiter === 'string') {
        bergreiseleiter = JSON.parse(booking.bergreiseleiter);
        console.log(`  ✅ Parsed bergreiseleiter:`, bergreiseleiter);
      } else if (booking.bergreiseleiter && typeof booking.bergreiseleiter === 'object') {
        bergreiseleiter = booking.bergreiseleiter;
        console.log(`  ✅ Got bergreiseleiter object:`, bergreiseleiter);
      }

      // Calculate totalPayment if missing
      if (bergreiseleiter && !bergreiseleiter.totalPayment) {
        const dayRate = bergreiseleiter.dayRate || bergreiseleiter.guide?.dayRate || 50;
        const halfDayRate = bergreiseleiter.halfDayRate || bergreiseleiter.guide?.halfDayRate || 0;
        const fullDays = bergreiseleiter.fullDays || 0;
        const halfDays = bergreiseleiter.halfDays || 0;
        bergreiseleiter.totalPayment = (fullDays * dayRate) + (halfDays * halfDayRate);
        console.log(`  🔧 Calculated bergreiseleiter payment: ${fullDays} days × $${dayRate} + ${halfDays} half days × $${halfDayRate} = $${bergreiseleiter.totalPayment}`);
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
          console.log(`  🤖 AUTO: ${tourTypeCode.toUpperCase()} guide with 0 days → using defaults: ${fullDays} full days + ${halfDays} half day`);
        }
      }

      // Calculate if at least one day is set (including auto-calculated)
      if (fullDays > 0 || halfDays > 0) {
        mainGuide = {
          totalPayment: (fullDays * dayRate) + (halfDays * halfDayRate)
        };
        console.log(`  ✅ Main guide payment: ${fullDays} days × $${dayRate} + ${halfDays} half days × $${halfDayRate} = $${mainGuide.totalPayment}`);
      } else {
        console.log(`  ⚠️ Main guide: days are 0, skipping`);
      }
    } else {
      console.log(`  ❌ Main guide missing: guide=${!!booking.guide}, fullDays=${booking.guideFullDays}, halfDays=${booking.guideHalfDays}`);
    }

    const expenses = {
      // 1. Hotels - from grandTotalData
      hotelsUSD: grandTotalData?.grandTotalUSD || 0,
      hotelsUZS: grandTotalData?.grandTotalUZS || 0,

      // 2. Transport & Routes - from routes array
      transportSevil: routes.filter(r => r.provider?.toLowerCase().includes('sevil')).reduce((sum, r) => sum + (r.price || 0), 0),
      transportXayrulla: routes.filter(r => r.provider?.toLowerCase().includes('xayrulla')).reduce((sum, r) => sum + (r.price || 0), 0),
      transportNosir: routes.filter(r => r.provider?.toLowerCase().includes('nosir')).reduce((sum, r) => sum + (r.price || 0), 0),

      // 3. Railway - from railways array
      railway: railways.reduce((sum, r) => sum + (r.price || 0), 0),

      // 4. Flights - from flights array
      flights: flights.reduce((sum, f) => sum + (f.price || 0), 0),

      // 5. Guide - from mainGuide, secondGuide, bergreiseleiter
      guide: (mainGuide?.totalPayment || 0) + (secondGuide?.totalPayment || 0) + (bergreiseleiter?.totalPayment || 0),

      // 6. Meals - from localStorage
      meals: 0,

      // 7. Metro - from Opex Transport API (skip for ZA tours)
      metro: (() => {
        // Skip Metro for ZA tours
        if (booking.tourType?.code === 'ZA') {
          console.log(`  🚇 Metro: Skipped for ZA tour`);
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
        console.log(`  🚇 Metro vehicles (${metroData.length}):`, metroData, `PAX: ${metroPax}, Total: ${metroTotal}`);
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
        console.log(`  📦 Other services (${otherServices.length}):`, otherServices, `Total: ${otherTotal}`);
        return otherTotal;
      })()
    };

    // Load Meals from database (OPEX API)
    try {
      const response = await opexApi.get(tourTypeCode.toUpperCase(), 'meal');
      const mealsData = response.data?.items || [];
      console.log(`  📦 OPEX Meals[${tourTypeCode}]:`, mealsData.length, 'items');
      if (mealsData.length > 0) {
        expenses.meals = mealsData.reduce((sum, meal) => {
          const priceStr = (meal.price || meal.pricePerPerson || '0').toString().replace(/\s/g, '');
          const pricePerPerson = parseFloat(priceStr) || 0;
          return sum + (pricePerPerson * pax);
        }, 0);
        console.log(`    ✅ Meals total: ${expenses.meals} UZS`);
      }
    } catch (e) {
      console.error('  ❌ Error loading meals:', e);
    }

    // ADD Shows from database (OPEX API) (in addition to tourServices)
    try {
      const response = await opexApi.get(tourTypeCode.toUpperCase(), 'shows');
      const showsData = response.data?.items || [];
      console.log(`  📦 OPEX Shows[${tourTypeCode}]:`, showsData.length, 'items');
      if (showsData.length > 0) {
        const opexShows = showsData.reduce((sum, show) => {
          const rawPrice = show.price || show.pricePerPerson || 0;
          const priceStr = rawPrice.toString().replace(/\s/g, '');
          const pricePerPerson = parseFloat(priceStr) || 0;
          return sum + (pricePerPerson * pax);
        }, 0);
        expenses.shou += opexShows; // ADD to existing tourServices value
        console.log(`    ✅ Shows total (OPEX + tourServices): ${expenses.shou} UZS`);
      }
    } catch (e) {
      console.error('  ❌ Error loading shows:', e);
    }

    // ADD Eintritt from database (OPEX API) (in addition to tourServices)
    try {
      const response = await opexApi.get(tourTypeCode.toUpperCase(), 'sightseeing');
      const sightseeingData = response.data?.items || [];
      console.log(`  📦 OPEX Sightseeing[${tourTypeCode}]:`, sightseeingData.length, 'items');
      if (sightseeingData.length > 0) {
        const opexEintritt = sightseeingData.reduce((sum, item) => {
          const pricePerPerson = parseFloat((item.price || '0').toString().replace(/\s/g, '')) || 0;
          return sum + (pricePerPerson * pax);
        }, 0);
        expenses.eintritt += opexEintritt; // ADD to existing tourServices value
        console.log(`    ✅ Eintritt total (OPEX + tourServices): ${expenses.eintritt} UZS`);
      }
    } catch (e) {
      console.error('  ❌ Error loading sightseeing:', e);
    }

    // Override all costs to 0 for cancelled bookings
    if (booking.status === 'CANCELLED') {
      console.log(`  ⚠️ Booking ${booking.bookingNumber} is CANCELLED - all costs set to 0`);
      return {
        hotelsUSD: 0, hotelsUZS: 0,
        transportSevil: 0, transportXayrulla: 0, transportNosir: 0,
        railway: 0, flights: 0, guide: 0,
        meals: 0, metro: 0, shou: 0, eintritt: 0, other: 0
      };
    }

    console.log(`\n  📊 FINAL EXPENSES for ${booking.bookingNumber}:`);
    console.log(`    Guide (USD): $${expenses.guide}`);
    console.log(`    Eintritt (UZS): ${expenses.eintritt}`);
    console.log(`    Metro (UZS): ${expenses.metro}`);
    console.log(`    Shows (UZS): ${expenses.shou}`);
    console.log(`    Meals (UZS): ${expenses.meals}`);
    console.log(`    Other (USD): $${expenses.other}\n`);

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

  // Pivot data: Hotels as columns, bookings as rows
  const getPivotData = () => {
    // Use filtered bookings (only with Hotels data)
    const dataToUse = filteredBookingsWithHotels;

    // Get unique hotels across all bookings
    const uniqueHotels = new Set();
    dataToUse.forEach(booking => {
      if (booking.grandTotalData?.hotelBreakdown) {
        booking.grandTotalData.hotelBreakdown.forEach(h => {
          if (h.hotel) uniqueHotels.add(h.hotel);
        });
      }
    });

    const hotels = Array.from(uniqueHotels).sort();

    // Create booking rows with hotel costs
    const bookingRows = dataToUse.map(booking => {
      const hotelCosts = {}; // { hotelName: { usd, uzs } }

      if (booking.grandTotalData?.hotelBreakdown) {
        // Sum costs for hotels with same name (e.g., two Arien Plaza visits)
        booking.grandTotalData.hotelBreakdown.forEach(h => {
          if (!h.hotel) return;

          if (!hotelCosts[h.hotel]) {
            hotelCosts[h.hotel] = { usd: 0, uzs: 0 };
          }

          hotelCosts[h.hotel].usd += (h.USD || 0);
          hotelCosts[h.hotel].uzs += (h.UZS || 0);
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

      // FIX: Use .filter() to get ALL occurrences of the same hotel (e.g., Arien Plaza twice)
      const hotelMatches = booking.grandTotalData.hotelBreakdown.filter(h => h.hotel === hotelName);

      // Sum all occurrences of this hotel
      const hotelTotal = hotelMatches.reduce((hotelSum, h) => {
        return hotelSum + (currency === 'usd' ? (h.USD || 0) : (h.UZS || 0));
      }, 0);

      return sum + hotelTotal;
    }, 0);
  };

  const getGrandTotalUSD = () => {
    const dataToUse = (activeExpenseTab === 'general' || activeExpenseTab === 'hotels') ? filteredBookingsWithHotels : bookingsDetailedData;
    return dataToUse.reduce((sum, booking) => {
      return sum + (booking.grandTotalData?.grandTotalUSD || 0);
    }, 0);
  };

  const getGrandTotalUZS = () => {
    const dataToUse = (activeExpenseTab === 'general' || activeExpenseTab === 'hotels') ? filteredBookingsWithHotels : bookingsDetailedData;
    return dataToUse.reduce((sum, booking) => {
      return sum + (booking.grandTotalData?.grandTotalUZS || 0);
    }, 0);
  };

  const formatNumber = (num) => {
    // Format number with spaces every 3 digits: 4618200 → 4 618 200
    const rounded = Math.round(num).toString();
    return rounded.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  const activeModule = tourTypeModules.find(m => m.code === activeTourType);

  // Filter bookings with Hotels data (for General tab statistics)
  const filteredBookingsWithHotels = useMemo(() => {
    return bookingsDetailedData.filter(booking => {
      const exp = booking.expenses || {};
      return (exp.hotelsUSD > 0 || exp.hotelsUZS > 0);
    });
  }, [bookingsDetailedData]);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Ausgaben</h1>
        <p className="text-gray-600 mt-2">Расходы и траты</p>
      </div>

      {/* Tour Type Tabs */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {tourTypeModules.map((module) => (
              <button
                key={module.code}
                onClick={() => {
                  updateParams({ tour: module.code });
                  // Keep current tab when switching tour types
                }}
                className={`
                  flex-1 py-4 px-6 text-center font-medium text-sm transition-all
                  ${activeTourType === module.code
                    ? 'border-b-2 text-gray-900'
                    : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
                style={{
                  borderBottomColor: activeTourType === module.code ? module.color : 'transparent',
                  borderBottomWidth: activeTourType === module.code ? '2px' : '0'
                }}
              >
                <span className="flex items-center justify-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: module.color }}
                  />
                  {module.code}
                </span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Expense Type Sub-Tabs */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {expenseTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => updateParams({ tab: tab.id })}
                  className={`
                    flex-1 py-3 px-6 text-center font-medium text-sm transition-all
                    flex items-center justify-center gap-2
                    ${activeExpenseTab === tab.id
                      ? 'border-b-2 text-gray-900'
                      : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                  style={{
                    borderBottomColor: activeExpenseTab === tab.id ? activeModule?.color : 'transparent',
                    borderBottomWidth: activeExpenseTab === tab.id ? '2px' : '0'
                  }}
                >
                  <Icon size={18} />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg shadow">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        ) : (
          <>
            {/* Summary Card */}
            <div className="p-6 border-b border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${activeModule?.color}20` }}
                    >
                      <Hotel size={20} style={{ color: activeModule?.color }} />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Number of Tours</p>
                      <p className="text-2xl font-bold text-gray-900">{activeExpenseTab === 'general' || activeExpenseTab === 'hotels' ? filteredBookingsWithHotels.length : bookings.length}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${activeModule?.color}20` }}
                    >
                      <Hotel size={20} style={{ color: activeModule?.color }} />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Number of Hotels</p>
                      <p className="text-2xl font-bold text-gray-900">{getPivotData().hotels.length}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center bg-green-100"
                    >
                      <DollarSign size={20} className="text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Amount (USD)</p>
                      <p className="text-xl font-bold text-gray-900">
                        ${formatNumber(getGrandTotalUSD())}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">Total Amount (UZS)</p>
                      <p className="text-xl font-bold text-gray-900">
                        {formatNumber(getGrandTotalUZS())}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* General Tab - Comprehensive Expenses */}
            {activeExpenseTab === 'general' && (
              <div className="overflow-x-auto">
                {bookingsDetailedData.length === 0 ? (
                  <div className="p-12 text-center">
                    <BarChart3 size={48} className="mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500">No expense data available for {activeModule?.name}</p>
                  </div>
                ) : (
                  <>
                    {/* Warning if some bookings are filtered out */}
                    {bookingsDetailedData.length > filteredBookingsWithHotels.length && (
                      <div className="px-6 py-3 bg-amber-50 border-l-4 border-amber-400">
                        <p className="text-sm text-amber-800">
                          ⚠️ <strong>Note:</strong> Showing {filteredBookingsWithHotels.length} of {bookingsDetailedData.length} bookings.
                          {' '}{bookingsDetailedData.length - filteredBookingsWithHotels.length} booking(s) hidden (no Hotels data).
                        </p>
                      </div>
                    )}
                    <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th rowSpan="2" className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300 bg-gray-100">
                          No.
                        </th>
                        <th rowSpan="2" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-100 z-10 border-r border-gray-300" style={{ left: '50px' }}>
                          Name
                        </th>
                        <th colSpan="2" className="px-3 py-2 text-center text-xs font-medium text-gray-700 uppercase tracking-wider bg-purple-100 border-r border-gray-300">
                          Hotels
                        </th>
                        <th colSpan="3" className="px-3 py-2 text-center text-xs font-medium text-gray-700 uppercase tracking-wider bg-blue-100 border-r border-gray-300">
                          Transport
                        </th>
                        <th rowSpan="2" className="px-3 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider bg-green-100 border-r border-gray-300">
                          Railway
                        </th>
                        <th rowSpan="2" className="px-3 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider bg-yellow-100 border-r border-gray-300">
                          Flights
                        </th>
                        <th rowSpan="2" className="px-3 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider bg-orange-100 border-r border-gray-300">
                          Guide
                        </th>
                        <th rowSpan="2" className="px-3 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider bg-pink-100 border-r border-gray-300">
                          Meals
                        </th>
                        <th rowSpan="2" className="px-3 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider bg-indigo-100 border-r border-gray-300">
                          Eintritt
                        </th>
                        <th rowSpan="2" className="px-3 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider bg-cyan-100 border-r border-gray-300">
                          Metro
                        </th>
                        <th rowSpan="2" className="px-3 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider bg-teal-100 border-r border-gray-300">
                          Shou
                        </th>
                        <th rowSpan="2" className="px-3 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider bg-gray-100 border-r border-gray-300">
                          Other
                        </th>
                        <th rowSpan="2" className="px-3 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider bg-amber-100 border-r border-gray-300">
                          Total UZS
                        </th>
                        <th rowSpan="2" className="px-3 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider bg-green-100 border-r border-gray-300">
                          Total USD
                        </th>
                      </tr>
                      <tr>
                        <th className="px-3 py-2 text-center text-xs font-medium text-purple-700 uppercase tracking-wider bg-purple-50 border-r border-gray-200">
                          USD
                        </th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-purple-700 uppercase tracking-wider bg-purple-50 border-r border-gray-300">
                          UZS
                        </th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-blue-700 uppercase tracking-wider bg-blue-50 border-r border-gray-200">
                          Sevil
                        </th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-blue-700 uppercase tracking-wider bg-blue-50 border-r border-gray-200">
                          Xayrulla
                        </th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-blue-700 uppercase tracking-wider bg-blue-50 border-r border-gray-300">
                          Nosir
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {bookingsDetailedData
                        .filter(booking => {
                          const exp = booking.expenses || {};
                          // Only show bookings with Hotels data (USD or UZS)
                          return (exp.hotelsUSD > 0 || exp.hotelsUZS > 0);
                        })
                        .map((booking, idx) => {
                        const exp = booking.expenses || {};
                        // Calculate totals: UZS and USD separately
                        const totalUZS = (exp.hotelsUZS || 0) + (exp.railway || 0) + (exp.flights || 0) +
                                        (exp.meals || 0) + (exp.eintritt || 0) + (exp.metro || 0) +
                                        (exp.shou || 0) + (exp.other || 0);
                        const totalUSD = (exp.hotelsUSD || 0) + (exp.transportSevil || 0) +
                                        (exp.transportXayrulla || 0) + (exp.transportNosir || 0) + (exp.guide || 0);

                        return (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 py-3 text-center text-sm text-gray-600 border-r border-gray-200">
                              {idx + 1}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap sticky left-0 bg-white z-10 border-r border-gray-200" style={{ left: '50px' }}>
                              <Link
                                to={`/bookings/${booking.bookingId}`}
                                className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                              >
                                {booking.bookingName}
                              </Link>
                            </td>
                            <td className="px-3 py-3 text-center text-sm font-medium text-gray-900 border-r border-gray-200">
                              {exp.hotelsUSD > 0 ? `$${formatNumber(exp.hotelsUSD)}` : '-'}
                            </td>
                            <td className="px-3 py-3 text-center text-sm font-medium text-gray-900 border-r border-gray-300">
                              {exp.hotelsUZS > 0 ? formatNumber(exp.hotelsUZS) : '-'}
                            </td>
                            <td className="px-3 py-3 text-center text-sm font-medium text-gray-900 border-r border-gray-200">
                              {exp.transportSevil > 0 ? `$${formatNumber(exp.transportSevil)}` : '-'}
                            </td>
                            <td className="px-3 py-3 text-center text-sm font-medium text-gray-900 border-r border-gray-200">
                              {exp.transportXayrulla > 0 ? `$${formatNumber(exp.transportXayrulla)}` : '-'}
                            </td>
                            <td className="px-3 py-3 text-center text-sm font-medium text-gray-900 border-r border-gray-300">
                              {exp.transportNosir > 0 ? `$${formatNumber(exp.transportNosir)}` : '-'}
                            </td>
                            <td className="px-3 py-3 text-center text-sm font-medium text-gray-900 border-r border-gray-300">
                              {exp.railway > 0 ? formatNumber(exp.railway) : '-'}
                            </td>
                            <td className="px-3 py-3 text-center text-sm font-medium text-gray-900 border-r border-gray-300">
                              {exp.flights > 0 ? formatNumber(exp.flights) : '-'}
                            </td>
                            <td className="px-3 py-3 text-center text-sm font-medium text-gray-900 border-r border-gray-300">
                              {exp.guide > 0 ? `$${formatNumber(exp.guide)}` : '-'}
                            </td>
                            <td className="px-3 py-3 text-center text-sm font-medium text-gray-900 border-r border-gray-300">
                              {exp.meals > 0 ? formatNumber(exp.meals) : '-'}
                            </td>
                            <td className="px-3 py-3 text-center text-sm font-medium text-gray-900 border-r border-gray-300">
                              {exp.eintritt > 0 ? formatNumber(exp.eintritt) : '-'}
                            </td>
                            <td className="px-3 py-3 text-center text-sm font-medium text-gray-900 border-r border-gray-300">
                              {exp.metro > 0 ? formatNumber(exp.metro) : '-'}
                            </td>
                            <td className="px-3 py-3 text-center text-sm font-medium text-gray-900 border-r border-gray-300">
                              {exp.shou > 0 ? formatNumber(exp.shou) : '-'}
                            </td>
                            <td className="px-3 py-3 text-center text-sm font-medium text-gray-900 border-r border-gray-300">
                              {exp.other > 0 ? formatNumber(exp.other) : '-'}
                            </td>
                            <td className="px-3 py-3 text-center text-sm font-bold text-gray-900 bg-amber-50 border-r border-gray-300">
                              {totalUZS > 0 ? formatNumber(totalUZS) : '-'}
                            </td>
                            <td className="px-3 py-3 text-center text-sm font-bold text-gray-900 bg-green-50 border-r border-gray-300">
                              {totalUSD > 0 ? `$${formatNumber(totalUSD)}` : '-'}
                            </td>
                          </tr>
                        );
                      })}
                      {/* Total Row */}
                      <tr className="bg-gray-100 font-bold border-t-2 border-gray-400">
                        <td className="px-3 py-3 text-center text-sm border-r border-gray-200"></td>
                        <td className="px-3 py-3 text-sm sticky left-0 bg-gray-100 z-10 border-r border-gray-200" style={{ left: '50px' }}>
                          TOTAL
                        </td>
                        <td className="px-3 py-3 text-center text-sm border-r border-gray-200">
                          ${formatNumber(filteredBookingsWithHotels.reduce((sum, b) => sum + (b.expenses?.hotelsUSD || 0), 0))}
                        </td>
                        <td className="px-3 py-3 text-center text-sm border-r border-gray-300">
                          {formatNumber(filteredBookingsWithHotels.reduce((sum, b) => sum + (b.expenses?.hotelsUZS || 0), 0))}
                        </td>
                        <td className="px-3 py-3 text-center text-sm border-r border-gray-200">
                          ${formatNumber(filteredBookingsWithHotels.reduce((sum, b) => sum + (b.expenses?.transportSevil || 0), 0))}
                        </td>
                        <td className="px-3 py-3 text-center text-sm border-r border-gray-200">
                          ${formatNumber(filteredBookingsWithHotels.reduce((sum, b) => sum + (b.expenses?.transportXayrulla || 0), 0))}
                        </td>
                        <td className="px-3 py-3 text-center text-sm border-r border-gray-300">
                          ${formatNumber(filteredBookingsWithHotels.reduce((sum, b) => sum + (b.expenses?.transportNosir || 0), 0))}
                        </td>
                        <td className="px-3 py-3 text-center text-sm border-r border-gray-300">
                          {formatNumber(filteredBookingsWithHotels.reduce((sum, b) => sum + (b.expenses?.railway || 0), 0))}
                        </td>
                        <td className="px-3 py-3 text-center text-sm border-r border-gray-300">
                          {formatNumber(filteredBookingsWithHotels.reduce((sum, b) => sum + (b.expenses?.flights || 0), 0))}
                        </td>
                        <td className="px-3 py-3 text-center text-sm border-r border-gray-300">
                          ${formatNumber(filteredBookingsWithHotels.reduce((sum, b) => sum + (b.expenses?.guide || 0), 0))}
                        </td>
                        <td className="px-3 py-3 text-center text-sm border-r border-gray-300">
                          {formatNumber(filteredBookingsWithHotels.reduce((sum, b) => sum + (b.expenses?.meals || 0), 0))}
                        </td>
                        <td className="px-3 py-3 text-center text-sm border-r border-gray-300">
                          {formatNumber(filteredBookingsWithHotels.reduce((sum, b) => sum + (b.expenses?.eintritt || 0), 0))}
                        </td>
                        <td className="px-3 py-3 text-center text-sm border-r border-gray-300">
                          {formatNumber(filteredBookingsWithHotels.reduce((sum, b) => sum + (b.expenses?.metro || 0), 0))}
                        </td>
                        <td className="px-3 py-3 text-center text-sm border-r border-gray-300">
                          {formatNumber(filteredBookingsWithHotels.reduce((sum, b) => sum + (b.expenses?.shou || 0), 0))}
                        </td>
                        <td className="px-3 py-3 text-center text-sm border-r border-gray-300">
                          {formatNumber(filteredBookingsWithHotels.reduce((sum, b) => sum + (b.expenses?.other || 0), 0))}
                        </td>
                        <td className="px-3 py-3 text-center text-sm bg-amber-100 border-r border-gray-300">
                          {formatNumber(filteredBookingsWithHotels.reduce((sum, b) => {
                            const exp = b.expenses || {};
                            return sum + (exp.hotelsUZS || 0) + (exp.railway || 0) + (exp.flights || 0) +
                                   (exp.meals || 0) + (exp.eintritt || 0) + (exp.metro || 0) +
                                   (exp.shou || 0) + (exp.other || 0);
                          }, 0))}
                        </td>
                        <td className="px-3 py-3 text-center text-sm bg-green-100 border-r border-gray-300">
                          ${formatNumber(filteredBookingsWithHotels.reduce((sum, b) => {
                            const exp = b.expenses || {};
                            return sum + (exp.hotelsUSD || 0) + (exp.transportSevil || 0) +
                                   (exp.transportXayrulla || 0) + (exp.transportNosir || 0) + (exp.guide || 0);
                          }, 0))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  </>
                )}
              </div>
            )}

            {/* Hotels Pivot Table */}
            {activeExpenseTab === 'hotels' && (
              <div className="overflow-x-auto">
                {bookingsDetailedData.length === 0 ? (
                  <div className="p-12 text-center">
                    <Hotel size={48} className="mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500">No hotel data available for {activeModule?.name}</p>
                  </div>
                ) : (() => {
                  const pivotData = getPivotData();
                  return (
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                            No.
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10" style={{ left: '60px' }}>
                            Name
                          </th>
                          {pivotData.hotels.map((hotelName, idx) => (
                            <th
                              key={idx}
                              className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                              style={{
                                minWidth: '120px',
                                backgroundColor: idx % 2 === 0 ? '#f9fafb' : '#f3f4f6'
                              }}
                            >
                              {hotelName}
                            </th>
                          ))}
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider bg-yellow-50 font-bold">
                            Total (UZS)
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider bg-blue-50 font-bold">
                            Total (USD)
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {pivotData.bookingRows.map((bookingRow, bookingIdx) => (
                          <tr key={bookingIdx} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-center text-sm text-gray-600 bg-white">
                              {bookingIdx + 1}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap sticky left-0 bg-white z-10" style={{ left: '60px' }}>
                              <Link
                                to={`/bookings/${bookingRow.bookingId}`}
                                className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                              >
                                {bookingRow.bookingName}
                              </Link>
                            </td>
                            {pivotData.hotels.map((hotelName, hotelIdx) => {
                              const hotelCost = bookingRow.hotelCosts[hotelName];
                              const usdCost = hotelCost?.usd || 0;
                              const uzsCost = hotelCost?.uzs || 0;
                              const displayCost = uzsCost > 0 ? uzsCost : usdCost;
                              const isUZS = uzsCost > 0;

                              return (
                                <td
                                  key={hotelIdx}
                                  className="px-4 py-3 text-center text-sm"
                                  style={{
                                    backgroundColor: hotelIdx % 2 === 0 ? '#ffffff' : '#f9fafb'
                                  }}
                                >
                                  {displayCost > 0 ? (
                                    <span className="font-medium text-gray-900">
                                      {isUZS
                                        ? formatNumber(displayCost)
                                        : `$${formatNumber(displayCost)}`
                                      }
                                    </span>
                                  ) : (
                                    <span className="text-gray-300">-</span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="px-4 py-3 text-center text-sm font-bold text-gray-900 bg-yellow-50">
                              {formatNumber(bookingRow.totalUZS)}
                            </td>
                            <td className="px-4 py-3 text-center text-sm font-bold text-gray-900 bg-blue-50">
                              ${formatNumber(bookingRow.totalUSD)}
                            </td>
                          </tr>
                        ))}
                        {/* Total Row */}
                        <tr className="bg-gray-100 font-bold">
                          <td className="px-4 py-3 text-center text-sm text-gray-900 bg-gray-100">
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 sticky left-0 bg-gray-100 z-10" style={{ left: '60px' }}>
                            TOTAL
                          </td>
                          {pivotData.hotels.map((hotelName, hotelIdx) => {
                            const usdTotal = getHotelGrandTotal(hotelName, 'usd');
                            const uzsTotal = getHotelGrandTotal(hotelName, 'uzs');
                            const displayTotal = uzsTotal > 0 ? uzsTotal : usdTotal;
                            const isUZS = uzsTotal > 0;

                            return (
                              <td
                                key={hotelIdx}
                                className="px-4 py-3 text-center text-sm text-gray-900"
                                style={{
                                  backgroundColor: hotelIdx % 2 === 0 ? '#f3f4f6' : '#e5e7eb'
                                }}
                              >
                                {isUZS
                                  ? formatNumber(displayTotal)
                                  : `$${formatNumber(displayTotal)}`
                                }
                              </td>
                            );
                          })}
                          <td className="px-4 py-3 text-center text-sm text-gray-900 bg-yellow-100 font-bold">
                            {formatNumber(getGrandTotalUZS())}
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-900 bg-blue-100 font-bold">
                            ${formatNumber(getGrandTotalUSD())}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
