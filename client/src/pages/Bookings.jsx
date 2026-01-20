import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { bookingsApi, tourTypesApi, guidesApi } from '../services/api';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import toast from 'react-hot-toast';
import {
  Search,
  Filter,
  Plus,
  Eye,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  Users
} from 'lucide-react';

const statusLabels = {
  PENDING: 'Ожидает',
  CONFIRMED: 'Подтверждено',
  IN_PROGRESS: 'В процессе',
  COMPLETED: 'Завершено',
  CANCELLED: 'Отменено'
};

const statusClasses = {
  PENDING: 'bg-gradient-to-r from-yellow-200 to-yellow-300 text-yellow-900 border border-yellow-400 shadow-sm',
  CONFIRMED: 'bg-gradient-to-r from-green-200 to-green-300 text-green-900 border border-green-400 shadow-sm',
  IN_PROGRESS: 'bg-gradient-to-r from-purple-200 to-purple-300 text-purple-900 border border-purple-400 shadow-sm',
  COMPLETED: 'bg-gradient-to-r from-blue-200 to-blue-300 text-blue-900 border border-blue-400 shadow-sm',
  CANCELLED: 'bg-gradient-to-r from-red-200 to-red-300 text-red-900 border border-red-400 shadow-sm'
};

// Calculate status based on PAX count, departure date, and end date
const getStatusByPax = (pax, departureDate, endDate) => {
  const paxCount = parseInt(pax) || 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check if tour has ended
  if (endDate) {
    const tourEndDate = new Date(endDate);
    tourEndDate.setHours(0, 0, 0, 0);
    if (tourEndDate < today) {
      return 'COMPLETED';
    }
  }

  if (departureDate) {
    const daysUntilDeparture = Math.ceil((new Date(departureDate) - today) / (1000 * 60 * 60 * 24));

    if (daysUntilDeparture < 30 && paxCount < 4) {
      return 'CANCELLED';
    }
  }

  if (paxCount >= 6) {
    return 'CONFIRMED';
  } else if (paxCount === 4 || paxCount === 5) {
    return 'IN_PROGRESS';
  } else {
    return 'PENDING';
  }
};

