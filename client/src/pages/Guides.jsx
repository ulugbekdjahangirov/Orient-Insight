import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { guidesApi, bookingsApi } from '../services/api';
import { useAuth } from '../store/AuthContext';
import { useIsMobile } from '../hooks/useMediaQuery';
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
  MoreVertical,
  Info,
  DollarSign
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
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();
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

  // Get active tab from URL or default to 'information'
  const activeTab = searchParams.get('tab') || 'information';

  // Function to change tab and update URL
  const handleTabChange = (tab) => {
    setSearchParams({ tab });
  };
  const [allBookings, setAllBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null); // ID of guide being edited in Payment tab
  const [paymentFormData, setPaymentFormData] = useState({ dayRate: 0, halfDayRate: 0 });
  const [editingCityPayment, setEditingCityPayment] = useState(null); // ID of guide being edited in City Payment tab
  const [cityPaymentFormData, setCityPaymentFormData] = useState({ city: '', cityRate: 0 });

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
      mfo: '',
      dayRate: 110,
      halfDayRate: 55,
      city: '',
      cityRate: 0,
      notes: '',
      telegramChatId: ''
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
        mfo: guide.mfo || '',
        telegramChatId: guide.telegramChatId || '',
        dayRate: guide.dayRate ?? 110,
        halfDayRate: guide.halfDayRate ?? 55,
        city: guide.city || '',
        cityRate: guide.cityRate ?? 0,
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

  const handleEditPayment = (guide) => {
    console.log('✏️ [EDIT] Starting edit mode for guide:', guide.id, guide.name);
    console.log('✏️ [EDIT] Current rates:', {
      dayRate: guide.dayRate,
      halfDayRate: guide.halfDayRate
    });

    setEditingPayment(guide.id);
    setPaymentFormData({
      dayRate: guide.dayRate ?? 110,
      halfDayRate: guide.halfDayRate ?? 55
    });

    console.log('✏️ [EDIT] Form data set to:', {
      dayRate: guide.dayRate ?? 110,
      halfDayRate: guide.halfDayRate ?? 55
    });
  };

  const handleSavePayment = async (guideId) => {
    try {
      console.log('🔵 [SAVE] Starting save operation');
      console.log('🔵 [SAVE] Guide ID:', guideId);
      console.log('🔵 [SAVE] Payment form data:', paymentFormData);
      console.log('🔵 [SAVE] Data types:', {
        dayRate: typeof paymentFormData.dayRate,
        halfDayRate: typeof paymentFormData.halfDayRate
      });

      const response = await guidesApi.update(guideId, paymentFormData);

      console.log('🟢 [SAVE] Response received:', response);
      console.log('🟢 [SAVE] Updated guide data:', response.data?.guide);

      toast.success('Ставки оплаты обновлены');
      setEditingPayment(null);

      console.log('🔵 [SAVE] Reloading guides...');
      await loadGuides();
      console.log('🟢 [SAVE] Guides reloaded successfully');
    } catch (error) {
      console.error('🔴 [SAVE] Error occurred:', error);
      console.error('🔴 [SAVE] Error response:', error.response);
      console.error('🔴 [SAVE] Error data:', error.response?.data);
      console.error('🔴 [SAVE] Error status:', error.response?.status);
      toast.error(error.response?.data?.error || 'Ошибка обновления ставок оплаты');
    }
  };

  const handleCancelPaymentEdit = () => {
    setEditingPayment(null);
    setPaymentFormData({ dayRate: 0, halfDayRate: 0 });
  };

  const handleEditCityPayment = (guide) => {
    console.log('✏️ [CITY EDIT] Starting edit mode for guide:', guide.id, guide.name);
    console.log('✏️ [CITY EDIT] Current city rate:', guide.cityRate);

    setEditingCityPayment(guide.id);
    setCityPaymentFormData({
      city: guide.city || '',
      cityRate: guide.cityRate ?? 0
    });

    console.log('✏️ [CITY EDIT] Form data set to:', {
      city: guide.city || '',
      cityRate: guide.cityRate ?? 0
    });
  };

  const handleSaveCityPayment = async (guideId) => {
    try {
      console.log('🔵 [CITY SAVE] Starting save operation');
      console.log('🔵 [CITY SAVE] Guide ID:', guideId);
      console.log('🔵 [CITY SAVE] City payment form data:', cityPaymentFormData);

      const response = await guidesApi.update(guideId, cityPaymentFormData);

      console.log('🟢 [CITY SAVE] Response received:', response);
      console.log('🟢 [CITY SAVE] Updated guide data:', response.data?.guide);

      toast.success('Городская ставка обновлена');
      setEditingCityPayment(null);

      console.log('🔵 [CITY SAVE] Reloading guides...');
      await loadGuides();
      console.log('🟢 [CITY SAVE] Guides reloaded successfully');
    } catch (error) {
      console.error('🔴 [CITY SAVE] Error occurred:', error);
      console.error('🔴 [CITY SAVE] Error response:', error.response);
      console.error('🔴 [CITY SAVE] Error data:', error.response?.data);
      toast.error(error.response?.data?.error || 'Ошибка обновления городской ставки');
    }
  };

  const handleCancelCityPaymentEdit = () => {
    setEditingCityPayment(null);
    setCityPaymentFormData({ city: '', cityRate: 0 });
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-3 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden bg-white rounded-2xl md:rounded-3xl shadow-2xl border-2 border-primary-100">
        <div className="absolute inset-0 bg-gradient-to-r from-primary-500/10 via-indigo-500/5 to-purple-500/10"></div>
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-primary-400/20 to-indigo-400/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-gradient-to-br from-purple-400/20 to-primary-400/20 rounded-full blur-3xl"></div>

        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 p-4 md:p-8">
          <div className="flex items-center gap-3 md:gap-6">
            <div className="relative">
              <div className="w-14 h-14 md:w-20 md:h-20 bg-gradient-to-br from-primary-500 via-indigo-500 to-purple-600 rounded-2xl md:rounded-3xl shadow-2xl shadow-primary-500/40 flex items-center justify-center transform hover:scale-110 transition-all duration-300">
                <User className="w-7 h-7 md:w-10 md:h-10 text-white" />
              </div>
              <div className="absolute -bottom-1 md:-bottom-2 -right-1 md:-right-2 w-6 h-6 md:w-8 md:h-8 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                <span className="text-[10px] md:text-xs font-bold text-white">{guides.length}</span>
              </div>
            </div>
            <div>
              <h1 className="text-2xl md:text-4xl font-black bg-gradient-to-r from-primary-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent mb-1 md:mb-2">
                Tour Guides
              </h1>
              <p className="text-slate-600 text-xs md:text-base font-semibold">Professional Guide Management</p>
            </div>
          </div>

          {isAdmin && (
            <button
              onClick={() => openModal()}
              className="inline-flex items-center justify-center gap-2 px-4 md:px-6 py-2.5 md:py-3 bg-gradient-to-r from-primary-500 via-indigo-500 to-purple-500 hover:from-primary-600 hover:via-indigo-600 hover:to-purple-600 text-white rounded-xl md:rounded-2xl shadow-2xl hover:shadow-primary-500/40 hover:-translate-y-1 transition-all duration-300 font-bold text-sm md:text-base min-h-[44px] w-full sm:w-auto"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Добавить гида</span>
              <span className="sm:hidden">Добавить</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl md:rounded-2xl shadow-lg border-2 border-gray-200 p-1.5 md:p-2">
        <div className="flex gap-1.5 md:gap-2 overflow-x-auto">
          <button
            onClick={() => handleTabChange('information')}
            className={`flex-1 min-w-[110px] px-3 md:px-6 py-3 md:py-3.5 font-bold text-sm md:text-base rounded-xl transition-all duration-300 whitespace-nowrap flex items-center justify-center gap-2 ${
              activeTab === 'information'
                ? 'bg-gradient-to-r from-primary-600 via-primary-500 to-indigo-600 text-white shadow-xl shadow-primary-500/40 scale-105 border-2 border-primary-300'
                : 'text-gray-600 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:text-gray-900 hover:shadow-md hover:scale-102'
            }`}
          >
            <Info className={`w-4 h-4 md:w-5 md:h-5 ${activeTab === 'information' ? 'animate-pulse' : ''}`} />
            <span>Information</span>
          </button>
          <button
            onClick={() => handleTabChange('tours')}
            className={`flex-1 min-w-[100px] px-3 md:px-6 py-3 md:py-3.5 font-bold text-sm md:text-base rounded-xl transition-all duration-300 whitespace-nowrap flex items-center justify-center gap-2 ${
              activeTab === 'tours'
                ? 'bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-600 text-white shadow-xl shadow-blue-500/40 scale-105 border-2 border-blue-300'
                : 'text-gray-600 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:text-gray-900 hover:shadow-md hover:scale-102'
            }`}
          >
            <Calendar className={`w-4 h-4 md:w-5 md:h-5 ${activeTab === 'tours' ? 'animate-pulse' : ''}`} />
            <span>Tours</span>
          </button>
          <button
            onClick={() => handleTabChange('payment')}
            className={`flex-1 min-w-[100px] px-3 md:px-6 py-3 md:py-3.5 font-bold text-sm md:text-base rounded-xl transition-all duration-300 whitespace-nowrap flex items-center justify-center gap-2 ${
              activeTab === 'payment'
                ? 'bg-gradient-to-r from-green-600 via-green-500 to-emerald-600 text-white shadow-xl shadow-green-500/40 scale-105 border-2 border-green-300'
                : 'text-gray-600 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:text-gray-900 hover:shadow-md hover:scale-102'
            }`}
          >
            <DollarSign className={`w-4 h-4 md:w-5 md:h-5 ${activeTab === 'payment' ? 'animate-pulse' : ''}`} />
            <span>Payment</span>
          </button>
          <button
            onClick={() => handleTabChange('city-payment')}
            className={`flex-1 min-w-[120px] px-3 md:px-6 py-3 md:py-3.5 font-bold text-sm md:text-base rounded-xl transition-all duration-300 whitespace-nowrap flex items-center justify-center gap-2 ${
              activeTab === 'city-payment'
                ? 'bg-gradient-to-r from-purple-600 via-purple-500 to-violet-600 text-white shadow-xl shadow-purple-500/40 scale-105 border-2 border-purple-300'
                : 'text-gray-600 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:text-gray-900 hover:shadow-md hover:scale-102'
            }`}
          >
            <MapPin className={`w-4 h-4 md:w-5 md:h-5 ${activeTab === 'city-payment' ? 'animate-pulse' : ''}`} />
            <span>City Payment</span>
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
        <div className="relative bg-white rounded-2xl md:rounded-3xl shadow-2xl border-2 border-primary-100 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-50/30 via-transparent to-indigo-50/30 pointer-events-none"></div>
        <div className="relative overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gradient-to-r from-primary-600 via-primary-500 to-indigo-600 relative">
            <tr>
              <th className="px-3 md:px-6 py-4 md:py-5 text-left text-xs font-black text-white uppercase tracking-wider w-8 border-r border-primary-400/30"></th>
              <th className="px-3 md:px-6 py-4 md:py-5 text-left text-xs font-black text-white uppercase tracking-wider border-r border-primary-400/30">Гид</th>
              <th className="hidden lg:table-cell px-6 py-5 text-left text-xs font-black text-white uppercase tracking-wider border-r border-primary-400/30">Дата рождения</th>
              <th className="hidden md:table-cell px-6 py-5 text-left text-xs font-black text-white uppercase tracking-wider border-r border-primary-400/30">Контакты</th>
              <th className="hidden lg:table-cell px-6 py-5 text-left text-xs font-black text-white uppercase tracking-wider border-r border-primary-400/30">Паспорт</th>
              <th className="hidden xl:table-cell px-6 py-5 text-left text-xs font-black text-white uppercase tracking-wider border-r border-primary-400/30">Срок действия</th>
              {isAdmin && (
                <>
                  <th className="hidden xl:table-cell px-6 py-5 text-left text-xs font-black text-white uppercase tracking-wider border-r border-primary-400/30">Счет</th>
                  <th className="hidden xl:table-cell px-6 py-5 text-left text-xs font-black text-white uppercase tracking-wider border-r border-primary-400/30">Банк</th>
                </>
              )}
              <th className="px-3 md:px-6 py-4 md:py-5 text-left text-xs font-black text-white uppercase tracking-wider border-r border-primary-400/30">Туры</th>
              <th className="px-3 md:px-6 py-4 md:py-5 text-left text-xs font-black text-white uppercase tracking-wider border-r border-primary-400/30">Статус</th>
              <th className="px-3 md:px-6 py-4 md:py-5 text-right text-xs font-black text-white uppercase tracking-wider">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {guides.map((guide, idx) => (
              <>
                <tr key={guide.id} className={!guide.isActive ? 'bg-gray-50/70 opacity-70' : `hover:bg-gradient-to-r hover:from-primary-50/80 hover:via-indigo-50/50 hover:to-purple-50/30 transition-all duration-300 hover:shadow-md ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                  <td className="px-3 md:px-6 py-4">
                    <button
                      onClick={() => toggleTours(guide.id)}
                      className="p-2 md:p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-100 rounded-lg transition-all duration-200"
                    >
                      {expandedTours === guide.id ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                  </td>
                  <td className="px-3 md:px-6 py-4">
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg md:rounded-xl flex items-center justify-center shadow-lg">
                        <User className="w-5 h-5 md:w-6 md:h-6 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm md:text-base text-gray-900">{guide.name}</p>
                        {(guide.firstName || guide.lastName) && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {guide.firstName} {guide.lastName}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="hidden md:table-cell px-6 py-4">
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
                  <td className="px-3 md:px-6 py-4">
                    <div className="space-y-1.5 text-xs md:text-sm">
                      {guide.phone && (
                        <div className="flex items-center gap-1 md:gap-2 text-gray-700">
                          <Phone className="w-4 h-4 text-primary-500" />
                          <span className="font-medium">{guide.phone}</span>
                        </div>
                      )}
                      {guide.email && (
                        <div className="flex items-center gap-1 md:gap-2 text-gray-700">
                          <Mail className="w-4 h-4 text-primary-500" />
                          <span className="font-medium truncate">{guide.email}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="hidden lg:table-cell px-6 py-4">
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
                      {guide.passportIssueDate && (
                        <div className="text-xs text-gray-600 font-medium">
                          до {format(new Date(guide.passportIssueDate), 'dd.MM.yyyy')}
                        </div>
                      )}
                      {!guide.passportNumber && <span className="text-xs text-gray-400">—</span>}
                    </div>
                  </td>
                  <td className="hidden lg:table-cell px-6 py-4">
                    <div className="space-y-2">
                      {guide.passportExpiryDate ? (
                        <div className="flex flex-col gap-2">
                          <span className="text-xs text-gray-700 font-semibold">
                            {format(new Date(guide.passportExpiryDate), 'dd.MM.yyyy')}
                          </span>
                          {getPassportStatusBadge(guide.passportStatus)}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </div>
                  </td>
                  {isAdmin && (
                    <>
                      <td className="hidden xl:table-cell px-6 py-4">
                        <div className="space-y-1.5 text-xs">
                          {guide.bankAccountNumber && (
                            <div className="flex items-center gap-2 text-gray-700">
                              <CreditCard className="w-4 h-4 text-green-500" />
                              <span className="font-medium">{guide.bankAccountNumber}</span>
                            </div>
                          )}
                          {guide.mfo && (
                            <div className="text-gray-600 font-medium ml-6">
                              МФО: {guide.mfo}
                            </div>
                          )}
                          {!guide.bankAccountNumber && !guide.mfo && (
                            <span className="text-gray-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="hidden xl:table-cell px-6 py-4">
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
                    </>
                  )}
                  <td className="hidden md:table-cell px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg text-xs font-bold shadow-sm">
                      <FileText className="w-3.5 h-3.5" />
                      {guide._count?.bookings || 0} туров
                    </span>
                  </td>
                  <td className="px-3 md:px-6 py-4">
                    <span className={`inline-flex items-center px-2 md:px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm ${
                      guide.isActive
                        ? 'bg-gradient-to-r from-green-500 to-green-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}>
                      {guide.isActive ? 'Активен' : 'Неактивен'}
                    </span>
                  </td>
                  <td className="px-3 md:px-6 py-4">
                    <div className="flex items-center justify-end gap-1 md:gap-2">
                      <button
                        onClick={() => openModal(guide)}
                        className="p-3 md:p-2 text-gray-400 hover:text-white hover:bg-primary-500 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center"
                        title="Редактировать"
                      >
                        <Edit className="w-5 h-5 md:w-4 md:h-4" />
                      </button>
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => toggleActive(guide)}
                            className="p-3 md:p-2 text-gray-400 hover:text-white hover:bg-yellow-500 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center"
                            title={guide.isActive ? 'Деактивировать' : 'Активировать'}
                          >
                            <Shield className="w-5 h-5 md:w-4 md:h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(guide)}
                            className="p-3 md:p-2 text-gray-400 hover:text-white hover:bg-red-500 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center"
                            title="Удалить"
                          >
                            <Trash2 className="w-5 h-5 md:w-4 md:h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
                {/* Expanded Tours Table */}
                {expandedTours === guide.id && (
                  <tr key={`${guide.id}-tours`}>
                    <td colSpan={isAdmin ? 11 : 9} className="p-0 bg-gradient-to-br from-primary-50 via-indigo-50 to-purple-50">
                      <div className="p-4 md:p-6">
                        <div className="relative bg-white rounded-xl md:rounded-2xl border-2 border-primary-200 overflow-hidden shadow-2xl">
                          <div className="absolute inset-0 bg-gradient-to-br from-primary-50/20 via-transparent to-indigo-50/20 pointer-events-none"></div>
                          {guideBookings[guide.id] ? (
                            guideBookings[guide.id].length > 0 ? (
                              <div className="relative overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead className="bg-gradient-to-r from-primary-600 via-indigo-600 to-purple-600 relative">
                                    <tr>
                                      <th className="px-4 py-4 text-left text-xs font-black text-white uppercase tracking-wider border-r border-primary-400/30">#</th>
                                      <th className="px-4 py-4 text-left text-xs font-black text-white uppercase tracking-wider border-r border-primary-400/30">Tour Type</th>
                                      <th className="px-4 py-4 text-left text-xs font-black text-white uppercase tracking-wider border-r border-primary-400/30">Tour Start</th>
                                      <th className="px-4 py-4 text-left text-xs font-black text-white uppercase tracking-wider border-r border-primary-400/30">Arrival</th>
                                      <th className="px-4 py-4 text-left text-xs font-black text-white uppercase tracking-wider border-r border-primary-400/30">Tour End</th>
                                      <th className="px-4 py-4 text-left text-xs font-black text-white uppercase tracking-wider border-r border-primary-400/30">PAX</th>
                                      <th className="px-4 py-4 text-left text-xs font-black text-white uppercase tracking-wider border-r border-primary-400/30">Uzbekistan</th>
                                      <th className="px-4 py-4 text-left text-xs font-black text-white uppercase tracking-wider border-r border-primary-400/30">Turkmenistan</th>
                                      <th className="px-4 py-4 text-left text-xs font-black text-white uppercase tracking-wider border-r border-primary-400/30">Guide</th>
                                      <th className="px-4 py-4 text-left text-xs font-black text-white uppercase tracking-wider">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-200">
                                    {guideBookings[guide.id].map((booking, idx) => {
                                      const status = getStatusByPax(booking.pax, booking.departureDate, booking.endDate);
                                      return (
                                        <tr key={booking.id} className={`hover:bg-gradient-to-r hover:from-primary-50/80 hover:via-indigo-50/50 hover:to-purple-50/30 transition-all duration-300 hover:shadow-sm ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
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
        </div>

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
        <div className="relative bg-white rounded-2xl md:rounded-3xl shadow-2xl border-2 border-blue-100 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-transparent to-cyan-50/30 pointer-events-none"></div>
          {bookingsLoading ? (
            <div className="relative flex flex-col items-center justify-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600"></div>
              <p className="mt-4 text-gray-600 font-semibold">Loading tours...</p>
            </div>
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-600 relative">
                  <tr>
                    <th className="px-3 md:px-4 py-4 md:py-5 text-left text-xs font-black text-white uppercase tracking-wider border-r border-blue-400/30">Number</th>
                    <th className="px-3 md:px-4 py-4 md:py-5 text-left text-xs font-black text-white uppercase tracking-wider border-r border-blue-400/30">Tour Type</th>
                    <th className="px-3 md:px-4 py-4 md:py-5 text-left text-xs font-black text-white uppercase tracking-wider border-r border-blue-400/30">Tour Start</th>
                    <th className="hidden md:table-cell px-4 py-5 text-left text-xs font-black text-white uppercase tracking-wider border-r border-blue-400/30">Arrival</th>
                    <th className="hidden lg:table-cell px-4 py-5 text-left text-xs font-black text-white uppercase tracking-wider border-r border-blue-400/30">Tour End</th>
                    <th className="px-3 md:px-4 py-4 md:py-5 text-left text-xs font-black text-white uppercase tracking-wider border-r border-blue-400/30">PAX</th>
                    <th className="hidden lg:table-cell px-4 py-5 text-left text-xs font-black text-white uppercase tracking-wider border-r border-blue-400/30">Uzbekistan</th>
                    <th className="hidden lg:table-cell px-4 py-5 text-left text-xs font-black text-white uppercase tracking-wider border-r border-blue-400/30">Turkmenistan</th>
                    <th className="hidden md:table-cell px-4 py-5 text-left text-xs font-black text-white uppercase tracking-wider border-r border-blue-400/30">Guide</th>
                    <th className="px-3 md:px-4 py-4 md:py-5 text-left text-xs font-black text-white uppercase tracking-wider border-r border-blue-400/30">Status</th>
                    <th className="px-3 md:px-4 py-4 md:py-5 text-right text-xs font-black text-white uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {allBookings.map((booking, idx) => {
                    const status = getStatusByPax(booking.pax, booking.departureDate, booking.endDate);
                    return (
                      <tr key={booking.id} className={`hover:bg-gradient-to-r hover:from-blue-50/80 hover:via-cyan-50/50 hover:to-sky-50/30 transition-all duration-300 hover:shadow-md ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                        <td className="px-3 md:px-4 py-3 md:py-4">
                          <span className="inline-flex items-center justify-center w-7 h-7 md:w-8 md:h-8 bg-primary-100 text-primary-700 rounded-lg font-bold text-xs">
                            {idx + 1}
                          </span>
                        </td>
                        <td className="px-3 md:px-4 py-3 md:py-4">
                          <span
                            className="px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-xs font-bold text-white shadow-sm whitespace-nowrap"
                            style={{ backgroundColor: booking.tourType?.color || '#3B82F6' }}
                          >
                            {booking.bookingNumber || 'N/A'}
                          </span>
                        </td>
                        <td className="px-3 md:px-4 py-3 md:py-4 text-gray-700 font-medium text-xs md:text-sm">{format(new Date(booking.departureDate), 'dd.MM.yyyy')}</td>
                        <td className="hidden md:table-cell px-4 py-4 text-gray-700 font-medium">{format(new Date(booking.arrivalDate), 'dd.MM.yyyy')}</td>
                        <td className="hidden lg:table-cell px-4 py-4 text-gray-700 font-medium">{format(new Date(booking.endDate), 'dd.MM.yyyy')}</td>
                        <td className="px-3 md:px-4 py-3 md:py-4">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3 h-3 md:w-4 md:h-4 text-primary-500" />
                            <span className="font-bold text-gray-900 text-xs md:text-sm">{booking.pax || 0}</span>
                          </div>
                        </td>
                        <td className="hidden lg:table-cell px-4 py-4 text-gray-700 font-medium">{booking.paxUzbekistan || 0}</td>
                        <td className="hidden lg:table-cell px-4 py-4 text-gray-700 font-medium">{booking.paxTurkmenistan || 0}</td>
                        <td className="hidden md:table-cell px-4 py-4 text-gray-700 font-semibold">{booking.guide?.name || '—'}</td>
                        <td className="px-3 md:px-4 py-3 md:py-4">
                          <span className={`px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-xs font-bold shadow-sm whitespace-nowrap ${
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
                        <td className="px-3 md:px-4 py-3 md:py-4">
                          <div className="flex items-center justify-end gap-1 md:gap-2">
                            <button
                              onClick={() => handleEditBooking(booking.id)}
                              className="p-2.5 md:p-2 text-gray-400 hover:text-white hover:bg-primary-500 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md min-w-[40px] min-h-[40px] md:min-w-0 md:min-h-0 flex items-center justify-center"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => handleDeleteBooking(booking)}
                                className="p-2.5 md:p-2 text-gray-400 hover:text-white hover:bg-red-500 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md min-w-[40px] min-h-[40px] md:min-w-0 md:min-h-0 flex items-center justify-center"
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
        <div className="relative bg-white rounded-2xl md:rounded-3xl shadow-2xl border-2 border-green-100 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-green-50/30 via-transparent to-emerald-50/30 pointer-events-none"></div>
          <div className="relative overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-green-600 via-green-500 to-emerald-600 relative">
                <tr>
                  <th className="px-3 md:px-6 py-4 md:py-5 text-left text-xs font-black text-white uppercase tracking-wider border-r border-green-400/30">Name</th>
                  <th className="px-3 md:px-6 py-4 md:py-5 text-left text-xs font-black text-white uppercase tracking-wider border-r border-green-400/30">Half Day</th>
                  <th className="px-3 md:px-6 py-4 md:py-5 text-left text-xs font-black text-white uppercase tracking-wider border-r border-green-400/30">Day</th>
                  <th className="px-3 md:px-6 py-4 md:py-5 text-right text-xs font-black text-white uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {guides.filter(g => g.isActive).map((guide, idx) => (
                  <tr key={guide.id} className={`hover:bg-gradient-to-r hover:from-green-50/80 hover:via-emerald-50/50 hover:to-teal-50/30 transition-all duration-300 hover:shadow-md ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                    <td className="px-3 md:px-6 py-3 md:py-4">
                      <div className="flex items-center gap-2 md:gap-3">
                        <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg md:rounded-xl flex items-center justify-center shadow-lg">
                          <User className="w-5 h-5 md:w-6 md:h-6 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm md:text-base text-gray-900">{guide.name}</p>
                          {(guide.firstName || guide.lastName) && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {guide.firstName} {guide.lastName}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4">
                      {editingPayment === guide.id ? (
                        <input
                          type="number"
                          value={paymentFormData.halfDayRate}
                          onChange={(e) => {
                            const rawValue = e.target.value;
                            const newValue = rawValue === '' ? 0 : parseFloat(rawValue);
                            console.log('🟡 [INPUT] Half Day Rate changed:', rawValue, '→', newValue);
                            setPaymentFormData({ ...paymentFormData, halfDayRate: newValue });
                          }}
                          className="w-20 md:w-28 px-2 md:px-3 py-2 md:py-2 text-sm border-2 border-yellow-300 rounded-lg focus:border-yellow-500 focus:outline-none font-bold"
                          step="0.01"
                          min="0"
                        />
                      ) : (
                        <span className="inline-flex items-center gap-1 md:gap-2 px-2 md:px-4 py-1.5 md:py-2 bg-yellow-100 text-yellow-800 rounded-lg font-bold text-xs md:text-sm shadow-sm">
                          <CreditCard className="w-3 h-3 md:w-4 md:h-4" />
                          ${guide.halfDayRate ?? 55}
                        </span>
                      )}
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4">
                      {editingPayment === guide.id ? (
                        <input
                          type="number"
                          value={paymentFormData.dayRate}
                          onChange={(e) => {
                            const rawValue = e.target.value;
                            const newValue = rawValue === '' ? 0 : parseFloat(rawValue);
                            console.log('🟢 [INPUT] Day Rate changed:', rawValue, '→', newValue);
                            setPaymentFormData({ ...paymentFormData, dayRate: newValue });
                          }}
                          className="w-20 md:w-28 px-2 md:px-3 py-2 md:py-2 text-sm border-2 border-green-300 rounded-lg focus:border-green-500 focus:outline-none font-bold"
                          step="0.01"
                          min="0"
                        />
                      ) : (
                        <span className="inline-flex items-center gap-1 md:gap-2 px-2 md:px-4 py-1.5 md:py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-bold text-xs md:text-sm shadow-md">
                          <CreditCard className="w-3 h-3 md:w-4 md:h-4" />
                          ${guide.dayRate ?? 110}
                        </span>
                      )}
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4">
                      <div className="flex items-center justify-end gap-1 md:gap-2">
                        {editingPayment === guide.id ? (
                          <>
                            <button
                              onClick={() => handleSavePayment(guide.id)}
                              className="p-2.5 md:p-2 text-gray-400 hover:text-white hover:bg-green-500 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md min-w-[40px] min-h-[40px] md:min-w-0 md:min-h-0 flex items-center justify-center"
                              title="Save"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={handleCancelPaymentEdit}
                              className="p-2.5 md:p-2 text-gray-400 hover:text-white hover:bg-gray-500 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md min-w-[40px] min-h-[40px] md:min-w-0 md:min-h-0 flex items-center justify-center"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleEditPayment(guide)}
                            className="p-2.5 md:p-2 text-gray-400 hover:text-white hover:bg-primary-500 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md min-w-[40px] min-h-[40px] md:min-w-0 md:min-h-0 flex items-center justify-center"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
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
        <div className="relative bg-white rounded-2xl md:rounded-3xl shadow-2xl border-2 border-purple-100 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-50/30 via-transparent to-violet-50/30 pointer-events-none"></div>
          <div className="relative overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-purple-600 via-purple-500 to-violet-600 relative">
                <tr>
                  <th className="px-3 md:px-6 py-4 md:py-5 text-left text-xs font-black text-white uppercase tracking-wider border-r border-purple-400/30">Nomer</th>
                  <th className="px-3 md:px-6 py-4 md:py-5 text-left text-xs font-black text-white uppercase tracking-wider border-r border-purple-400/30">Name</th>
                  <th className="px-3 md:px-6 py-4 md:py-5 text-left text-xs font-black text-white uppercase tracking-wider border-r border-purple-400/30">City</th>
                  <th className="px-3 md:px-6 py-4 md:py-5 text-left text-xs font-black text-white uppercase tracking-wider border-r border-purple-400/30">Price (USD)</th>
                  <th className="px-3 md:px-6 py-4 md:py-5 text-right text-xs font-black text-white uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {guides.filter(g => g.isActive).map((guide, index) => (
                  <tr key={guide.id} className={`hover:bg-gradient-to-r hover:from-purple-50/80 hover:via-violet-50/50 hover:to-fuchsia-50/30 transition-all duration-300 hover:shadow-md ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                    <td className="px-3 md:px-6 py-3 md:py-4">
                      <span className="inline-flex items-center justify-center w-7 h-7 md:w-8 md:h-8 bg-purple-100 text-purple-700 rounded-lg font-bold text-xs md:text-sm">
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4">
                      <div className="flex items-center gap-2 md:gap-3">
                        <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg md:rounded-xl flex items-center justify-center shadow-lg">
                          <User className="w-5 h-5 md:w-6 md:h-6 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm md:text-base text-gray-900">{guide.name}</p>
                          {(guide.firstName || guide.lastName) && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {guide.firstName} {guide.lastName}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4">
                      {editingCityPayment === guide.id ? (
                        <input
                          type="text"
                          value={cityPaymentFormData.city}
                          onChange={(e) => {
                            const newValue = e.target.value;
                            console.log('🟣 [CITY INPUT] City changed:', newValue);
                            setCityPaymentFormData({ ...cityPaymentFormData, city: newValue });
                          }}
                          className="w-32 md:w-40 px-2 md:px-3 py-2 text-sm border-2 border-purple-300 rounded-lg focus:border-purple-500 focus:outline-none font-medium"
                          placeholder="Город"
                        />
                      ) : (
                        <span className="inline-flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 bg-gray-100 text-gray-600 rounded-lg font-medium text-xs md:text-sm">
                          <MapPin className="w-3 h-3 md:w-4 md:h-4" />
                          {guide.city || '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4">
                      {editingCityPayment === guide.id ? (
                        <input
                          type="number"
                          value={cityPaymentFormData.cityRate}
                          onChange={(e) => {
                            const rawValue = e.target.value;
                            const newValue = rawValue === '' ? 0 : parseFloat(rawValue);
                            console.log('🟣 [CITY INPUT] City Rate changed:', rawValue, '→', newValue);
                            setCityPaymentFormData({ ...cityPaymentFormData, cityRate: newValue });
                          }}
                          className="w-20 md:w-28 px-2 md:px-3 py-2 text-sm border-2 border-purple-300 rounded-lg focus:border-purple-500 focus:outline-none font-bold"
                          step="0.01"
                          min="0"
                          placeholder="0"
                        />
                      ) : (
                        <span className="inline-flex items-center gap-1 md:gap-2 px-2 md:px-4 py-1.5 md:py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg font-bold text-xs md:text-sm shadow-md">
                          <CreditCard className="w-3 h-3 md:w-4 md:h-4" />
                          ${guide.cityRate ?? 0}
                        </span>
                      )}
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4">
                      <div className="flex items-center justify-end gap-1 md:gap-2">
                        {editingCityPayment === guide.id ? (
                          <>
                            <button
                              onClick={() => handleSaveCityPayment(guide.id)}
                              className="p-2.5 md:p-2 text-gray-400 hover:text-white hover:bg-green-500 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md min-w-[40px] min-h-[40px] md:min-w-0 md:min-h-0 flex items-center justify-center"
                              title="Save"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={handleCancelCityPaymentEdit}
                              className="p-2.5 md:p-2 text-gray-400 hover:text-white hover:bg-gray-500 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md min-w-[40px] min-h-[40px] md:min-w-0 md:min-h-0 flex items-center justify-center"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleEditCityPayment(guide)}
                            className="p-2.5 md:p-2 text-gray-400 hover:text-white hover:bg-primary-500 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md min-w-[40px] min-h-[40px] md:min-w-0 md:min-h-0 flex items-center justify-center"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 md:p-4 overflow-y-auto">
          <div className="bg-white rounded-lg md:rounded-xl shadow-xl w-full max-w-full md:max-w-2xl my-4 md:my-8">
            <div className="flex items-center justify-between p-3 md:p-4 border-b border-gray-200">
              <h2 className="text-base md:text-lg font-semibold text-gray-900">
                {editingGuide ? 'Редактировать гида' : 'Новый гид'}
              </h2>
              <button onClick={closeModal} className="p-2 md:p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 md:p-4 space-y-6 max-h-[75vh] md:max-h-[70vh] overflow-y-auto">
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
                      className="w-full px-3 py-3 md:py-2 text-base md:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      placeholder="Zokir"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Имя</label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="w-full px-3 py-3 md:py-2 text-base md:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Telegram Chat ID</label>
                    <input
                      type="text"
                      value={formData.telegramChatId}
                      onChange={(e) => setFormData({ ...formData, telegramChatId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 font-mono"
                      placeholder="-123456789"
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

              {/* Payment Rates */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Ставки оплаты
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Полный день (USD)</label>
                    <input
                      type="number"
                      value={formData.dayRate}
                      onChange={(e) => {
                        const rawValue = e.target.value;
                        const newValue = rawValue === '' ? 0 : parseFloat(rawValue);
                        setFormData({ ...formData, dayRate: newValue });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      placeholder="110"
                      step="0.01"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Полдня (USD)</label>
                    <input
                      type="number"
                      value={formData.halfDayRate}
                      onChange={(e) => {
                        const rawValue = e.target.value;
                        const newValue = rawValue === '' ? 0 : parseFloat(rawValue);
                        setFormData({ ...formData, halfDayRate: newValue });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      placeholder="55"
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>
              </div>

              {/* City Rates */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Городские ставки
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Город</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      placeholder="Самарканд"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ставка (USD)</label>
                    <input
                      type="number"
                      value={formData.cityRate}
                      onChange={(e) => {
                        const rawValue = e.target.value;
                        const newValue = rawValue === '' ? 0 : parseFloat(rawValue);
                        setFormData({ ...formData, cityRate: newValue });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      placeholder="0"
                      step="0.01"
                      min="0"
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
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">МФО</label>
                      <input
                        type="text"
                        value={formData.mfo}
                        onChange={(e) => setFormData({ ...formData, mfo: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        placeholder="00014"
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
                className="px-4 py-3 md:py-2 border border-gray-300 rounded-lg hover:bg-gray-50 min-h-[44px] text-sm md:text-base font-medium"
              >
                Отмена
              </button>
              <button
                onClick={handleSave}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 md:py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 min-h-[44px] text-sm md:text-base font-medium"
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
