import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bus, ChevronDown, ChevronRight, Loader2, Trash2 } from 'lucide-react';
import { jahresplanungApi } from '../../services/api';
import { useYear } from '../../context/YearContext';
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
  const { selectedYear: YEAR } = useYear();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [routeMap, setRouteMap] = useState({});
  const [confirmations, setConfirmations] = useState([]);
  const [open, setOpen] = useState({ sevil: true, xayrulla: true, nosir: true });
  const [deletingGroupId, setDeletingGroupId] = useState(null);
  const [deletingAll, setDeletingAll] = useState(false);

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
  }, [tourType, YEAR]);

  const handleDeleteGroup = async (e, provId, conf) => {
    e.stopPropagation();
    if (!conf) return;
    if (!window.confirm(`Bu provayder yozuvini o'chirmoqchimisiz?`)) return;
    setDeletingGroupId(provId);
    try {
      const keySuffix = `${conf.year}_${conf.tourType}_${conf.provider}`;
      await jahresplanungApi.deleteTransportConfirmation(keySuffix);
      setConfirmations(prev => prev.filter(c => c.key !== conf.key));
    } catch { alert('O\'chirishda xatolik'); }
    finally { setDeletingGroupId(null); }
  };

  const handleDeleteAll = async () => {
    const toDelete = confirmations.filter(c => c.tourType === tourType && parseInt(c.year) === YEAR);
    if (toDelete.length === 0) return;
    if (!window.confirm(`Bu sub-tabdagi barcha (${toDelete.length} ta) yozuvni o'chirmoqchimisiz?`)) return;
    setDeletingAll(true);
    try {
      await Promise.all(toDelete.map(c => jahresplanungApi.deleteTransportConfirmation(`${c.year}_${c.tourType}_${c.provider}`)));
      const keys = new Set(toDelete.map(c => c.key));
      setConfirmations(prev => prev.filter(c => !keys.has(c.key)));
    } catch { alert('O\'chirishda xatolik'); }
    finally { setDeletingAll(false); }
  };

  if (loading) return (
    <div className="flex justify-center py-20 text-gray-400">
      <Loader2 className="w-6 h-6 animate-spin mr-2"/><span className="text-sm">Yuklanmoqda...</span>
    </div>
  );

  const order = (PROVIDER_ORDER[tourType] || ['sevil','xayrulla']).map(id => PROVIDERS.find(p => p.id === id)).filter(Boolean);

  const allConfsCount = confirmations.filter(c => c.tourType === tourType && parseInt(c.year) === YEAR).length;

  if (allConfsCount === 0) return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
      <Bus className="w-12 h-12 mb-3 opacity-30" />
      <p className="text-sm">Bu tur uchun hali transport Telegram yuborilmagan</p>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={handleDeleteAll}
          disabled={deletingAll}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-500 border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          {deletingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          Barchasini o'chirish
        </button>
      </div>
      {order.map(prov => {
        const ids = Object.keys(routeMap[prov.id] || {});
        const conf = confirmations.find(c => c.tourType === tourType && c.provider === prov.id && parseInt(c.year) === YEAR);
        const items = conf ? bookings.filter(b => ids.includes(String(b.id))) : [];
        if (items.length === 0) return null;
        const isOpen = !!open[prov.id];
        const colDefs = buildColDefs(tourType, prov.id, routeMap, items);
        const hasMultiLabel = colDefs.some(c => c.type === 'multi' && c.label);

        return (
          <div key={prov.id} className={`rounded-xl border overflow-hidden ${prov.border}`}>
            {/* Accordion header */}
            <div className={`flex items-center ${prov.bg}`}>
              <button onClick={() => setOpen(p => ({ ...p, [prov.id]: !p[prov.id] }))}
                className={`flex-1 flex items-center gap-3 px-5 py-3 hover:brightness-95 transition-all`}>
                {isOpen ? <ChevronDown className="w-4 h-4 flex-shrink-0"/> : <ChevronRight className="w-4 h-4 flex-shrink-0"/>}
                <Bus className={`w-4 h-4 flex-shrink-0 ${prov.text}`}/>
                <span className={`font-semibold ${prov.text}`}>{prov.label}</span>
                <span className="ml-auto text-xs bg-white/70 px-2 py-0.5 rounded-full text-gray-600">{items.length} ta guruh</span>
              </button>
              {conf && (
                <button
                  onClick={(e) => handleDeleteGroup(e, prov.id, conf)}
                  disabled={deletingGroupId === prov.id}
                  className="mr-3 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                  title="O'chirish"
                >
                  {deletingGroupId === prov.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>

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
                      <span className="w-14 flex-shrink-0 text-sm font-medium text-gray-700">{isCancelled ? 0 : (b.pax || '—')}</span>

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

                      <div className="w-20 flex-shrink-0 flex justify-end">
                        {isCancelled
                          ? <span className="inline-flex items-center px-2 py-1 bg-red-100 text-red-600 text-xs font-bold rounded-lg">✕ Bekor</span>
                          : !conf
                          ? <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-400 text-xs rounded-lg">—</span>
                          : conf.status === 'CONFIRMED'
                          ? <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-lg">✓ OK</span>
                          : conf.status === 'REJECTED' || conf.status === 'REJECTED_BY_APPROVER'
                          ? <span className="inline-flex items-center px-2 py-1 bg-red-100 text-red-600 text-xs font-bold rounded-lg">✕ Rad</span>
                          : conf.status === 'APPROVED'
                          ? <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-lg">⏳ Kutar</span>
                          : <span className="inline-flex items-center px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-bold rounded-lg">🕐 Kutm.</span>
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
