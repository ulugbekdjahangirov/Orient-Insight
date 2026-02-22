import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import toast from 'react-hot-toast';
import {
  Building2, UtensilsCrossed, Bus, Download, Mail, Send,
  ChevronDown, ChevronRight, Loader2, Calendar
} from 'lucide-react';
import { jahresplanungApi } from '../services/api';

const TOUR_TYPES = ['ER', 'CO', 'KAS', 'ZA'];

const MAIN_TABS = [
  { id: 'hotels', label: 'Hotels', icon: Building2 },
  { id: 'restoran', label: 'Restoran', icon: UtensilsCrossed },
  { id: 'transport', label: 'Transport', icon: Bus },
];

const TOUR_NAMES = {
  ER: 'Erlebnisreisen',
  CO: 'ComfortPlus',
  KAS: 'Kasachstan',
  ZA: 'Zentralasien'
};

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

function generateHotelPDF(hotelData, year, tourType, returnBlob = false) {
  const { hotel, bookings } = hotelData;
  const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });

  const cityName = hotel.city?.name || '';
  const tourLabel = TOUR_NAMES[tourType] || tourType;

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(hotel.name, 14, 18);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`${cityName}  |  ${tourLabel}  |  ${year}`, 14, 26);

  // Table
  const tableHead = [['Gruppe', 'Anreise', 'Abreise', 'Nächte', 'PAX', 'DBL', 'TWN', 'EZ', 'Gesamt', 'Status']];

  const tableBody = bookings.map(b => [
    b.bookingNumber,
    formatDate(b.checkInDate),
    formatDate(b.checkOutDate),
    b.nights || 0,
    b.pax || 0,
    b.dbl || 0,
    b.twn || 0,
    b.sngl || 0,
    (b.dbl || 0) + (b.twn || 0) + (b.sngl || 0),
    b.status === 'CANCELLED' ? 'STORNO' : ''
  ]);

  // Summary row
  const active = bookings.filter(b => b.status !== 'CANCELLED');
  const totals = active.reduce((acc, b) => ({
    pax: acc.pax + (b.pax || 0),
    dbl: acc.dbl + (b.dbl || 0),
    twn: acc.twn + (b.twn || 0),
    sngl: acc.sngl + (b.sngl || 0),
    rooms: acc.rooms + (b.dbl || 0) + (b.twn || 0) + (b.sngl || 0)
  }), { pax: 0, dbl: 0, twn: 0, sngl: 0, rooms: 0 });

  tableBody.push(['GESAMT', '', '', '', totals.pax, totals.dbl, totals.twn, totals.sngl, totals.rooms, '']);

  autoTable(doc, {
    startY: 32,
    head: tableHead,
    body: tableBody,
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 28 },
      2: { cellWidth: 28 },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 16, halign: 'center' },
      5: { cellWidth: 16, halign: 'center' },
      6: { cellWidth: 16, halign: 'center' },
      7: { cellWidth: 16, halign: 'center' },
      8: { cellWidth: 20, halign: 'center' },
      9: { cellWidth: 22 }
    },
    didParseCell: (data) => {
      const rowIdx = data.row.index;
      if (rowIdx < bookings.length && bookings[rowIdx]?.status === 'CANCELLED') {
        data.cell.styles.fillColor = [255, 210, 210];
        data.cell.styles.textColor = [160, 0, 0];
      }
      // GESAMT row
      if (rowIdx === bookings.length) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [220, 235, 250];
      }
    }
  });

  if (returnBlob) return doc.output('blob');
  const filename = `${year}_${tourType}_${hotel.name.replace(/\s+/g, '_')}.pdf`;
  doc.save(filename);
}

