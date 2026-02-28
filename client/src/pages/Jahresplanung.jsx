import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import toast from 'react-hot-toast';
import {
  Building2, UtensilsCrossed, Bus, Download, Mail, Send,
  ChevronDown, ChevronRight, Loader2, MapPin, ArrowRightLeft, Plus, X
} from 'lucide-react';
import { jahresplanungApi } from '../services/api';
import { useYear } from '../context/YearContext';
const TOUR_TYPES = ['ER', 'CO', 'KAS', 'ZA'];
const MAIN_TABS = [
  { id: 'hotels',   label: 'Hotels',   icon: Building2,      color: '#7c3aed', bg: '#f5f3ff' },
  { id: 'restoran', label: 'Restoran', icon: UtensilsCrossed, color: '#be185d', bg: '#fdf2f8' },
  { id: 'transport',label: 'Transport',icon: Bus,             color: '#1d4ed8', bg: '#eff6ff' },
];
const TOUR_NAMES  = { ER: 'Erlebnisreisen', CO: 'ComfortPlus', KAS: 'Kasachstan', ZA: 'Zentralasien' };
const TOUR_COLORS = { ER: '#3B82F6', CO: '#10B981', KAS: '#F59E0B', ZA: '#8B5CF6' };
const CITY_ORDER = {
  ER:  ['Tashkent', 'Fergana', 'Samarkand', 'Asraf', 'Bukhara', 'Khiva'],
  CO:  ['Tashkent', 'Fergana', 'Samarkand', 'Asraf', 'Bukhara', 'Khiva'],
  KAS: ['Fergana', 'Bukhara', 'Samarkand', 'Tashkent'],
  ZA:  ['Bukhara', 'Samarkand', 'Tashkent'],
};

function getCityOrder(city, tourType) {
  const order = CITY_ORDER[tourType] || CITY_ORDER.ER;
  const i = order.indexOf(city);
  return i === -1 ? 999 : i;
}

// City-level key for hotel assignment: which hotel this booking goes to within a city
function cityAssignKey(cityName, b) {
  return `${cityName}_${b.bookingId}_${new Date(b.checkInDate).toISOString().slice(0, 10)}`;
}

// Compute effective hotel list for a city (original + extras) with bookings distributed by assignments
function computeCityHotels(cityName, originalHotels, cityExtraHotels, bookingHotelAssign, allHotels) {
  const extraIds = cityExtraHotels[cityName] || [];
  const extraObjs = extraIds
    .map(id => allHotels.find(h => h.id === id))
    .filter(Boolean)
    .filter(h => !originalHotels.find(oh => oh.hotel.id === h.id))
    .map(h => ({ hotel: h, bookings: [], isExtra: true }));

  const allDisplay = [...originalHotels.map(h => ({ ...h, isExtra: false })), ...extraObjs];

  // Pre-compute visitIndex for every row across all original hotels
  // visitIndex = 0 (first stay), 1 (second stay) based on checkInDate order per booking
  const visitIndexMap = {}; // `${bookingId}_${checkIn_iso}` → index
  for (const hd of originalHotels) {
    const byBookingId = {};
    for (const b of hd.bookings) {
      if (!byBookingId[b.bookingId]) byBookingId[b.bookingId] = [];
      byBookingId[b.bookingId].push(b);
    }
    for (const rows of Object.values(byBookingId)) {
      rows.sort((a, b) => new Date(a.checkInDate) - new Date(b.checkInDate));
      rows.forEach((r, i) => {
        visitIndexMap[`${r.bookingId}_${new Date(r.checkInDate).toISOString().slice(0, 10)}`] = i;
      });
    }
  }

  // Collect all unique bookings from original hotels (with visitIndex)
  const allBookings = [];
  const seen = new Set();
  for (const hd of originalHotels) {
    for (const b of hd.bookings) {
      const iso = new Date(b.checkInDate).toISOString().slice(0, 10);
      const k = `${b.bookingId}_${iso}`;
      if (!seen.has(k)) {
        seen.add(k);
        const visitIndex = visitIndexMap[k] ?? 0;
        allBookings.push({ ...b, originalHotelId: hd.hotel.id, visitIndex });
      }
    }
  }

  // Distribute bookings to hotels
  const map = {};
  for (const hd of allDisplay) map[hd.hotel.id] = [];

  for (const b of allBookings) {
    const ck = cityAssignKey(cityName, b);
    const targetId = bookingHotelAssign[ck] ?? b.originalHotelId;
    if (map[targetId] !== undefined) map[targetId].push(b);
    else map[b.originalHotelId]?.push(b);
  }

  return allDisplay.map(hd => ({ ...hd, bookings: map[hd.hotel.id] || [] }));
}

