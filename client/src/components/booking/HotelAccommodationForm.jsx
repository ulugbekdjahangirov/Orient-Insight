import { useState, useEffect, useMemo } from 'react';
import { bookingsApi, hotelsApi, tourTypesApi } from '../../services/api';
import toast from 'react-hot-toast';
import { Building2, X, Save, Loader2, Plus, Trash2, Wand2 } from 'lucide-react';

const emptyRoom = {
  roomTypeCode: '',
  roomsCount: 1,
  nights: 2, // Default to 2 nights, user can edit manually
  pricePerNight: 0
};

// Calculate total price including VAT and tourist tax (same as Hotels module)
const calculateTotalPrice = (roomType, hotelTotalRooms) => {
  if (!roomType) return 0;

  let basePrice = roomType.pricePerNight || 0;

  // Add VAT if enabled
  const vatAmount = roomType.vatIncluded ? basePrice * 0.12 : 0;
  let totalPrice = basePrice + vatAmount;

  // Add tourist tax if enabled
  if (roomType.touristTaxEnabled && roomType.brvValue > 0) {
    // Calculate tax percentage based on hotel's total rooms
    let taxPercentage = 0.15; // default >40 rooms
    if (hotelTotalRooms <= 10) taxPercentage = 0.05;
    else if (hotelTotalRooms <= 40) taxPercentage = 0.10;

    const guestsInRoom = roomType.maxGuests || 1;
    const taxPerRoom = roomType.brvValue * taxPercentage * guestsInRoom;

    // Convert to room currency
    if (roomType.currency === 'USD') {
      totalPrice += taxPerRoom / 12700;
    } else if (roomType.currency === 'EUR') {
      totalPrice += taxPerRoom / 13500;
    } else {
      totalPrice += taxPerRoom;
    }
  }

  return totalPrice;
};

