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

const YEAR = 2026;
const TOUR_TYPES = ['ER', 'CO', 'KAS', 'ZA'];
const MAIN_TABS = [
  { id: 'hotels', label: 'Hotels', icon: Building2 },
  { id: 'restoran', label: 'Restoran', icon: UtensilsCrossed },
  { id: 'transport', label: 'Transport', icon: Bus },
];
const TOUR_NAMES = { ER: 'Erlebnisreisen', CO: 'ComfortPlus', KAS: 'Kasachstan', ZA: 'Zentralasien' };
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
  );
}

const TOUR_COUNTRY = { ER: 'Германия', CO: 'Германия', KAS: 'Казахстан', ZA: 'Германия' };

// Build structured data for server-side PDF generation
function buildPdfPayload(hotelData, tourType, overrides) {
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

  const { first, second, third, hasSplit, hasThird } = splitVisits(resolved);

  function buildSection(rows, label) {
    const dataRows = rows.map((b, i) => ({
      no: i + 1, group: b.bookingNumber, bookingId: b.bookingId, country,
      pax: b.pax || 0,
      checkIn: formatDate(b.checkInDate), checkOut: formatDate(b.checkOutDate),
      dbl: b.dbl || 0, twn: b.twn || 0, sngl: b.sngl || 0,
      cancelled: b.status === 'CANCELLED',
    }));
    return { label: label || null, rows: dataRows };
  }

  const sections = hasSplit
    ? [buildSection(first, 'Первый заезд'), buildSection(second, 'Второй заезд'),
       ...(hasThird ? [buildSection(third, 'Третий заезд')] : [])]
    : [buildSection(resolved, null)];

  return { hotelName: hotel.name, cityName: hotel.city?.name || '', tourType, year: YEAR, sections };
}

// Fetch PDF blob from server
async function fetchHotelPdfBlob(hotelData, tourType, overrides) {
  const payload = buildPdfPayload(hotelData, tourType, overrides);
  const res = await jahresplanungApi.generatePDF(payload);
  return new Blob([res.data], { type: 'application/pdf' });
}

// Legacy stub — replaced by server-side PDF (kept to avoid breaking callers during transition)
function generateHotelPDF(hotelData, tourType, overrides, logoDataUrl, returnBlob = false) {
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

  const { first, second, third, hasSplit, hasThird } = splitVisits(resolved);
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
    body: [[{ content: `JAHRESPLANUNG ${YEAR} — ${tourLabel}` }]],
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
    y = addTable(y, resolved, null);
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
  doc.save(`${YEAR}_${tourType}_${hotel.name.replace(/\s+/g, '_')}.pdf`);
}