function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.${dt.getFullYear()}`;
}

// Split bookings into first/second/third visits.
// If bookings have visitIndex (from computeCityHotels), use it directly.
// Otherwise fall back to count-based split (original behavior).
function splitVisits(bookings) {
  const sortFn = (a, b) => a.bookingNumber.localeCompare(b.bookingNumber) || new Date(a.checkInDate) - new Date(b.checkInDate);
  if (bookings.length > 0 && 'visitIndex' in bookings[0]) {
    const first  = bookings.filter(b => (b.visitIndex ?? 0) === 0).sort(sortFn);
    const second = bookings.filter(b => b.visitIndex === 1).sort(sortFn);
    const third  = bookings.filter(b => b.visitIndex === 2).sort(sortFn);
    return { first, second, third, hasSplit: second.length > 0, hasThird: third.length > 0 };
  }
  // Fallback: count-based
  const byBooking = {};
  bookings.forEach(b => {
    if (!byBooking[b.bookingId]) byBooking[b.bookingId] = [];
    byBooking[b.bookingId].push(b);
  });
  Object.values(byBooking).forEach(arr =>
    arr.sort((a, b) => new Date(a.checkInDate) - new Date(b.checkInDate))
  );
  const sortedIds = Object.keys(byBooking).sort((a, b) =>
    byBooking[a][0].bookingNumber.localeCompare(byBooking[b][0].bookingNumber)
  );
  const first = [], second = [], third = [];
  sortedIds.forEach(id => {
    first.push(byBooking[id][0]);
    if (byBooking[id][1]) second.push(byBooking[id][1]);
    if (byBooking[id][2]) third.push(byBooking[id][2]);
  });
  return { first, second, third, hasSplit: second.length > 0, hasThird: third.length > 0 };
}

// Row key for override state
function rowKey(hotelId, b) {
  return `${hotelId}_${b.bookingId}_${b.checkInDate}`;
}

// Click-to-edit numeric cell
function EditCell({ value, onChange }) {
  const [editing, setEditing] = useState(false);
  const [tmp, setTmp] = useState(String(value ?? 0));

  useEffect(() => { setTmp(String(value ?? 0)); }, [value]);

  const commit = () => {
    const parsed = parseInt(tmp);
    onChange(isNaN(parsed) ? 0 : parsed);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        type="number" min="0"
        value={tmp}
        onChange={e => setTmp(e.target.value)}
        onBlur={commit}
        onKeyDown={e => e.key === 'Enter' && commit()}
        className="w-14 text-center border border-blue-400 rounded px-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
        autoFocus
      />
    );
  }
  return (
    <span
      onClick={() => setEditing(true)}
      className="cursor-pointer hover:bg-amber-50 hover:text-amber-700 rounded px-1 py-0.5 transition-colors select-none"
      title="Tahrirlash uchun bosing"
    >
      {value ?? 0}
    </span>
  );
}

// Status dropdown cell — bitta ustunda OK/WL/✕ tanlov
const STATUS_OPTIONS = [
  { value: 'confirmed', label: 'OK', activeCls: 'bg-green-500 text-white', idleCls: 'bg-green-50 text-green-700 hover:bg-green-100' },
  { value: 'waiting',   label: 'WL', activeCls: 'bg-amber-400 text-white', idleCls: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
  { value: 'cancelled', label: '✕',  activeCls: 'bg-red-500 text-white',   idleCls: 'bg-red-50 text-red-700 hover:bg-red-100' },
];
function StatusCell({ k, rowStatuses, setRowStatus }) {
  const [open, setOpen] = useState(false);
  const status = rowStatuses[k];
  const current = STATUS_OPTIONS.find(o => o.value === status);
  return (
    <div className="relative flex justify-center">
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
      <button
        onClick={() => setOpen(v => !v)}
        className={`px-2 py-0.5 rounded text-xs font-bold min-w-[30px] transition-colors ${
          current ? current.activeCls : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
        }`}
      >
        {current ? current.label : '—'}
      </button>
      {open && (
        <div className="absolute top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-xl p-1.5 flex gap-1">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { setRowStatus(k, status === opt.value ? null : opt.value); setOpen(false); }}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-colors ${
                status === opt.value ? opt.activeCls : opt.idleCls
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Small hotel-switch button in each row (shown when city has 2+ hotels)
function HotelSwitcher({ cityKey, currentHotelId, cityHotels, onMove }) {
  const [open, setOpen] = useState(false);
  const others = cityHotels.filter(h => h.hotel.id !== currentHotelId);
  if (others.length === 0) return null;
  return (
    <div className="relative inline-block">
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
      <button
        onClick={() => setOpen(v => !v)}
        title="Hotelni almashtirish"
        className="text-gray-300 hover:text-blue-500 transition-colors ml-1"
      >
        <ArrowRightLeft className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-xl py-1 min-w-[170px]">
          <div className="px-3 py-1 text-xs text-gray-400 font-medium border-b border-gray-100">Ko'chirish →</div>
          {others.map(h => (
            <button
              key={h.hotel.id}
              onClick={() => { onMove(cityKey, h.hotel.id); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 text-gray-700 flex items-center gap-2"
            >
              <Building2 className="w-3 h-3 text-blue-400 flex-shrink-0" />
              {h.hotel.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Hotel replace/swap button — shown on every hotel card header (fixed positioning)
function HotelSwapButton({ currentHotelId, availableHotels, onReplace }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  if (availableHotels.length === 0) return null;

  const handleOpen = (e) => {
    e.stopPropagation();
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX });
    }
    setOpen(v => !v);
  };

  return (
    <div className="inline-block">
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
      <button
        ref={btnRef}
        onClick={handleOpen}
        title="Hotelni almashtirish"
        className="p-1 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
      >
        <ArrowRightLeft className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div
          style={{ position: 'fixed', top: pos.top, left: pos.left }}
          className="z-50 bg-white border border-gray-200 rounded-lg shadow-xl py-1 min-w-[230px] max-h-52 overflow-y-auto"
        >
          <div className="px-3 py-1.5 text-xs text-gray-400 font-medium border-b border-gray-100">Hotel almashtirish →</div>
          {availableHotels.map(h => (
            <button
              key={h.id}
              onClick={() => { onReplace(h); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 text-gray-700"
            >
              <span className="font-medium">{h.name}</span>
              {h.city?.name && h.city.name !== availableHotels[0]?.city?.name && (
                <span className="text-gray-400 ml-1">({h.city.name})</span>
              )}
              {h.email && <div className="text-gray-400">{h.email}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Add extra hotel button for a city (uses fixed positioning to escape overflow:hidden parents)
function AddHotelButton({ cityName, availableHotels, onAdd }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  if (availableHotels.length === 0) return null;

  const handleOpen = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX });
    }
    setOpen(v => !v);
  };

  return (
    <div className="inline-block">
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded-lg border border-dashed border-blue-200 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> Hotel qo'shish
      </button>
      {open && (
        <div
          style={{ position: 'fixed', top: pos.top, left: pos.left }}
          className="z-50 bg-white border border-gray-200 rounded-lg shadow-xl py-1 min-w-[220px] max-h-52 overflow-y-auto"
        >
          {availableHotels.map(h => (
            <button
              key={h.id}
              onClick={() => { onAdd(h); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-gray-700"
            >
              <span className="font-medium">{h.name}</span>
              {h.email && <span className="text-gray-400 ml-1.5">{h.email}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Booking table for one visit group (Первый заезд or Второй заезд or no split)
function BookingsTable({ bookings, hotelId, overrides, setOverrideVal, rowStatuses, setRowStatus, visitLabel,
  cityName, cityHotels, onMoveBooking }) {
  const getVal = (b, field) => {
    const k = rowKey(hotelId, b);
    return overrides[k]?.[field] !== undefined ? overrides[k][field] : (b[field] ?? 0);
  };
  const setVal = (b, field, val) => setOverrideVal(rowKey(hotelId, b), field, val);

  const active = bookings.filter(b => b.status !== 'CANCELLED');
  const totalPax = active.reduce((s, b) => s + getVal(b, 'pax'), 0);
  const totalDbl = active.reduce((s, b) => s + getVal(b, 'dbl'), 0);
  const totalTwn = active.reduce((s, b) => s + getVal(b, 'twn'), 0);
  const totalSngl = active.reduce((s, b) => s + getVal(b, 'sngl'), 0);
  const totalRooms = totalDbl + totalTwn + totalSngl;

  return (
    <div className="border-t border-gray-100">
      {visitLabel && (
        <div className="bg-indigo-50 px-4 py-1.5 text-xs font-semibold text-indigo-700 uppercase tracking-wider border-b border-indigo-100">
          {visitLabel}
        </div>
      )}
      {/* MOBILE: card view */}
      <div className="md:hidden divide-y divide-gray-100">
        {bookings.map(b => {
          const cancelled = b.status === 'CANCELLED';
          const pax = getVal(b, 'pax');
          const dbl = getVal(b, 'dbl');
          const twn = getVal(b, 'twn');
          const sngl = getVal(b, 'sngl');
          const k = rowKey(hotelId, b);
          const cardBg = rowStatuses[k] === 'confirmed' ? 'bg-green-50'
                       : rowStatuses[k] === 'waiting'   ? 'bg-amber-50'
                       : rowStatuses[k] === 'cancelled' ? 'bg-red-100'
                       : cancelled ? 'bg-red-50' : 'bg-white';
          return (
            <div key={k} className={`p-3 ${cardBg}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Link
                    to={`/bookings/${b.bookingId}`}
                    className={`font-bold text-sm ${cancelled ? 'text-red-400 line-through' : 'text-primary-600 hover:underline'}`}
                  >
                    {b.bookingNumber}
                  </Link>
                  {cancelled && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">СТОРНО</span>}
                  {!cancelled && cityHotels && cityHotels.length > 1 && (
                    <HotelSwitcher cityKey={cityAssignKey(cityName, b)} currentHotelId={hotelId} cityHotels={cityHotels} onMove={onMoveBooking} />
                  )}
                </div>
                <StatusCell k={k} rowStatuses={rowStatuses} setRowStatus={setRowStatus} />
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                <span className="font-medium">{formatDate(b.checkInDate)}</span>
                <span className="text-gray-400">→</span>
                <span className="font-medium">{formatDate(b.checkOutDate)}</span>
                <span className="ml-auto bg-gray-100 px-2 py-0.5 rounded-full text-gray-700 font-semibold whitespace-nowrap">{b.nights || '—'} ночей</span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {[
                  { label: 'PAX', field: 'pax', val: pax },
                  { label: 'DBL', field: 'dbl', val: dbl },
                  { label: 'TWN', field: 'twn', val: twn },
                  { label: 'SNGL', field: 'sngl', val: sngl },
                ].map(({ label, field, val }) => (
                  <div key={field} className="text-center bg-white/60 rounded-lg py-1 border border-gray-100">
                    <div className="text-gray-400 text-xs mb-0.5">{label}</div>
                    {cancelled ? (
                      <span className="text-xs font-bold text-red-400">{val}</span>
                    ) : (
                      <EditCell value={val} onChange={v => setVal(b, field, v)} />
                    )}
                  </div>
                ))}
              </div>
              <div className="text-right text-xs mt-1.5 text-gray-500">
                Итого: <span className="font-bold text-gray-800">{cancelled ? 0 : (dbl + twn + sngl) || '—'}</span>
              </div>
            </div>
          );
        })}
        <div className="bg-blue-50 border-t-2 border-blue-100 px-3 py-2">
          <div className="text-xs text-gray-500 mb-1">Итого ({active.length} группы, аннуляции не считаются)</div>
          <div className="grid grid-cols-5 gap-1 text-xs text-center">
            <div><div className="text-gray-400">PAX</div><div className="font-bold text-blue-700">{totalPax || '—'}</div></div>
            <div><div className="text-gray-400">DBL</div><div className="font-bold text-blue-700">{totalDbl || '—'}</div></div>
            <div><div className="text-gray-400">TWN</div><div className="font-bold text-blue-700">{totalTwn || '—'}</div></div>
            <div><div className="text-gray-400">SNGL</div><div className="font-bold text-blue-700">{totalSngl || '—'}</div></div>
            <div><div className="text-gray-400">Итого</div><div className="font-bold text-blue-700">{totalRooms || '—'}</div></div>
          </div>
        </div>
      </div>
      {/* DESKTOP: table */}
      <div className="hidden md:block">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider">
            <th className="px-4 py-2 text-left font-medium">Группа</th>
            <th className="px-4 py-2 text-left font-medium">Заезд</th>
            <th className="px-4 py-2 text-left font-medium">Выезд</th>
            <th className="px-4 py-2 text-center font-medium">Ночей</th>
            <th className="px-4 py-2 text-center font-medium">PAX</th>
            <th className="px-4 py-2 text-center font-medium">DBL</th>
            <th className="px-4 py-2 text-center font-medium">TWN</th>
            <th className="px-4 py-2 text-center font-medium">SNGL</th>
            <th className="px-4 py-2 text-center font-medium">Итого</th>
            <th className="px-3 py-2 text-center font-medium text-gray-500">Статус</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map(b => {
            const cancelled = b.status === 'CANCELLED';
            const pax = getVal(b, 'pax');
            const dbl = getVal(b, 'dbl');
            const twn = getVal(b, 'twn');
            const sngl = getVal(b, 'sngl');
            const k = rowKey(hotelId, b);
            const localStatus = rowStatuses[k];

            const rowBg = localStatus === 'confirmed' ? 'bg-green-50'
                        : localStatus === 'waiting'   ? 'bg-amber-50'
                        : localStatus === 'cancelled' ? 'bg-red-100'
                        : cancelled                   ? 'bg-red-50'
                        :                               'hover:bg-gray-50';

            return (
              <tr key={k} className={`border-b transition-colors ${rowBg}`}>
                <td className="px-4 py-1.5">
                  <div className="flex items-center">
                    <Link
                      to={`/bookings/${b.bookingId}`}
                      className={`font-medium text-sm ${cancelled ? 'text-red-400 line-through' : 'text-primary-600 hover:underline'}`}
                    >
                      {b.bookingNumber}
                    </Link>
                    {cancelled && (
                      <span className="ml-2 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">СТОРНО</span>
                    )}
                    {!cancelled && cityHotels && cityHotels.length > 1 && (
                      <HotelSwitcher
                        cityKey={cityAssignKey(cityName, b)}
                        currentHotelId={hotelId}
                        cityHotels={cityHotels}
                        onMove={onMoveBooking}
                      />
                    )}
                  </div>
                </td>
                <td className="px-4 py-1.5 text-gray-600 text-sm">{formatDate(b.checkInDate)}</td>
                <td className="px-4 py-1.5 text-gray-600 text-sm">{formatDate(b.checkOutDate)}</td>
                <td className="px-4 py-1.5 text-center text-gray-600 text-sm">{b.nights || '—'}</td>
                <td className={`px-4 py-1.5 text-center font-medium text-sm ${cancelled ? 'text-red-400' : ''}`}>
                  {cancelled ? pax : <EditCell value={pax} onChange={v => setVal(b, 'pax', v)} />}
                </td>
                <td className="px-4 py-1.5 text-center text-gray-600 text-sm">
                  {cancelled ? dbl : <EditCell value={dbl} onChange={v => setVal(b, 'dbl', v)} />}
                </td>
                <td className="px-4 py-1.5 text-center text-gray-600 text-sm">
                  {cancelled ? twn : <EditCell value={twn} onChange={v => setVal(b, 'twn', v)} />}
                </td>
                <td className="px-4 py-1.5 text-center text-gray-600 text-sm">
                  {cancelled ? sngl : <EditCell value={sngl} onChange={v => setVal(b, 'sngl', v)} />}
                </td>
                <td className="px-4 py-1.5 text-center font-medium text-gray-700 text-sm">
                  {cancelled ? 0 : (dbl + twn + sngl) || '—'}
                </td>
                <td className="px-3 py-1.5 text-center">
                  <StatusCell k={k} rowStatuses={rowStatuses} setRowStatus={setRowStatus} />
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-blue-50 font-semibold text-sm border-t-2 border-blue-100">
            <td className="px-4 py-2 text-gray-500 text-xs" colSpan={4}>
              Итого ({active.length} группы, аннуляции не считаются)
            </td>
            <td className="px-4 py-2 text-center text-blue-700">{totalPax || '—'}</td>
            <td className="px-4 py-2 text-center text-blue-700">{totalDbl || '—'}</td>
            <td className="px-4 py-2 text-center text-blue-700">{totalTwn || '—'}</td>
            <td className="px-4 py-2 text-center text-blue-700">{totalSngl || '—'}</td>
            <td className="px-4 py-2 text-center text-blue-700">{totalRooms || '—'}</td>
            <td />
          </tr>
        </tfoot>
      </table>
      </div>
    </div>
  );
}

const TOUR_COUNTRY = { ER: 'Германия', CO: 'Германия', KAS: 'Казахстан', ZA: 'Германия' };

// Build structured data for server-side PDF generation
function buildPdfPayload(hotelData, tourType, overrides, year) {
  const { hotel, bookings } = hotelData;
  const country = TOUR_COUNTRY[tourType] || 'Германия';

  const resolved = bookings.map(b => {
    const k = rowKey(hotel.id, b);
    const o = overrides[k] || {};
    const cancelled = b.status === 'CANCELLED';
    return {
      ...b,
      pax:  cancelled ? 0 : (o.pax  !== undefined ? o.pax  : (b.pax  || 0)),
      dbl:  cancelled ? 0 : (o.dbl  !== undefined ? o.dbl  : (b.dbl  || 0)),
      twn:  cancelled ? 0 : (o.twn  !== undefined ? o.twn  : (b.twn  || 0)),
      sngl: cancelled ? 0 : (o.sngl !== undefined ? o.sngl : (b.sngl || 0)),
    };
  });

  // Cancelled bookings are excluded from PDF (not relevant for hotel pre-booking)
  const activeResolved = resolved.filter(b => b.status !== 'CANCELLED');

  const { first, second, third, hasSplit, hasThird } = splitVisits(activeResolved);

  function buildSection(rows, label) {
    const dataRows = rows.map((b, i) => ({
      no: i + 1, group: b.bookingNumber, bookingId: b.bookingId, country,
      pax: b.pax || 0,
      checkIn: formatDate(b.checkInDate), checkOut: formatDate(b.checkOutDate),
      dbl: b.dbl || 0, twn: b.twn || 0, sngl: b.sngl || 0,
      cancelled: false,
    }));
    return { label: label || null, rows: dataRows };
  }

  const sections = hasSplit
    ? [buildSection(first, 'Первый заезд'), buildSection(second, 'Второй заезд'),
       ...(hasThird ? [buildSection(third, 'Третий заезд')] : [])]
    : [buildSection(activeResolved, null)];

  return { hotelName: hotel.name, cityName: hotel.city?.name || '', tourType, year, sections };
}

// Fetch PDF blob from server
async function fetchHotelPdfBlob(hotelData, tourType, overrides, year) {
  const payload = buildPdfPayload(hotelData, tourType, overrides, year);
  const res = await jahresplanungApi.generatePDF(payload);
  return new Blob([res.data], { type: 'application/pdf' });
}

// Legacy stub — replaced by server-side PDF (kept to avoid breaking callers during transition)
function generateHotelPDF(hotelData, tourType, overrides, logoDataUrl, returnBlob = false, year = new Date().getFullYear()) {
  const { hotel, bookings } = hotelData;
  const PW = 210, M = 15; // portrait A4, margins

  // Apply overrides
  const resolved = bookings.map(b => {
    const k = rowKey(hotel.id, b);
    const o = overrides[k] || {};
    const cancelled = b.status === 'CANCELLED';
    return {
      ...b,
      pax:  cancelled ? 0 : (o.pax  !== undefined ? o.pax  : (b.pax  || 0)),
      dbl:  cancelled ? 0 : (o.dbl  !== undefined ? o.dbl  : (b.dbl  || 0)),
      twn:  cancelled ? 0 : (o.twn  !== undefined ? o.twn  : (b.twn  || 0)),
      sngl: cancelled ? 0 : (o.sngl !== undefined ? o.sngl : (b.sngl || 0)),
    };
  });

  const activeResolved = resolved.filter(b => b.status !== 'CANCELLED');
  const { first, second, third, hasSplit, hasThird } = splitVisits(activeResolved);
  const tourLabel = TOUR_NAMES[tourType] || tourType;
  const country = TOUR_COUNTRY[tourType] || 'Германия';
  const today = formatDate(new Date().toISOString());

  const doc = new jsPDF({ orientation: 'portrait', format: 'a4' });
  let y = 12;

  // ── 1. Logo ──────────────────────────────────────────────────────────────
  if (logoDataUrl) {
    const lw = 42, lh = 37;
    doc.addImage(logoDataUrl, 'PNG', (PW - lw) / 2, y, lw, lh);
    y += lh + 4;
  } else {
    y += 10;
  }

  // ── 2. Company info (centered, via autoTable for Cyrillic support) ────────
  autoTable(doc, {
    startY: y,
    body: [
      [{ content: 'Республика Узбекистан,', styles: { fontStyle: 'bold' } }],
      [{ content: 'г.Самарканд, Шота Руставели, дом 45' }],
      [{ content: 'Тел/fax.: +998 933484208, +998 97 9282814' }],
      [{ content: 'E-Mail: orientinsightreisen@gmail.com' }],
      [{ content: 'Website: orient-insight.uz' }],
    ],
    theme: 'plain',
    tableWidth: PW - 2 * M,
    margin: { left: M, right: M },
    styles: { fontSize: 9, halign: 'center', cellPadding: 0.6 },
  });
  y = doc.lastAutoTable.finalY + 7;

  // ── 3. Date + Hotel recipient ─────────────────────────────────────────────
  const cw = (PW - 2 * M) / 2;
  autoTable(doc, {
    startY: y,
    body: [[
      { content: `Дата: ${today}`, styles: { halign: 'left', fontStyle: 'bold' } },
      { content: `Директору гостиницы\n${hotel.name}`, styles: { halign: 'right', fontStyle: 'bold' } },
    ]],
    theme: 'plain',
    tableWidth: PW - 2 * M,
    margin: { left: M, right: M },
    styles: { fontSize: 9, cellPadding: 1 },
    columnStyles: { 0: { cellWidth: cw }, 1: { cellWidth: cw } },
  });
  y = doc.lastAutoTable.finalY + 6;

  // ── 4. Title ──────────────────────────────────────────────────────────────
  autoTable(doc, {
    startY: y,
    body: [[{ content: `JAHRESPLANUNG ${year} — ${tourLabel}` }]],
    theme: 'plain',
    tableWidth: PW - 2 * M,
    margin: { left: M, right: M },
    styles: { fontSize: 13, fontStyle: 'bold', halign: 'center', cellPadding: 1,
      textColor: [0, 0, 0], lineColor: [0, 0, 0] },
    didParseCell(data) {
      // underline via bottom border only
      data.cell.styles.lineWidth = { bottom: 0.4, top: 0, left: 0, right: 0 };
    }
  });
  y = doc.lastAutoTable.finalY + 4;

  // ── 5. Intro text ─────────────────────────────────────────────────────────
  autoTable(doc, {
    startY: y,
    body: [[{ content: 'ООО "ORIENT INSIGHT" приветствует Вас, и просит забронировать места с учетом нижеследующих деталей.' }]],
    theme: 'plain',
    tableWidth: PW - 2 * M,
    margin: { left: M, right: M },
    styles: { fontSize: 9, cellPadding: 1 },
  });
  y = doc.lastAutoTable.finalY + 4;

  // ── 6. Data tables ────────────────────────────────────────────────────────
  // Columns: №, Группа, Страна, PAX, Заезд, Выезд, DBL, TWN, SNGL, Тип номера
  const HEAD = [[
    { content: '№', styles: { halign: 'center' } },
    { content: 'Группа', styles: { halign: 'center' } },
    { content: 'Страна', styles: { halign: 'center' } },
    { content: 'PAX', styles: { halign: 'center' } },
    { content: 'Заезд', styles: { halign: 'center' } },
    { content: 'Выезд', styles: { halign: 'center' } },
    { content: 'DBL', styles: { halign: 'center' } },
    { content: 'TWN', styles: { halign: 'center' } },
    { content: 'SNGL', styles: { halign: 'center' } },
    { content: 'Тип номера', styles: { halign: 'center' } },
  ]];
  // widths: 7+22+20+13+25+25+14+14+14+26 = 180mm
  const CS = {
    0:{ cellWidth:7,  halign:'center' },
    1:{ cellWidth:22 },
    2:{ cellWidth:20, halign:'center' },
    3:{ cellWidth:13, halign:'center' },
    4:{ cellWidth:25, halign:'center' },
    5:{ cellWidth:25, halign:'center' },
    6:{ cellWidth:14, halign:'center' },
    7:{ cellWidth:14, halign:'center' },
    8:{ cellWidth:14, halign:'center' },
    9:{ cellWidth:26, halign:'center' },
  };

  function buildRows(rows) {
    const body = rows.map((b, i) => [
      i + 1,
      b.bookingNumber,
      b.status === 'CANCELLED' ? 'СТОРНО' : country,
      b.pax || 0,
      formatDate(b.checkInDate),
      formatDate(b.checkOutDate),
      b.dbl  || 0,
      b.twn  || 0,
      b.sngl || 0,
      b.status === 'CANCELLED' ? '' : 'стандарт',
    ]);
    const active = rows.filter(b => b.status !== 'CANCELLED');
    const tot = active.reduce((a, b) => ({
      pax: a.pax + (b.pax||0), dbl: a.dbl + (b.dbl||0),
      twn: a.twn + (b.twn||0), sngl: a.sngl + (b.sngl||0),
    }), { pax:0, dbl:0, twn:0, sngl:0 });
    body.push(['', 'ИТОГО', '', tot.pax, '', '', tot.dbl, tot.twn, tot.sngl, '']);
    return { body, count: rows.length };
  }

  function addTable(startY, rows, sectionTitle) {
    const { body, count } = buildRows(rows);
    autoTable(doc, {
      startY,
      head: HEAD,
      body,
      theme: 'grid',
      tableWidth: PW - 2 * M,
      margin: { left: M, right: M },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: CS,
      didParseCell(data) {
        const ri = data.row.index;
        if (ri < rows.length && rows[ri]?.status === 'CANCELLED') {
          data.cell.styles.fillColor = [255, 210, 210];
          data.cell.styles.textColor = [160, 0, 0];
        }
        if (ri === count) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [220, 235, 250];
        }
      },
      didDrawPage(data) {
        if (sectionTitle && data.pageNumber === 1 && data.cursor?.y === startY) {
          // section label drawn by autoTable willDrawCell isn't needed — handled below
        }
      }
    });
    // Draw section title above table
    if (sectionTitle) {
      doc.setFontSize(9); doc.setFont('helvetica', 'bold');
      doc.text(sectionTitle, M, startY - 1);
    }
    return doc.lastAutoTable.finalY + 6;
  }

  if (hasSplit) {
    y = addTable(y + 4, first,  'Первый заезд');
    y = addTable(y + 4, second, 'Второй заезд');
    if (hasThird) y = addTable(y + 4, third, 'Третий заезд');
  } else {
    y = addTable(y, activeResolved, null);
  }

  // ── 7. Footer ─────────────────────────────────────────────────────────────
  y += 2;
  autoTable(doc, {
    startY: y,
    body: [[{ content: 'Оплату гости производят на месте.', styles: { fontStyle: 'italic' } }]],
    theme: 'plain',
    tableWidth: PW - 2 * M,
    margin: { left: M, right: M },
    styles: { fontSize: 9, cellPadding: 0.5 },
  });
  y = doc.lastAutoTable.finalY + 6;
  autoTable(doc, {
    startY: y,
    body: [[
      { content: 'Директор ООО «ORIENT INSIGHT»', styles: { fontStyle: 'bold', halign: 'left' } },
      { content: '_________________________', styles: { halign: 'center' } },
      { content: 'Милиев С.Р.', styles: { fontStyle: 'bold', halign: 'right' } },
    ]],
    theme: 'plain',
    tableWidth: PW - 2 * M,
    margin: { left: M, right: M },
    styles: { fontSize: 9, cellPadding: 0.5 },
    columnStyles: { 0: { cellWidth: 65 }, 1: { cellWidth: 65 }, 2: { cellWidth: 50 } },
  });

  if (returnBlob) return doc.output('blob');
  doc.save(`${year}_${tourType}_${hotel.name.replace(/\s+/g, '_')}.pdf`);
}

