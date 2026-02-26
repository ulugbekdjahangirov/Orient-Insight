import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, CalendarDays, User, Users, Loader2 } from 'lucide-react';
import { searchApi } from '../../services/api';

const TYPE_ICONS = {
  booking: CalendarDays,
  tourist: User,
  guide:   Users,
};

const TYPE_LABELS = {
  booking: 'Booking',
  tourist: 'Tourist',
  guide:   'Gid',
};

export default function GlobalSearch({ open, onClose }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const timerRef = useRef(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced search
  const doSearch = useCallback((q) => {
    clearTimeout(timerRef.current);
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await searchApi.search(q);
        setResults(res.data.results || []);
        setActiveIdx(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    doSearch(val);
  };

  const handleSelect = (item) => {
    onClose();
    navigate(item.url);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[activeIdx]) {
      handleSelect(results[activeIdx]);
    }
  };

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector('[data-active="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  if (!open) return null;

  const grouped = results.reduce((acc, item) => {
    if (!acc[item.type]) acc[item.type] = [];
    acc[item.type].push(item);
    return acc;
  }, {});

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
          {loading
            ? <Loader2 className="w-5 h-5 text-gray-400 animate-spin flex-shrink-0" />
            : <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
          }
          <input
            ref={inputRef}
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Booking, tourist yoki gid qidiring..."
            className="flex-1 text-base text-gray-900 placeholder-gray-400 outline-none bg-transparent"
          />
          {query && (
            <button onClick={() => { setQuery(''); setResults([]); inputRef.current?.focus(); }}>
              <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div ref={listRef} className="max-h-96 overflow-y-auto py-2">
            {['booking', 'tourist', 'guide'].map(type => {
              const items = grouped[type];
              if (!items?.length) return null;
              const Icon = TYPE_ICONS[type];
              return (
                <div key={type}>
                  <div className="px-4 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    {TYPE_LABELS[type]}
                  </div>
                  {items.map((item) => {
                    const globalIdx = results.indexOf(item);
                    const isActive = globalIdx === activeIdx;
                    return (
                      <button
                        key={`${item.type}-${item.id}`}
                        data-active={isActive}
                        onClick={() => handleSelect(item)}
                        onMouseEnter={() => setActiveIdx(globalIdx)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          isActive ? 'bg-blue-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: item.color ? item.color + '22' : '#F3F4F6' }}
                        >
                          <Icon
                            className="w-4 h-4"
                            style={{ color: item.color || '#6B7280' }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{item.label}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {item.sub}
                            {item.passport ? ` · ${item.passport}` : ''}
                          </p>
                        </div>
                        {isActive && (
                          <span className="text-xs text-gray-400 flex-shrink-0">Enter</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!loading && query.length >= 2 && results.length === 0 && (
          <div className="py-10 text-center text-gray-400">
            <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">"{query}" bo'yicha hech narsa topilmadi</p>
          </div>
        )}

        {/* Hint */}
        {query.length < 2 && (
          <div className="px-4 py-3 text-xs text-gray-400 border-t border-gray-100 flex items-center gap-4">
            <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 font-mono">↑↓</kbd> navigatsiya</span>
            <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 font-mono">Enter</kbd> ochish</span>
            <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 font-mono">Esc</kbd> yopish</span>
          </div>
        )}
      </div>
    </div>
  );
}
