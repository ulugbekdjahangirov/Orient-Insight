import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { guidesApi, bookingsApi } from '../services/api';
import { useAuth } from '../store/AuthContext';
import { useYear } from '../context/YearContext';
import { useIsMobile } from '../hooks/useMediaQuery';
import { format, addDays } from 'date-fns';
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
  DollarSign,
  Copy,
  UserCheck
} from 'lucide-react';

// Helper function to calculate booking status
function getBookingStatus(booking) {
  const { status, pax, departureDate, endDate } = booking;
  if (status === 'CANCELLED' || status === 'FINAL_CONFIRMED' || status === 'COMPLETED') return status;
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
  const { selectedYear } = useYear();
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
  const [editingCityPayment, setEditingCityPayment] = useState(null); // ID of guide being edited in City Payment tab
  const [guideDropdown, setGuideDropdown] = useState(null); // booking ID for which guide dropdown is open
  const [guideDropdownPos, setGuideDropdownPos] = useState({ top: 0, left: 0 }); // position for fixed dropdown
  const [cityPaymentFormData, setCityPaymentFormData] = useState({ city: '', cityRate: 0 });
  const [assigningGuides, setAssigningGuides] = useState(false);

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
      telegramChatId: '',
      priority: ''
    };
  }

  useEffect(() => {
    loadGuides();
    loadAlerts();
  }, [selectedYear]);

  const sortGuides = (list) => [...list].sort((a, b) => {
    const pa = a.priority ?? 9999;
    const pb = b.priority ?? 9999;
    if (pa !== pb) return pa - pb;
    return (a.name || '').localeCompare(b.name || '');
  });

  const loadGuides = async () => {
    try {
      const response = await guidesApi.getAll(true, selectedYear);
      const guides = response.data.guides || [];
      if (guides.length === 0) {
        // Fallback: show previous year's guides
        const prevRes = await guidesApi.getAll(true, selectedYear - 1);
        setGuides(sortGuides(prevRes.data.guides || []));
      } else {
        setGuides(sortGuides(guides));
      }
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
        notes: guide.notes || '',
        priority: guide.priority ?? ''
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
        await guidesApi.create({ ...formData, year: selectedYear });
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
      const response = await bookingsApi.getAll({ limit: 500, year: selectedYear });
      setAllBookings(response.data.bookings);
    } catch (error) {
      console.error('Error loading all bookings:', error);
      toast.error('Ошибка загрузки туров');
    } finally {
      setBookingsLoading(false);
    }
  };

  const handleAutoAssignGuides = async () => {
    setAssigningGuides(true);
    try {
      const res = await bookingsApi.autoAssignGuides(selectedYear);
      const { assigned, skipped } = res.data;
      if (assigned === 0) {
        toast(skipped === 0 ? 'Barcha bookinglar allaqachon guide bilan' : `${skipped} ta booking uchun bo'sh guide topilmadi`, { icon: 'ℹ️' });
      } else {
        toast.success(`${assigned} ta booking ga guide tayinlandi${skipped > 0 ? `, ${skipped} ta tayinlanmadi` : ''}`);
      }
      loadAllBookings();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Xatolik yuz berdi');
    } finally {
      setAssigningGuides(false);
    }
  };

  // Load bookings when Tours tab is opened or year changes
  useEffect(() => {
    if (activeTab === 'tours') {
      loadAllBookings();
    }
  }, [activeTab, selectedYear]);

  // Close guide dropdown on outside click
  useEffect(() => {
    if (!guideDropdown) return;
    const handler = () => setGuideDropdown(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [guideDropdown]);

  const handleEditBooking = (bookingId) => {
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

  const handleGuideAssign = async (bookingId, guideId) => {
    try {
      await bookingsApi.update(bookingId, { guideId: guideId || null });
      setAllBookings(prev => prev.map(b => {
        if (b.id !== bookingId) return b;
        const guide = guideId ? guides.find(g => g.id === guideId) : null;
        return { ...b, guide: guide ? { id: guide.id, name: guide.name } : null };
      }));
      setGuideDropdown(null);
      toast.success('Гид обновлён');
    } catch (error) {
      toast.error('Ошибка обновления гида');
    }
  };


  const handleEditCityPayment = (guide) => {
    setEditingCityPayment(guide.id);
    setCityPaymentFormData({
      city: guide.city || '',
      cityRate: guide.cityRate ?? 0
    });
  };

  const handleSaveCityPayment = async (guideId) => {
    try {
      await guidesApi.update(guideId, cityPaymentFormData);
      toast.success('Городская ставка обновлена');
      setEditingCityPayment(null);
      await loadGuides();
    } catch (error) {
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
      <div style={{ minHeight: '100vh', background: '#0f1729', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="animate-spin" style={{ width: '56px', height: '56px', borderRadius: '50%', border: '4px solid rgba(99,102,241,0.2)', borderTopColor: '#6366f1', margin: '0 auto 16px' }} />
          <p style={{ color: 'rgba(165,180,252,0.6)', fontSize: '14px', fontWeight: '600' }}>Yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>

      {/* ━━━━━━━━━━━━━━━━━━ DARK HERO HEADER ━━━━━━━━━━━━━━━━━━ */}
      <div style={{ background: 'linear-gradient(160deg, #0f1729 0%, #1a1040 50%, #0f1729 100%)', position: 'relative', overflow: 'hidden', padding: isMobile ? '16px 14px 18px' : '32px 24px 28px', margin: isMobile ? '8px 8px 0' : '12px 12px 0', borderRadius: isMobile ? '20px' : '28px' }}>
        {/* Glow blobs */}
        <div style={{ position: 'absolute', top: '-80px', right: '-80px', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.5) 0%, transparent 70%)', filter: 'blur(50px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-60px', left: '-60px', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.45) 0%, transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '30%', left: '40%', width: '220px', height: '220px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.2) 0%, transparent 70%)', filter: 'blur(35px)', pointerEvents: 'none' }} />

        <div className="relative max-w-7xl mx-auto">
          {/* Breadcrumb — desktop only */}
          <div className="hidden md:block" style={{ color: 'rgba(165,180,252,0.5)', fontSize: '11px', fontWeight: '700', letterSpacing: '2.5px', marginBottom: '20px', textTransform: 'uppercase' }}>
            ORIENT INSIGHT &nbsp;›&nbsp; TOUR GUIDES
          </div>

          {/* Title row */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 md:gap-6">
              <div className="relative shrink-0">
                <div style={{ width: isMobile ? '52px' : '72px', height: isMobile ? '52px' : '72px', background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', borderRadius: isMobile ? '14px' : '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 50px rgba(99,102,241,0.65), 0 20px 40px rgba(0,0,0,0.3)' }}>
                  <User style={{ width: isMobile ? '26px' : '38px', height: isMobile ? '26px' : '38px', color: 'white' }} />
                </div>
                <div style={{ position: 'absolute', bottom: '-5px', right: '-5px', width: isMobile ? '22px' : '28px', height: isMobile ? '22px' : '28px', background: 'linear-gradient(135deg, #10b981, #059669)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #0f1729', boxShadow: '0 0 18px rgba(16,185,129,0.7)' }}>
                  <span style={{ color: 'white', fontSize: '9px', fontWeight: '900' }}>{guides.length}</span>
                </div>
              </div>
              <div>
                <h1 style={{ fontSize: isMobile ? '24px' : 'clamp(28px, 5vw, 46px)', fontWeight: '900', color: 'white', margin: 0, lineHeight: 1.05, textShadow: '0 0 40px rgba(99,102,241,0.6)' }}>
                  Tour Guides <span style={{ fontSize: isMobile ? '18px' : '28px', color: 'rgba(255,255,255,0.45)', fontWeight: '700' }}>{selectedYear}</span>
                </h1>
                <p style={{ color: 'rgba(165,180,252,0.6)', fontSize: isMobile ? '12px' : '14px', fontWeight: '600', margin: '4px 0 0', letterSpacing: '0.5px' }}>Professional Guide Management</p>
              </div>
            </div>

            {isAdmin && (
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => openModal()}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: isMobile ? '8px 14px' : '10px 24px', background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', color: 'white', borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: isMobile ? '13px' : '14px', fontWeight: '800', boxShadow: '0 0 30px rgba(99,102,241,0.55), 0 8px 20px rgba(0,0,0,0.3)', minHeight: '40px', whiteSpace: 'nowrap' }}
                >
                  <Plus style={{ width: '16px', height: '16px' }} />
                  <span>+ Добавить</span>
                </button>
              </div>
            )}
          </div>

          {/* Stat badges — all 3 on one row on mobile */}
          <div className="flex gap-2 mt-3 md:mt-6">
            {[
              { label: 'Jami',    value: guides.length,                                  color: '#6366f1', rgb: '99,102,241' },
              { label: 'Faol',    value: guides.filter(g => g.isActive).length,          color: '#10b981', rgb: '16,185,129' },
              { label: 'Ogohlantirish', value: alerts.expiredCount + alerts.expiringSoonCount, color: '#f59e0b', rgb: '245,158,11' },
            ].map(({ label, value, color, rgb }) => (
              <div key={label} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: isMobile ? '5px 8px' : '6px 16px', background: `rgba(${rgb}, 0.12)`, border: `1px solid rgba(${rgb}, 0.3)`, borderRadius: '20px', backdropFilter: 'blur(10px)' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}`, flexShrink: 0 }} />
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: isMobile ? '10px' : '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>{label}:</span>
                <span style={{ color: 'white', fontWeight: '900', fontSize: isMobile ? '13px' : '15px' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━ CONTENT AREA ━━━━━━━━━━━━━━━━━━ */}
      <div className="px-2 md:px-6 pb-20 md:pb-8" style={{ background: '#f1f5f9', paddingTop: '14px', minHeight: 'calc(100vh - 220px)' }}>

      {/* Tabs */}
      <div style={{ background: 'white', borderRadius: '14px', padding: '6px', marginBottom: '14px', boxShadow: '0 4px 20px rgba(0,0,0,0.07)', border: '1px solid rgba(99,102,241,0.1)' }}>
        <div className="grid grid-cols-2 gap-1.5 md:flex md:gap-2">
          {[
            { key: 'information',  label: 'Information',  icon: Info,       grad: 'linear-gradient(135deg,#6366f1,#4f46e5)', shadow: 'rgba(99,102,241,0.45)'  },
            { key: 'tours',        label: 'Tours',        icon: Calendar,   grad: 'linear-gradient(135deg,#3b82f6,#06b6d4)', shadow: 'rgba(59,130,246,0.45)'  },
          ].map(({ key, label, icon: Icon, grad, shadow }) => (
            <button
              key={key}
              onClick={() => handleTabChange(key)}
              style={activeTab === key ? {
                background: grad, color: 'white', borderRadius: '9px', padding: isMobile ? '9px 8px' : '10px 20px',
                fontWeight: '800', fontSize: isMobile ? '12px' : '14px', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                boxShadow: `0 0 25px ${shadow}, 0 4px 15px rgba(0,0,0,0.12)`,
                transform: 'translateY(-1px)', whiteSpace: 'nowrap', transition: 'all 0.3s',
              } : {
                background: 'transparent', color: '#6b7280', borderRadius: '9px', padding: isMobile ? '9px 8px' : '10px 20px',
                fontWeight: '700', fontSize: isMobile ? '12px' : '14px', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                whiteSpace: 'nowrap', transition: 'all 0.3s',
              }}
            >
              <Icon style={{ width: '14px', height: '14px' }} />
              <span>{label}</span>
            </button>
          ))}
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
        {/* MOBILE: guide cards */}
        <div className="md:hidden space-y-2 p-2">
          {guides.map((guide, idx) => (
            <div key={guide.id} className={`rounded-2xl border overflow-hidden ${!guide.isActive ? 'opacity-60 border-gray-200 bg-gray-50' : 'border-indigo-100 bg-white'}`}
              style={{ boxShadow: guide.isActive ? '0 2px 12px rgba(99,102,241,0.08)' : 'none' }}>
              {/* Top gradient strip */}
              {guide.isActive && <div className="h-0.5 bg-gradient-to-r from-primary-400 via-indigo-400 to-purple-400" />}
              {/* Card body */}
              <div onClick={() => openModal(guide)} className="cursor-pointer active:bg-primary-50/60 transition-colors px-3 pt-3 pb-2">
                {/* Row 1: avatar + name + status */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 shrink-0 bg-gradient-to-br from-primary-500 via-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md shadow-primary-200">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 text-sm leading-tight truncate">{guide.name}</p>
                        {(guide.firstName || guide.lastName) && (
                          <p className="text-xs text-gray-500 truncate">{guide.firstName} {guide.lastName}</p>
                        )}
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full shrink-0 ${guide.isActive ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-gray-200 text-gray-500'}`}>
                        {guide.isActive ? 'Актив' : 'Нет'}
                      </span>
                    </div>
                  </div>
                </div>
                {/* Row 2: passport tags — tap to copy */}
                {(guide.dateOfBirth || guide.passportNumber || guide.passportExpiryDate || guide.passportStatus) && (
                  <div className="flex flex-wrap gap-1 mt-2 ml-13">
                    {guide.dateOfBirth && (
                      <span
                        onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(format(new Date(guide.dateOfBirth), 'dd.MM.yyyy')); toast.success('Nusxalandi!', { duration: 1200 }); }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600 active:bg-gray-200 cursor-pointer select-none"
                      >
                        <Calendar className="w-3 h-3 text-gray-400" />
                        {format(new Date(guide.dateOfBirth), 'dd.MM.yyyy')}
                      </span>
                    )}
                    {guide.passportNumber && (
                      <code
                        onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(guide.passportNumber); toast.success('Nusxalandi!', { duration: 1200 }); }}
                        className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-lg font-semibold border border-primary-200 active:bg-primary-100 cursor-pointer select-none"
                      >
                        {guide.passportNumber}
                      </code>
                    )}
                    {guide.passportExpiryDate && (
                      <span
                        onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(format(new Date(guide.passportExpiryDate), 'dd.MM.yyyy')); toast.success('Nusxalandi!', { duration: 1200 }); }}
                        className="text-xs text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded-lg border border-gray-200 active:bg-gray-200 cursor-pointer select-none"
                      >
                        до {format(new Date(guide.passportExpiryDate), 'dd.MM.yyyy')}
                      </span>
                    )}
                    {guide.passportStatus && getPassportStatusBadge(guide.passportStatus)}
                  </div>
                )}
                {/* Row 3: phone */}
                {guide.phone && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-gray-700">
                    <Phone className="w-3.5 h-3.5 text-primary-400 shrink-0" />
                    <span className="font-medium">{guide.phone}</span>
                  </div>
                )}
              </div>
              {/* Action bar */}
              <div className="flex items-center border-t border-gray-100 bg-gray-50/70">
                <button
                  onClick={() => toggleTours(guide.id)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-primary-600 hover:bg-primary-50 transition-all flex-1"
                >
                  {expandedTours === guide.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  <span>Tours ({guide._count?.bookings || 0})</span>
                </button>
                <div className="flex items-center border-l border-gray-200">
                  <button onClick={() => openModal(guide)} className="px-3 py-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-all" title="Редактировать">
                    <Edit className="w-4 h-4" />
                  </button>
                  {isAdmin && (
                    <>
                      <button onClick={() => toggleActive(guide)} className="px-3 py-2 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 transition-all border-l border-gray-200" title={guide.isActive ? 'Деактивировать' : 'Активировать'}>
                        <Shield className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(guide)} className="px-3 py-2 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all border-l border-gray-200" title="Удалить">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
              {/* Expanded tours */}
              {expandedTours === guide.id && (
                <div className="border-t border-gray-100 bg-slate-50 px-2 py-2">
                  {guideBookings[guide.id] ? (
                    guideBookings[guide.id].length > 0 ? (
                      <div className="space-y-1.5">
                        {guideBookings[guide.id].map((booking) => {
                          const status = getBookingStatus(booking);
                          const color = booking.tourType?.color || '#3B82F6';
                          const statusCfg = {
                            COMPLETED:       { bg: 'bg-blue-500',    label: 'Done'  },
                            FINAL_CONFIRMED: { bg: 'bg-emerald-500', label: 'Final' },
                            CONFIRMED:       { bg: 'bg-green-500',   label: 'OK'    },
                            IN_PROGRESS:     { bg: 'bg-purple-500',  label: '...'   },
                            CANCELLED:       { bg: 'bg-red-500',     label: 'X'     },
                          }[status] || { bg: 'bg-yellow-400', label: '?' };
                          const depDate = booking.guideRole === 'second' && booking.tourType?.code === 'ZA'
                            ? format(addDays(new Date(booking.endDate), 4), 'dd.MM.yy')
                            : format(new Date(booking.departureDate), 'dd.MM.yy');
                          return (
                            <div
                              key={booking.id}
                              onClick={() => navigate(`/bookings/${booking.id}`)}
                              className="bg-white rounded-xl flex items-center gap-2.5 px-3 py-2 cursor-pointer active:bg-gray-50 transition-colors"
                              style={{ borderLeft: `3px solid ${color}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
                            >
                              {/* Booking number badge */}
                              <span className="px-2 py-0.5 rounded-lg text-white font-black text-xs shrink-0" style={{ backgroundColor: color }}>
                                {booking.bookingNumber}
                              </span>
                              {/* 2-gid badge */}
                              {booking.guideRole === 'second' && (
                                <span className="text-xs bg-orange-100 text-orange-600 border border-orange-200 px-1.5 py-0.5 rounded-full font-semibold shrink-0">2-gid</span>
                              )}
                              {/* Date */}
                              <span className="text-gray-500 text-xs shrink-0">{depDate}</span>
                              {/* PAX */}
                              <div className="flex items-center gap-1 shrink-0">
                                <User className="w-3 h-3 text-gray-400" />
                                <span className="font-bold text-gray-800 text-xs">{booking.pax || 0}</span>
                              </div>
                              {/* Status */}
                              <span className={`ml-auto px-2.5 py-0.5 rounded-lg text-white text-xs font-black shrink-0 ${statusCfg.bg}`}>
                                {statusCfg.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 text-center py-3">Turlar yo'q</p>
                    )
                  ) : (
                    <div className="flex justify-center py-3">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-200 border-t-primary-600" />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        {/* DESKTOP: table */}
        <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[1100px]">
          <thead>
            <tr style={{ background: 'linear-gradient(135deg, #3730a3 0%, #4f46e5 50%, #6366f1 100%)' }}>
              <th className="w-9 px-3 py-4 text-left"></th>
              <th className="px-3 py-4 text-left text-xs font-black text-white uppercase tracking-wider">ГИД</th>
              <th className="px-3 py-4 text-left text-xs font-black text-white uppercase tracking-wider">ТУГИЛГАН</th>
              <th className="px-3 py-4 text-left text-xs font-black text-white uppercase tracking-wider">TELEGRAM</th>
              <th className="px-3 py-4 text-left text-xs font-black text-white uppercase tracking-wider">ПАСПОРТ №</th>
              <th className="px-3 py-4 text-left text-xs font-black text-white uppercase tracking-wider">BERILGAN</th>
              <th className="px-3 py-4 text-left text-xs font-black text-white uppercase tracking-wider">AMAL QILADI</th>
              <th className="px-3 py-4 text-center text-xs font-black text-white uppercase tracking-wider">PRIORITET</th>
              <th className="px-3 py-4 text-left text-xs font-black text-white uppercase tracking-wider">½ DAY</th>
              <th className="px-3 py-4 text-left text-xs font-black text-white uppercase tracking-wider">DAY</th>
              <th className="px-3 py-4 text-center text-xs font-black text-white uppercase tracking-wider">ТУРЫ</th>
              <th className="px-3 py-4 text-left text-xs font-black text-white uppercase tracking-wider">СТАТУС</th>
              <th className="px-3 py-4 text-right text-xs font-black text-white uppercase tracking-wider">ДЕЙСТВИЯ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {guides.map((guide, idx) => (
              <>
                <tr key={guide.id} className={`group transition-all duration-200 border-b border-slate-100 last:border-0 ${!guide.isActive ? 'opacity-50' : ''} ${idx % 2 === 0 ? 'bg-white hover:bg-indigo-50/30' : 'bg-slate-50/50 hover:bg-indigo-50/30'}`}>
                  {/* Expand */}
                  <td className="px-3 py-4">
                    <button
                      onClick={() => toggleTours(guide.id)}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${expandedTours === guide.id ? 'bg-indigo-100 text-indigo-600' : 'text-gray-300 hover:text-indigo-500 hover:bg-indigo-50'}`}
                    >
                      {expandedTours === guide.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </td>
                  {/* ГИД */}
                  <td className="px-3 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-white text-base font-black shadow-lg" style={{ background: `linear-gradient(135deg, #4f46e5, #7c3aed)` }}>
                        {guide.name ? guide.name.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-gray-900 leading-tight truncate">{guide.name}</p>
                        {(guide.firstName || guide.lastName) && (
                          <p className="text-xs text-gray-400 truncate mt-0.5">{guide.firstName} {guide.lastName}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  {/* ТУГИЛГАН */}
                  <td className="px-3 py-4">
                    {guide.dateOfBirth ? (
                      <span onClick={() => { navigator.clipboard.writeText(format(new Date(guide.dateOfBirth), 'dd.MM.yyyy')); toast.success('Nusxalandi'); }} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-violet-50 text-violet-700 border border-violet-100 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-violet-100 hover:border-violet-300 transition-colors select-none">
                        <Calendar className="w-3.5 h-3.5 shrink-0" />
                        {format(new Date(guide.dateOfBirth), 'dd.MM.yyyy')}
                        <Copy className="w-3 h-3 opacity-40" />
                      </span>
                    ) : <span className="text-gray-300 text-sm">—</span>}
                  </td>
                  {/* TELEGRAM */}
                  <td className="px-3 py-4">
                    {guide.telegramChatId ? (
                      <span onClick={() => { navigator.clipboard.writeText(guide.telegramChatId); toast.success('Nusxalandi'); }} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-sky-50 text-sky-700 border border-sky-200 rounded-lg text-xs font-mono font-bold whitespace-nowrap cursor-pointer hover:bg-sky-100 hover:border-sky-300 transition-colors select-none">
                        <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0"></span>
                        {guide.telegramChatId}
                        <Copy className="w-3 h-3 opacity-40" />
                      </span>
                    ) : <span className="text-gray-300 text-sm">—</span>}
                  </td>
                  {/* ПАСПОРТ № */}
                  <td className="px-3 py-4">
                    {guide.passportNumber ? (
                      <div className="flex items-center gap-1.5">
                        <span onClick={() => { navigator.clipboard.writeText(guide.passportNumber); toast.success('Nusxalandi'); }} className="inline-flex items-center px-2.5 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-black font-mono tracking-wider whitespace-nowrap cursor-pointer hover:bg-indigo-100 hover:border-indigo-400 transition-colors select-none gap-1.5">
                          {guide.passportNumber}
                          <Copy className="w-3 h-3 opacity-40" />
                        </span>
                        {isAdmin && (
                          <button onClick={() => toggleSensitive(guide.id)} className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all">
                            {showSensitive[guide.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    ) : <span className="text-gray-300 text-sm">—</span>}
                  </td>
                  {/* BERILGAN */}
                  <td className="px-3 py-4">
                    {guide.passportIssueDate ? (
                      <span onClick={() => { navigator.clipboard.writeText(format(new Date(guide.passportIssueDate), 'dd.MM.yyyy')); toast.success('Nusxalandi'); }} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 text-slate-600 border border-slate-200 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-slate-100 hover:border-slate-300 transition-colors select-none">
                        {format(new Date(guide.passportIssueDate), 'dd.MM.yyyy')}
                        <Copy className="w-3 h-3 opacity-40" />
                      </span>
                    ) : <span className="text-gray-300 text-sm">—</span>}
                  </td>
                  {/* AMAL QILADI */}
                  <td className="px-3 py-4">
                    {guide.passportExpiryDate ? (
                      <div className="space-y-1.5">
                        <span onClick={() => { navigator.clipboard.writeText(format(new Date(guide.passportExpiryDate), 'dd.MM.yyyy')); toast.success('Nusxalandi'); }} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer hover:bg-gray-100 hover:border-gray-300 transition-colors select-none">
                          {format(new Date(guide.passportExpiryDate), 'dd.MM.yyyy')}
                          <Copy className="w-3 h-3 opacity-40" />
                        </span>
                        {getPassportStatusBadge(guide.passportStatus)}
                      </div>
                    ) : <span className="text-gray-300 text-sm">—</span>}
                  </td>
                  {/* PRIORITET */}
                  <td className="px-3 py-4 text-center">
                    <input
                      key={`p-${guide.id}-${guide.priority}`}
                      type="number"
                      min="1"
                      max="99"
                      defaultValue={guide.priority ?? ''}
                      onBlur={async (e) => {
                        const val = e.target.value === '' ? null : parseInt(e.target.value);
                        if (val === guide.priority) return;
                        await guidesApi.update(guide.id, { priority: val });
                        loadGuides();
                      }}
                      placeholder="—"
                      className="w-12 text-center text-xs font-bold border border-indigo-200 rounded-lg px-1 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-indigo-50 text-indigo-700"
                    />
                  </td>
                  {/* HALF DAY */}
                  <td className="px-3 py-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-black whitespace-nowrap text-white shadow-sm" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                      <DollarSign className="w-3.5 h-3.5" />
                      {guide.halfDayRate ?? 55}
                    </span>
                  </td>
                  {/* DAY */}
                  <td className="px-3 py-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-black whitespace-nowrap text-white shadow-sm" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                      <DollarSign className="w-3.5 h-3.5" />
                      {guide.dayRate ?? 110}
                    </span>
                  </td>
                  {/* ТУРЫ */}
                  <td className="px-3 py-4 text-center">
                    <span className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-black text-white shadow-sm whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
                      <FileText className="w-3.5 h-3.5" />
                      {guide._count?.bookings || 0}
                    </span>
                  </td>
                  {/* СТАТУС */}
                  <td className="px-3 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap ${guide.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
                      <span className={`w-2 h-2 rounded-full ${guide.isActive ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                      {guide.isActive ? 'Актив' : 'Нет'}
                    </span>
                  </td>
                  {/* ДЕЙСТВИЯ */}
                  <td className="px-3 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openModal(guide)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-indigo-500 rounded-lg transition-all shadow-sm hover:shadow-md" title="Редактировать">
                        <Edit className="w-4 h-4" />
                      </button>
                      {isAdmin && (
                        <>
                          <button onClick={() => toggleActive(guide)} className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all shadow-sm hover:shadow-md ${guide.isActive ? 'text-gray-400 hover:text-white hover:bg-amber-500' : 'text-white bg-emerald-500'}`} title={guide.isActive ? 'Деактивировать' : 'Активировать'}>
                            <Shield className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(guide)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-red-500 rounded-lg transition-all shadow-sm hover:shadow-md" title="Удалить">
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
                    <td colSpan={13} className="p-0 bg-gradient-to-br from-primary-50 via-indigo-50 to-purple-50">
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
                                      const status = getBookingStatus(booking);
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
                                          <td className="px-4 py-3 text-gray-700 font-medium">
                                            {booking.guideRole === 'second' && booking.tourType?.code === 'ZA'
                                              ? format(addDays(new Date(booking.endDate), 4), 'dd.MM.yyyy')
                                              : format(new Date(booking.departureDate), 'dd.MM.yyyy')}
                                          </td>
                                          <td className="px-4 py-3 text-gray-700 font-medium">
                                            {booking.guideRole === 'second' && booking.tourType?.code === 'ZA'
                                              ? format(addDays(new Date(booking.endDate), 4), 'dd.MM.yyyy')
                                              : format(new Date(booking.arrivalDate), 'dd.MM.yyyy')}
                                          </td>
                                          <td className="px-4 py-3 text-gray-700 font-medium">
                                            {booking.guideRole === 'second' && booking.tourType?.code === 'ZA'
                                              ? format(addDays(new Date(booking.endDate), 5), 'dd.MM.yyyy')
                                              : format(new Date(booking.endDate), 'dd.MM.yyyy')}
                                          </td>
                                          <td className="px-4 py-3">
                                            <div className="flex items-center gap-1.5">
                                              <User className="w-4 h-4 text-primary-500" />
                                              <span className="font-bold text-gray-900">{booking.pax || 0}</span>
                                            </div>
                                          </td>
                                          <td className="px-4 py-3 text-gray-700 font-medium">{booking.paxUzbekistan || 0}</td>
                                          <td className="px-4 py-3 text-gray-700 font-medium">{booking.paxTurkmenistan || 0}</td>
                                          <td className="px-4 py-3 text-gray-700 font-semibold">
                                            {guide.name}
                                            {booking.guideRole === 'second' && <span className="ml-1.5 text-xs bg-orange-100 text-orange-600 border border-orange-200 px-1.5 py-0.5 rounded-full font-medium">2-gid</span>}
                                          </td>
                                          <td className="px-4 py-3">
                                            <span className={`px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm ${
                                              status === 'COMPLETED' ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white' :
                                              status === 'FINAL_CONFIRMED' ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white' :
                                              status === 'CONFIRMED' ? 'bg-gradient-to-r from-green-500 to-green-600 text-white' :
                                              status === 'IN_PROGRESS' ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white' :
                                              status === 'CANCELLED' ? 'bg-gradient-to-r from-red-500 to-red-600 text-white' :
                                              'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white'
                                            }`}>
                                              {status === 'COMPLETED' ? 'Completed' :
                                               status === 'FINAL_CONFIRMED' ? 'Final Confirmed' :
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
            <>
              {/* MOBILE: compact booking list */}
              <div className="md:hidden divide-y divide-gray-100">
                {allBookings.map((booking, idx) => {
                  const status = getBookingStatus(booking);
                  const statusCfg = ({
                    COMPLETED:       { bg: 'bg-blue-500',    label: 'Done' },
                    FINAL_CONFIRMED: { bg: 'bg-emerald-500', label: 'Final' },
                    CONFIRMED:       { bg: 'bg-green-500',   label: 'OK' },
                    IN_PROGRESS:     { bg: 'bg-purple-500',  label: 'Active' },
                    CANCELLED:       { bg: 'bg-red-500',     label: 'Cancelled' },
                  })[status] || { bg: 'bg-yellow-400', label: 'Pending' };
                  const color = booking.tourType?.color || '#3B82F6';
                  return (
                    <div
                      key={booking.id}
                      onClick={() => handleEditBooking(booking.id)}
                      className="flex border-b border-gray-100 last:border-0 cursor-pointer transition-all active:opacity-80"
                      style={{ background: `linear-gradient(to right, ${color}10, white 60%)` }}
                    >
                      {/* Left color accent — thick */}
                      <div className="w-1.5 shrink-0 rounded-l" style={{ backgroundColor: color }} />
                      <div className="flex-1 px-3 py-3">
                        {/* Top: number + booking badge + status */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black w-5 text-center" style={{ color }}>{idx + 1}</span>
                          <span className="px-3 py-1 rounded-full text-xs font-black text-white shadow-sm" style={{ backgroundColor: color }}>
                            {booking.bookingNumber}
                          </span>
                          <span className={`ml-auto px-3 py-1 rounded-full text-xs font-black text-white shadow-sm ${statusCfg.bg}`}>
                            {statusCfg.label}
                          </span>
                        </div>
                        {/* Dates + PAX */}
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-sm font-semibold text-gray-900">
                            {format(new Date(booking.departureDate), 'dd.MM.yyyy')}
                            <span className="font-normal text-gray-400 mx-1.5">→</span>
                            {format(new Date(booking.endDate), 'dd.MM.yyyy')}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <User className="w-3.5 h-3.5" style={{ color }} />
                            <span className="font-black text-gray-900 text-sm">{booking.pax || 0}</span>
                          </div>
                        </div>
                        {/* Guide */}
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <User className="w-3 h-3 text-gray-400" />
                          <span className="text-xs font-medium text-gray-600">{booking.guide?.name || '—'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {allBookings.length === 0 && (
                  <div className="text-center py-10">
                    <p className="text-gray-500 text-sm">Туры не найдены</p>
                  </div>
                )}
              </div>
              {/* DESKTOP: full table */}
              <div className="hidden md:flex justify-end px-4 pt-4">
                <button
                  onClick={handleAutoAssignGuides}
                  disabled={assigningGuides}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-60 text-white rounded-xl shadow-lg hover:-translate-y-0.5 transition-all duration-200 font-bold text-sm"
                >
                  <UserCheck className="w-4 h-4" />
                  {assigningGuides ? 'Tayinlanmoqda...' : 'Auto Gid'}
                </button>
              </div>
              <div className="hidden md:block relative overflow-x-auto">
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
                    const status = getBookingStatus(booking);
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
                        <td className="hidden md:table-cell px-4 py-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (guideDropdown === booking.id) { setGuideDropdown(null); return; }
                              const rect = e.currentTarget.getBoundingClientRect();
                              setGuideDropdownPos({ top: rect.bottom + 6, left: rect.left });
                              setGuideDropdown(booking.id);
                            }}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 text-xs font-bold transition-all whitespace-nowrap ${
                              booking.guide
                                ? 'bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-400 shadow-sm'
                                : 'bg-white border-dashed border-gray-300 text-gray-400 hover:border-indigo-300 hover:text-indigo-500'
                            }`}
                          >
                            {booking.guide ? (
                              <span className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-white font-black text-xs shrink-0">
                                {booking.guide.name.charAt(0).toUpperCase()}
                              </span>
                            ) : (
                              <User className="w-3.5 h-3.5" />
                            )}
                            <span>{booking.guide?.name || 'Tanlash...'}</span>
                            <ChevronDown className={`w-3 h-3 opacity-50 transition-transform ${guideDropdown === booking.id ? 'rotate-180' : ''}`} />
                          </button>
                        </td>
                        <td className="px-3 md:px-4 py-3 md:py-4">
                          <span className={`px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-xs font-bold shadow-sm whitespace-nowrap ${
                            status === 'COMPLETED' ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white' :
                            status === 'FINAL_CONFIRMED' ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white' :
                            status === 'CONFIRMED' ? 'bg-gradient-to-r from-green-500 to-green-600 text-white' :
                            status === 'IN_PROGRESS' ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white' :
                            status === 'CANCELLED' ? 'bg-gradient-to-r from-red-500 to-red-600 text-white' :
                            'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white'
                          }`}>
                            {status === 'COMPLETED' ? 'Completed' :
                             status === 'FINAL_CONFIRMED' ? 'Final Confirmed' :
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
            </>
          )}
        </div>
      )}

      {/* Guide dropdown portal — fixed position, always on top */}
      {guideDropdown && (
        <div
          className="fixed z-[9999]"
          style={{ top: guideDropdownPos.top, left: guideDropdownPos.left }}
          onClick={e => e.stopPropagation()}
        >
          <div className="w-52 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
               style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.15), 0 2px 8px rgba(79,70,229,0.12)' }}>
            {/* Header */}
            <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: 'linear-gradient(135deg,#4f46e5,#6366f1)' }}>
              <User className="w-3.5 h-3.5 text-white/80" />
              <p className="text-xs font-black text-white uppercase tracking-wider">Gid tanlash</p>
            </div>
            {/* List */}
            <div className="overflow-y-auto" style={{ maxHeight: 220 }}>
              {/* No guide */}
              <button
                onClick={() => handleGuideAssign(guideDropdown, null)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-red-50 group transition-colors border-b border-gray-100"
              >
                <span className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 font-bold text-xs shrink-0 group-hover:bg-red-100 group-hover:text-red-500">✕</span>
                <span className="text-gray-500 group-hover:text-red-500 font-medium">Gidsiz</span>
              </button>
              {guides.filter(g => g.isActive).map((guide, i) => {
                const isSelected = allBookings.find(b => b.id === guideDropdown)?.guide?.id === guide.id;
                const colors = [
                  ['#4f46e5','#e0e7ff'], ['#0891b2','#cffafe'], ['#059669','#d1fae5'],
                  ['#d97706','#fef3c7'], ['#dc2626','#fee2e2'], ['#7c3aed','#ede9fe'],
                ];
                const [bg, light] = colors[i % colors.length];
                return (
                  <button
                    key={guide.id}
                    onClick={() => handleGuideAssign(guideDropdown, guide.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                  >
                    <span className="w-7 h-7 rounded-full flex items-center justify-center font-black text-xs shrink-0"
                          style={{ backgroundColor: isSelected ? bg : light, color: isSelected ? 'white' : bg }}>
                      {guide.name.charAt(0).toUpperCase()}
                    </span>
                    <span className={`flex-1 text-left font-semibold ${isSelected ? 'text-indigo-700' : 'text-gray-700'}`}>{guide.name}</span>
                    {isSelected && (
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0" style={{ backgroundColor: bg }}>✓</span>
                    )}
                  </button>
                );
              })}
            </div>
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
      </div>{/* end content area */}
    </div>
  );
}
