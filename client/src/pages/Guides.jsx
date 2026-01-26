import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { guidesApi, bookingsApi } from '../services/api';
import { useAuth } from '../store/AuthContext';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import toast from 'react-hot-toast';
import {
  Plus,
  Edit,
  Trash2,
  User,
  Phone,
  Mail,
  X,
  Save,
  AlertTriangle,
  CreditCard,
  FileText,
  Calendar,
  MapPin,
  Eye,
  EyeOff,
  Shield,
  ChevronDown,
  ChevronUp,
  MoreVertical
} from 'lucide-react';

// Helper function to calculate booking status
function getStatusByPax(pax, departureDate, endDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const departure = new Date(departureDate);
  departure.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  const daysUntilDeparture = Math.ceil((departure - today) / (1000 * 60 * 60 * 24));

  if (end < today) return 'COMPLETED';
  if (pax < 4 && daysUntilDeparture < 30) return 'CANCELLED';
  if (pax >= 6) return 'CONFIRMED';
  if (pax >= 4 && pax <= 5) return 'IN_PROGRESS';
  return 'PENDING';
}

export default function Guides() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [guides, setGuides] = useState([]);
  const [alerts, setAlerts] = useState({ alerts: [], expiredCount: 0, expiringSoonCount: 0 });
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGuide, setEditingGuide] = useState(null);
  const [showSensitive, setShowSensitive] = useState({});
  const [expandedGuide, setExpandedGuide] = useState(null);
  const [formData, setFormData] = useState(getEmptyFormData());
  const [expandedTours, setExpandedTours] = useState(null);
  const [guideBookings, setGuideBookings] = useState({});
  const [activeTab, setActiveTab] = useState('information'); // 'information', 'tours', 'payment', 'city-payment'
  const [allBookings, setAllBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);

  function getEmptyFormData() {
    return {
      name: '',
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      phone: '',
      email: '',
      address: '',
      passportNumber: '',
      passportIssueDate: '',
      passportExpiryDate: '',
      passportIssuedBy: '',
      bankAccountNumber: '',
      bankCardNumber: '',
      bankName: '',
      notes: ''
    };
  }

  useEffect(() => {
    loadGuides();
    loadAlerts();
  }, []);

  const loadGuides = async () => {
    try {
      const response = await guidesApi.getAll(true);
      setGuides(response.data.guides);
    } catch (error) {
      toast.error('Ошибка загрузки гидов');
    } finally {
      setLoading(false);
    }
  };

  const loadAlerts = async () => {
    try {
      const response = await guidesApi.getAlerts();
      setAlerts(response.data);
    } catch (error) {
      console.error('Error loading alerts:', error);
    }
  };

  const openModal = (guide = null) => {
    if (guide) {
      setEditingGuide(guide);
      setFormData({
        name: guide.name || '',
        firstName: guide.firstName || '',
        lastName: guide.lastName || '',
        dateOfBirth: guide.dateOfBirth ? format(new Date(guide.dateOfBirth), 'yyyy-MM-dd') : '',
        phone: guide.phone || '',
        email: guide.email || '',
        address: guide.address || '',
        passportNumber: guide.passportNumber || '',
        passportIssueDate: guide.passportIssueDate ? format(new Date(guide.passportIssueDate), 'yyyy-MM-dd') : '',
        passportExpiryDate: guide.passportExpiryDate ? format(new Date(guide.passportExpiryDate), 'yyyy-MM-dd') : '',
        passportIssuedBy: guide.passportIssuedBy || '',
        bankAccountNumber: guide.bankAccountNumber || '',
        bankCardNumber: guide.bankCardNumber || '',
        bankName: guide.bankName || '',
        notes: guide.notes || ''
      });
    } else {
      setEditingGuide(null);
      setFormData(getEmptyFormData());
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingGuide(null);
    setFormData(getEmptyFormData());
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Введите имя гида');
      return;
    }

    try {
      if (editingGuide) {
        await guidesApi.update(editingGuide.id, formData);
        toast.success('Гид обновлён');
      } else {
        await guidesApi.create(formData);
        toast.success('Гид добавлен');
      }
      closeModal();
      loadGuides();
      loadAlerts();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Ошибка сохранения');
    }
  };

  const handleDelete = async (guide) => {
    if (!confirm(`Удалить гида ${guide.name}?`)) return;

    try {
      await guidesApi.delete(guide.id);
      toast.success('Гид удалён');
      loadGuides();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Ошибка удаления');
    }
  };

  const toggleActive = async (guide) => {
    try {
      await guidesApi.update(guide.id, { isActive: !guide.isActive });
      toast.success(guide.isActive ? 'Гид деактивирован' : 'Гид активирован');
      loadGuides();
    } catch (error) {
      toast.error('Ошибка обновления');
    }
  };

  const toggleSensitive = (guideId) => {
    setShowSensitive(prev => ({ ...prev, [guideId]: !prev[guideId] }));
  };

  const toggleExpanded = (guideId) => {
    setExpandedGuide(expandedGuide === guideId ? null : guideId);
  };

  const toggleTours = async (guideId) => {
    if (expandedTours === guideId) {
      setExpandedTours(null);
    } else {
      setExpandedTours(guideId);
      // Загрузить туры гида, если еще не загружены
      if (!guideBookings[guideId]) {
        try {
          const response = await guidesApi.getById(guideId);
          setGuideBookings(prev => ({
            ...prev,
            [guideId]: response.data.guide.bookings || []
          }));
        } catch (error) {
          console.error('Error loading guide bookings:', error);
          toast.error('Ошибка загрузки туров гида');
        }
      }
    }
  };

  const loadAllBookings = async () => {
    setBookingsLoading(true);
    try {
      const response = await bookingsApi.getAll({ limit: 200 });
      setAllBookings(response.data.bookings);
    } catch (error) {
      console.error('Error loading all bookings:', error);
      toast.error('Ошибка загрузки туров');
    } finally {
      setBookingsLoading(false);
    }
  };

  // Load bookings when Tours tab is opened
  useEffect(() => {
    if (activeTab === 'tours' && allBookings.length === 0) {
      loadAllBookings();
    }
  }, [activeTab]);

  const handleEditBooking = (bookingId) => {
    console.log('Navigating to booking:', bookingId);
    navigate(`/bookings/${bookingId}`, { state: { editing: true } });
  };

  const handleDeleteBooking = async (booking) => {
    if (!confirm(`Delete booking ${booking.bookingNumber}?`)) return;

    try {
      await bookingsApi.delete(booking.id);
      toast.success('Booking deleted');
      loadAllBookings();
    } catch (error) {
      toast.error('Error deleting booking');
    }
  };

  const getPassportStatusBadge = (status) => {
    if (!status) return null;

    if (status.isExpired) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
          <AlertTriangle className="w-3 h-3" />
          Истёк
        </span>
      );
    }

    if (status.isExpiringSoon) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
          <AlertTriangle className="w-3 h-3" />
          {status.daysLeft} дней
        </span>
      );
    }

    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">
            Guides
          </h1>
          <p className="text-gray-600 mt-1 text-sm font-medium">Guide Management System</p>
        </div>

        {isAdmin && (
          <button
            onClick={() => openModal()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:from-primary-700 hover:to-primary-800 transition-all duration-200 shadow-lg shadow-primary-500/30 hover:shadow-xl hover:shadow-primary-500/40 font-medium"
          >
            <Plus className="w-5 h-5" />
            Добавить гида
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-1">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('information')}
            className={`flex-1 px-6 py-3 font-semibold rounded-xl transition-all duration-200 ${
              activeTab === 'information'
                ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg shadow-primary-500/30'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            Information
          </button>
          <button
            onClick={() => setActiveTab('tours')}
            className={`flex-1 px-6 py-3 font-semibold rounded-xl transition-all duration-200 ${
              activeTab === 'tours'
                ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg shadow-primary-500/30'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            Tours
          </button>
          <button
            onClick={() => setActiveTab('payment')}
            className={`flex-1 px-6 py-3 font-semibold rounded-xl transition-all duration-200 ${
              activeTab === 'payment'
                ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg shadow-primary-500/30'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            Payment
          </button>
          <button
            onClick={() => setActiveTab('city-payment')}
            className={`flex-1 px-6 py-3 font-semibold rounded-xl transition-all duration-200 ${
              activeTab === 'city-payment'
                ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg shadow-primary-500/30'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            City Payment
          </button>
        </div>
      </div>

      {/* Passport Alerts */}
      {(alerts.expiredCount > 0 || alerts.expiringSoonCount > 0) && (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300 rounded-2xl p-5 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-yellow-100 rounded-xl">
              <AlertTriangle className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-yellow-900 text-lg">Внимание: Проверьте паспорта</h3>
              <p className="text-sm text-yellow-800 mt-2 font-medium">
                {alerts.expiredCount > 0 && (
                  <span className="inline-flex items-center px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-semibold">
                    {alerts.expiredCount} истёкших
                  </span>
                )}
                {alerts.expiredCount > 0 && alerts.expiringSoonCount > 0 && <span className="mx-2">•</span>}
                {alerts.expiringSoonCount > 0 && (
                  <span className="inline-flex items-center px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-semibold">
                    {alerts.expiringSoonCount} истекают скоро
                  </span>
                )}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {alerts.alerts.map(alert => (
                  <span
                    key={alert.id}
                    className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm ${
                      alert.passportStatus.isExpired
                        ? 'bg-red-100 text-red-700 border border-red-200'
                        : 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                    }`}
                  >
                    {alert.name}: {alert.passportStatus.message}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Information Tab */}
      {activeTab === 'information' && (
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gradient-to-r from-primary-600 to-primary-700">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase w-8"></th>
              <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase">Гид</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase">Дата рождения</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase">Контакты</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase">Паспорт</th>
              {isAdmin && (
                <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase">Банк</th>
              )}
              <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase">Туры</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase">Статус</th>
              <th className="px-6 py-4 text-right text-xs font-bold text-white uppercase">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {guides.map((guide) => (
              <>
                <tr key={guide.id} className={!guide.isActive ? 'bg-gray-50 opacity-60' : 'hover:bg-primary-50/50 transition-colors duration-150'}>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleTours(guide.id)}
                      className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-100 rounded-lg transition-all duration-200"
                    >
                      {expandedTours === guide.id ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-lg">
                        <User className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{guide.name}</p>
                        {(guide.firstName || guide.lastName) && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {guide.firstName} {guide.lastName}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-700">
                      {guide.dateOfBirth ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 rounded-lg">
                          <Calendar className="w-3.5 h-3.5 text-gray-500" />
                          {format(new Date(guide.dateOfBirth), 'dd.MM.yyyy')}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1.5 text-sm">
                      {guide.phone && (
                        <div className="flex items-center gap-2 text-gray-700">
                          <Phone className="w-4 h-4 text-primary-500" />
                          <span className="font-medium">{guide.phone}</span>
                        </div>
                      )}
                      {guide.email && (
                        <div className="flex items-center gap-2 text-gray-700">
                          <Mail className="w-4 h-4 text-primary-500" />
                          <span className="font-medium">{guide.email}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-2">
                      {guide.passportNumber && (
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-primary-50 text-primary-700 px-3 py-1 rounded-lg font-semibold border border-primary-200">
                            {showSensitive[guide.id] && isAdmin ? guide.passportNumber : guide.passportNumber}
                          </code>
                          {isAdmin && (
                            <button
                              onClick={() => toggleSensitive(guide.id)}
                              className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all duration-200"
                            >
                              {showSensitive[guide.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          )}
                        </div>
                      )}
                      {guide.passportExpiryDate && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 font-medium">
                            до {format(new Date(guide.passportExpiryDate), 'dd.MM.yyyy')}
                          </span>
                          {getPassportStatusBadge(guide.passportStatus)}
                        </div>
                      )}
                      {!guide.passportNumber && <span className="text-xs text-gray-400">—</span>}
                    </div>
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4">
                      <div className="space-y-1.5 text-xs">
                        {guide.bankCardNumber && (
                          <div className="flex items-center gap-2 text-gray-700">
                            <CreditCard className="w-4 h-4 text-green-500" />
                            <span className="font-medium">{guide.bankCardNumber}</span>
                          </div>
                        )}
                        {guide.bankName && (
                          <div className="text-gray-600 font-medium ml-6">{guide.bankName}</div>
                        )}
                        {!guide.bankCardNumber && !guide.bankName && (
                          <span className="text-gray-400">—</span>
                        )}
                      </div>
                    </td>
                  )}
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg text-xs font-bold shadow-sm">
                      <FileText className="w-3.5 h-3.5" />
                      {guide._count?.bookings || 0} туров
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm ${
                      guide.isActive
                        ? 'bg-gradient-to-r from-green-500 to-green-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}>
                      {guide.isActive ? 'Активен' : 'Неактивен'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openModal(guide)}
                        className="p-2 text-gray-400 hover:text-white hover:bg-primary-500 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
                        title="Редактировать"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => toggleActive(guide)}
                            className="p-2 text-gray-400 hover:text-white hover:bg-yellow-500 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
                            title={guide.isActive ? 'Деактивировать' : 'Активировать'}
                          >
                            <Shield className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(guide)}
                            className="p-2 text-gray-400 hover:text-white hover:bg-red-500 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
                            title="Удалить"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
                {/* Expanded Tours Table */}
                {expandedTours === guide.id && (
                  <tr key={`${guide.id}-tours`}>
                    <td colSpan={isAdmin ? 9 : 8} className="p-0 bg-gradient-to-br from-primary-50 to-blue-50">
                      <div className="p-6">
                        <div className="bg-white rounded-xl border-2 border-primary-200 overflow-hidden shadow-lg">
                          {guideBookings[guide.id] ? (
                            guideBookings[guide.id].length > 0 ? (
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead className="bg-gradient-to-r from-primary-600 to-primary-700">
                                    <tr>
                                      <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase">Number</th>
                                      <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase">Tour Type</th>
                                      <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase">Tour Start</th>
                                      <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase">Arrival</th>
                                      <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase">Tour End</th>
                                      <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase">PAX</th>
                                      <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase">Uzbekistan</th>
                                      <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase">Turkmenistan</th>
                                      <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase">Guide</th>
                                      <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {guideBookings[guide.id].map((booking, idx) => {
                                      const status = getStatusByPax(booking.pax, booking.departureDate, booking.endDate);
                                      return (
                                        <tr key={booking.id} className="hover:bg-primary-50/30 transition-colors duration-150">
                                          <td className="px-4 py-3">
                                            <span className="inline-flex items-center justify-center w-7 h-7 bg-primary-100 text-primary-700 rounded-lg font-bold text-xs">
                                              {idx + 1}
                                            </span>
                                          </td>
                                          <td className="px-4 py-3">
                                            <span
                                              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-sm"
                                              style={{ backgroundColor: booking.tourType?.color || '#3B82F6' }}
                                            >
                                              {booking.bookingNumber || 'N/A'}
                                            </span>
                                          </td>
                                          <td className="px-4 py-3 text-gray-700 font-medium">{format(new Date(booking.departureDate), 'dd.MM.yyyy')}</td>
                                          <td className="px-4 py-3 text-gray-700 font-medium">{format(new Date(booking.arrivalDate), 'dd.MM.yyyy')}</td>
                                          <td className="px-4 py-3 text-gray-700 font-medium">{format(new Date(booking.endDate), 'dd.MM.yyyy')}</td>
                                          <td className="px-4 py-3">
                                            <div className="flex items-center gap-1.5">
                                              <User className="w-4 h-4 text-primary-500" />
                                              <span className="font-bold text-gray-900">{booking.pax || 0}</span>
                                            </div>
                                          </td>
                                          <td className="px-4 py-3 text-gray-700 font-medium">{booking.paxUzbekistan || 0}</td>
                                          <td className="px-4 py-3 text-gray-700 font-medium">{booking.paxTurkmenistan || 0}</td>
                                          <td className="px-4 py-3 text-gray-700 font-semibold">{guide.name}</td>
                                          <td className="px-4 py-3">
                                            <span className={`px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm ${
                                              status === 'COMPLETED' ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white' :
                                              status === 'CONFIRMED' ? 'bg-gradient-to-r from-green-500 to-green-600 text-white' :
                                              status === 'IN_PROGRESS' ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white' :
                                              status === 'CANCELLED' ? 'bg-gradient-to-r from-red-500 to-red-600 text-white' :
                                              'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white'
                                            }`}>
                                              {status === 'COMPLETED' ? 'Completed' :
                                               status === 'CONFIRMED' ? 'Confirmed' :
                                               status === 'IN_PROGRESS' ? 'In Progress' :
                                               status === 'CANCELLED' ? 'Cancelled' :
                                               'Pending'}
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="px-4 py-8 text-center text-sm text-gray-500">
                                Нет туров
                              </div>
                            )
                          ) : (
                            <div className="px-4 py-8 flex items-center justify-center">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>

        {guides.length === 0 && (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
              <User className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">Гиды не найдены</p>
          </div>
        )}
        </div>
      )}

      {/* Tours Tab */}
      {activeTab === 'tours' && (
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
          {bookingsLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600"></div>
              <p className="mt-4 text-gray-600 font-medium">Loading tours...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gradient-to-r from-primary-600 to-primary-700">
                  <tr>
                    <th className="px-4 py-4 text-left text-xs font-bold text-white uppercase">Number</th>
                    <th className="px-4 py-4 text-left text-xs font-bold text-white uppercase">Tour Type</th>
                    <th className="px-4 py-4 text-left text-xs font-bold text-white uppercase">Tour Start</th>
                    <th className="px-4 py-4 text-left text-xs font-bold text-white uppercase">Arrival</th>
                    <th className="px-4 py-4 text-left text-xs font-bold text-white uppercase">Tour End</th>
                    <th className="px-4 py-4 text-left text-xs font-bold text-white uppercase">PAX</th>
                    <th className="px-4 py-4 text-left text-xs font-bold text-white uppercase">Uzbekistan</th>
                    <th className="px-4 py-4 text-left text-xs font-bold text-white uppercase">Turkmenistan</th>
                    <th className="px-4 py-4 text-left text-xs font-bold text-white uppercase">Guide</th>
                    <th className="px-4 py-4 text-left text-xs font-bold text-white uppercase">Status</th>
                    <th className="px-4 py-4 text-right text-xs font-bold text-white uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {allBookings.map((booking, idx) => {
                    const status = getStatusByPax(booking.pax, booking.departureDate, booking.endDate);
                    return (
                      <tr key={booking.id} className="hover:bg-primary-50/30 transition-colors duration-150">
                        <td className="px-4 py-4">
                          <span className="inline-flex items-center justify-center w-8 h-8 bg-primary-100 text-primary-700 rounded-lg font-bold text-xs">
                            {idx + 1}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-sm"
                            style={{ backgroundColor: booking.tourType?.color || '#3B82F6' }}
                          >
                            {booking.bookingNumber || 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-gray-700 font-medium">{format(new Date(booking.departureDate), 'dd.MM.yyyy')}</td>
                        <td className="px-4 py-4 text-gray-700 font-medium">{format(new Date(booking.arrivalDate), 'dd.MM.yyyy')}</td>
                        <td className="px-4 py-4 text-gray-700 font-medium">{format(new Date(booking.endDate), 'dd.MM.yyyy')}</td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1.5">
                            <User className="w-4 h-4 text-primary-500" />
                            <span className="font-bold text-gray-900">{booking.pax || 0}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-gray-700 font-medium">{booking.paxUzbekistan || 0}</td>
                        <td className="px-4 py-4 text-gray-700 font-medium">{booking.paxTurkmenistan || 0}</td>
                        <td className="px-4 py-4 text-gray-700 font-semibold">{booking.guide?.name || '—'}</td>
                        <td className="px-4 py-4">
                          <span className={`px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm ${
                            status === 'COMPLETED' ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white' :
                            status === 'CONFIRMED' ? 'bg-gradient-to-r from-green-500 to-green-600 text-white' :
                            status === 'IN_PROGRESS' ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white' :
                            status === 'CANCELLED' ? 'bg-gradient-to-r from-red-500 to-red-600 text-white' :
                            'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white'
                          }`}>
                            {status === 'COMPLETED' ? 'Completed' :
                             status === 'CONFIRMED' ? 'Confirmed' :
                             status === 'IN_PROGRESS' ? 'In Progress' :
                             status === 'CANCELLED' ? 'Cancelled' :
                             'Pending'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleEditBooking(booking.id)}
                              className="p-2 text-gray-400 hover:text-white hover:bg-primary-500 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => handleDeleteBooking(booking)}
                                className="p-2 text-gray-400 hover:text-white hover:bg-red-500 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {allBookings.length === 0 && (
                <div className="text-center py-16">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                    <FileText className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 font-medium">Туры не найдены</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Payment Tab */}
      {activeTab === 'payment' && (
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-green-600 to-green-700">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase">Name</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase">Half Price</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase">Price</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-white uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {guides.filter(g => g.isActive).map((guide) => (
                  <tr key={guide.id} className="hover:bg-green-50/50 transition-colors duration-150">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                          <User className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{guide.name}</p>
                          {(guide.firstName || guide.lastName) && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {guide.firstName} {guide.lastName}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg font-bold text-sm shadow-sm">
                        <CreditCard className="w-4 h-4" />
                        $55
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-bold text-sm shadow-md">
                        <CreditCard className="w-4 h-4" />
                        $110
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          className="p-2 text-gray-400 hover:text-white hover:bg-primary-500 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          className="p-2 text-gray-400 hover:text-white hover:bg-red-500 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {guides.filter(g => g.isActive).length === 0 && (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                  <User className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500 font-medium">Активные гиды не найдены</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* City Payment Tab */}
      {activeTab === 'city-payment' && (
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-purple-600 to-purple-700">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase">Nomer</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase">Name</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase">City</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase">Price (USD)</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-white uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {guides.filter(g => g.isActive).map((guide, index) => (
                  <tr key={guide.id} className="hover:bg-purple-50/50 transition-colors duration-150">
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-purple-100 text-purple-700 rounded-lg font-bold text-sm">
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                          <User className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{guide.name}</p>
                          {(guide.firstName || guide.lastName) && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {guide.firstName} {guide.lastName}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg font-medium">
                        <MapPin className="w-4 h-4" />
                        —
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg font-bold text-sm shadow-md">
                        <CreditCard className="w-4 h-4" />
                        $0
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          className="p-2 text-gray-400 hover:text-white hover:bg-primary-500 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          className="p-2 text-gray-400 hover:text-white hover:bg-red-500 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {guides.filter(g => g.isActive).length === 0 && (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                  <User className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500 font-medium">Активные гиды не найдены</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingGuide ? 'Редактировать гида' : 'Новый гид'}
              </h2>
              <button onClick={closeModal} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Basic Info */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Основная информация
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Отображаемое имя *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      placeholder="Zokir"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Имя</label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Фамилия</label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Дата рождения</label>
                    <input
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Телефон</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      placeholder="+998901234567"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Адрес</label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
              </div>

              {/* Passport Info - Admin Only */}
              {isAdmin && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Паспортные данные
                    <span className="text-xs text-red-500">(конфиденциально)</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Номер паспорта</label>
                      <input
                        type="text"
                        value={formData.passportNumber}
                        onChange={(e) => setFormData({ ...formData, passportNumber: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        placeholder="AA1234567"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Кем выдан</label>
                      <input
                        type="text"
                        value={formData.passportIssuedBy}
                        onChange={(e) => setFormData({ ...formData, passportIssuedBy: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Дата выдачи</label>
                      <input
                        type="date"
                        value={formData.passportIssueDate}
                        onChange={(e) => setFormData({ ...formData, passportIssueDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Срок действия</label>
                      <input
                        type="date"
                        value={formData.passportExpiryDate}
                        onChange={(e) => setFormData({ ...formData, passportExpiryDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Bank Info - Admin Only */}
              {isAdmin && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Банковские данные
                    <span className="text-xs text-red-500">(конфиденциально)</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Номер счёта</label>
                      <input
                        type="text"
                        value={formData.bankAccountNumber}
                        onChange={(e) => setFormData({ ...formData, bankAccountNumber: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Номер карты</label>
                      <input
                        type="text"
                        value={formData.bankCardNumber}
                        onChange={(e) => setFormData({ ...formData, bankCardNumber: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        placeholder="8600 1234 5678 9012"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Название банка</label>
                      <input
                        type="text"
                        value={formData.bankName}
                        onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        placeholder="Kapitalbank, Hamkorbank..."
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Примечания</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="Дополнительная информация..."
                />
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
