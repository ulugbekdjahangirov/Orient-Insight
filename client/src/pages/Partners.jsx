import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { telegramApi, api, jahresplanungApi } from '../services/api';
import { Building2, UtensilsCrossed, Bus, Users, Clock, CheckCircle, XCircle, Loader2, RefreshCw, Trash2, ChevronDown, ChevronRight, Search, Truck, Send, Copy, X, CalendarRange } from 'lucide-react';

const TABS = [
  { id: 'hotels', label: 'Hotels', icon: Building2 },
  { id: 'restoran', label: 'Restoran', icon: UtensilsCrossed },
  { id: 'transport', label: 'Transport', icon: Bus },
  { id: 'gidlar', label: 'Gidlar', icon: Users },
  { id: 'hotels2026', label: 'Hotels 2026', icon: CalendarRange },
  { id: 'restoran2026', label: 'Restoran 2026', icon: CalendarRange },
  { id: 'transport2026', label: 'Transport 2026', icon: CalendarRange },
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
                          👁 Tekshirdi
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

const GUIDE_STATUS_CONFIG = {
  ASSIGNED:  { label: 'Tayinlandi',    color: 'bg-green-100 text-green-800',  icon: '✅' },
  NO_GUIDE:  { label: 'Gid yo\'q',     color: 'bg-gray-100 text-gray-500',    icon: '—'  },
};

function GuideStatusBadge({ status }) {
  const cfg = GUIDE_STATUS_CONFIG[status] || GUIDE_STATUS_CONFIG.NO_GUIDE;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function GidlarTab({ assignments }) {
  const [openBookings, setOpenBookings] = useState({});

  const toggleBooking = (bookingId) => {
    setOpenBookings(prev => ({ ...prev, [bookingId]: !prev[bookingId] }));
  };

  // Group by booking
  const grouped = {};
  assignments.forEach(a => {
    if (!grouped[a.bookingId]) {
      grouped[a.bookingId] = {
        bookingId: a.bookingId,
        bookingNumber: a.bookingNumber,
        departureDate: a.departureDate,
        items: []
      };
    }
    grouped[a.bookingId].items.push(a);
  });

  const groups = Object.values(grouped).sort((a, b) =>
    a.bookingNumber.localeCompare(b.bookingNumber)
  );

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <Users className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-sm">Bu tur uchun hali gid tayinlanmagan</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map(group => {
        const isOpen = !!openBookings[group.bookingId];
        const assigned = group.items.filter(i => i.status === 'ASSIGNED').length;
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
                {assigned > 0 && <span className="text-sm">✅ {assigned}</span>}
                <span className="text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">
                  {group.items.length} ta gid
                </span>
              </div>
            </button>
            {isOpen && (
              <div className="divide-y divide-gray-50">
                {group.items.map(item => (
                  <div key={item.bookingId + '-' + (item.guideId || 'none')} className="px-5 py-3 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                    <Users className="w-4 h-4 text-gray-300 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-800 text-sm">
                        {item.guideName || '—'}
                      </span>
                      {item.hasTelegram && (
                        <span className="ml-2 text-xs text-sky-500">📱 Telegram</span>
                      )}
                    </div>
                    <GuideStatusBadge status={item.status} />
                    <span className="text-xs text-gray-400">{item.pax} PAX</span>
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

const MEAL_STATUS_CONFIG = {
  PENDING:   { label: 'Kutilmoqda', color: 'bg-yellow-100 text-yellow-800', icon: '🕐' },
  CONFIRMED: { label: 'Tasdiqladi', color: 'bg-green-100 text-green-800',   icon: '✅' },
  REJECTED:  { label: 'Rad qildi',  color: 'bg-red-100 text-red-800',       icon: '❌' },
};

function RestoranTab({ confirmations, onDelete }) {
  const [deletingId, setDeletingId] = useState(null);
  const [openBookings, setOpenBookings] = useState({});

  const toggleBooking = (bookingId) => {
    setOpenBookings(prev => ({ ...prev, [bookingId]: !prev[bookingId] }));
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu qatorni o\'chirishni tasdiqlaysizmi?')) return;
    setDeletingId(id);
    try {
      await telegramApi.deleteMealConfirmation(id);
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
        <UtensilsCrossed className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-sm">Hali hech qanday restoran xabari yuborilmagan</p>
        <p className="text-xs mt-1">BookingDetail → Meals tabidan restoranga xabar yuboring</p>
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
          statusCounts.PENDING   && `🕐 ${statusCounts.PENDING}`,
          statusCounts.REJECTED  && `❌ ${statusCounts.REJECTED}`,
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
                  const cfg = MEAL_STATUS_CONFIG[item.status] || MEAL_STATUS_CONFIG.PENDING;
                  const rowBg = item.status === 'CONFIRMED' ? 'bg-green-50'
                    : item.status === 'REJECTED' ? 'bg-red-50'
                    : 'bg-amber-50';
                  return (
                    <div key={item.id} className={`px-5 py-3 flex items-center gap-4 transition-colors group/row ${rowBg}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-gray-900">{item.restaurantName}</span>
                          {item.city && (
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{item.city}</span>
                          )}
                          {item.mealDate && (
                            <span className="text-xs text-gray-500">{item.mealDate}</span>
                          )}
                          {item.pax > 0 && (
                            <span className="text-xs text-gray-500">{item.pax} kishi</span>
                          )}
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                        {cfg.icon} {cfg.label}
                      </span>
                      {item.confirmedBy && (
                        <span className="text-xs text-gray-500 hidden sm:block">{item.confirmedBy}</span>
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

const JP_STATUS_ICONS = { CONFIRMED: '✅', WAITING: '⏳', PENDING: '⬜', REJECTED: '❌' };
const JP_STATUS_COLORS = {
  CONFIRMED: 'bg-green-100 text-green-800',
  WAITING:   'bg-blue-100 text-blue-800',
  PENDING:   'bg-yellow-100 text-yellow-800',
  REJECTED:  'bg-red-100 text-red-800',
};

function JpStatusBadge({ status }) {
  const color = JP_STATUS_COLORS[status] || JP_STATUS_COLORS.PENDING;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {JP_STATUS_ICONS[status] || '⬜'} {status === 'CONFIRMED' ? 'Tasdiqlandi' : status === 'WAITING' ? 'WL' : status === 'REJECTED' ? 'Rad etildi' : 'Kutilmoqda'}
    </span>
  );
}

const MEAL_STATUS_CFG = {
  PENDING:   { color: 'bg-yellow-100 text-yellow-800', label: 'Kutilmoqda', icon: '🕐' },
  CONFIRMED: { color: 'bg-green-100 text-green-800',   label: 'Tasdiqladi', icon: '✅' },
  REJECTED:  { color: 'bg-red-100 text-red-800',       label: 'Rad qildi',  icon: '❌' },
};

function Restoran2026Tab({ mealConfirmations, subTab, onDelete }) {
  const [openRestaurants, setOpenRestaurants] = useState({});
  const [deletingId, setDeletingId] = useState(null);

  // Filter by tourType
  const filtered = mealConfirmations.filter(c => c.booking?.tourType?.code === subTab);

  // Group by restaurantName
  const byRestaurant = {};
  filtered.forEach(c => {
    const name = c.restaurantName || '—';
    if (!byRestaurant[name]) byRestaurant[name] = [];
    byRestaurant[name].push(c);
  });
  const restaurants = Object.entries(byRestaurant).sort(([a], [b]) => a.localeCompare(b));

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Bu qatorni o\'chirishni tasdiqlaysizmi?')) return;
    setDeletingId(id);
    try {
      await telegramApi.deleteMealConfirmation(id);
      onDelete(id);
    } catch { alert('O\'chirishda xatolik'); }
    finally { setDeletingId(null); }
  };

  if (restaurants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <UtensilsCrossed className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-sm">Bu tur uchun hali restoranga Telegram yuborilmagan</p>
        <p className="text-xs mt-1">Jahresplanung → Restoran tabidan yuborilgandan so'ng ko'rinadi</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {restaurants.map(([restName, confs]) => {
        const isOpen = !!openRestaurants[restName];
        const confirmedCount = confs.filter(c => c.status === 'CONFIRMED').length;
        const pendingCount = confs.filter(c => c.status === 'PENDING').length;
        const rejectedCount = confs.filter(c => c.status === 'REJECTED').length;

        // Sort by bookingNumber
        const sorted = [...confs].sort((a, b) =>
          (a.booking?.bookingNumber || '').localeCompare(b.booking?.bookingNumber || '')
        );

        return (
          <div key={restName} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Header */}
            <button
              onClick={() => setOpenRestaurants(prev => ({ ...prev, [restName]: !prev[restName] }))}
              className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <UtensilsCrossed className="w-4 h-4 text-orange-500 flex-shrink-0" />
                <div className="text-left">
                  <div className="font-semibold text-gray-900">{restName}</div>
                  <div className="text-xs text-gray-400">{confs[0]?.city || ''}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs">
                  {confirmedCount > 0 && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{confirmedCount}✅</span>}
                  {pendingCount > 0 && <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">{pendingCount}🕐</span>}
                  {rejectedCount > 0 && <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{rejectedCount}❌</span>}
                  <span className="text-gray-400">{confs.length} ta guruh</span>
                </div>
                {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
              </div>
            </button>

            {/* Table */}
            {isOpen && (
              <div className="border-t border-gray-100 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                      <th className="px-4 py-2 text-left font-medium">Gruppe</th>
                      <th className="px-4 py-2 text-right font-medium">PAX</th>
                      <th className="px-4 py-2 text-left font-medium">Sana</th>
                      <th className="px-4 py-2 text-left font-medium">Holat</th>
                      <th className="px-4 py-2 text-left font-medium">Kim</th>
                      <th className="px-4 py-2 text-left font-medium">Vaqt</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map(c => {
                      const cfg = MEAL_STATUS_CFG[c.status] || MEAL_STATUS_CFG.PENDING;
                      return (
                        <tr key={c.id} className="border-t border-gray-50 hover:bg-gray-50 transition-colors group">
                          <td className="px-4 py-2">
                            <Link to={`/bookings/${c.bookingId}`} className="text-blue-600 hover:underline font-mono text-xs font-medium">
                              {c.booking?.bookingNumber || c.bookingId}
                            </Link>
                          </td>
                          <td className="px-4 py-2 text-right text-gray-700">{c.pax}</td>
                          <td className="px-4 py-2 text-gray-700 text-xs">{c.mealDate || '—'}</td>
                          <td className="px-4 py-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                              {cfg.icon} {cfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-xs text-gray-500">{c.confirmedBy || '—'}</td>
                          <td className="px-4 py-2 text-xs text-gray-400">{c.respondedAt ? formatDateTime(c.respondedAt) : '—'}</td>
                          <td className="px-4 py-2 text-right">
                            <button
                              onClick={e => handleDelete(e, c.id)}
                              disabled={deletingId === c.id}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-300 hover:text-red-500 transition-all"
                            >
                              {deletingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
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

function Hotels2026Tab({ sections, subTab, onDeleteHotel, onDeleteGroup, onDeleteVisit }) {
  const [openHotels, setOpenHotels] = useState({});
  const [openGroups, setOpenGroups] = useState({});
  const [deletingKey, setDeletingKey] = useState(null);

  const handleDeleteHotel = async (e, hotelId, tourType) => {
    e.stopPropagation();
    if (!window.confirm('Bu hotelning barcha ma\'lumotlarini o\'chirishni tasdiqlaysizmi?')) return;
    const key = `hotel-${hotelId}-${tourType}`;
    setDeletingKey(key);
    try { await onDeleteHotel(hotelId, tourType); }
    catch { alert('O\'chirishda xatolik'); }
    finally { setDeletingKey(null); }
  };

  const handleDeleteGroup = async (e, hotelId, bookingId, tourType) => {
    e.stopPropagation();
    const key = `grp-${hotelId}-${bookingId}`;
    setDeletingKey(key);
    try { await onDeleteGroup(hotelId, bookingId, tourType); }
    catch { alert('O\'chirishda xatolik'); }
    finally { setDeletingKey(null); }
  };

  const handleDeleteVisit = async (e, hotelId, bookingId, visitIdx, tourType) => {
    e.stopPropagation();
    const key = `visit-${hotelId}-${bookingId}-${visitIdx}`;
    setDeletingKey(key);
    try { await onDeleteVisit(hotelId, bookingId, visitIdx, tourType); }
    catch { alert('O\'chirishda xatolik'); }
    finally { setDeletingKey(null); }
  };

  const filtered = sections.filter(s => s.tourType === subTab);
  // Sort by city route order, then by hotel name within same city
  const sorted = [...filtered].sort((a, b) => {
    const orderDiff = (a.citySortOrder ?? 999) - (b.citySortOrder ?? 999);
    if (orderDiff !== 0) return orderDiff;
    return (a.hotelName || '').localeCompare(b.hotelName || '');
  });

  // Group by city for city section headers
  const byCityOrder = [];
  let lastCity = null;
  sorted.forEach(hotel => {
    const city = hotel.cityName || '—';
    if (city !== lastCity) {
      byCityOrder.push({ type: 'city', name: city });
      lastCity = city;
    }
    byCityOrder.push({ type: 'hotel', hotel });
  });

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <CalendarRange className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-sm">Bu tur uchun hali Заявка yuborilmagan</p>
        <p className="text-xs mt-1">Заявка 2026 sahifasidan Telegram orqali hotelga yuborilgandan so'ng ko'rinadi</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {byCityOrder.map((item, idx) => {
        if (item.type === 'city') {
          return (
            <div key={`city-${idx}`} className="flex items-center gap-2 pt-3 pb-1 px-1">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{item.name}</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
          );
        }
        const hotel = item.hotel;
        const isHotelOpen = !!openHotels[hotel.hotelId];
        const allVisits = hotel.groups?.flatMap(g => g.visits || []) || [];
        const statusCounts = {};
        allVisits.forEach(v => { statusCounts[v.status] = (statusCounts[v.status] || 0) + 1; });
        const statusSummary = [
          statusCounts.CONFIRMED && `✅ ${statusCounts.CONFIRMED}`,
          statusCounts.WAITING   && `⏳ ${statusCounts.WAITING}`,
          statusCounts.PENDING   && `⬜ ${statusCounts.PENDING}`,
          statusCounts.REJECTED  && `❌ ${statusCounts.REJECTED}`,
        ].filter(Boolean).join('  ');

        return (
          <div key={hotel.hotelId} className="group/hotel bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 flex items-center">
              <button
                onClick={() => setOpenHotels(prev => ({ ...prev, [hotel.hotelId]: !prev[hotel.hotelId] }))}
                className="flex-1 px-5 py-3 flex items-center gap-3 hover:bg-gray-100 transition-colors text-left"
              >
                {isHotelOpen
                  ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                }
                <Building2 className="w-5 h-5 text-gray-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800">{hotel.hotelName}</h3>
                  <p className="text-xs text-gray-400">Заявка {hotel.year} · {hotel.tourType}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {statusSummary && <span className="text-sm">{statusSummary}</span>}
                  <span className="text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">
                    {(hotel.groups || []).length} ta guruh
                  </span>
                </div>
              </button>
              <button
                onClick={(e) => handleDeleteHotel(e, hotel.hotelId, hotel.tourType)}
                className="opacity-0 group-hover/hotel:opacity-100 mr-3 p-1.5 rounded hover:bg-red-50 hover:text-red-500 text-gray-400 transition-all flex-shrink-0"
                title="Hotelni o'chirish"
              >
                {deletingKey === `hotel-${hotel.hotelId}-${hotel.tourType}`
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Trash2 className="w-4 h-4" />}
              </button>
            </div>

            {isHotelOpen && (
              <div className="divide-y divide-gray-100">
                {(hotel.groups || []).map(grp => {
                  const grpKey = `${hotel.hotelId}-${grp.bookingId}`;
                  const isGrpOpen = !!openGroups[grpKey];
                  const grpVisits = grp.visits || [];
                  const grpCounts = {};
                  grpVisits.forEach(v => { grpCounts[v.status] = (grpCounts[v.status] || 0) + 1; });
                  const grpSummary = [
                    grpCounts.CONFIRMED && `✅ ${grpCounts.CONFIRMED}`,
                    grpCounts.WAITING   && `⏳ ${grpCounts.WAITING}`,
                    grpCounts.PENDING   && `⬜ ${grpCounts.PENDING}`,
                    grpCounts.REJECTED  && `❌ ${grpCounts.REJECTED}`,
                  ].filter(Boolean).join('  ');
                  const delGrpKey = `grp-${hotel.hotelId}-${grp.bookingId}`;
                  return (
                    <div key={grpKey}>
                      <div
                        onClick={() => setOpenGroups(prev => ({ ...prev, [grpKey]: !prev[grpKey] }))}
                        className="w-full px-5 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors cursor-pointer group"
                      >
                        {isGrpOpen
                          ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          : <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        }
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <Link
                            to={`/bookings/${grp.bookingId}`}
                            onClick={e => e.stopPropagation()}
                            className="font-semibold text-sm text-primary-600 hover:underline"
                          >
                            {grp.group}
                          </Link>
                          <span className="text-xs text-gray-400">{grpVisits.length} zaezd</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {grpSummary && <span className="text-xs">{grpSummary}</span>}
                          <button
                            onClick={(e) => handleDeleteGroup(e, hotel.hotelId, grp.bookingId, hotel.tourType)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 hover:text-red-500 text-gray-400 transition-all"
                            title="Guruhni o'chirish"
                          >
                            {deletingKey === delGrpKey
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Trash2 className="w-3.5 h-3.5" />
                            }
                          </button>
                        </div>
                      </div>
                      {isGrpOpen && (
                        <div className="bg-gray-50 border-t border-gray-100 divide-y divide-gray-100">
                          {grpVisits.map(v => {
                            const delVisitKey = `visit-${hotel.hotelId}-${grp.bookingId}-${v.visitIdx}`;
                            return (
                              <div key={v.visitIdx} className="px-8 py-2.5 flex items-center gap-3 group/visit hover:bg-gray-100 transition-colors">
                                <div className="flex-1 min-w-0">
                                  {v.sectionLabel && (
                                    <span className="text-xs font-medium text-gray-500 mr-2">{v.sectionLabel}</span>
                                  )}
                                  <span className="font-mono text-xs text-gray-700">{v.checkIn} → {v.checkOut}</span>
                                  <span className="ml-3 text-xs text-gray-400">{v.pax} pax · DBL:{v.dbl} TWN:{v.twn} SNGL:{v.sngl}</span>
                                </div>
                                {v.confirmedBy && v.status !== 'PENDING' && (
                                  <span className="text-xs text-gray-400 flex-shrink-0">
                                    👤 {v.confirmedBy}
                                    {v.respondedAt && (() => {
                                      const d = new Date(v.respondedAt);
                                      return ` · ${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
                                    })()}
                                  </span>
                                )}
                                <JpStatusBadge status={v.status} />
                                <button
                                  onClick={(e) => handleDeleteVisit(e, hotel.hotelId, grp.bookingId, v.visitIdx, hotel.tourType)}
                                  className="opacity-0 group-hover/visit:opacity-100 p-1 rounded hover:bg-red-50 hover:text-red-500 text-gray-400 transition-all"
                                  title="Zaezdni o'chirish"
                                >
                                  {deletingKey === delVisitKey
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    : <Trash2 className="w-3.5 h-3.5" />
                                  }
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
            )}
          </div>
        );
      })}
    </div>
  );
}