export default function Bookings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [bookings, setBookings] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [tourTypes, setTourTypes] = useState([]);
  const [guides, setGuides] = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    tourTypeId: searchParams.get('tourTypeId') || '',
    guideId: searchParams.get('guideId') || '',
    status: searchParams.get('status') || '',
    startDate: searchParams.get('startDate') || '',
    endDate: searchParams.get('endDate') || ''
  });

  useEffect(() => {
    loadFiltersData();
  }, []);

  useEffect(() => {
    loadBookings();
  }, [searchParams]);

  const loadFiltersData = async () => {
    try {
      const [tourTypesRes, guidesRes] = await Promise.all([
        tourTypesApi.getAll(),
        guidesApi.getAll()
      ]);
      setTourTypes(tourTypesRes.data.tourTypes);
      setGuides(guidesRes.data.guides);
    } catch (error) {
      console.error('Error loading filters data:', error);
    }
  };

  const loadBookings = async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(searchParams);

      // Remove status from backend params (we'll filter on frontend)
      const { status, ...backendParams } = params;

      const response = await bookingsApi.getAll(backendParams);
      let bookingsData = response.data.bookings;

      // Filter by calculated status on frontend
      if (status) {
        bookingsData = bookingsData.filter(booking => {
          const calculatedStatus = getStatusByPax(booking.pax, booking.departureDate, booking.endDate);
          return calculatedStatus === status;
        });
      }

      setBookings(bookingsData);

      // Update pagination total to reflect filtered count
      setPagination({
        ...response.data.pagination,
        total: bookingsData.length
      });
    } catch (error) {
      toast.error('Ошибка загрузки бронирований');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    params.set('page', '1');
    setSearchParams(params);
    setShowFilters(false);
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      tourTypeId: '',
      guideId: '',
      status: '',
      startDate: '',
      endDate: ''
    });
    setSearchParams(new URLSearchParams());
  };

  const changePage = (newPage) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', newPage.toString());
    setSearchParams(params);
  };

  const handleDelete = async (id, bookingNumber) => {
    if (!confirm(`Удалить бронирование ${bookingNumber}?`)) return;

    try {
      await bookingsApi.delete(id);
      toast.success('Бронирование удалено');
      loadBookings();
    } catch (error) {
      toast.error('Ошибка удаления');
    }
  };

  const hasActiveFilters = Object.values(filters).some(v => v);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-white via-gray-50 to-white rounded-2xl shadow-md border border-gray-200 p-6">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">Бронирования</h1>
          <p className="text-gray-600 font-medium mt-1">
            Всего: <span className="text-primary-600 font-bold">{pagination.total}</span> записей
          </p>
        </div>

        <Link
          to="/bookings/new"
          className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:shadow-lg hover:scale-105 transition-all duration-200 font-semibold"
        >
          <Plus className="w-5 h-5" />
          Добавить
        </Link>
      </div>

      {/* Search and filters */}
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-md border-2 border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Поиск по номеру бронирования..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
              className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-sm font-medium"
            />
          </div>

          {/* Filter button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 px-5 py-3 border-2 rounded-xl transition-all duration-200 font-semibold ${
              hasActiveFilters
                ? 'border-primary-500 bg-gradient-to-r from-primary-50 to-primary-100 text-primary-700 shadow-md'
                : 'border-gray-300 hover:bg-gray-50 hover:shadow-md'
            }`}
          >
            <Filter className="w-5 h-5" />
            Фильтры
            {hasActiveFilters && (
              <span className="w-5 h-5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-full text-xs flex items-center justify-center shadow-sm font-bold">
                !
              </span>
            )}
          </button>

          {/* Apply button */}
          <button
            onClick={applyFilters}
            className="px-5 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:shadow-lg hover:scale-105 transition-all duration-200 font-semibold"
          >
            Применить
          </button>
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Tour type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Тип тура
              </label>
              <select
                value={filters.tourTypeId}
                onChange={(e) => setFilters({ ...filters, tourTypeId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Все типы</option>
                {tourTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.code} - {type.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Guide */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Гид
              </label>
              <select
                value={filters.guideId}
                onChange={(e) => setFilters({ ...filters, guideId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Все гиды</option>
                <option value="unassigned">-</option>
                {guides.map((guide) => (
                  <option key={guide.id} value={guide.id}>
                    {guide.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Статус
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Все статусы</option>
                {Object.entries(statusLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Период
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                />
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>
            </div>

            {/* Clear filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
                Сбросить фильтры
              </button>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <CalendarDays className="w-12 h-12 mb-4 text-gray-300" />
            <p>Бронирования не найдены</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border-2 border-gray-300 shadow-lg">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-primary-400 via-primary-300 to-primary-400 border-b-4 border-primary-500 shadow-lg sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-5 text-left text-sm font-black text-primary-900 uppercase tracking-wider">
                    Номер
                  </th>
                  <th className="px-6 py-5 text-left text-sm font-black text-primary-900 uppercase tracking-wider">
                    Тип тура
                  </th>
                  <th className="px-6 py-5 text-left text-sm font-black text-primary-900 uppercase tracking-wider">
                    Дата заезда
                  </th>
                  <th className="px-6 py-5 text-left text-sm font-black text-primary-900 uppercase tracking-wider">
                    Дата выезда
                  </th>
                  <th className="px-6 py-5 text-left text-sm font-black text-primary-900 uppercase tracking-wider">
                    Pax
                  </th>
                  <th className="px-6 py-5 text-left text-sm font-black text-primary-900 uppercase tracking-wider">
                    Узбекистан
                  </th>
                  <th className="px-6 py-5 text-left text-sm font-black text-primary-900 uppercase tracking-wider">
                    Туркменистан
                  </th>
                  <th className="px-6 py-5 text-left text-sm font-black text-primary-900 uppercase tracking-wider">
                    Гид
                  </th>
                  <th className="px-6 py-5 text-left text-sm font-black text-primary-900 uppercase tracking-wider">
                    ЖД билеты
                  </th>
                  <th className="px-6 py-5 text-left text-sm font-black text-primary-900 uppercase tracking-wider">
                    DBL
                  </th>
                  <th className="px-6 py-5 text-left text-sm font-black text-primary-900 uppercase tracking-wider">
                    TWN
                  </th>
                  <th className="px-6 py-5 text-left text-sm font-black text-primary-900 uppercase tracking-wider">
                    SNGL
                  </th>
                  <th className="px-6 py-5 text-left text-sm font-black text-primary-900 uppercase tracking-wider">
                    Статус
                  </th>
                  <th className="px-6 py-5 text-right text-sm font-black text-primary-900 uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {bookings.map((booking, index) => {
                  const calculatedStatus = getStatusByPax(booking.pax, booking.departureDate, booking.endDate);

                  // Set row background color based on status
                  let rowClass = 'hover:bg-gray-50';
                  if (calculatedStatus === 'CANCELLED') {
                    rowClass = 'bg-red-100 hover:bg-red-200';
                  } else if (calculatedStatus === 'PENDING') {
                    rowClass = 'bg-yellow-100 hover:bg-yellow-200';
                  } else if (calculatedStatus === 'IN_PROGRESS') {
                    rowClass = 'bg-purple-100 hover:bg-purple-200';
                  } else if (calculatedStatus === 'CONFIRMED') {
                    rowClass = 'bg-green-100 hover:bg-green-200';
                  } else if (calculatedStatus === 'COMPLETED') {
                    rowClass = 'bg-blue-100 hover:bg-blue-200';
                  }

                  return (
                  <tr key={booking.id} className={`${rowClass} transition-all duration-200`}>
                    {/* НОМЕР */}
                    <td className="px-4 py-4">
                      <span className="font-bold text-gray-900 text-base">
                        {index + 1}
                      </span>
                    </td>
                    {/* ТИП ТУРА */}
                    <td className="px-4 py-4">
                      <Link
                        to={`/bookings/${booking.id}?edit=true`}
                      >
                        <span
                          className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-bold text-white whitespace-nowrap hover:shadow-lg hover:scale-105 transition-all duration-200 shadow-sm"
                          style={{ backgroundColor: booking.tourType?.color || '#6B7280' }}
                        >
                          {booking.bookingNumber}
                        </span>
                      </Link>
                    </td>
                    {/* ДАТА ЗАЕЗДА */}
                    <td className="px-4 py-4 text-sm text-gray-700 font-medium">
                      {format(new Date(booking.departureDate), 'dd.MM.yyyy')}
                    </td>
                    {/* ДАТА ВЫЕЗДА */}
                    <td className="px-4 py-4 text-sm text-gray-700 font-medium">
                      {format(new Date(booking.endDate), 'dd.MM.yyyy')}
                    </td>
                    {/* PAX */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="w-4 h-4 text-primary-500" />
                        <span className="font-bold text-gray-900">{booking.pax}</span>
                      </div>
                    </td>
                    {/* УЗБЕКИСТАН */}
                    <td className="px-4 py-4 text-sm text-gray-700 font-semibold text-center">
                      {booking.paxUzbekistan || 0}
                    </td>
                    {/* ТУРКМЕНИСТАН */}
                    <td className="px-4 py-4 text-sm text-gray-700 font-semibold text-center">
                      {booking.paxTurkmenistan || 0}
                    </td>
                    {/* ГИД */}
                    <td className="px-4 py-4 text-sm text-gray-700 font-medium">
                      {booking.guide?.name || '-'}
                    </td>
                    {/* ЖД БИЛЕТЫ */}
                    <td className="px-4 py-4 text-sm text-gray-700 font-semibold text-center">
                      {booking.trainTickets || '-'}
                    </td>
                    {/* DBL */}
                    <td className="px-4 py-4 text-sm text-gray-700 font-semibold text-center">
                      {booking.roomsDbl ? (Number(booking.roomsDbl) % 1 === 0 ? booking.roomsDbl : Number(booking.roomsDbl).toFixed(1)) : 0}
                    </td>
                    {/* TWN */}
                    <td className="px-4 py-4 text-sm text-gray-700 font-semibold text-center">
                      {booking.roomsTwn ? (Number(booking.roomsTwn) % 1 === 0 ? booking.roomsTwn : Number(booking.roomsTwn).toFixed(1)) : 0}
                    </td>
                    {/* SNGL */}
                    <td className="px-4 py-4 text-sm text-gray-700 font-semibold text-center">
                      {booking.roomsSngl ? (Number(booking.roomsSngl) % 1 === 0 ? booking.roomsSngl : Number(booking.roomsSngl).toFixed(1)) : 0}
                    </td>
                    {/* СТАТУС */}
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold ${statusClasses[calculatedStatus]}`}>
                        {statusLabels[calculatedStatus]}
                      </span>
                    </td>
                    {/* ДЕЙСТВИЯ */}
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/bookings/${booking.id}`}
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg hover:scale-110 transition-all duration-200"
                          title="Просмотр"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <Link
                          to={`/bookings/${booking.id}?edit=true`}
                          className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg hover:scale-110 transition-all duration-200"
                          title="Редактировать"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleDelete(booking.id, booking.bookingNumber)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg hover:scale-110 transition-all duration-200"
                          title="Удалить"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="px-6 py-4 border-t-2 border-gray-200 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">
              Страница <span className="text-primary-600">{pagination.page}</span> из <span className="text-primary-600">{pagination.pages}</span>
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => changePage(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="p-2 rounded-xl bg-white border-2 border-gray-300 hover:bg-primary-50 hover:border-primary-500 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => changePage(pagination.page + 1)}
                disabled={pagination.page === pagination.pages}
                className="p-2 rounded-xl bg-white border-2 border-gray-300 hover:bg-primary-50 hover:border-primary-500 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CalendarDays(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
      <line x1="16" x2="16" y1="2" y2="6"/>
      <line x1="8" x2="8" y1="2" y2="6"/>
      <line x1="3" x2="21" y1="10" y2="10"/>
      <path d="M8 14h.01"/>
      <path d="M12 14h.01"/>
      <path d="M16 14h.01"/>
      <path d="M8 18h.01"/>
      <path d="M12 18h.01"/>
      <path d="M16 18h.01"/>
    </svg>
  );
}
