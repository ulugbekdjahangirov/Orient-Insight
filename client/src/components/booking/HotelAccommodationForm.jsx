import { useState, useEffect, useMemo } from 'react';
import { bookingsApi, hotelsApi } from '../../services/api';
import toast from 'react-hot-toast';
import { Building2, X, Save, Loader2, Plus, Trash2 } from 'lucide-react';

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

  // Load accommodation room types dictionary on mount
  useEffect(() => {
    loadAccommodationRoomTypes();
  }, []);

  const loadAccommodationRoomTypes = async () => {
    try {
      const response = await bookingsApi.getAccommodationRoomTypes();
      setAccommodationRoomTypes(response.data.roomTypes || []);
    } catch (error) {
      console.error('Error loading room types:', error);
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

    rooms.forEach(room => {
      const roomCount = parseInt(room.roomsCount) || 0;
      const maxGuests = getMaxGuestsForRoomType(room.roomTypeCode);
      const pricePerNight = parseFloat(room.pricePerNight) || 0;

      totalRooms += roomCount;
      totalGuests += roomCount * maxGuests;
      totalCost += roomCount * pricePerNight * nights;
    });

    return { totalRooms, totalGuests, totalCost };
  }, [rooms, nights, accommodationRoomTypes]);

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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Отель <span className="text-red-500">*</span>
            </label>
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

          {/* Room Types Section */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Типы номеров <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={addRoom}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-primary-600 hover:bg-primary-50 rounded-lg"
              >
                <Plus className="w-4 h-4" />
                Добавить
              </button>
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
                      ${roomCost.toFixed(2)}
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
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xs text-gray-500 mb-1">Всего номеров</div>
                <div className="text-xl font-bold text-gray-900">{totals.totalRooms}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Всего гостей</div>
                <div className="text-xl font-bold text-gray-900">{totals.totalGuests}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Общая стоимость</div>
                <div className="text-xl font-bold text-primary-600">${totals.totalCost.toFixed(2)}</div>
              </div>
            </div>
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
