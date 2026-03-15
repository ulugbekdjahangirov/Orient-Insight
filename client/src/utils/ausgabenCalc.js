/**
 * Shared calculation logic extracted from Ausgaben.jsx
 * Used by both Ausgaben page and Dashboard for consistent totals
 */

export const calculateGrandTotal = (accommodations, tourists, accommodationRoomingLists) => {
  if (!accommodations?.length) return null;

  let grandTotalUSD = 0;
  let grandTotalUZS = 0;
  const hotelBreakdown = [];

  accommodations.forEach(acc => {
    if (!acc.rooms?.length || !acc.checkInDate || !acc.checkOutDate) return;

    let accTourists = accommodationRoomingLists?.[acc.id] || [];

    if (accTourists.length === 0) {
      accTourists = (tourists || []).filter(t => {
        if (!t.hotelName || !acc.hotel?.name) return false;
        const hotelFirstWord = acc.hotel.name.toLowerCase().split(' ')[0];
        if (!t.hotelName.toLowerCase().includes(hotelFirstWord)) return false;
        if (t.checkInDate && t.checkOutDate && acc.checkInDate && acc.checkOutDate) {
          const ti = new Date(t.checkInDate); ti.setHours(0,0,0,0);
          const to = new Date(t.checkOutDate); to.setHours(0,0,0,0);
          const ai = new Date(acc.checkInDate); ai.setHours(0,0,0,0);
          const ao = new Date(acc.checkOutDate); ao.setHours(0,0,0,0);
          return ti < ao && to > ai;
        }
        return true;
      });
    }

    if (accTourists.length === 0) return;

    const accCheckIn = new Date(acc.checkInDate); accCheckIn.setHours(0,0,0,0);
    const accCheckOut = new Date(acc.checkOutDate); accCheckOut.setHours(0,0,0,0);

    const guestNightsPerRoomType = {};
    accTourists.forEach(tourist => {
      const checkIn = tourist.checkInDate ? new Date(tourist.checkInDate) : accCheckIn;
      const checkOut = tourist.checkOutDate ? new Date(tourist.checkOutDate) : accCheckOut;
      checkIn.setHours(0,0,0,0); checkOut.setHours(0,0,0,0);
      const nights = Math.max(0, Math.round((checkOut - checkIn) / 86400000));
      let rt = (tourist.roomPreference || '').toUpperCase();
      if (rt === 'DOUBLE' || rt === 'DZ') rt = 'DBL';
      if (rt === 'TWIN') rt = 'TWN';
      if (rt === 'SINGLE' || rt === 'EZ') rt = 'SNGL';
      guestNightsPerRoomType[rt] = (guestNightsPerRoomType[rt] || 0) + nights;
    });

    let hotelCurrency = acc.hotel?.roomTypes?.[0]?.currency || 'UZS';
    if (acc.rooms?.length > 0) {
      const firstRoomPrice = parseFloat(acc.rooms[0].pricePerNight) || 0;
      if (firstRoomPrice > 10000) hotelCurrency = 'UZS';
      else if (firstRoomPrice > 0) hotelCurrency = 'USD';
    }

    let hotelTotalUSD = 0;
    let hotelTotalUZS = 0;

    acc.rooms.forEach(room => {
      const pricePerNight = parseFloat(room.pricePerNight) || 0;
      let rt = room.roomTypeCode?.toUpperCase();
      if (rt === 'DOUBLE') rt = 'DBL';
      if (rt === 'TWIN') rt = 'TWN';
      if (rt === 'SINGLE') rt = 'SNGL';

      const guestNights = guestNightsPerRoomType[rt] || 0;
      if (guestNights === 0 && rt !== 'PAX') return;

      let roomNights;
      if (rt === 'PAX') roomNights = guestNights || accTourists.length;
      else if (rt === 'TWN' || rt === 'DBL') roomNights = guestNights / 2;
      else roomNights = guestNights;

      const roomCost = roomNights * pricePerNight;
      if (hotelCurrency === 'USD' || hotelCurrency === 'EUR') {
        grandTotalUSD += roomCost; hotelTotalUSD += roomCost;
      } else {
        grandTotalUZS += roomCost; hotelTotalUZS += roomCost;
      }
    });

    hotelBreakdown.push({
      accommodationId: acc.id,
      hotel: acc.hotel?.name,
      USD: hotelTotalUSD,
      UZS: hotelTotalUZS
    });
  });

  if (grandTotalUSD === 0 && grandTotalUZS === 0) return null;
  return { hotelBreakdown, grandTotalUSD, grandTotalUZS };
};

const getDefaultDays = (code) => {
  if (code === 'er' || code === 'co') return { fullDays: 12, halfDays: 1 };
  if (code === 'kas') return { fullDays: 8, halfDays: 1 };
  if (code === 'za') return { fullDays: 5, halfDays: 1 };
  return { fullDays: 0, halfDays: 0 };
};

