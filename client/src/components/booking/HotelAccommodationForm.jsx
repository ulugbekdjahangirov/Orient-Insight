import { useState, useEffect, useMemo } from 'react';
import { bookingsApi, hotelsApi, tourTypesApi } from '../../services/api';
import toast from 'react-hot-toast';
import { Building2, X, Save, Loader2, Plus, Trash2, Wand2 } from 'lucide-react';

const emptyRoom = {
  roomTypeCode: '',
  roomsCount: 1,
  pricePerNight: 0
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
      setRoomingList(roomingData);
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
        setRooms(editingAccommodation.rooms.map(room => ({
          roomTypeCode: room.roomTypeCode || '',
          roomsCount: room.roomsCount || 1,
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
    let isPAX = false;
    let currency = 'USD';

    rooms.forEach(room => {
      const roomCount = parseInt(room.roomsCount) || 0;
      const maxGuests = getMaxGuestsForRoomType(room.roomTypeCode);
      const pricePerNight = parseFloat(room.pricePerNight) || 0;

      // Check if this is a PAX room type
      if (room.roomTypeCode === 'PAX') {
        isPAX = true;
        // For PAX: roomsCount is people count, not rooms
        totalGuests += roomCount; // Total people
        totalCost += roomCount * pricePerNight * nights;

        // Get currency from hotel's PAX room type
        const hotelRoomType = selectedHotelRoomTypes.find(rt => rt.name === 'PAX');
        if (hotelRoomType?.currency) {
          currency = hotelRoomType.currency;
        }
      } else {
        totalRooms += roomCount;
        totalGuests += roomCount * maxGuests;
        totalCost += roomCount * pricePerNight * nights;

        // Get currency from first room type
        const hotelRoomType = selectedHotelRoomTypes.find(rt => rt.name === room.roomTypeCode);
        if (hotelRoomType?.currency) {
          currency = hotelRoomType.currency;
        }
      }
    });

    // Calculate extra nights cost for tourists with custom dates
    // Only for the FIRST accommodation (editing accommodation won't have this check)
    let extraNightsTotal = 0;
    let extraNightsDetails = [];

    // Check if this is likely the first accommodation by checking if checkInDate matches booking departure
    const isLikelyFirstAccommodation = booking?.departureDate &&
      formData.checkInDate === booking.departureDate.split('T')[0];

    // Calculate extra nights for first accommodation OR when editing any accommodation
    const shouldCalculateExtraNights = tourists.length > 0 && formData.checkInDate && formData.checkOutDate &&
      (isLikelyFirstAccommodation || editingAccommodation?.id);

    if (shouldCalculateExtraNights) {
      const accCheckIn = new Date(formData.checkInDate);
      accCheckIn.setHours(0, 0, 0, 0);
      const accCheckOut = new Date(formData.checkOutDate);
      accCheckOut.setHours(0, 0, 0, 0);

      // If we have rooming list, use it directly; otherwise use tourists with AccommodationRoomingList
      const dataSource = roomingList.length > 0 ? roomingList : tourists;

      dataSource.forEach(entry => {
        let tourist, touristCheckInDate, touristCheckOutDate;

        if (roomingList.length > 0) {
          // Using rooming list data directly (backend returns tourist object with merged dates)
          tourist = entry;
          touristCheckInDate = entry.checkInDate;
          touristCheckOutDate = entry.checkOutDate;
        } else {
          // Using tourists with AccommodationRoomingList
          tourist = entry;

          if (tourist.accommodationRoomingList && tourist.accommodationRoomingList.length > 0) {
            // If editing, find entry for this specific accommodation
            if (editingAccommodation?.id) {
              const roomingEntry = tourist.accommodationRoomingList.find(
                e => e.accommodationId === editingAccommodation.id
              );
              if (roomingEntry) {
                touristCheckInDate = roomingEntry.checkInDate;
                touristCheckOutDate = roomingEntry.checkOutDate;
              }
            } else {
              // Creating new accommodation: use any rooming list entry (assume first accommodation)
              const roomingEntry = tourist.accommodationRoomingList[0];
              if (roomingEntry) {
                touristCheckInDate = roomingEntry.checkInDate;
                touristCheckOutDate = roomingEntry.checkOutDate;
              }
            }
          }

          // Fallback to global dates (though these should be null now)
          if (!touristCheckInDate && !touristCheckOutDate) {
            touristCheckInDate = tourist.checkInDate;
            touristCheckOutDate = tourist.checkOutDate;
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
            totalCost += extraCost;
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

    return { totalRooms, totalGuests, totalCost, isPAX, currency, extraNightsTotal, extraNightsDetails };
  }, [rooms, nights, accommodationRoomTypes, selectedHotelRoomTypes, tourists, roomingList, formData.checkInDate, formData.checkOutDate, editingAccommodation]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Load hotel room types when hotel changes
    if (name === 'hotelId' && value) {
      loadHotelRoomTypes(parseInt(value));
      // Reset rooms to clear old prices
      setRooms([{ ...emptyRoom }]);
    } else if (name === 'hotelId' && !value) {
      setSelectedHotelRoomTypes([]);
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
          newRooms[index].pricePerNight = hotelRoomType.pricePerNight || 0;
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

    const newRooms = [];

    if (isGuesthouseOrYurta) {
      // For Guesthouse/Yurta: use PAX (people count)
      if (booking.pax > 0) {
        const hotelRoomType = selectedHotelRoomTypes.find(rt => rt.name === 'PAX');
        newRooms.push({
          roomTypeCode: 'PAX',
          roomsCount: booking.pax, // Number of people, not rooms
          pricePerNight: hotelRoomType?.pricePerNight || 0
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
          pricePerNight: hotelRoomType?.pricePerNight || 0
        });
      }

      // Add TWN rooms
      if (booking.roomsTwn > 0) {
        const hotelRoomType = selectedHotelRoomTypes.find(rt => rt.name === 'TWN');
        newRooms.push({
          roomTypeCode: 'TWN',
          roomsCount: Math.ceil(booking.roomsTwn), // Round up for fractional rooms
          pricePerNight: hotelRoomType?.pricePerNight || 0
        });
      }

      // Add SNGL rooms
      if (booking.roomsSngl > 0) {
        const hotelRoomType = selectedHotelRoomTypes.find(rt => rt.name === 'SNGL');
        newRooms.push({
          roomTypeCode: 'SNGL',
          roomsCount: Math.floor(booking.roomsSngl),
          pricePerNight: hotelRoomType?.pricePerNight || 0
        });
      }
    }

    if (newRooms.length > 0) {
      setRooms(newRooms);
      toast.success('Типы номеров заполнены из данных бронирования');
    } else {
      toast.error('Нет данных о номерах в бронировании');
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
      toast.success(`Выбран отель: ${hotel.name}`);
    }
  };

  const getRoomTypeName = (code) => {
    const rt = accommodationRoomTypes.find(r => r.code === code);
    return rt ? rt.name : code;
  };

  const handleSave = async () => {
    if (!formData.hotelId) {
      toast.error('Выберите отель');
      return;
    }

    if (!formData.checkInDate || !formData.checkOutDate) {
      toast.error('Укажите даты заезда и выезда');
      return;
    }

    if (nights <= 0) {
      toast.error('Дата выезда должна быть позже даты заезда');
      return;
    }

    // Validate rooms
    const validRooms = rooms.filter(r => r.roomTypeCode);
    if (validRooms.length === 0) {
      toast.error('Добавьте хотя бы один тип номера');
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
        }))
      };

      if (editingAccommodation) {
        await bookingsApi.updateAccommodation(bookingId, editingAccommodation.id, data);
        toast.success('Размещение обновлено');
      } else {
        await bookingsApi.createAccommodation(bookingId, data);
        toast.success('Размещение добавлено');
      }

      if (onSave) onSave();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Ошибка сохранения');
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
            Размещение в отеле
          </h2>
          <button
            onClick={onClose}
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
                Отель <span className="text-red-500">*</span>
              </label>
              {tourItinerary.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowItineraryHotels(!showItineraryHotels)}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                >
                  {showItineraryHotels ? 'Скрыть' : 'Из программы тура'}
                </button>
              )}
            </div>

            {showItineraryHotels && tourItinerary.length > 0 && (
              <div className="mb-2 p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                <p className="text-xs font-medium text-blue-900">Отели из программы тура:</p>
                {getItineraryHotels().map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{item.itineraryName}</span>
                    {item.hotel ? (
                      <button
                        type="button"
                        onClick={() => selectHotelFromItinerary(item.hotel)}
                        className="px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
                      >
                        Выбрать
                      </button>
                    ) : (
                      <span className="text-xs text-gray-500">Не найден</span>
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
              <option value="">Выберите отель</option>
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
                Дата заезда <span className="text-red-500">*</span>
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
                Дата выезда <span className="text-red-500">*</span>
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
                Ночей
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
            const pricePerPerson = paxRoom ? parseFloat(paxRoom.pricePerNight) || 0 : 0;
            const hotelRoomType = selectedHotelRoomTypes.find(rt => rt.name === 'PAX');
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
                        Расчет стоимости для {selectedHotel.stars === 'Guesthouse' ? 'Гостевого дома' : 'Юрты'}
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700">Количество человек (PAX):</span>
                          <span className="font-bold text-gray-900">{booking.pax} чел.</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700">Цена за 1 человека за ночь:</span>
                          <span className="font-bold text-gray-900">
                            {currency === 'UZS'
                              ? pricePerPerson.toLocaleString()
                              : pricePerPerson.toFixed(2)
                            }{currencySymbol}
                          </span>
                        </div>
                        <div className="h-px bg-green-300 my-2"></div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700 font-medium">Стоимость за 1 ночь:</span>
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
                            <span className="text-gray-900 font-semibold">Итого за {nights} {nights === 1 ? 'ночь' : nights < 5 ? 'ночи' : 'ночей'}:</span>
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
                Типы номеров <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={autoFillFromBooking}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-green-600 hover:bg-green-50 rounded-lg"
                  title="Заполнить из данных бронирования (DBL, TWN, SNGL)"
                >
                  <Wand2 className="w-4 h-4" />
                  Из бронирования
                </button>
                <button
                  type="button"
                  onClick={addRoom}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-primary-600 hover:bg-primary-50 rounded-lg"
                >
                  <Plus className="w-4 h-4" />
                  Добавить
                </button>
              </div>
            </div>

            {/* Room Type Headers */}
            <div className="grid grid-cols-12 gap-2 mb-2 text-xs font-medium text-gray-500 px-1">
              <div className="col-span-3">Тип</div>
              <div className="col-span-2 text-center">Кол-во</div>
              <div className="col-span-2 text-center">Гостей</div>
              <div className="col-span-2 text-center">Цена/ночь</div>
              <div className="col-span-2 text-center">Итого</div>
              <div className="col-span-1"></div>
            </div>

            {/* Room Rows */}
            <div className="space-y-2">
              {rooms.map((room, index) => {
                const roomCount = parseInt(room.roomsCount) || 0;
                const maxGuests = getMaxGuestsForRoomType(room.roomTypeCode);
                const totalGuests = roomCount * maxGuests;
                const roomCost = roomCount * (parseFloat(room.pricePerNight) || 0) * nights;

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
                        <option value="">Выберите</option>
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
                      {/* Read-only calculated total guests */}
                      <div className="px-2 py-1.5 text-sm text-center bg-gray-100 border border-gray-300 rounded font-medium">
                        {totalGuests}
                      </div>
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
          <div className="bg-gray-50 rounded-lg p-4 mt-4">
            <div className={`grid ${totals.isPAX ? 'grid-cols-2' : 'grid-cols-3'} gap-4 text-center`}>
              {!totals.isPAX && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Всего номеров</div>
                  <div className="text-xl font-bold text-gray-900">{totals.totalRooms}</div>
                </div>
              )}
              <div>
                <div className="text-xs text-gray-500 mb-1">{totals.isPAX ? 'Всего человек (PAX)' : 'Всего гостей'}</div>
                <div className="text-xl font-bold text-gray-900">{totals.totalGuests}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Общая стоимость</div>
                <div className="text-xl font-bold text-primary-600">
                  {totals.currency === 'UZS'
                    ? totals.totalCost.toLocaleString()
                    : totals.totalCost.toFixed(2)
                  }{totals.currency === 'USD' ? '$' : totals.currency === 'EUR' ? '€' : ' UZS'}
                </div>
              </div>
            </div>

            {/* Extra Nights Details */}
            {totals.extraNightsDetails?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-300">
                <div className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <span className="text-blue-600">📊</span>
                  Детальный расчёт:
                </div>

                {/* Base Calculation */}
                <div className="bg-blue-50 rounded-lg p-3 mb-3">
                  <div className="text-xs font-medium text-blue-900 mb-2">Базовый расчёт (группа):</div>
                  <div className="space-y-1">
                    {rooms.map((room, idx) => {
                      const roomCount = parseInt(room.roomsCount) || 0;
                      const maxGuests = getMaxGuestsForRoomType(room.roomTypeCode);
                      const roomCost = roomCount * (parseFloat(room.pricePerNight) || 0) * nights;
                      if (roomCount === 0) return null;

                      return (
                        <div key={idx} className="flex justify-between items-center text-xs text-blue-800">
                          <span>{room.roomTypeCode}: {roomCount} ном. × {maxGuests} чел. × {nights} ноч.</span>
                          <span className="font-semibold">
                            {totals.currency === 'UZS' ? roomCost.toLocaleString() : roomCost.toFixed(2)} {totals.currency === 'USD' ? '$' : totals.currency === 'EUR' ? '€' : 'UZS'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Extra Nights */}
                <div className="bg-amber-50 rounded-lg p-3">
                  <div className="text-xs font-medium text-amber-900 mb-2">Дополнительные ночи (индивидуальные даты):</div>
                  {totals.extraNightsDetails.map((detail, idx) => (
                    <div key={idx} className="mb-2 last:mb-0">
                      <div className="flex justify-between items-start text-xs">
                        <span className="font-medium text-amber-800">{detail.touristName}</span>
                        <span className="text-amber-900 font-semibold">
                          {detail.nights} ноч. × {detail.pricePerNight.toLocaleString()} = {detail.totalCost.toLocaleString()} {totals.currency === 'USD' ? '$' : totals.currency === 'EUR' ? '€' : 'UZS'}
                        </span>
                      </div>
                      {detail.noMatch && (
                        <div className="text-xs text-red-500 italic mt-1">
                          ⚠️ Не найден тип номера: {detail.roomType} - укажите цену вручную
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {totals.extraNightsTotal > 0 && (
                  <div className="flex justify-between items-center text-sm font-bold text-orange-600 mt-2 pt-2 border-t border-orange-200">
                    <span>Итого доп. ночи:</span>
                    <span>
                      {totals.currency === 'UZS'
                        ? totals.extraNightsTotal.toLocaleString()
                        : totals.extraNightsTotal.toFixed(2)
                      } {totals.currency === 'USD' ? '$' : totals.currency === 'EUR' ? '€' : 'UZS'}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Отмена
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
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