const TOUR_SUB_TABS = ['ER', 'CO', 'KAS', 'ZA'];

const TP_STATUS = {
  PENDING:   { color: 'bg-yellow-100 text-yellow-800', label: 'Kutilmoqda', icon: '🕐' },
  CONFIRMED: { color: 'bg-green-100 text-green-800',   label: 'Tasdiqladi', icon: '✅' },
  REJECTED:  { color: 'bg-red-100 text-red-800',       label: 'Rad qildi',  icon: '❌' },
};

function Transport2026Tab() {
  const [confirmations, setConfirmations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState('ER');

  const load = () => {
    setLoading(true);
    jahresplanungApi.getTransportConfirmations()
      .then(res => setConfirmations(res.data.confirmations || []))
      .catch(() => setConfirmations([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (key) => {
    if (!confirm('O\'chirishni tasdiqlaysizmi?')) return;
    await jahresplanungApi.deleteTransportConfirmation(key).catch(() => {});
    load();
  };

  const fmtDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  const filtered = confirmations.filter(c => c.tourType === subTab);
  const providers = ['sevil', 'xayrulla', 'nosir'];
  const providerLabel = { sevil: 'Sevil', xayrulla: 'Xayrulla', nosir: 'Nosir' };

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex gap-2 mb-4">
        {TOUR_SUB_TABS.map(t => (
          <button key={t} onClick={() => setSubTab(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${subTab === t ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {t}
          </button>
        ))}
        <button onClick={load} className="ml-auto flex items-center gap-1 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 border rounded-lg">
          <RefreshCw className="w-3.5 h-3.5" /> Yangilash
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /><span className="text-sm">Yuklanmoqda...</span>
        </div>
      ) : (
        <div className="space-y-3">
          {providers.map(prov => {
            const rec = filtered.find(c => c.provider === prov);
            const st = TP_STATUS[rec?.status] || TP_STATUS.PENDING;
            return (
              <div key={prov} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-4 px-5 py-3.5 border-b border-gray-100 bg-gray-50">
                  <Bus className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <span className="font-semibold text-gray-800">{providerLabel[prov]}</span>
                  {rec ? (
                    <span className={`ml-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${st.color}`}>
                      {st.icon} {st.label}
                    </span>
                  ) : (
                    <span className="ml-2 text-xs text-gray-400">Hali yuborilmagan</span>
                  )}
                  {rec && (
                    <button onClick={() => handleDelete(`${rec.year}_${rec.tourType}_${rec.provider}`)}
                      className="ml-auto text-gray-300 hover:text-red-400 transition-colors" title="O'chirish">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {rec && (
                  <div className="px-5 py-3 text-sm text-gray-600 grid grid-cols-2 gap-x-6 gap-y-1.5">
                    <div className="flex gap-2">
                      <span className="text-gray-400 text-xs w-24 flex-shrink-0">Yuborildi:</span>
                      <span className="text-xs">{fmtDate(rec.sentAt)}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-gray-400 text-xs w-24 flex-shrink-0">Javob berdi:</span>
                      <span className="text-xs">{fmtDate(rec.respondedAt)}</span>
                    </div>
                    {rec.confirmedBy && (
                      <div className="flex gap-2 col-span-2">
                        <span className="text-gray-400 text-xs w-24 flex-shrink-0">Kim:</span>
                        <span className="text-xs font-medium text-gray-700">{rec.confirmedBy}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
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
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('partners_activeTab') || 'hotels');
  const [hotelSubTab, setHotelSubTab] = useState('ER');
  const [transportSubTab, setTransportSubTab] = useState('ER');
  const [restoranSubTab, setRestoranSubTab] = useState('ER');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [transportSearchQuery, setTransportSearchQuery] = useState('');
  const [transportStatusFilter, setTransportStatusFilter] = useState('ALL');
  const [restoranSearchQuery, setRestoranSearchQuery] = useState('');
  const [restoranStatusFilter, setRestoranStatusFilter] = useState('ALL');
  const [gidlarSubTab, setGidlarSubTab] = useState('ER');
  const [gidlarSearchQuery, setGidlarSearchQuery] = useState('');
  const [gidlarStatusFilter, setGidlarStatusFilter] = useState('ALL');
  const [guideAssignments, setGuideAssignments] = useState([]);
  const [transportConfirmations, setTransportConfirmations] = useState([]);
  const [mealConfirmations, setMealConfirmations] = useState([]);
  const [confirmations, setConfirmations] = useState([]);
  const [jpSections, setJpSections] = useState([]);
  const [hotels2026SubTab, setHotels2026SubTab] = useState('ER');
  const [restoran2026SubTab, setRestoran2026SubTab] = useState('ER');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [countdown, setCountdown] = useState(AUTO_REFRESH_SEC);
  const countdownRef = useRef(null);
  const refreshRef = useRef(null);

  // Telegram Finder
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
      // silent
    } finally {
      setTelegramLoading(false);
    }
  };

  const copyChatId = (chatId) => {
    navigator.clipboard.writeText(chatId);
    setCopiedChatId(chatId);
    setTimeout(() => setCopiedChatId(null), 2000);
  };

  const loadConfirmations = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [hotelRes, transportRes, mealRes, guideRes, jpRes] = await Promise.all([
        telegramApi.getConfirmations(),
        telegramApi.getTransportConfirmations(),
        telegramApi.getMealConfirmations(),
        telegramApi.getGuideAssignments(),
        jahresplanungApi.getJpSections(),
      ]);
      setConfirmations(hotelRes.data.confirmations || []);
      setTransportConfirmations(transportRes.data.confirmations || []);
      setMealConfirmations(mealRes.data.confirmations || []);
      setGuideAssignments(guideRes.data.assignments || []);
      setJpSections(jpRes.data.sections || []);
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
        <div className="flex items-center gap-2">
          <button
            onClick={openTelegramFinder}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-sky-500 hover:bg-sky-600 text-white rounded-lg font-semibold transition-colors"
            title="Telegram Chat ID topish"
          >
            <Send className="w-4 h-4" />
            Telegram Finder
          </button>
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
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); localStorage.setItem('partners_activeTab', tab.id); }}
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
          {activeTab === 'restoran' && (() => {
            const rCounts = {};
            mealConfirmations.forEach(c => {
              const type = (c.booking?.bookingNumber || '').split('-')[0] || '?';
              rCounts[type] = (rCounts[type] || 0) + 1;
            });
            const rq = restoranSearchQuery.trim().toLowerCase();
            const rFiltered = mealConfirmations.filter(c => {
              if (!(c.booking?.bookingNumber || '').startsWith(restoranSubTab + '-')) return false;
              if (restoranStatusFilter !== 'ALL' && c.status !== restoranStatusFilter) return false;
              if (rq) {
                const bookingNum = (c.booking?.bookingNumber || '').toLowerCase();
                const restName = (c.restaurant?.name || c.restaurantName || '').toLowerCase();
                if (!bookingNum.includes(rq) && !restName.includes(rq)) return false;
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
                      onClick={() => setRestoranSubTab(sub)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        restoranSubTab === sub
                          ? 'bg-gray-800 text-white'
                          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {sub}
                      {rCounts[sub] ? (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          restoranSubTab === sub ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {rCounts[sub]}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>

                {/* Search + Status filter */}
                <div className="flex flex-wrap gap-3 mb-4">
                  <div className="relative flex-1 min-w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input
                      type="text"
                      value={restoranSearchQuery}
                      onChange={e => setRestoranSearchQuery(e.target.value)}
                      placeholder="Booking raqami yoki restoran nomi..."
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    {restoranSearchQuery && (
                      <button
                        onClick={() => setRestoranSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {STATUS_FILTERS.filter(sf => ['ALL','PENDING','CONFIRMED','REJECTED'].includes(sf.id)).map(sf => (
                      <button
                        key={sf.id}
                        onClick={() => setRestoranStatusFilter(sf.id)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                          restoranStatusFilter === sf.id
                            ? 'bg-primary-600 text-white'
                            : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {sf.label}
                      </button>
                    ))}
                  </div>
                </div>

                {(rq || restoranStatusFilter !== 'ALL') && (
                  <p className="text-xs text-gray-400 mb-3">{rFiltered.length} ta natija topildi</p>
                )}

                <RestoranTab
                  confirmations={rFiltered}
                  onDelete={(id) => setMealConfirmations(prev => prev.filter(c => c.id !== id))}
                />
              </>
            );
          })()}
          {activeTab === 'transport' && (() => {
            const trCounts = {};
            transportConfirmations.forEach(c => {
              const type = (c.booking?.bookingNumber || '').split('-')[0] || '?';
              trCounts[type] = (trCounts[type] || 0) + 1;
            });
            const tq = transportSearchQuery.trim().toLowerCase();
            const trFiltered = transportConfirmations.filter(c => {
              if (!(c.booking?.bookingNumber || '').startsWith(transportSubTab + '-')) return false;
              if (transportStatusFilter !== 'ALL' && c.status !== transportStatusFilter) return false;
              if (tq) {
                const bookingNum = (c.booking?.bookingNumber || '').toLowerCase();
                const provider = (c.provider || '').toLowerCase();
                if (!bookingNum.includes(tq) && !provider.includes(tq)) return false;
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

                {/* Search + Status filter */}
                <div className="flex flex-wrap gap-3 mb-4">
                  <div className="relative flex-1 min-w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input
                      type="text"
                      value={transportSearchQuery}
                      onChange={e => setTransportSearchQuery(e.target.value)}
                      placeholder="Booking raqami yoki provayder nomi..."
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    {transportSearchQuery && (
                      <button
                        onClick={() => setTransportSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {STATUS_FILTERS.map(sf => (
                      <button
                        key={sf.id}
                        onClick={() => setTransportStatusFilter(sf.id)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                          transportStatusFilter === sf.id
                            ? 'bg-primary-600 text-white'
                            : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {sf.label}
                      </button>
                    ))}
                  </div>
                </div>

                {(tq || transportStatusFilter !== 'ALL') && (
                  <p className="text-xs text-gray-400 mb-3">{trFiltered.length} ta natija topildi</p>
                )}

                <TransportTab
                  confirmations={trFiltered}
                  onDelete={(id) => setTransportConfirmations(prev => prev.filter(c => c.id !== id))}
                />
              </>
            );
          })()}
          {activeTab === 'gidlar' && (() => {
            const gCounts = {};
            guideAssignments.forEach(a => {
              const type = (a.bookingNumber || '').split('-')[0] || '?';
              gCounts[type] = (gCounts[type] || 0) + 1;
            });
            const gq = gidlarSearchQuery.trim().toLowerCase();
            const gFiltered = guideAssignments.filter(a => {
              if (!(a.bookingNumber || '').startsWith(gidlarSubTab + '-')) return false;
              if (gidlarStatusFilter !== 'ALL' && a.status !== gidlarStatusFilter) return false;
              if (gq) {
                const bookingNum = (a.bookingNumber || '').toLowerCase();
                const guideName = (a.guideName || '').toLowerCase();
                if (!bookingNum.includes(gq) && !guideName.includes(gq)) return false;
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
                      onClick={() => setGidlarSubTab(sub)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        gidlarSubTab === sub
                          ? 'bg-gray-800 text-white'
                          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {sub}
                      {gCounts[sub] ? (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          gidlarSubTab === sub ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {gCounts[sub]}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>

                {/* Search + Status filter */}
                <div className="flex flex-wrap gap-3 mb-4">
                  <div className="relative flex-1 min-w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input
                      type="text"
                      value={gidlarSearchQuery}
                      onChange={e => setGidlarSearchQuery(e.target.value)}
                      placeholder="Booking raqami yoki gid ismi..."
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    {gidlarSearchQuery && (
                      <button
                        onClick={() => setGidlarSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {[
                      { id: 'ALL',      label: 'Barchasi' },
                      { id: 'ASSIGNED', label: '✅ Tayinlandi' },
                      { id: 'NO_GUIDE', label: '— Gid yo\'q' },
                    ].map(sf => (
                      <button
                        key={sf.id}
                        onClick={() => setGidlarStatusFilter(sf.id)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                          gidlarStatusFilter === sf.id
                            ? 'bg-primary-600 text-white'
                            : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {sf.label}
                      </button>
                    ))}
                  </div>
                </div>

                {(gq || gidlarStatusFilter !== 'ALL') && (
                  <p className="text-xs text-gray-400 mb-3">{gFiltered.length} ta natija topildi</p>
                )}

                <GidlarTab assignments={gFiltered} />
              </>
            );
          })()}
          {activeTab === 'hotels2026' && (() => {
            const h2Counts = {};
            jpSections.forEach(s => {
              h2Counts[s.tourType] = (h2Counts[s.tourType] || 0) + 1;
            });
            return (
              <>
                {/* Sub-tabs */}
                <div className="flex gap-1 mb-4">
                  {HOTEL_SUB_TABS.map(sub => (
                    <button
                      key={sub}
                      onClick={() => setHotels2026SubTab(sub)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        hotels2026SubTab === sub
                          ? 'bg-gray-800 text-white'
                          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {sub}
                      {h2Counts[sub] ? (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          hotels2026SubTab === sub ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {h2Counts[sub]}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
                <Hotels2026Tab
                  sections={jpSections}
                  subTab={hotels2026SubTab}
                  onDeleteHotel={async (hotelId, tourType) => {
                    await jahresplanungApi.deleteJpHotel(hotelId, tourType);
                    setJpSections(prev => prev.filter(s => !(s.hotelId === hotelId && s.tourType === tourType)));
                  }}
                  onDeleteGroup={async (hotelId, bookingId, tourType) => {
                    if (!window.confirm('Bu guruhni o\'chirishni tasdiqlaysizmi?')) return;
                    await jahresplanungApi.deleteJpGroup(hotelId, bookingId, tourType);
                    setJpSections(prev => prev.map(s => {
                      if (s.hotelId !== hotelId || s.tourType !== tourType) return s;
                      return { ...s, groups: (s.groups || []).filter(g => g.bookingId !== bookingId) };
                    }));
                  }}
                  onDeleteVisit={async (hotelId, bookingId, visitIdx, tourType) => {
                    if (!window.confirm('Bu zaezdni o\'chirishni tasdiqlaysizmi?')) return;
                    await jahresplanungApi.deleteJpVisit(hotelId, bookingId, visitIdx, tourType);
                    setJpSections(prev => prev.map(s => {
                      if (s.hotelId !== hotelId || s.tourType !== tourType) return s;
                      const groups = (s.groups || []).map(g => {
                        if (g.bookingId !== bookingId) return g;
                        return { ...g, visits: (g.visits || []).filter(v => v.visitIdx !== visitIdx) };
                      }).filter(g => g.visits && g.visits.length > 0);
                      return { ...s, groups };
                    }));
                  }}
                />
              </>
            );
          })()}
          {activeTab === 'restoran2026' && (() => {
            const TOUR_TYPES = ['ER', 'CO', 'KAS', 'ZA'];
            const r2Counts = {};
            mealConfirmations.forEach(c => {
              const tt = c.booking?.tourType?.code;
              if (tt) r2Counts[tt] = (r2Counts[tt] || 0) + 1;
            });
            return (
              <>
                <div className="flex gap-1 mb-4">
                  {TOUR_TYPES.map(sub => (
                    <button
                      key={sub}
                      onClick={() => setRestoran2026SubTab(sub)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        restoran2026SubTab === sub
                          ? 'bg-gray-800 text-white'
                          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {sub}
                      {r2Counts[sub] ? (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          restoran2026SubTab === sub ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {r2Counts[sub]}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
                <Restoran2026Tab
                  mealConfirmations={mealConfirmations}
                  subTab={restoran2026SubTab}
                  onDelete={(id) => setMealConfirmations(prev => prev.filter(c => c.id !== id))}
                />
              </>
            );
          })()}
          {activeTab === 'transport2026' && <Transport2026Tab />}
        </>
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
