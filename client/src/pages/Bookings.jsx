import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { bookingsApi, tourTypesApi, guidesApi } from '../services/api';
import { useYear } from '../context/YearContext';
import { format, addDays } from 'date-fns';
import toast from 'react-hot-toast';
import { useIsMobile } from '../hooks/useMediaQuery';
import {
  Search,
  Filter,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  Users,
  Calendar,
  MapPin,
  Copy,
  Trash
} from 'lucide-react';

const statusLabels = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  FINAL_CONFIRMED: 'Final Confirmed',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled'
};

const statusClasses = {
  PENDING: 'bg-gradient-to-r from-yellow-200 to-yellow-300 text-yellow-900 border border-yellow-400 shadow-sm',
  CONFIRMED: 'bg-gradient-to-r from-green-200 to-green-300 text-green-900 border border-green-400 shadow-sm',
  FINAL_CONFIRMED: 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white border border-emerald-700 shadow-sm',
  IN_PROGRESS: 'bg-gradient-to-r from-purple-500 to-violet-600 text-white border border-purple-700 shadow-sm',
  COMPLETED: 'bg-gradient-to-r from-blue-200 to-blue-300 text-blue-900 border border-blue-400 shadow-sm',
  CANCELLED: 'bg-gradient-to-r from-red-500 to-red-600 text-white border border-red-700 shadow-sm'
};

