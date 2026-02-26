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
// Only CO/Xayrulla shows Vokzal (single-day train station column)
const VOKZAL_MAP = { CO: new Set(['xayrulla']) };
// Max multi-day segments to show per tourType+provider
const MAX_MULTI_MAP = { ER: { sevil: 1 }, CO: { nosir: 1, sevil: 1 } };
// Extra days added to last bis per tourType+provider
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

// Returns visible segments for a provider+booking (respects Vokzal filter + max multi cap)
function getVisibleSegs(tourType, provider, segs) {
  const showVokzal = VOKZAL_MAP[tourType]?.has(provider);
  const maxMulti = MAX_MULTI_MAP[tourType]?.[provider];
  let mCnt = 0;
  return segs.filter(seg => {
    const isSingle = seg.von === seg.bis;
    if (isSingle && !showVokzal) return false;
    if (!isSingle) { mCnt++; if (maxMulti !== undefined && mCnt > maxMulti) return false; }
    return true;
  });
}

// Build column definitions from visible segs of the "template" booking (most segs)
function buildColDefs(tourType, provider, routeMap, bookings) {
  let best = [];
  for (const b of bookings) {
    const segs = routeMap[provider]?.[String(b.id)]?.segments || [];
    const vis = getVisibleSegs(tourType, provider, segs);
    if (vis.length > best.length) best = vis;
  }
  const defs = [];
  let multiIdx = 0;
  for (const seg of best) {
    const isSingle = seg.von === seg.bis;
    if (isSingle) {
      defs.push({ type: 'single', label: 'Vokzal' });
    } else {
      multiIdx++;
      defs.push({ type: 'multi', label: best.filter(s => s.von !== s.bis).length > 1 ? `${multiIdx} Zayezd` : '' });
    }
  }
  return defs;
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
        const conf = confirmations.find(c => c.tourType === tourType && c.provider === prov.id);
        const colDefs = buildColDefs(tourType, prov.id, routeMap, items);
        const hasMultiLabel = colDefs.some(c => c.type === 'multi' && c.label);

        return (
          <div key={prov.id} className={`rounded-xl border overflow-hidden ${prov.border}`}>
            {/* Accordion header */}
            <button onClick={() => setOpen(p => ({ ...p, [prov.id]: !p[prov.id] }))}
              className={`w-full flex items-center gap-3 px-5 py-3 ${prov.bg} hover:brightness-95 transition-all`}>
              {isOpen ? <ChevronDown className="w-4 h-4 flex-shrink-0"/> : <ChevronRight className="w-4 h-4 flex-shrink-0"/>}
              <Bus className={`w-4 h-4 flex-shrink-0 ${prov.text}`}/>
              <span className={`font-semibold ${prov.text}`}>{prov.label}</span>
              <span className="ml-auto text-xs bg-white/70 px-2 py-0.5 rounded-full text-gray-600">{items.length} ta guruh</span>
            </button>

            {isOpen && (
              <div className="bg-white overflow-x-auto">

                {/* Column header row — two levels if multi-label exists */}
                <div className="px-6 bg-gray-50 border-b border-gray-200">
                  {/* Top label row (e.g. "1 Zayezd", "2 Zayezd") */}
                  {hasMultiLabel && (
                    <div className="flex items-end pt-2 text-xs text-gray-500 font-semibold">
                      <span className="w-24 flex-shrink-0" />
                      <span className="w-14 flex-shrink-0" />
                      {colDefs.map((col, i) => (
                        col.type === 'multi' ? (
                          <span key={i} className="w-64 flex-shrink-0 text-center">{col.label}</span>
                        ) : (
                          <span key={i} className="w-28 flex-shrink-0" />
                        )
                      ))}
                    </div>
                  )}
                  {/* Bottom label row (Guruh / PAX / Von / Bis / Vokzal / ... / conf cols / Status) */}
                  <div className="flex items-end py-2 text-xs text-gray-400 font-medium">
                    <span className="w-24 flex-shrink-0">Guruh</span>
                    <span className="w-14 flex-shrink-0">PAX</span>
                    {colDefs.map((col, i) => (
                      col.type === 'single' ? (
                        <span key={i} className="w-28 flex-shrink-0">Vokzal</span>
                      ) : (
                        <span key={i} className="flex-shrink-0 flex gap-0">
                          <span className="w-32">Von</span>
                          <span className="w-32">Bis</span>
                        </span>
                      )
                    ))}
                    <span className="flex-1" />
                    <span className="w-36 flex-shrink-0">Yuborildi</span>
                    <span className="w-32 flex-shrink-0">Tekshirdi</span>
                    <span className="w-32 flex-shrink-0">Tasdiqladi</span>
                    <span className="w-36 flex-shrink-0">Tasdiqlangan sana</span>
                    <span className="w-16 flex-shrink-0 text-right">Status</span>
                  </div>
                </div>

                {items.length === 0 ? (
                  <div className="px-6 py-6 text-center text-xs text-gray-400">Bu provayder uchun route&apos;lar topilmadi</div>
                ) : items.map(b => {
                  const bk = String(b.id);
                  const allSegs = routeMap[prov.id]?.[bk]?.segments || [];
                  const visSegs = getVisibleSegs(tourType, prov.id, allSegs);
                  const isCancelled = b.status === 'CANCELLED';
                  const extra = BIS_EXTRA[tourType]?.[prov.id] ?? 0;

                  return (
                    <div key={bk} className={`flex items-center px-6 py-3 border-b border-gray-100 last:border-0 ${isCancelled ? 'bg-red-50' : ''}`}>
                      <div className="w-24 flex-shrink-0">
                        <Link to={`/bookings/${b.id}`} className={`font-semibold text-sm hover:underline ${isCancelled ? 'text-red-400 line-through' : 'text-primary-600'}`}>
                          {b.bookingNumber}
                        </Link>
                      </div>
                      <span className="w-14 flex-shrink-0 text-sm font-medium text-gray-700">16</span>

                      {/* Segment date columns */}
                      {colDefs.map((col, i) => {
                        const seg = visSegs[i];
                        if (col.type === 'single') {
                          return <span key={i} className="w-28 flex-shrink-0 text-sm text-gray-600">{fmtDate(seg?.von) || '—'}</span>;
                        }
                        // multi: Von + Bis
                        const isLast = colDefs.filter(c => c.type === 'multi').at(-1) === col;
                        const bisRaw = seg?.bis || null;
                        const bis = (extra && isLast && bisRaw) ? addDays(bisRaw, extra) : bisRaw;
                        return (
                          <span key={i} className="flex-shrink-0 flex">
                            <span className="w-32 text-sm text-gray-600">{fmtDate(seg?.von) || '—'}</span>
                            <span className="w-32 text-sm text-gray-600">{fmtDate(bis) || '—'}</span>
                          </span>
                        );
                      })}

                      <span className="flex-1" />

                      {/* Confirmation columns */}
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
