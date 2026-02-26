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

function fmt(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.${dt.getFullYear()}`;
}
function addDays(iso, n) {
  const [y,m,d] = iso.slice(0,10).split('-').map(Number);
  const dt = new Date(y, m-1, d+n);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}

export default function TransportPlanTab({ tourType }) {
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [routeMap, setRouteMap] = useState({});
  const [open, setOpen] = useState({ sevil: true, xayrulla: true, nosir: true });

  useEffect(() => {
    setLoading(true);
    jahresplanungApi.getTransport(YEAR, tourType)
      .then(res => { setBookings(res.data.bookings || []); setRouteMap(res.data.routeMap || {}); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tourType]);

  if (loading) return <div className="flex justify-center py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin mr-2"/><span className="text-sm">Yuklanmoqda...</span></div>;

  const order = (PROVIDER_ORDER[tourType] || ['sevil','xayrulla']).map(id => PROVIDERS.find(p => p.id === id)).filter(Boolean);

  return (
    <div className="space-y-3">
      {order.map(prov => {
        const ids = Object.keys(routeMap[prov.id] || {});
        const items = bookings.filter(b => ids.includes(String(b.id)));
        const isOpen = !!open[prov.id];

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
              <div className="bg-white">
                {/* Column headers */}
                <div className="grid grid-cols-[120px_80px_160px_160px_1fr] px-8 py-2.5 bg-gray-50 border-b border-gray-200 text-xs text-gray-400 font-medium">
                  <span>Guruh</span><span>PAX</span><span>Von</span><span>Bis</span><span className="text-right">Status</span>
                </div>
                {items.length === 0 ? (
                  <div className="px-8 py-6 text-center text-xs text-gray-400">Bu provayder uchun route&apos;lar topilmadi</div>
                ) : items.map(b => {
                  const bk = String(b.id);
                  const segs = routeMap[prov.id]?.[bk]?.segments || [];
                  const vonRaw = segs[0]?.von || null;
                  const bisRaw = segs[segs.length - 1]?.bis || null;
                  const extra = BIS_EXTRA[tourType]?.[prov.id] ?? 0;
                  const bis = (extra && bisRaw) ? addDays(bisRaw, extra) : bisRaw;
                  const isCancelled = b.status === 'CANCELLED';
                  return (
                    <div key={bk} className={`grid grid-cols-[120px_80px_160px_160px_1fr] items-center px-8 py-3 border-b border-gray-100 last:border-0 ${isCancelled ? 'bg-red-50' : ''}`}>
                      <Link to={`/bookings/${b.id}`} className={`font-semibold text-base hover:underline ${isCancelled ? 'text-red-400 line-through' : 'text-primary-600'}`}>
                        {b.bookingNumber}
                      </Link>
                      <span className="text-base font-medium text-gray-700">16</span>
                      <span className="text-sm text-gray-600">{fmt(vonRaw)}</span>
                      <span className="text-sm text-gray-600">{fmt(bis)}</span>
                      <div className="flex justify-end">
                        {isCancelled
                          ? <span className="inline-flex items-center px-2.5 py-1 bg-red-100 text-red-600 text-sm font-bold rounded-lg">✕ Bekor</span>
                          : <span className="inline-flex items-center px-2.5 py-1 bg-green-100 text-green-700 text-sm font-bold rounded-lg">✓ OK</span>
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