// Priority-based display stats:
// PAX: tourists > 0 → tourist count, else → booking.pax (email update)
// Rooms/UZB/TKM: from tourists (Final List) when available
const getDisplayStats = (booking) => {
  const hasTourists = (booking._touristsCount || 0) > 0;
  const isER = booking.tourType?.code === 'ER';
  const cancelled = booking.status === 'CANCELLED';
  if (cancelled) return { pax: 0, dbl: 0, twn: 0, sngl: 0, uzb: 0, tkm: 0 };

  // BOOKING_OVERVIEW: always use booking.pax/paxUzb/paxTkm for PAX counts
  // Rooms (DBL/TWN/SNGL) still from tourists if available
  const isBookingOverview = booking.paxSource === 'BOOKING_OVERVIEW';

  const pax = isBookingOverview ? (booking.pax || 0) : (hasTourists ? booking._touristsCount : (booking.pax || 0));
  const dbl = hasTourists ? (booking._touristRoomsDbl || 0) : (booking.roomsDbl || 0);
  const twn = hasTourists ? (booking._touristRoomsTwn || 0) : (booking.roomsTwn || 0);
  const sngl = hasTourists ? (booking._touristRoomsSngl || 0) : (booking.roomsSngl || 0);
  const uzb = isER
    ? (isBookingOverview ? (booking.paxUzbekistan || 0) : (hasTourists ? (booking._touristPaxUzb || 0) : (booking.paxUzbekistan || 0)))
    : pax;
  const tkm = isER
    ? (isBookingOverview ? (booking.paxTurkmenistan || 0) : (hasTourists ? (booking._touristPaxTkm || 0) : (booking.paxTurkmenistan || 0)))
    : 0;
  return { pax, dbl, twn, sngl, uzb, tkm };
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
  const { selectedYear } = useYear();
  const [searchParams, setSearchParams] = useSearchParams();
  const [bookings, setBookings] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 200 });
  const [loading, setLoading] = useState(true);
  const [tourTypes, setTourTypes] = useState([]);
  const [guides, setGuides] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [activeBookingTab, setActiveBookingTab] = useState('TOTAL');

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
  }, [searchParams, selectedYear]);

  const loadFiltersData = async () => {
    try {
      const [tourTypesRes, guidesRes] = await Promise.all([
        tourTypesApi.getAll(),
        guidesApi.getAll(false, new Date().getFullYear())
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
      backendParams.year = selectedYear;

      const response = await bookingsApi.getAll(backendParams);
      let bookingsData = response.data.bookings;

      // Auto-copy from previous year if no bookings exist for this year
      if (bookingsData.length === 0 && !status && !backendParams.search && !backendParams.tourTypeId && !backendParams.guideId) {
        const prevYear = selectedYear - 1;
        const prevRes = await bookingsApi.getAll({ ...backendParams, year: prevYear, limit: 1 });
        if (prevRes.data.bookings.length > 0) {
          await bookingsApi.copyFromYear(prevYear, selectedYear);
          const refetch = await bookingsApi.getAll(backendParams);
          bookingsData = refetch.data.bookings;
        }
      }

      // Filter by calculated status on frontend
      if (status) {
        bookingsData = bookingsData.filter(booking => {
          const calculatedStatus = booking.status === 'CANCELLED' ? 'CANCELLED' : booking.status === 'FINAL_CONFIRMED' ? 'FINAL_CONFIRMED' : getStatusByPax(booking.pax, booking.departureDate, booking.endDate);
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

  const BOOKING_TABS = ['TOTAL', 'ER', 'CO', 'KAS', 'ZA'];
  const TAB_COLORS = { ER: '#3B82F6', CO: '#10B981', KAS: '#F59E0B', ZA: '#8B5CF6' };
  const displayedBookings = activeBookingTab === 'TOTAL'
    ? bookings
    : bookings.filter(b => b.tourType?.code === activeBookingTab);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 md:p-6 space-y-3 md:space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden bg-white md:rounded-3xl shadow-md md:shadow-2xl border-b-2 md:border-2 border-primary-100 p-4 md:p-8">
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
                Bookings Management <span className="text-2xl md:text-3xl">{selectedYear}</span>
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
      <div className="bg-gradient-to-br from-white to-gray-50 md:rounded-3xl shadow-md md:shadow-2xl border-y-2 md:border-2 border-gray-100 p-4 md:p-6">
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

      {/* Tour type tabs */}
      <div className="grid grid-cols-5 gap-2 px-3 md:px-0">
        {BOOKING_TABS.map(tab => {
          const count = tab === 'TOTAL' ? bookings.length : bookings.filter(b => b.tourType?.code === tab).length;
          const isActive = activeBookingTab === tab;
          const color = TAB_COLORS[tab] || '#6366f1';
          return (
            <button
              key={tab}
              onClick={() => setActiveBookingTab(tab)}
              className="flex flex-col items-center justify-center gap-0.5 py-3 px-2 rounded-2xl font-bold transition-all duration-300 shadow-sm"
              style={isActive
                ? { background: color, color: '#fff', boxShadow: `0 4px 18px ${color}55`, transform: 'translateY(-2px)' }
                : { background: '#fff', color: '#374151', border: '2px solid #e5e7eb' }
              }
            >
              <span className="text-xs font-black tracking-wide">{tab}</span>
              <span
                className="text-xl font-black leading-none"
                style={isActive ? { color: '#fff' } : { color: color || '#6366f1' }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Status counters */}
      {(() => {
        const counts = { FINAL_CONFIRMED: 0, CONFIRMED: 0, IN_PROGRESS: 0, PENDING: 0, CANCELLED: 0, COMPLETED: 0 };
        displayedBookings.forEach(b => {
          const s = b.status === 'CANCELLED' ? 'CANCELLED' : b.status === 'FINAL_CONFIRMED' ? 'FINAL_CONFIRMED' : getStatusByPax(b.pax, b.departureDate, b.endDate);
          if (counts[s] !== undefined) counts[s]++;
        });
        const statusConfig = [
          { key: 'FINAL_CONFIRMED', label: 'Final Confirmed', from: 'from-emerald-500', to: 'to-emerald-700', border: 'border-emerald-400' },
          { key: 'CONFIRMED',       label: 'Confirmed',       from: 'from-green-500',   to: 'to-emerald-600', border: 'border-green-400' },
          { key: 'IN_PROGRESS',     label: 'In Progress',     from: 'from-purple-500',  to: 'to-indigo-600',  border: 'border-purple-400' },
          { key: 'PENDING',         label: 'Pending',         from: 'from-yellow-500',  to: 'to-orange-600',  border: 'border-yellow-400' },
          { key: 'CANCELLED',       label: 'Cancelled',       from: 'from-red-500',     to: 'to-rose-600',    border: 'border-red-400' },
          { key: 'COMPLETED',       label: 'Completed',       from: 'from-slate-500',   to: 'to-slate-600',   border: 'border-slate-400' },
        ];
        const visible = statusConfig.filter(s => counts[s.key] > 0);
        if (visible.length === 0) return null;
        return (
          <div className="flex flex-wrap items-center gap-2 md:gap-3 px-3 md:px-0">
            {visible.map(({ key, label, from, to, border }) => (
              <div key={key} className={`flex items-center gap-2 px-3 py-2 md:px-5 md:py-2.5 bg-gradient-to-r ${from} ${to} border-2 ${border} rounded-xl md:rounded-2xl shadow-lg hover:scale-105 transition-all duration-300`}>
                <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
                <span className="text-white font-bold text-xs md:text-sm">{label}: {counts[key]}</span>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Table */}
      <div className="bg-white md:rounded-3xl shadow-md md:shadow-2xl border-y-2 md:border-2 border-gray-100 overflow-hidden">
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
        ) : displayedBookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <div className="w-24 h-24 bg-gradient-to-br from-primary-100 to-purple-200 rounded-full flex items-center justify-center shadow-lg mb-4">
              <CalendarDays className="w-12 h-12 text-primary-500" />
            </div>
            <p className="text-xl font-bold text-gray-700 mb-2">No bookings found</p>
            <p className="text-gray-500">Try adjusting your filters or create a new booking</p>
          </div>
        ) : isMobile ? (
          <div className="space-y-3 px-3 py-2">
            {displayedBookings.map((booking, index) => {
              const calculatedStatus = booking.status === 'CANCELLED' ? 'CANCELLED' : booking.status === 'FINAL_CONFIRMED' ? 'FINAL_CONFIRMED' : getStatusByPax(booking.pax, booking.departureDate, booking.endDate);
              const ds = getDisplayStats(booking);
              return (
                <div
                  key={booking.id}
                  className={`rounded-2xl p-4 shadow-lg border-2 ${
                    calculatedStatus === 'CANCELLED' ? 'bg-red-50 border-red-300' :
                    calculatedStatus === 'PENDING' ? 'bg-yellow-50 border-yellow-300' :
                    calculatedStatus === 'IN_PROGRESS' ? 'bg-purple-50 border-purple-300' :
                    calculatedStatus === 'FINAL_CONFIRMED' ? 'bg-emerald-100 border-emerald-500' :
                    calculatedStatus === 'CONFIRMED' ? 'bg-green-50 border-green-300' :
                    'bg-blue-50 border-blue-300'
                  }`}
                >
                  {/* Header with Booking Number and Status */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link to={`/bookings/${booking.id}?edit=true`}>
                        <span
                          className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-bold text-white shadow-lg"
                          style={{ backgroundColor: booking.tourType?.color || '#6B7280' }}
                        >
                          {booking.bookingNumber}
                        </span>
                      </Link>
                      {booking.emailImportedAt && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-blue-100 text-blue-700" title={`Email import: ${format(new Date(booking.emailImportedAt), 'dd.MM.yyyy HH:mm')}`}>
                          📧 {format(new Date(booking.emailImportedAt), 'dd.MM')}
                        </span>
                      )}
                    </div>
                    <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold ${statusClasses[calculatedStatus]}`}>
                      {statusLabels[calculatedStatus]}
                    </span>
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-white/60 rounded-xl px-3 py-2 flex flex-col gap-0.5">
                      <span className="text-xs text-gray-400 font-medium">Arrival</span>
                      <span className="text-sm font-bold text-gray-800">
                        {booking.arrivalDate ? format(new Date(booking.arrivalDate), 'dd.MM.yyyy') : '—'}
                      </span>
                    </div>
                    <div className="bg-white/60 rounded-xl px-3 py-2 flex flex-col gap-0.5">
                      <span className="text-xs text-gray-400 font-medium">End Tour</span>
                      <span className="text-sm font-bold text-gray-800">
                        {booking.endDate ? format(new Date(booking.endDate), 'dd.MM.yyyy') : '—'}
                      </span>
                    </div>
                  </div>

                  {/* PAX + Rooms + Guide */}
                  <div className="bg-white/60 rounded-xl px-3 py-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-primary-500" />
                        <span className="font-bold text-gray-800 text-sm">{ds.pax}</span>
                        <span className="text-xs text-gray-400">PAX</span>
                      </div>
                      {booking.guide && (
                        <div className="flex items-center gap-1 text-gray-600">
                          <MapPin className="w-3 h-3 text-primary-500" />
                          <span className="text-xs font-semibold">{booking.guide.name}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500 border-t border-gray-100 pt-1.5">
                      <span>DBL <b className="text-gray-700">{ds.dbl > 0 ? ds.dbl : '—'}</b></span>
                      <span>TWN <b className="text-gray-700">{ds.twn > 0 ? ds.twn : '—'}</b></span>
                      <span>EZ <b className="text-gray-700">{ds.sngl > 0 ? ds.sngl : '—'}</b></span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end pt-3 border-t border-gray-200 mt-2">
                    <button
                      onClick={() => handleDelete(booking.id, booking.bookingNumber)}
                      className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all"
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
                  <th className="hidden md:table-cell px-2 py-4 text-left text-xs font-black text-white uppercase tracking-wide whitespace-nowrap">
                    №
                  </th>
                  <th className="px-2 py-4 text-left text-xs font-black text-white uppercase tracking-wide whitespace-nowrap">
                    Type
                  </th>
                  <th className="px-2 py-4 text-left text-xs font-black text-white uppercase tracking-wide whitespace-nowrap">
                    Start
                  </th>
                  <th className="hidden md:table-cell px-2 py-4 text-left text-xs font-black text-white uppercase tracking-wide whitespace-nowrap">
                    Arrival
                  </th>
                  <th className="hidden md:table-cell px-2 py-4 text-left text-xs font-black text-white uppercase tracking-wide whitespace-nowrap">
                    End
                  </th>
                  <th className="px-2 py-4 text-left text-xs font-black text-white uppercase tracking-wide whitespace-nowrap">
                    PAX
                  </th>
                  <th className="hidden lg:table-cell px-2 py-4 text-left text-xs font-black text-white uppercase tracking-wide whitespace-nowrap">
                    UZB
                  </th>
                  <th className="hidden lg:table-cell px-2 py-4 text-left text-xs font-black text-white uppercase tracking-wide whitespace-nowrap">
                    TKM
                  </th>
                  <th className="hidden lg:table-cell px-2 py-4 text-left text-xs font-black text-white uppercase tracking-wide whitespace-nowrap">
                    Guide
                  </th>
                  <th className="hidden lg:table-cell px-2 py-4 text-left text-xs font-black text-white uppercase tracking-wide whitespace-nowrap">
                    Train
                  </th>
                  <th className="hidden xl:table-cell px-2 py-4 text-center text-xs font-black text-white uppercase tracking-wide">
                    DBL
                  </th>
                  <th className="hidden xl:table-cell px-2 py-4 text-center text-xs font-black text-white uppercase tracking-wide">
                    TWN
                  </th>
                  <th className="hidden xl:table-cell px-2 py-4 text-center text-xs font-black text-white uppercase tracking-wide">
                    SNGL
                  </th>
                  <th className="hidden xl:table-cell px-2 py-4 text-center text-xs font-black text-white uppercase tracking-wide">
                    Rooms
                  </th>
                  <th className="px-2 py-4 text-left text-xs font-black text-white uppercase tracking-wide whitespace-nowrap">
                    Status
                  </th>
                  <th className="px-2 py-4 text-center text-xs font-black text-white uppercase tracking-wide whitespace-nowrap">
                    Del
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {displayedBookings.map((booking, index) => {
                  const calculatedStatus = booking.status === 'CANCELLED' ? 'CANCELLED' : booking.status === 'FINAL_CONFIRMED' ? 'FINAL_CONFIRMED' : getStatusByPax(booking.pax, booking.departureDate, booking.endDate);
                  const ds = getDisplayStats(booking);

                  // Set row background color based on status
                  let rowClass = 'hover:bg-gray-50';
                  if (calculatedStatus === 'CANCELLED') {
                    rowClass = 'bg-red-200 hover:bg-red-300';
                  } else if (calculatedStatus === 'PENDING') {
                    rowClass = 'bg-yellow-100 hover:bg-yellow-200';
                  } else if (calculatedStatus === 'IN_PROGRESS') {
                    rowClass = 'bg-purple-200 hover:bg-purple-300';
                  } else if (calculatedStatus === 'FINAL_CONFIRMED') {
                    rowClass = 'bg-emerald-200 hover:bg-emerald-300';
                  } else if (calculatedStatus === 'CONFIRMED') {
                    rowClass = 'bg-green-100 hover:bg-green-200';
                  } else if (calculatedStatus === 'COMPLETED') {
                    rowClass = 'bg-slate-300 hover:bg-slate-400';
                  }

                  return (
                  <tr key={booking.id} className={`${rowClass} transition-all duration-200`}>
                    {/* НОМЕР */}
                    <td className="hidden md:table-cell px-1 py-3 text-center">
                      <span className="font-medium text-gray-500 text-xs">
                        {(pagination.page - 1) * pagination.limit + index + 1}
                      </span>
                    </td>
                    {/* ТИП ТУРА */}
                    <td className="px-2 py-3">
                      <div className="flex flex-col gap-0.5">
                        <Link to={`/bookings/${booking.id}?edit=true`}>
                          <span
                            className="inline-flex items-center px-2 py-1 rounded-lg text-sm font-bold text-white whitespace-nowrap hover:shadow-md hover:scale-105 transition-all duration-200 shadow-sm"
                            style={{ backgroundColor: booking.tourType?.color || '#6B7280' }}
                          >
                            {booking.bookingNumber}
                          </span>
                        </Link>
                        {booking.emailImportedAt && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-600" title={`Email import: ${format(new Date(booking.emailImportedAt), 'dd.MM.yyyy HH:mm')}`}>
                            📧 {format(new Date(booking.emailImportedAt), 'dd.MM')}
                          </span>
                        )}
                      </div>
                    </td>
                    {/* TOUR START */}
                    <td className="px-2 py-3 text-sm text-gray-700 font-semibold whitespace-nowrap">
                      {format(new Date(booking.departureDate), 'dd.MM.yy')}
                    </td>
                    {/* ARRIVAL */}
                    <td className="hidden md:table-cell px-2 py-3 text-sm text-gray-700 font-semibold whitespace-nowrap">
                      {booking.arrivalDate
                        ? format(new Date(booking.arrivalDate), 'dd.MM.yy')
                        : format(addDays(new Date(booking.departureDate), 1), 'dd.MM.yy')}
                    </td>
                    {/* TOUR END */}
                    <td className="hidden md:table-cell px-2 py-3 text-sm text-gray-700 font-semibold whitespace-nowrap">
                      {format(new Date(booking.endDate), 'dd.MM.yy')}
                    </td>
                    {/* PAX */}
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4 text-primary-500" />
                        <span className="font-black text-gray-900 text-base">{ds.pax}</span>
                      </div>
                    </td>
                    {/* УЗБЕКИСТАН */}
                    <td className="hidden lg:table-cell px-2 py-3 text-sm text-gray-700 font-bold text-center">
                      {ds.uzb}
                    </td>
                    {/* ТУРКМЕНИСТАН */}
                    <td className="hidden lg:table-cell px-2 py-3 text-sm text-gray-700 font-bold text-center">
                      {ds.tkm}
                    </td>
                    {/* ГИД */}
                    <td className="hidden lg:table-cell px-2 py-3 text-sm text-gray-800 font-semibold whitespace-nowrap">
                      {booking.guide?.name || '-'}
                    </td>
                    {/* ЖД БИЛЕТЫ */}
                    <td className="hidden lg:table-cell px-2 py-3 text-sm font-bold text-center">
                      {booking.trainTickets === 'Issued'
                        ? <span className="text-emerald-600">OK</span>
                        : <span className="text-gray-400">-</span>}
                    </td>
                    {/* DBL */}
                    <td className="hidden xl:table-cell px-2 py-3 text-sm text-gray-800 font-bold text-center">
                      {ds.dbl ? (Number(ds.dbl) % 1 === 0 ? ds.dbl : Number(ds.dbl).toFixed(1)) : 0}
                    </td>
                    {/* TWN */}
                    <td className="hidden xl:table-cell px-2 py-3 text-sm text-gray-800 font-bold text-center">
                      {ds.twn ? (Number(ds.twn) % 1 === 0 ? ds.twn : Number(ds.twn).toFixed(1)) : 0}
                    </td>
                    {/* SNGL */}
                    <td className="hidden xl:table-cell px-2 py-3 text-sm text-gray-800 font-bold text-center">
                      {ds.sngl ? (Number(ds.sngl) % 1 === 0 ? ds.sngl : Number(ds.sngl).toFixed(1)) : 0}
                    </td>
                    {/* TOTAL ROOMS */}
                    <td className="hidden xl:table-cell px-2 py-3 text-center">
                      {(() => {
                        const total = (ds.dbl || 0) + (ds.twn || 0) + (ds.sngl || 0);
                        return total > 0
                          ? <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-700 font-black text-sm">{Number(total) % 1 === 0 ? total : Number(total).toFixed(1)}</span>
                          : <span className="text-gray-300">—</span>;
                      })()}
                    </td>
                    {/* СТАТУС */}
                    <td className="px-1 py-3">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-lg text-xs font-semibold ${statusClasses[calculatedStatus]}`}>
                        {statusLabels[calculatedStatus]}
                      </span>
                    </td>
                    {/* ДЕЙСТВИЯ */}
                    <td className="px-1 py-4 text-center">
                      <button
                        onClick={() => handleDelete(booking.id, booking.bookingNumber)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 flex items-center justify-center mx-auto"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
        {!loading && displayedBookings.length > 0 && (
          <div className="px-8 py-5 border-t-3 border-gray-200 bg-gradient-to-r from-primary-500 via-purple-500 to-pink-500 flex items-center justify-end shadow-inner">
            <div className="flex items-center gap-4 bg-white px-6 py-3 rounded-2xl shadow-xl">
              <div className="p-2 bg-gradient-to-r from-primary-500 to-purple-500 rounded-xl">
                <Users className="w-6 h-6 text-white" />
              </div>
              <p className="text-xl font-black text-gray-800">
                Total PAX: <span className="text-transparent bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text">{displayedBookings.reduce((sum, booking) => sum + (booking.status === 'CANCELLED' ? 0 : (booking.pax || 0)), 0)}</span>
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
