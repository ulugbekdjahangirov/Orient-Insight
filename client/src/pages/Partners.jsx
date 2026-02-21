import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { telegramApi } from '../services/api';
import { Building2, UtensilsCrossed, Bus, Users, Clock, CheckCircle, XCircle, Loader2, RefreshCw, Trash2, ChevronDown, ChevronRight, Search, Truck } from 'lucide-react';

const TABS = [
  { id: 'hotels', label: 'Hotels', icon: Building2 },
  { id: 'restoran', label: 'Restoran', icon: UtensilsCrossed },
  { id: 'transport', label: 'Transport', icon: Bus },
  { id: 'gidlar', label: 'Gidlar', icon: Users },
];

const STATUS_CONFIG = {
  PENDING:              { label: 'Kutilmoqda',             color: 'bg-yellow-100 text-yellow-800', icon: '🕐' },
  CONFIRMED:            { label: 'Tasdiqladi',             color: 'bg-green-100 text-green-800',   icon: '✅' },
  WAITING:              { label: 'Waiting List',           color: 'bg-blue-100 text-blue-800',     icon: '⏳' },
  REJECTED:             { label: 'Rad qildi',              color: 'bg-red-100 text-red-800',       icon: '❌' },
  PENDING_APPROVAL:     { label: 'Tasdiqlash kutilmoqda',  color: 'bg-amber-100 text-amber-800',   icon: '🕐' },
  APPROVED:             { label: 'Provayderga yuborildi',  color: 'bg-blue-100 text-blue-800',     icon: '🔄' },
  REJECTED_BY_APPROVER: { label: 'Rad etildi (admin)',     color: 'bg-red-100 text-red-800',       icon: '❌' },
};

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function HotelsTab({ confirmations, onDelete }) {
  const [deletingId, setDeletingId] = useState(null);
  const [openHotels, setOpenHotels] = useState({});

  const toggleHotel = (hotelId) => {
    setOpenHotels(prev => ({ ...prev, [hotelId]: !prev[hotelId] }));
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu qatorni o\'chirishni tasdiqlaysizmi?')) return;
    setDeletingId(id);
    try {
      await telegramApi.deleteConfirmation(id);
      onDelete(id);
    } catch (err) {
      alert('O\'chirishda xatolik');
    } finally {
      setDeletingId(null);
    }
  };

  // Group by hotel
  const grouped = {};
  confirmations.forEach(c => {
    const key = c.hotelId;
    if (!grouped[key]) {
      grouped[key] = {
        hotelId: c.hotelId,
        hotelName: c.hotel?.name || `Hotel #${c.hotelId}`,
        cityName: c.hotel?.city?.name || '',
        items: []
      };
    }
    grouped[key].items.push(c);
  });

  const groups = Object.values(grouped).sort((a, b) => a.hotelName.localeCompare(b.hotelName));

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <Building2 className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-sm">Hech qanday zayavka topilmadi</p>
        <p className="text-xs mt-1">Telegram orqali hotel zayavkasi yuborilgandan so'ng bu yerda ko'rinadi</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map(group => {
        const isOpen = !!openHotels[group.hotelId];
        const statusCounts = {};
        group.items.forEach(c => { statusCounts[c.status] = (statusCounts[c.status] || 0) + 1; });
        const statusSummary = [
          statusCounts.CONFIRMED && `✅ ${statusCounts.CONFIRMED}`,
          statusCounts.WAITING   && `⏳ ${statusCounts.WAITING}`,
          statusCounts.PENDING   && `🕐 ${statusCounts.PENDING}`,
          statusCounts.REJECTED  && `❌ ${statusCounts.REJECTED}`,
        ].filter(Boolean).join('  ');

        return (
          <div key={group.hotelId} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Hotel header — clickable */}
            <button
              onClick={() => toggleHotel(group.hotelId)}
              className="w-full bg-gray-50 border-b border-gray-200 px-5 py-3 flex items-center gap-3 hover:bg-gray-100 transition-colors text-left"
            >
              {isOpen
                ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              }
              <Building2 className="w-5 h-5 text-gray-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-800">{group.hotelName}</h3>
                {group.cityName && <p className="text-xs text-gray-500">{group.cityName}</p>}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {statusSummary && (
                  <span className="text-sm">{statusSummary}</span>
                )}
                <span className="text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">
                  {group.items.length} ta
                </span>
              </div>
            </button>

            {/* Confirmations table — collapsible */}
            {isOpen && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider">
                      <th className="px-5 py-2.5 text-left font-medium">Booking</th>
                      <th className="px-5 py-2.5 text-left font-medium">Jo'natilgan</th>
                      <th className="px-5 py-2.5 text-left font-medium">Holat</th>
                      <th className="px-5 py-2.5 text-left font-medium">Kim javob berdi</th>
                      <th className="px-5 py-2.5 text-left font-medium">Javob vaqti</th>
                      <th className="px-5 py-2.5 text-left font-medium w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map(item => (
                      <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors group/row">
                        <td className="px-5 py-3">
                          <Link to={`/bookings/${item.bookingId}`} className="font-medium text-primary-600 hover:underline">
                            {item.booking?.bookingNumber || `#${item.bookingId}`}
                          </Link>
                          {item.booking?.departureDate && (
                            <span className="ml-2 text-xs text-gray-400">{formatDate(item.booking.departureDate)}</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-gray-600">{formatDateTime(item.sentAt)}</td>
                        <td className="px-5 py-3"><StatusBadge status={item.status} /></td>
                        <td className="px-5 py-3 text-gray-600">{item.confirmedBy || '—'}</td>
                        <td className="px-5 py-3 text-gray-600">{item.respondedAt ? formatDateTime(item.respondedAt) : '—'}</td>
                        <td className="px-3 py-3">
                          <button
                            onClick={() => handleDelete(item.id)}
                            disabled={deletingId === item.id}
                            className="opacity-0 group-hover/row:opacity-100 p-1.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-50"
                            title="O'chirish"
                          >
                            {deletingId === item.id
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <Trash2 className="w-4 h-4" />
                            }
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Booking-grouped view for ER/CO/KAS/ZA sub-tabs
function BookingsGroupedTab({ confirmations, onDelete }) {
  const [deletingId, setDeletingId] = useState(null);
  const [openBookings, setOpenBookings] = useState({});

  const toggleBooking = (bookingId) => {
    setOpenBookings(prev => ({ ...prev, [bookingId]: !prev[bookingId] }));
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu qatorni o\'chirishni tasdiqlaysizmi?')) return;
    setDeletingId(id);
    try {
      await telegramApi.deleteConfirmation(id);
      onDelete(id);
    } catch (err) {
      alert('O\'chirishda xatolik');
    } finally {
      setDeletingId(null);
    }
  };

  // Group by bookingId
  const grouped = {};
  confirmations.forEach(c => {
    const key = c.bookingId;
    if (!grouped[key]) {
      grouped[key] = {
        bookingId: c.bookingId,
        bookingNumber: c.booking?.bookingNumber || `#${c.bookingId}`,
        departureDate: c.booking?.departureDate,
        items: []
      };
    }
    grouped[key].items.push(c);
  });

  const groups = Object.values(grouped).sort((a, b) =>
    a.bookingNumber.localeCompare(b.bookingNumber)
  );

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <Building2 className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-sm">Bu tur uchun hali zayavka yuborilmagan</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map(group => {
        const isOpen = !!openBookings[group.bookingId];
        const statusCounts = {};
        group.items.forEach(c => { statusCounts[c.status] = (statusCounts[c.status] || 0) + 1; });
        const statusSummary = [
          statusCounts.CONFIRMED && `✅ ${statusCounts.CONFIRMED}`,
          statusCounts.WAITING   && `⏳ ${statusCounts.WAITING}`,
          statusCounts.PENDING   && `🕐 ${statusCounts.PENDING}`,
          statusCounts.REJECTED  && `❌ ${statusCounts.REJECTED}`,
        ].filter(Boolean).join('  ');

        return (
          <div key={group.bookingId} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Booking header — clickable */}
            <button
              onClick={() => toggleBooking(group.bookingId)}
              className="w-full bg-gray-50 border-b border-gray-200 px-5 py-3 flex items-center gap-3 hover:bg-gray-100 transition-colors text-left"
            >
              {isOpen
                ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              }
              <div className="flex-1 min-w-0">
                <Link
                  to={`/bookings/${group.bookingId}`}
                  onClick={e => e.stopPropagation()}
                  className="font-semibold text-primary-600 hover:underline"
                >
                  {group.bookingNumber}
                </Link>
                {group.departureDate && (
                  <span className="ml-2 text-xs text-gray-500">{formatDate(group.departureDate)}</span>
                )}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {statusSummary && <span className="text-sm">{statusSummary}</span>}
                <span className="text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">
                  {group.items.length} ta hotel
                </span>
              </div>
            </button>

            {/* Hotels inside this booking */}
            {isOpen && (
              <div className="divide-y divide-gray-50">
                {group.items.map(item => (
                  <div key={item.id} className="px-5 py-3 flex items-center gap-4 hover:bg-gray-50 transition-colors group/row">
                    <Building2 className="w-4 h-4 text-gray-300 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-800 text-sm">
                        {item.hotel?.name || `Hotel #${item.hotelId}`}
                      </span>
                      {item.hotel?.city?.name && (
                        <span className="ml-1.5 text-xs text-gray-400">{item.hotel.city.name}</span>
                      )}
                    </div>
                    <StatusBadge status={item.status} />
                    <span className="text-xs text-gray-400 hidden sm:block">
                      {item.confirmedBy || '—'}
                    </span>
                    <span className="text-xs text-gray-400 hidden md:block">
                      {item.respondedAt ? formatDateTime(item.respondedAt) : formatDateTime(item.sentAt)}
                    </span>
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      className="opacity-0 group-hover/row:opacity-100 p-1.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-50 flex-shrink-0"
                      title="O'chirish"
                    >
                      {deletingId === item.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />
                      }
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const PROVIDER_CONFIG = {
  sevil:    { label: 'Sevil aka',  color: 'bg-emerald-100 text-emerald-800' },
  xayrulla: { label: 'Xayrulla',   color: 'bg-yellow-100 text-yellow-800' },
  nosir:    { label: 'Nosir aka',  color: 'bg-blue-100 text-blue-800' },
};

function ProviderBadge({ provider }) {
  const cfg = PROVIDER_CONFIG[provider] || { label: provider, color: 'bg-gray-100 text-gray-700' };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      <Truck className="w-3 h-3" /> {cfg.label}
    </span>
  );
}

function TransportTab({ confirmations, onDelete }) {
  const [deletingId, setDeletingId] = useState(null);
  const [openBookings, setOpenBookings] = useState({});

  const toggleBooking = (bookingId) => {
    setOpenBookings(prev => ({ ...prev, [bookingId]: !prev[bookingId] }));
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu qatorni o\'chirishni tasdiqlaysizmi?')) return;
    setDeletingId(id);
    try {
      await telegramApi.deleteTransportConfirmation(id);
      onDelete(id);
    } catch {
      alert('O\'chirishda xatolik');
    } finally {
      setDeletingId(null);
    }
  };

  // Group by bookingId
  const grouped = {};
  confirmations.forEach(c => {
    const key = c.bookingId;
    if (!grouped[key]) {
      grouped[key] = {
        bookingId: c.bookingId,
        bookingNumber: c.booking?.bookingNumber || `#${c.bookingId}`,
        departureDate: c.booking?.departureDate,
        items: []
      };
    }
    grouped[key].items.push(c);
  });

  const groups = Object.values(grouped).sort((a, b) => a.bookingNumber.localeCompare(b.bookingNumber));

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <Bus className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-sm">Hali hech qanday marshrut varaqasi yuborilmagan</p>
        <p className="text-xs mt-1">Marshrut varaqasi Telegram orqali provayderga yuborilgandan so'ng ko'rinadi</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map(group => {
        const isOpen = !!openBookings[group.bookingId];
        const statusCounts = {};
        group.items.forEach(c => { statusCounts[c.status] = (statusCounts[c.status] || 0) + 1; });
        const statusSummary = [
          statusCounts.CONFIRMED            && `✅ ${statusCounts.CONFIRMED}`,
          statusCounts.APPROVED             && `🔄 ${statusCounts.APPROVED}`,
          statusCounts.PENDING_APPROVAL     && `🕐 ${statusCounts.PENDING_APPROVAL}`,
          statusCounts.PENDING              && `🕐 ${statusCounts.PENDING}`,
          statusCounts.REJECTED             && `❌ ${statusCounts.REJECTED}`,
          statusCounts.REJECTED_BY_APPROVER && `❌ ${statusCounts.REJECTED_BY_APPROVER}`,
        ].filter(Boolean).join('  ');

        return (
          <div key={group.bookingId} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <button
              onClick={() => toggleBooking(group.bookingId)}
              className="w-full bg-gray-50 border-b border-gray-200 px-5 py-3 flex items-center gap-3 hover:bg-gray-100 transition-colors text-left"
            >
              {isOpen
                ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              }
              <div className="flex-1 min-w-0">
                <Link
                  to={`/bookings/${group.bookingId}`}
                  onClick={e => e.stopPropagation()}
                  className="font-semibold text-primary-600 hover:underline"
                >
                  {group.bookingNumber}
                </Link>
                {group.departureDate && (
                  <span className="ml-2 text-xs text-gray-500">{formatDate(group.departureDate)}</span>
                )}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {statusSummary && <span className="text-sm">{statusSummary}</span>}
                <span className="text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">
                  {group.items.length} ta
                </span>
              </div>
            </button>

            {isOpen && (
              <div className="divide-y divide-gray-100">
                {group.items.map(item => {
                  const rowBg = item.status === 'CONFIRMED'
                    ? 'bg-green-50'
                    : (item.status === 'REJECTED' || item.status === 'REJECTED_BY_APPROVER')
                    ? 'bg-red-50'
                    : 'bg-amber-50';
                  return (
                  <div key={item.id} className={`px-5 py-3 flex items-center gap-4 transition-colors group/row ${rowBg}`}>
                    <div className="flex-1 min-w-0 flex items-center gap-3">
                      <ProviderBadge provider={item.provider} />
                    </div>
                    {item.approvedBy && (
                      <span className="hidden sm:inline-flex items-center gap-1.5 mr-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          ✅ Tekshirdi
                        </span>
                        <span className="text-xs text-gray-600">{item.approvedBy}</span>
                      </span>
                    )}
                    <StatusBadge status={item.status} />
                    {item.confirmedBy && (
                      <span className="text-xs text-gray-500 hidden sm:block">
                        {item.confirmedBy}
                      </span>
                    )}
                    <span className="text-xs text-gray-400 hidden md:block">
                      {item.respondedAt ? formatDateTime(item.respondedAt) : formatDateTime(item.sentAt)}
                    </span>
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      className="opacity-0 group-hover/row:opacity-100 p-1.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-50 flex-shrink-0"
                      title="O'chirish"
                    >
                      {deletingId === item.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ComingSoonTab({ label }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
      <Clock className="w-12 h-12 mb-3 opacity-30" />
      <p className="text-sm font-medium">{label} — tez kunda</p>
      <p className="text-xs mt-1">Bu bo'lim ishlab chiqilmoqda</p>
    </div>
  );
}

const AUTO_REFRESH_SEC = 30;

const HOTEL_SUB_TABS = ['ER', 'CO', 'KAS', 'ZA'];

const STATUS_FILTERS = [
  { id: 'ALL',       label: 'Barchasi' },
  { id: 'PENDING',   label: '🕐 Kutilmoqda' },
  { id: 'CONFIRMED', label: '✅ Tasdiqladi' },
  { id: 'WAITING',   label: '⏳ Waiting' },
  { id: 'REJECTED',  label: '❌ Rad qildi' },
];

export default function Partners() {
  const [activeTab, setActiveTab] = useState('hotels');
  const [hotelSubTab, setHotelSubTab] = useState('ER');
  const [transportSubTab, setTransportSubTab] = useState('ER');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [transportConfirmations, setTransportConfirmations] = useState([]);
  const [confirmations, setConfirmations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [countdown, setCountdown] = useState(AUTO_REFRESH_SEC);
  const countdownRef = useRef(null);
  const refreshRef = useRef(null);

  const loadConfirmations = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [hotelRes, transportRes] = await Promise.all([
        telegramApi.getConfirmations(),
        telegramApi.getTransportConfirmations()
      ]);
      setConfirmations(hotelRes.data.confirmations || []);
      setTransportConfirmations(transportRes.data.confirmations || []);
    } catch (err) {
      setError('Ma\'lumotlarni yuklashda xatolik');
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const resetCountdown = () => {
    setCountdown(AUTO_REFRESH_SEC);
  };

  // Auto-refresh every 30s
  useEffect(() => {
    loadConfirmations();

    // Countdown ticker
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) return AUTO_REFRESH_SEC;
        return prev - 1;
      });
    }, 1000);

    // Silent refresh
    refreshRef.current = setInterval(() => {
      loadConfirmations(true);
      setCountdown(AUTO_REFRESH_SEC);
    }, AUTO_REFRESH_SEC * 1000);

    return () => {
      clearInterval(countdownRef.current);
      clearInterval(refreshRef.current);
    };
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hamkorlar</h1>
          <p className="text-sm text-gray-500 mt-0.5">Hotel, restoran, transport va gidlar bilan hamkorlik holatlari</p>
        </div>
        <button
          onClick={() => { loadConfirmations(); resetCountdown(); clearInterval(refreshRef.current); refreshRef.current = setInterval(() => { loadConfirmations(true); setCountdown(AUTO_REFRESH_SEC); }, AUTO_REFRESH_SEC * 1000); }}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Yangilash
          <span className="text-xs text-gray-400 ml-1">{countdown}s</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-red-500">
          <XCircle className="w-10 h-10 mb-2" />
          <p className="text-sm">{error}</p>
          <button onClick={loadConfirmations} className="mt-3 text-xs underline">Qayta urinish</button>
        </div>
      ) : (
        <>
          {activeTab === 'hotels' && (() => {
            // Count per tour type for badge numbers
            const counts = {};
            confirmations.forEach(c => {
              const type = (c.booking?.bookingNumber || '').split('-')[0] || '?';
              counts[type] = (counts[type] || 0) + 1;
            });

            const q = searchQuery.trim().toLowerCase();
            const filtered = confirmations.filter(c => {
              if (!(c.booking?.bookingNumber || '').startsWith(hotelSubTab + '-')) return false;
              if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
              if (q) {
                const bookingNum = (c.booking?.bookingNumber || '').toLowerCase();
                const hotelName = (c.hotel?.name || '').toLowerCase();
                if (!bookingNum.includes(q) && !hotelName.includes(q)) return false;
              }
              return true;
            });

            return (
              <>
                {/* Sub-tabs */}
                <div className="flex gap-1 mb-4">
                  {HOTEL_SUB_TABS.map(sub => (
                    <button
                      key={sub}
                      onClick={() => setHotelSubTab(sub)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        hotelSubTab === sub
                          ? 'bg-gray-800 text-white'
                          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {sub}
                      {sub !== 'Barcha' && counts[sub] ? (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          hotelSubTab === sub ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {counts[sub]}
                        </span>
                      ) : sub === 'Barcha' && confirmations.length ? (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          hotelSubTab === sub ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {confirmations.length}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>

                {/* Search + Status filter row */}
                <div className="flex flex-wrap gap-3 mb-4">
                  {/* Search input */}
                  <div className="relative flex-1 min-w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Booking raqami yoki hotel nomi..."
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Status filter buttons */}
                  <div className="flex gap-1 flex-wrap">
                    {STATUS_FILTERS.map(sf => (
                      <button
                        key={sf.id}
                        onClick={() => setStatusFilter(sf.id)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                          statusFilter === sf.id
                            ? 'bg-primary-600 text-white'
                            : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {sf.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Result count */}
                {(q || statusFilter !== 'ALL') && (
                  <p className="text-xs text-gray-400 mb-3">
                    {filtered.length} ta natija topildi
                  </p>
                )}

                <BookingsGroupedTab
                  confirmations={filtered}
                  onDelete={(id) => setConfirmations(prev => prev.filter(c => c.id !== id))}
                />
              </>
            );
          })()}
          {activeTab === 'restoran' && <ComingSoonTab label="Restoran" />}
          {activeTab === 'transport' && (() => {
            const trCounts = {};
            transportConfirmations.forEach(c => {
              const type = (c.booking?.bookingNumber || '').split('-')[0] || '?';
              trCounts[type] = (trCounts[type] || 0) + 1;
            });
            const trFiltered = transportConfirmations.filter(c =>
              (c.booking?.bookingNumber || '').startsWith(transportSubTab + '-')
            );
            return (
              <>
                {/* Sub-tabs */}
                <div className="flex gap-1 mb-4">
                  {HOTEL_SUB_TABS.map(sub => (
                    <button
                      key={sub}
                      onClick={() => setTransportSubTab(sub)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        transportSubTab === sub
                          ? 'bg-gray-800 text-white'
                          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {sub}
                      {trCounts[sub] ? (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          transportSubTab === sub ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {trCounts[sub]}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
                <TransportTab
                  confirmations={trFiltered}
                  onDelete={(id) => setTransportConfirmations(prev => prev.filter(c => c.id !== id))}
                />
              </>
            );
          })()}
          {activeTab === 'gidlar' && <ComingSoonTab label="Gidlar" />}
        </>
      )}
    </div>
  );
}