function HotelCard({ hotelData, tourType, tourColor, isOpen, onToggle, overrides, setOverrideVal, rowStatuses, setRowStatus,
  onEmail, onTelegram, sendingEmail, sendingTelegram, onPDF,
  cityName, cityHotels, onMoveBooking, isExtra, onRemoveHotel,
  availableHotelsForSwap, onReplaceHotel }) {
  const { hotel, bookings } = hotelData;
  const { first, second, third, hasSplit, hasThird } = splitVisits(bookings);
  const color = tourColor || '#3B82F6';

  const getVal = (b, field) => {
    const k = rowKey(hotel.id, b);
    return overrides[k]?.[field] !== undefined ? overrides[k][field] : (b[field] ?? 0);
  };
  const active = bookings.filter(b => b.status !== 'CANCELLED');
  const totalPax   = active.reduce((s,b) => s + getVal(b,'pax'), 0);
  const totalRooms = active.reduce((s,b) => s + getVal(b,'dbl') + getVal(b,'twn') + getVal(b,'sngl'), 0);
  const sharedProps = { hotelId: hotel.id, overrides, setOverrideVal, rowStatuses, setRowStatus,
    cityName, cityHotels, onMoveBooking };

  return (
    <div className="rounded-xl overflow-hidden transition-all duration-200"
      style={{
        background: 'white',
        border: `1px solid ${isExtra ? color + '40' : '#e2e8f0'}`,
        boxShadow: isOpen ? `0 4px 20px ${color}10` : '0 1px 3px rgba(0,0,0,0.06)',
      }}>
      {/* Card Header */}
      <div className="px-3 md:px-4 py-3 flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
        {/* Left: toggle + hotel info */}
        <button onClick={onToggle} className="flex items-center gap-2.5 flex-1 min-w-0 text-left group">
          <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all"
            style={{ background: isOpen ? `${color}18` : '#f1f5f9' }}>
            {isOpen
              ? <ChevronDown className="w-3.5 h-3.5" style={{ color }} />
              : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
          </div>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: isExtra ? `${color}15` : '#f1f5f9' }}>
            <Building2 className="w-3.5 h-3.5" style={{ color: isExtra ? color : '#64748b' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-800 text-sm truncate group-hover:text-blue-600 transition-colors">
                {hotel.name}
              </span>
              {isExtra && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: `${color}15`, color }}>qo'shimcha</span>
              )}
              {availableHotelsForSwap?.length > 0 && (
                <HotelSwapButton currentHotelId={hotel.id} availableHotels={availableHotelsForSwap} onReplace={onReplaceHotel} />
              )}
            </div>
            {hotel.email && <div className="text-xs text-slate-400 truncate hidden md:block mt-0.5">{hotel.email}</div>}
          </div>
          {/* Stats */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs font-black px-2.5 py-1 rounded-lg text-white"
              style={{ background: `linear-gradient(135deg, ${color}, ${color}bb)` }}>
              {bookings.length}
            </span>
            <span className="hidden sm:block text-xs font-semibold text-slate-500">{totalPax} PAX</span>
            <span className="hidden md:block text-xs text-slate-400">· {totalRooms} ном.</span>
          </div>
        </button>

        {/* Right: action buttons */}
        <div className="flex items-center gap-1.5 ml-7 md:ml-0 flex-shrink-0">
          <button onClick={() => onPDF(hotelData)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{ background: '#f1f5f9', color: '#475569' }}
            onMouseEnter={e => { e.currentTarget.style.background='#e2e8f0'; }}
            onMouseLeave={e => { e.currentTarget.style.background='#f1f5f9'; }}
            title="PDF">
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">PDF</span>
          </button>
          <button onClick={() => onEmail(hotelData)} disabled={!!sendingEmail}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
            style={{ background: '#eff6ff', color: '#1d4ed8' }}
            onMouseEnter={e => { if (!sendingEmail) e.currentTarget.style.background='#dbeafe'; }}
            onMouseLeave={e => { e.currentTarget.style.background='#eff6ff'; }}
            title={hotel.email || "Email yo'q"}>
            {sendingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Mail className="w-3.5 h-3.5"/>}
            <span className="hidden sm:inline">Email</span>
          </button>
          <button onClick={() => onTelegram(hotelData)} disabled={!!sendingTelegram}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
            style={{ background: '#f0f9ff', color: '#0369a1' }}
            onMouseEnter={e => { if (!sendingTelegram) e.currentTarget.style.background='#e0f2fe'; }}
            onMouseLeave={e => { e.currentTarget.style.background='#f0f9ff'; }}
            title={hotel.telegramChatId ? 'TG' : "Telegram yo'q"}>
            {sendingTelegram ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Send className="w-3.5 h-3.5"/>}
            <span className="hidden sm:inline">TG</span>
          </button>
          {isExtra && (
            <button onClick={onRemoveHotel} title="Olib tashlash"
              className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 transition-colors"
              onMouseEnter={e => { e.currentTarget.style.background='#fff1f2'; }}
              onMouseLeave={e => { e.currentTarget.style.background='transparent'; }}>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Expanded bookings */}
      {isOpen && (
        <div style={{ borderTop: `2px solid ${color}20` }}>
          {hasSplit ? (
            <>
              <BookingsTable bookings={first}  {...sharedProps} visitLabel="Первый заезд" />
              <BookingsTable bookings={second} {...sharedProps} visitLabel="Второй заезд" />
              {hasThird && <BookingsTable bookings={third} {...sharedProps} visitLabel="Третий заезд" />}
            </>
          ) : (
            <BookingsTable bookings={bookings} {...sharedProps} visitLabel={null} />
          )}
        </div>
      )}
    </div>
  );
}

// ── TransportTab ─────────────────────────────────────────────────────────────

const TRANSPORT_OFFSETS = {
  ER:  { von: 1,  bis: 13 },
  CO:  { von: 1,  bis: 13 },
  KAS: { von: 14, bis: 22 },
  ZA:  { von: 4,  bis: 11 },
};

const TRANSPORT_PROVIDERS = [
  { id: 'sevil',    label: 'Sevil',    bg: 'bg-blue-50',   border: 'border-blue-200',   headerText: 'text-blue-700',   pillActive: 'bg-blue-500 text-white',   pillInactive: 'bg-blue-50 text-blue-600 border border-blue-200'   },
  { id: 'xayrulla', label: 'Xayrulla', bg: 'bg-green-50',  border: 'border-green-200',  headerText: 'text-green-700',  pillActive: 'bg-green-500 text-white',  pillInactive: 'bg-green-50 text-green-600 border border-green-200'  },
  { id: 'nosir',    label: 'Nosir',    bg: 'bg-purple-50', border: 'border-purple-200', headerText: 'text-purple-700', pillActive: 'bg-purple-500 text-white', pillInactive: 'bg-purple-50 text-purple-600 border border-purple-200' },
];

// tourType → providers that show the Vokzal (single-day train station) column
// Only CO/Xayrulla has Vokzal; ER/KAS/ZA never show it
const VOKZAL_MAP = { CO: new Set(['xayrulla']) };

// tourType → providers that show "N-zayezd" labels on column headers (only when 2+ segments)
const ZAYEZD_LABEL_MAP = {
  ER: new Set(['xayrulla']),
  CO: new Set(['xayrulla']),
};

// Extra days added to bis per tourType+provider (last working day not in routes DB)
// CO/Sevil: +1 (Khiva → Urgench transfer)
// ER/Sevil: +3 (Khiva → split group: half Tashkent, half Turkmenistan → last tour day)
const PROVIDER_BIS_EXTRA = {
  CO:  { sevil: 2 },
  ER:  { sevil: 3 },
  KAS: { sevil: 0 },
  ZA:  { sevil: 0 },
};

// Max multi-day segments to display per tourType+provider (undefined = no limit)
const MAX_MULTI_MAP = {
  ER: { sevil: 1 },
  CO: { nosir: 1, sevil: 1 },
};

// Provider display order per tourType (default: sevil, xayrulla, nosir)
const PROVIDER_ORDER = {
  ER:  ['xayrulla', 'sevil'],
  CO:  ['xayrulla', 'nosir', 'sevil'],
  KAS: ['nosir', 'sevil', 'xayrulla'],
  ZA:  ['sevil', 'xayrulla'],
};

function getOrderedProviders(tourType) {
  const order = PROVIDER_ORDER[tourType];
  if (!order) return TRANSPORT_PROVIDERS;
  return order.map(id => TRANSPORT_PROVIDERS.find(p => p.id === id)).filter(Boolean);
}

function addDaysLocal(isoDate, days) {
  // Add days to a date string in local time to avoid UTC offset issues
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}

function DateCell({ value, onChange }) {
  const [editing, setEditing] = useState(false);
  const [tmp, setTmp] = useState(value || '');

  useEffect(() => { setTmp(value || ''); }, [value]);

  const commit = () => {
    onChange(tmp || null);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        type="date"
        value={tmp}
        onChange={e => setTmp(e.target.value)}
        onBlur={commit}
        onKeyDown={e => e.key === 'Enter' && commit()}
        className="border border-blue-400 rounded px-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white h-6"
        autoFocus
      />
    );
  }
  return (
    <span
      onClick={() => setEditing(true)}
      className="cursor-pointer hover:bg-amber-50 hover:text-amber-700 rounded px-1 py-0.5 transition-colors select-none text-sm"
      title="Tahrirlash uchun bosing"
    >
      {value ? formatDate(value) : <span className="text-gray-300">—</span>}
    </span>
  );
}

