import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { bookingsApi, tourTypesApi, guidesApi } from '../services/api';
import { format, addDays } from 'date-fns';
import { enUS } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { useIsMobile } from '../hooks/useMediaQuery';
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
  Users,
  Calendar,
  MapPin
} from 'lucide-react';

const statusLabels = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled'
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
  const isMobile = useIsMobile();
  console.log('🔍 Bookings - isMobile:', isMobile, 'window.innerWidth:', window.innerWidth);
  const [searchParams, setSearchParams] = useSearchParams();
  const [bookings, setBookings] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 200 });
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

      // Ensure limit is set to 200 to show all bookings on one page
      backendParams.limit = 200;

      const response = await bookingsApi.getAll(backendParams);
      let bookingsData = response.data.bookings;

      // Filter by calculated status on frontend
      if (status) {
        bookingsData = bookingsData.filter(booking => {
          const calculatedStatus = booking.status === 'CANCELLED' ? 'CANCELLED' : getStatusByPax(booking.pax, booking.departureDate, booking.endDate);
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
      toast.error('Error loading bookings');
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
    if (!confirm(`Delete booking ${bookingNumber}?`)) return;

    try {
      await bookingsApi.delete(id);
      toast.success('Booking deleted');
      loadBookings();
    } catch (error) {
      toast.error('Error deleting');
    }
  };

  const hasActiveFilters = Object.values(filters).some(v => v);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-6 space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden bg-white rounded-3xl shadow-2xl border-2 border-primary-100 p-8">
        <div className="absolute inset-0 bg-gradient-to-r from-primary-500/10 via-purple-500/5 to-pink-500/10"></div>
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-primary-400/20 to-purple-400/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-gradient-to-br from-pink-400/20 to-purple-400/20 rounded-full blur-3xl"></div>

        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 md:gap-6">
          <div className="flex items-center gap-3 md:gap-6">
            <div className="w-14 h-14 md:w-20 md:h-20 bg-gradient-to-br from-primary-500 via-purple-500 to-pink-600 rounded-2xl md:rounded-3xl shadow-lg flex items-center justify-center transform hover:scale-110 transition-all duration-300">
              <CalendarDays className="w-7 h-7 md:w-10 md:h-10 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-4xl font-black bg-gradient-to-r from-primary-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Bookings Management
              </h1>
              <p className="text-sm md:text-base text-gray-600 font-semibold mt-1 md:mt-2 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2 md:px-3 py-1 bg-gradient-to-r from-primary-100 to-purple-100 rounded-full text-xs md:text-sm">
                  <span className="text-gray-700">Total:</span>
                  <span className="text-primary-700 font-bold">{pagination.total}</span>
                  <span className="text-gray-700">records</span>
                </span>
              </p>
            </div>
          </div>

          <Link
            to="/bookings/new"
            className="inline-flex items-center justify-center gap-2 md:gap-3 px-4 md:px-8 py-3 md:py-4 bg-gradient-to-r from-primary-500 via-purple-500 to-pink-500 hover:from-primary-600 hover:via-purple-600 hover:to-pink-600 text-white rounded-xl md:rounded-2xl shadow-2xl hover:shadow-primary-500/40 hover:-translate-y-1 transition-all duration-300 font-bold text-sm md:text-base"
          >
            <Plus className="w-5 h-5 md:w-6 md:h-6" />
            <span>Add New Booking</span>
          </Link>
        </div>
      </div>

      {/* Search and filters */}
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl shadow-2xl border-2 border-gray-100 p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-primary-50 via-purple-50 to-pink-50 rounded-2xl opacity-0 group-focus-within:opacity-100 transition-all duration-300"></div>
            <div className="absolute left-5 top-1/2 -translate-y-1/2 p-2 bg-gradient-to-r from-primary-500 to-purple-500 rounded-xl opacity-70 group-focus-within:opacity-100 transition-all duration-300 shadow-lg">
              <Search className="w-5 h-5 text-white" />
            </div>
            <input
              type="text"
              placeholder="Search by booking number..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
              className="relative w-full pl-20 pr-6 py-4 bg-white border-2 border-gray-200 rounded-2xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-300 placeholder:text-gray-400 font-medium shadow-md hover:shadow-lg"
            />
          </div>

          {/* Filter button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 px-6 py-4 border-2 rounded-2xl transition-all duration-300 font-bold shadow-lg hover:shadow-xl hover:scale-105 ${
              hasActiveFilters
                ? 'border-primary-500 bg-gradient-to-r from-primary-500 to-purple-500 text-white shadow-primary-500/30'
                : 'border-gray-300 bg-white hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100'
            }`}
          >
            <Filter className="w-5 h-5" />
            Filters
            {hasActiveFilters && (
              <span className="w-5 h-5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-full text-xs flex items-center justify-center shadow-sm font-bold">
                !
              </span>
            )}
          </button>

          {/* Apply button */}
          <button
            onClick={applyFilters}
            className="px-8 py-4 bg-gradient-to-r from-primary-500 via-purple-500 to-pink-500 hover:from-primary-600 hover:via-purple-600 hover:to-pink-600 text-white rounded-2xl shadow-xl hover:shadow-2xl hover:shadow-primary-500/40 hover:-translate-y-1 transition-all duration-300 font-bold"
          >
            Apply
          </button>
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="mt-6 pt-6 border-t-2 border-gray-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Tour type */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Tour Type
              </label>
              <select
                value={filters.tourTypeId}
                onChange={(e) => setFilters({ ...filters, tourTypeId: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-sm hover:shadow-md transition-all duration-200 font-medium bg-white"
              >
                <option value="">All types</option>
                {tourTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.code} - {type.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Guide */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Guide
              </label>
              <select
                value={filters.guideId}
                onChange={(e) => setFilters({ ...filters, guideId: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-sm hover:shadow-md transition-all duration-200 font-medium bg-white"
              >
                <option value="">All guides</option>
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
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-sm hover:shadow-md transition-all duration-200 font-medium bg-white"
              >
                <option value="">All statuses</option>
                {Object.entries(statusLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date range */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Period
              </label>
              <div className="flex gap-3">
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-sm hover:shadow-md transition-all duration-200 font-medium bg-white"
                />
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-sm hover:shadow-md transition-all duration-200 font-medium bg-white"
                />
              </div>
            </div>

            {/* Clear filters */}
            {hasActiveFilters && (
              <div className="flex items-end">
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-2 px-4 py-3 text-sm font-bold text-red-600 hover:text-white bg-red-50 hover:bg-gradient-to-r hover:from-red-500 hover:to-red-600 border-2 border-red-200 hover:border-red-600 rounded-xl transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105"
                >
                  <X className="w-5 h-5" />
                  Clear filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl shadow-2xl border-2 border-gray-100 overflow-hidden">
        {/* Pagination Top */}
        {pagination.pages > 1 && !loading && bookings.length > 0 && (
          <div className="px-8 py-5 border-b-3 border-gray-200 bg-gradient-to-r from-primary-50 via-purple-50 to-pink-50 flex items-center justify-between">
            <p className="text-base font-bold text-gray-700">
              Page <span className="text-primary-600 px-2 py-1 bg-white rounded-lg shadow-sm">{pagination.page}</span> of <span className="text-primary-600 px-2 py-1 bg-white rounded-lg shadow-sm">{pagination.pages}</span>
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => changePage(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="p-3 rounded-2xl bg-white border-2 border-gray-300 hover:bg-gradient-to-r hover:from-primary-500 hover:to-purple-500 hover:text-white hover:border-primary-500 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => changePage(pagination.page + 1)}
                disabled={pagination.page === pagination.pages}
                className="p-3 rounded-2xl bg-white border-2 border-gray-300 hover:bg-gradient-to-r hover:from-primary-500 hover:to-purple-500 hover:text-white hover:border-primary-500 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="relative">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary-200"></div>
              <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-primary-600 absolute top-0"></div>
            </div>
            <p className="text-gray-600 font-semibold">Loading bookings...</p>
          </div>
        ) : bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <div className="w-24 h-24 bg-gradient-to-br from-primary-100 to-purple-200 rounded-full flex items-center justify-center shadow-lg mb-4">
              <CalendarDays className="w-12 h-12 text-primary-500" />
            </div>
            <p className="text-xl font-bold text-gray-700 mb-2">No bookings found</p>
            <p className="text-gray-500">Try adjusting your filters or create a new booking</p>
          </div>
        ) : isMobile ? (
          <div className="space-y-3">
            {bookings.map((booking, index) => {
              const calculatedStatus = booking.status === 'CANCELLED' ? 'CANCELLED' : getStatusByPax(booking.pax, booking.departureDate, booking.endDate);
              return (
                <div
                  key={booking.id}
                  className={`rounded-2xl p-4 shadow-lg border-2 ${
                    calculatedStatus === 'CANCELLED' ? 'bg-red-50 border-red-300' :
                    calculatedStatus === 'PENDING' ? 'bg-yellow-50 border-yellow-300' :
                    calculatedStatus === 'IN_PROGRESS' ? 'bg-purple-50 border-purple-300' :
                    calculatedStatus === 'CONFIRMED' ? 'bg-green-50 border-green-300' :
                    'bg-blue-50 border-blue-300'
                  }`}
                >
                  {/* Header with Booking Number and Status */}
                  <div className="flex items-center justify-between mb-3">
                    <Link to={`/bookings/${booking.id}?edit=true`}>
                      <span
                        className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-bold text-white shadow-lg"
                        style={{ backgroundColor: booking.tourType?.color || '#6B7280' }}
                      >
                        {booking.bookingNumber}
                      </span>
                    </Link>
                    <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold ${statusClasses[calculatedStatus]}`}>
                      {statusLabels[calculatedStatus]}
                    </span>
                  </div>

                  {/* Info Grid */}
                  <div className="space-y-2 mb-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-primary-600" />
                      <span className="font-semibold text-gray-700">Start:</span>
                      <span className="text-gray-900">{format(new Date(booking.departureDate), 'dd.MM.yyyy')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="w-4 h-4 text-primary-600" />
                      <span className="font-semibold text-gray-700">PAX:</span>
                      <span className="text-gray-900 font-bold">{booking.pax}</span>
                    </div>
                    {booking.guide && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-primary-600" />
                        <span className="font-semibold text-gray-700">Guide:</span>
                        <span className="text-gray-900">{booking.guide.name}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-300">
                    <Link
                      to={`/bookings/${booking.id}`}
                      className="p-2 text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg transition-all"
                      title="View"
                    >
                      <Eye className="w-5 h-5" />
                    </Link>
                    <Link
                      to={`/bookings/${booking.id}?edit=true`}
                      className="p-2 text-primary-600 hover:text-primary-900 hover:bg-white rounded-lg transition-all"
                      title="Edit"
                    >
                      <Edit className="w-5 h-5" />
                    </Link>
                    <button
                      onClick={() => handleDelete(booking.id, booking.bookingNumber)}
                      className="p-2 text-red-600 hover:text-red-900 hover:bg-white rounded-lg transition-all"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-primary-500 via-purple-500 to-pink-500 border-b-4 border-primary-600 shadow-2xl sticky top-0 z-10">
                <tr>
                  <th className="hidden md:table-cell px-6 py-5 text-left text-sm font-black text-white uppercase tracking-wider">
                    Number
                  </th>
                  <th className="px-3 md:px-6 py-5 text-left text-sm font-black text-white uppercase tracking-wider">
                    Tour Type
                  </th>
                  <th className="px-3 md:px-6 py-5 text-left text-sm font-black text-white uppercase tracking-wider">
                    Tour Start
                  </th>
                  <th className="hidden md:table-cell px-6 py-5 text-left text-sm font-black text-white uppercase tracking-wider">
                    Arrival
                  </th>
                  <th className="hidden md:table-cell px-6 py-5 text-left text-sm font-black text-white uppercase tracking-wider">
                    Tour End
                  </th>
                  <th className="px-3 md:px-6 py-5 text-left text-sm font-black text-white uppercase tracking-wider">
                    Pax
                  </th>
                  <th className="hidden lg:table-cell px-6 py-5 text-left text-sm font-black text-white uppercase tracking-wider">
                    Uzbekistan
                  </th>
                  <th className="hidden lg:table-cell px-6 py-5 text-left text-sm font-black text-white uppercase tracking-wider">
                    Turkmenistan
                  </th>
                  <th className="hidden lg:table-cell px-6 py-5 text-left text-sm font-black text-white uppercase tracking-wider">
                    Guide
                  </th>
                  <th className="hidden lg:table-cell px-6 py-5 text-left text-sm font-black text-white uppercase tracking-wider">
                    Train Tickets
                  </th>
                  <th className="hidden xl:table-cell px-6 py-5 text-left text-sm font-black text-white uppercase tracking-wider">
                    DBL
                  </th>
                  <th className="hidden xl:table-cell px-6 py-5 text-left text-sm font-black text-white uppercase tracking-wider">
                    TWN
                  </th>
                  <th className="hidden xl:table-cell px-6 py-5 text-left text-sm font-black text-white uppercase tracking-wider">
                    SNGL
                  </th>
                  <th className="px-3 md:px-6 py-5 text-left text-sm font-black text-white uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-3 md:px-6 py-5 text-right text-sm font-black text-white uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {bookings.map((booking, index) => {
                  const calculatedStatus = booking.status === 'CANCELLED' ? 'CANCELLED' : getStatusByPax(booking.pax, booking.departureDate, booking.endDate);

                  // Set row background color based on status
                  let rowClass = 'hover:bg-gray-50';
                  if (calculatedStatus === 'CANCELLED') {
                    rowClass = 'bg-red-50 hover:bg-red-100';
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
                    <td className="hidden md:table-cell px-4 py-4">
                      <span className="font-bold text-gray-900 text-base">
                        {(pagination.page - 1) * pagination.limit + index + 1}
                      </span>
                    </td>
                    {/* ТИП ТУРА */}
                    <td className="px-2 md:px-4 py-4">
                      <Link
                        to={`/bookings/${booking.id}?edit=true`}
                      >
                        <span
                          className="inline-flex items-center px-3 md:px-4 py-2 rounded-xl text-xs md:text-sm font-bold text-white whitespace-nowrap hover:shadow-lg hover:scale-105 transition-all duration-200 shadow-sm"
                          style={{ backgroundColor: booking.tourType?.color || '#6B7280' }}
                        >
                          {booking.bookingNumber}
                        </span>
                      </Link>
                    </td>
                    {/* TOUR START */}
                    <td className="px-2 md:px-4 py-4 text-xs md:text-sm text-gray-700 font-medium">
                      {format(new Date(booking.departureDate), 'dd.MM.yyyy')}
                    </td>
                    {/* ARRIVAL */}
                    <td className="hidden md:table-cell px-4 py-4 text-sm text-gray-700 font-medium">
                      {booking.arrivalDate
                        ? format(new Date(booking.arrivalDate), 'dd.MM.yyyy')
                        : format(addDays(new Date(booking.departureDate), 1), 'dd.MM.yyyy')}
                    </td>
                    {/* TOUR END */}
                    <td className="hidden md:table-cell px-4 py-4 text-sm text-gray-700 font-medium">
                      {format(new Date(booking.endDate), 'dd.MM.yyyy')}
                    </td>
                    {/* PAX */}
                    <td className="px-2 md:px-4 py-4">
                      <div className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
                        <Users className="w-4 h-4 text-primary-500" />
                        <span className="font-bold text-gray-900">{booking.pax}</span>
                      </div>
                    </td>
                    {/* УЗБЕКИСТАН */}
                    <td className="hidden lg:table-cell px-4 py-4 text-sm text-gray-700 font-semibold text-center">
                      {booking.paxUzbekistan || 0}
                    </td>
                    {/* ТУРКМЕНИСТАН */}
                    <td className="hidden lg:table-cell px-4 py-4 text-sm text-gray-700 font-semibold text-center">
                      {booking.paxTurkmenistan || 0}
                    </td>
                    {/* ГИД */}
                    <td className="hidden lg:table-cell px-4 py-4 text-sm text-gray-700 font-medium">
                      {booking.guide?.name || '-'}
                    </td>
                    {/* ЖД БИЛЕТЫ */}
                    <td className="hidden lg:table-cell px-4 py-4 text-sm text-gray-700 font-semibold text-center">
                      {booking.trainTickets || '-'}
                    </td>
                    {/* DBL */}
                    <td className="hidden xl:table-cell px-4 py-4 text-sm text-gray-700 font-semibold text-center">
                      {booking.roomsDbl ? (Number(booking.roomsDbl) % 1 === 0 ? booking.roomsDbl : Number(booking.roomsDbl).toFixed(1)) : 0}
                    </td>
                    {/* TWN */}
                    <td className="hidden xl:table-cell px-4 py-4 text-sm text-gray-700 font-semibold text-center">
                      {booking.roomsTwn ? (Number(booking.roomsTwn) % 1 === 0 ? booking.roomsTwn : Number(booking.roomsTwn).toFixed(1)) : 0}
                    </td>
                    {/* SNGL */}
                    <td className="hidden xl:table-cell px-4 py-4 text-sm text-gray-700 font-semibold text-center">
                      {booking.roomsSngl ? (Number(booking.roomsSngl) % 1 === 0 ? booking.roomsSngl : Number(booking.roomsSngl).toFixed(1)) : 0}
                    </td>
                    {/* СТАТУС */}
                    <td className="px-2 md:px-4 py-4">
                      <span className={`inline-flex items-center px-2 md:px-3 py-1.5 rounded-xl text-xs font-bold ${statusClasses[calculatedStatus]}`}>
                        {statusLabels[calculatedStatus]}
                      </span>
                    </td>
                    {/* ДЕЙСТВИЯ */}
                    <td className="px-2 md:px-4 py-4">
                      <div className="flex items-center justify-end gap-1 md:gap-2">
                        <Link
                          to={`/bookings/${booking.id}`}
                          className="p-2.5 md:p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg hover:scale-110 transition-all duration-200 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center"
                          title="View"
                        >
                          <Eye className="w-5 h-5 md:w-4 md:h-4" />
                        </Link>
                        <Link
                          to={`/bookings/${booking.id}?edit=true`}
                          className="p-2.5 md:p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg hover:scale-110 transition-all duration-200 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center"
                          title="Edit"
                        >
                          <Edit className="w-5 h-5 md:w-4 md:h-4" />
                        </Link>
                        <button
                          onClick={() => handleDelete(booking.id, booking.bookingNumber)}
                          className="p-2.5 md:p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg hover:scale-110 transition-all duration-200 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center"
                          title="Delete"
                        >
                          <Trash2 className="w-5 h-5 md:w-4 md:h-4" />
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

        {/* Total PAX */}
        {!loading && bookings.length > 0 && (
          <div className="px-8 py-5 border-t-3 border-gray-200 bg-gradient-to-r from-primary-500 via-purple-500 to-pink-500 flex items-center justify-end shadow-inner">
            <div className="flex items-center gap-4 bg-white px-6 py-3 rounded-2xl shadow-xl">
              <div className="p-2 bg-gradient-to-r from-primary-500 to-purple-500 rounded-xl">
                <Users className="w-6 h-6 text-white" />
              </div>
              <p className="text-xl font-black text-gray-800">
                Total PAX: <span className="text-transparent bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text">{bookings.reduce((sum, booking) => sum + (parseInt(booking.pax) || 0), 0)}</span>
              </p>
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
