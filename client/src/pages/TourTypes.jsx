import { useState, useEffect } from 'react';
import { tourTypesApi, citiesApi, hotelsApi } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, MapPin, X, Save, Calendar, FileText } from 'lucide-react';

export default function TourTypes() {
  const [tourTypes, setTourTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    color: '#3B82F6'
  });

  // Itinerary state
  const [itineraryModalOpen, setItineraryModalOpen] = useState(false);
  const [selectedTourType, setSelectedTourType] = useState(null);
  const [itinerary, setItinerary] = useState([]);
  const [loadingItinerary, setLoadingItinerary] = useState(false);
  const [editingDay, setEditingDay] = useState(null);
  const [dayFormData, setDayFormData] = useState({
    dayNumber: '',
    title: '',
    description: '',
    activities: '',
    meals: '',
    accommodation: ''
  });

  // Hotels and cities for itinerary
  const [cities, setCities] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [selectedCity, setSelectedCity] = useState('');
  const [filteredHotels, setFilteredHotels] = useState([]);
  const [showDayForm, setShowDayForm] = useState(false);

  useEffect(() => {
    loadTourTypes();
  }, []);

  const loadTourTypes = async () => {
    try {
      const response = await tourTypesApi.getAll(true);
      setTourTypes(response.data.tourTypes);
    } catch (error) {
      toast.error('Error loading tour types');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (type = null) => {
    if (type) {
      setEditingType(type);
      setFormData({
        code: type.code,
        name: type.name,
        description: type.description || '',
        color: type.color || '#3B82F6'
      });
    } else {
      setEditingType(null);
      setFormData({ code: '', name: '', description: '', color: '#3B82F6' });
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingType(null);
    setFormData({ code: '', name: '', description: '', color: '#3B82F6' });
  };

  const handleSave = async () => {
    if (!formData.code.trim() || !formData.name.trim()) {
      toast.error('Fill in required fields');
      return;
    }

    try {
      if (editingType) {
        await tourTypesApi.update(editingType.id, formData);
        toast.success('Tour type updated');
      } else {
        await tourTypesApi.create(formData);
        toast.success('Tour type added');
      }
      closeModal();
      loadTourTypes();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error saving');
    }
  };

  const handleDelete = async (type) => {
    if (!confirm(`Delete tour type ${type.code}?`)) return;

    try {
      await tourTypesApi.delete(type.id);
      toast.success('Tour type deleted');
      loadTourTypes();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error deleting');
    }
  };

  // Itinerary functions
  const openItineraryModal = async (type) => {
    setSelectedTourType(type);
    setItineraryModalOpen(true);
    setLoadingItinerary(true);
    try {
      const [itineraryRes, citiesRes, hotelsRes] = await Promise.all([
        tourTypesApi.getItinerary(type.id),
        citiesApi.getAll(),
        hotelsApi.getAll()
      ]);
      setItinerary(itineraryRes.data.itinerary || []);
      setCities(citiesRes.data.cities || []);
      setHotels(hotelsRes.data.hotels || []);
    } catch (error) {
      toast.error('Error loading tour program');
    } finally {
      setLoadingItinerary(false);
    }
  };

  const closeItineraryModal = () => {
    setItineraryModalOpen(false);
    setSelectedTourType(null);
    setItinerary([]);
    setEditingDay(null);
    setSelectedCity('');
    setCities([]);
    setHotels([]);
    setFilteredHotels([]);
    setShowDayForm(false);
    setDayFormData({
      dayNumber: '',
      title: '',
      description: '',
      activities: '',
      meals: '',
      accommodation: ''
    });
  };

  const openDayForm = (day = null) => {
    if (day) {
      // Editing existing day - form will appear inline
      setEditingDay(day);
      setShowDayForm(false); // Hide top form
      setDayFormData({
        dayNumber: day.dayNumber,
        title: day.title,
        description: day.description || '',
        activities: day.activities || '',
        meals: day.meals || '',
        accommodation: day.accommodation || ''
      });
      // Extract city from hotel name if hotel is in format "City - Hotel"
      const hotelMatch = hotels.find(h => h.name === day.accommodation);
      if (hotelMatch) {
        setSelectedCity(hotelMatch.cityId?.toString() || '');
      }
    } else {
      // Adding new day - form appears at top
      setShowDayForm(true);
      setEditingDay(null);
      const nextDayNumber = itinerary.length > 0 ? Math.max(...itinerary.map(d => d.dayNumber)) + 1 : 1;
      setDayFormData({
        dayNumber: nextDayNumber,
        title: '',
        description: '',
        activities: '',
        meals: '',
        accommodation: ''
      });
      setSelectedCity('');
    }
  };

  const closeDayForm = () => {
    setShowDayForm(false);
    setEditingDay(null);
    setSelectedCity('');
    setDayFormData({
      dayNumber: '',
      title: '',
      description: '',
      activities: '',
      meals: '',
      accommodation: ''
    });
  };

  // Filter hotels when city changes
  useEffect(() => {
    if (selectedCity) {
      const filtered = hotels.filter(h => h.cityId === parseInt(selectedCity));
      setFilteredHotels(filtered);
    } else {
      setFilteredHotels([]);
    }
  }, [selectedCity, hotels]);

  // Toggle meal selection
  const toggleMeal = (meal) => {
    const currentMeals = dayFormData.meals ? dayFormData.meals.split(', ') : [];
    const mealIndex = currentMeals.indexOf(meal);

    if (mealIndex > -1) {
      currentMeals.splice(mealIndex, 1);
    } else {
      currentMeals.push(meal);
    }

    setDayFormData({ ...dayFormData, meals: currentMeals.join(', ') });
  };

  const isMealSelected = (meal) => {
    const currentMeals = dayFormData.meals ? dayFormData.meals.split(', ') : [];
    return currentMeals.includes(meal);
  };

  const handleSaveDay = async () => {
    if (!dayFormData.dayNumber || !dayFormData.title.trim()) {
      toast.error('Fill in day number and title');
      return;
    }

    try {
      if (editingDay) {
        await tourTypesApi.updateItineraryItem(selectedTourType.id, editingDay.id, dayFormData);
        toast.success('Program day updated');
      } else {
        await tourTypesApi.createItineraryItem(selectedTourType.id, dayFormData);
        toast.success('Program day added');
      }

      // Reload itinerary
      const response = await tourTypesApi.getItinerary(selectedTourType.id);
      setItinerary(response.data.itinerary || []);

      // Close form after successful save
      closeDayForm();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error saving');
    }
  };

  const handleDeleteDay = async (day) => {
    if (!confirm(`Delete ${day.title}?`)) return;

    try {
      await tourTypesApi.deleteItineraryItem(selectedTourType.id, day.id);
      toast.success('Program day deleted');

      // Reload itinerary
      const response = await tourTypesApi.getItinerary(selectedTourType.id);
      setItinerary(response.data.itinerary || []);
    } catch (error) {
      toast.error('Error deleting');
    }
  };

  const colorOptions = [
    '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6',
    '#EF4444', '#EC4899', '#06B6D4', '#84CC16'
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-orange-200"></div>
            <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-orange-600 absolute top-0"></div>
          </div>
          <p className="text-gray-700 font-bold text-lg">Loading Tour Types...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 px-2 py-3 md:p-6 space-y-3 md:space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden bg-white rounded-3xl shadow-2xl border-2 border-orange-100 p-4 md:p-8">
        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-yellow-500/10"></div>
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-orange-400/20 to-amber-400/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-gradient-to-br from-yellow-400/20 to-orange-400/20 rounded-full blur-3xl"></div>

        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 md:gap-6">
            <div className="w-12 h-12 md:w-20 md:h-20 bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-600 rounded-2xl md:rounded-3xl shadow-lg flex items-center justify-center transform hover:scale-110 transition-all duration-300 shrink-0">
              <MapPin className="w-6 h-6 md:w-10 md:h-10 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-4xl font-black bg-gradient-to-r from-orange-600 via-amber-600 to-yellow-600 bg-clip-text text-transparent mb-1 md:mb-2">
                Tour Types
              </h1>
              <p className="text-gray-600 font-semibold text-xs md:text-base">Manage Tour Categories & Itineraries</p>
            </div>
          </div>

          <button
            onClick={() => openModal()}
            className="inline-flex items-center gap-1.5 md:gap-3 px-4 md:px-8 py-2.5 md:py-4 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 hover:from-orange-600 hover:via-amber-600 hover:to-yellow-600 text-white rounded-xl md:rounded-2xl shadow-2xl hover:shadow-orange-500/40 hover:-translate-y-1 transition-all duration-300 font-bold text-sm md:text-base shrink-0"
          >
            <Plus className="w-5 h-5 md:w-6 md:h-6" />
            <span className="hidden sm:inline">Add Tour Type</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      {/* Tour types grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        {tourTypes.map((type) => (
          <div
            key={type.id}
            className={`relative group bg-white rounded-3xl shadow-xl border-2 border-gray-100 overflow-hidden hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 ${
              !type.isActive ? 'opacity-60' : ''
            }`}
          >
            <div
              className="h-3"
              style={{
                background: `linear-gradient(90deg, ${type.color}, ${type.color}dd)`,
                boxShadow: `0 4px 15px -3px ${type.color}40`
              }}
            />
            <div className="p-4 md:p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3 md:gap-4">
                  <div
                    className="w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center text-white font-black text-sm md:text-base shadow-lg group-hover:scale-110 transition-all duration-300"
                    style={{
                      background: `linear-gradient(135deg, ${type.color}, ${type.color}dd)`,
                      boxShadow: `0 8px 20px -5px ${type.color}60`
                    }}
                  >
                    {type.code}
                  </div>
                  <div>
                    <h3 className="font-black text-gray-900 text-lg">{type.name}</h3>
                    <p className="text-sm text-gray-500 font-semibold mt-1">
                      {type._count?.bookings || 0} bookings
                    </p>
                  </div>
                </div>
              </div>

              {type.description && (
                <p className="text-sm text-gray-600 mb-4 line-clamp-2 font-medium">
                  {type.description}
                </p>
              )}

              <div className="pt-4 border-t-2 border-gray-100 space-y-3">
                <button
                  onClick={() => openItineraryModal(type)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-100 hover:from-orange-50 hover:to-amber-50 rounded-xl transition-all duration-300 text-sm text-gray-700 hover:text-orange-600 font-bold shadow-md hover:shadow-lg"
                >
                  <FileText className="w-5 h-5" />
                  Tour Program
                </button>

                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold shadow-md ${
                      type.isActive
                        ? 'bg-gradient-to-r from-green-200 to-emerald-300 text-green-900 border-2 border-green-400'
                        : 'bg-gradient-to-r from-gray-200 to-gray-300 text-gray-600 border-2 border-gray-400'
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${type.isActive ? 'bg-green-600 animate-pulse' : 'bg-gray-500'}`}></div>
                    {type.isActive ? 'Active' : 'Inactive'}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openModal(type)}
                      className="p-2.5 text-orange-600 hover:text-white bg-orange-50 hover:bg-gradient-to-r hover:from-orange-500 hover:to-amber-500 rounded-xl transition-all duration-300 shadow-md hover:shadow-xl transform hover:scale-110"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(type)}
                      className="p-2.5 text-red-600 hover:text-white bg-red-50 hover:bg-gradient-to-r hover:from-red-500 hover:to-red-600 rounded-xl transition-all duration-300 shadow-md hover:shadow-xl transform hover:scale-110"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {tourTypes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
          <div className="w-24 h-24 bg-gradient-to-br from-orange-100 to-amber-200 rounded-full flex items-center justify-center shadow-lg mb-4">
            <MapPin className="w-12 h-12 text-orange-500" />
          </div>
          <p className="text-xl font-bold text-gray-700 mb-2">No Tour Types Found</p>
          <p className="text-gray-500">Create your first tour type to get started</p>
        </div>
      )}

      {/* Itinerary Modal */}
      {itineraryModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
          <div className="min-h-screen flex items-start justify-center p-4 py-8">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl">
              <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white z-10 rounded-t-xl">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Tour Program: {selectedTourType?.name}
                </h2>
                <p className="text-sm text-gray-500">
                  {selectedTourType?.code} - Daily itinerary plan
                </p>
              </div>
              <button onClick={closeItineraryModal} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {loadingItinerary ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : (
                <>
                  {/* Add Day Button */}
                  {!showDayForm && (
                    <div className="flex justify-start mb-4">
                      <button
                        onClick={() => openDayForm()}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                      >
                        <Plus className="w-5 h-5" />
                        Add Day
                      </button>
                    </div>
                  )}

                  {/* Day form for adding new day */}
                  {showDayForm && (
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3 mb-4">
                      <h3 className="font-medium text-gray-900">Добавить день</h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Day Number *
                        </label>
                        <input
                          type="number"
                          value={dayFormData.dayNumber}
                          onChange={(e) => setDayFormData({ ...dayFormData, dayNumber: parseInt(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                          min="1"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Title *
                        </label>
                        <input
                          type="text"
                          value={dayFormData.title}
                          onChange={(e) => setDayFormData({ ...dayFormData, title: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                          placeholder="Day 1: Arrival in Tashkent"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <textarea
                        value={dayFormData.description}
                        onChange={(e) => setDayFormData({ ...dayFormData, description: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        rows={3}
                        placeholder="Day program description..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Meals
                      </label>
                      <div className="flex flex-wrap gap-3">
                        <label className="inline-flex items-center">
                          <input
                            type="checkbox"
                            checked={isMealSelected('Завтрак')}
                            onChange={() => toggleMeal('Завтрак')}
                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
                          />
                          <span className="ml-2 text-sm text-gray-700">Breakfast</span>
                        </label>
                        <label className="inline-flex items-center">
                          <input
                            type="checkbox"
                            checked={isMealSelected('Обед')}
                            onChange={() => toggleMeal('Обед')}
                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
                          />
                          <span className="ml-2 text-sm text-gray-700">Lunch</span>
                        </label>
                        <label className="inline-flex items-center">
                          <input
                            type="checkbox"
                            checked={isMealSelected('Ужин')}
                            onChange={() => toggleMeal('Ужин')}
                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
                          />
                          <span className="ml-2 text-sm text-gray-700">Dinner</span>
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          City
                        </label>
                        <select
                          value={selectedCity}
                          onChange={(e) => {
                            setSelectedCity(e.target.value);
                            setDayFormData({ ...dayFormData, accommodation: '' });
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        >
                          <option value="">Select city</option>
                          {cities.map((city) => (
                            <option key={city.id} value={city.id}>
                              {city.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Hotel
                        </label>
                        <select
                          value={dayFormData.accommodation}
                          onChange={(e) => setDayFormData({ ...dayFormData, accommodation: e.target.value })}
                          disabled={!selectedCity}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
                        >
                          <option value="">Select hotel</option>
                          {filteredHotels.map((hotel) => (
                            <option key={hotel.id} value={hotel.name}>
                              {hotel.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={closeDayForm}
                          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveDay}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                        >
                          <Save className="w-4 h-4" />
                          Add
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Itinerary list */}
                  <div className="space-y-3">
                    <h3 className="font-medium text-gray-900">
                      Program ({new Set(itinerary.map(d => d.dayNumber)).size} days)
                    </h3>

                    {itinerary.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Calendar className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>Tour program is empty</p>
                        <p className="text-sm">Add the first program day</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {itinerary.map((day) => (
                          <div key={day.id}>
                            {/* Day display */}
                            <div className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="inline-flex items-center justify-center w-8 h-8 bg-primary-100 text-primary-700 rounded-full text-sm font-semibold">
                                      {day.dayNumber}
                                    </span>
                                    <h4 className="font-medium text-gray-900">{day.title}</h4>
                                  </div>

                                  {day.description && (
                                    <p className="text-sm text-gray-600 mb-2">{day.description}</p>
                                  )}

                                  <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                                    {day.meals && (
                                      <span className="inline-flex items-center gap-1">
                                        <span className="font-medium">Meals:</span>
                                        {day.meals}
                                      </span>
                                    )}
                                    {day.accommodation && (
                                      <span className="inline-flex items-center gap-1">
                                        <span className="font-medium">Hotel:</span>
                                        {day.accommodation}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 ml-2">
                                  <button
                                    onClick={() => openDayForm(day)}
                                    className="p-1.5 text-gray-400 hover:text-primary-600 rounded"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteDay(day)}
                                    className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Inline edit form */}
                            {editingDay?.id === day.id && (
                              <div className="bg-blue-50 border-2 border-primary-500 rounded-lg p-4 space-y-3 mt-2">
                                <h3 className="font-medium text-gray-900">Edit Day</h3>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                      Day Number *
                                    </label>
                                    <input
                                      type="number"
                                      value={dayFormData.dayNumber}
                                      onChange={(e) => setDayFormData({ ...dayFormData, dayNumber: parseInt(e.target.value) })}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                      min="1"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                      Title *
                                    </label>
                                    <input
                                      type="text"
                                      value={dayFormData.title}
                                      onChange={(e) => setDayFormData({ ...dayFormData, title: e.target.value })}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                      placeholder="Day 1: Arrival in Tashkent"
                                    />
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Description
                                  </label>
                                  <textarea
                                    value={dayFormData.description}
                                    onChange={(e) => setDayFormData({ ...dayFormData, description: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                    rows={3}
                                    placeholder="Day program description..."
                                  />
                                </div>

                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Meals
                                  </label>
                                  <div className="flex flex-wrap gap-3">
                                    <label className="inline-flex items-center">
                                      <input
                                        type="checkbox"
                                        checked={isMealSelected('Завтрак')}
                                        onChange={() => toggleMeal('Завтрак')}
                                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
                                      />
                                      <span className="ml-2 text-sm text-gray-700">Breakfast</span>
                                    </label>
                                    <label className="inline-flex items-center">
                                      <input
                                        type="checkbox"
                                        checked={isMealSelected('Обед')}
                                        onChange={() => toggleMeal('Обед')}
                                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
                                      />
                                      <span className="ml-2 text-sm text-gray-700">Lunch</span>
                                    </label>
                                    <label className="inline-flex items-center">
                                      <input
                                        type="checkbox"
                                        checked={isMealSelected('Ужин')}
                                        onChange={() => toggleMeal('Ужин')}
                                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
                                      />
                                      <span className="ml-2 text-sm text-gray-700">Dinner</span>
                                    </label>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                      City
                                    </label>
                                    <select
                                      value={selectedCity}
                                      onChange={(e) => {
                                        setSelectedCity(e.target.value);
                                        setDayFormData({ ...dayFormData, accommodation: '' });
                                      }}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                    >
                                      <option value="">Select city</option>
                                      {cities.map((city) => (
                                        <option key={city.id} value={city.id}>
                                          {city.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                      Hotel
                                    </label>
                                    <select
                                      value={dayFormData.accommodation}
                                      onChange={(e) => setDayFormData({ ...dayFormData, accommodation: e.target.value })}
                                      disabled={!selectedCity}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
                                    >
                                      <option value="">Select hotel</option>
                                      {filteredHotels.map((hotel) => (
                                        <option key={hotel.id} value={hotel.name}>
                                          {hotel.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={closeDayForm}
                                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={handleSaveDay}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                                  >
                                    <Save className="w-4 h-4" />
                                    Save
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

              <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 sticky bottom-0 bg-white rounded-b-xl">
                <button
                  onClick={closeItineraryModal}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Type Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border-2 border-orange-100 overflow-hidden">
            <div className="flex items-center justify-between p-6 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 border-b-2 border-orange-300">
              <h2 className="text-2xl font-black text-white">
                {editingType ? 'Edit Tour Type' : 'New Tour Type'}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-white/20 rounded-xl transition-all duration-300"
              >
                <X className="w-6 h-6 text-white" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Code *
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 font-medium shadow-sm hover:shadow-md"
                  placeholder="ER"
                  maxLength={10}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 font-medium shadow-sm hover:shadow-md"
                  placeholder="Tour in Uzbekistan"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 font-medium shadow-sm hover:shadow-md"
                  rows={3}
                  placeholder="Tour type description..."
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">
                  Color
                </label>
                <div className="flex items-center gap-3 flex-wrap">
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-10 h-10 rounded-xl transition-all duration-300 shadow-md hover:shadow-xl ${
                        formData.color === color ? 'ring-4 ring-offset-2 ring-orange-400 scale-125' : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-10 h-10 rounded-xl cursor-pointer shadow-md hover:shadow-xl transition-all duration-300"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-4 p-6 bg-gradient-to-r from-orange-50 via-amber-50 to-yellow-50 border-t-2 border-gray-200">
              <button
                onClick={closeModal}
                className="px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-white hover:shadow-lg transition-all duration-300 font-bold text-gray-700"
              >
                Отмена
              </button>
              <button
                onClick={handleSave}
                className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 hover:from-orange-600 hover:via-amber-600 hover:to-yellow-600 text-white rounded-xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 font-bold"
              >
                <Save className="w-5 h-5" />
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