function HotelCard({ hotelData, tourType, isOpen, onToggle, overrides, setOverrideVal, rowStatuses, setRowStatus,
  onEmail, onTelegram, sendingEmail, sendingTelegram, onPDF,
  cityName, cityHotels, onMoveBooking, isExtra, onRemoveHotel,
  availableHotelsForSwap, onReplaceHotel }) {
  const { hotel, bookings } = hotelData;
  const { first, second, third, hasSplit, hasThird } = splitVisits(bookings);

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
    <div className={`bg-white border rounded-lg overflow-hidden ${isExtra ? 'border-blue-200' : 'border-gray-200'}`}>
      <div className="px-4 py-3 flex items-center gap-3">
        <button onClick={onToggle} className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity">
          {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
          <Building2 className={`w-4 h-4 flex-shrink-0 ${isExtra ? 'text-blue-500' : 'text-blue-400'}`} />
          <div className="flex-1 min-w-0 flex items-center gap-1.5">
            <span className="font-medium text-gray-800 text-sm">{hotel.name}</span>
            {isExtra && <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">qo'shimcha</span>}
            {hotel.email && <span className="text-xs text-gray-400">{hotel.email}</span>}
            {availableHotelsForSwap && availableHotelsForSwap.length > 0 && (
              <HotelSwapButton
                currentHotelId={hotel.id}
                availableHotels={availableHotelsForSwap}
                onReplace={onReplaceHotel}
              />
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 mr-2 text-xs text-gray-500">
            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{bookings.length} группа</span>
            <span>{totalPax} PAX</span>
            <span>{totalRooms} ном.</span>
          </div>
        </button>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={() => onPDF(hotelData)} className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition-colors" title="PDF">
            <Download className="w-3.5 h-3.5" /> PDF
          </button>
          <button onClick={() => onEmail(hotelData)} disabled={!!sendingEmail} className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-medium transition-colors disabled:opacity-50" title={hotel.email||"Email yo'q"}>
            {sendingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Mail className="w-3.5 h-3.5"/>} Email
          </button>
          <button onClick={() => onTelegram(hotelData)} disabled={!!sendingTelegram} className="flex items-center gap-1 px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg text-xs font-medium transition-colors disabled:opacity-50" title={hotel.telegramChatId?'TG':"Telegram yo'q"}>
            {sendingTelegram ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Send className="w-3.5 h-3.5"/>} TG
          </button>
          {isExtra && (
            <button onClick={onRemoveHotel} title="Hotelni olib tashlash"
              className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {isOpen && (
        hasSplit ? (
          <>
            <BookingsTable bookings={first}  {...sharedProps} visitLabel="Первый заезд" />
            <BookingsTable bookings={second} {...sharedProps} visitLabel="Второй заезд" />
            {hasThird && <BookingsTable bookings={third} {...sharedProps} visitLabel="Третий заезд" />}
          </>
        ) : (
          <BookingsTable bookings={bookings} {...sharedProps} visitLabel={null} />
        )
      )}
    </div>
  );
}

function HotelsTab({ tourType }) {
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

  // Combined load: hotels + state + jpSections (localhost first for instant UX, then DB authoritative)
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
      const sections = jpRes.data || [];

      // Merge JP_SECTIONS Telegram statuses into rowStatuses (use actual rowKeys from hotels data)
      const JP_TO_ROW = { CONFIRMED: 'confirmed', WAITING: 'waiting', REJECTED: 'cancelled' };
      const merged = { ...s };
      for (const hd of hotelsList) {
        const sec = sections.find(sec2 => sec2.hotelId === hd.hotel.id);
        if (!sec) continue;
        for (const b of hd.bookings) {
          const grp = (sec.groups || []).find(g => g.bookingId === b.bookingId);
          if (!grp) continue;
          for (const v of (grp.visits || [])) {
            if (!v.status || v.status === 'PENDING') continue;
            const rowVal = JP_TO_ROW[v.status];
            if (!rowVal) continue;
            const dateParts = (v.checkIn || '').split('.');
            const isoDate = dateParts.length === 3 ? `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}` : null;
            const k = rowKey(hd.hotel.id, b);
            if (!isoDate || k.includes(isoDate)) merged[k] = rowVal;
          }
        }
      }

      setOverrides(o); setRowStatuses(merged); setCityExtraHotels(c); setBookingHotelAssign(h);
      try {
        localStorage.setItem(`jp_overrides_${YEAR}_${tourType}`, JSON.stringify(o));
        localStorage.setItem(`jp_statuses_${YEAR}_${tourType}`, JSON.stringify(merged));
        localStorage.setItem(`jp_cityExtras_${YEAR}_${tourType}`, JSON.stringify(c));
        localStorage.setItem(`jp_hotelAssign_${YEAR}_${tourType}`, JSON.stringify(h));
      } catch {}
    }).catch(err => {
      toast.error("Ma'lumot yuklanmadi: " + err.message);
    }).finally(() => { setLoading(false); loadingRef.current = false; });
  }, [tourType]);

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
            // Move if NOT confirmed (null = unset, 'waiting', 'cancelled')
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
    // Clean up any assignments pointing to this hotel (they fall back to original)
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
      const blob = await fetchHotelPdfBlob(hotelData, tourType, overrides);
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
      const blob = await fetchHotelPdfBlob(hotelData, tourType, overrides);
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
      const payload = buildPdfPayload(hotelData, tourType, overrides);
      const blob = await fetchHotelPdfBlob(hotelData, tourType, overrides);
      await jahresplanungApi.sendHotelTelegram(hotel.id, blob, `${YEAR}_${tourType}_${hotel.name.replace(/\s+/g,'_')}.pdf`, YEAR, tourType, payload.sections);
      toast.success(`Telegram → ${hotel.name}`);
    } catch (err) {
      toast.error('Telegram xatolik: ' + (err.response?.data?.error || err.message));
    } finally { setSendingTelegram(prev => ({ ...prev, [hotel.id]: false })); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary-600"/></div>;

  if (hotels.length === 0) return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
      <Building2 className="w-12 h-12 mb-3 opacity-30"/>
      <p className="text-sm">{YEAR} yil uchun {tourType} — hotel ma'lumoti topilmadi</p>
      <p className="text-xs mt-1">Bookings ichida Accommodations qo'shilganda ko'rinadi</p>
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
      <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
        💡 PAX, DBL, TWN, ЕД ustunlaridagi raqamlarni bosib tahrirlash mumkin
      </div>

      {sortedCities.map(city => {
        const originalHotels = cityMap[city];
        // Compute effective hotel list with booking distribution
        const displayHotels = computeCityHotels(city, originalHotels, cityExtraHotels, bookingHotelAssign, allHotels);
        const isCityOpen = openCities[city] !== false;
        const totalGroups = displayHotels.reduce((s,hd) => s + hd.bookings.filter(b=>b.status!=='CANCELLED').length, 0);
        const totalPax = displayHotels.reduce((s,hd) => {
          return s + hd.bookings.filter(b=>b.status!=='CANCELLED').reduce((ss,b)=>{
            const k = rowKey(hd.hotel.id, b);
            return ss + (overrides[k]?.pax ?? b.pax ?? 0);
          }, 0);
        }, 0);

        // Hotels available to add/swap in this city (same city, not already displayed)
        const displayHotelIds = new Set(displayHotels.map(h => h.hotel.id));
        const availableToAdd = allHotels.filter(h => h.city?.name === city && !displayHotelIds.has(h.id));

        return (
          <div key={city} className="rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <button
              onClick={() => setOpenCities(prev => ({ ...prev, [city]: !prev[city] }))}
              className="w-full bg-gray-800 text-white px-5 py-3.5 flex items-center gap-3 hover:bg-gray-700 transition-colors text-left"
            >
              {isCityOpen ? <ChevronDown className="w-4 h-4 text-gray-300 flex-shrink-0"/> : <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0"/>}
              <MapPin className="w-5 h-5 text-blue-400 flex-shrink-0"/>
              <span className="font-semibold text-base flex-1">{city}</span>
              <div className="flex items-center gap-3 text-sm text-gray-300">
                <span>{displayHotels.length} отель</span>
                <span>·</span>
                <span>{totalGroups} группы</span>
                <span>·</span>
                <span>{totalPax} PAX</span>
              </div>
            </button>

            {isCityOpen && (
              <div className="bg-gray-50 p-3 space-y-2">
                {displayHotels.map(hd => (
                  <HotelCard
                    key={hd.hotel.id}
                    hotelData={hd}
                    tourType={tourType}
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
  const [mainTab, setMainTab] = useState('hotels');
  const [tourTab, setTourTab] = useState(() => localStorage.getItem('jp_tourTab') || 'ER');

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Jahresplanung {YEAR}</h1>
        <p className="text-sm text-gray-500 mt-1">Yillik reja — hotellar, restoranlar, transport</p>
      </div>

      <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1 w-fit">
        {MAIN_TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setMainTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mainTab===tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Icon className="w-4 h-4"/> {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2 mb-5">
        {TOUR_TYPES.map(t => (
          <button key={t} onClick={() => { setTourTab(t); localStorage.setItem('jp_tourTab', t); }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${tourTab===t ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {mainTab==='hotels' && <HotelsTab tourType={tourTab}/>}
      {mainTab==='restoran' && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <UtensilsCrossed className="w-12 h-12 mb-3 opacity-30"/>
          <p className="text-sm font-medium">Restoran moduli — tez orada</p>
        </div>
      )}
      {mainTab==='transport' && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Bus className="w-12 h-12 mb-3 opacity-30"/>
          <p className="text-sm font-medium">Transport moduli — tez orada</p>
        </div>
      )}
    </div>
  );
}
