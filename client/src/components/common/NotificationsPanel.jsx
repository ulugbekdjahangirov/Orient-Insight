import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Hotel, CalendarDays, Truck, RefreshCw, X, CheckCheck, PlaneLanding } from 'lucide-react';
import { dashboardApi } from '../../services/api';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

const TYPE_CONFIG = {
  hotel:     { icon: Hotel,         color: 'text-blue-500',   bg: 'bg-blue-50'   },
  departure: { icon: CalendarDays,  color: 'text-amber-500',  bg: 'bg-amber-50'  },
  transport: { icon: Truck,         color: 'text-green-500',  bg: 'bg-green-50'  },
  arrival:   { icon: PlaneLanding,  color: 'text-purple-500', bg: 'bg-purple-50' },
};

const DISMISSED_KEY = 'dismissed_notifications';

const getDismissed = () => {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]')); }
  catch { return new Set(); }
};

const saveDismissed = (set) => {
  // Keep max 200 to avoid localStorage bloat
  const arr = [...set].slice(-200);
  localStorage.setItem(DISMISSED_KEY, JSON.stringify(arr));
};

export default function NotificationsPanel() {
  const navigate = useNavigate();
  const panelRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(getDismissed);

  const unreadItems = items.filter(it => !dismissed.has(it.id));
  const readItems   = items.filter(it =>  dismissed.has(it.id));

  const calcTotal = (allItems, dis) =>
    allItems.filter(it => it.id && !dis.has(it.id)).length;

  const load = async () => {
    setLoading(true);
    try {
      const res = await dashboardApi.getNotifications();
      const allItems = res.data.items || [];
      setItems(allItems);
      const d = getDismissed();
      setTotal(calcTotal(allItems, d));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  // Load on open
  useEffect(() => { if (open) load(); }, [open]);

  // Initial badge count
  useEffect(() => {
    dashboardApi.getNotifications()
      .then(res => {
        const allItems = res.data.items || [];
        setTotal(calcTotal(allItems, getDismissed()));
      })
      .catch(() => {});
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const dismiss = (e, id) => {
    e.stopPropagation();
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    saveDismissed(next);
    setTotal(prev => Math.max(0, prev - 1));
  };

  const dismissAll = () => {
    const next = new Set(dismissed);
    unreadItems.forEach(it => it.id && next.add(it.id));
    setDismissed(next);
    saveDismissed(next);
    setTotal(0);
  };

  const handleClick = (item) => {
    if (item.id && !dismissed.has(item.id)) {
      const next = new Set(dismissed);
      next.add(item.id);
      setDismissed(next);
      saveDismissed(next);
      setTotal(prev => Math.max(0, prev - 1));
    }
    setOpen(false);
    navigate(item.url);
  };

  const renderItem = (item, isRead) => {
    const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.hotel;
    const Icon = cfg.icon;
    return (
      <div
        key={item.id || item.message}
        className={`relative flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-0 group ${isRead ? '' : 'hover:bg-gray-50'} transition-colors`}
      >
        {/* Unread dot */}
        {!isRead && (
          <span className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
        )}

        <button onClick={() => handleClick(item)} className="flex items-start gap-3 flex-1 text-left min-w-0">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.bg} ${isRead ? 'opacity-50' : ''}`}>
            <Icon className={`w-4 h-4 ${cfg.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm leading-snug ${isRead ? 'text-gray-400' : 'text-gray-800'}`}>
              {item.message}
            </p>
            {item.subtitle && (
              <p className={`text-xs mt-0.5 ${isRead ? 'text-gray-400' : 'text-gray-500'}`}>
                {item.subtitle}
              </p>
            )}
            {item.time && (
              <p className="text-xs text-gray-400 mt-0.5">
                {formatDistanceToNow(new Date(item.time), { addSuffix: true, locale: ru })}
              </p>
            )}
          </div>
        </button>

        {/* Dismiss X button */}
        {!isRead && item.id && (
          <button
            onClick={(e) => dismiss(e, item.id)}
            className="p-1 rounded hover:bg-gray-200 transition-colors flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100"
            title="Yopish"
          >
            <X className="w-3 h-3 text-gray-400" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div ref={panelRef} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="p-3 md:p-2 rounded-lg hover:bg-gray-100 transition-colors relative"
      >
        <Bell className="w-6 h-6 md:w-5 md:h-5 text-gray-600" />
        {total > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold px-0.5">
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed inset-x-2 top-14 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-40 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-semibold text-gray-900 text-sm">
              Bildirishnomalar
              {total > 0 && (
                <span className="ml-2 px-1.5 py-0.5 bg-red-100 text-red-600 text-xs rounded-full font-bold">
                  {total}
                </span>
              )}
            </span>
            <div className="flex items-center gap-1">
              {unreadItems.length > 0 && (
                <button
                  onClick={dismissAll}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                  title="Hammasini o'qilgan deb belgilash"
                >
                  <CheckCheck className="w-3.5 h-3.5 text-gray-400" />
                </button>
              )}
              <button
                onClick={load}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                title="Yangilash"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Items */}
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && !loading && (
              <div className="py-10 text-center text-gray-400">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Bildirishnoma yo'q</p>
              </div>
            )}

            {/* Unread */}
            {unreadItems.map(item => renderItem(item, false))}

            {/* Divider between read/unread */}
            {readItems.length > 0 && unreadItems.length > 0 && (
              <div className="px-4 py-1.5 bg-gray-50 text-xs text-gray-400 border-t border-gray-100">
                O'qilganlar
              </div>
            )}

            {/* Read (dimmed) */}
            {readItems.map(item => renderItem(item, true))}
          </div>
        </div>
      )}
    </div>
  );
}
