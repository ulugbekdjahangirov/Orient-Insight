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
      toast.error('Ошибка загрузки типов туров');
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
      toast.error('Заполните обязательные поля');
      return;
    }

    try {
      if (editingType) {
        await tourTypesApi.update(editingType.id, formData);
        toast.success('Тип тура обновлён');
      } else {
        await tourTypesApi.create(formData);
        toast.success('Тип тура добавлен');
      }
      closeModal();
      loadTourTypes();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Ошибка сохранения');
    }
  };

  const handleDelete = async (type) => {
    if (!confirm(`Удалить тип тура ${type.code}?`)) return;

    try {
      await tourTypesApi.delete(type.id);
      toast.success('Тип тура удалён');
      loadTourTypes();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Ошибка удаления');
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
      toast.error('Ошибка загрузки программы тура');
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
      toast.error('Заполните номер дня и заголовок');
      return;
    }

    try {
      if (editingDay) {
        await tourTypesApi.updateItineraryItem(selectedTourType.id, editingDay.id, dayFormData);
        toast.success('День программы обновлён');
      } else {
        await tourTypesApi.createItineraryItem(selectedTourType.id, dayFormData);
        toast.success('День программы добавлен');
      }

      // Reload itinerary
      const response = await tourTypesApi.getItinerary(selectedTourType.id);
      setItinerary(response.data.itinerary || []);

      // Close form after successful save
      closeDayForm();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Ошибка сохранения');
    }
  };

  const handleDeleteDay = async (day) => {
    if (!confirm(`Удалить ${day.title}?`)) return;

    try {
      await tourTypesApi.deleteItineraryItem(selectedTourType.id, day.id);
      toast.success('День программы удалён');

      // Reload itinerary
      const response = await tourTypesApi.getItinerary(selectedTourType.id);
      setItinerary(response.data.itinerary || []);
    } catch (error) {
      toast.error('Ошибка удаления');
    }
  };

  const colorOptions = [
    '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6',
    '#EF4444', '#EC4899', '#06B6D4', '#84CC16'
  ];

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
          <h1 className="text-2xl font-bold text-gray-900">Типы туров</h1>
          <p className="text-gray-500">Управление категориями туров</p>
        </div>

        <button
          onClick={() => openModal()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Добавить тип
        </button>
      </div>

      {/* Tour types grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {tourTypes.map((type) => (
          <div
            key={type.id}
            className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden ${
              !type.isActive ? 'opacity-60' : ''
            }`}
          >
            <div
              className="h-2"
              style={{ backgroundColor: type.color }}
            />
            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: type.color }}
                  >
                    {type.code}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{type.name}</h3>
                    <p className="text-xs text-gray-500">
                      {type._count?.bookings || 0} бронирований
                    </p>
                  </div>
                </div>
              </div>

              {type.description && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                  {type.description}
                </p>
              )}

              <div className="pt-3 border-t border-gray-200 space-y-2">
                <button
                  onClick={() => openItineraryModal(type)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-sm text-gray-700"
                >
                  <FileText className="w-4 h-4" />
                  Программа тура
                </button>

                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-medium ${
                      type.isActive ? 'text-green-600' : 'text-gray-400'
                    }`}
                  >
                    {type.isActive ? 'Активен' : 'Неактивен'}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openModal(type)}
                      className="p-1.5 text-gray-400 hover:text-primary-600 rounded"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(type)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {tourTypes.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          Типы туров не найдены
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
                  Программа тура: {selectedTourType?.name}
                </h2>
                <p className="text-sm text-gray-500">
                  {selectedTourType?.code} - План мероприятий по дням
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
                        Добавить день
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
                          Номер дня *
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
                          Заголовок *
                        </label>
                        <input
                          type="text"
                          value={dayFormData.title}
                          onChange={(e) => setDayFormData({ ...dayFormData, title: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                          placeholder="День 1: Прибытие в Ташкент"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Описание
                      </label>
                      <textarea
                        value={dayFormData.description}
                        onChange={(e) => setDayFormData({ ...dayFormData, description: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        rows={3}
                        placeholder="Описание программы дня..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Питание
                      </label>
                      <div className="flex flex-wrap gap-3">
                        <label className="inline-flex items-center">
                          <input
                            type="checkbox"
                            checked={isMealSelected('Завтрак')}
                            onChange={() => toggleMeal('Завтрак')}
                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
                          />
                          <span className="ml-2 text-sm text-gray-700">Завтрак</span>
                        </label>
                        <label className="inline-flex items-center">
                          <input
                            type="checkbox"
                            checked={isMealSelected('Обед')}
                            onChange={() => toggleMeal('Обед')}
                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
                          />
                          <span className="ml-2 text-sm text-gray-700">Обед</span>
                        </label>
                        <label className="inline-flex items-center">
                          <input
                            type="checkbox"
                            checked={isMealSelected('Ужин')}
                            onChange={() => toggleMeal('Ужин')}
                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
                          />
                          <span className="ml-2 text-sm text-gray-700">Ужин</span>
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Город
                        </label>
                        <select
                          value={selectedCity}
                          onChange={(e) => {
                            setSelectedCity(e.target.value);
                            setDayFormData({ ...dayFormData, accommodation: '' });
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        >
                          <option value="">Выберите город</option>
                          {cities.map((city) => (
                            <option key={city.id} value={city.id}>
                              {city.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Отель
                        </label>
                        <select
                          value={dayFormData.accommodation}
                          onChange={(e) => setDayFormData({ ...dayFormData, accommodation: e.target.value })}
                          disabled={!selectedCity}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
                        >
                          <option value="">Выберите отель</option>
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
                          Отмена
                        </button>
                        <button
                          onClick={handleSaveDay}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                        >
                          <Save className="w-4 h-4" />
                          Добавить
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Itinerary list */}
                  <div className="space-y-3">
                    <h3 className="font-medium text-gray-900">
                      Программа ({new Set(itinerary.map(d => d.dayNumber)).size} дней)
                    </h3>

                    {itinerary.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Calendar className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>Программа тура пуста</p>
                        <p className="text-sm">Добавьте первый день программы</p>
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
                                        <span className="font-medium">Питание:</span>
                                        {day.meals}
                                      </span>
                                    )}
                                    {day.accommodation && (
                                      <span className="inline-flex items-center gap-1">
                                        <span className="font-medium">Отель:</span>
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
                                <h3 className="font-medium text-gray-900">Редактировать день</h3>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                      Номер дня *
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
                                      Заголовок *
                                    </label>
                                    <input
                                      type="text"
                                      value={dayFormData.title}
                                      onChange={(e) => setDayFormData({ ...dayFormData, title: e.target.value })}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                      placeholder="День 1: Прибытие в Ташкент"
                                    />
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Описание
                                  </label>
                                  <textarea
                                    value={dayFormData.description}
                                    onChange={(e) => setDayFormData({ ...dayFormData, description: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                    rows={3}
                                    placeholder="Описание программы дня..."
                                  />
                                </div>

                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Питание
                                  </label>
                                  <div className="flex flex-wrap gap-3">
                                    <label className="inline-flex items-center">
                                      <input
                                        type="checkbox"
                                        checked={isMealSelected('Завтрак')}
                                        onChange={() => toggleMeal('Завтрак')}
                                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
                                      />
                                      <span className="ml-2 text-sm text-gray-700">Завтрак</span>
                                    </label>
                                    <label className="inline-flex items-center">
                                      <input
                                        type="checkbox"
                                        checked={isMealSelected('Обед')}
                                        onChange={() => toggleMeal('Обед')}
                                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
                                      />
                                      <span className="ml-2 text-sm text-gray-700">Обед</span>
                                    </label>
                                    <label className="inline-flex items-center">
                                      <input
                                        type="checkbox"
                                        checked={isMealSelected('Ужин')}
                                        onChange={() => toggleMeal('Ужин')}
                                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
                                      />
                                      <span className="ml-2 text-sm text-gray-700">Ужин</span>
                                    </label>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                      Город
                                    </label>
                                    <select
                                      value={selectedCity}
                                      onChange={(e) => {
                                        setSelectedCity(e.target.value);
                                        setDayFormData({ ...dayFormData, accommodation: '' });
                                      }}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                    >
                                      <option value="">Выберите город</option>
                                      {cities.map((city) => (
                                        <option key={city.id} value={city.id}>
                                          {city.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                      Отель
                                    </label>
                                    <select
                                      value={dayFormData.accommodation}
                                      onChange={(e) => setDayFormData({ ...dayFormData, accommodation: e.target.value })}
                                      disabled={!selectedCity}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
                                    >
                                      <option value="">Выберите отель</option>
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
                                    Отмена
                                  </button>
                                  <button
                                    onClick={handleSaveDay}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                                  >
                                    <Save className="w-4 h-4" />
                                    Сохранить
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
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Type Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingType ? 'Редактировать тип тура' : 'Новый тип тура'}
              </h2>
              <button onClick={closeModal} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Код *
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="ER"
                  maxLength={10}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Название *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="Тур по Узбекистану"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Описание
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  rows={3}
                  placeholder="Описание типа тура..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Цвет
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-8 h-8 rounded-lg transition-transform ${
                        formData.color === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-8 h-8 rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200">
              <button
                onClick={closeModal}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                onClick={handleSave}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                <Save className="w-4 h-4" />
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