function TransportTab({ tourType, tourColor }) {
  const { selectedYear: YEAR } = useYear();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  // routeMap: provider → bookingId → { von, bis, pax } (auto from routes)
  const [routeMap, setRouteMap] = useState({});
  // routeDetails: provider → bookingId → [{ date, routeName, pax, time, vehicle, itinerary }]
  const [routeDetails, setRouteDetails] = useState({});
  // manualOverrides: key="{provider}_{bookingId}" → { vonOverride, bisOverride, paxOverride }
  const [manualOverrides, setManualOverrides] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`jp_transport_ovr_${YEAR}_${tourType}`) || '{}'); }
    catch { return {}; }
  });
  const [openProviders, setOpenProviders] = useState({ sevil: true, xayrulla: true, nosir: true });
  const [sendingTransportTg, setSendingTransportTg] = useState({});
  const [confirmations, setConfirmations] = useState([]);
  const saveTimerRef = useRef(null);

  useEffect(() => {
    try { setManualOverrides(JSON.parse(localStorage.getItem(`jp_transport_ovr_${YEAR}_${tourType}`) || '{}')); }
    catch { setManualOverrides({}); }
    setLoading(true);
    setBookings([]);
    Promise.all([
      jahresplanungApi.getTransport(YEAR, tourType),
      jahresplanungApi.getTransportConfirmations(),
    ])
      .then(([res, confRes]) => {
        setConfirmations(confRes.data.confirmations || []);
        const bookingsData = res.data.bookings || [];
        const routeMapData = res.data.routeMap || {};
        let ovr = { ...(res.data.manualOverrides || {}) };

        // Auto-fill missing segments for ER and CO / Xayrulla
        if (tourType === 'ER' || tourType === 'CO') {
          let changed = false;
          for (const [bkId, data] of Object.entries(routeMapData['xayrulla'] || {})) {
            const segs = data.segments || [];
            const multiSegs = segs.filter(s => s.von !== s.bis);
            if (multiSegs.length === 1 && multiSegs[0].von) {
              const firstVon = multiSegs[0].von;
              if (tourType === 'CO') {
                // CO/xayrulla: 3 cols total [multi(1-3), single/vokzal(5), multi(12-13)]
                const hasSingle = segs.some(s => s.von === s.bis);
                if (!hasSingle) {
                  // Missing vokzal (day+4) AND 2nd multi — fill VCOL1 + VCOL2
                  const vk1 = `xayrulla_${bkId}_VCOL1`;
                  if (!ovr[vk1]?.vonOverride) {
                    ovr[vk1] = { vonOverride: addDaysLocal(firstVon, 4), bisOverride: addDaysLocal(firstVon, 4) };
                    changed = true;
                  }
                  const vk2 = `xayrulla_${bkId}_VCOL2`;
                  if (!ovr[vk2]?.vonOverride) {
                    ovr[vk2] = { vonOverride: addDaysLocal(firstVon, 11), bisOverride: addDaysLocal(firstVon, 12) };
                    changed = true;
                  }
                } else {
                  // Has vokzal at idx 1, missing 2nd multi at idx 2 — fill VCOL2
                  const vk2 = `xayrulla_${bkId}_VCOL2`;
                  if (!ovr[vk2]?.vonOverride) {
                    ovr[vk2] = { vonOverride: addDaysLocal(firstVon, 11), bisOverride: addDaysLocal(firstVon, 12) };
                    changed = true;
                  }
                }
              } else {
                // ER/xayrulla: 2 cols [multi(0-2), multi(11-12)] — fill VCOL1
                const k = `xayrulla_${bkId}_VCOL1`;
                if (!ovr[k]?.vonOverride) {
                  ovr[k] = { vonOverride: addDaysLocal(firstVon, 11), bisOverride: addDaysLocal(firstVon, 12) };
                  changed = true;
                }
              }
            }
          }
          if (changed) jahresplanungApi.saveTransport(YEAR, tourType, ovr).catch(() => {});
        }

        setBookings(bookingsData);
        setRouteMap(routeMapData);
        setRouteDetails(res.data.routeDetails || {});
        setManualOverrides(ovr);
        try { localStorage.setItem(`jp_transport_ovr_${YEAR}_${tourType}`, JSON.stringify(ovr)); } catch {}
      })
      .catch(() => setBookings([]))
      .finally(() => setLoading(false));
  }, [tourType, YEAR]);

  const saveOverrides = (next) => {
    setManualOverrides(next);
    try { localStorage.setItem(`jp_transport_ovr_${YEAR}_${tourType}`, JSON.stringify(next)); } catch {}
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      jahresplanungApi.saveTransport(YEAR, tourType, next).catch(() => {});
    }, 1000);
  };

  // Override key uses original segment von as stable ID
  const ovrKey = (provider, bookingId, segVon) => `${provider}_${bookingId}_${segVon}`;
  // Virtual column key for bookings that have fewer segments than the template
  const vColKey = (provider, bookingId, colIdx) => `${provider}_${bookingId}_VCOL${colIdx}`;

  const getSegEffective = (provider, bookingId, seg) => {
    const k = ovrKey(provider, bookingId, seg.von);
    const ovr = manualOverrides[k];
    const bisRaw = ovr?.bisOverride ?? seg.bis;
    const extra = !ovr?.bisOverride && (PROVIDER_BIS_EXTRA[tourType]?.[provider] ?? 0);
    const bis = (extra && bisRaw) ? addDaysLocal(bisRaw, extra) : bisRaw;
    return {
      von: ovr?.vonOverride ?? seg.von,
      bis,
      pax: ovr?.paxOverride ?? 16,
    };
  };

  const updateSegOverride = (provider, bookingId, segVon, changes) => {
    const k = ovrKey(provider, bookingId, segVon);
    saveOverrides({ ...manualOverrides, [k]: { ...(manualOverrides[k] || {}), ...changes } });
  };

  // Column template: derived from the booking with the most segments
  // Returns ['multi','single','multi'] style array; single-day cols hidden for non-Vokzal providers
  const getColTemplate = (provId) => {
    const provData = routeMap[provId] || {};
    let best = [];
    for (const bkId of Object.keys(provData)) {
      const segs = provData[bkId]?.segments || [];
      if (segs.length > best.length) best = segs;
    }
    const raw = best.map(s => s.von === s.bis ? 'single' : 'multi');
    const showVokzal = VOKZAL_MAP[tourType]?.has(provId);
    const filtered = showVokzal ? raw : raw.filter(t => t !== 'single');
    const maxMulti = MAX_MULTI_MAP[tourType]?.[provId];
    if (maxMulti !== undefined) {
      let mCnt = 0;
      return filtered.filter(t => { if (t === 'multi') { mCnt++; return mCnt <= maxMulti; } return true; });
    }
    return filtered;
  };

  // Returns visible segments for a provider+booking (respects Vokzal filter + max multi cap)
  const getVisibleSegs = (provider, bookingId, allSegs) => {
    const showVokzal = VOKZAL_MAP[tourType]?.has(provider);
    const maxMulti = MAX_MULTI_MAP[tourType]?.[provider];
    let mCnt = 0;
    return allSegs.filter(seg => {
      const { von, bis } = getSegEffective(provider, bookingId, seg);
      const isSingle = von === bis;
      if (isSingle && !showVokzal) return false;
      if (!isSingle) { mCnt++; if (maxMulti !== undefined && mCnt > maxMulti) return false; }
      return true;
    });
  };

  // Fixed pixel widths for aligned columns — Von and Bis are SEPARATE columns
  const COL_W = 112; // width of each date column (Von or Bis)
  const COL_GAP = 16; // gap between Von and Bis within one segment
  const SEP_MX = 28; // margin on each side of segment separator

  // Generate PDF for a provider's bookings
  const generateTransportPDF = (provId, items) => {
    const prov = TRANSPORT_PROVIDERS.find(p => p.id === provId);
    const doc = new jsPDF({ orientation: 'portrait', format: 'a4' });
    // Exclude cancelled bookings from PDF
    items = items.filter(b => b.status !== 'CANCELLED');

    const fmtD = (d) => {
      if (!d) return '—';
      const dt = new Date(d);
      return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.${dt.getFullYear()}`;
    };

    // Compute provColCount the same way as the UI: max visible segs + virtual cols
    let provColCount = 0;
    for (const b of items) {
      const bk = String(b.id);
      const allSegs = routeMap[provId]?.[bk]?.segments || [];
      const vis = getVisibleSegs(provId, bk, allSegs);
      if (vis.length > provColCount) provColCount = vis.length;
    }
    // Also account for virtual columns (VCOL keys in manualOverrides)
    for (const b of items) {
      const bk = String(b.id);
      const prefix = `${provId}_${bk}_VCOL`;
      for (const k of Object.keys(manualOverrides)) {
        if (k.startsWith(prefix)) {
          const idx = parseInt(k.slice(prefix.length), 10);
          if (!isNaN(idx) && idx + 1 > provColCount) provColCount = idx + 1;
        }
      }
    }

    // Find template booking (most visible segs) for column type determination
    let templateSegs = [];
    let templateBkId = null;
    for (const b of items) {
      const bk = String(b.id);
      const allSegs = routeMap[provId]?.[bk]?.segments || [];
      const vis = getVisibleSegs(provId, bk, allSegs);
      if (vis.length > templateSegs.length) { templateSegs = vis; templateBkId = bk; }
    }

    // Build column definitions — each multi-day seg = 1 merged col "N Заезд"
    const colDefs = []; // { label, type: 'multi'|'single', idx }
    let multiIdx = 0;
    for (let idx = 0; idx < provColCount; idx++) {
      let isSingle = false;
      if (idx < templateSegs.length && templateBkId) {
        const eff = getSegEffective(provId, templateBkId, templateSegs[idx]);
        isSingle = eff.von === eff.bis;
      }
      if (isSingle) {
        colDefs.push({ label: 'Vokzal', type: 'single', idx });
      } else {
        multiIdx++;
        const label = provColCount > 1 ? `${multiIdx}. Zayezd` : 'Zayezd';
        colDefs.push({ label, type: 'multi', idx });
      }
    }
    const cols = ['Guruh', 'PAX', ...colDefs.map(c => c.label)];

    // Build rows — each multi-day seg cell = "Von-Bis" combined
    const rows = items.map(b => {
      const bk = String(b.id);
      const allSegs = routeMap[provId]?.[bk]?.segments || [];
      const visSegs = getVisibleSegs(provId, bk, allSegs);
      const { pax } = visSegs.length > 0
        ? getSegEffective(provId, bk, visSegs[0])
        : { pax: manualOverrides[vColKey(provId, bk, 0)]?.paxOverride ?? 16 };
      const row = [b.bookingNumber, String(pax)];
      for (const { type, idx } of colDefs) {
        const isVirtual = idx >= visSegs.length;
        let von, bis;
        if (!isVirtual) {
          const eff = getSegEffective(provId, bk, visSegs[idx]);
          von = eff.von; bis = eff.bis;
        } else {
          const ovr = manualOverrides[vColKey(provId, bk, idx)];
          von = ovr?.vonOverride || null;
          bis = ovr?.bisOverride || null;
        }
        if (type === 'single') { row.push(fmtD(von)); }
        else { row.push(von || bis ? `${fmtD(von)}  -  ${fmtD(bis)}` : '—'); }
      }
      return row;
    });

    doc.setFontSize(13);
    doc.setTextColor(30, 30, 30);
    doc.text(`Transport Rejasi ${YEAR} — ${tourType} (${prov?.label || provId})`, 14, 16);

    // 1. Detail table first (first booking only)
    const firstWithRoutes = items.find(b => (routeDetails[provId]?.[String(b.id)] || []).length > 0);
    let detailEndY = 22;
    if (firstWithRoutes) {
      const bk = String(firstWithRoutes.id);
      const details = routeDetails[provId][bk];

      doc.setFontSize(9);
      doc.setTextColor(30, 30, 30);
      doc.setFont('helvetica', 'bold');
      doc.text(firstWithRoutes.bookingNumber, 14, 22);
      doc.setFont('helvetica', 'normal');

      // Deduplicate same-date + same-routeName rows (e.g. Fergana-Tashkent multiple vehicles)
      const dedupedDetails = [];
      for (const r of details) {
        const existing = dedupedDetails.find(x => x.date === r.date && x.routeName === r.routeName);
        if (existing) { existing.pax = (existing.pax || 0) + (r.pax || 0); }
        else { dedupedDetails.push({ ...r }); }
      }
      const detailRows = dedupedDetails.map((r, i) => [
        String(i + 1),
        fmtD(r.date),
        r.routeName,
        String(r.pax),
        r.time || '—',
        r.vehicle || '—',
        r.itinerary || '—',
      ]);

      autoTable(doc, {
        head: [['#', 'Sana', "Yo'nalish", 'PAX', 'Vaqt', 'Avtomobil', 'Sayohat dasturi']],
        body: detailRows,
        startY: 26,
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [234, 179, 8], textColor: 30, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [254, 252, 232] },
        columnStyles: {
          0: { cellWidth: 7 },
          1: { cellWidth: 20 },
          2: { cellWidth: 35 },
          3: { cellWidth: 9 },
          4: { cellWidth: 12 },
          5: { cellWidth: 25 },
          6: { cellWidth: 'auto' },
        },
      });
      detailEndY = doc.lastAutoTable.finalY + 8;
    }

    // 2. Summary table below
    autoTable(doc, {
      head: [cols],
      body: rows,
      startY: detailEndY,
      styles: { fontSize: 8, cellPadding: 1.8 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 248, 255] },
    });

    return doc.output('blob');
  };

  // Send transport PDF to provider's Telegram
  const handleTransportTelegram = async (provId, allItems) => {
    const items = allItems.filter(b => b.status !== 'CANCELLED');
    setSendingTransportTg(p => ({ ...p, [provId]: true }));
    try {
      const prov = TRANSPORT_PROVIDERS.find(p => p.id === provId);
      const blob = generateTransportPDF(provId, allItems);
      const filename = `${YEAR}_${tourType}_Transport_${prov?.label || provId}.pdf`;

      // Build formatted monospace table for Telegram
      const fmtFull = (d) => {
        if (!d) return '——';
        const dt = new Date(d);
        return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.${dt.getFullYear()}`;
      };
      const pad = (s, w) => String(s ?? '').padEnd(w);

      // Compute provColCount same as UI (visible segs + virtual cols)
      let provColCount = 0;
      for (const b of items) {
        const bk = String(b.id);
        const allSegs = routeMap[provId]?.[bk]?.segments || [];
        const vis = getVisibleSegs(provId, bk, allSegs);
        if (vis.length > provColCount) provColCount = vis.length;
      }
      for (const b of items) {
        const bk = String(b.id);
        const prefix = `${provId}_${bk}_VCOL`;
        for (const k of Object.keys(manualOverrides)) {
          if (k.startsWith(prefix)) {
            const idx = parseInt(k.slice(prefix.length), 10);
            if (!isNaN(idx) && idx + 1 > provColCount) provColCount = idx + 1;
          }
        }
      }
      // Find template booking for column types
      let tSegs = []; let tBkId = null;
      for (const b of items) {
        const bk = String(b.id);
        const allSegs = routeMap[provId]?.[bk]?.segments || [];
        const vis = getVisibleSegs(provId, bk, allSegs);
        if (vis.length > tSegs.length) { tSegs = vis; tBkId = bk; }
      }
      // Build segCols — header label centered above date range column
      let multiCnt = 0;
      const segCols = [];
      for (let idx = 0; idx < provColCount; idx++) {
        let isSingle = false;
        if (idx < tSegs.length && tBkId) {
          const eff = getSegEffective(provId, tBkId, tSegs[idx]);
          isSingle = eff.von === eff.bis;
        }
        if (isSingle) { segCols.push({ label: 'Vokzal', w: 12, idx, type: 'single' }); }
        else {
          multiCnt++;
          const segLabel = provColCount > 1 ? `${multiCnt} Zaezd` : 'Zaezd';
          const w = 23; // "dd.mm.yyyy-dd.mm.yyyy" = 21 chars, pad to 23
          segCols.push({ label: segLabel, w, idx, type: 'multi' });
        }
      }
      const allCols = [
        { label: 'Guruh', w: 6 },
        { label: 'PAX', w: 3 },
        ...segCols,
      ];

      // Header: segment labels centered in their column width
      const headerLine = allCols.map(c => {
        if (c.type === 'multi') {
          const left = Math.floor((c.w - c.label.length) / 2);
          return ' '.repeat(left) + c.label + ' '.repeat(c.w - c.label.length - left);
        }
        return pad(c.label, c.w);
      }).join('  ');
      const separator = allCols.map(c => '─'.repeat(c.w)).join('──');

      const dataLines = items.map(b => {
        const bk = String(b.id);
        const allSegs = routeMap[provId]?.[bk]?.segments || [];
        const visSegs = getVisibleSegs(provId, bk, allSegs);
        const { pax } = visSegs.length > 0
          ? getSegEffective(provId, bk, visSegs[0])
          : { pax: manualOverrides[vColKey(provId, bk, 0)]?.paxOverride ?? 16 };
        const cells = [pad(b.bookingNumber, 6), pad(pax, 3)];
        segCols.forEach(({ idx, type, w }) => {
          const isVirtual = idx >= visSegs.length;
          let von, bis;
          if (!isVirtual) {
            const eff = getSegEffective(provId, bk, visSegs[idx]);
            von = eff.von; bis = eff.bis;
          } else {
            const ovr = manualOverrides[vColKey(provId, bk, idx)];
            von = ovr?.vonOverride || null;
            bis = ovr?.bisOverride || null;
          }
          if (type === 'single') { cells.push(pad(fmtFull(von), w)); }
          else { cells.push(pad(von || bis ? `${fmtFull(von)}-${fmtFull(bis)}` : '—', w)); }
        });
        return cells.join('  ');
      }).join('\n');

      const messageText = `${headerLine}\n${separator}\n${dataLines}`;

      await jahresplanungApi.sendTransportTelegram(provId, YEAR, tourType, blob, filename, messageText);
      toast.success(`Hammasi tekshiruvga yuborildi → ${prov?.label || provId}`);
    } catch (err) {
      toast.error('Telegram xatolik: ' + (err.response?.data?.error || err.message));
    } finally {
      setSendingTransportTg(p => ({ ...p, [provId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2"/>
        <span className="text-sm">Yuklanmoqda...</span>
      </div>
    );
  }

  const bookingsWithNoRoutes = bookings.filter(b => {
    const k = String(b.id);
    return !TRANSPORT_PROVIDERS.some(p => routeMap[p.id]?.[k]);
  });

  // Render all segments for a booking — labels are in the header, not here
  // colCount: total columns to render (pads with empty virtual cells if booking has fewer segs)
  const renderBookingSegments = (provider, booking, colCount = 0) => {
    const bk = String(booking.id);
    const data = routeMap[provider]?.[bk];
    const segments = data?.segments || [];
    const visSegs = getVisibleSegs(provider, bk, segments);
    if (visSegs.length === 0 && colCount === 0) return null;
    const isCancelled = booking.status === 'CANCELLED';
    const { pax } = visSegs.length > 0
      ? getSegEffective(provider, bk, visSegs[0])
      : { pax: 16 };

    // Build columns: actual visible segs + virtual empty cols to reach colCount
    const totalCols = Math.max(visSegs.length, colCount);

    return (
      <div
        key={bk}
        className={`px-8 py-3 flex items-center border-b border-gray-100 last:border-0 ${isCancelled ? 'bg-red-50' : ''}`}
      >
        {/* Guruh */}
        <div className="w-20 flex-shrink-0 mr-8">
          <Link to={`/bookings/${booking.id}`}
            className={`font-semibold text-base hover:underline ${isCancelled ? 'text-red-400 line-through' : 'text-primary-600'}`}>
            {booking.bookingNumber}
          </Link>
        </div>

        {/* PAX */}
        <div className="w-10 flex-shrink-0 mr-8 text-base font-medium text-gray-700">
          <EditCell value={pax} onChange={v => segments.forEach(s => updateSegOverride(provider, bk, s.von, { paxOverride: v }))} />
        </div>

        {/* Sanalar */}
        <div className="flex items-center flex-1">
          {Array.from({ length: totalCols }, (_, idx) => {
            const seg = visSegs[idx]; // undefined if virtual column
            const isVirtual = !seg;
            let von, bis, isSingleDay;
            if (!isVirtual) {
              ({ von, bis } = getSegEffective(provider, bk, seg));
              isSingleDay = von === bis;
            } else {
              const ovr = manualOverrides[vColKey(provider, bk, idx)];
              von = ovr?.vonOverride || null;
              bis = ovr?.bisOverride || null;
              isSingleDay = false;
            }
            return (
              <div key={isVirtual ? `vcol-${idx}` : seg.von} className="flex items-center flex-shrink-0">
                {idx > 0 && (
                  <div className="bg-gray-200 flex-shrink-0"
                    style={{ width: 1, height: 28, marginLeft: SEP_MX, marginRight: SEP_MX }}
                  />
                )}
                {isSingleDay ? (
                  <div style={{ width: COL_W }} className="flex justify-center">
                    <DateCell
                      value={von}
                      onChange={v => updateSegOverride(provider, bk, seg.von, { vonOverride: v, bisOverride: v })}
                    />
                  </div>
                ) : (
                  <div className="flex items-center flex-shrink-0">
                    <div style={{ width: COL_W }} className="flex justify-center">
                      <DateCell value={von} onChange={v => {
                        if (!isVirtual) updateSegOverride(provider, bk, seg.von, { vonOverride: v });
                        else saveOverrides({ ...manualOverrides, [vColKey(provider, bk, idx)]: { ...manualOverrides[vColKey(provider, bk, idx)], vonOverride: v } });
                      }} />
                    </div>
                    <div style={{ width: COL_GAP }} />
                    <div style={{ width: COL_W }} className="flex justify-center">
                      <DateCell value={bis} onChange={v => {
                        if (!isVirtual) updateSegOverride(provider, bk, seg.von, { bisOverride: v });
                        else saveOverrides({ ...manualOverrides, [vColKey(provider, bk, idx)]: { ...manualOverrides[vColKey(provider, bk, idx)], bisOverride: v } });
                      }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {/* Status badge — pushed to right edge */}
          <div className="ml-auto pl-4">
            {isCancelled ? (
              <span className="inline-flex items-center px-2.5 py-1 bg-red-100 text-red-600 text-sm font-bold rounded-lg">✕ Bekor</span>
            ) : confirmations.find(c => c.tourType === tourType && c.provider === provider)?.status === 'CONFIRMED' ? (
              <span className="inline-flex items-center px-2.5 py-1 bg-green-100 text-green-700 text-sm font-bold rounded-lg">✓ OK</span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-1 bg-gray-100 text-gray-400 text-sm font-bold rounded-lg">—</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Summary */}
      <div className="flex items-center gap-4 mb-4 px-1 text-sm text-gray-500">
        <span>{bookings.length} ta guruh</span>
        {getOrderedProviders(tourType).map(p => {
          const cnt = Object.keys(routeMap[p.id] || {}).length;
          return cnt > 0 ? (
            <span key={p.id} className={p.headerText}>{p.label}: {cnt}</span>
          ) : null;
        })}
        {bookingsWithNoRoutes.length > 0 && (
          <span className="text-amber-500 text-xs">{bookingsWithNoRoutes.length} ta route yo&apos;q</span>
        )}
      </div>

      {/* Provider accordions */}
      {getOrderedProviders(tourType).map(prov => {
        const provBookingIds = Object.keys(routeMap[prov.id] || {});
        const items = bookings.filter(b => provBookingIds.includes(String(b.id)));
        const isOpen = !!openProviders[prov.id];
        // Total segment count
        const segCount = items.reduce((s, b) =>
          s + (routeMap[prov.id]?.[String(b.id)]?.segments?.length || 0), 0);
        // Max visible segments across all bookings — drives header + row column count
        let provColCount = 0;
        for (const b of items) {
          const bk = String(b.id);
          const allSegs = routeMap[prov.id]?.[bk]?.segments || [];
          const vis = getVisibleSegs(prov.id, bk, allSegs);
          if (vis.length > provColCount) provColCount = vis.length;
        }
        return (
          <div key={prov.id} className={`mb-3 rounded-xl border overflow-hidden ${prov.border}`}>
            <button
              onClick={() => setOpenProviders(p => ({ ...p, [prov.id]: !p[prov.id] }))}
              className={`w-full flex items-center gap-2 md:gap-3 px-3 md:px-5 py-3 ${prov.bg} hover:brightness-95 transition-all`}
            >
              {isOpen ? <ChevronDown className="w-4 h-4 flex-shrink-0"/> : <ChevronRight className="w-4 h-4 flex-shrink-0"/>}
              <Bus className={`w-4 h-4 flex-shrink-0 ${prov.headerText}`}/>
              <span className={`font-semibold ${prov.headerText}`}>{prov.label}</span>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs bg-white/70 px-2 py-0.5 rounded-full text-gray-600">
                  {items.length} ta guruh
                </span>
                {segCount > items.length && (
                  <span className="hidden sm:inline text-xs bg-white/70 px-2 py-0.5 rounded-full text-gray-400">
                    {segCount} ta zayezd
                  </span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const blob = generateTransportPDF(prov.id, items);
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${YEAR}_${tourType}_Transport_${prov.label}.pdf`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  disabled={items.length === 0}
                  className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                  title={`PDF yuklab olish — ${prov.label}`}
                >
                  <Download className="w-3.5 h-3.5"/>
                  PDF
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleTransportTelegram(prov.id, items); }}
                  disabled={!!sendingTransportTg[prov.id] || items.length === 0}
                  className="flex items-center gap-1 px-2.5 py-1 bg-sky-100 hover:bg-sky-200 text-sky-700 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                  title={`Telegram ga yuborish — ${prov.label}`}
                >
                  {sendingTransportTg[prov.id]
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin"/>
                    : <Send className="w-3.5 h-3.5"/>
                  }
                  TG
                </button>
              </div>
            </button>

            {isOpen && (
              <>
                {/* MOBILE: card view */}
                <div className="md:hidden bg-white divide-y divide-gray-100">
                  {items.length === 0 ? (
                    <div className="px-4 py-4 text-center text-xs text-gray-400">
                      Bu provayder uchun route&apos;lar topilmadi
                    </div>
                  ) : items.map(b => {
                    const bk = String(b.id);
                    const allSegs = routeMap[prov.id]?.[bk]?.segments || [];
                    const visSegs = getVisibleSegs(prov.id, bk, allSegs);
                    const isCancelled = b.status === 'CANCELLED';
                    const pax = visSegs.length > 0 ? getSegEffective(prov.id, bk, visSegs[0]).pax : 16;
                    const hasMultiSeg = visSegs.length > 1;
                    const isConfirmed = confirmations.find(c => c.tourType === tourType && c.provider === prov.id)?.status === 'CONFIRMED';
                    return (
                      <div key={bk} className={`flex border-b border-gray-100 last:border-0 ${isCancelled ? 'bg-red-50' : ''}`}>
                        {/* Colored left accent */}
                        <div className={`w-1 flex-shrink-0 ${isCancelled ? 'bg-red-300' : prov.border.replace('border', 'bg').replace('-200', '-400')}`} />
                        <div className="flex-1 px-3 py-3">
                          {/* Top row: booking number + PAX + status */}
                          <div className="flex items-center justify-between mb-1.5">
                            <Link to={`/bookings/${b.id}`}
                              className={`font-bold text-base hover:underline ${isCancelled ? 'text-red-400 line-through' : prov.headerText}`}>
                              {b.bookingNumber}
                            </Link>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1 text-sm text-gray-600">
                                <span className="text-xs text-gray-400">PAX</span>
                                <EditCell value={pax} onChange={v => allSegs.forEach(s => updateSegOverride(prov.id, bk, s.von, { paxOverride: v }))} />
                              </div>
                              {isCancelled ? (
                                <span className="inline-flex items-center px-2 py-0.5 bg-red-100 text-red-600 text-xs font-bold rounded-full">✕ Bekor</span>
                              ) : isConfirmed ? (
                                <span className="inline-flex items-center px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded-full">✓ OK</span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 bg-gray-100 text-gray-400 text-xs font-bold rounded-full">—</span>
                              )}
                            </div>
                          </div>
                          {/* Segments */}
                          {visSegs.length > 0 && (
                            <div className="space-y-1">
                              {visSegs.map((seg, idx) => {
                                const { von, bis } = getSegEffective(prov.id, bk, seg);
                                const isSingle = von === bis;
                                return (
                                  <div key={seg.von || idx} className="flex items-center gap-2">
                                    {hasMultiSeg && (
                                      <span className="text-xs text-gray-400 w-16 flex-shrink-0">{idx + 1}-zayezd:</span>
                                    )}
                                    <div className={`flex items-center gap-1.5 text-sm font-medium ${isCancelled ? 'text-gray-400' : 'text-gray-700'}`}>
                                      {isSingle ? (
                                        <DateCell value={von} onChange={v => updateSegOverride(prov.id, bk, seg.von, { vonOverride: v, bisOverride: v })} />
                                      ) : (
                                        <>
                                          <DateCell value={von} onChange={v => updateSegOverride(prov.id, bk, seg.von, { vonOverride: v })} />
                                          <span className="text-gray-300">→</span>
                                          <DateCell value={bis} onChange={v => updateSegOverride(prov.id, bk, seg.von, { bisOverride: v })} />
                                        </>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* DESKTOP: scrollable table */}
                <div className="hidden md:block bg-white overflow-x-auto"><div className="min-w-max">
                  {/* Column header — derived from booking with most visible segments (same logic as data rows) */}
                  {(() => {
                    let templateSegs = [];
                    let templateBkId = null;
                    for (const b of items) {
                      const bk = String(b.id);
                      const allSegs = routeMap[prov.id]?.[bk]?.segments || [];
                      const vis = getVisibleSegs(prov.id, bk, allSegs);
                      if (vis.length > templateSegs.length) { templateSegs = vis; templateBkId = bk; }
                    }
                    const showZayezdLabel = templateSegs.length > 1;
                    let multiCount = 0;
                    return (
                      <div className="px-8 py-2.5 flex items-end text-xs bg-gray-50 border-b border-gray-200">
                        <span className="w-20 flex-shrink-0 mr-8 text-gray-400 font-medium">Guruh</span>
                        <span className="w-10 flex-shrink-0 mr-8 text-gray-400 font-medium">PAX</span>
                        <div className="flex items-end flex-1">
                          {templateSegs.map((seg, idx) => {
                            const { von, bis } = getSegEffective(prov.id, templateBkId, seg);
                            const isSingle = von === bis;
                            if (!isSingle) multiCount++;
                            return (
                              <div key={seg.von || idx} className="flex items-end flex-shrink-0">
                                {idx > 0 && (
                                  <div className="bg-gray-200 flex-shrink-0"
                                    style={{ width: 1, height: 32, marginLeft: SEP_MX, marginRight: SEP_MX }}
                                  />
                                )}
                                {isSingle ? (
                                  <div style={{ width: COL_W }} className="text-center text-gray-400 font-medium">
                                    Vokzal
                                  </div>
                                ) : (
                                  <div className="flex flex-col flex-shrink-0">
                                    {showZayezdLabel && (
                                      <span style={{ width: COL_W * 2 + COL_GAP }} className="text-center text-gray-500 font-semibold mb-1">
                                        {multiCount}-zayezd
                                      </span>
                                    )}
                                    <div className="flex items-center">
                                      <span style={{ width: COL_W }} className="text-center text-gray-400 font-medium">Von</span>
                                      <div style={{ width: COL_GAP }} />
                                      <span style={{ width: COL_W }} className="text-center text-gray-400 font-medium">Bis</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          <span className="ml-auto pl-6 text-gray-400 font-medium">Status</span>
                        </div>
                      </div>
                    );
                  })()}
                  {items.length === 0 ? (
                    <div className="px-5 py-5 text-center text-xs text-gray-400">
                      Bu provayder uchun route&apos;lar topilmadi
                    </div>
                  ) : (
                    items.map(b => renderBookingSegments(prov.id, b, provColCount))
                  )}
                </div></div>
              </>
            )}
          </div>
        );
      })}

      {/* Bookings with no routes at all */}
      {bookingsWithNoRoutes.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 overflow-hidden">
          <div className="px-5 py-3 bg-amber-50 flex items-center gap-2">
            <span className="font-semibold text-amber-700 text-sm">Route kiritilmagan guruhlar</span>
            <span className="text-xs bg-white/70 px-2 py-0.5 rounded-full text-gray-500">
              {bookingsWithNoRoutes.length} ta
            </span>
          </div>
          <div className="bg-white px-5 py-2 text-xs text-gray-500">
            {bookingsWithNoRoutes.map(b => (
              <Link key={b.id} to={`/bookings/${b.id}`}
                className="inline-block mr-3 text-primary-600 hover:underline font-medium">
                {b.bookingNumber}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── End TransportTab ──────────────────────────────────────────────────────────

// ── RestoranTab ────────────────────────────────────────────────────────────

const MEAL_STATUS_CFG = {
  PENDING:   { color: 'bg-yellow-100 text-yellow-800', label: 'Kutilmoqda', icon: '🕐' },
  CONFIRMED: { color: 'bg-green-100 text-green-800',   label: 'Tasdiqladi', icon: '✅' },
  REJECTED:  { color: 'bg-red-100 text-red-800',       label: 'Rad qildi',  icon: '❌' },
};

function MealStatusBadge({ status, confirmedBy }) {
  const cfg = MEAL_STATUS_CFG[status] || { color: 'bg-gray-100 text-gray-600', label: status, icon: '?' };
  return (
    <div className="flex flex-col gap-0.5">
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
        {cfg.icon} {cfg.label}
      </span>
      {confirmedBy && (
        <span className="text-xs text-gray-400 pl-1">{confirmedBy}</span>
      )}
    </div>
  );
}

function fmtDep(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
}

function RestoranCard({ restaurant, open, onToggle, tourType, overrides, onOverride, sendingTelegram, onSendTelegram }) {
  const { selectedYear: YEAR } = useYear();
  const { name, city, hasTelegram, bookings } = restaurant;
  const [editingCell, setEditingCell] = useState(null); // `${bookingId}_pax` or `${bookingId}_date`
  const [editValue, setEditValue] = useState('');

  const getKey = (bookingId) => `${name}_${bookingId}`;
  const getEffPax = (b) => overrides[getKey(b.bookingId)]?.pax ?? 16;
  const getEffDate = (b) => overrides[getKey(b.bookingId)]?.date ?? b.mealDate;

  const confirmedCount = bookings.filter(b => b.confirmation?.status === 'CONFIRMED').length;
  const pendingCount   = bookings.filter(b => b.confirmation?.status === 'PENDING').length;
  const totalPax       = bookings.reduce((s, b) => s + getEffPax(b), 0);

  const startEdit = (e, bookingId, field, current) => {
    e.stopPropagation();
    setEditingCell(`${bookingId}_${field}`);
    setEditValue(current ?? '');
  };

  const commitEdit = (bookingId, field) => {
    const key = getKey(bookingId);
    const prev = overrides[key] || {};
    if (field === 'pax') {
      const val = parseInt(editValue, 10);
      onOverride(key, { ...prev, pax: isNaN(val) ? 16 : val });
    } else {
      // editValue is YYYY-MM-DD from <input type="date">, store as DD.MM.YYYY
      onOverride(key, { ...prev, date: editValue ? fromInputDate(editValue) : null });
    }
    setEditingCell(null);
  };

  const handleKeyDown = (e, bookingId, field) => {
    if (e.key === 'Enter') commitEdit(bookingId, field);
    if (e.key === 'Escape') setEditingCell(null);
  };

  // Convert DD.MM.YYYY → YYYY-MM-DD for <input type="date">
  const toInputDate = (dmy) => {
    if (!dmy) return '';
    const parts = dmy.split('.');
    if (parts.length !== 3) return '';
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  };
  // Convert YYYY-MM-DD → DD.MM.YYYY
  const fromInputDate = (iso) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}`;
  };

  const buildDoc = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(13);
    doc.text(`JAHRESPLANUNG ${YEAR} — Restoran (${tourType})`, 14, 15);
    doc.setFontSize(10);
    doc.text(`${name}${city ? ` · ${city}` : ''}`, 14, 22);
    const rows = bookings.map(b => [
      b.bookingNumber, getEffPax(b), getEffDate(b) || '—',
      b.confirmation ? (MEAL_STATUS_CFG[b.confirmation.status]?.label || b.confirmation.status) : '—',
    ]);
    autoTable(doc, {
      startY: 27,
      head: [['Gruppe', 'PAX', 'Sana', 'Holat']],
      body: rows,
      foot: [['GESAMT', totalPax, '', '']],
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      footStyles: { fillColor: [219, 234, 254], textColor: [30, 58, 138], fontStyle: 'bold' },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 1: { halign: 'right' } },
      alternateRowStyles: { fillColor: [249, 250, 251] },
    });
    return doc;
  };

  const handlePdf = () => {
    buildDoc().save(`${YEAR}_Restoran_${tourType}_${name}.pdf`);
  };

  const handleTelegram = () => {
    const blob = buildDoc().output('blob');
    const bookingsData = bookings.map(b => ({
      bookingId: b.bookingId,
      bookingNumber: b.bookingNumber,
      pax: getEffPax(b),
      mealDate: getEffDate(b) || null,
    }));
    onSendTelegram(blob, bookingsData);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-3">
      {/* Header */}
      <button onClick={onToggle} className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-3">
          <UtensilsCrossed className="w-4 h-4 text-orange-500 flex-shrink-0" />
          <div className="text-left">
            <div className="font-semibold text-gray-900">{name}</div>
            <div className="text-xs text-gray-500">
              {city && <span>{city}</span>}
              {hasTelegram && <span className="ml-2 text-blue-500">· TG ✓</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            {confirmedCount > 0 && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{confirmedCount}✅</span>}
            {pendingCount > 0   && <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">{pendingCount}🕐</span>}
            <span className="text-gray-400">{bookings.length} guruh · {totalPax} pax</span>
          </div>
          <button
            onClick={e => { e.stopPropagation(); handlePdf(); }}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
            title="PDF yuklab olish"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); handleTelegram(); }}
            disabled={sendingTelegram}
            className="p-1.5 rounded hover:bg-blue-50 text-blue-400 hover:text-blue-600 disabled:opacity-50 transition-colors"
            title="Telegram ga yuborish"
          >
            {sendingTelegram
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Send className="w-3.5 h-3.5" />
            }
          </button>
          {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {/* Table */}
      {open && (
        <div className="border-t border-gray-100">
          {/* MOBILE: card view */}
          <div className="md:hidden divide-y divide-gray-100">
            {bookings.map(b => {
              const effPax  = getEffPax(b);
              const effDate = getEffDate(b);
              const editingPax  = editingCell === `${b.bookingId}_pax`;
              const editingDate = editingCell === `${b.bookingId}_date`;
              return (
                <div key={b.bookingId} className="px-3 py-2.5 flex items-center gap-3 hover:bg-gray-50">
                  <Link to={`/bookings/${b.bookingId}`} className="font-mono text-xs font-bold text-blue-600 hover:underline shrink-0">
                    {b.bookingNumber}
                  </Link>
                  <div className="flex items-center gap-1 shrink-0">
                    {editingPax ? (
                      <input
                        type="number"
                        className="w-14 text-right border border-blue-400 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                        value={editValue}
                        autoFocus
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={() => commitEdit(b.bookingId, 'pax')}
                        onKeyDown={e => handleKeyDown(e, b.bookingId, 'pax')}
                      />
                    ) : (
                      <span
                        className="cursor-pointer px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-bold text-xs select-none"
                        onClick={e => startEdit(e, b.bookingId, 'pax', String(effPax))}
                      >
                        {effPax} PAX
                      </span>
                    )}
                  </div>
                  <div className="shrink-0">
                    {editingDate ? (
                      <input
                        type="date"
                        className="border border-blue-400 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                        value={editValue}
                        autoFocus
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={() => commitEdit(b.bookingId, 'date')}
                        onKeyDown={e => {
                          if (e.key === 'Enter') commitEdit(b.bookingId, 'date');
                          if (e.key === 'Escape') setEditingCell(null);
                        }}
                      />
                    ) : (
                      <span
                        className="cursor-pointer text-xs text-gray-600 hover:text-blue-700 select-none"
                        onClick={e => startEdit(e, b.bookingId, 'date', toInputDate(effDate))}
                      >
                        {effDate || '—'}
                      </span>
                    )}
                  </div>
                  <div className="ml-auto shrink-0">
                    {b.confirmation
                      ? <MealStatusBadge status={b.confirmation.status} confirmedBy={b.confirmation.confirmedBy} />
                      : <span className="text-xs text-gray-300">—</span>
                    }
                  </div>
                </div>
              );
            })}
            {bookings.length > 0 && (
              <div className="px-3 py-2 bg-blue-50 border-t-2 border-blue-200 flex items-center justify-between">
                <span className="font-bold text-blue-900 text-sm">GESAMT</span>
                <span className="font-bold text-blue-900 text-sm">{totalPax} PAX</span>
              </div>
            )}
          </div>
          {/* DESKTOP: table */}
          <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-2 text-left font-medium">Gruppe</th>
                <th className="px-4 py-2 text-right font-medium">PAX</th>
                <th className="px-4 py-2 text-left font-medium">Sana</th>
                <th className="px-4 py-2 text-left font-medium">Holat</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map(b => {
                const effPax = getEffPax(b);
                const effDate = getEffDate(b);
                const editingPax  = editingCell === `${b.bookingId}_pax`;
                const editingDate = editingCell === `${b.bookingId}_date`;
                return (
                  <tr key={b.bookingId} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2">
                      <Link to={`/bookings/${b.bookingId}`} className="text-blue-600 hover:underline font-mono text-xs font-medium">
                        {b.bookingNumber}
                      </Link>
                    </td>
                    {/* PAX — editable */}
                    <td className="px-4 py-2 text-right">
                      {editingPax ? (
                        <input
                          type="number"
                          className="w-16 text-right border border-blue-400 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                          value={editValue}
                          autoFocus
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={() => commitEdit(b.bookingId, 'pax')}
                          onKeyDown={e => handleKeyDown(e, b.bookingId, 'pax')}
                        />
                      ) : (
                        <span
                          className="cursor-pointer hover:bg-blue-50 hover:text-blue-700 rounded px-1 py-0.5 text-gray-700 select-none"
                          title="O'zgartirish uchun bosing"
                          onClick={e => startEdit(e, b.bookingId, 'pax', String(effPax))}
                        >
                          {effPax}
                        </span>
                      )}
                    </td>
                    {/* Sana — editable */}
                    <td className="px-4 py-2">
                      {editingDate ? (
                        <input
                          type="date"
                          className="border border-blue-400 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                          value={editValue}
                          autoFocus
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={() => { commitEdit(b.bookingId, 'date'); }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') commitEdit(b.bookingId, 'date');
                            if (e.key === 'Escape') setEditingCell(null);
                          }}
                        />
                      ) : (
                        <span
                          className="cursor-pointer hover:bg-blue-50 hover:text-blue-700 rounded px-1 py-0.5 text-gray-700 text-xs font-medium select-none"
                          title="O'zgartirish uchun bosing"
                          onClick={e => startEdit(e, b.bookingId, 'date', toInputDate(effDate))}
                        >
                          {effDate || '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {b.confirmation
                        ? <MealStatusBadge status={b.confirmation.status} confirmedBy={b.confirmation.confirmedBy} />
                        : <span className="text-xs text-gray-300">—</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {bookings.length > 0 && (
              <tfoot>
                <tr className="bg-blue-50 border-t-2 border-blue-200">
                  <td className="px-4 py-2 font-bold text-blue-900 text-sm">GESAMT</td>
                  <td className="px-4 py-2 text-right font-bold text-blue-900">{totalPax}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
          </div>
        </div>
      )}
    </div>
  );
}

function RestoranTab({ tourType, tourColor }) {
  const { selectedYear: YEAR } = useYear();
  const [loading, setLoading] = useState(true);
  const [restaurants, setRestaurants] = useState([]);
  const [openCards, setOpenCards] = useState({});
  const [sendingTelegram, setSendingTelegram] = useState({});
  const [overrides, setOverrides] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`jp_meal_overrides_${YEAR}_${tourType}`) || '{}'); }
    catch { return {}; }
  });
  const saveTimerRef = useRef(null);

  // Load from localStorage instantly, then overwrite with DB (authoritative)
  useEffect(() => {
    try { setOverrides(JSON.parse(localStorage.getItem(`jp_meal_overrides_${YEAR}_${tourType}`) || '{}')); }
    catch { setOverrides({}); }
    jahresplanungApi.getMealOverrides(YEAR, tourType)
      .then(res => {
        const data = res.data || {};
        setOverrides(data);
        try { localStorage.setItem(`jp_meal_overrides_${YEAR}_${tourType}`, JSON.stringify(data)); } catch {}
      })
      .catch(() => {});
  }, [tourType, YEAR]);

  const handleOverride = (key, value) => {
    setOverrides(prev => {
      const next = { ...prev, [key]: value };
      // Update localStorage cache immediately
      try { localStorage.setItem(`jp_meal_overrides_${YEAR}_${tourType}`, JSON.stringify(next)); } catch {}
      // Debounced save to DB
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        jahresplanungApi.saveMealOverrides(YEAR, tourType, next).catch(() => {});
      }, 1000);
      return next;
    });
  };

  const loadRestaurants = () => {
    setLoading(true);
    jahresplanungApi.getMeals(YEAR, tourType)
      .then(res => setRestaurants(res.data.restaurants || []))
      .catch(() => setRestaurants([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setRestaurants([]);
    loadRestaurants();
  }, [tourType, YEAR]);

  const handleSendTelegram = async (restaurant, blob, bookingsData) => {
    setSendingTelegram(prev => ({ ...prev, [restaurant.name]: true }));
    try {
      await jahresplanungApi.sendMealTelegram(restaurant.name, YEAR, tourType, blob, bookingsData);
      toast.success(`${restaurant.name} ga yuborildi ✅`);
      loadRestaurants(); // refresh confirmations
    } catch (err) {
      toast.error('Yuborishda xatolik: ' + (err.response?.data?.error || err.message));
    } finally {
      setSendingTelegram(prev => ({ ...prev, [restaurant.name]: false }));
    }
  };

  const color = tourColor || TOUR_COLORS[tourType] || '#be185d';

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: `${color}18` }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: `${color}40`, borderTopColor: color }} />
      </div>
      <p className="text-slate-400 font-medium text-sm">Yuklanmoqda...</p>
    </div>
  );

  if (!restaurants.length) return (
    <div className="flex flex-col items-center justify-center py-24">
      <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5"
        style={{ background: `${color}15` }}>
        <UtensilsCrossed className="w-10 h-10" style={{ color }} />
      </div>
      <p className="text-slate-600 font-semibold">Restoran ma'lumotlari topilmadi</p>
      <p className="text-slate-400 text-sm mt-1">OPEX → Meals → {tourType} tabida restoranlar qo'shing</p>
    </div>
  );

  const totalBookings = restaurants[0]?.bookings.length || 0;
  const confirmedTotal = restaurants.reduce((s, r) =>
    s + r.bookings.filter(b => b.confirmation?.status === 'CONFIRMED').length, 0);
  const totalRestaurants = restaurants.length;

  return (
    <div className="space-y-3">
      {/* Summary Strip */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
        style={{ background: `linear-gradient(135deg, ${color}12, ${color}06)`, border: `1px solid ${color}25` }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}20` }}>
          <UtensilsCrossed className="w-4 h-4" style={{ color }} />
        </div>
        <span className="text-sm font-semibold text-slate-700">{totalRestaurants} ta restoran</span>
        <span className="text-slate-300">·</span>
        <span className="text-sm text-slate-500">{totalBookings} ta guruh</span>
        {confirmedTotal > 0 && (
          <>
            <span className="text-slate-300">·</span>
            <span className="text-sm font-semibold text-emerald-600">✅ {confirmedTotal} ta tasdiqlangan</span>
          </>
        )}
      </div>

      {restaurants.map(rest => (
        <RestoranCard
          key={rest.name}
          restaurant={rest}
          tourType={tourType}
          open={!!openCards[rest.name]}
          onToggle={() => setOpenCards(prev => ({ ...prev, [rest.name]: !prev[rest.name] }))}
          overrides={overrides}
          onOverride={handleOverride}
          sendingTelegram={!!sendingTelegram[rest.name]}
          onSendTelegram={(blob, bookingsData) => handleSendTelegram(rest, blob, bookingsData)}
        />
      ))}
    </div>
  );
}

// ── End RestoranTab ─────────────────────────────────────────────────────────

function HotelsTab({ tourType, tourColor }) {
  const { selectedYear: YEAR } = useYear();
  const [loading, setLoading] = useState(true);
  const [hotels, setHotels] = useState([]);
  const [openHotels, setOpenHotels] = useState({});
  const [openCities, setOpenCities] = useState({});
  const [sendingEmail, setSendingEmail] = useState({});
  const [sendingTelegram, setSendingTelegram] = useState({});
  const [overrides, setOverrides] = useState({});
  const [rowStatuses, setRowStatuses] = useState({});
  // Extra hotels added per city: { cityName: [hotelId, ...] }
  const [cityExtraHotels, setCityExtraHotels] = useState({});
  // Booking → hotel assignment within city: { cityAssignKey: hotelId }
  const [bookingHotelAssign, setBookingHotelAssign] = useState({});
  // All hotels from DB (for picker)
  const [allHotels, setAllHotels] = useState([]);
  const [logoDataUrl, setLogoDataUrl] = useState(null);
  const saveTimerRef = useRef(null);
  const loadingRef = useRef(false);

  // Load all hotels + logo once
  useEffect(() => {
    jahresplanungApi.getAllHotels()
      .then(res => setAllHotels(res.data))
      .catch(() => {});
    jahresplanungApi.getLogo()
      .then(res => { if (res.data?.dataUrl) setLogoDataUrl(res.data.dataUrl); })
      .catch(() => {});
  }, []);

  // Combined load: hotels + state + jpSections (localStorage = fast cache, DB = authoritative)
  useEffect(() => {
    loadingRef.current = true;
    const fromLS = (key) => { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : {}; } catch { return {}; } };
    setOverrides(fromLS(`jp_overrides_${YEAR}_${tourType}`));
    setRowStatuses(fromLS(`jp_statuses_${YEAR}_${tourType}`));
    setCityExtraHotels(fromLS(`jp_cityExtras_${YEAR}_${tourType}`));
    setBookingHotelAssign(fromLS(`jp_hotelAssign_${YEAR}_${tourType}`));
    setLoading(true);

    Promise.all([
      jahresplanungApi.getHotels(YEAR, tourType),
      jahresplanungApi.getState(YEAR, tourType),
      jahresplanungApi.getJpSections().catch(() => ({ data: [] }))
    ]).then(([hotelsRes, stateRes, jpRes]) => {
      const hotelsList = hotelsRes.data.hotels || [];
      setHotels(hotelsList);
      const cities = {};
      hotelsList.forEach(h => { cities[h.hotel.city?.name || 'Бошқа'] = true; });
      setOpenCities(cities);

      const { overrides: o = {}, statuses: s = {}, cityExtras: c = {}, hotelAssign: h = {} } = stateRes.data || {};
      const sections = jpRes.data?.sections || [];

      // Merge JP_SECTIONS Telegram statuses into rowStatuses (use actual rowKeys from hotels data)
      const JP_TO_ROW = { CONFIRMED: 'confirmed', WAITING: 'waiting', REJECTED: 'cancelled' };
      const merged = { ...s };
      for (const hd of hotelsList) {
        const sec = sections.find(sec2 => sec2.hotelId === hd.hotel.id);
        if (!sec) continue;
        // Build visit-index map: for each bookingId, sort rows by checkInDate → index 0,1,2...
        const bookingVisitOrder = {};
        for (const b of hd.bookings) {
          if (!bookingVisitOrder[b.bookingId]) bookingVisitOrder[b.bookingId] = [];
          bookingVisitOrder[b.bookingId].push(b);
        }
        for (const arr of Object.values(bookingVisitOrder)) {
          arr.sort((a, b2) => new Date(a.checkInDate) - new Date(b2.checkInDate));
        }
        for (const b of hd.bookings) {
          const grp = (sec.groups || []).find(g => g.bookingId === b.bookingId);
          if (!grp) continue;
          const k = rowKey(hd.hotel.id, b);
          // Try date match first (most accurate)
          let applied = false;
          for (const v of (grp.visits || [])) {
            if (!v.status || v.status === 'PENDING') continue;
            const rowVal = JP_TO_ROW[v.status];
            if (!rowVal) continue;
            const dateParts = (v.checkIn || '').split('.');
            const isoDate = dateParts.length === 3 ? `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}` : null;
            if (!isoDate || k.includes(isoDate)) { merged[k] = rowVal; applied = true; break; }
          }
          // Fallback: match by visit index (handles date mismatch from non-round dep timestamps
          // or algorithm changes — N-th backend booking ↔ N-th JP_SECTIONS visit, both sorted by date)
          if (!applied) {
            const arr = bookingVisitOrder[b.bookingId] || [];
            const visitIdx = arr.indexOf(b);
            const sortedVisits = [...(grp.visits || [])].sort((a, b2) => {
              const toIso = s2 => { const p = (s2||'').split('.'); return p.length===3?`${p[2]}-${p[1]}-${p[0]}`:''; };
              return toIso(a.checkIn).localeCompare(toIso(b2.checkIn));
            });
            const v = visitIdx >= 0 ? sortedVisits[visitIdx] : null;
            if (v && v.status && v.status !== 'PENDING') {
              const rowVal = JP_TO_ROW[v.status];
              if (rowVal) merged[k] = rowVal;
            }
          }
        }
      }

      setOverrides(o); setRowStatuses(merged); setCityExtraHotels(c); setBookingHotelAssign(h);
      // Update localStorage cache with authoritative DB data
      try {
        localStorage.setItem(`jp_overrides_${YEAR}_${tourType}`, JSON.stringify(o));
        localStorage.setItem(`jp_statuses_${YEAR}_${tourType}`, JSON.stringify(merged));
        localStorage.setItem(`jp_cityExtras_${YEAR}_${tourType}`, JSON.stringify(c));
        localStorage.setItem(`jp_hotelAssign_${YEAR}_${tourType}`, JSON.stringify(h));
      } catch {}
    }).catch(err => {
      toast.error("Ma'lumot yuklanmadi: " + err.message);
    }).finally(() => { setLoading(false); loadingRef.current = false; });
  }, [tourType, YEAR]);

  // Debounced save to DB on any state change (skip during initial load)
  useEffect(() => {
    if (loadingRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      jahresplanungApi.saveState(YEAR, tourType, {
        overrides, statuses: rowStatuses, cityExtras: cityExtraHotels, hotelAssign: bookingHotelAssign
      }).catch(() => {});
    }, 1500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [overrides, rowStatuses, cityExtraHotels, bookingHotelAssign]);

  const setOverrideVal = (key, field, val) => {
    setOverrides(prev => {
      const next = { ...prev, [key]: { ...(prev[key]||{}), [field]: val } };
      try { localStorage.setItem(`jp_overrides_${YEAR}_${tourType}`, JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const setRowStatus = (key, status) => {
    setRowStatuses(prev => {
      const next = { ...prev };
      if (status === null || status === undefined) delete next[key];
      else next[key] = status;
      try { localStorage.setItem(`jp_statuses_${YEAR}_${tourType}`, JSON.stringify(next)); } catch {}
      return next;
    });
    // Sync to JP_SECTIONS (Hotels 2026)
    try {
      const parts = key.split('_');
      if (parts.length >= 2) {
        const hotelId = parseInt(parts[0]);
        const bookingId = parseInt(parts[1]);
        const JP_STATUS = { confirmed: 'CONFIRMED', waiting: 'WAITING', cancelled: 'REJECTED' };
        const jpStatus = JP_STATUS[status] || 'PENDING';
        jahresplanungApi.updateVisitStatus(hotelId, bookingId, jpStatus).catch(() => {});
      }
    } catch {}
  };

  const handleAddHotel = (cityName, hotel, currentCityHotels) => {
    // 1. Add new hotel to city extras
    const newExtras = { ...cityExtraHotels };
    if (!(newExtras[cityName] || []).includes(hotel.id)) {
      newExtras[cityName] = [...(newExtras[cityName] || []), hotel.id];
    }
    setCityExtraHotels(newExtras);
    try { localStorage.setItem(`jp_cityExtras_${YEAR}_${tourType}`, JSON.stringify(newExtras)); } catch {}

    // 2. Auto-assign non-confirmed bookings to the new hotel
    if (currentCityHotels && currentCityHotels.length > 0) {
      setBookingHotelAssign(prev => {
        const next = { ...prev };
        for (const hd of currentCityHotels) {
          for (const b of hd.bookings) {
            const status = rowStatuses[rowKey(hd.hotel.id, b)];
            if (status !== 'confirmed') {
              next[cityAssignKey(cityName, b)] = hotel.id;
            }
          }
        }
        try { localStorage.setItem(`jp_hotelAssign_${YEAR}_${tourType}`, JSON.stringify(next)); } catch {}
        return next;
      });
    }
  };

  const handleReplaceHotel = (cityName, oldHotelId, currentBookings, newHotel) => {
    // 1. Add new hotel to city extras
    const newExtras = { ...cityExtraHotels };
    if (!(newExtras[cityName] || []).includes(newHotel.id)) {
      newExtras[cityName] = [...(newExtras[cityName] || []), newHotel.id];
    }
    // 2. If old hotel was extra, remove it from extras
    if ((newExtras[cityName] || []).includes(oldHotelId)) {
      newExtras[cityName] = newExtras[cityName].filter(id => id !== oldHotelId);
    }
    setCityExtraHotels(newExtras);
    try { localStorage.setItem(`jp_cityExtras_${YEAR}_${tourType}`, JSON.stringify(newExtras)); } catch {}

    // 3. Move all bookings from old hotel → new hotel
    setBookingHotelAssign(prev => {
      const next = { ...prev };
      for (const b of currentBookings) {
        next[cityAssignKey(cityName, b)] = newHotel.id;
      }
      try { localStorage.setItem(`jp_hotelAssign_${YEAR}_${tourType}`, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const handleRemoveHotel = (cityName, hotelId) => {
    setBookingHotelAssign(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => { if (next[k] === hotelId) delete next[k]; });
      try { localStorage.setItem(`jp_hotelAssign_${YEAR}_${tourType}`, JSON.stringify(next)); } catch {}
      return next;
    });
    setCityExtraHotels(prev => {
      const next = { ...prev, [cityName]: (prev[cityName] || []).filter(id => id !== hotelId) };
      try { localStorage.setItem(`jp_cityExtras_${YEAR}_${tourType}`, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const handleMoveBooking = (cityKey, newHotelId) => {
    setBookingHotelAssign(prev => {
      const next = { ...prev, [cityKey]: newHotelId };
      try { localStorage.setItem(`jp_hotelAssign_${YEAR}_${tourType}`, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const handlePDF = async (hotelData) => {
    setSendingEmail(prev => ({ ...prev, [`pdf_${hotelData.hotel.id}`]: true }));
    try {
      const blob = await fetchHotelPdfBlob(hotelData, tourType, overrides, YEAR);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${YEAR}_${tourType}_${hotelData.hotel.name.replace(/\s+/g,'_')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('PDF xatolik: ' + (err.response?.data?.error || err.message));
    } finally { setSendingEmail(prev => ({ ...prev, [`pdf_${hotelData.hotel.id}`]: false })); }
  };

  const handleEmail = async (hotelData) => {
    const { hotel } = hotelData;
    if (!hotel.email) { toast.error(`${hotel.name} — email yo'q`); return; }
    setSendingEmail(prev => ({ ...prev, [hotel.id]: true }));
    try {
      const blob = await fetchHotelPdfBlob(hotelData, tourType, overrides, YEAR);
      await jahresplanungApi.sendHotelEmail(hotel.id, blob, `${YEAR}_${tourType}_${hotel.name.replace(/\s+/g,'_')}.pdf`, YEAR, tourType);
      toast.success(`Email yuborildi → ${hotel.email}`);
    } catch (err) {
      toast.error('Email xatolik: ' + (err.response?.data?.error || err.message));
    } finally { setSendingEmail(prev => ({ ...prev, [hotel.id]: false })); }
  };

  const handleTelegram = async (hotelData) => {
    const { hotel } = hotelData;
    if (!hotel.telegramChatId) { toast.error(`${hotel.name} — Telegram yo'q`); return; }
    setSendingTelegram(prev => ({ ...prev, [hotel.id]: true }));
    try {
      // Use client-side jsPDF (avoids Puppeteer timeout issues on server)
      const blob = generateHotelPDF(hotelData, tourType, overrides, logoDataUrl, true, YEAR);
      const payload = buildPdfPayload(hotelData, tourType, overrides, YEAR);
      const filename = `${YEAR}_${tourType}_${hotel.name.replace(/\s+/g, '_')}.pdf`;
      await jahresplanungApi.sendHotelTelegram(hotel.id, blob, filename, YEAR, tourType, payload.sections);
      toast.success(`Telegram → ${hotel.name}`);
    } catch (err) {
      toast.error('Telegram xatolik: ' + (err.response?.data?.error || err.message));
    } finally { setSendingTelegram(prev => ({ ...prev, [hotel.id]: false })); }
  };

  const color = tourColor || TOUR_COLORS[tourType] || '#3B82F6';

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: `${color}18` }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: `${color}40`, borderTopColor: color }} />
      </div>
      <p className="text-slate-400 font-medium text-sm">Yuklanmoqda...</p>
    </div>
  );

  if (hotels.length === 0) return (
    <div className="flex flex-col items-center justify-center py-24">
      <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5"
        style={{ background: `${color}15` }}>
        <Building2 className="w-10 h-10" style={{ color }} />
      </div>
      <p className="text-slate-600 font-semibold">{YEAR} yil uchun {tourType} — hotel topilmadi</p>
      <p className="text-slate-400 text-sm mt-1">Bookings ichida Accommodations qo'shilganda ko'rinadi</p>
    </div>
  );

  // Group by city
  const cityMap = {};
  hotels.forEach(hd => {
    const c = hd.hotel.city?.name || 'Бошқа';
    if (!cityMap[c]) cityMap[c] = [];
    cityMap[c].push(hd);
  });
  const sortedCities = Object.keys(cityMap).sort((a,b) => getCityOrder(a, tourType) - getCityOrder(b, tourType));

  return (
    <div className="space-y-4">
      {/* Edit hint */}
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium"
        style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }}>
        <span>💡</span>
        <span>PAX, DBL, TWN, ЕД ustunlaridagi raqamlarni bosib tahrirlash mumkin</span>
      </div>

      {sortedCities.map((city, cityIdx) => {
        const originalHotels = cityMap[city];
        const displayHotels = computeCityHotels(city, originalHotels, cityExtraHotels, bookingHotelAssign, allHotels);
        const isCityOpen = openCities[city] !== false;
        const totalGroups = displayHotels.reduce((s,hd) => s + hd.bookings.filter(b=>b.status!=='CANCELLED').length, 0);
        const totalPax = displayHotels.reduce((s,hd) => {
          return s + hd.bookings.filter(b=>b.status!=='CANCELLED').reduce((ss,b)=>{
            const k = rowKey(hd.hotel.id, b);
            return ss + (overrides[k]?.pax ?? b.pax ?? 0);
          }, 0);
        }, 0);
        const displayHotelIds = new Set(displayHotels.map(h => h.hotel.id));
        const availableToAdd = allHotels.filter(h => h.city?.name === city && !displayHotelIds.has(h.id));

        return (
          <div key={city} className="rounded-2xl overflow-hidden shadow-sm" style={{ border: `1px solid ${color}25` }}>
            {/* City Header */}
            <button
              onClick={() => setOpenCities(prev => ({ ...prev, [city]: !prev[city] }))}
              className="w-full px-4 md:px-5 py-3.5 flex items-center gap-3 text-left transition-all duration-200 group"
              style={{
                background: `linear-gradient(135deg, #1e293b, #0f172a)`,
                borderLeft: `4px solid ${color}`,
              }}
            >
              <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: `${color}25` }}>
                <MapPin className="w-4 h-4" style={{ color }} />
              </div>
              <span className="font-bold text-white text-sm md:text-base flex-1 truncate">{city}</span>
              <div className="flex items-center gap-2 md:gap-3 shrink-0">
                <span className="hidden md:flex items-center gap-1 text-xs text-slate-400">
                  <span className="font-semibold text-slate-300">{displayHotels.length}</span> отель
                </span>
                <span className="text-slate-600 hidden md:inline">·</span>
                <span className="hidden md:flex items-center gap-1 text-xs text-slate-400">
                  <span className="font-semibold text-slate-300">{totalGroups}</span> группы
                </span>
                <span className="px-2.5 py-1 rounded-lg text-xs font-black text-white"
                  style={{ background: `${color}cc` }}>
                  {totalPax} PAX
                </span>
                {isCityOpen
                  ? <ChevronDown className="w-4 h-4 text-slate-500" />
                  : <ChevronRight className="w-4 h-4 text-slate-500" />}
              </div>
            </button>

            {isCityOpen && (
              <div className="p-3 space-y-2" style={{ background: '#f8fafc' }}>
                {displayHotels.map(hd => (
                  <HotelCard
                    key={hd.hotel.id}
                    hotelData={hd}
                    tourType={tourType}
                    tourColor={color}
                    isOpen={!!openHotels[hd.hotel.id]}
                    onToggle={() => setOpenHotels(prev => ({ ...prev, [hd.hotel.id]: !prev[hd.hotel.id] }))}
                    overrides={overrides}
                    setOverrideVal={setOverrideVal}
                    rowStatuses={rowStatuses}
                    setRowStatus={setRowStatus}
                    sendingEmail={sendingEmail[hd.hotel.id]}
                    sendingTelegram={sendingTelegram[hd.hotel.id]}
                    onEmail={handleEmail}
                    onTelegram={handleTelegram}
                    onPDF={handlePDF}
                    cityName={city}
                    cityHotels={displayHotels}
                    onMoveBooking={handleMoveBooking}
                    isExtra={!!hd.isExtra}
                    onRemoveHotel={() => handleRemoveHotel(city, hd.hotel.id)}
                    availableHotelsForSwap={allHotels.filter(h => h.city?.name === city && h.id !== hd.hotel.id)}
                    onReplaceHotel={newHotel => handleReplaceHotel(city, hd.hotel.id, hd.bookings, newHotel)}
                  />
                ))}
                {availableToAdd.length > 0 && (
                  <div className="pt-1">
                    <AddHotelButton
                      cityName={city}
                      availableHotels={availableToAdd}
                      onAdd={h => handleAddHotel(city, h, displayHotels)}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Jahresplanung() {
  const { selectedYear: YEAR } = useYear();
  const [mainTab, setMainTab] = useState(() => localStorage.getItem('jp_mainTab') || 'hotels');
  const [tourTab, setTourTab] = useState(() => localStorage.getItem('jp_tourTab') || 'ER');

  const activeTabMeta  = MAIN_TABS.find(t => t.id === mainTab) || MAIN_TABS[0];
  const activeTourColor = TOUR_COLORS[tourTab] || '#3B82F6';

  return (
    <div className="min-h-screen" style={{ background: '#0f1729' }}>

      {/* ── HERO HEADER ── */}
      <div className="relative overflow-hidden" style={{
        background: 'linear-gradient(160deg, #0f1729 0%, #1a1040 55%, #0f1729 100%)'
      }}>
        {/* Glow blob */}
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full pointer-events-none"
          style={{ background: activeTourColor, opacity: 0.12, filter: 'blur(80px)', transform: 'translate(30%,-30%)' }} />
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: activeTabMeta.color, opacity: 0.08, filter: 'blur(60px)', transform: 'translate(-30%,30%)' }} />

        <div className="relative px-4 md:px-6 pt-7 pb-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
              style={{ background: `${activeTourColor}25`, color: activeTourColor }}>
              {YEAR}
            </span>
            <span className="text-slate-600 text-xs">›</span>
            <span className="text-slate-500 text-xs font-medium">Yillik Reja</span>
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-none">
            Jahresplanung
          </h1>
          <p className="text-slate-500 text-sm mt-2">Yillik reja — hotellar, restoranlar, transport</p>

          {/* Main Tabs */}
          <div className="flex gap-3 mt-6">
            {MAIN_TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = mainTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => { setMainTab(tab.id); localStorage.setItem('jp_mainTab', tab.id); }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
                  style={isActive ? {
                    background: `linear-gradient(135deg, ${tab.color}, ${tab.color}bb)`,
                    color: 'white',
                    boxShadow: `0 0 20px ${tab.color}50`,
                  } : {
                    background: 'rgba(255,255,255,0.06)',
                    color: 'rgba(255,255,255,0.45)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tour Type Pills */}
          <div className="flex gap-2 mt-4">
            {TOUR_TYPES.map(t => {
              const isActive = tourTab === t;
              const color = TOUR_COLORS[t];
              return (
                <button
                  key={t}
                  onClick={() => { setTourTab(t); localStorage.setItem('jp_tourTab', t); }}
                  className="relative overflow-hidden px-5 py-2 rounded-xl text-sm font-bold transition-all duration-200"
                  style={isActive ? {
                    background: `linear-gradient(135deg, ${color}, ${color}99)`,
                    color: 'white',
                    boxShadow: `0 0 25px ${color}45`,
                    transform: 'translateY(-2px)',
                  } : {
                    background: 'rgba(255,255,255,0.04)',
                    color: color,
                    border: `1px solid ${color}40`,
                  }}
                >
                  {t}
                  {isActive && (
                    <span className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full bg-white opacity-60" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="bg-slate-50 min-h-screen">
        <div className="px-3 md:px-6 py-5 max-w-7xl mx-auto">
          {mainTab==='hotels'    && <HotelsTab   tourType={tourTab} tourColor={activeTourColor} />}
          {mainTab==='restoran'  && <RestoranTab  tourType={tourTab} tourColor={activeTourColor} />}
          {mainTab==='transport' && <TransportTab tourType={tourTab} tourColor={activeTourColor} />}
        </div>
      </div>
    </div>
  );
}
