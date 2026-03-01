import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { bookingsApi, touristsApi, routesApi, railwaysApi, flightsApi, tourServicesApi, transportApi, opexApi } from '../services/api';
import { useYear } from '../context/YearContext';
import toast from 'react-hot-toast';
import { Hotel, BarChart3, Users, Truck } from 'lucide-react';

const tourTypeModules = [
  { code: 'ALL', name: 'Barcha gruppalar', color: '#E5E7EB' },
  { code: 'ER', name: 'Erlebnisreisen', color: '#3B82F6' },
  { code: 'CO', name: 'Comfort', color: '#10B981' },
  { code: 'KAS', name: 'Karawanen Seidenstrasse', color: '#F59E0B' },
  { code: 'ZA', name: 'Zentralasien', color: '#8B5CF6' }
];

const expenseTabs = [
  { id: 'general',   name: 'General',   icon: BarChart3 },
  { id: 'hotels',    name: 'Hotels',    icon: Hotel },
  { id: 'transport', name: 'Transport', icon: Truck },
  { id: 'guides',    name: 'Guides',    icon: Users },
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

  // Cache: { tourTypeCode: { bookings: [], detailedData: [] } }
  const [cache, setCache] = useState({});
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    loadBookingsAndExpenses();
  }, [activeTourType, selectedYear]);

  const handleRefresh = () => {
    // Clear localStorage cache for current tour+year
    const cacheKey = `ausgaben_cache_v5_${activeTourType}_${selectedYear}`;
    localStorage.removeItem(cacheKey);
    // Clear in-memory cache
    setCache({});
    loadBookingsAndExpenses();
  };

  const loadBookingsAndExpenses = async () => {
    // Check cache first
    const cacheKey = `${activeTourType}_${selectedYear}`;
    const needsDetailedData = ['general', 'hotels', 'guides', 'transport'].includes(activeExpenseTab);

    // Try localStorage first (persists across page reloads)
    try {
      const localStorageKey = `ausgaben_cache_v5_${cacheKey}`;
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
    if (cache[cacheKey]?.bookings && (!needsDetailedData || cache[cacheKey]?.detailedData)) {
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
        const localStorageKey = `ausgaben_cache_v5_${cacheKey}`;
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

  // Core computation — pure, no state side effects
  const computeDetailedDataRaw = async (bookingsData, metroVehiclesData) => {
    const detailedData = await Promise.all(bookingsData.map(async (booking) => {
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
    return detailedData.filter(d => d !== null);
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
      const validData = await computeDetailedDataRaw(bookingsData, metroVehiclesData);
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

    // Load Meals from database (OPEX API)
    try {
      const response = await opexApi.get(tourTypeCode.toUpperCase(), 'meal');
      const mealsData = response.data?.items || [];
      if (mealsData.length > 0) {
        expenses.meals = mealsData.reduce((sum, meal) => {
          const priceStr = (meal.price || meal.pricePerPerson || '0').toString().replace(/\s/g, '');
          const pricePerPerson = parseFloat(priceStr) || 0;
          return sum + (pricePerPerson * pax);
        }, 0);
      }
    } catch (e) {
      console.error('  ❌ Error loading meals:', e);
    }

    // ADD Shows from database (OPEX API) (in addition to tourServices)
    try {
      const response = await opexApi.get(tourTypeCode.toUpperCase(), 'shows');
      const showsData = response.data?.items || [];
      if (showsData.length > 0) {
        const opexShows = showsData.reduce((sum, show) => {
          const rawPrice = show.price || show.pricePerPerson || 0;
          const priceStr = rawPrice.toString().replace(/\s/g, '');
          const pricePerPerson = parseFloat(priceStr) || 0;
          return sum + (pricePerPerson * pax);
        }, 0);
        expenses.shou += opexShows; // ADD to existing tourServices value
      }
    } catch (e) {
      console.error('  ❌ Error loading shows:', e);
    }

    // ADD Eintritt from database (OPEX API) (in addition to tourServices)
    try {
      const response = await opexApi.get(tourTypeCode.toUpperCase(), 'sightseeing');
      const sightseeingData = response.data?.items || [];
      if (sightseeingData.length > 0) {
        const opexEintritt = sightseeingData.reduce((sum, item) => {
          const pricePerPerson = parseFloat((item.price || '0').toString().replace(/\s/g, '')) || 0;
          return sum + (pricePerPerson * pax);
        }, 0);
        expenses.eintritt += opexEintritt; // ADD to existing tourServices value
      }
    } catch (e) {
      console.error('  ❌ Error loading sightseeing:', e);
    }


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
    return 0; // guides is USD only
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

  const tabGradients = {
    general:   { from: '#6366f1', to: '#8b5cf6', light: '#eef2ff' },
    hotels:    { from: '#7c3aed', to: '#a855f7', light: '#f5f3ff' },
    transport: { from: '#1d4ed8', to: '#3b82f6', light: '#eff6ff' },
    guides:    { from: '#047857', to: '#10b981', light: '#ecfdf5' },
  };
  const activeTabGrad = tabGradients[activeExpenseTab] || tabGradients.general;

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
    <div className="min-h-screen" style={{ background: '#052e16' }}>

      {/* ═══ HERO HEADER ═══ */}
      <div className="relative overflow-hidden" style={{
        background: 'linear-gradient(160deg, #14532d 0%, #166534 35%, #15803d 65%, #166534 100%)',
      }}>
        {/* Glow blobs */}
        <div className="absolute top-0 right-0 rounded-full pointer-events-none"
          style={{ width: '600px', height: '600px', background: activeModule?.color, opacity: 0.22, filter: 'blur(90px)', transform: 'translate(40%,-40%)' }} />
        <div className="absolute bottom-0 left-0 rounded-full pointer-events-none"
          style={{ width: '400px', height: '400px', background: '#10b981', opacity: 0.25, filter: 'blur(70px)', transform: 'translate(-30%,40%)' }} />
        {/* Shimmer */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 60% 80% at 50% 50%, rgba(255,255,255,0.06) 0%, transparent 70%)' }} />

        <div className="relative px-6 pt-7 pb-6">
          {/* Eyebrow */}
          <div className="flex items-center gap-2 mb-5">
            <span className="text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
              style={{ background: `${activeModule?.color}35`, color: 'white', border: `1px solid ${activeModule?.color}60` }}>
              {activeModule?.code}
            </span>
            <span className="text-green-300 text-xs opacity-70">›</span>
            <span className="text-green-200 text-xs font-medium opacity-80">{activeModule?.name}</span>
          </div>

          {/* Title + Quick Totals */}
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <h1 className="text-5xl font-black text-white tracking-tight leading-none" style={{ textShadow: '0 0 40px rgba(255,255,255,0.25)' }}>Ausgaben</h1>
              <p className="text-green-200 text-sm mt-2 opacity-75">Barcha xarajatlar va to'lovlar tahlili</p>
            </div>
            {!loading && (
              <div className="flex gap-4">
                <div className="text-right">
                  <p className="text-xs text-green-200 mb-0.5 uppercase tracking-wider opacity-70">Jami USD</p>
                  <p className="text-2xl font-black text-white">
                    ${formatNumber(filteredBookingsWithHotels.reduce((sum,b)=>{const e=b.expenses||{};return sum+(e.hotelsUSD||0)+(e.guide||0);},0))}
                  </p>
                </div>
                <div className="w-px" style={{ background: 'rgba(255,255,255,0.2)' }} />
                <div className="text-right">
                  <p className="text-xs text-green-200 mb-0.5 uppercase tracking-wider opacity-70">Jami UZS</p>
                  <p className="text-2xl font-black text-amber-400">
                    {formatNumber(filteredBookingsWithHotels.reduce((sum,b)=>{const e=b.expenses||{};return sum+(e.hotelsUZS||0)+(e.transportSevil||0)+(e.transportXayrulla||0)+(e.transportNosir||0)+(e.railway||0)+(e.flights||0)+(e.meals||0)+(e.eintritt||0)+(e.metro||0)+(e.shou||0)+(e.other||0);},0))}
                  </p>
                </div>
                <div className="w-px" style={{ background: 'rgba(255,255,255,0.2)' }} />
                <div className="flex flex-col items-end justify-center gap-1.5">
                  <button onClick={handleRefresh} disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)' }}
                    onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.25)'}
                    onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.15)'}>
                    {loading ? '⏳ Yuklanmoqda...' : '🔄 Yangilash'}
                  </button>
                  {lastUpdated && !loading && (
                    <p className="text-xs opacity-50 text-green-100">
                      {lastUpdated.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Tour Type Cards */}
          <div className="grid grid-cols-5 gap-3">
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
                  onClick={() => updateParams({ tour: module.code })}
                  className="relative overflow-hidden rounded-2xl p-4 text-left transition-all duration-300 group"
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
                  <p className="text-2xl font-black leading-none"
                    style={{ color: isActive ? activeColor : inactiveColor }}>
                    {isTotal ? 'TOTAL' : module.code}
                  </p>
                  <p className="text-xs mt-1.5 font-medium leading-tight"
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
        <div className="px-6 py-6">

          {/* Main Content Card */}
          <div className="rounded-2xl overflow-hidden shadow-lg border border-white/40" style={{ background: 'white' }}>

            {/* Sub-tabs */}
            <div className="flex" style={{ background: '#f0fdf4', borderBottom: '2px solid #bbf7d0' }}>
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
                              <th rowSpan="2" className="px-2 py-3.5 text-center font-bold text-slate-700 uppercase tracking-wider border-r border-blue-200"
                                style={{ background: '#dbeafe' }}>#</th>
                              <th rowSpan="2" className="px-2 py-3.5 text-left font-bold text-slate-700 uppercase tracking-wider border-r border-blue-200"
                                style={{ background: '#dbeafe' }}>Booking</th>
                              <th colSpan="2" className="px-2 py-2 text-center font-bold text-slate-700 uppercase tracking-wider border-r border-blue-200"
                                style={{ background: '#bfdbfe' }}>🏨 Hotels</th>
                              <th colSpan="3" className="px-2 py-2 text-center font-bold text-slate-700 uppercase tracking-wider border-r border-blue-200"
                                style={{ background: '#bfdbfe' }}>🚌 Transport</th>
                              <th rowSpan="2" className="px-2 py-3.5 text-center font-bold text-slate-700 uppercase tracking-wider border-r border-blue-200"
                                style={{ background: '#dbeafe' }}>🚂 Train</th>
                              <th rowSpan="2" className="px-2 py-3.5 text-center font-bold text-slate-700 uppercase tracking-wider border-r border-blue-200"
                                style={{ background: '#dbeafe' }}>✈️ Flights</th>
                              <th rowSpan="2" className="px-2 py-3.5 text-center font-bold text-slate-700 uppercase tracking-wider border-r border-blue-200"
                                style={{ background: '#dbeafe' }}>👤 Guide</th>
                              <th rowSpan="2" className="px-2 py-3.5 text-center font-bold text-slate-700 uppercase tracking-wider border-r border-blue-200"
                                style={{ background: '#dbeafe' }}>🍽 Meals</th>
                              <th rowSpan="2" className="px-2 py-3.5 text-center font-bold text-slate-700 uppercase tracking-wider border-r border-blue-200"
                                style={{ background: '#dbeafe' }}>🎫 Eintritt</th>
                              <th rowSpan="2" className="px-2 py-3.5 text-center font-bold text-slate-700 uppercase tracking-wider border-r border-blue-200"
                                style={{ background: '#dbeafe' }}>🚇 Metro</th>
                              <th rowSpan="2" className="px-2 py-3.5 text-center font-bold text-slate-700 uppercase tracking-wider border-r border-blue-200"
                                style={{ background: '#dbeafe' }}>🎭 Shou</th>
                              <th rowSpan="2" className="px-2 py-3.5 text-center font-bold text-slate-700 uppercase tracking-wider border-r border-blue-200"
                                style={{ background: '#dbeafe' }}>Other</th>
                              <th rowSpan="2" className="px-3 py-3.5 text-center font-bold text-white uppercase tracking-wider border-r border-amber-700"
                                style={{ background: 'linear-gradient(180deg,#b45309,#d97706)' }}>Σ UZS</th>
                              <th rowSpan="2" className="px-3 py-3.5 text-center font-bold text-white uppercase tracking-wider"
                                style={{ background: 'linear-gradient(180deg,#065f46,#059669)' }}>Σ USD</th>
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
                      </>
                    )}
                  </div>
                )}

                {/* ── HOTELS TAB ── */}
                {activeExpenseTab === 'hotels' && (
                  <div className="overflow-x-auto">
                    {bookingsDetailedData.length === 0 ? (
                      <EmptyState icon={Hotel} label={`${activeModule?.name} uchun mehmonxona ma'lumoti yo'q`} />
                    ) : (() => {
                      const pivotData = getPivotData();
                      return (
                        <table className="min-w-full text-xs">
                          <thead>
                            <tr>
                              <th className="px-4 py-3.5 text-center font-bold text-slate-700 w-10 border-r border-blue-200"
                                style={{ background: '#dbeafe' }}>#</th>
                              <th className="px-4 py-3.5 text-left font-bold text-slate-700 sticky left-0 z-10 border-r border-blue-200"
                                style={{ background: '#dbeafe', minWidth: '130px' }}>Booking</th>
                              {pivotData.hotels.map((hotelName, idx) => (
                                <th key={idx} className="px-4 py-3.5 text-center font-bold text-slate-700 uppercase tracking-wider border-r border-blue-200"
                                  style={{ minWidth: '120px', background: '#dbeafe' }}>
                                  {hotelName}
                                </th>
                              ))}
                              <th className="px-4 py-3.5 text-center font-bold text-white uppercase tracking-wider border-r border-amber-700"
                                style={{ background: 'linear-gradient(180deg,#b45309,#d97706)' }}>Σ UZS</th>
                              <th className="px-4 py-3.5 text-center font-bold text-white uppercase tracking-wider"
                                style={{ background: 'linear-gradient(180deg,#065f46,#059669)' }}>Σ USD</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pivotData.bookingRows.map((bookingRow, bookingIdx) => {
                              const rowBg = bookingIdx % 2 === 0 ? '#ffffff' : '#f8fafc';
                              return (
                                <tr key={bookingIdx} style={{ background: rowBg }}
                                  onMouseEnter={e => e.currentTarget.style.background='#eff6ff'}
                                  onMouseLeave={e => e.currentTarget.style.background=rowBg}>
                                  <td className="px-4 py-2.5 text-center text-slate-400 border-r border-slate-100">{bookingIdx+1}</td>
                                  <td className="px-4 py-2.5 sticky left-0 z-10 border-r border-slate-100" style={{ background: rowBg }}>
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
                                      <td key={hotelIdx} className="px-4 py-2.5 text-center border-r border-slate-100">
                                        {val>0
                                          ? <span className="font-semibold text-gray-800">{isUZS ? formatNumber(val) : `$${formatNumber(val)}`}</span>
                                          : <span className="text-slate-300">—</span>}
                                      </td>
                                    );
                                  })}
                                  <td className="px-4 py-2.5 text-center border-r border-slate-100">
                                    <span className="font-black text-gray-800">{formatNumber(bookingRow.totalUZS)}</span>
                                  </td>
                                  <td className="px-4 py-2.5 text-center">
                                    <span className="font-black text-gray-800">${formatNumber(bookingRow.totalUSD)}</span>
                                  </td>
                                </tr>
                              );
                            })}
                            <tr style={{ background: '#dcfce7', borderTop: '2px solid #86efac' }}>
                              <td className="px-4 py-3.5 border-r border-green-200"></td>
                              <td className="px-4 py-3.5 text-xs font-black text-green-800 uppercase tracking-widest sticky left-0 z-10 border-r border-green-200"
                                style={{ background: '#dcfce7' }}>TOTAL</td>
                              {pivotData.hotels.map((hotelName, hotelIdx) => {
                                const usd = getHotelGrandTotal(hotelName,'usd');
                                const uzs = getHotelGrandTotal(hotelName,'uzs');
                                const val = uzs>0 ? uzs : usd;
                                const isUZS = uzs>0;
                                return (
                                  <td key={hotelIdx} className="px-4 py-3.5 text-center border-r border-green-200">
                                    <span className="font-black text-xs text-green-900">
                                      {isUZS ? formatNumber(val) : `$${formatNumber(val)}`}
                                    </span>
                                  </td>
                                );
                              })}
                              <td className="px-4 py-3.5 text-center text-xs font-black text-sky-900 border-r border-sky-300"
                                style={{ background: '#bae6fd' }}>
                                {formatNumber(getGrandTotalUZS())}
                              </td>
                              <td className="px-4 py-3.5 text-center text-xs font-black text-sky-900"
                                style={{ background: '#bae6fd' }}>
                                ${formatNumber(getGrandTotalUSD())}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      );
                    })()}
                  </div>
                )}

                {/* ── GUIDES TAB ── */}
                {activeExpenseTab === 'guides' && (
                  <div className="w-full">
                    {bookingsDetailedData.length === 0 ? (
                      <EmptyState icon={Users} label={`${activeModule?.name} uchun gid ma'lumoti yo'q`} />
                    ) : (
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
                          {filteredBookingsWithHotels.map((item, idx) => {
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
                    )}
                  </div>
                )}

                {/* ── TRANSPORT TAB ── */}
                {activeExpenseTab === 'transport' && (
                  <div className="overflow-x-auto">
                    {bookingsDetailedData.length === 0 ? (
                      <EmptyState icon={Truck} label={`${activeModule?.name} uchun transport ma'lumoti yo'q`} />
                    ) : (
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
                            <th className="px-4 py-3.5 text-center font-bold text-white"
                              style={{ background: 'linear-gradient(180deg,#065f46,#059669)' }}>Total (USD)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredBookingsWithHotels.map((item, idx) => {
                            const sevil=item.expenses?.transportSevil||0;
                            const xayrulla=item.expenses?.transportXayrulla||0;
                            const total=sevil+xayrulla;
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
                                <td className="px-4 py-2.5 text-center">
                                  {total>0 ? <span className="font-black text-gray-900">${formatNumber(total)}</span> : <span className="text-slate-200">—</span>}
                                </td>
                              </tr>
                            );
                          })}
                          <tr style={{ background: '#dcfce7', borderTop: '2px solid #86efac' }}>
                            <td className="px-4 py-3.5 border-r border-green-200"></td>
                            <td className="px-4 py-3.5 text-xs font-black text-green-800 uppercase tracking-widest border-r border-green-200">TOTAL</td>
                            {['transportSevil','transportXayrulla'].map(key => (
                              <td key={key} className="px-4 py-3.5 text-center text-xs font-black text-green-900 border-r border-green-200">
                                {formatNumber(filteredBookingsWithHotels.reduce((s,i)=>s+(i.expenses?.[key]||0),0))}
                              </td>
                            ))}
                            <td className="px-4 py-3.5 text-center text-xs font-black text-green-900">
                              ${formatNumber(filteredBookingsWithHotels.reduce((s,i)=>s+(i.expenses?.transportSevil||0)+(i.expenses?.transportXayrulla||0),0))}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