export default function HotelAccommodationForm({
  bookingId,
  booking,
  hotels = [],
  editingAccommodation = null,
  onSave,
  onClose
}) {
  const [formData, setFormData] = useState({
    hotelId: '',
    checkInDate: booking?.departureDate?.split('T')[0] || '',
    checkOutDate: booking?.endDate?.split('T')[0] || ''
  });

  const [rooms, setRooms] = useState([{ ...emptyRoom }]);
  const [accommodationRoomTypes, setAccommodationRoomTypes] = useState([]);
  const [selectedHotelRoomTypes, setSelectedHotelRoomTypes] = useState([]); // Room types from selected hotel
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tourItinerary, setTourItinerary] = useState([]);
  const [showItineraryHotels, setShowItineraryHotels] = useState(false);
  const [tourists, setTourists] = useState([]);
  const [roomingList, setRoomingList] = useState([]);
  const [guestDates, setGuestDates] = useState({}); // Track individual guest check-in/out dates

  // Load accommodation room types dictionary, tour itinerary, and tourists on mount
  useEffect(() => {
    loadAccommodationRoomTypes();
    loadTourists();
    if (booking?.tourTypeId) {
      loadTourItinerary();
    }
  }, [booking?.tourTypeId, bookingId]);

  const loadTourists = async () => {
    try {
      const response = await bookingsApi.getTourists(bookingId);
      const touristsList = response.data.tourists || [];
      setTourists(touristsList);
    } catch (error) {
      console.error('Error loading tourists for accommodation form:', error);
    }
  };

  const loadRoomingList = async (accommodationId) => {
    if (!accommodationId) return;
    try {
      const response = await bookingsApi.getRoomingList(bookingId, accommodationId);
      const roomingData = response.data.roomingList || [];
      console.log(`📥 Loaded rooming list for accommodation ${accommodationId}:`, {
        count: roomingData.length,
        tourists: roomingData.map(t => ({name: t.fullName || `${t.firstName} ${t.lastName}`, accommodation: t.accommodation}))
      });
      // Check Baetgen's raw data from API
      const baetgen = roomingData.find(t => t.fullName?.includes('Baetgen'));
      if (baetgen) {
        console.log('🔍 Baetgen RAW from API:', JSON.stringify({
          checkInDate: baetgen.checkInDate,
          checkOutDate: baetgen.checkOutDate
        }));
      }
      setRoomingList(roomingData);

      // Auto-fill from rooming list after loading (for existing accommodations)
      console.log('🔄 Triggering auto-fill after rooming list loaded');
      setTimeout(() => {
        if (formData.hotelId && selectedHotelRoomTypes.length > 0) {
          console.log('🎯 Auto-filling from rooming list (after load)');
          autoFillFromRoomingList();
        } else {
          console.log('⚠️ Waiting for hotel room types to load...');
        }
      }, 500); // Small delay to ensure selectedHotelRoomTypes is loaded
    } catch (error) {
      console.error('Error loading rooming list for accommodation:', error);
    }
  };

  const loadAccommodationRoomTypes = async () => {
    try {
      const response = await bookingsApi.getAccommodationRoomTypes();
      setAccommodationRoomTypes(response.data.roomTypes || []);
    } catch (error) {
      console.error('Error loading room types:', error);
    }
  };

  const loadTourItinerary = async () => {
    if (!booking?.tourTypeId) return;
    try {
      const response = await tourTypesApi.getItinerary(booking.tourTypeId);
      setTourItinerary(response.data.itinerary || []);
    } catch (error) {
      console.error('Error loading tour itinerary:', error);
    }
  };

  // Initialize form with editing data
  useEffect(() => {
    if (editingAccommodation) {
      setFormData({
        hotelId: editingAccommodation.hotelId?.toString() || '',
        checkInDate: editingAccommodation.checkInDate?.split('T')[0] || '',
        checkOutDate: editingAccommodation.checkOutDate?.split('T')[0] || ''
      });

      // Load existing rooms
      if (editingAccommodation.rooms && editingAccommodation.rooms.length > 0) {
        // Calculate accommodation nights for default value
        const accCheckIn = new Date(editingAccommodation.checkInDate);
        const accCheckOut = new Date(editingAccommodation.checkOutDate);
        const defaultNights = Math.max(1, Math.ceil((accCheckOut - accCheckIn) / (1000 * 60 * 60 * 24)));

        setRooms(editingAccommodation.rooms.map(room => ({
          roomTypeCode: room.roomTypeCode || '',
          roomsCount: room.roomsCount || 1,
          nights: room.nights || defaultNights, // Use saved nights or default to accommodation nights
          pricePerNight: room.pricePerNight || 0
        })));
      }

      // Load hotel room types for existing accommodation
      if (editingAccommodation.hotelId) {
        loadHotelRoomTypes(editingAccommodation.hotelId);
      }

      // Load rooming list for this accommodation
      if (editingAccommodation.id) {
        loadRoomingList(editingAccommodation.id);
      }
    }
  }, [editingAccommodation]);

  // Load hotel room types when hotel changes
  const loadHotelRoomTypes = async (hotelId) => {
    if (!hotelId) {
      setSelectedHotelRoomTypes([]);
      return;
    }
    try {
      const response = await hotelsApi.getRoomTypes(hotelId);
      setSelectedHotelRoomTypes(response.data.roomTypes || []);
    } catch (error) {
      console.error('Error loading hotel room types:', error);
      setSelectedHotelRoomTypes([]);
    }
  };

  // Auto-fill from rooming list when it loads - ALWAYS recalculate for existing accommodations
  useEffect(() => {
    console.log('📋 useEffect triggered - roomingList:', roomingList.length, 'hotelId:', formData.hotelId, 'roomTypes:', selectedHotelRoomTypes.length);

    // Always auto-fill from rooming list if available (for both new and existing accommodations)
    // This ensures Baetgen extra nights are always included, even if not saved in database
    if (roomingList.length > 0 && formData.hotelId && selectedHotelRoomTypes.length > 0) {
      console.log('🎯 Auto-filling from rooming list on modal open (recalculating)');
      // Small delay to ensure all data is loaded
      const timer = setTimeout(() => {
        autoFillFromRoomingList();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      console.log('⚠️ Not auto-filling - missing data');
    }
  }, [roomingList, selectedHotelRoomTypes]);

  // Calculate nights
  const nights = useMemo(() => {
    if (!formData.checkInDate || !formData.checkOutDate) return 0;
    const checkIn = new Date(formData.checkInDate);
    const checkOut = new Date(formData.checkOutDate);
    return Math.max(0, Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24)));
  }, [formData.checkInDate, formData.checkOutDate]);

  // Get maxGuests for a room type code from dictionary
  const getMaxGuestsForRoomType = (roomTypeCode) => {
    const rt = accommodationRoomTypes.find(r => r.code === roomTypeCode);
    return rt?.maxGuests || 1;
  };

  // Calculate totals
  const totals = useMemo(() => {
    let totalRooms = 0;
    let totalGuests = 0;
    let totalCost = 0;
    let totalTouristTax = 0; // Tourist tax in UZS
    let isPAX = false;
    let currency = 'USD';

    // Get selected hotel for tourist tax calculation
    const selectedHotel = hotels.find(h => h.id === parseInt(formData.hotelId));
    const hotelTotalRooms = selectedHotel?.totalRooms || 0;

    // Calculate tourist tax percentage based on hotel's total rooms
    const getTouristTaxPercentage = (totalRooms) => {
      if (totalRooms <= 10) return 0.05;
      if (totalRooms <= 40) return 0.10;
      return 0.15;
    };

    const taxPercentage = getTouristTaxPercentage(hotelTotalRooms);

    // Use roomingList if loaded (has hotel-specific dates), otherwise use tourists
    const dataSource = roomingList.length > 0 ? roomingList : tourists;
    const hasRoomingData = dataSource.length > 0 && formData.checkInDate && formData.checkOutDate;

    console.log(`\n🏨 Calculating cost for hotel:`, selectedHotel?.name);
    console.log(`   Data source: ${roomingList.length > 0 ? 'roomingList' : 'tourists'} (${dataSource.length} entries)`);
    console.log(`   Hotel dates: ${formData.checkInDate} → ${formData.checkOutDate}`);

    // Calculate room-nights from rooming list (per room type)
    const roomNightsFromRoomingList = {};
    const guestNightsFromRoomingList = {}; // For tourist tax calculation

    if (hasRoomingData) {
      const accCheckIn = new Date(formData.checkInDate);
      accCheckIn.setHours(0, 0, 0, 0);
      const accCheckOut = new Date(formData.checkOutDate);
      accCheckOut.setHours(0, 0, 0, 0);

      // Iterate over data source (roomingList has hotel-specific dates already merged)
      dataSource.forEach(tourist => {
        let touristCheckInDate, touristCheckOutDate;

        // CRITICAL FOR ER TOURS: Date priority order for cost calculation
        // PRIORITY 1: If roomingList has dates (adjusted by backend), use them directly
        // Backend already calculates UZ tourists in TM hotels with -1 day checkout
        // DO NOT MODIFY without testing ER-03 Malika Khorazm calculation
        if (tourist.checkInDate && tourist.checkOutDate) {
          touristCheckInDate = tourist.checkInDate;
          touristCheckOutDate = tourist.checkOutDate;
        }

        // PRIORITY 2: Check accommodationRoomingList for explicitly saved hotel-specific dates
        if (!touristCheckInDate || !touristCheckOutDate) {
          const accId = editingAccommodation?.id;
          if (accId && tourist.accommodationRoomingList && tourist.accommodationRoomingList.length > 0) {
            const roomingEntry = tourist.accommodationRoomingList.find(
              e => parseInt(e.accommodationId) === parseInt(accId)
            );
            if (roomingEntry) {
              if (roomingEntry.checkInDate) touristCheckInDate = roomingEntry.checkInDate;
              if (roomingEntry.checkOutDate) touristCheckOutDate = roomingEntry.checkOutDate;
            }
          }
        }

        // PRIORITY 3: Fallback to accommodation dates (default for all guests in this hotel)
        if (!touristCheckInDate) touristCheckInDate = formData.checkInDate;
        if (!touristCheckOutDate) touristCheckOutDate = formData.checkOutDate;

        // Use guestDates state first (user-edited), then rooming list dates, then accommodation dates
        const guestDateOverride = guestDates[tourist.id];
        const effectiveCheckIn = guestDateOverride?.checkIn
          ? new Date(guestDateOverride.checkIn)
          : (touristCheckInDate ? new Date(touristCheckInDate) : accCheckIn);
        const effectiveCheckOut = guestDateOverride?.checkOut
          ? new Date(guestDateOverride.checkOut)
          : (touristCheckOutDate ? new Date(touristCheckOutDate) : accCheckOut);
        effectiveCheckIn.setHours(0, 0, 0, 0);
        effectiveCheckOut.setHours(0, 0, 0, 0);

        // Calculate this guest's nights
        const guestNights = Math.max(0, Math.round((effectiveCheckOut - effectiveCheckIn) / (1000 * 60 * 60 * 24)));

        console.log(`  Guest: ${tourist.lastName || tourist.fullName}, Check-in: ${effectiveCheckIn.toISOString().split('T')[0]}, Check-out: ${effectiveCheckOut.toISOString().split('T')[0]}, Nights: ${guestNights}`);

        // Get room type and normalize it
        let roomType = (tourist.roomPreference || '').toUpperCase();
        if (roomType === 'DOUBLE' || roomType === 'DZ') roomType = 'DBL';
        if (roomType === 'TWIN') roomType = 'TWN';
        if (roomType === 'SINGLE' || roomType === 'EZ') roomType = 'SNGL';

        // Accumulate guest-nights per room type
        if (!guestNightsFromRoomingList[roomType]) {
          guestNightsFromRoomingList[roomType] = 0;
        }
        guestNightsFromRoomingList[roomType] += guestNights;
      });

      // Convert guest-nights to room-nights based on room type occupancy
      Object.keys(guestNightsFromRoomingList).forEach(roomType => {
        const guestNights = guestNightsFromRoomingList[roomType];
        let roomNights;

        // TWN and DBL: 2 guests per room
        if (roomType === 'TWN' || roomType === 'DBL') {
          roomNights = guestNights / 2; // 2 guests share 1 room
        } else {
          // SNGL, PAX, etc: 1 guest per room
          roomNights = guestNights;
        }

        roomNightsFromRoomingList[roomType] = roomNights;
        console.log(`🏨 Room type ${roomType}: ${guestNights} guest-nights → ${roomNights} room-nights`);
      });
      console.log('📊 Room nights from rooming list:', roomNightsFromRoomingList);
    }

    // Check if this is a Guesthouse/Yurta - use PAX pricing
    const isGuesthouseOrYurta = selectedHotel && (selectedHotel.stars === 'Guesthouse' || selectedHotel.stars === 'Yurta');
    const hotelPaxRoomType = selectedHotelRoomTypes.find(rt => rt.name === 'PAX');

    rooms.forEach((room, index) => {
      const roomCount = parseFloat(room.roomsCount) || 0; // Changed from parseInt to support decimal room counts (e.g., 1.5 for extra nights)
      const maxGuests = getMaxGuestsForRoomType(room.roomTypeCode);
      const pricePerNight = parseFloat(room.pricePerNight) || 0;

      // Get hotel room type for tourist tax info
      const hotelRoomType = selectedHotelRoomTypes.find(rt => rt.name === room.roomTypeCode);

      // Normalize room type code for matching
      let normalizedRoomType = room.roomTypeCode?.toUpperCase();
      if (normalizedRoomType === 'DOUBLE') normalizedRoomType = 'DBL';
      if (normalizedRoomType === 'TWIN') normalizedRoomType = 'TWN';
      if (normalizedRoomType === 'SINGLE') normalizedRoomType = 'SNGL';

      // CRITICAL FIX: Use actual room-nights from rooming list when available
      // This ensures early arrivals (like Mrs. Baetgen) are correctly calculated
      const roomNights = parseFloat(room.nights) || nights; // Use room's nights field (editable) or fallback to accommodation nights
      let effectiveRoomNights;
      let effectiveGuestNights;

      // Check if we have rooming list data for this room type
      if (hasRoomingData && roomNightsFromRoomingList[normalizedRoomType] !== undefined) {
        // Use actual room-nights from rooming list (includes early arrivals, late checkouts)
        effectiveRoomNights = roomNightsFromRoomingList[normalizedRoomType];
        effectiveGuestNights = guestNightsFromRoomingList[normalizedRoomType] || (effectiveRoomNights * maxGuests);
        console.log(`  [${index}] ${room.roomTypeCode}: Using rooming list data → ${effectiveRoomNights} room-nights × ${pricePerNight}$ = ${effectiveRoomNights * pricePerNight}$`);
      } else {
        // Fallback: calculate from room count and nights (manual input)
        effectiveRoomNights = roomCount * roomNights;
        effectiveGuestNights = roomCount * maxGuests * roomNights;
        console.log(`  [${index}] ${room.roomTypeCode} × ${roomCount}: ${roomCount} × ${roomNights} nights × ${pricePerNight}$ = ${effectiveRoomNights * pricePerNight}$`);
      }

      // Calculate room cost
      const roomCost = effectiveRoomNights * pricePerNight;

      // Check if this is a PAX room type
      if (room.roomTypeCode === 'PAX') {
        isPAX = true;
        // For PAX: roomsCount is people count, not rooms
        totalGuests += roomCount;
        totalCost += effectiveRoomNights * pricePerNight;

        if (hotelRoomType?.currency) {
          currency = hotelRoomType.currency;
        }

        // Tourist tax is already included in pricePerNight (from calculateTotalPrice)
        // No need to calculate separately
      } else {
        totalRooms += roomCount;
        totalGuests += roomCount * maxGuests;
        totalCost += effectiveRoomNights * pricePerNight;

        if (hotelRoomType?.currency) {
          currency = hotelRoomType.currency;
        }

        // Tourist tax is already included in pricePerNight (from calculateTotalPrice)
        // No need to calculate separately
      }
    });

    console.log(`  ✅ FINAL TOTAL: ${totalCost}$ (${totalRooms} rooms, ${totalGuests} guests)`);

    // For Guesthouse/Yurta: override totalCost using PAX price from hotel
    if (isGuesthouseOrYurta && hotelPaxRoomType && totalGuests > 0) {
      const paxPrice = hotelPaxRoomType.pricePerNight || 0;
      // Calculate total guest-nights from rooming list or use simple calculation
      const totalGuestNights = hasRoomingData
        ? Object.values(guestNightsFromRoomingList).reduce((sum, n) => sum + n, 0)
        : totalGuests * nights;
      totalCost = totalGuestNights * paxPrice;
      currency = hotelPaxRoomType.currency || 'USD';
      isPAX = true;
    }

    // Extra nights calculation is now integrated into the rooming list calculation above
    // Keep these for backward compatibility with display
    let extraNightsTotal = 0;
    let extraNightsDetails = [];

    // Check if this is the first accommodation (check-in within 2 days of departure)
    let isFirstAccommodation = false;
    if (booking?.departureDate && formData.checkInDate) {
      const departureDate = new Date(booking.departureDate);
      departureDate.setHours(0, 0, 0, 0);
      const checkInDate = new Date(formData.checkInDate);
      checkInDate.setHours(0, 0, 0, 0);
      const daysDiff = Math.abs((checkInDate - departureDate) / (1000 * 60 * 60 * 24));
      isFirstAccommodation = daysDiff <= 2; // Within 2 days of departure = first hotel
    }

    // Calculate extra nights details for display (compare to hotel dates)
    const shouldCalculateExtraNights = isFirstAccommodation && dataSource.length > 0 && formData.checkInDate && formData.checkOutDate;

    if (shouldCalculateExtraNights) {
      const accCheckIn = new Date(formData.checkInDate);
      accCheckIn.setHours(0, 0, 0, 0);
      const accCheckOut = new Date(formData.checkOutDate);
      accCheckOut.setHours(0, 0, 0, 0);

      dataSource.forEach(tourist => {
        let touristCheckInDate, touristCheckOutDate;

        // If using roomingList, dates are already hotel-specific
        if (roomingList.length > 0) {
          touristCheckInDate = tourist.checkInDate;
          touristCheckOutDate = tourist.checkOutDate;
        } else {
          // Using tourists fallback - check accommodationRoomingList for this accommodation
          const accId = editingAccommodation?.id;
          if (accId && tourist.accommodationRoomingList && tourist.accommodationRoomingList.length > 0) {
            const roomingEntry = tourist.accommodationRoomingList.find(
              e => parseInt(e.accommodationId) === parseInt(accId)
            );
            if (roomingEntry) {
              touristCheckInDate = roomingEntry.checkInDate;
              touristCheckOutDate = roomingEntry.checkOutDate;
            }
          }
        }

        // Skip if no custom dates
        if (!touristCheckInDate || !touristCheckOutDate) {
          return;
        }

        const touristCheckIn = new Date(touristCheckInDate);
        touristCheckIn.setHours(0, 0, 0, 0);
        const touristCheckOut = new Date(touristCheckOutDate);
        touristCheckOut.setHours(0, 0, 0, 0);

        // Check if dates overlap
        const datesOverlap = touristCheckIn <= accCheckOut && touristCheckOut >= accCheckIn;
        if (!datesOverlap) {
          return;
        }

        // Calculate extra nights before check-in
        let extraNightsBefore = 0;
        if (touristCheckIn < accCheckIn) {
          extraNightsBefore = Math.round((accCheckIn - touristCheckIn) / (1000 * 60 * 60 * 24));
        }

        // Calculate extra nights after check-out
        let extraNightsAfter = 0;
        if (touristCheckOut > accCheckOut) {
          extraNightsAfter = Math.round((touristCheckOut - accCheckOut) / (1000 * 60 * 60 * 24));
        }

        const totalExtraNights = extraNightsBefore + extraNightsAfter;

        if (totalExtraNights > 0) {
          // Find matching room price for tourist's preference
          const touristRoomType = tourist.roomPreference?.toUpperCase();
          const matchingRoom = rooms.find(r =>
            r.roomTypeCode?.toUpperCase() === touristRoomType ||
            (touristRoomType === 'SNGL' && r.roomTypeCode === 'SINGLE') ||
            (touristRoomType === 'DBL' && r.roomTypeCode === 'DOUBLE') ||
            (touristRoomType === 'EZ' && r.roomTypeCode === 'SNGL') ||
            (touristRoomType === 'DZ' && (r.roomTypeCode === 'DBL' || r.roomTypeCode === 'TWN'))
          );

          if (matchingRoom) {
            const pricePerNight = parseFloat(matchingRoom.pricePerNight) || 0;
            const extraCost = totalExtraNights * pricePerNight;
            // NOTE: Don't add to totalCost here - it's already included in rooming list calculation above
            extraNightsTotal += extraCost;
            extraNightsDetails.push({
              touristName: tourist.fullName,
              nights: totalExtraNights,
              pricePerNight,
              totalCost: extraCost,
              roomType: touristRoomType
            });
          } else {
            // Add to details even if no match found, with 0 price and warning
            extraNightsDetails.push({
              touristName: tourist.fullName,
              nights: totalExtraNights,
              pricePerNight: 0,
              totalCost: 0,
              roomType: touristRoomType,
              noMatch: true
            });
          }
        }
      });
    }

    // Build rooming list details for display
    const roomingListDetails = [];

    // Use dataSource (roomingList has hotel-specific dates, tourists as fallback)
    if (dataSource.length > 0 && formData.checkInDate && formData.checkOutDate) {
      const accCheckIn = new Date(formData.checkInDate);
      accCheckIn.setHours(0, 0, 0, 0);
      const accCheckOut = new Date(formData.checkOutDate);
      accCheckOut.setHours(0, 0, 0, 0);

      dataSource.forEach(tourist => {
        let touristCheckInDate, touristCheckOutDate;

        // CRITICAL FOR ER TOURS: Date priority order for cost calculation
        // PRIORITY 1: If roomingList has dates (adjusted by backend), use them directly
        // Backend already calculates UZ tourists in TM hotels with -1 day checkout
        // DO NOT MODIFY without testing ER-03 Malika Khorazm calculation
        if (tourist.checkInDate && tourist.checkOutDate) {
          touristCheckInDate = tourist.checkInDate;
          touristCheckOutDate = tourist.checkOutDate;
        }

        // PRIORITY 2: Check accommodationRoomingList for explicitly saved hotel-specific dates
        if (!touristCheckInDate || !touristCheckOutDate) {
          const accId = editingAccommodation?.id;
          if (accId && tourist.accommodationRoomingList && tourist.accommodationRoomingList.length > 0) {
            const roomingEntry = tourist.accommodationRoomingList.find(
              e => parseInt(e.accommodationId) === parseInt(accId)
            );
            if (roomingEntry) {
              if (roomingEntry.checkInDate) touristCheckInDate = roomingEntry.checkInDate;
              if (roomingEntry.checkOutDate) touristCheckOutDate = roomingEntry.checkOutDate;
            }
          }
        }

        // PRIORITY 3: Fallback to accommodation dates (default for all guests in this hotel)
        if (!touristCheckInDate) touristCheckInDate = formData.checkInDate;
        if (!touristCheckOutDate) touristCheckOutDate = formData.checkOutDate;

        // Use guestDates state first (user-edited), then rooming list dates, then accommodation dates
        const guestDateOverride = guestDates[tourist.id];
        const effectiveCheckIn = guestDateOverride?.checkIn
          ? new Date(guestDateOverride.checkIn)
          : (touristCheckInDate ? new Date(touristCheckInDate) : accCheckIn);
        const effectiveCheckOut = guestDateOverride?.checkOut
          ? new Date(guestDateOverride.checkOut)
          : (touristCheckOutDate ? new Date(touristCheckOutDate) : accCheckOut);
        effectiveCheckIn.setHours(0, 0, 0, 0);
        effectiveCheckOut.setHours(0, 0, 0, 0);

        // Calculate nights
        const touristNights = Math.round((effectiveCheckOut - effectiveCheckIn) / (1000 * 60 * 60 * 24));

        // Calculate extra nights
        let extraNightsBefore = 0;
        let extraNightsAfter = 0;
        if (effectiveCheckIn < accCheckIn) {
          extraNightsBefore = Math.round((accCheckIn - effectiveCheckIn) / (1000 * 60 * 60 * 24));
        }
        if (effectiveCheckOut > accCheckOut) {
          extraNightsAfter = Math.round((effectiveCheckOut - accCheckOut) / (1000 * 60 * 60 * 24));
        }

        // Get room preference and find matching room price
        let roomType = (tourist.roomPreference || '').toUpperCase();
        if (roomType === 'DOUBLE' || roomType === 'DZ') roomType = 'DBL';
        if (roomType === 'TWIN') roomType = 'TWN';
        if (roomType === 'SINGLE' || roomType === 'EZ') roomType = 'SNGL';

        const matchingRoom = rooms.find(r =>
          r.roomTypeCode?.toUpperCase() === roomType ||
          (roomType === 'SNGL' && r.roomTypeCode === 'SINGLE') ||
          (roomType === 'DBL' && r.roomTypeCode === 'DOUBLE') ||
          (roomType === 'EZ' && r.roomTypeCode === 'SNGL') ||
          (roomType === 'DZ' && (r.roomTypeCode === 'DBL' || r.roomTypeCode === 'TWN'))
        );

        const pricePerNight = matchingRoom ? parseFloat(matchingRoom.pricePerNight) || 0 : 0;

        // Calculate per-guest cost based on their actual nights
        // For shared rooms (TWN/DBL), each guest pays half the room rate
        const isSharedRoom = roomType === 'TWN' || roomType === 'DBL';
        const guestCost = isSharedRoom
          ? (touristNights * pricePerNight) / 2  // Half of room cost per guest
          : (touristNights * pricePerNight);     // Full room cost for SNGL

        // Extract date strings using local timezone (handles dates stored with timezone offset)
        const getDateString = (dateValue) => {
          if (!dateValue) return null;
          // Always parse as Date and use local timezone methods
          // This handles cases like "2025-10-09T19:00:00.000Z" which is actually Oct 10 in local time
          const date = new Date(dateValue);
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };

        // Use original string dates for display (no timezone conversion)
        const displayCheckIn = guestDateOverride?.checkIn || getDateString(touristCheckInDate) || formData.checkInDate;
        const displayCheckOut = guestDateOverride?.checkOut || getDateString(touristCheckOutDate) || formData.checkOutDate;

        roomingListDetails.push({
          touristId: tourist.id,
          touristName: tourist.fullName,
          roomType: roomType || '-',
          checkInDate: displayCheckIn,
          checkOutDate: displayCheckOut,
          nights: touristNights,
          groupNights: nights,
          extraNightsBefore,
          extraNightsAfter,
          totalExtraNights: extraNightsBefore + extraNightsAfter,
          hasCustomDates: touristCheckInDate || touristCheckOutDate,
          pricePerNight,
          guestCost // Individual guest cost
        });
      });
    }

    return { totalRooms, totalGuests, totalCost, totalTouristTax, isPAX, currency, extraNightsTotal, extraNightsDetails, roomingListDetails };
  }, [rooms, nights, accommodationRoomTypes, selectedHotelRoomTypes, tourists, roomingList, formData.checkInDate, formData.checkOutDate, formData.hotelId, editingAccommodation, hotels, booking, guestDates]);

  // Auto-refresh rooms from Rooming List when data is loaded (for edit mode)
  // DISABLED: This was overwriting manually saved prices when reopening the modal
  // User can manually click "From Rooming List" button if they want to recalculate
  // useEffect(() => {
  //   if (editingAccommodation && selectedHotelRoomTypes.length > 0) {
  //     const dataSource = roomingList.length > 0 ? roomingList : tourists;
  //     // Auto-fill if we have tourist data and hotel room types are loaded
  //     if (dataSource.length > 0 && formData.hotelId && formData.checkInDate && formData.checkOutDate) {
  //       // Delay to ensure all data is loaded
  //       const timer = setTimeout(() => {
  //         autoFillFromRoomingList();
  //       }, 300);
  //       return () => clearTimeout(timer);
  //     }
  //   }
  // }, [editingAccommodation, selectedHotelRoomTypes.length, tourists.length, roomingList.length]);

  // Auto-save totals when they are calculated (after auto-fill)
  const [lastAutoSave, setLastAutoSave] = useState(0);
  useEffect(() => {
    if (editingAccommodation && totals.totalCost > 0 && rooms.length > 0) {
      // Only auto-save once after auto-fill (prevent loops)
      const now = Date.now();
      if (now - lastAutoSave > 2000) {
        const timer = setTimeout(async () => {
          try {
            await bookingsApi.updateAccommodation(bookingId, editingAccommodation.id, {
              totalCost: totals.totalCost,
              totalRooms: totals.totalRooms,
              totalGuests: totals.totalGuests
            });
            console.log('✅ Auto-saved totals:', totals.totalCost.toLocaleString());
            setLastAutoSave(Date.now());
            // Refresh parent to update card
            onSave();
          } catch (error) {
            console.error('Auto-save error:', error);
          }
        }, 800);
        return () => clearTimeout(timer);
      }
    }
  }, [totals.totalCost]);

  // Auto-save totals when modal is about to close (for Total display)
  const handleClose = async () => {
    // Auto-save calculated totals before closing
    if (editingAccommodation && totals.totalCost > 0) {
      try {
        await bookingsApi.updateAccommodation(bookingId, editingAccommodation.id, {
          totalCost: totals.totalCost,
          totalRooms: totals.totalRooms,
          totalGuests: totals.totalGuests
        });
        console.log('✅ Auto-saved totals on close:', { totalCost: totals.totalCost });
      } catch (error) {
        console.error('Auto-save totals error:', error);
      }
    }
    onClose();
  };

  const handleChange = async (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Load hotel room types when hotel changes
    if (name === 'hotelId' && value) {
      const newHotelId = parseInt(value);

      // Load new hotel's room types
      try {
        const response = await hotelsApi.getRoomTypes(newHotelId);
        const newHotelRoomTypes = response.data.roomTypes || [];
        setSelectedHotelRoomTypes(newHotelRoomTypes);

        // Get selected hotel for tourist tax calculation
        const selectedHotel = hotels.find(h => h.id === newHotelId);
        const hotelTotalRooms = selectedHotel?.totalRooms || 0;

        // Update existing rooms with new prices
        setRooms(prevRooms => {
          return prevRooms.map(room => {
            if (!room.roomTypeCode) return room;

            // Find matching room type in new hotel
            const newHotelRoomType = newHotelRoomTypes.find(rt => rt.name === room.roomTypeCode);

            if (newHotelRoomType) {
              // Hotel has this room type - update price
              return {
                ...room,
                pricePerNight: calculateTotalPrice(newHotelRoomType, hotelTotalRooms)
              };
            } else {
              // Hotel doesn't have this room type - set price to 0
              return {
                ...room,
                pricePerNight: 0
              };
            }
          });
        });

        toast.success(`Hotel changed. Prices updated for ${selectedHotel?.name}`);
      } catch (error) {
        console.error('Error loading hotel room types:', error);
        setSelectedHotelRoomTypes([]);
      }
    } else if (name === 'hotelId' && !value) {
      setSelectedHotelRoomTypes([]);
      setRooms([{ ...emptyRoom }]);
    }
  };

  const handleRoomChange = (index, field, value) => {
    setRooms(prev => {
      const newRooms = [...prev];
      newRooms[index] = { ...newRooms[index], [field]: value };

      // Auto-set pricePerNight from hotel's room type when roomTypeCode changes
      if (field === 'roomTypeCode' && value) {
        // Try to get price from hotel's room types first
        const hotelRoomType = selectedHotelRoomTypes.find(rt => rt.name === value);
        if (hotelRoomType) {
          // Get hotel's total rooms for tourist tax calculation
          const selectedHotel = hotels.find(h => h.id === parseInt(formData.hotelId));
          const hotelTotalRooms = selectedHotel?.totalRooms || 0;
          // Calculate total price including VAT and tourist tax
          newRooms[index].pricePerNight = calculateTotalPrice(hotelRoomType, hotelTotalRooms);
        } else {
          // Fallback: set to 0 if hotel doesn't have this room type
          newRooms[index].pricePerNight = 0;
        }
      }

      return newRooms;
    });
  };

  const addRoom = () => {
    setRooms(prev => [...prev, { ...emptyRoom }]);
  };

  const removeRoom = (index) => {
    if (rooms.length > 1) {
      setRooms(prev => prev.filter((_, i) => i !== index));
    }
  };

  // Auto-fill rooms from booking data
  const autoFillFromBooking = () => {
    if (!booking) return;

    // Find selected hotel to check if it's Guesthouse/Yurta
    const selectedHotel = hotels.find(h => h.id === parseInt(formData.hotelId));
    const isGuesthouseOrYurta = selectedHotel && (selectedHotel.stars === 'Guesthouse' || selectedHotel.stars === 'Yurta');
    const hotelTotalRooms = selectedHotel?.totalRooms || 0;

    const newRooms = [];

    if (isGuesthouseOrYurta) {
      // For Guesthouse/Yurta: use PAX (people count)
      if (booking.pax > 0) {
        const hotelRoomType = selectedHotelRoomTypes.find(rt => rt.name === 'PAX');
        newRooms.push({
          roomTypeCode: 'PAX',
          roomsCount: booking.pax, // Number of people, not rooms
          pricePerNight: calculateTotalPrice(hotelRoomType, hotelTotalRooms)
        });
      }
    } else {
      // Regular hotel: use room counts
      // Add DBL rooms
      if (booking.roomsDbl > 0) {
        const hotelRoomType = selectedHotelRoomTypes.find(rt => rt.name === 'DBL');
        newRooms.push({
          roomTypeCode: 'DBL',
          roomsCount: Math.floor(booking.roomsDbl), // Take integer part
          pricePerNight: calculateTotalPrice(hotelRoomType, hotelTotalRooms)
        });
      }

      // Add TWN rooms
      if (booking.roomsTwn > 0) {
        const hotelRoomType = selectedHotelRoomTypes.find(rt => rt.name === 'TWN');
        newRooms.push({
          roomTypeCode: 'TWN',
          roomsCount: Math.ceil(booking.roomsTwn), // Round up for fractional rooms
          pricePerNight: calculateTotalPrice(hotelRoomType, hotelTotalRooms)
        });
      }

      // Add SNGL rooms
      if (booking.roomsSngl > 0) {
        const hotelRoomType = selectedHotelRoomTypes.find(rt => rt.name === 'SNGL');
        newRooms.push({
          roomTypeCode: 'SNGL',
          roomsCount: Math.floor(booking.roomsSngl),
          pricePerNight: calculateTotalPrice(hotelRoomType, hotelTotalRooms)
        });
      }
    }

    if (newRooms.length > 0) {
      setRooms(newRooms);
      toast.success('Room types filled from booking data');
    } else {
      toast.error('No room data in booking');
    }
  };

  // Auto-fill rooms from Rooming List (tourists data)
  const autoFillFromRoomingList = () => {
    // Use rooming list if available, otherwise use tourists
    const dataSource = roomingList.length > 0 ? roomingList : tourists;

    console.log('🔧 autoFillFromRoomingList called:', {
      roomingListLength: roomingList.length,
      touristsLength: tourists.length,
      dataSourceLength: dataSource.length,
      hotelId: formData.hotelId,
      checkIn: formData.checkInDate,
      checkOut: formData.checkOutDate
    });

    if (dataSource.length === 0) {
      toast.error('No tourist data available');
      return;
    }

    // Filter tourists for this accommodation based on dates overlap
    let filteredTourists = dataSource;

    if (formData.checkInDate && formData.checkOutDate) {
      const accCheckIn = new Date(formData.checkInDate);
      const accCheckOut = new Date(formData.checkOutDate);

      // Check if this is Malika Khorazm hotel (UZ tourists stay 2 nights, TM stay 3)
      const selectedHotel = hotels.find(h => h.id === parseInt(formData.hotelId));
      const hotelName = selectedHotel?.name?.toLowerCase() || '';
      const isMalikaKhorazm = hotelName.includes('malika') && hotelName.includes('khorazm');

      // Check if this is the second visit to the same Tashkent hotel
      // If so, only UZ tourists return
      const cityName = selectedHotel?.city?.name?.toLowerCase() || '';
      const isTashkentHotel = cityName.includes('ташкент') || cityName.includes('tashkent') || cityName.includes('toshkent');

      // For Tashkent hotels at end of tour, filter to UZ tourists only
      if (isTashkentHotel && booking?.endDate) {
        const tourEndDate = new Date(booking.endDate);
        tourEndDate.setHours(0, 0, 0, 0);
        accCheckOut.setHours(0, 0, 0, 0);

        // If checkout is within 2 days of tour end, this is the last hotel
        const daysToEnd = Math.abs((tourEndDate - accCheckOut) / (1000 * 60 * 60 * 24));
        console.log(`  🏨 Tashkent hotel check: daysToEnd=${daysToEnd}, tourEnd=${booking.endDate}, checkOut=${formData.checkOutDate}`);

        if (daysToEnd <= 2) {
          // Check if there was an earlier accommodation at the same hotel
          // This is a simplified check - we filter to UZ tourists for last Tashkent hotel
          const beforeFilter = dataSource.length;
          filteredTourists = dataSource.filter(t => {
            const placement = (t.accommodation || '').toLowerCase();
            // Only include tourists WITHOUT "turkmen" in their placement
            const isTM = placement.includes('turkmen') || placement.includes('туркмен');
            return !isTM;
          });
          console.log(`  🔥 Last Tashkent hotel - filtered from ${beforeFilter} to ${filteredTourists.length} UZ tourists`);
        }
      }

      // For Malika Khorazm, we still count all tourists but note that UZ stay fewer nights
    }

    console.log(`  ✅ Final filteredTourists count: ${filteredTourists.length}`);

    // Count room types from tourists
    const roomCounts = { DBL: 0, TWN: 0, SNGL: 0 };
    const touristsByRoomType = { DBL: [], TWN: [], SNGL: [] };

    filteredTourists.forEach(t => {
      let roomType = (t.roomPreference || '').toUpperCase();
      // Normalize room types
      if (roomType === 'DOUBLE' || roomType === 'DZ') roomType = 'DBL';
      if (roomType === 'TWIN') roomType = 'TWN';
      if (roomType === 'SINGLE' || roomType === 'EZ') roomType = 'SNGL';

      if (roomType === 'DBL' || roomType === 'TWN' || roomType === 'SNGL') {
        touristsByRoomType[roomType].push(t);
      }
    });

    // Calculate room counts
    // DBL and TWN: 2 people per room
    roomCounts.DBL = Math.ceil(touristsByRoomType.DBL.length / 2);
    roomCounts.TWN = Math.ceil(touristsByRoomType.TWN.length / 2);
    roomCounts.SNGL = touristsByRoomType.SNGL.length;

    // Calculate extra nights for early arrivals / late departures
    const extraNightsByRoomType = { DBL: 0, TWN: 0, SNGL: 0 };

    // Declare accNights outside the if block to avoid scope error
    let accNights = 0;

    if (formData.checkInDate && formData.checkOutDate) {
      const accCheckIn = new Date(formData.checkInDate);
      accCheckIn.setHours(0, 0, 0, 0);
      const accCheckOut = new Date(formData.checkOutDate);
      accCheckOut.setHours(0, 0, 0, 0);
      accNights = Math.max(0, Math.round((accCheckOut - accCheckIn) / (1000 * 60 * 60 * 24)));

      ['DBL', 'TWN', 'SNGL'].forEach(roomType => {
        touristsByRoomType[roomType].forEach(tourist => {
          // Get tourist's individual dates
          const touristCheckIn = tourist.checkInDate ? new Date(tourist.checkInDate) : accCheckIn;
          const touristCheckOut = tourist.checkOutDate ? new Date(tourist.checkOutDate) : accCheckOut;
          touristCheckIn.setHours(0, 0, 0, 0);
          touristCheckOut.setHours(0, 0, 0, 0);

          const touristNights = Math.max(0, Math.round((touristCheckOut - touristCheckIn) / (1000 * 60 * 60 * 24)));

          // DEBUG: Log all tourists with their dates
          console.log(`  👤 ${tourist.lastName || tourist.fullName} (${roomType}): ${tourist.checkInDate || 'NO DATE'} → ${tourist.checkOutDate || 'NO DATE'} = ${touristNights} nights (acc: ${accNights})`);

          // If tourist has extra nights (early arrival or late departure)
          if (touristNights > accNights) {
            const extraNights = touristNights - accNights;
            extraNightsByRoomType[roomType] += extraNights;
            console.log(`  ✨ Extra nights for ${tourist.lastName || tourist.fullName}: ${extraNights} (${touristNights} - ${accNights})`);
          }
        });
      });

      console.log(`  📊 Extra nights by room type:`, extraNightsByRoomType);
    }

    // Check if this is Guesthouse/Yurta - use PAX instead
    const selectedHotel = hotels.find(h => h.id === parseInt(formData.hotelId));
    const isGuesthouseOrYurta = selectedHotel && (selectedHotel.stars === 'Guesthouse' || selectedHotel.stars === 'Yurta');
    const hotelTotalRooms = selectedHotel?.totalRooms || 0;

    const newRooms = [];

    if (isGuesthouseOrYurta) {
      // For Guesthouse/Yurta: use PAX (people count)
      const totalPax = filteredTourists.length;
      const hotelRoomType = selectedHotelRoomTypes.find(rt => rt.name === 'PAX');
      if (totalPax > 0) {
        newRooms.push({
          roomTypeCode: 'PAX',
          roomsCount: totalPax,
          nights: accNights, // Auto-fill with accommodation nights
          pricePerNight: calculateTotalPrice(hotelRoomType, hotelTotalRooms)
        });
      }
    } else {
      // Add DBL rooms
      if (roomCounts.DBL > 0) {
        const hotelRoomType = selectedHotelRoomTypes.find(rt => rt.name === 'DBL');
        newRooms.push({
          roomTypeCode: 'DBL',
          roomsCount: roomCounts.DBL,
          nights: accNights, // Auto-fill with accommodation nights
          pricePerNight: calculateTotalPrice(hotelRoomType, hotelTotalRooms)
        });
      }

      // Add TWN rooms
      if (roomCounts.TWN > 0) {
        const hotelRoomType = selectedHotelRoomTypes.find(rt => rt.name === 'TWN');
        newRooms.push({
          roomTypeCode: 'TWN',
          roomsCount: roomCounts.TWN,
          nights: accNights, // Auto-fill with accommodation nights
          pricePerNight: calculateTotalPrice(hotelRoomType, hotelTotalRooms)
        });
      }

      // Add SNGL rooms
      if (roomCounts.SNGL > 0) {
        const hotelRoomType = selectedHotelRoomTypes.find(rt => rt.name === 'SNGL');
        newRooms.push({
          roomTypeCode: 'SNGL',
          roomsCount: roomCounts.SNGL,
          nights: accNights, // Auto-fill with accommodation nights
          pricePerNight: calculateTotalPrice(hotelRoomType, hotelTotalRooms)
        });
      }

      // Add extra nights as separate entries (for early arrivals / late departures)
      if (extraNightsByRoomType.DBL > 0) {
        const hotelRoomType = selectedHotelRoomTypes.find(rt => rt.name === 'DBL');
        newRooms.push({
          roomTypeCode: 'DBL',
          roomsCount: 1, // 1 room (simple!)
          nights: extraNightsByRoomType.DBL / 2, // Total guest-nights / 2 guests per room = room-nights
          pricePerNight: calculateTotalPrice(hotelRoomType, hotelTotalRooms)
        });
        console.log(`  ✨ Added DBL extra nights: 1 room × ${extraNightsByRoomType.DBL / 2} nights = ${extraNightsByRoomType.DBL / 2} room-nights`);
      }

      if (extraNightsByRoomType.TWN > 0) {
        const hotelRoomType = selectedHotelRoomTypes.find(rt => rt.name === 'TWN');
        newRooms.push({
          roomTypeCode: 'TWN',
          roomsCount: 1, // 1 room (simple!)
          nights: extraNightsByRoomType.TWN / 2, // Total guest-nights / 2 guests per room = room-nights
          pricePerNight: calculateTotalPrice(hotelRoomType, hotelTotalRooms)
        });
        console.log(`  ✨ Added TWN extra nights: 1 room × ${extraNightsByRoomType.TWN / 2} nights = ${extraNightsByRoomType.TWN / 2} room-nights`);
      }

      if (extraNightsByRoomType.SNGL > 0) {
        const hotelRoomType = selectedHotelRoomTypes.find(rt => rt.name === 'SNGL');
        newRooms.push({
          roomTypeCode: 'SNGL',
          roomsCount: 1, // 1 room for extra nights (simple!)
          nights: extraNightsByRoomType.SNGL, // Use total extra nights directly (e.g., 3 for Baetgen)
          pricePerNight: calculateTotalPrice(hotelRoomType, hotelTotalRooms)
        });
        console.log(`  ✨ Added SNGL extra nights: 1 room × ${extraNightsByRoomType.SNGL} nights = ${extraNightsByRoomType.SNGL} room-nights`);
      }
    }

    if (newRooms.length > 0) {
      console.log('  🎯 Setting rooms:', newRooms);
      setRooms(newRooms);
      const totalTourists = filteredTourists.length;
      const totalRooms = roomCounts.DBL + roomCounts.TWN + roomCounts.SNGL;
      const extraNightsTotal = extraNightsByRoomType.DBL + extraNightsByRoomType.TWN + extraNightsByRoomType.SNGL;
      const message = extraNightsTotal > 0
        ? `Calculated from Rooming List: ${totalTourists} guests, ${totalRooms} rooms (+${extraNightsTotal} extra nights)`
        : `Calculated from Rooming List: ${totalTourists} guests, ${totalRooms} rooms`;
      console.log('  ✅ ' + message);
      toast.success(message);
    } else {
      toast.error('Could not calculate rooms from Rooming List');
    }
  };

  // Get unique hotels from itinerary
  const getItineraryHotels = () => {
    const hotelNames = tourItinerary
      .map(day => day.accommodation)
      .filter(acc => acc && acc.trim().length > 0);

    // Get unique hotel names
    const uniqueNames = [...new Set(hotelNames)];

    // Try to match with actual hotels
    return uniqueNames.map(name => {
      const matchedHotel = hotels.find(h =>
        h.name.toLowerCase().includes(name.toLowerCase()) ||
        name.toLowerCase().includes(h.name.toLowerCase())
      );
      return {
        itineraryName: name,
        hotel: matchedHotel
      };
    });
  };

  const selectHotelFromItinerary = (hotel) => {
    if (hotel) {
      setFormData(prev => ({ ...prev, hotelId: hotel.id.toString() }));
      loadHotelRoomTypes(hotel.id);
      autoFillFromBooking(); // Also auto-fill room types
      setShowItineraryHotels(false);
      toast.success(`Hotel selected: ${hotel.name}`);
    }
  };

  const getRoomTypeName = (code) => {
    const rt = accommodationRoomTypes.find(r => r.code === code);
    return rt ? rt.name : code;
  };

  const handleSave = async () => {
    if (!formData.hotelId) {
      toast.error('Please select a hotel');
      return;
    }

    if (!formData.checkInDate || !formData.checkOutDate) {
      toast.error('Please enter check-in and check-out dates');
      return;
    }

    if (nights <= 0) {
      toast.error('Check-out date must be after check-in date');
      return;
    }

    // Validate rooms
    const validRooms = rooms.filter(r => r.roomTypeCode);
    if (validRooms.length === 0) {
      toast.error('Add at least one room type');
      return;
    }

    setSaving(true);
    try {
      const data = {
        hotelId: parseInt(formData.hotelId),
        checkInDate: formData.checkInDate,
        checkOutDate: formData.checkOutDate,
        rooms: validRooms.map(room => ({
          roomTypeCode: room.roomTypeCode,
          roomsCount: parseInt(room.roomsCount) || 1,
          guestsPerRoom: getMaxGuestsForRoomType(room.roomTypeCode), // Get from dictionary
          pricePerNight: parseFloat(room.pricePerNight) || 0
        })),
        // Include calculated totals from rooming list
        totalRooms: totals.totalRooms,
        totalGuests: totals.totalGuests,
        totalCost: totals.totalCost,
        totalTouristTax: totals.totalTouristTax
      };

      console.log('💾 SAVING accommodation - totals object:', JSON.stringify({
        totalRooms: totals.totalRooms,
        totalGuests: totals.totalGuests,
        totalCost: totals.totalCost,
        currency: totals.currency,
        roomingListLength: roomingList.length,
        touristsLength: tourists.length
      }, null, 2));

      if (editingAccommodation) {
        await bookingsApi.updateAccommodation(bookingId, editingAccommodation.id, data);
        toast.success('Accommodation updated');
      } else {
        await bookingsApi.createAccommodation(bookingId, data);
        toast.success('Accommodation added');
      }

      if (onSave) onSave();
      handleClose();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error saving');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary-600" />
            Hotel Accommodation
          </h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Hotel Select */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                Hotel <span className="text-red-500">*</span>
              </label>
              {tourItinerary.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowItineraryHotels(!showItineraryHotels)}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                >
                  {showItineraryHotels ? 'Hide' : 'From itinerary'}
                </button>
              )}
            </div>

            {showItineraryHotels && tourItinerary.length > 0 && (
              <div className="mb-2 p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                <p className="text-xs font-medium text-blue-900">Hotels from tour itinerary:</p>
                {getItineraryHotels().map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{item.itineraryName}</span>
                    {item.hotel ? (
                      <button
                        type="button"
                        onClick={() => selectHotelFromItinerary(item.hotel)}
                        className="px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
                      >
                        Select
                      </button>
                    ) : (
                      <span className="text-xs text-gray-500">Not found</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            <select
              name="hotelId"
              value={formData.hotelId}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Select hotel</option>
              {hotels.map(hotel => (
                <option key={hotel.id} value={hotel.id}>
                  {hotel.name} ({hotel.city?.name})
                </option>
              ))}
            </select>
          </div>

          {/* Dates Row */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Check-in Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="checkInDate"
                value={formData.checkInDate}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Check-out Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="checkOutDate"
                value={formData.checkOutDate}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nights
              </label>
              <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-center font-semibold">
                {nights}
              </div>
            </div>
          </div>

          {/* PAX Calculation Info for Guesthouse/Yurta */}
          {(() => {
            const selectedHotel = hotels.find(h => h.id === parseInt(formData.hotelId));
            const isGuesthouseOrYurta = selectedHotel && (selectedHotel.stars === 'Guesthouse' || selectedHotel.stars === 'Yurta');
            const paxRoom = rooms.find(r => r.roomTypeCode === 'PAX');
            const paxCount = paxRoom ? parseInt(paxRoom.roomsCount) || 0 : 0;
            // Get PAX price from hotel's room types first, then fall back to room data
            const hotelRoomType = selectedHotelRoomTypes.find(rt => rt.name === 'PAX');
            const pricePerPerson = hotelRoomType?.pricePerNight || (paxRoom ? parseFloat(paxRoom.pricePerNight) || 0 : 0);
            const currency = hotelRoomType?.currency || 'USD';
            const currencySymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : ' UZS';

            if (isGuesthouseOrYurta && booking?.pax > 0) {
              const totalPerNight = paxCount * pricePerPerson;
              const totalForStay = totalPerNight * nights;

              return (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg p-4 mt-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-gray-900 mb-2">
                        Cost Calculation for {selectedHotel.stars === 'Guesthouse' ? 'Guesthouse' : 'Yurta'}
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700">Number of people (PAX):</span>
                          <span className="font-bold text-gray-900">{booking.pax} guests</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700">Price per person per night:</span>
                          <span className="font-bold text-gray-900">
                            {currency === 'UZS'
                              ? pricePerPerson.toLocaleString()
                              : pricePerPerson.toFixed(2)
                            }{currencySymbol}
                          </span>
                        </div>
                        <div className="h-px bg-green-300 my-2"></div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700 font-medium">Cost per night:</span>
                          <span className="font-bold text-green-700 text-base">
                            {booking.pax} × {currency === 'UZS'
                              ? pricePerPerson.toLocaleString()
                              : pricePerPerson.toFixed(2)
                            }{currencySymbol} = {currency === 'UZS'
                              ? (booking.pax * pricePerPerson).toLocaleString()
                              : (booking.pax * pricePerPerson).toFixed(2)
                            }{currencySymbol}
                          </span>
                        </div>
                        {nights > 0 && (
                          <div className="flex justify-between items-center pt-2 border-t-2 border-green-400">
                            <span className="text-gray-900 font-semibold">Total for {nights} {nights === 1 ? 'night' : 'nights'}:</span>
                            <span className="font-bold text-green-700 text-lg">
                              {currency === 'UZS'
                                ? (booking.pax * pricePerPerson * nights).toLocaleString()
                                : (booking.pax * pricePerPerson * nights).toFixed(2)
                              }{currencySymbol}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* Room Types Section */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Room Types <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={autoFillFromRoomingList}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200"
                  title="Calculate from Rooming List (tourists)"
                >
                  <Wand2 className="w-4 h-4" />
                  From Rooming List
                </button>
                <button
                  type="button"
                  onClick={addRoom}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-primary-600 hover:bg-primary-50 rounded-lg"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
            </div>

            {/* Room Type Headers */}
            <div className="grid grid-cols-12 gap-2 mb-2 text-xs font-medium text-gray-500 px-1">
              <div className="col-span-3">Type</div>
              <div className="col-span-2 text-center">Qty</div>
              <div className="col-span-2 text-center">Nights</div>
              <div className="col-span-2 text-center">Price/Night</div>
              <div className="col-span-2 text-center">Total</div>
              <div className="col-span-1"></div>
            </div>

            {/* Room Rows */}
            <div className="space-y-2">
              {rooms.map((room, index) => {
                const roomCount = parseFloat(room.roomsCount) || 0; // Changed from parseInt to support decimal room counts (e.g., 1.5 for extra nights)
                const maxGuests = getMaxGuestsForRoomType(room.roomTypeCode);
                const roomNights = parseFloat(room.nights) || nights; // Use room's nights field (editable) or fallback to accommodation nights
                const totalNights = roomCount * roomNights; // Total room-nights for this row
                const roomCost = totalNights * (parseFloat(room.pricePerNight) || 0); // Cost = total room-nights × price per night

                // Get currency for this room type
                const hotelRoomType = selectedHotelRoomTypes.find(rt => rt.name === room.roomTypeCode);
                const currency = hotelRoomType?.currency || 'USD';
                const currencySymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : ' UZS';

                return (
                  <div key={index} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-3">
                      <select
                        value={room.roomTypeCode}
                        onChange={(e) => handleRoomChange(index, 'roomTypeCode', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">Select</option>
                        {accommodationRoomTypes.map(rt => (
                          <option key={rt.code} value={rt.code}>
                            {rt.code}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="1"
                        value={room.roomsCount}
                        onChange={(e) => handleRoomChange(index, 'roomsCount', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm text-center border border-gray-300 rounded focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div className="col-span-2">
                      {/* Editable nights field - auto-filled but manually adjustable */}
                      <input
                        type="number"
                        min="1"
                        step="0.5"
                        value={room.nights || nights}
                        onChange={(e) => handleRoomChange(index, 'nights', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm text-center border border-gray-300 rounded focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={room.pricePerNight}
                        onChange={(e) => handleRoomChange(index, 'pricePerNight', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm text-center border border-gray-300 rounded focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div className="col-span-2 text-center text-sm font-medium text-gray-700">
                      {currency === 'UZS'
                        ? roomCost.toLocaleString()
                        : roomCost.toFixed(2)
                      }{currencySymbol}
                    </div>
                    <div className="col-span-1 text-center">
                      <button
                        type="button"
                        onClick={() => removeRoom(index)}
                        disabled={rooms.length === 1}
                        className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Totals */}
          {/* Summary Footer - Light Design */}
          <div className="mt-4 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-2xl p-5 shadow-lg border-2 border-blue-200">
            <div className="flex items-center justify-between">
              {/* Left side - Stats */}
              <div className="flex items-center gap-6">
                {!totals.isPAX && (
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 border border-blue-300 flex items-center justify-center">
                      <span className="text-blue-600 text-lg">🚪</span>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">Rooms</div>
                      <div className="text-xl font-bold text-gray-800">{totals.totalRooms}</div>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center">
                    <span className="text-emerald-600 text-lg">👥</span>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">{totals.isPAX ? 'PAX' : 'Guests'}</div>
                    <div className="text-xl font-bold text-gray-800">{totals.totalGuests}</div>
                  </div>
                </div>
              </div>

              {/* Right side - Total */}
              <div className="text-right">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1 font-medium">Total (incl. tax)</div>
                <div className="text-3xl font-black text-blue-700">
                  {totals.currency === 'UZS'
                    ? totals.totalCost.toLocaleString()
                    : totals.totalCost.toFixed(2)}
                  <span className="text-lg font-medium text-blue-500 ml-1">
                    {totals.currency === 'USD' ? '$' : totals.currency === 'EUR' ? '€' : 'UZS'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Calculation - Rooming List Table */}
          {totals.roomingListDetails?.length > 0 && (
            <details className="mt-4 group">
              <summary className="flex items-center justify-between cursor-pointer px-4 py-3 bg-gradient-to-r from-slate-100 to-gray-100 hover:from-slate-200 hover:to-gray-200 rounded-xl border border-gray-200 transition-all">
                <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <span className="text-lg">📋</span>
                  Rooming List - Nights Calculation
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full font-medium">
                    {totals.roomingListDetails.length} guests
                  </span>
                  <span className="text-gray-400 group-open:rotate-180 transition-transform duration-200">▼</span>
                </div>
              </summary>

              <div className="mt-3 bg-white rounded-xl border border-gray-200 shadow-inner overflow-hidden">
                {/* Table Header */}
                <div className="grid grid-cols-[20px_minmax(120px,1fr)_50px_75px_75px_45px_55px] gap-2 text-xs font-semibold text-gray-500 py-3 px-3 bg-gray-50 border-b border-gray-200">
                  <span>#</span>
                  <span>Guest</span>
                  <span className="text-center">Room</span>
                  <span className="text-center">Check-in</span>
                  <span className="text-center">Check-out</span>
                  <span className="text-center">Nights</span>
                  <span className="text-right">Cost</span>
                </div>

                {/* Guest Rows */}
                <div className="max-h-64 overflow-y-auto">
                  {totals.roomingListDetails.map((detail, idx) => {
                    const hasExtra = detail.totalExtraNights > 0;
                    const isShared = detail.roomType === 'TWN' || detail.roomType === 'DBL';
                    const guestCost = isShared
                      ? (detail.nights * detail.pricePerNight) / 2
                      : (detail.nights * detail.pricePerNight);

                    // Format dates (DD.MM)
                    const formatDate = (dateStr) => {
                      if (!dateStr) return '-';
                      // Extract date parts directly from string (YYYY-MM-DD format)
                      const parts = dateStr.split('-');
                      if (parts.length === 3) {
                        return `${parts[2]}.${parts[1]}`; // DD.MM format
                      }
                      return dateStr;
                    };

                    return (
                      <div
                        key={detail.touristId || idx}
                        className={`grid grid-cols-[20px_minmax(120px,1fr)_50px_75px_75px_45px_55px] gap-2 py-2.5 px-3 text-sm items-center border-b border-gray-100 last:border-0 ${
                          hasExtra ? 'bg-gradient-to-r from-amber-50 to-yellow-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                        }`}
                      >
                        <span className="text-xs font-medium text-gray-400">{idx + 1}</span>
                        <span className="font-medium text-gray-800 text-sm" title={detail.touristName}>
                          {detail.touristName}
                        </span>
                        <span className="text-center">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold text-white ${
                            detail.roomType === 'TWN' ? 'bg-blue-500' :
                            detail.roomType === 'DBL' ? 'bg-green-500' :
                            detail.roomType === 'SNGL' ? 'bg-purple-500' : 'bg-gray-500'
                          }`}>
                            {detail.roomType}
                          </span>
                        </span>
                        <span className="text-center text-gray-600 text-xs">{formatDate(detail.checkInDate)}</span>
                        <span className="text-center text-gray-600 text-xs">{formatDate(detail.checkOutDate)}</span>
                        <span className={`text-center font-bold ${hasExtra ? 'text-amber-600' : 'text-gray-800'}`}>
                          {detail.nights}
                        </span>
                        <span className={`text-right font-bold ${hasExtra ? 'text-green-600' : 'text-gray-700'}`}>
                          {totals.currency === 'USD'
                            ? `${Math.round(guestCost)}$`
                            : totals.currency === 'EUR'
                            ? `${Math.round(guestCost)}€`
                            : `${Math.round(guestCost / 1000)}k`
                          }
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Footer Summary */}
                <div className="py-3 px-4 bg-gray-50 border-t border-gray-200">
                  <div className="flex items-center justify-between text-sm">
                    <div className="text-gray-600">
                      Hotel period: <span className="font-semibold text-gray-800">
                        {formData.checkInDate?.split('-').reverse().join('.')} — {formData.checkOutDate?.split('-').reverse().join('.')} ({nights} nights)
                      </span>
                    </div>
                    <div className="text-green-600 flex items-center gap-1 text-xs">
                      <span>✓</span> Calculated from Rooming List
                    </div>
                  </div>
                </div>
              </div>
            </details>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !formData.hotelId || nights <= 0}
            className="inline-flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
