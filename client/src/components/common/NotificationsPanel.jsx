import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Hotel, CalendarDays, Truck, RefreshCw, X } from 'lucide-react';
import { dashboardApi } from '../../services/api';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

const TYPE_CONFIG = {
  hotel:     { icon: Hotel,       color: 'text-blue-500',   bg: 'bg-blue-50'   },
  departure: { icon: CalendarDays, color: 'text-amber-500', bg: 'bg-amber-50'  },
  transport: { icon: Truck,       color: 'text-green-500',  bg: 'bg-green-50'  },
};

export default function NotificationsPanel() {
  const navigate = useNavigate();
  const panelRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await dashboardApi.getNotifications();
      setItems(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  // Load on open
  useEffect(() => {
    if (open) load();
  }, [open]);

  // Initial count (badge only, no full load)
  useEffect(() => {
    dashboardApi.getNotifications()
      .then(res => setTotal(res.data.total || 0))
      .catch(() => {});
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleClick = (item) => {
    setOpen(false);
    navigate(item.url);
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

            {items.map((item, i) => {
              const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.hotel;
              const Icon = cfg.icon;
              return (
                <button
                  key={i}
                  onClick={() => handleClick(item)}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 last:border-0"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.bg}`}>
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 leading-snug">{item.message}</p>
                    {item.time && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatDistanceToNow(new Date(item.time), { addSuffix: true, locale: ru })}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
