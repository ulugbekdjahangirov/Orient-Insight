import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { hotelsApi, citiesApi, api } from '../services/api';
import { useIsMobile } from '../hooks/useMediaQuery';
import toast from 'react-hot-toast';
import {
  Plus, Edit, Trash2, Building2, MapPin, X, Save,
  ChevronDown, ChevronRight, Search, Bed, DollarSign,
  Star, Phone, Mail, Globe, Image, Upload, Calendar, Tag,
  Users, Home, Sparkles, Send, Copy, CheckCircle
} from 'lucide-react';

export default function Hotels() {
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const [groupedHotels, setGroupedHotels] = useState([]);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Get selected city from URL or default to empty (show all)
  const selectedCity = searchParams.get('city') || '';

  // Function to change city and update URL
  const handleCityChange = (cityId) => {
    if (cityId) {
      setSearchParams({ city: cityId });
    } else {
      setSearchParams({});
    }
  };
  const [expandedCities, setExpandedCities] = useState({});
  const [expandedHotels, setExpandedHotels] = useState({});

  // Hotel modal
  const [telegramFinderOpen, setTelegramFinderOpen] = useState(false);
  const [telegramChats, setTelegramChats] = useState([]);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [copiedChatId, setCopiedChatId] = useState(null);

  const openTelegramFinder = async () => {
    setTelegramFinderOpen(true);
    setTelegramLoading(true);
    try {
      const res = await api.get('/telegram/updates');
      setTelegramChats(res.data.chats || []);
    } catch {
      toast.error('Telegram updates yuklanmadi');
    } finally {
      setTelegramLoading(false);
    }
  };

  const copyChatId = (chatId) => {
    navigator.clipboard.writeText(chatId);
    setCopiedChatId(chatId);
    setTimeout(() => setCopiedChatId(null), 2000);
  };

  const [hotelModalOpen, setHotelModalOpen] = useState(false);
  const [editingHotel, setEditingHotel] = useState(null);
  const [hotelForm, setHotelForm] = useState({
    name: '', cityId: '', address: '', phone: '', email: '', telegramChatId: '',
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

  // Set default city (Tashkent) when cities are loaded
  useEffect(() => {
    if (cities.length > 0 && !selectedCity) {
      const cityOrder = ['Tashkent', 'Samarkand', 'Fergana', 'Asraf', 'Bukhara', 'Khiva'];
      const sortedCities = [...cities].sort((a, b) => {
        const aName = (a.nameEn || a.name || '').toLowerCase();
        const bName = (b.nameEn || b.name || '').toLowerCase();
        const aIndex = cityOrder.findIndex(c => c.toLowerCase() === aName);
        const bIndex = cityOrder.findIndex(c => c.toLowerCase() === bName);
        if (aIndex === -1 && bIndex === -1) return 0;
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });
      // Set first city (Tashkent if exists, otherwise first in sorted list)
      if (sortedCities.length > 0) {
        handleCityChange(sortedCities[0].id.toString());
      }
    }
  }, [cities]);

  const loadData = async (keepExpanded = false) => {
    try {
      const [hotelsRes, citiesRes] = await Promise.all([
        hotelsApi.getAll({ includeInactive: false }),
        citiesApi.getAll(false)  // Only active cities
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
      toast.error('Error loading data');
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
  const openHotelModal = (hotel = null, preselectedCityId = null) => {
    if (hotel) {
      setEditingHotel(hotel);
      setHotelForm({
        name: hotel.name,
        cityId: hotel.cityId,
        address: hotel.address || '',
        phone: hotel.phone || '',
        email: hotel.email || '',
        telegramChatId: hotel.telegramChatId || '',
        website: hotel.website || '',
        stars: hotel.stars || '',
        description: hotel.description || '',
        totalRooms: hotel.totalRooms || 0
      });
    } else {
      setEditingHotel(null);
      setHotelForm({
        name: '',
        cityId: preselectedCityId || cities[0]?.id || '',
        address: '', phone: '',
        email: '', telegramChatId: '', website: '', stars: '', description: '', totalRooms: 0
      });
    }
    setHotelModalOpen(true);
  };

  const saveHotel = async () => {
    if (!hotelForm.name.trim() || !hotelForm.cityId) {
      toast.error('Please fill in required fields');
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
        toast.success('Hotel updated');
      } else {
        await hotelsApi.create(data);
        toast.success('Hotel added');
      }
      setHotelModalOpen(false);
      loadData(true);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error saving');
    }
  };

  const deleteHotel = async (hotel) => {
    if (!confirm(`Delete hotel "${hotel.name}"?`)) return;

    try {
      await hotelsApi.delete(hotel.id);
      toast.success('Hotel deleted');
      loadData(true);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error deleting');
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

      // Show BASE price (no tax calculation needed)
      console.log('🔍 Loading room for edit - Base price:', room.pricePerNight, room.currency);
      console.log('🔍 VAT included:', room.vatIncluded);
      console.log('🔍 Tourist tax enabled:', room.touristTaxEnabled);
      console.log('🔍 Hotel totalRooms:', hotel?.totalRooms);

      setRoomForm({
        name: room.name,
        displayName: room.displayName || '',
        roomCount: room.roomCount,
        pricePerNight: room.pricePerNight, // Show BASE price directly
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
      toast.error('Enter room type name');
      return;
    }

    try {
      // User enters BASE price directly - no conversion needed for new or existing rooms
      const basePrice = roomForm.pricePerNight;

      const dataToSave = {
        ...roomForm,
        pricePerNight: basePrice
      };

      if (editingRoom) {
        await hotelsApi.updateRoomType(currentHotelId, editingRoom.id, dataToSave);
        toast.success('Room type updated');
      } else {
        await hotelsApi.createRoomType(currentHotelId, dataToSave);
        toast.success('Room type added');
      }
      setRoomModalOpen(false);
      loadData(true);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error saving');
    }
  };

  const deleteRoom = async (hotelId, room) => {
    console.log('Delete room clicked:', hotelId, room);
    if (!confirm(`Delete room type "${room.name}"?`)) {
      console.log('Delete cancelled by user');
      return;
    }

    try {
      console.log('Deleting room type...', hotelId, room.id);
      await hotelsApi.deleteRoomType(hotelId, room.id);
      toast.success('Room type deleted');
      loadData(true);
    } catch (error) {
      console.error('Delete room error:', error);
      toast.error(error.response?.data?.error || 'Error deleting');
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
      toast.error('Enter city name');
      return;
    }

    try {
      if (editingCity) {
        await citiesApi.update(editingCity.id, cityForm);
        toast.success('City updated');
      } else {
        await citiesApi.create(cityForm);
        toast.success('City added');
      }
      setCityModalOpen(false);
      loadData(true);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error saving');
    }
  };

  const deleteCity = async (city) => {
    if (!confirm(`Delete city "${city.nameEn || city.name}"?`)) return;

    try {
      const response = await citiesApi.delete(city.id);

      // Check if city was deactivated instead of deleted (has hotels)
      if (response.data?.message?.includes('деактивирован')) {
        toast.success('City deactivated (has linked hotels)');
      } else {
        toast.success('City deleted');
      }

      // Reset selected city if deleted
      if (selectedCity === city.id.toString()) {
        const remainingCities = cities.filter(c => c.id !== city.id);
        if (remainingCities.length > 0) {
          handleCityChange(remainingCities[0].id.toString());
        } else {
          handleCityChange('');
        }
      }
      loadData(true);
    } catch (error) {
      console.error('Delete city error:', error);
      toast.error(error.response?.data?.error || 'Error deleting city');
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
    'PAX': 'PAX (per person)',
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
      toast.error('Error loading images');
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
      toast.success('Image uploaded');
      // Reload images
      const res = await hotelsApi.getImages(imageModalHotel.id);
      setHotelImages(res.data.images || []);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error uploading');
    } finally {
      setUploadingImage(false);
    }
  };

  const deleteImage = async (imageId) => {
    if (!confirm('Delete image?')) return;

    try {
      await hotelsApi.deleteImage(imageModalHotel.id, imageId);
      toast.success('Image deleted');
      setHotelImages(prev => prev.filter(img => img.id !== imageId));
    } catch (error) {
      toast.error('Error deleting');
    }
  };

  const setMainImage = async (imageId) => {
    try {
      await hotelsApi.updateImage(imageModalHotel.id, imageId, { isMain: true });
      toast.success('Main image set');
      // Reload images
      const res = await hotelsApi.getImages(imageModalHotel.id);
      setHotelImages(res.data.images || []);
    } catch (error) {
      toast.error('Error updating');
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
      toast.error('Error loading seasonal prices');
      setSeasonalPrices([]);
    }
  };

  const saveSeason = async () => {
    if (!seasonForm.name.trim() || !seasonForm.startDate || !seasonForm.endDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      if (editingSeason) {
        await hotelsApi.updateSeasonalPrice(
          seasonModalHotelId, seasonModalRoom.id, editingSeason.id, seasonForm
        );
        toast.success('Seasonal price updated');
      } else {
        await hotelsApi.createSeasonalPrice(
          seasonModalHotelId, seasonModalRoom.id, seasonForm
        );
        toast.success('Seasonal price added');
      }
      // Reload
      const res = await hotelsApi.getSeasonalPrices(seasonModalHotelId, seasonModalRoom.id);
      setSeasonalPrices(res.data.seasonalPrices || []);
      setEditingSeason(null);
      setSeasonForm({ name: '', startDate: '', endDate: '', pricePerNight: 0 });
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error saving');
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
    if (!confirm('Delete seasonal price?')) return;

    try {
      await hotelsApi.deleteSeasonalPrice(seasonModalHotelId, seasonModalRoom.id, seasonId);
      toast.success('Seasonal price deleted');
      setSeasonalPrices(prev => prev.filter(s => s.id !== seasonId));
    } catch (error) {
      toast.error('Error deleting');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Get city color based on name
  const getCityColor = (cityName) => {
    const name = (cityName || '').toLowerCase();
    if (name.includes('tashkent') || name.includes('ташкент')) return { bg: 'from-blue-500 to-blue-600', light: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' };
    if (name.includes('samarkand') || name.includes('самарканд')) return { bg: 'from-purple-500 to-purple-600', light: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200' };
    if (name.includes('bukhara') || name.includes('бухара')) return { bg: 'from-amber-500 to-amber-600', light: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' };
    if (name.includes('khiva') || name.includes('хива')) return { bg: 'from-teal-500 to-teal-600', light: 'bg-teal-50', text: 'text-teal-600', border: 'border-teal-200' };
    if (name.includes('fergana') || name.includes('фергана')) return { bg: 'from-rose-500 to-rose-600', light: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200' };
    if (name.includes('asraf') || name.includes('асраф')) return { bg: 'from-emerald-500 to-emerald-600', light: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' };
    return { bg: 'from-gray-500 to-gray-600', light: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' };
  };

  // Room type icons and colors
  const getRoomTypeStyle = (roomName) => {
    const name = (roomName || '').toUpperCase();
    if (name === 'SNGL') return { icon: Users, color: 'text-blue-500', bg: 'bg-blue-50', label: '1' };
    if (name === 'DBL') return { icon: Users, color: 'text-green-500', bg: 'bg-green-50', label: '2' };
    if (name === 'TWN') return { icon: Bed, color: 'text-purple-500', bg: 'bg-purple-50', label: '2' };
    if (name === 'TRPL') return { icon: Users, color: 'text-orange-500', bg: 'bg-orange-50', label: '3' };
    if (name === 'PAX') return { icon: Users, color: 'text-cyan-500', bg: 'bg-cyan-50', label: '1' };
    if (name.includes('SUITE')) return { icon: Sparkles, color: 'text-amber-500', bg: 'bg-amber-50', label: '' };
    if (name.includes('DELUXE')) return { icon: Star, color: 'text-rose-500', bg: 'bg-rose-50', label: '' };
    return { icon: Bed, color: 'text-gray-500', bg: 'bg-gray-50', label: '' };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="px-3 md:px-6 py-4 md:py-6 space-y-4 md:space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden bg-white rounded-2xl md:rounded-3xl shadow-2xl border-2 border-primary-100">
          <div className="absolute inset-0 bg-gradient-to-r from-primary-500/10 via-purple-500/5 to-pink-500/10"></div>
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-primary-400/20 to-purple-400/20 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-gradient-to-br from-pink-400/20 to-purple-400/20 rounded-full blur-3xl"></div>
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 p-4 md:p-8">
            <div className="flex items-center gap-3 md:gap-6">
              <div className="relative flex-shrink-0">
                <div className="w-14 h-14 md:w-20 md:h-20 bg-gradient-to-br from-primary-500 via-purple-500 to-primary-700 rounded-2xl md:rounded-3xl flex items-center justify-center shadow-2xl shadow-primary-500/40 transform hover:scale-110 transition-transform duration-300">
                  <Building2 className="w-7 h-7 md:w-10 md:h-10 text-white" />
                </div>
                <div className="absolute -bottom-1 md:-bottom-2 -right-1 md:-right-2 w-6 h-6 md:w-8 md:h-8 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                  <span className="text-[10px] md:text-xs font-bold text-white">
                    {groupedHotels.reduce((sum, g) => sum + g.hotels.length, 0)}
                  </span>
                </div>
              </div>
              <div>
                <h1 className="text-xl md:text-3xl font-black bg-gradient-to-r from-primary-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Hotels Management
                </h1>
                <p className="text-slate-600 text-xs md:text-sm mt-0.5 md:mt-1 font-medium">Luxury hotels and room reservations</p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                onClick={openTelegramFinder}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-semibold text-sm transition-all min-h-[44px]"
                title="Telegram Chat ID topish"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Telegram Finder</span>
              </button>
              <button
                onClick={() => openHotelModal()}
                className="inline-flex items-center justify-center gap-2 px-4 md:px-6 py-2.5 md:py-3 bg-gradient-to-r from-primary-500 via-purple-500 to-primary-600 text-white rounded-xl md:rounded-2xl hover:shadow-2xl hover:shadow-primary-500/40 hover:-translate-y-1 transition-all duration-300 font-bold text-sm md:text-base min-h-[44px] w-full sm:w-auto"
              >
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline">Add Hotel</span>
                <span className="sm:hidden">Add</span>
              </button>
            </div>
          </div>
        </div>

        {/* Search and City Tabs */}
        <div className="bg-white rounded-2xl md:rounded-3xl shadow-2xl border-2 border-slate-100 overflow-hidden">
          {/* Search Bar */}
          <div className="p-3 md:p-6 border-b-2 border-gradient-to-r from-primary-100 via-purple-100 to-pink-100">
            <div className="relative max-w-2xl mx-auto">
              <div className="absolute left-3 md:left-5 top-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-primary-500 to-purple-500 rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg">
                <Search className="w-5 h-5 md:w-6 md:h-6 text-white" />
              </div>
              <input
                type="text"
                placeholder={isMobile ? "Search hotels..." : "Search hotels by name or city..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-16 md:pl-20 pr-4 md:pr-6 py-3 md:py-4 bg-gradient-to-r from-slate-50 to-white border-2 border-slate-200 rounded-xl md:rounded-2xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all text-slate-800 placeholder:text-slate-400 text-sm md:text-base font-medium shadow-inner"
              />
            </div>
          </div>

          {/* City Tabs */}
          <div className="p-3 md:p-6 bg-gradient-to-br from-slate-50 via-white to-slate-50">
            <div className="flex items-center gap-2 md:gap-4 flex-wrap justify-center">
              {(() => {
                const cityOrder = ['Tashkent', 'Samarkand', 'Fergana', 'Asraf', 'Bukhara', 'Khiva'];
                const sortedCities = [...cities].sort((a, b) => {
                  const aName = (a.nameEn || a.name || '').toLowerCase();
                  const bName = (b.nameEn || b.name || '').toLowerCase();
                  const aIndex = cityOrder.findIndex(c => c.toLowerCase() === aName);
                  const bIndex = cityOrder.findIndex(c => c.toLowerCase() === bName);
                  if (aIndex === -1 && bIndex === -1) return 0;
                  if (aIndex === -1) return 1;
                  if (bIndex === -1) return -1;
                  return aIndex - bIndex;
                });

                return sortedCities.map(city => {
                  const isActive = selectedCity === city.id.toString();
                  const colors = getCityColor(city.nameEn || city.name);
                  const hotelCount = groupedHotels.find(g => g.city.id === city.id)?.hotels.length || 0;

                  return (
                    <div key={city.id} className="relative group/tab">
                      <button
                        onClick={() => handleCityChange(city.id.toString())}
                        className={`relative px-3 md:px-6 py-2.5 md:py-4 rounded-xl md:rounded-2xl text-sm md:text-base font-bold transition-all duration-300 transform min-h-[44px] ${
                          isActive
                            ? `bg-gradient-to-r ${colors.bg} text-white shadow-2xl shadow-primary-500/30 scale-110 hover:scale-115`
                            : 'bg-white text-slate-700 hover:bg-gradient-to-br hover:from-slate-50 hover:to-white border-2 border-slate-200 hover:border-primary-300 hover:shadow-xl hover:scale-105'
                        }`}
                      >
                        <span className="flex items-center gap-2 md:gap-3">
                          <MapPin className={`w-4 h-4 md:w-6 md:h-6 ${isActive ? 'text-white' : colors.text}`} />
                          <span className="hidden sm:inline">{city.nameEn || city.name}</span>
                          <span className="sm:hidden">{(city.nameEn || city.name).substring(0, 3)}</span>
                          {hotelCount > 0 && (
                            <span className={`px-2 md:px-3 py-0.5 md:py-1 rounded-lg md:rounded-xl text-xs md:text-sm font-black ${
                              isActive ? 'bg-white/30 text-white backdrop-blur-sm' : `${colors.light} ${colors.text}`
                            }`}>
                              {hotelCount}
                            </span>
                          )}
                        </span>
                      </button>
                      {/* Delete city button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          deleteCity(city);
                        }}
                        className="absolute -top-2 md:-top-3 -right-2 md:-right-3 w-7 h-7 md:w-8 md:h-8 bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-full flex items-center justify-center opacity-0 group-hover/tab:opacity-100 shadow-2xl hover:scale-125 z-10 cursor-pointer transition-all duration-300"
                        title="Delete city"
                      >
                        <X className="w-4 h-4 md:w-5 md:h-5 pointer-events-none" />
                      </button>
                    </div>
                  );
                });
              })()}

              {/* Add City Button */}
              <button
                onClick={() => {
                  setEditingCity(null);
                  setCityForm({ name: '', nameEn: '', sortOrder: cities.length });
                  setCityModalOpen(true);
                }}
                className="px-3 md:px-4 py-2.5 md:py-3 rounded-lg md:rounded-xl text-sm md:text-base font-medium text-slate-400 hover:text-slate-600 border-2 border-dashed border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
                title="Add city"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Hotels List */}
        <div className="space-y-6 md:space-y-8">
          {filteredGroups.map(group => {
            const cityColors = getCityColor(group.city.nameEn || group.city.name);

            return (
              <div key={group.city.id} className="space-y-3 md:space-y-5">
                {/* City Header */}
                <div
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between cursor-pointer group py-3 px-3 md:px-4 bg-white rounded-xl md:rounded-2xl shadow-lg border-2 border-slate-100 hover:shadow-2xl hover:border-primary-200 transition-all duration-300 gap-3 sm:gap-0"
                  onClick={() => toggleCity(group.city.id)}
                >
                  <div className="flex items-center gap-3 md:gap-5 w-full sm:w-auto">
                    <div className={`w-1.5 md:w-2 h-12 md:h-14 rounded-full bg-gradient-to-b ${cityColors.bg} shadow-lg flex-shrink-0`}></div>
                    <h2 className="text-lg md:text-2xl font-black text-slate-800">{group.city.nameEn || group.city.name}</h2>
                    <span className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl text-xs md:text-sm font-black ${cityColors.light} ${cityColors.text} shadow-md`}>
                      {group.hotels.length} {group.hotels.length === 1 ? 'hotel' : 'hotels'}
                    </span>
                    {expandedCities[group.city.id] ? (
                      <ChevronDown className="w-6 h-6 md:w-7 md:h-7 text-slate-400 group-hover:text-primary-600 transition-colors ml-auto sm:ml-0" />
                    ) : (
                      <ChevronRight className="w-6 h-6 md:w-7 md:h-7 text-slate-400 group-hover:text-primary-600 transition-colors ml-auto sm:ml-0" />
                    )}
                  </div>
                  <div className={`flex items-center gap-2 md:gap-3 w-full sm:w-auto ${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-all`}>
                    <button
                      onClick={(e) => { e.stopPropagation(); openHotelModal(null, group.city.id); }}
                      className="p-2.5 md:p-3 text-white bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 rounded-lg md:rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:scale-110 min-w-[44px] min-h-[44px] flex items-center justify-center"
                      title="Add hotel to this city"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); openCityModal(group.city); }}
                      className="p-2.5 md:p-3 text-white bg-gradient-to-r from-primary-500 to-purple-500 hover:from-primary-600 hover:to-purple-600 rounded-lg md:rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:scale-110 min-w-[44px] min-h-[44px] flex items-center justify-center"
                      title="Edit city"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteCity(group.city); }}
                      className="p-2.5 md:p-3 text-white bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 rounded-lg md:rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:scale-110 min-w-[44px] min-h-[44px] flex items-center justify-center"
                      title="Delete city"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Hotels - Single Row Layout */}
                {expandedCities[group.city.id] && (
                  <div className="space-y-4">
                    {group.hotels.map(hotel => {
                      // Calculate price for display
                      const getDisplayPrice = (room) => {
                        let basePrice = room.pricePerNight;
                        const vatAmount = room.vatIncluded ? basePrice * 0.12 : 0;
                        let price = basePrice + vatAmount;
                        if (room.touristTaxEnabled && room.brvValue > 0) {
                          const totalRooms = hotel.totalRooms || 0;
                          let percentage = totalRooms <= 10 ? 0.05 : totalRooms <= 40 ? 0.10 : 0.15;
                          let tax = room.brvValue * percentage * (room.maxGuests || 1);
                          if (room.currency === 'USD') price += tax / 12700;
                          else if (room.currency === 'EUR') price += tax / 13500;
                          else price += tax;
                        }
                        return price;
                      };

                      return (
                        <div
                          key={hotel.id}
                          className="bg-white rounded-xl md:rounded-2xl border-2 border-slate-200 hover:border-primary-300 hover:shadow-2xl transition-all duration-300 overflow-hidden transform hover:scale-[1.01] md:hover:scale-[1.02]"
                        >
                          {/* Single Row: Hotel Info + Room Types + Actions */}
                          <div className={`flex ${isMobile ? 'flex-col' : 'items-stretch'}`}>
                            {/* Hotel Info - Left Side */}
                            <div
                              className={`${isMobile ? 'w-full' : 'w-80 flex-shrink-0 border-r-2'} p-4 md:p-6 border-slate-100 cursor-pointer hover:bg-gradient-to-br hover:from-slate-50 hover:to-white transition-all duration-300 bg-gradient-to-br ${cityColors.light}`}
                              onClick={() => toggleHotel(hotel.id)}
                            >
                              <div className="flex items-center gap-3 md:gap-4">
                                <div className={`w-14 h-14 md:w-20 md:h-20 bg-white rounded-2xl md:rounded-3xl flex items-center justify-center shadow-xl border-2 border-slate-100 flex-shrink-0`}>
                                  {hotel.stars && !isNaN(parseInt(hotel.stars)) ? (
                                    <div className="flex flex-col items-center">
                                      <Star className={`w-6 h-6 md:w-8 md:h-8 ${cityColors.text} fill-current`} />
                                      <span className={`text-sm md:text-base font-black ${cityColors.text}`}>{hotel.stars}</span>
                                    </div>
                                  ) : hotel.stars === 'Guesthouse' || hotel.stars === 'Yurta' ? (
                                    <Home className={`w-7 h-7 md:w-10 md:h-10 ${cityColors.text}`} />
                                  ) : (
                                    <Building2 className={`w-7 h-7 md:w-10 md:h-10 ${cityColors.text}`} />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-black text-base md:text-xl text-slate-900 truncate">{hotel.name}</h3>
                                  {hotel.address && (
                                    <p className="text-xs md:text-sm text-slate-600 truncate mt-0.5 md:mt-1 font-medium">{hotel.address}</p>
                                  )}
                                  <div className="flex items-center gap-2 mt-1 md:mt-2">
                                    <span className={`px-2 md:px-3 py-0.5 md:py-1 rounded-lg md:rounded-xl text-xs font-black ${cityColors.light} ${cityColors.text} shadow-sm`}>
                                      {hotel.roomTypes?.length || 0} room types
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Room Types - Middle (Scrollable) */}
                            <div className={`flex-1 flex items-center gap-3 md:gap-4 px-3 md:px-6 py-3 md:py-5 overflow-x-auto ${isMobile ? 'border-t-2 border-slate-100' : ''}`}>
                              {hotel.roomTypes?.length > 0 ? (
                                hotel.roomTypes.map(room => {
                                  const roomStyle = getRoomTypeStyle(room.name);
                                  const price = getDisplayPrice(room);
                                  const symbol = room.currency === 'USD' ? '$' : room.currency === 'EUR' ? '€' : '';

                                  return (
                                    <div
                                      key={room.id}
                                      className={`flex-shrink-0 px-4 md:px-6 py-3 md:py-4 rounded-xl md:rounded-2xl border-2 ${roomStyle.bg} border-slate-200 hover:shadow-2xl hover:scale-105 md:hover:scale-110 transition-all duration-300 cursor-pointer group relative min-w-[140px]`}
                                      onClick={() => openRoomModal(hotel.id, room)}
                                    >
                                      <div className="flex items-center gap-2 md:gap-3">
                                        <span className={`font-black text-base md:text-lg ${roomStyle.color}`}>{room.name}</span>
                                        <span className="text-base md:text-lg font-black text-slate-800">
                                          {symbol}{price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                          {room.currency === 'UZS' && ' UZS'}
                                        </span>
                                      </div>
                                      {/* Hover actions */}
                                      <div className={`absolute -top-2 md:-top-3 -right-2 md:-right-3 flex gap-1 md:gap-1.5 ${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); openSeasonModal(hotel.id, room); }}
                                          className="w-7 h-7 md:w-8 md:h-8 bg-gradient-to-br from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-full flex items-center justify-center shadow-xl transform hover:scale-125 transition-all"
                                          title="Seasonal prices"
                                        >
                                          <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                        </button>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); deleteRoom(hotel.id, room); }}
                                          className="w-7 h-7 md:w-8 md:h-8 bg-gradient-to-br from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white rounded-full flex items-center justify-center shadow-xl transform hover:scale-125 transition-all"
                                          title="Delete"
                                        >
                                          <X className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })
                              ) : (
                                <span className="text-sm md:text-base text-slate-400 italic font-medium">No room types</span>
                              )}

                              {/* Add Room Button */}
                              <button
                                onClick={() => openRoomModal(hotel.id)}
                                className="flex-shrink-0 px-4 md:px-5 py-3 md:py-4 rounded-xl md:rounded-2xl border-3 border-dashed border-emerald-400 text-emerald-600 hover:bg-gradient-to-br hover:from-emerald-50 hover:to-green-50 hover:border-emerald-500 hover:shadow-xl transition-all duration-300 transform hover:scale-110 min-w-[44px] min-h-[44px] flex items-center justify-center"
                              >
                                <Plus className="w-5 h-5 md:w-6 md:h-6" />
                              </button>
                            </div>

                            {/* Actions - Right Side */}
                            <div className={`flex-shrink-0 flex items-center ${isMobile ? 'justify-center' : ''} gap-2 md:gap-3 px-3 md:px-5 py-3 md:py-0 border-slate-100 bg-gradient-to-br from-slate-50 to-white ${isMobile ? 'border-t-2' : 'border-l-2'}`}>
                              <button
                                onClick={() => openImageModal(hotel)}
                                className="p-2.5 md:p-3 text-white bg-gradient-to-br from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 rounded-xl md:rounded-2xl transition-all shadow-lg hover:shadow-2xl transform hover:scale-110 min-w-[44px] min-h-[44px] flex items-center justify-center"
                                title="Photos"
                              >
                                <Image className="w-5 h-5 md:w-6 md:h-6" />
                              </button>
                              <button
                                onClick={() => openHotelModal(hotel)}
                                className="p-2.5 md:p-3 text-white bg-gradient-to-br from-primary-500 to-purple-500 hover:from-primary-600 hover:to-purple-600 rounded-xl md:rounded-2xl transition-all shadow-lg hover:shadow-2xl transform hover:scale-110 min-w-[44px] min-h-[44px] flex items-center justify-center"
                                title="Edit"
                              >
                                <Edit className="w-5 h-5 md:w-6 md:h-6" />
                              </button>
                              <button
                                onClick={() => deleteHotel(hotel)}
                                className="p-2.5 md:p-3 text-white bg-gradient-to-br from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 rounded-xl md:rounded-2xl transition-all shadow-lg hover:shadow-2xl transform hover:scale-110 min-w-[44px] min-h-[44px] flex items-center justify-center"
                                title="Delete"
                              >
                                <Trash2 className="w-5 h-5 md:w-6 md:h-6" />
                              </button>
                            </div>
                          </div>

                          {/* Expanded Details (Optional) */}
                          {expandedHotels[hotel.id] && hotel.roomTypes?.length > 0 && (
                            <div className="border-t border-slate-100 bg-slate-50/50 p-4">
                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                                {hotel.roomTypes.map(room => {
                                  const roomStyle = getRoomTypeStyle(room.name);
                                  const RoomIcon = roomStyle.icon;
                                  const price = getDisplayPrice(room);
                                  const symbol = room.currency === 'USD' ? '$' : room.currency === 'EUR' ? '€' : '';

                                  return (
                                    <div
                                      key={room.id}
                                      className="bg-white rounded-xl p-4 border border-slate-200 hover:shadow-md transition-all group"
                                    >
                                      <div className="flex items-center gap-2 mb-2">
                                        <div className={`w-8 h-8 ${roomStyle.bg} rounded-lg flex items-center justify-center`}>
                                          <RoomIcon className={`w-4 h-4 ${roomStyle.color}`} />
                                        </div>
                                        <span className="font-bold text-slate-800">{room.name}</span>
                                      </div>
                                      {room.displayName && (
                                        <p className="text-xs text-slate-500 mb-2 truncate">{room.displayName}</p>
                                      )}
                                      <div className="text-lg font-bold text-emerald-600">
                                        {symbol}{price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        {room.currency === 'UZS' && ' UZS'}
                                      </div>
                                      <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                          onClick={() => openSeasonModal(hotel.id, room)}
                                          className="flex-1 p-1.5 text-xs text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg"
                                        >
                                          <Calendar className="w-3 h-3 mx-auto" />
                                        </button>
                                        <button
                                          onClick={() => openRoomModal(hotel.id, room)}
                                          className="flex-1 p-1.5 text-xs text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg"
                                        >
                                          <Edit className="w-3 h-3 mx-auto" />
                                        </button>
                                        <button
                                          onClick={() => deleteRoom(hotel.id, room)}
                                          className="flex-1 p-1.5 text-xs text-red-600 bg-red-50 hover:bg-red-100 rounded-lg"
                                        >
                                          <Trash2 className="w-3 h-3 mx-auto" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Add Hotel to this City */}
                    <button
                      onClick={() => openHotelModal(null, group.city.id)}
                      className="w-full py-5 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 hover:text-primary-600 hover:border-primary-400 hover:bg-primary-50/50 transition-all flex items-center justify-center gap-3"
                    >
                      <Plus className="w-6 h-6" />
                      <span className="font-semibold text-base">Add Hotel to {group.city.nameEn || group.city.name}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {filteredGroups.length === 0 && (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-700 mb-2">
                {searchQuery ? 'No hotels found' : 'No hotels'}
              </h3>
              <p className="text-slate-500 mb-4">
                {searchQuery ? 'Try changing your search query' : 'Add your first hotel to get started'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => openHotelModal()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-500 text-white font-medium rounded-xl hover:bg-primary-600 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Add Hotel
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Hotel Modal */}
      {hotelModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary-600" />
                </div>
                <h2 className="text-lg font-semibold text-slate-800">
                  {editingHotel ? 'Edit Hotel' : 'New Hotel'}
                </h2>
              </div>
              <button onClick={() => setHotelModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Name *</label>
                  <input
                    type="text"
                    value={hotelForm.name}
                    onChange={(e) => setHotelForm({ ...hotelForm, name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all"
                    placeholder="Hotel Uzbekistan"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">City *</label>
                  <select
                    value={hotelForm.cityId}
                    onChange={(e) => setHotelForm({ ...hotelForm, cityId: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all"
                  >
                    <option value="">Select</option>
                    {cities.map(city => (
                      <option key={city.id} value={city.id}>{city.nameEn || city.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Category</label>
                  <select
                    value={hotelForm.stars}
                    onChange={(e) => setHotelForm({ ...hotelForm, stars: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all"
                  >
                    <option value="">Not specified</option>
                    {[1,2,3,4,5].map(n => (
                      <option key={n} value={String(n)}>{n} {'★'.repeat(n)}</option>
                    ))}
                    <option value="Guesthouse">Guesthouse</option>
                    <option value="Yurta">Yurta</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Total Rooms
                    <span className="text-xs text-slate-500 ml-1">(for tourist tax %)</span>
                  </label>
                  <input
                    type="number"
                    value={hotelForm.totalRooms || ''}
                    onChange={(e) => setHotelForm({ ...hotelForm, totalRooms: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all"
                    min={0}
                    step={1}
                    placeholder="30"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    ≤10: 5% | ≤40: 10% | &gt;40: 15%
                  </p>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Address</label>
                  <input
                    type="text"
                    value={hotelForm.address}
                    onChange={(e) => setHotelForm({ ...hotelForm, address: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all"
                    placeholder="123 Main Street"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
                  <input
                    type="text"
                    value={hotelForm.phone}
                    onChange={(e) => setHotelForm({ ...hotelForm, phone: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all"
                    placeholder="+998 71 123 45 67"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={hotelForm.email}
                    onChange={(e) => setHotelForm({ ...hotelForm, email: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all"
                    placeholder="info@hotel.uz"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Telegram Chat ID</label>
                  <input
                    type="text"
                    value={hotelForm.telegramChatId}
                    onChange={(e) => setHotelForm({ ...hotelForm, telegramChatId: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all"
                    placeholder="123456789"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Website</label>
                  <input
                    type="url"
                    value={hotelForm.website}
                    onChange={(e) => setHotelForm({ ...hotelForm, website: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all"
                    placeholder="https://hotel.uz"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
                  <textarea
                    value={hotelForm.description}
                    onChange={(e) => setHotelForm({ ...hotelForm, description: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all resize-none"
                    rows={3}
                    placeholder="Additional information..."
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-100 bg-slate-50">
              <button
                onClick={() => setHotelModalOpen(false)}
                className="px-5 py-2.5 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveHotel}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-500 text-white rounded-xl hover:bg-primary-600 font-medium shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40 transition-all"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Room Type Modal */}
      {roomModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-start justify-center z-50 overflow-y-auto p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl my-8 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <Bed className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">
                    {editingRoom ? 'Edit Room Type' : 'New Room Type'}
                  </h2>
                  {currentHotel && (
                    <p className="text-xs text-slate-500">{currentHotel.name}</p>
                  )}
                </div>
              </div>
              <button onClick={() => setRoomModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto">
              {/* Room Type Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Room Type *</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {roomTypePresets.map(preset => {
                    const style = getRoomTypeStyle(preset);
                    const isSelected = roomForm.name === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          const guestsByType = { 'PAX': 1, 'SNGL': 1, 'DBL': 2, 'TWN': 2, 'TRPL': 3, 'Suite': 2, 'Deluxe': 2 };
                          setRoomForm({
                            ...roomForm,
                            name: preset,
                            displayName: roomTypeDisplayNames[preset] || preset,
                            maxGuests: guestsByType[preset] || 2
                          });
                        }}
                        className={`px-4 py-2 text-sm font-medium rounded-xl border-2 transition-all ${
                          isSelected
                            ? `${style.bg} ${style.color} border-current shadow-sm`
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {preset}
                      </button>
                    );
                  })}
                </div>
                <input
                  type="text"
                  value={roomForm.name}
                  onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all"
                  placeholder="Or enter your own type"
                  maxLength={20}
                />
              </div>

              {/* Display Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Display Name</label>
                <input
                  type="text"
                  value={roomForm.displayName}
                  onChange={(e) => setRoomForm({ ...roomForm, displayName: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all"
                  placeholder="Double Room"
                />
              </div>

              {/* Price and Currency */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Base Price per Night
                  </label>
                  <input
                    type="number"
                    value={roomForm.pricePerNight || ''}
                    onChange={(e) => setRoomForm({ ...roomForm, pricePerNight: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all"
                    min={0}
                    step={0.01}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-slate-500 mt-1">Taxes will be calculated below</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Currency</label>
                  <select
                    value={roomForm.currency}
                    onChange={(e) => setRoomForm({ ...roomForm, currency: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="UZS">UZS</option>
                  </select>
                </div>
              </div>

              {/* Max Guests */}
              <div className="w-32">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Guests</label>
                <input
                  type="number"
                  value={roomForm.maxGuests}
                  onChange={(e) => setRoomForm({ ...roomForm, maxGuests: parseInt(e.target.value) || 2 })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all text-center"
                  min={1}
                />
              </div>

              {/* Taxes Section */}
              <div className="p-4 bg-slate-50 rounded-xl space-y-3">
                <h4 className="text-sm font-medium text-slate-700">Taxes & Fees</h4>

                {/* VAT */}
                <label className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-primary-300 transition-colors">
                  <input
                    type="checkbox"
                    checked={roomForm.vatIncluded}
                    onChange={(e) => setRoomForm({ ...roomForm, vatIncluded: e.target.checked })}
                    className="w-5 h-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-slate-700">VAT 12%</span>
                    <p className="text-xs text-slate-500">Value Added Tax</p>
                  </div>
                  {roomForm.vatIncluded && roomForm.pricePerNight > 0 && (
                    <span className="text-sm font-medium text-emerald-600">
                      +{(roomForm.pricePerNight * 0.12).toLocaleString()} {roomForm.currency}
                    </span>
                  )}
                </label>

                {/* Tourist Tax */}
                <label className="flex items-start gap-3 p-3 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-primary-300 transition-colors">
                  <input
                    type="checkbox"
                    checked={roomForm.touristTaxEnabled}
                    onChange={(e) => setRoomForm({ ...roomForm, touristTaxEnabled: e.target.checked })}
                    className="w-5 h-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 mt-0.5"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-slate-700">Tourist Tax</span>
                    {roomForm.touristTaxEnabled && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-slate-500">BRV:</span>
                        <input
                          type="number"
                          value={roomForm.brvValue || ''}
                          onChange={(e) => setRoomForm({ ...roomForm, brvValue: parseFloat(e.target.value) || 0 })}
                          className="w-28 px-2 py-1 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-primary-500"
                          min={0}
                          step={1000}
                          placeholder="412000"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="text-xs text-slate-500">UZS</span>
                        {roomForm.brvValue > 0 && (() => {
                          const totalRooms = currentHotel?.totalRooms || 0;
                          const percentage = totalRooms <= 10 ? 0.05 : totalRooms <= 40 ? 0.10 : 0.15;
                          const maxGuests = parseInt(roomForm.maxGuests) || 1;
                          const tax = roomForm.brvValue * percentage * maxGuests;
                          return (
                            <span className="text-xs text-emerald-600 font-medium">
                              = {tax.toLocaleString()} UZS
                            </span>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </label>
              </div>

              {/* Price Summary - Show total calculation with taxes */}
              {parseFloat(roomForm.pricePerNight) > 0 && (
                <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 space-y-2">
                  {(() => {
                    const basePrice = parseFloat(roomForm.pricePerNight) || 0;
                    const currencySymbol = roomForm.currency === 'USD' ? '$' : roomForm.currency === 'EUR' ? '€' : '';
                    const vatAmount = roomForm.vatIncluded ? basePrice * 0.12 : 0;
                    const priceWithVat = basePrice + vatAmount;

                    let touristTax = 0;
                    if (roomForm.touristTaxEnabled && roomForm.brvValue > 0) {
                      const totalRooms = currentHotel?.totalRooms || 0;
                      let percentage = totalRooms <= 10 ? 0.05 : totalRooms <= 40 ? 0.10 : 0.15;
                      touristTax = roomForm.brvValue * percentage * (roomForm.maxGuests || 1);
                    }

                    let totalPrice = priceWithVat;
                    if (roomForm.currency === 'UZS') {
                      totalPrice = priceWithVat + touristTax;
                    } else if (touristTax > 0) {
                      const rate = roomForm.currency === 'USD' ? 12700 : 13500;
                      totalPrice = priceWithVat + (touristTax / rate);
                    }

                    return (
                      <>
                        <div className="text-xs font-semibold text-slate-600 mb-2">Price Breakdown:</div>

                        {/* Base Price */}
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600">
                            {editingRoom ? 'Current Price' : 'Base Price'}:
                          </span>
                          <span className="font-medium text-slate-800">
                            {currencySymbol}{roomForm.currency === 'UZS' ? basePrice.toLocaleString() : basePrice.toFixed(2)}
                            {roomForm.currency === 'UZS' ? ' UZS' : ` ${roomForm.currency}`}
                          </span>
                        </div>

                        {/* VAT */}
                        {roomForm.vatIncluded && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">+ VAT 12%:</span>
                            <span className="font-medium text-emerald-600">
                              +{currencySymbol}{roomForm.currency === 'UZS' ? vatAmount.toLocaleString() : vatAmount.toFixed(2)}
                              {roomForm.currency === 'UZS' ? ' UZS' : ` ${roomForm.currency}`}
                            </span>
                          </div>
                        )}

                        {/* Tourist Tax */}
                        {roomForm.touristTaxEnabled && touristTax > 0 && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">+ Tourist Tax:</span>
                            <span className="font-medium text-emerald-600">
                              {roomForm.currency === 'UZS' ? (
                                `+${touristTax.toLocaleString()} UZS`
                              ) : (
                                `+${currencySymbol}${(touristTax / (roomForm.currency === 'USD' ? 12700 : 13500)).toFixed(2)} ${roomForm.currency}`
                              )}
                            </span>
                          </div>
                        )}

                        {/* Divider */}
                        <div className="border-t border-emerald-200 my-1"></div>

                        {/* Total */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-slate-700">
                            Total per {roomForm.name === 'PAX' ? 'person' : 'room'}/night:
                          </span>
                          <span className="text-xl font-bold text-emerald-600">
                            {currencySymbol}{roomForm.currency === 'UZS' ? totalPrice.toLocaleString() : totalPrice.toFixed(2)}
                            {roomForm.currency === 'UZS' ? ' UZS' : ` ${roomForm.currency}`}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-100 bg-slate-50">
              <button
                onClick={() => setRoomModalOpen(false)}
                className="px-5 py-2.5 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveRoom}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 font-medium shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* City Modal */}
      {cityModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-violet-600" />
                </div>
                <h2 className="text-lg font-semibold text-slate-800">
                  {editingCity ? 'Edit City' : 'New City'}
                </h2>
              </div>
              <button onClick={() => setCityModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Name (Local) *</label>
                <input
                  type="text"
                  value={cityForm.name}
                  onChange={(e) => setCityForm({ ...cityForm, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all"
                  placeholder="Toshkent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Name (English)</label>
                <input
                  type="text"
                  value={cityForm.nameEn}
                  onChange={(e) => setCityForm({ ...cityForm, nameEn: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all"
                  placeholder="Tashkent"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-100 bg-slate-50">
              <button
                onClick={() => setCityModalOpen(false)}
                className="px-5 py-2.5 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveCity}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-500 text-white rounded-xl hover:bg-violet-600 font-medium shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Gallery Modal - Full Page */}
      {imageModalOpen && imageModalHotel && (
        <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-rose-500/20 rounded-xl flex items-center justify-center">
                <Image className="w-6 h-6 text-rose-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">{imageModalHotel.name}</h2>
                <p className="text-sm text-slate-400">{hotelImages.length} images</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium cursor-pointer transition-all ${
                uploadingImage
                  ? 'bg-slate-700 text-slate-400'
                  : 'bg-gradient-to-r from-rose-500 to-pink-500 text-white hover:shadow-lg hover:shadow-rose-500/30'
              }`}>
                <Upload className="w-4 h-4" />
                {uploadingImage ? 'Uploading...' : 'Upload'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={uploadingImage}
                />
              </label>
              <button
                onClick={() => setImageModalOpen(false)}
                className="p-3 bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Content - Full page gallery */}
          <div className="flex-1 overflow-y-auto p-6">
            {hotelImages.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {hotelImages.map(image => (
                  <div key={image.id} className="relative group rounded-2xl overflow-hidden bg-slate-800 shadow-xl hover:shadow-2xl transition-all hover:scale-[1.02]">
                    <img
                      src={`/api${image.url}`}
                      alt={image.caption || 'Hotel image'}
                      className="w-full h-64 object-cover"
                    />
                    {image.isMain && (
                      <div className="absolute top-3 left-3 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium rounded-lg flex items-center gap-1.5 shadow-lg">
                        <Star className="w-4 h-4 fill-current" />
                        Main
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-6 gap-3">
                      {!image.isMain && (
                        <button
                          onClick={() => setMainImage(image.id)}
                          className="px-4 py-2.5 bg-white/90 backdrop-blur rounded-xl text-amber-600 hover:bg-white shadow-lg font-medium flex items-center gap-2"
                          title="Set as main"
                        >
                          <Star className="w-4 h-4" />
                          Main
                        </button>
                      )}
                      <button
                        onClick={() => deleteImage(image.id)}
                        className="px-4 py-2.5 bg-white/90 backdrop-blur rounded-xl text-red-600 hover:bg-white shadow-lg font-medium flex items-center gap-2"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="w-24 h-24 bg-slate-800 rounded-3xl flex items-center justify-center mb-6">
                  <Image className="w-12 h-12 text-slate-600" />
                </div>
                <h3 className="text-2xl font-medium text-white mb-2">No images</h3>
                <p className="text-slate-400 mb-6">Upload the first hotel image</p>
                <label className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-xl font-medium cursor-pointer hover:shadow-lg hover:shadow-rose-500/30 transition-all">
                  <Upload className="w-5 h-5" />
                  Upload image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={uploadingImage}
                  />
                </label>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Seasonal Pricing Modal */}
      {seasonModalOpen && seasonModalRoom && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">Seasonal Prices</h2>
                  <p className="text-xs text-slate-500">{seasonModalRoom.name} - Base: ${seasonModalRoom.pricePerNight}</p>
                </div>
              </div>
              <button onClick={() => setSeasonModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 flex-1 overflow-y-auto space-y-5">
              {/* Add/Edit form */}
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-5 border border-amber-100">
                <h3 className="text-sm font-medium text-slate-700 mb-4 flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  {editingSeason ? 'Edit Season' : 'Add Season'}
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Name *</label>
                    <input
                      type="text"
                      value={seasonForm.name}
                      onChange={(e) => setSeasonForm({ ...seasonForm, name: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-sm"
                      placeholder="High season..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Price per Night *</label>
                    <input
                      type="number"
                      value={seasonForm.pricePerNight}
                      onChange={(e) => setSeasonForm({ ...seasonForm, pricePerNight: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2.5 bg-white border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-sm"
                      min={0}
                      step={0.01}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Start Date</label>
                    <input
                      type="date"
                      value={seasonForm.startDate}
                      onChange={(e) => setSeasonForm({ ...seasonForm, startDate: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">End Date</label>
                    <input
                      type="date"
                      value={seasonForm.endDate}
                      onChange={(e) => setSeasonForm({ ...seasonForm, endDate: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-sm"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={saveSeason}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl hover:bg-amber-600 text-sm font-medium shadow-lg shadow-amber-500/25 transition-all"
                  >
                    <Save className="w-4 h-4" />
                    {editingSeason ? 'Update' : 'Add'}
                  </button>
                  {editingSeason && (
                    <button
                      onClick={() => {
                        setEditingSeason(null);
                        setSeasonForm({ name: '', startDate: '', endDate: '', pricePerNight: 0 });
                      }}
                      className="px-4 py-2 text-slate-600 hover:bg-white rounded-xl text-sm font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              {/* Existing seasonal prices */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-slate-700">Current Seasons</h3>
                {seasonalPrices.length > 0 ? (
                  <div className="space-y-2">
                    {seasonalPrices.map(season => (
                      <div
                        key={season.id}
                        className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200 hover:border-amber-200 hover:shadow-sm transition-all group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                            <Tag className="w-5 h-5 text-amber-600" />
                          </div>
                          <div>
                            <span className="font-medium text-slate-800">{season.name}</span>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {new Date(season.startDate).toLocaleDateString('ru-RU')} — {new Date(season.endDate).toLocaleDateString('ru-RU')}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-lg font-bold text-emerald-600">${season.pricePerNight}</span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => editSeason(season)}
                              className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteSeason(season.id)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                    <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">No seasonal prices</p>
                    <p className="text-xs text-slate-400 mt-1">Base price is used</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-100 bg-slate-50">
              <button
                onClick={() => setSeasonModalOpen(false)}
                className="px-5 py-2.5 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Telegram Finder Modal */}
      {telegramFinderOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col">
            <div className="bg-gradient-to-r from-sky-500 to-cyan-600 p-5 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Send className="w-6 h-6 text-white" />
                <div>
                  <h2 className="text-lg font-bold text-white">Telegram Finder</h2>
                  <p className="text-sky-100 text-xs">Botga xabar yuborgan odamlarning Chat ID lari</p>
                </div>
              </div>
              <button onClick={() => setTelegramFinderOpen(false)} className="text-white/80 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {telegramLoading ? (
                <div className="text-center py-8 text-gray-500">Yuklanmoqda...</div>
              ) : telegramChats.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Send className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                  <p className="font-medium">Hech kim xabar yubormagan</p>
                  <p className="text-sm mt-1">Hotel menejeri <strong>@OrientInsight_bot</strong> ga istalgan xabar yuborgandan so'ng bu yerda ko'rinadi.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {telegramChats.map(chat => (
                    <div key={chat.chatId} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 truncate">{chat.name}</p>
                        <p className="text-xs text-gray-500">{chat.username || chat.type} · {new Date(chat.date).toLocaleString('ru')}</p>
                        <p className="text-xs text-gray-400 truncate mt-0.5">"{chat.lastMessage}"</p>
                      </div>
                      <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                        <code className="text-sm font-mono bg-sky-100 text-sky-700 px-2 py-1 rounded">{chat.chatId}</code>
                        <button
                          onClick={() => copyChatId(chat.chatId)}
                          className="p-2 text-sky-600 hover:bg-sky-100 rounded-lg transition-colors"
                          title="Nusxalash"
                        >
                          {copiedChatId === chat.chatId ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-100">
              <p className="text-xs text-gray-500 text-center">Chat ID ni nusxalab hotel profilida <strong>Telegram Chat ID</strong> maydoniga joylashtiring</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
