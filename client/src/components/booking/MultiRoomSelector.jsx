import { useState, useEffect, useMemo } from 'react';
import { bookingsApi, hotelsApi, citiesApi } from '../../services/api';
import toast from 'react-hot-toast';
import {
  Building2, Users, Bed, X, Save, Loader2, AlertTriangle, MapPin, Calendar, ChevronRight, Check
} from 'lucide-react';

export default function MultiRoomSelector({
  bookingId,
  booking,
  hotels,
  existingRooms = [],
  onSave,
  onClose
}) {
  // Step tracking
  const [currentStep, setCurrentStep] = useState(1);

  // Cities
  const [cities, setCities] = useState([]);
  const [loadingCities, setLoadingCities] = useState(true);
  const [selectedCityId, setSelectedCityId] = useState('');

  // Hotels filtered by city
  const [selectedHotelId, setSelectedHotelId] = useState('');
  const [selectedHotel, setSelectedHotel] = useState(null);

  // Dates
  const [checkInDate, setCheckInDate] = useState(booking?.departureDate?.split('T')[0] || '');
  const [checkOutDate, setCheckOutDate] = useState(booking?.endDate?.split('T')[0] || '');

  // Room quantities
  const [roomQuantities, setRoomQuantities] = useState({});
  const [roomTypeAvailabilities, setRoomTypeAvailabilities] = useState({});

  // Loading states
  const [loading, setLoading] = useState(false);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load cities on mount
  useEffect(() => {
    loadCities();
  }, []);

  const loadCities = async () => {
    setLoadingCities(true);
    try {
      const response = await citiesApi.getAll();
      setCities(response.data.cities || []);
    } catch (error) {
      toast.error('Ошибка загрузки городов');
    } finally {
      setLoadingCities(false);
    }
  };

  // Filter hotels by selected city
  const filteredHotels = useMemo(() => {
    if (!selectedCityId) return [];
    return hotels.filter(h => h.cityId === parseInt(selectedCityId));
  }, [hotels, selectedCityId]);

  // Calculate nights from dates
  const nights = useMemo(() => {
    if (!checkInDate || !checkOutDate) return 0;
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    return Math.max(0, Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24)));
  }, [checkInDate, checkOutDate]);

  // Calculate total guests and cost
  const calculations = useMemo(() => {
    if (!selectedHotel?.roomTypes) {
      return { totalGuests: 0, totalRooms: 0, totalCost: 0, breakdown: [] };
    }

    let totalGuests = 0;
    let totalRooms = 0;
    let totalCost = 0;
    const breakdown = [];

    selectedHotel.roomTypes.forEach(roomType => {
      const qty = roomQuantities[roomType.id] || 0;
      if (qty > 0) {
        const guests = qty * (roomType.maxGuests || 2);
        const cost = qty * nights * roomType.pricePerNight;
        totalGuests += guests;
        totalRooms += qty;
        totalCost += cost;
        breakdown.push({
          roomTypeId: roomType.id,
          name: roomType.name,
          displayName: roomType.displayName,
          quantity: qty,
          maxGuests: roomType.maxGuests || 2,
          guests,
          pricePerNight: roomType.pricePerNight,
          cost
        });
      }
    });

    return { totalGuests, totalRooms, totalCost, breakdown };
  }, [selectedHotel, roomQuantities, nights]);

  // Check if total guests exceed PAX
  const paxWarning = useMemo(() => {
    if (!booking?.pax || booking.pax <= 0) return null;
    if (calculations.totalGuests > booking.pax) {
      return `Количество гостей (${calculations.totalGuests}) превышает PAX (${booking.pax})`;
    }
    if (calculations.totalGuests < booking.pax && calculations.totalGuests > 0) {
      return `Недостаточно мест: ${calculations.totalGuests} из ${booking.pax} PAX`;
    }
    return null;
  }, [calculations.totalGuests, booking?.pax]);

  // Handle city selection
  const handleCityChange = (cityId) => {
    setSelectedCityId(cityId);
    setSelectedHotelId('');
    setSelectedHotel(null);
    setRoomQuantities({});
    setRoomTypeAvailabilities({});
    if (cityId) {
      setCurrentStep(2);
    }
  };

  // Handle hotel selection
  const handleHotelChange = async (hotelId) => {
    setSelectedHotelId(hotelId);
    setRoomQuantities({});
    setRoomTypeAvailabilities({});

    if (hotelId) {
      setLoading(true);
      try {
        const response = await hotelsApi.getById(hotelId);
        setSelectedHotel(response.data);

        // Pre-fill quantities if there are existing rooms for this hotel
        const existingForHotel = existingRooms.filter(r => r.hotelId === parseInt(hotelId));
        const quantities = {};
        existingForHotel.forEach(r => {
          quantities[r.roomTypeId] = r.quantity;
        });
        setRoomQuantities(quantities);

        setCurrentStep(3);
      } catch (error) {
        toast.error('Ошибка загрузки отеля');
      } finally {
        setLoading(false);
      }
    } else {
      setSelectedHotel(null);
    }
  };

  // Handle dates change
  const handleDatesConfirm = () => {
    if (checkInDate && checkOutDate && nights > 0) {
      setCurrentStep(4);
      fetchAllRoomTypeAvailabilities();
    }
  };

  // Fetch availability when hotel or dates change
  useEffect(() => {
    if (selectedHotel && checkInDate && checkOutDate && nights > 0 && currentStep >= 4) {
      fetchAllRoomTypeAvailabilities();
    }
  }, [selectedHotel, checkInDate, checkOutDate]);

  const fetchAllRoomTypeAvailabilities = async () => {
    if (!selectedHotel?.roomTypes?.length) return;

    setLoadingAvailability(true);
    const availabilities = {};

    try {
      await Promise.all(
        selectedHotel.roomTypes.map(async (roomType) => {
          const params = {
            hotelId: selectedHotel.id,
            roomTypeId: roomType.id,
            checkInDate,
            checkOutDate
          };
          const response = await bookingsApi.checkRoomAvailability(bookingId, params);
          availabilities[roomType.id] = response.data;
        })
      );
      setRoomTypeAvailabilities(availabilities);
    } catch (error) {
      console.error('Fetch availabilities error:', error);
    } finally {
      setLoadingAvailability(false);
    }
  };

  const handleQuantityChange = (roomTypeId, value) => {
    const qty = parseInt(value) || 0;
    setRoomQuantities(prev => ({
      ...prev,
      [roomTypeId]: Math.max(0, qty)
    }));
  };

  const handleSave = async () => {
    if (!selectedHotel) {
      toast.error('Выберите отель');
      return;
    }

    if (!checkInDate || !checkOutDate) {
      toast.error('Укажите даты заезда и выезда');
      return;
    }

    if (nights <= 0) {
      toast.error('Дата выезда должна быть позже даты заезда');
      return;
    }

    if (calculations.breakdown.length === 0) {
      toast.error('Выберите хотя бы один тип номера');
      return;
    }

    setSaving(true);
    try {
      // Create accommodation with rooms using new structure
      const accommodationData = {
        cityId: parseInt(selectedCityId),
        hotelId: selectedHotel.id,
        checkInDate,
        checkOutDate,
        rooms: calculations.breakdown.map(item => ({
          roomTypeId: item.roomTypeId,
          roomsCount: item.quantity,
          guestsPerRoom: item.maxGuests,
          pricePerNight: item.pricePerNight
        }))
      };

      await bookingsApi.createAccommodation(bookingId, accommodationData);

      toast.success('Размещение сохранено');
      if (onSave) onSave();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  // Get selected city name
  const selectedCity = cities.find(c => c.id === parseInt(selectedCityId));

  // Step indicator component
  const StepIndicator = ({ step, label, isActive, isCompleted, onClick }) => (
    <button
      onClick={onClick}
      disabled={!isCompleted && !isActive}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
        isActive
          ? 'bg-primary-100 text-primary-700 border-2 border-primary-500'
          : isCompleted
          ? 'bg-green-50 text-green-700 hover:bg-green-100 cursor-pointer'
          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
      }`}
    >
      <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
        isActive
          ? 'bg-primary-600 text-white'
          : isCompleted
          ? 'bg-green-500 text-white'
          : 'bg-gray-300 text-gray-500'
      }`}>
        {isCompleted ? <Check className="w-4 h-4" /> : step}
      </span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary-600" />
            Добавить размещение
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicators */}
        <div className="flex items-center justify-center gap-2 p-4 bg-gray-50 border-b border-gray-200">
          <StepIndicator
            step={1}
            label="Город"
            isActive={currentStep === 1}
            isCompleted={currentStep > 1}
            onClick={() => currentStep > 1 && setCurrentStep(1)}
          />
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <StepIndicator
            step={2}
            label="Отель"
            isActive={currentStep === 2}
            isCompleted={currentStep > 2}
            onClick={() => currentStep > 2 && setCurrentStep(2)}
          />
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <StepIndicator
            step={3}
            label="Даты"
            isActive={currentStep === 3}
            isCompleted={currentStep > 3}
            onClick={() => currentStep > 3 && setCurrentStep(3)}
          />
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <StepIndicator
            step={4}
            label="Номера"
            isActive={currentStep === 4}
            isCompleted={calculations.breakdown.length > 0}
            onClick={() => currentStep >= 4 && setCurrentStep(4)}
          />
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Step 1: City Selection */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <MapPin className="w-12 h-12 mx-auto text-primary-500 mb-2" />
                <h3 className="text-lg font-medium text-gray-900">Выберите город</h3>
                <p className="text-sm text-gray-500">Шаг 1 из 4</p>
              </div>

              {loadingCities ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {cities.filter(c => c.isActive !== false).map(city => (
                    <button
                      key={city.id}
                      onClick={() => handleCityChange(city.id.toString())}
                      className={`p-4 rounded-lg border-2 text-left transition-all hover:shadow-md ${
                        selectedCityId === city.id.toString()
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-primary-300'
                      }`}
                    >
                      <div className="font-medium text-gray-900">{city.name}</div>
                      {city.nameEn && (
                        <div className="text-sm text-gray-500">{city.nameEn}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Hotel Selection */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <Building2 className="w-12 h-12 mx-auto text-primary-500 mb-2" />
                <h3 className="text-lg font-medium text-gray-900">Выберите отель</h3>
                <p className="text-sm text-gray-500">
                  {selectedCity?.name} • Шаг 2 из 4
                </p>
              </div>

              {filteredHotels.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Building2 className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>Нет отелей в выбранном городе</p>
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="mt-2 text-primary-600 hover:underline text-sm"
                  >
                    Выбрать другой город
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredHotels.filter(h => h.isActive !== false).map(hotel => (
                    <button
                      key={hotel.id}
                      onClick={() => handleHotelChange(hotel.id.toString())}
                      disabled={loading}
                      className={`p-4 rounded-lg border-2 text-left transition-all hover:shadow-md ${
                        selectedHotelId === hotel.id.toString()
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-primary-300'
                      }`}
                    >
                      <div className="font-medium text-gray-900">{hotel.name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        {hotel.stars && (
                          <span className="text-yellow-500 text-sm">
                            {'★'.repeat(hotel.stars)}
                          </span>
                        )}
                        <span className="text-sm text-gray-500">
                          {hotel.roomTypes?.length || 0} типов номеров
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {loading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                </div>
              )}
            </div>
          )}

          {/* Step 3: Date Selection */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <Calendar className="w-12 h-12 mx-auto text-primary-500 mb-2" />
                <h3 className="text-lg font-medium text-gray-900">Выберите даты</h3>
                <p className="text-sm text-gray-500">
                  {selectedHotel?.name} • Шаг 3 из 4
                </p>
              </div>

              <div className="max-w-md mx-auto space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Дата заезда
                    </label>
                    <input
                      type="date"
                      value={checkInDate}
                      onChange={(e) => setCheckInDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Дата выезда
                    </label>
                    <input
                      type="date"
                      value={checkOutDate}
                      onChange={(e) => setCheckOutDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>

                {nights > 0 && (
                  <div className="text-center p-4 bg-primary-50 rounded-lg">
                    <div className="text-3xl font-bold text-primary-600">{nights}</div>
                    <div className="text-sm text-primary-700">
                      {nights === 1 ? 'ночь' : nights < 5 ? 'ночи' : 'ночей'}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleDatesConfirm}
                  disabled={!checkInDate || !checkOutDate || nights <= 0}
                  className="w-full py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  Продолжить к выбору номеров
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Room Selection */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <Bed className="w-12 h-12 mx-auto text-primary-500 mb-2" />
                <h3 className="text-lg font-medium text-gray-900">Выберите номера</h3>
                <p className="text-sm text-gray-500">
                  {selectedHotel?.name} • {nights} {nights === 1 ? 'ночь' : nights < 5 ? 'ночи' : 'ночей'} • Шаг 4 из 4
                </p>
              </div>

              {/* Selected info summary */}
              <div className="flex flex-wrap gap-2 justify-center text-sm">
                <span className="px-3 py-1 bg-gray-100 rounded-full text-gray-700">
                  <MapPin className="w-3 h-3 inline mr-1" />
                  {selectedCity?.name}
                </span>
                <span className="px-3 py-1 bg-gray-100 rounded-full text-gray-700">
                  <Building2 className="w-3 h-3 inline mr-1" />
                  {selectedHotel?.name}
                </span>
                <span className="px-3 py-1 bg-gray-100 rounded-full text-gray-700">
                  <Calendar className="w-3 h-3 inline mr-1" />
                  {checkInDate} — {checkOutDate}
                </span>
              </div>

              {/* Room Types Table */}
              {selectedHotel?.roomTypes?.length > 0 ? (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left text-gray-500">
                        <th className="py-3 px-4 font-medium">Тип номера</th>
                        <th className="py-3 px-4 font-medium text-center">Гостей</th>
                        <th className="py-3 px-4 font-medium text-center">Доступно</th>
                        <th className="py-3 px-4 font-medium text-right">Цена/ночь</th>
                        <th className="py-3 px-4 font-medium text-center w-28">Кол-во</th>
                        <th className="py-3 px-4 font-medium text-right">Сумма</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedHotel.roomTypes.filter(rt => rt.isActive !== false).map(roomType => {
                        const avail = roomTypeAvailabilities[roomType.id];
                        const qty = roomQuantities[roomType.id] || 0;
                        const cost = qty * nights * roomType.pricePerNight;
                        const guests = qty * (roomType.maxGuests || 2);

                        return (
                          <tr key={roomType.id} className="border-t border-gray-100 hover:bg-gray-50">
                            <td className="py-3 px-4">
                              <div className="font-medium text-gray-900">{roomType.name}</div>
                              {roomType.displayName && (
                                <div className="text-xs text-gray-500">{roomType.displayName}</div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                                <Users className="w-3 h-3" />
                                {roomType.maxGuests || 2}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              {loadingAvailability ? (
                                <Loader2 className="w-4 h-4 animate-spin mx-auto text-gray-400" />
                              ) : avail ? (
                                <span className={`text-xs font-medium px-2 py-1 rounded ${
                                  avail.availableRooms > 0
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-red-100 text-red-700'
                                }`}>
                                  {avail.availableRooms}/{avail.totalRooms}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right font-medium">
                              ${roomType.pricePerNight}
                            </td>
                            <td className="py-3 px-4">
                              <input
                                type="number"
                                min="0"
                                max={avail?.availableRooms || 99}
                                value={qty}
                                onChange={(e) => handleQuantityChange(roomType.id, e.target.value)}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                              />
                            </td>
                            <td className="py-3 px-4 text-right">
                              {qty > 0 ? (
                                <div>
                                  <div className="font-medium text-green-600">${cost.toLocaleString()}</div>
                                  <div className="text-xs text-gray-500">{guests} гост.</div>
                                </div>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Bed className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p>Нет доступных типов номеров</p>
                </div>
              )}

              {/* PAX Warning */}
              {paxWarning && (
                <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">{paxWarning}</span>
                </div>
              )}

              {/* Summary */}
              {calculations.breakdown.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <h4 className="font-medium text-gray-900">Итого размещение</h4>

                  <div className="space-y-2 text-sm">
                    {calculations.breakdown.map(item => (
                      <div key={item.roomTypeId} className="flex justify-between text-gray-600">
                        <span>
                          {item.name} × {item.quantity} ({item.guests} гост.)
                        </span>
                        <span>
                          {item.quantity} × {nights} ноч. × ${item.pricePerNight} = ${item.cost.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-3 border-t border-gray-200 grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-gray-900">{calculations.totalRooms}</div>
                      <div className="text-xs text-gray-500">номеров</div>
                    </div>
                    <div>
                      <div className={`text-2xl font-bold ${paxWarning ? 'text-yellow-600' : 'text-gray-900'}`}>
                        {calculations.totalGuests}
                        {booking?.pax > 0 && <span className="text-sm text-gray-400">/{booking.pax}</span>}
                      </div>
                      <div className="text-xs text-gray-500">гостей</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-600">${calculations.totalCost.toLocaleString()}</div>
                      <div className="text-xs text-gray-500">стоимость</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-4 border-t border-gray-200 bg-gray-50">
          <div>
            {currentStep > 1 && (
              <button
                onClick={() => setCurrentStep(currentStep - 1)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Назад
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Отмена
            </button>
            {currentStep === 4 && (
              <button
                onClick={handleSave}
                disabled={saving || calculations.breakdown.length === 0}
                className="inline-flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Сохранить
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
