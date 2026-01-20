import { useState, useEffect, useMemo } from 'react';
import { hotelsApi, citiesApi } from '../services/api';
import toast from 'react-hot-toast';
import {
  Plus, Edit, Trash2, Building2, MapPin, X, Save,
  ChevronDown, ChevronRight, Search, Bed, DollarSign,
  Star, Phone, Mail, Globe, Image, Upload, Calendar, Tag
} from 'lucide-react';

export default function Hotels() {
  const [groupedHotels, setGroupedHotels] = useState([]);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [expandedCities, setExpandedCities] = useState({});
  const [expandedHotels, setExpandedHotels] = useState({});

  // Hotel modal
  const [hotelModalOpen, setHotelModalOpen] = useState(false);
  const [editingHotel, setEditingHotel] = useState(null);
  const [hotelForm, setHotelForm] = useState({
    name: '', cityId: '', address: '', phone: '', email: '',
    website: '', stars: '', description: '', totalRooms: 0
  });

  // Room type modal
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [currentHotelId, setCurrentHotelId] = useState(null);
  const [currentHotel, setCurrentHotel] = useState(null);
  const [roomForm, setRoomForm] = useState({
    name: '', displayName: '', roomCount: 0, pricePerNight: 0,
    currency: 'USD', description: '', maxGuests: 2,
    vatIncluded: false, touristTaxEnabled: false, brvValue: 412000
  });

  // City modal
  const [cityModalOpen, setCityModalOpen] = useState(false);
  const [editingCity, setEditingCity] = useState(null);
  const [cityForm, setCityForm] = useState({ name: '', nameEn: '', sortOrder: 0 });

  // Image gallery modal
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageModalHotel, setImageModalHotel] = useState(null);
  const [hotelImages, setHotelImages] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Seasonal pricing modal
  const [seasonModalOpen, setSeasonModalOpen] = useState(false);
  const [seasonModalRoom, setSeasonModalRoom] = useState(null);
  const [seasonModalHotelId, setSeasonModalHotelId] = useState(null);
  const [seasonalPrices, setSeasonalPrices] = useState([]);
  const [editingSeason, setEditingSeason] = useState(null);
  const [seasonForm, setSeasonForm] = useState({
    name: '', startDate: '', endDate: '', pricePerNight: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (keepExpanded = false) => {
    try {
      const [hotelsRes, citiesRes] = await Promise.all([
        hotelsApi.getAll({ includeInactive: false }),
        citiesApi.getAll(true)
      ]);
      setGroupedHotels(hotelsRes.data.groupedByCity || []);
      setCities(citiesRes.data.cities);

      // Only expand on first load
      if (!keepExpanded && Object.keys(expandedCities).length === 0) {
        const expanded = {};
        (hotelsRes.data.groupedByCity || []).forEach(group => {
          expanded[group.city.id] = true;
        });
        setExpandedCities(expanded);
      }
    } catch (error) {
      toast.error('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const toggleCity = (cityId) => {
    setExpandedCities(prev => ({ ...prev, [cityId]: !prev[cityId] }));
  };

  const toggleHotel = (hotelId) => {
    setExpandedHotels(prev => ({ ...prev, [hotelId]: !prev[hotelId] }));
  };

  // Filter hotels
  const filteredGroups = groupedHotels
    .filter(group => !selectedCity || group.city.id === parseInt(selectedCity))
    .map(group => ({
      ...group,
      hotels: group.hotels.filter(hotel =>
        hotel.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }))
    .filter(group => group.hotels.length > 0);

  // ============ HOTEL CRUD ============
  const openHotelModal = (hotel = null) => {
    if (hotel) {
      setEditingHotel(hotel);
      setHotelForm({
        name: hotel.name,
        cityId: hotel.cityId,
        address: hotel.address || '',
        phone: hotel.phone || '',
        email: hotel.email || '',
        website: hotel.website || '',
        stars: hotel.stars || '',
        description: hotel.description || '',
        totalRooms: hotel.totalRooms || 0
      });
    } else {
      setEditingHotel(null);
      setHotelForm({
        name: '', cityId: cities[0]?.id || '', address: '', phone: '',
        email: '', website: '', stars: '', description: '', totalRooms: 0
      });
    }
    setHotelModalOpen(true);
  };

  const saveHotel = async () => {
    if (!hotelForm.name.trim() || !hotelForm.cityId) {
      toast.error('Заполните обязательные поля');
      return;
    }

    try {
      const data = {
        ...hotelForm,
        cityId: parseInt(hotelForm.cityId),
        stars: hotelForm.stars || null
      };

      if (editingHotel) {
        await hotelsApi.update(editingHotel.id, data);
        toast.success('Отель обновлён');
      } else {
        await hotelsApi.create(data);
        toast.success('Отель добавлен');
      }
      setHotelModalOpen(false);
      loadData(true);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Ошибка сохранения');
    }
  };

  const deleteHotel = async (hotel) => {
    if (!confirm(`Удалить отель "${hotel.name}"?`)) return;

    try {
      await hotelsApi.delete(hotel.id);
      toast.success('Отель удалён');
      loadData(true);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Ошибка удаления');
    }
  };

  // ============ ROOM TYPE CRUD ============
  const openRoomModal = (hotelId, room = null) => {
    setCurrentHotelId(hotelId);

    // Find the hotel object
    let hotel = null;
    for (const group of groupedHotels) {
      hotel = group.hotels.find(h => h.id === hotelId);
      if (hotel) break;
    }
    setCurrentHotel(hotel);

    if (room) {
      setEditingRoom(room);
      setRoomForm({
        name: room.name,
        displayName: room.displayName || '',
        roomCount: room.roomCount,
        pricePerNight: room.pricePerNight,
        currency: room.currency,
        description: room.description || '',
        maxGuests: room.maxGuests,
        vatIncluded: room.vatIncluded || false,
        touristTaxEnabled: room.touristTaxEnabled || false,
        brvValue: room.brvValue || 412000
      });
    } else {
      setEditingRoom(null);
      setRoomForm({
        name: '', displayName: '', roomCount: 0, pricePerNight: 0,
        currency: 'USD', description: '', maxGuests: 2,
        vatIncluded: false, touristTaxEnabled: false, brvValue: 412000
      });
    }
    setRoomModalOpen(true);
  };

  const saveRoom = async () => {
    if (!roomForm.name.trim()) {
      toast.error('Введите название типа номера');
      return;
    }

    try {
      if (editingRoom) {
        await hotelsApi.updateRoomType(currentHotelId, editingRoom.id, roomForm);
        toast.success('Тип номера обновлён');
      } else {
        await hotelsApi.createRoomType(currentHotelId, roomForm);
        toast.success('Тип номера добавлен');
      }
      setRoomModalOpen(false);
      loadData(true);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Ошибка сохранения');
    }
  };

  const deleteRoom = async (hotelId, room) => {
    console.log('Delete room clicked:', hotelId, room);
    if (!confirm(`Удалить тип номера "${room.name}"?`)) {
      console.log('Delete cancelled by user');
      return;
    }

    try {
      console.log('Deleting room type...', hotelId, room.id);
      await hotelsApi.deleteRoomType(hotelId, room.id);
      toast.success('Тип номера удалён');
      loadData(true);
    } catch (error) {
      console.error('Delete room error:', error);
      toast.error(error.response?.data?.error || 'Ошибка удаления');
    }
  };

  // ============ CITY CRUD ============
  const openCityModal = (city = null) => {
    if (city) {
      setEditingCity(city);
      setCityForm({
        name: city.name,
        nameEn: city.nameEn || '',
        sortOrder: city.sortOrder || 0
      });
    } else {
      setEditingCity(null);
      setCityForm({ name: '', nameEn: '', sortOrder: 0 });
    }
    setCityModalOpen(true);
  };

  const saveCity = async () => {
    if (!cityForm.name.trim()) {
      toast.error('Введите название города');
      return;
    }

    try {
      if (editingCity) {
        await citiesApi.update(editingCity.id, cityForm);
        toast.success('Город обновлён');
      } else {
        await citiesApi.create(cityForm);
        toast.success('Город добавлен');
      }
      setCityModalOpen(false);
      loadData(true);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Ошибка сохранения');
    }
  };

  // Dynamic room type presets based on hotel type
  const roomTypePresets = useMemo(() => {
    const isGuesthouseOrYurta = currentHotel && (currentHotel.stars === 'Guesthouse' || currentHotel.stars === 'Yurta');

    if (isGuesthouseOrYurta) {
      return ['PAX', 'DBL', 'TWN', 'SNGL', 'TRPL', 'Suite', 'Deluxe'];
    }
    return ['DBL', 'TWN', 'SNGL', 'TRPL', 'Suite', 'Deluxe'];
  }, [currentHotel]);

  const roomTypeDisplayNames = {
    'PAX': 'PAX (за человека)',
    'DBL': 'Double Room',
    'TWN': 'Twin Room',
    'SNGL': 'Single Room',
    'TRPL': 'Triple Room',
    'Suite': 'Suite',
    'Deluxe': 'Deluxe Room'
  };

  // ============ IMAGE GALLERY ============
  const openImageModal = async (hotel) => {
    setImageModalHotel(hotel);
    setImageModalOpen(true);
    try {
      const res = await hotelsApi.getImages(hotel.id);
      setHotelImages(res.data.images || []);
    } catch (error) {
      toast.error('Ошибка загрузки изображений');
      setHotelImages([]);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !imageModalHotel) return;

    const formData = new FormData();
    formData.append('image', file);

    setUploadingImage(true);
    try {
      await hotelsApi.uploadImage(imageModalHotel.id, formData);
      toast.success('Изображение загружено');
      // Reload images
      const res = await hotelsApi.getImages(imageModalHotel.id);
      setHotelImages(res.data.images || []);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Ошибка загрузки');
    } finally {
      setUploadingImage(false);
    }
  };

  const deleteImage = async (imageId) => {
    if (!confirm('Удалить изображение?')) return;

    try {
      await hotelsApi.deleteImage(imageModalHotel.id, imageId);
      toast.success('Изображение удалено');
      setHotelImages(prev => prev.filter(img => img.id !== imageId));
    } catch (error) {
      toast.error('Ошибка удаления');
    }
  };

  const setMainImage = async (imageId) => {
    try {
      await hotelsApi.updateImage(imageModalHotel.id, imageId, { isMain: true });
      toast.success('Главное изображение установлено');
      // Reload images
      const res = await hotelsApi.getImages(imageModalHotel.id);
      setHotelImages(res.data.images || []);
    } catch (error) {
      toast.error('Ошибка обновления');
    }
  };

  // ============ SEASONAL PRICING ============
  const openSeasonModal = async (hotelId, room) => {
    setSeasonModalHotelId(hotelId);
    setSeasonModalRoom(room);
    setSeasonModalOpen(true);
    setEditingSeason(null);
    setSeasonForm({ name: '', startDate: '', endDate: '', pricePerNight: 0 });
    try {
      const res = await hotelsApi.getSeasonalPrices(hotelId, room.id);
      setSeasonalPrices(res.data.seasonalPrices || []);
    } catch (error) {
      toast.error('Ошибка загрузки сезонных цен');
      setSeasonalPrices([]);
    }
  };

  const saveSeason = async () => {
    if (!seasonForm.name.trim() || !seasonForm.startDate || !seasonForm.endDate) {
      toast.error('Заполните все обязательные поля');
      return;
    }

    try {
      if (editingSeason) {
        await hotelsApi.updateSeasonalPrice(
          seasonModalHotelId, seasonModalRoom.id, editingSeason.id, seasonForm
        );
        toast.success('Сезонная цена обновлена');
      } else {
        await hotelsApi.createSeasonalPrice(
          seasonModalHotelId, seasonModalRoom.id, seasonForm
        );
        toast.success('Сезонная цена добавлена');
      }
      // Reload
      const res = await hotelsApi.getSeasonalPrices(seasonModalHotelId, seasonModalRoom.id);
      setSeasonalPrices(res.data.seasonalPrices || []);
      setEditingSeason(null);
      setSeasonForm({ name: '', startDate: '', endDate: '', pricePerNight: 0 });
    } catch (error) {
      toast.error(error.response?.data?.error || 'Ошибка сохранения');
    }
  };

  const editSeason = (season) => {
    setEditingSeason(season);
    setSeasonForm({
      name: season.name,
      startDate: season.startDate.split('T')[0],
      endDate: season.endDate.split('T')[0],
      pricePerNight: season.pricePerNight
    });
  };

  const deleteSeason = async (seasonId) => {
    if (!confirm('Удалить сезонную цену?')) return;

    try {
      await hotelsApi.deleteSeasonalPrice(seasonModalHotelId, seasonModalRoom.id, seasonId);
      toast.success('Сезонная цена удалена');
      setSeasonalPrices(prev => prev.filter(s => s.id !== seasonId));
    } catch (error) {
      toast.error('Ошибка удаления');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-gradient-to-r from-white via-gray-50 to-white rounded-2xl shadow-md border border-gray-200 p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-primary-100 to-primary-200 border-2 border-primary-300 rounded-2xl flex items-center justify-center shadow-sm">
            <Building2 className="w-7 h-7 text-primary-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">Отели</h1>
            <p className="text-gray-600 font-medium mt-1">Управление отелями и номерами</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => openCityModal()}
            className="inline-flex items-center gap-2 px-4 py-2 border-2 border-gray-300 rounded-xl hover:bg-gray-50 hover:border-primary-500 hover:shadow-md transition-all duration-200 font-medium"
          >
            <MapPin className="w-4 h-4" />
            Добавить город
          </button>
          <button
            onClick={() => openHotelModal()}
            className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:shadow-lg hover:scale-105 transition-all duration-200 font-semibold"
          >
            <Plus className="w-5 h-5" />
            Добавить отель
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск отелей..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-sm font-medium"
          />
        </div>
        <select
          value={selectedCity}
          onChange={(e) => setSelectedCity(e.target.value)}
          className="px-5 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 shadow-sm font-medium bg-white"
        >
          <option value="">Все города</option>
          {cities.map(city => (
            <option key={city.id} value={city.id}>{city.name}</option>
          ))}
        </select>
      </div>

      {/* Hotels grouped by city */}
      <div className="space-y-5">
        {filteredGroups.map(group => (
          <div key={group.city.id} className="bg-white rounded-2xl shadow-md border-2 border-gray-200 overflow-hidden hover:shadow-xl transition-shadow duration-200">
            {/* City header */}
            <div
              className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-primary-50 via-white to-primary-50 border-b-2 border-primary-200 cursor-pointer hover:from-primary-100 hover:to-primary-100 transition-all duration-200"
              onClick={() => toggleCity(group.city.id)}
            >
              <div className="flex items-center gap-4">
                {expandedCities[group.city.id] ? (
                  <ChevronDown className="w-6 h-6 text-primary-600 transition-transform duration-200" />
                ) : (
                  <ChevronRight className="w-6 h-6 text-gray-500 transition-transform duration-200" />
                )}
                <div className="w-10 h-10 bg-gradient-to-br from-primary-100 to-primary-200 border-2 border-primary-300 rounded-xl flex items-center justify-center shadow-sm">
                  <MapPin className="w-5 h-5 text-primary-600" />
                </div>
                <span className="font-bold text-xl text-gray-900">{group.city.name}</span>
                {group.city.nameEn && (
                  <span className="text-sm text-gray-600 font-medium">({group.city.nameEn})</span>
                )}
                <span className="px-4 py-1.5 bg-gradient-to-r from-primary-100 to-primary-200 text-primary-700 text-sm font-bold rounded-full border border-primary-300 shadow-sm">
                  {group.hotels.length}
                </span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); openCityModal(group.city); }}
                className="p-2 hover:bg-primary-200 hover:scale-110 rounded-xl transition-all duration-200"
                title="Редактировать город"
              >
                <Edit className="w-5 h-5 text-primary-600" />
              </button>
            </div>

            {/* Hotels */}
            {expandedCities[group.city.id] && (
              <div className="bg-gradient-to-br from-gray-50 to-white p-5 space-y-4">
                {group.hotels.map(hotel => (
                  <div key={hotel.id} className="bg-white rounded-xl shadow-md border-2 border-gray-200 p-5 hover:shadow-lg hover:scale-[1.01] transition-all duration-200">
                    {/* Hotel header */}
                    <div className="flex items-start justify-between">
                      <div
                        className="flex items-start gap-3 cursor-pointer flex-1"
                        onClick={() => toggleHotel(hotel.id)}
                      >
                        {expandedHotels[hotel.id] ? (
                          <ChevronDown className="w-4 h-4 text-gray-400 mt-1" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-400 mt-1" />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 border-2 border-blue-300 rounded-xl flex items-center justify-center shadow-sm">
                              <Building2 className="w-5 h-5 text-blue-600" />
                            </div>
                            <h3 className="font-bold text-lg text-gray-900">{hotel.name}</h3>
                            {hotel.stars && (
                              <div className="flex items-center gap-1">
                                {!isNaN(parseInt(hotel.stars)) ? (
                                  [...Array(parseInt(hotel.stars))].map((_, i) => (
                                    <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                  ))
                                ) : (
                                  <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                                    {hotel.stars}
                                  </span>
                                )}
                              </div>
                            )}
                            {!hotel.isActive && (
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">
                                Неактивен
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                            {hotel.address && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {hotel.address}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openImageModal(hotel)}
                          className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-xl hover:scale-110 transition-all duration-200 shadow-sm"
                          title="Галерея изображений"
                        >
                          <Image className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => openRoomModal(hotel.id)}
                          className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-xl hover:scale-110 transition-all duration-200 shadow-sm"
                          title="Добавить тип номера"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => openHotelModal(hotel)}
                          className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-xl hover:scale-110 transition-all duration-200 shadow-sm"
                          title="Редактировать отель"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => deleteHotel(hotel)}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl hover:scale-110 transition-all duration-200 shadow-sm"
                          title="Удалить отель"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Room types */}
                    {expandedHotels[hotel.id] && hotel.roomTypes?.length > 0 && (
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {hotel.roomTypes.map(room => (
                          <div
                            key={room.id}
                            className="flex flex-col p-4 bg-gradient-to-br from-white to-gray-50 rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-semibold text-lg text-gray-900">{room.name}</span>
                                  {room.name === 'PAX' && (
                                    <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full font-medium">
                                      за человека
                                    </span>
                                  )}
                                </div>
                                {room.displayName && (
                                  <span className="text-sm text-gray-600">{room.displayName}</span>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-col gap-2 mb-3">
                              {(() => {
                                // Calculate all price components
                                let basePrice = room.pricePerNight;
                                const vatAmount = room.vatIncluded ? basePrice * 0.12 : 0;
                                let priceInCurrency = basePrice + vatAmount;

                                // Calculate tourist tax (always in UZS)
                                let touristTax = 0;
                                let touristTaxUZS = 0;
                                if (room.touristTaxEnabled && room.brvValue > 0) {
                                  const totalRooms = hotel.totalRooms || 0;
                                  let percentage = totalRooms <= 10 ? 0.05 : totalRooms <= 40 ? 0.10 : 0.15;
                                  touristTaxUZS = room.brvValue * percentage * (room.maxGuests || 1);

                                  // Convert tourist tax to room currency for total
                                  if (room.currency === 'USD') {
                                    touristTax = touristTaxUZS / 12700;
                                  } else if (room.currency === 'EUR') {
                                    touristTax = touristTaxUZS / 13500;
                                  } else {
                                    touristTax = touristTaxUZS;
                                  }
                                }

                                const totalPrice = priceInCurrency + touristTax;
                                const currencySymbol = room.currency === 'USD' ? '$' : room.currency === 'EUR' ? '€' : 'UZS';

                                return (
                                  <>
                                    <div className="flex items-baseline gap-2">
                                      <span className="text-2xl font-bold text-green-600">
                                        {totalPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })} {currencySymbol}
                                      </span>
                                      <span className="text-sm text-gray-500">за ночь</span>
                                    </div>
                                    {room.touristTaxEnabled && room.brvValue > 0 && (
                                      <div className="text-xs text-gray-500">
                                        Включает турсбор {touristTaxUZS.toLocaleString()} UZS
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>

                            <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
                              <button
                                onClick={() => openSeasonModal(hotel.id, room)}
                                className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-orange-50 hover:border-orange-300 hover:text-orange-600 transition-colors"
                                title="Сезонные цены"
                              >
                                <Calendar className="w-3.5 h-3.5" />
                                Сезон
                              </button>
                              <button
                                onClick={() => openRoomModal(hotel.id, room)}
                                className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                                title="Редактировать"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => deleteRoom(hotel.id, room)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Удалить"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {expandedHotels[hotel.id] && (!hotel.roomTypes || hotel.roomTypes.length === 0) && (
                      <div className="mt-4 p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 text-center">
                        <Bed className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-500 mb-2">Нет типов номеров</p>
                        <button
                          onClick={() => openRoomModal(hotel.id)}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          Добавить тип номера
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {filteredGroups.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            {searchQuery || selectedCity ? 'Отели не найдены' : 'Нет отелей. Добавьте первый отель!'}
          </div>
        )}
      </div>

      {/* Hotel Modal */}
      {hotelModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingHotel ? 'Редактировать отель' : 'Новый отель'}
              </h2>
              <button onClick={() => setHotelModalOpen(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Название *</label>
                  <input
                    type="text"
                    value={hotelForm.name}
                    onChange={(e) => setHotelForm({ ...hotelForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="Hotel Uzbekistan"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Город *</label>
                  <select
                    value={hotelForm.cityId}
                    onChange={(e) => setHotelForm({ ...hotelForm, cityId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Выберите город</option>
                    {cities.map(city => (
                      <option key={city.id} value={city.id}>{city.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Звёзды</label>
                  <select
                    value={hotelForm.stars}
                    onChange={(e) => setHotelForm({ ...hotelForm, stars: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Не указано</option>
                    {[1,2,3,4,5].map(n => (
                      <option key={n} value={String(n)}>{n} {'★'.repeat(n)}</option>
                    ))}
                    <option value="Guesthouse">Guesthouse</option>
                    <option value="Yurta">Yurta</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Количество номеров</label>
                  <input
                    type="number"
                    value={hotelForm.totalRooms || ''}
                    onChange={(e) => setHotelForm({ ...hotelForm, totalRooms: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    min={0}
                    placeholder="Общее количество номеров"
                  />
                  <p className="text-xs text-gray-500 mt-1">Для расчёта туристического сбора</p>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Адрес</label>
                  <input
                    type="text"
                    value={hotelForm.address}
                    onChange={(e) => setHotelForm({ ...hotelForm, address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="ул. Мустакиллик, 1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Телефон</label>
                  <input
                    type="text"
                    value={hotelForm.phone}
                    onChange={(e) => setHotelForm({ ...hotelForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="+998 71 123 45 67"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={hotelForm.email}
                    onChange={(e) => setHotelForm({ ...hotelForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="info@hotel.uz"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Вебсайт</label>
                  <input
                    type="url"
                    value={hotelForm.website}
                    onChange={(e) => setHotelForm({ ...hotelForm, website: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="https://hotel.uz"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
                  <textarea
                    value={hotelForm.description}
                    onChange={(e) => setHotelForm({ ...hotelForm, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    rows={3}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200">
              <button
                onClick={() => setHotelModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                onClick={saveHotel}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                <Save className="w-4 h-4" />
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Room Type Modal */}
      {roomModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-y-auto p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingRoom ? 'Редактировать тип номера' : 'Новый тип номера'}
              </h2>
              <button onClick={() => setRoomModalOpen(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Тип номера *</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {roomTypePresets.map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        const guestsByType = {
                          'PAX': 1,
                          'SNGL': 1,
                          'DBL': 2,
                          'TWN': 2,
                          'TRPL': 3,
                          'Suite': 2,
                          'Deluxe': 2
                        };
                        setRoomForm({
                          ...roomForm,
                          name: preset,
                          displayName: roomTypeDisplayNames[preset] || preset,
                          maxGuests: guestsByType[preset] || 2
                        });
                      }}
                      className={`px-3 py-1 text-sm rounded-full border ${
                        roomForm.name === preset
                          ? 'bg-primary-100 border-primary-500 text-primary-700'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={roomForm.name}
                  onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="DBL"
                  maxLength={20}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Полное название</label>
                <input
                  type="text"
                  value={roomForm.displayName}
                  onChange={(e) => setRoomForm({ ...roomForm, displayName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="Double Room"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Макс. гостей</label>
                  <input
                    type="number"
                    value={roomForm.maxGuests}
                    onChange={(e) => setRoomForm({ ...roomForm, maxGuests: parseInt(e.target.value) || 2 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    min={1}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Цена за ночь (базовая)</label>
                  <input
                    type="number"
                    value={roomForm.pricePerNight || ''}
                    onChange={(e) => setRoomForm({ ...roomForm, pricePerNight: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    min={0}
                    step={0.01}
                    placeholder="Введите цену за ночь"
                  />
                  {roomForm.pricePerNight > 0 && (() => {
                    // Convert price to UZS if needed
                    let basePrice = roomForm.pricePerNight;
                    let currencySymbol = roomForm.currency;
                    if (roomForm.currency === 'USD') {
                      basePrice = roomForm.pricePerNight * 12700;
                      currencySymbol = 'UZS';
                    } else if (roomForm.currency === 'EUR') {
                      basePrice = roomForm.pricePerNight * 13500;
                      currencySymbol = 'UZS';
                    }

                    // Calculate VAT
                    const vatAmount = roomForm.vatIncluded ? basePrice * 0.12 : 0;
                    const priceWithVat = basePrice + vatAmount;

                    // Calculate tourist tax
                    let touristTax = 0;
                    if (roomForm.touristTaxEnabled && roomForm.brvValue > 0) {
                      const totalRooms = currentHotel?.totalRooms || 0;
                      let percentage = totalRooms <= 10 ? 0.05 : totalRooms <= 40 ? 0.10 : 0.15;
                      touristTax = roomForm.brvValue * percentage * (roomForm.maxGuests || 1);
                    }

                    const totalPrice = priceWithVat + touristTax;

                    return (
                      <div className="text-xs mt-2 space-y-1 bg-gray-50 p-2 rounded">
                        <p className="text-gray-700">Базовая цена: {basePrice.toLocaleString()} {currencySymbol}</p>
                        {roomForm.vatIncluded && (
                          <p className="text-gray-700">+ НДС 12%: {vatAmount.toLocaleString()} {currencySymbol}</p>
                        )}
                        {roomForm.touristTaxEnabled && touristTax > 0 && (
                          <p className="text-gray-700">+ Турсбор: {touristTax.toLocaleString()} UZS</p>
                        )}
                        <p className="font-bold text-primary-600 pt-1 border-t border-gray-300">
                          Итого: {totalPrice.toLocaleString()} {currencySymbol} {roomForm.name === 'PAX' ? 'за человека/ночь' : 'за ночь'}
                        </p>
                      </div>
                    );
                  })()}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Валюта</label>
                  <select
                    value={roomForm.currency}
                    onChange={(e) => setRoomForm({ ...roomForm, currency: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="UZS">UZS</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
                <textarea
                  value={roomForm.description}
                  onChange={(e) => setRoomForm({ ...roomForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  rows={2}
                  placeholder="Описание номера, удобства..."
                />
              </div>

              {/* НДС 12% */}
              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="vatIncluded"
                    checked={roomForm.vatIncluded}
                    onChange={(e) => setRoomForm({ ...roomForm, vatIncluded: e.target.checked })}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
                  />
                  <label htmlFor="vatIncluded" className="text-sm font-medium text-gray-700">
                    Включить НДС 12%
                  </label>
                </div>
                <p className="text-xs text-gray-500 mt-1 ml-6">Налог на добавленную стоимость</p>
              </div>

              {/* Туристический сбор */}
              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    id="touristTaxEnabled"
                    checked={roomForm.touristTaxEnabled}
                    onChange={(e) => setRoomForm({ ...roomForm, touristTaxEnabled: e.target.checked })}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
                  />
                  <label htmlFor="touristTaxEnabled" className="text-sm font-medium text-gray-700">
                    Включить туристический сбор
                  </label>
                </div>

                {roomForm.touristTaxEnabled && (
                  <div className="bg-blue-50 rounded-lg p-3 space-y-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        БРВ (Базовая расчётная величина) - в сумах
                      </label>
                      <input
                        type="number"
                        value={roomForm.brvValue || ''}
                        onChange={(e) => setRoomForm({ ...roomForm, brvValue: parseFloat(e.target.value) || 0 })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        min={0}
                        step={1000}
                        placeholder="412000"
                      />
                    </div>

                    <div className="bg-white rounded p-2 text-xs space-y-1">
                      {(() => {
                        // Calculate percentage based on hotel's total rooms
                        const totalRooms = currentHotel?.totalRooms || 0;
                        let percentage = 0;
                        let percentageText = '';
                        if (totalRooms <= 10) {
                          percentage = 0.05;
                          percentageText = '5%';
                        } else if (totalRooms <= 40) {
                          percentage = 0.10;
                          percentageText = '10%';
                        } else {
                          percentage = 0.15;
                          percentageText = '15%';
                        }

                        return (
                          <>
                            <div>
                              <p className="font-medium text-gray-700 text-[10px] mb-0.5">Процент: 5% (≤10), 10% (11-40), 15% (&gt;40)</p>
                              {currentHotel && (
                                <p className="text-primary-600 font-medium text-[10px]">
                                  {currentHotel.name}: {totalRooms} номеров = {percentageText}
                                </p>
                              )}
                            </div>
                            <div className="border-t pt-1">
                              <p className="text-gray-600 text-[10px]">SNGL: БРВ×%×1 | DBL/TWN: БРВ×%×2 | TRPL: БРВ×%×3</p>
                            </div>
                            {roomForm.brvValue > 0 && roomForm.maxGuests > 0 && percentage > 0 && (
                              <div className="bg-blue-50 rounded p-2 border border-blue-200">
                                <p className="text-blue-800 text-[10px] font-medium">
                                  {roomForm.brvValue.toLocaleString()} × {percentageText} × {roomForm.maxGuests} = <span className="font-bold">{(roomForm.brvValue * percentage * roomForm.maxGuests).toLocaleString()} UZS</span>
                                </p>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 bg-white sticky bottom-0">
              <button
                onClick={() => setRoomModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                onClick={saveRoom}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                <Save className="w-4 h-4" />
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* City Modal */}
      {cityModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingCity ? 'Редактировать город' : 'Новый город'}
              </h2>
              <button onClick={() => setCityModalOpen(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Название *</label>
                <input
                  type="text"
                  value={cityForm.name}
                  onChange={(e) => setCityForm({ ...cityForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="Ташкент"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Название (англ.)</label>
                <input
                  type="text"
                  value={cityForm.nameEn}
                  onChange={(e) => setCityForm({ ...cityForm, nameEn: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="Tashkent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Порядок сортировки</label>
                <input
                  type="number"
                  value={cityForm.sortOrder}
                  onChange={(e) => setCityForm({ ...cityForm, sortOrder: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200">
              <button
                onClick={() => setCityModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                onClick={saveCity}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                <Save className="w-4 h-4" />
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Gallery Modal */}
      {imageModalOpen && imageModalHotel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Галерея: {imageModalHotel.name}
              </h2>
              <button onClick={() => setImageModalOpen(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto">
              {/* Upload button */}
              <div className="mb-4">
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 cursor-pointer">
                  <Upload className="w-4 h-4" />
                  {uploadingImage ? 'Загрузка...' : 'Загрузить изображение'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={uploadingImage}
                  />
                </label>
              </div>

              {/* Images grid */}
              {hotelImages.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {hotelImages.map(image => (
                    <div key={image.id} className="relative group rounded-lg overflow-hidden border border-gray-200">
                      <img
                        src={`/api${image.url}`}
                        alt={image.caption || 'Hotel image'}
                        className="w-full h-40 object-cover"
                      />
                      {image.isMain && (
                        <div className="absolute top-2 left-2 px-2 py-0.5 bg-primary-600 text-white text-xs rounded">
                          Главное
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        {!image.isMain && (
                          <button
                            onClick={() => setMainImage(image.id)}
                            className="p-2 bg-white rounded-lg text-primary-600 hover:bg-primary-50"
                            title="Сделать главным"
                          >
                            <Star className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteImage(image.id)}
                          className="p-2 bg-white rounded-lg text-red-600 hover:bg-red-50"
                          title="Удалить"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {image.caption && (
                        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent">
                          <p className="text-white text-sm">{image.caption}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  Нет изображений. Загрузите первое!
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200">
              <button
                onClick={() => setImageModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Seasonal Pricing Modal */}
      {seasonModalOpen && seasonModalRoom && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Сезонные цены: {seasonModalRoom.name}
              </h2>
              <button onClick={() => setSeasonModalOpen(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto">
              {/* Add/Edit form */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  {editingSeason ? 'Редактировать сезон' : 'Добавить сезон'}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Название сезона *</label>
                    <input
                      type="text"
                      value={seasonForm.name}
                      onChange={(e) => setSeasonForm({ ...seasonForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                      placeholder="Лето, Зима, Высокий сезон..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Цена за ночь *</label>
                    <input
                      type="number"
                      value={seasonForm.pricePerNight}
                      onChange={(e) => setSeasonForm({ ...seasonForm, pricePerNight: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                      min={0}
                      step={0.01}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Начало сезона *</label>
                    <input
                      type="date"
                      value={seasonForm.startDate}
                      onChange={(e) => setSeasonForm({ ...seasonForm, startDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Конец сезона *</label>
                    <input
                      type="date"
                      value={seasonForm.endDate}
                      onChange={(e) => setSeasonForm({ ...seasonForm, endDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={saveSeason}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {editingSeason ? 'Обновить' : 'Добавить'}
                  </button>
                  {editingSeason && (
                    <button
                      onClick={() => {
                        setEditingSeason(null);
                        setSeasonForm({ name: '', startDate: '', endDate: '', pricePerNight: 0 });
                      }}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                    >
                      Отмена
                    </button>
                  )}
                </div>
              </div>

              {/* Existing seasonal prices */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-700">
                  Текущие сезонные цены
                </h3>
                <p className="text-xs text-gray-500 mb-2">
                  Базовая цена: <strong>${seasonModalRoom.pricePerNight}</strong> (используется, если нет активного сезона)
                </p>
                {seasonalPrices.length > 0 ? (
                  <div className="space-y-2">
                    {seasonalPrices.map(season => (
                      <div
                        key={season.id}
                        className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-100"
                      >
                        <div className="flex items-center gap-3">
                          <Tag className="w-4 h-4 text-orange-600" />
                          <div>
                            <span className="font-medium text-gray-900">{season.name}</span>
                            <div className="text-xs text-gray-500">
                              {new Date(season.startDate).toLocaleDateString('ru-RU')} — {new Date(season.endDate).toLocaleDateString('ru-RU')}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-green-600">${season.pricePerNight}</span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => editSeason(season)}
                              className="p-1 text-gray-400 hover:text-primary-600 rounded"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => deleteSeason(season.id)}
                              className="p-1 text-gray-400 hover:text-red-600 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg">
                    Нет сезонных цен. Будет использоваться базовая цена.
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200">
              <button
                onClick={() => setSeasonModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
