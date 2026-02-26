import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bus, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { jahresplanungApi } from '../../services/api';

const YEAR = 2026;
const PROVIDERS = [
  { id: 'sevil',    label: 'Sevil',    bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700'   },
  { id: 'xayrulla', label: 'Xayrulla', bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700'  },
  { id: 'nosir',    label: 'Nosir',    bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
];
const PROVIDER_ORDER = {
  ER: ['xayrulla','sevil'], CO: ['xayrulla','nosir','sevil'],
  KAS: ['nosir','sevil','xayrulla'], ZA: ['sevil','xayrulla'],
};
const BIS_EXTRA = { CO: { sevil: 2 }, ER: { sevil: 3 }, KAS: { sevil: 0 }, ZA: { sevil: 0 } };

function fmtDate(d) {
  if (!d) return null;
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.${dt.getFullYear()}`;
}
function fmtDateTime(d) {
  if (!d) return null;
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.${dt.getFullYear()} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
}
function addDays(iso, n) {
  const [y,m,d] = iso.slice(0,10).split('-').map(Number);
  const dt = new Date(y, m-1, d+n);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}

function ConfCell({ label, value, small }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-xs text-gray-400 font-medium leading-none">{label}</span>
      <span className={`${small ? 'text-xs' : 'text-sm'} text-gray-700 truncate leading-tight`} title={value || ''}>
        {value || <span className="text-gray-300">—</span>}
      </span>
    </div>
  );
}

export default function TransportPlanTab({ tourType }) {
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [routeMap, setRouteMap] = useState({});
  const [confirmations, setConfirmations] = useState([]);
  const [open, setOpen] = useState({ sevil: true, xayrulla: true, nosir: true });

  useEffect(() => {
    setLoading(true);
    Promise.all([
      jahresplanungApi.getTransport(YEAR, tourType),
      jahresplanungApi.getTransportConfirmations(),
    ])
      .then(([transportRes, confRes]) => {
        setBookings(transportRes.data.bookings || []);
        setRouteMap(transportRes.data.routeMap || {});
        setConfirmations(confRes.data.confirmations || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tourType]);

  if (loading) return (
    <div className="flex justify-center py-20 text-gray-400">
      <Loader2 className="w-6 h-6 animate-spin mr-2"/><span className="text-sm">Yuklanmoqda...</span>
    </div>
  );

  const order = (PROVIDER_ORDER[tourType] || ['sevil','xayrulla']).map(id => PROVIDERS.find(p => p.id === id)).filter(Boolean);

  return (
    <div className="space-y-3">
      {order.map(prov => {
        const ids = Object.keys(routeMap[prov.id] || {});
        const items = bookings.filter(b => ids.includes(String(b.id)));
        const isOpen = !!open[prov.id];

        // Confirmation record for this provider+tourType
        const conf = confirmations.find(c => c.tourType === tourType && c.provider === prov.id);

        return (
          <div key={prov.id} className={`rounded-xl border overflow-hidden ${prov.border}`}>
            {/* Header */}
            <button onClick={() => setOpen(p => ({ ...p, [prov.id]: !p[prov.id] }))}
              className={`w-full flex items-center gap-3 px-5 py-3 ${prov.bg} hover:brightness-95 transition-all`}>
              {isOpen ? <ChevronDown className="w-4 h-4 flex-shrink-0"/> : <ChevronRight className="w-4 h-4 flex-shrink-0"/>}
              <Bus className={`w-4 h-4 flex-shrink-0 ${prov.text}`}/>
              <span className={`font-semibold ${prov.text}`}>{prov.label}</span>
              <span className="ml-auto text-xs bg-white/70 px-2 py-0.5 rounded-full text-gray-600">{items.length} ta guruh</span>
            </button>

            {/* Table */}
            {isOpen && (
              <div className="bg-white overflow-x-auto">
                {/* Column headers */}
                <div className="flex items-end px-6 py-2.5 bg-gray-50 border-b border-gray-200 text-xs text-gray-400 font-medium">
                  <span className="w-24 flex-shrink-0">Guruh</span>
                  <span className="w-14 flex-shrink-0">PAX</span>
                  <span className="w-32 flex-shrink-0">Von</span>
                  <span className="w-32 flex-shrink-0">Bis</span>
                  <span className="flex-1" />
                  <span className="w-36 flex-shrink-0">Yuborildi</span>
                  <span className="w-32 flex-shrink-0">Tekshirdi</span>
                  <span className="w-32 flex-shrink-0">Tasdiqladi</span>
                  <span className="w-36 flex-shrink-0">Tasdiqlangan sana</span>
                  <span className="w-16 text-right flex-shrink-0">Status</span>
                </div>

                {items.length === 0 ? (
                  <div className="px-6 py-6 text-center text-xs text-gray-400">Bu provayder uchun route&apos;lar topilmadi</div>
                ) : items.map(b => {
                  const bk = String(b.id);
                  const segs = routeMap[prov.id]?.[bk]?.segments || [];
                  const vonRaw = segs[0]?.von || null;
                  const bisRaw = segs[segs.length - 1]?.bis || null;
                  const extra = BIS_EXTRA[tourType]?.[prov.id] ?? 0;
                  const bis = (extra && bisRaw) ? addDays(bisRaw, extra) : bisRaw;
                  const isCancelled = b.status === 'CANCELLED';

                  return (
                    <div key={bk} className={`flex items-center px-6 py-3 border-b border-gray-100 last:border-0 ${isCancelled ? 'bg-red-50' : ''}`}>
                      <div className="w-24 flex-shrink-0">
                        <Link to={`/bookings/${b.id}`} className={`font-semibold text-sm hover:underline ${isCancelled ? 'text-red-400 line-through' : 'text-primary-600'}`}>
                          {b.bookingNumber}
                        </Link>
                      </div>
                      <span className="w-14 flex-shrink-0 text-sm font-medium text-gray-700">16</span>
                      <span className="w-32 flex-shrink-0 text-sm text-gray-600">{fmtDate(vonRaw) || '—'}</span>
                      <span className="w-32 flex-shrink-0 text-sm text-gray-600">{fmtDate(bis) || '—'}</span>

                      {/* Spacer pushes confirmation columns to the right */}
                      <span className="flex-1" />

                      {/* Confirmation columns — same for all rows in this provider */}
                      <span className="w-36 flex-shrink-0 text-xs text-gray-500">{fmtDateTime(conf?.sentAt) || <span className="text-gray-300">—</span>}</span>
                      <span className="w-32 flex-shrink-0 text-xs text-blue-600 truncate pr-2" title={conf?.approvedBy || ''}>{conf?.approvedBy || <span className="text-gray-300">—</span>}</span>
                      <span className="w-32 flex-shrink-0 text-xs text-green-700 truncate pr-2" title={conf?.confirmedBy || ''}>{conf?.confirmedBy || <span className="text-gray-300">—</span>}</span>
                      <span className="w-36 flex-shrink-0 text-xs text-gray-500">{fmtDateTime(conf?.respondedAt) || <span className="text-gray-300">—</span>}</span>

                      <div className="w-16 flex-shrink-0 flex justify-end">
                        {isCancelled
                          ? <span className="inline-flex items-center px-2.5 py-1 bg-red-100 text-red-600 text-xs font-bold rounded-lg">✕ Bekor</span>
                          : <span className="inline-flex items-center px-2.5 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-lg">✓ OK</span>
                        }
                      </div>
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