export const calculateExpenses = (booking, tourists, grandTotalData, routes, railways, flights, tourServices = [], metroVehicles = [], opexCache = {}) => {
  const pax = tourists?.length || 0;
  const tourTypeCode = booking?.tourType?.code?.toLowerCase() || 'er';

  let mainGuide = null;
  let secondGuide = null;
  let bergreiseleiter = null;

  try {
    if (booking.mainGuideData) {
      const mgData = typeof booking.mainGuideData === 'string' ? JSON.parse(booking.mainGuideData) : booking.mainGuideData;
      if (mgData) {
        const dr = mgData.dayRate || mgData.guide?.dayRate || 110;
        const hdr = mgData.halfDayRate || mgData.guide?.halfDayRate || 55;
        let fd = mgData.fullDays || 0; let hd = mgData.halfDays || 0;
        if (fd === 0 && hd === 0 && mgData.guide) { const d = getDefaultDays(tourTypeCode); fd = d.fullDays; hd = d.halfDays; }
        const tot = (fd * dr) + (hd * hdr);
        if (tot > 0) mainGuide = { totalPayment: tot };
      }
    }
  } catch {}

  try {
    if (booking.additionalGuides && typeof booking.additionalGuides === 'string') {
      const ag = JSON.parse(booking.additionalGuides);
      secondGuide = ag[0] || null;
      if (secondGuide) {
        const dr = secondGuide.dayRate || secondGuide.guide?.dayRate || 110;
        const hdr = secondGuide.halfDayRate || secondGuide.guide?.halfDayRate || 55;
        const fd = secondGuide.fullDays || 0; const hd = secondGuide.halfDays || 0;
        if (fd > 0 || hd > 0) secondGuide.totalPayment = (fd * dr) + (hd * hdr);
      }
    }
  } catch {}

  try {
    bergreiseleiter = booking.bergreiseleiter
      ? (typeof booking.bergreiseleiter === 'string' ? JSON.parse(booking.bergreiseleiter) : booking.bergreiseleiter)
      : null;
    if (bergreiseleiter && !bergreiseleiter.totalPayment) {
      const dr = bergreiseleiter.dayRate || bergreiseleiter.guide?.dayRate || 50;
      const hdr = bergreiseleiter.halfDayRate || bergreiseleiter.guide?.halfDayRate || 0;
      bergreiseleiter.totalPayment = ((bergreiseleiter.fullDays || 0) * dr) + ((bergreiseleiter.halfDays || 0) * hdr);
    }
  } catch {}

  if (!mainGuide) {
    const dr = booking.guide?.dayRate || 110;
    const hdr = booking.guide?.halfDayRate || 55;
    let fd = booking.guideFullDays || 0; let hd = booking.guideHalfDays || 0;
    if (booking.guide && fd === 0 && hd === 0) { const d = getDefaultDays(tourTypeCode); fd = d.fullDays; hd = d.halfDays; }
    if (fd > 0 || hd > 0) mainGuide = { totalPayment: (fd * dr) + (hd * hdr) };
  }

  const ttUpper = tourTypeCode.toUpperCase();
  const cachedOpex = opexCache[ttUpper] || {};
  const mealsData = cachedOpex.meal || [];
  const showsData = cachedOpex.shows || [];
  const sightsData = cachedOpex.sightseeing || [];

  const meals = mealsData.reduce((s, m) => s + (parseFloat((m.price || m.pricePerPerson || '0').toString().replace(/\s/g, '')) || 0) * pax, 0);
  const opexShou = showsData.reduce((s, sh) => s + (parseFloat((sh.price || sh.pricePerPerson || '0').toString().replace(/\s/g, '')) || 0) * pax, 0);
  const opexEintritt = sightsData.reduce((s, it) => s + (parseFloat((it.price || '0').toString().replace(/\s/g, '')) || 0) * pax, 0);

  const metroTotal = tourTypeCode === 'za' ? 0 : (metroVehicles || []).reduce((s, m) => {
    const p = parseFloat((m.economPrice || m.price || m.pricePerPerson || 0).toString().replace(/\s/g, '')) || 0;
    return s + p * (pax + 1);
  }, 0);

  return {
    hotelsUSD: grandTotalData?.grandTotalUSD || 0,
    hotelsUZS: grandTotalData?.grandTotalUZS || 0,
    transportSevil: routes.filter(r => r.provider?.toLowerCase().includes('sevil')).reduce((s, r) => s + (r.price || 0), 0),
    transportXayrulla: routes.filter(r => r.provider?.toLowerCase().includes('xayrulla')).reduce((s, r) => s + (r.price || 0), 0),
    transportNosir: routes.filter(r => r.provider?.toLowerCase().includes('nosir')).reduce((s, r) => s + (r.price || 0), 0),
    railway: railways.reduce((s, r) => s + (r.price || 0), 0),
    flights: flights.reduce((s, f) => s + (f.price || 0), 0),
    guide: (mainGuide?.totalPayment || 0) + (secondGuide?.totalPayment || 0) + (bergreiseleiter?.totalPayment || 0),
    meals,
    metro: metroTotal,
    shou: tourServices.filter(ts => ts.type?.toUpperCase() === 'SHOU').reduce((s, ts) => s + (parseFloat(ts.price) || 0), 0) + opexShou,
    eintritt: tourServices.filter(ts => ts.type?.toUpperCase() === 'EINTRITT').reduce((s, ts) => s + (parseFloat(ts.price) || 0), 0) + opexEintritt,
    other: tourServices.filter(ts => ts.type?.toUpperCase() === 'OTHER').reduce((s, ts) => s + (parseFloat(ts.price) || 0), 0),
  };
};