function HotelsTab({ year, tourType }) {
  const [loading, setLoading] = useState(true);
  const [hotels, setHotels] = useState([]);
  const [openHotels, setOpenHotels] = useState({});
  const [sendingEmail, setSendingEmail] = useState({});
  const [sendingTelegram, setSendingTelegram] = useState({});

  useEffect(() => {
    loadData();
  }, [year, tourType]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await jahresplanungApi.getHotels(year, tourType);
      setHotels(res.data.hotels);
    } catch (err) {
      toast.error("Ma'lumot yuklanmadi: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleHotel = (hotelId) => {
    setOpenHotels(prev => ({ ...prev, [hotelId]: !prev[hotelId] }));
  };

  const handlePDF = (hotelData) => {
    generateHotelPDF(hotelData, year, tourType);
  };

  const handleEmail = async (hotelData) => {
    const { hotel } = hotelData;
    if (!hotel.email) {
      toast.error(`${hotel.name} — email manzil yo'q`);
      return;
    }
    setSendingEmail(prev => ({ ...prev, [hotel.id]: true }));
    try {
      const blob = generateHotelPDF(hotelData, year, tourType, true);
      const filename = `${year}_${tourType}_${hotel.name.replace(/\s+/g, '_')}.pdf`;
      await jahresplanungApi.sendHotelEmail(hotel.id, blob, filename, year, tourType);
      toast.success(`Email yuborildi → ${hotel.email}`);
    } catch (err) {
      toast.error('Email yuborishda xatolik: ' + (err.response?.data?.error || err.message));
    } finally {
      setSendingEmail(prev => ({ ...prev, [hotel.id]: false }));
    }
  };

  const handleTelegram = async (hotelData) => {
    const { hotel } = hotelData;
    if (!hotel.telegramChatId) {
      toast.error(`${hotel.name} — Telegram chat ID yo'q`);
      return;
    }
    setSendingTelegram(prev => ({ ...prev, [hotel.id]: true }));
    try {
      const blob = generateHotelPDF(hotelData, year, tourType, true);
      const filename = `${year}_${tourType}_${hotel.name.replace(/\s+/g, '_')}.pdf`;
      await jahresplanungApi.sendHotelTelegram(hotel.id, blob, filename, year, tourType);
      toast.success(`Telegram ga yuborildi → ${hotel.name}`);
    } catch (err) {
      toast.error('Telegram yuborishda xatolik: ' + (err.response?.data?.error || err.message));
    } finally {
      setSendingTelegram(prev => ({ ...prev, [hotel.id]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (hotels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <Building2 className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-sm">{year} yil uchun {tourType} tur bo'yicha hotel ma'lumoti topilmadi</p>
        <p className="text-xs mt-1">Bookings ichida Accommodations qo'shilganda bu yerda ko'rinadi</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {hotels.map(hotelData => {
        const { hotel, bookings } = hotelData;
        const isOpen = !!openHotels[hotel.id];
        const active = bookings.filter(b => b.status !== 'CANCELLED');
        const totalPax = active.reduce((s, b) => s + (b.pax || 0), 0);
        const totalRooms = active.reduce((s, b) => s + (b.dbl || 0) + (b.twn || 0) + (b.sngl || 0), 0);

        return (
          <div key={hotel.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Hotel header */}
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center gap-3">
              <button
                onClick={() => toggleHotel(hotel.id)}
                className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
              >
                {isOpen
                  ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                }
                <Building2 className="w-5 h-5 text-blue-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800">{hotel.name}</h3>
                  <p className="text-xs text-gray-500">
                    {hotel.city?.name}
                    {hotel.email && <span className="ml-2 text-gray-400">· {hotel.email}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2.5 text-sm text-gray-600 flex-shrink-0 mr-2">
                  <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium">
                    {bookings.length} guruh
                  </span>
                  <span className="text-xs text-gray-500">{totalPax} PAX</span>
                  <span className="text-xs text-gray-500">{totalRooms} xona</span>
                </div>
              </button>

              {/* Action buttons */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => handlePDF(hotelData)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition-colors"
                  title="PDF yuklab olish"
                >
                  <Download className="w-3.5 h-3.5" />
                  PDF
                </button>
                <button
                  onClick={() => handleEmail(hotelData)}
                  disabled={!!sendingEmail[hotel.id]}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                  title={hotel.email || "Email yo'q"}
                >
                  {sendingEmail[hotel.id]
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Mail className="w-3.5 h-3.5" />
                  }
                  Email
                </button>
                <button
                  onClick={() => handleTelegram(hotelData)}
                  disabled={!!sendingTelegram[hotel.id]}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                  title={hotel.telegramChatId ? 'Telegram ga yuborish' : "Telegram chat ID yo'q"}
                >
                  {sendingTelegram[hotel.id]
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Send className="w-3.5 h-3.5" />
                  }
                  TG
                </button>
              </div>
            </div>

            {/* Bookings table */}
            {isOpen && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider">
                      <th className="px-4 py-2.5 text-left font-medium">Gruppe</th>
                      <th className="px-4 py-2.5 text-left font-medium">Anreise</th>
                      <th className="px-4 py-2.5 text-left font-medium">Abreise</th>
                      <th className="px-4 py-2.5 text-center font-medium">Nächte</th>
                      <th className="px-4 py-2.5 text-center font-medium">PAX</th>
                      <th className="px-4 py-2.5 text-center font-medium">DBL</th>
                      <th className="px-4 py-2.5 text-center font-medium">TWN</th>
                      <th className="px-4 py-2.5 text-center font-medium">EZ</th>
                      <th className="px-4 py-2.5 text-center font-medium">Gesamt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map(b => (
                      <tr
                        key={b.bookingId + '_' + b.checkInDate}
                        className={`border-b border-gray-50 transition-colors ${
                          b.status === 'CANCELLED'
                            ? 'bg-red-50'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <td className="px-4 py-2.5">
                          <Link
                            to={`/bookings/${b.bookingId}`}
                            className={`font-medium ${b.status === 'CANCELLED' ? 'text-red-400 line-through' : 'text-primary-600 hover:underline'}`}
                          >
                            {b.bookingNumber}
                          </Link>
                          {b.status === 'CANCELLED' && (
                            <span className="ml-2 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
                              STORNO
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">{formatDate(b.checkInDate)}</td>
                        <td className="px-4 py-2.5 text-gray-600">{formatDate(b.checkOutDate)}</td>
                        <td className="px-4 py-2.5 text-center text-gray-600">{b.nights || '—'}</td>
                        <td className={`px-4 py-2.5 text-center font-medium ${b.status === 'CANCELLED' ? 'text-red-400' : ''}`}>
                          {b.pax || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-center text-gray-600">{b.dbl || '—'}</td>
                        <td className="px-4 py-2.5 text-center text-gray-600">{b.twn || '—'}</td>
                        <td className="px-4 py-2.5 text-center text-gray-600">{b.sngl || '—'}</td>
                        <td className="px-4 py-2.5 text-center font-medium text-gray-700">
                          {((b.dbl || 0) + (b.twn || 0) + (b.sngl || 0)) || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Summary footer */}
                  <tfoot>
                    <tr className="bg-blue-50 font-semibold text-gray-800 text-sm border-t-2 border-blue-100">
                      <td className="px-4 py-2.5 text-gray-600 text-xs" colSpan={4}>
                        Jami ({active.length} guruh, storno hisobga olinmagan)
                      </td>
                      <td className="px-4 py-2.5 text-center text-blue-700">{totalPax || '—'}</td>
                      <td className="px-4 py-2.5 text-center text-blue-700">
                        {active.reduce((s, b) => s + (b.dbl || 0), 0) || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-center text-blue-700">
                        {active.reduce((s, b) => s + (b.twn || 0), 0) || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-center text-blue-700">
                        {active.reduce((s, b) => s + (b.sngl || 0), 0) || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-center text-blue-700">{totalRooms || '—'}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Jahresplanung() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [mainTab, setMainTab] = useState('hotels');
  const [tourTab, setTourTab] = useState('ER');

  const years = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jahresplanung</h1>
          <p className="text-sm text-gray-500 mt-1">Yillik reja — hotellar, restoranlar, transport</p>
        </div>

        {/* Year selector */}
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-400" />
          <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-white">
            {years.map(y => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className={`px-4 py-2 text-sm font-medium transition-colors border-r border-gray-200 last:border-r-0 ${
                  year === y
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1 w-fit">
        {MAIN_TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setMainTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                mainTab === tab.id
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

      {/* Tour type sub-tabs */}
      <div className="flex gap-2 mb-5">
        {TOUR_TYPES.map(t => (
          <button
            key={t}
            onClick={() => setTourTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              tourTab === t
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content area */}
      {mainTab === 'hotels' && (
        <HotelsTab year={year} tourType={tourTab} />
      )}

      {mainTab === 'restoran' && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <UtensilsCrossed className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-sm font-medium">Restoran moduli</p>
          <p className="text-xs mt-1">Tez orada qo'shiladi</p>
        </div>
      )}

      {mainTab === 'transport' && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Bus className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-sm font-medium">Transport moduli</p>
          <p className="text-xs mt-1">Tez orada qo'shiladi</p>
        </div>
      )}
    </div>
  );
}
