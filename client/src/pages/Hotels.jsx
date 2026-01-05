import { useState, useEffect } from 'react';
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
    website: '', stars: '', description: ''
  });

  // Room type modal
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [currentHotelId, setCurrentHotelId] = useState(null);
  const [roomForm, setRoomForm] = useState({
    name: '', displayName: '', roomCount: 0, pricePerNight: 0,
    currency: 'USD', description: '', maxGuests: 2
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

  const loadData = async () => {
    try {
      const [hotelsRes, citiesRes] = await Promise.all([
        hotelsApi.getAll({ includeInactive: true }),
        citiesApi.getAll(true)
      ]);
      setGroupedHotels(hotelsRes.data.groupedByCity || []);
      setCities(citiesRes.data.cities);

      // Expand all cities by default
      const expanded = {};
      (hotelsRes.data.groupedByCity || []).forEach(group => {
        expanded[group.city.id] = true;
      });
      setExpandedCities(expanded);
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
        description: hotel.description || ''
      });
    } else {
      setEditingHotel(null);
      setHotelForm({
        name: '', cityId: cities[0]?.id || '', address: '', phone: '',
        email: '', website: '', stars: '', description: ''
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
        stars: hotelForm.stars ? parseInt(hotelForm.stars) : null
      };

      if (editingHotel) {
        await hotelsApi.update(editingHotel.id, data);
        toast.success('Отель обновлён');
      } else {
        await hotelsApi.create(data);
        toast.success('Отель добавлен');
      }
      setHotelModalOpen(false);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Ошибка сохранения');
    }
  };

  const deleteHotel = async (hotel) => {
    if (!confirm(`Удалить отель "${hotel.name}"?`)) return;

    try {
      await hotelsApi.delete(hotel.id);
      toast.success('Отель удалён');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Ошибка удаления');
    }
  };

  // ============ ROOM TYPE CRUD ============
  const openRoomModal = (hotelId, room = null) => {
    setCurrentHotelId(hotelId);
    if (room) {
      setEditingRoom(room);
      setRoomForm({
        name: room.name,
        displayName: room.displayName || '',
        roomCount: room.roomCount,
        pricePerNight: room.pricePerNight,
        currency: room.currency,
        description: room.description || '',
        maxGuests: room.maxGuests
      });
    } else {
      setEditingRoom(null);
      setRoomForm({
        name: '', displayName: '', roomCount: 0, pricePerNight: 0,
        currency: 'USD', description: '', maxGuests: 2
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
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Ошибка сохранения');
    }
  };

  const deleteRoom = async (hotelId, room) => {
    if (!confirm(`Удалить тип номера "${room.name}"?`)) return;

    try {
      await hotelsApi.deleteRoomType(hotelId, room.id);
      toast.success('Тип номера удалён');
      loadData();
    } catch (error) {
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
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Ошибка сохранения');
    }
  };

  const roomTypePresets = ['DBL', 'TWN', 'SNGL', 'TRPL', 'Suite', 'Deluxe'];

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Отели</h1>
          <p className="text-gray-500">Управление отелями и номерами</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => openCityModal()}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <MapPin className="w-4 h-4" />
            Добавить город
          </button>
          <button
            onClick={() => openHotelModal()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus className="w-5 h-5" />
            Добавить отель
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск отелей..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={selectedCity}
          onChange={(e) => setSelectedCity(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Все города</option>
          {cities.map(city => (
            <option key={city.id} value={city.id}>{city.name}</option>
          ))}
        </select>
      </div>

      {/* Hotels grouped by city */}
      <div className="space-y-4">
        {filteredGroups.map(group => (
          <div key={group.city.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* City header */}
            <div
              className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100"
              onClick={() => toggleCity(group.city.id)}
            >
              <div className="flex items-center gap-3">
                {expandedCities[group.city.id] ? (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-500" />
                )}
                <MapPin className="w-5 h-5 text-primary-600" />
                <span className="font-semibold text-gray-900">{group.city.name}</span>
                {group.city.nameEn && (
                  <span className="text-sm text-gray-500">({group.city.nameEn})</span>
                )}
                <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs rounded-full">
                  {group.hotels.length} отелей
                </span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); openCityModal(group.city); }}
                className="p-1 hover:bg-gray-200 rounded"
              >
                <Edit className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* Hotels */}
            {expandedCities[group.city.id] && (
              <div className="divide-y divide-gray-100">
                {group.hotels.map(hotel => (
                  <div key={hotel.id} className="p-4">
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
                          <div className="flex items-center gap-2">
                            <Building2 className="w-5 h-5 text-gray-400" />
                            <h3 className="font-medium text-gray-900">{hotel.name}</h3>
                            {hotel.stars && (
                              <div className="flex items-center gap-0.5">
                                {[...Array(hotel.stars)].map((_, i) => (
                                  <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                ))}
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
                            <span className="flex items-center gap-1">
                              <Bed className="w-3 h-3" />
                              {hotel.roomTypes?.length || 0} типов номеров
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openImageModal(hotel)}
                          className="p-1.5 text-gray-400 hover:text-primary-600 rounded"
                          title="Галерея изображений"
                        >
                          <Image className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openRoomModal(hotel.id)}
                          className="p-1.5 text-gray-400 hover:text-primary-600 rounded"
                          title="Добавить тип номера"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openHotelModal(hotel)}
                          className="p-1.5 text-gray-400 hover:text-primary-600 rounded"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteHotel(hotel)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Room types */}
                    {expandedHotels[hotel.id] && hotel.roomTypes?.length > 0 && (
                      <div className="mt-4 ml-7 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {hotel.roomTypes.map(room => (
                          <div
                            key={room.id}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">{room.name}</span>
                                {room.displayName && (
                                  <span className="text-sm text-gray-500">({room.displayName})</span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                                <span className="flex items-center gap-1">
                                  <Bed className="w-3 h-3" />
                                  {room.roomCount} номеров
                                </span>
                                <span className="flex items-center gap-1 font-medium text-green-600">
                                  <DollarSign className="w-3 h-3" />
                                  {room.pricePerNight} {room.currency}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => openSeasonModal(hotel.id, room)}
                                className="p-1 text-gray-400 hover:text-orange-600 rounded"
                                title="Сезонные цены"
                              >
                                <Calendar className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => openRoomModal(hotel.id, room)}
                                className="p-1 text-gray-400 hover:text-primary-600 rounded"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => deleteRoom(hotel.id, room)}
                                className="p-1 text-gray-400 hover:text-red-600 rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {expandedHotels[hotel.id] && (!hotel.roomTypes || hotel.roomTypes.length === 0) && (
                      <div className="mt-4 ml-7 p-4 bg-gray-50 rounded-lg text-center text-gray-500">
                        Нет типов номеров.{' '}
                        <button
                          onClick={() => openRoomModal(hotel.id)}
                          className="text-primary-600 hover:underline"
                        >
                          Добавить
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
                      <option key={n} value={n}>{n} {'★'.repeat(n)}</option>
                    ))}
                  </select>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingRoom ? 'Редактировать тип номера' : 'Новый тип номера'}
              </h2>
              <button onClick={() => setRoomModalOpen(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Тип номера *</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {roomTypePresets.map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setRoomForm({ ...roomForm, name: preset })}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Кол-во номеров</label>
                  <input
                    type="number"
                    value={roomForm.roomCount}
                    onChange={(e) => setRoomForm({ ...roomForm, roomCount: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    min={0}
                  />
                </div>

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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Цена за ночь</label>
                  <input
                    type="number"
                    value={roomForm.pricePerNight}
                    onChange={(e) => setRoomForm({ ...roomForm, pricePerNight: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    min={0}
                    step={0.01}
                  />
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
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200">
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
