import { useState, useEffect, useCallback } from 'react';
import { telegramApi } from '../services/api';
import { RefreshCw, Trash2, Copy, Check, Users, MessageCircle, Building, Phone, Pencil, X, Send, Bus, UtensilsCrossed, Compass } from 'lucide-react';
import toast from 'react-hot-toast';


const ROLES = [
  { value: '',             label: '— Belgilanmagan' },
  { value: 'admin',        label: 'Admin' },
  { value: 'user',         label: 'Foydalanuvchi' },
  { value: 'guide',        label: 'Gid' },
  { value: 'transport',    label: 'Transport' },
  { value: 'hotel',        label: 'Hotel' },
  { value: 'restaurant',   label: 'Restaurant' },
];

const roleColors = {
  admin:      'bg-red-100 text-red-700 border border-red-200',
  user:       'bg-gray-100 text-gray-700 border border-gray-200',
  guide:      'bg-blue-100 text-blue-700 border border-blue-200',
  transport:  'bg-yellow-100 text-yellow-700 border border-yellow-200',
  hotel:      'bg-purple-100 text-purple-700 border border-purple-200',
  restaurant: 'bg-green-100 text-green-700 border border-green-200',
};

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button onClick={handleCopy} className="ml-1 p-0.5 rounded hover:bg-gray-200 transition-colors" title="Nusxa olish">
      {copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} className="text-gray-400" />}
    </button>
  );
}

function NameCell({ chatId, value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value || '');

  const save = async () => {
    if (val.trim()) await onSave(chatId, { name: val.trim() });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
          className="w-44 px-2 py-1 text-sm border border-blue-400 rounded-lg focus:outline-none font-medium"
        />
        <button onClick={save} className="p-1 rounded text-green-600 hover:bg-green-50"><Check size={12} /></button>
        <button onClick={() => setEditing(false)} className="p-1 rounded text-gray-400 hover:bg-gray-100"><X size={12} /></button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 group">
      <span className="font-medium text-gray-900">{value || '—'}</span>
      <button onClick={() => setEditing(true)} className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-200 transition-all">
        <Pencil size={11} className="text-gray-400" />
      </button>
    </div>
  );
}

function PhoneCell({ chatId, value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value || '');

  const save = async () => {
    await onSave(chatId, { phone: val });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
          className="w-32 px-2 py-1 text-xs border border-blue-400 rounded-lg focus:outline-none"
          placeholder="+998..."
        />
        <button onClick={save} className="p-1 rounded text-green-600 hover:bg-green-50"><Check size={12} /></button>
        <button onClick={() => setEditing(false)} className="p-1 rounded text-gray-400 hover:bg-gray-100"><X size={12} /></button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 group">
      <span className="text-gray-600 text-sm">{value || <span className="text-gray-300">—</span>}</span>
      <button onClick={() => setEditing(true)} className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-200 transition-all">
        <Pencil size={11} className="text-gray-400" />
      </button>
    </div>
  );
}

function RoleCell({ chatId, value, onSave }) {
  const [saving, setSaving] = useState(false);

  const handleChange = async (e) => {
    setSaving(true);
    await onSave(chatId, { role: e.target.value });
    setSaving(false);
  };

  const roleLabel = ROLES.find(r => r.value === (value || ''))?.label || '—';
  const colorClass = roleColors[value] || 'bg-gray-50 text-gray-500 border border-gray-200';

  return (
    <div className="relative">
      <select
        value={value || ''}
        onChange={handleChange}
        disabled={saving}
        className={`text-xs font-medium px-2 py-1 rounded-lg cursor-pointer appearance-none pr-5 ${colorClass} disabled:opacity-60 focus:outline-none`}
        style={{ backgroundImage: 'none' }}
      >
        {ROLES.map(r => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>
    </div>
  );
}

const TRANSPORT_PROVIDERS = [
  { value: 'sevil',    label: 'Sevil' },
  { value: 'xayrulla', label: 'Xayrulla' },
  { value: 'nosir',    label: 'Nosir' },
  { value: 'hammasi',  label: 'Siroj (Hammasi)' },
];

function TransportCell({ chatId, transportSettings, onLink }) {
  const [saving, setSaving] = useState(false);
  const linked = Object.entries(transportSettings).find(([, v]) => v === chatId)?.[0] || '';

  const handleChange = async (e) => {
    setSaving(true);
    await onLink(chatId, e.target.value || null);
    setSaving(false);
  };

  return (
    <select
      value={linked}
      onChange={handleChange}
      disabled={saving}
      className="text-sm px-2 py-1 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400 disabled:opacity-60 max-w-[200px]"
    >
      <option value="">— Tanlanmagan</option>
      {TRANSPORT_PROVIDERS.map(p => (
        <option key={p.value} value={p.value}>{p.label}</option>
      ))}
    </select>
  );
}

function RestaurantCell({ chatId, restaurants, onLink }) {
  const [saving, setSaving] = useState(false);
  const linked = restaurants.find(r => r.chatId === chatId)?.name || '';

  const handleChange = async (e) => {
    setSaving(true);
    await onLink(chatId, e.target.value || null);
    setSaving(false);
  };

  return (
    <select
      value={linked}
      onChange={handleChange}
      disabled={saving}
      className="text-sm px-2 py-1 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-60 max-w-[200px]"
    >
      <option value="">— Tanlanmagan</option>
      {restaurants.map(r => (
        <option key={r.name} value={r.name}>{r.name}</option>
      ))}
    </select>
  );
}

function GuideCell({ chatId, guides, onLink }) {
  const [saving, setSaving] = useState(false);
  const linked = guides.find(g => g.telegramChatId === chatId);

  const handleChange = async (e) => {
    setSaving(true);
    await onLink(chatId, e.target.value || null);
    setSaving(false);
  };

  return (
    <select
      value={linked?.id || ''}
      onChange={handleChange}
      disabled={saving}
      className="text-sm px-2 py-1 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60 max-w-[200px]"
    >
      <option value="">— Tanlanmagan</option>
      {guides.map(g => (
        <option key={g.id} value={g.id}>{g.name}</option>
      ))}
    </select>
  );
}

function HotelCell({ chatId, hotels, onLink }) {
  const [saving, setSaving] = useState(false);
  const linked = hotels.find(h => h.telegramChatId === chatId);

  const handleChange = async (e) => {
    setSaving(true);
    await onLink(chatId, e.target.value || null);
    setSaving(false);
  };

  return (
    <select
      value={linked?.id || ''}
      onChange={handleChange}
      disabled={saving}
      className="text-sm px-2 py-1 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:opacity-60 max-w-[200px]"
    >
      <option value="">— Tanlanmagan</option>
      {hotels.map(h => (
        <option key={h.id} value={h.id}>{h.name}</option>
      ))}
    </select>
  );
}

function SendMessageModal({ chat, onClose }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await telegramApi.sendMessage(chat.chatId, text);
      toast.success('Xabar yuborildi!');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Yuborib bo\'lmadi');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header — violet */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-violet-600 to-purple-600">
          <div className="flex items-center gap-2">
            <MessageCircle size={20} className="text-white" />
            <span className="font-semibold text-white">Telegram xabar yuborish</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/20 text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        {/* Body */}
        <div className="p-5 space-y-3">
          <div className="text-sm text-gray-700">
            Qabul qiluvchi: <span className="font-bold text-gray-900">{chat.name}</span>
          </div>
          {chat.phone && (
            <div className="text-sm text-gray-700">
              Telefon: <span className="font-medium text-red-500">{chat.phone}</span>
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">Xabar matni</label>
            <textarea
              autoFocus
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSend(); }}
              placeholder="Xabaringizni yozing..."
              rows={4}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-white bg-gray-500 hover:bg-gray-600 rounded-xl transition-colors">
              Bekor
            </button>
            <button
              onClick={handleSend}
              disabled={!text.trim() || sending}
              className="flex items-center gap-2 px-5 py-2 bg-blue-500 text-white text-sm font-medium rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={14} />
              {sending ? 'Yuborilmoqda...' : 'Yuborish'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TelegramUsers() {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tabFilter, setTabFilter] = useState('all');
  const [sendingTo, setSendingTo] = useState(null);
  const [hotels, setHotels] = useState([]);
  const [transportSettings, setTransportSettings] = useState({});
  const [restaurants, setRestaurants] = useState([]);
  const [guides, setGuides] = useState([]);
  const [deletingId, setDeletingId] = useState(null);
  const [countdown, setCountdown] = useState(5);

  const LS_KEY = 'tg_chats_cache';

  const loadChats = useCallback(async () => {
    // Show cached data immediately to avoid blank screen on refresh
    const cached = localStorage.getItem(LS_KEY);
    if (cached) {
      try { setChats(JSON.parse(cached)); } catch {}
    }
    setLoading(true);
    try {
      const res = await telegramApi.getKnownChats();
      const list = res.data.chats || [];
      setChats(list);
      localStorage.setItem(LS_KEY, JSON.stringify(list));
    } catch {
      toast.error('Yuklab bo\'lmadi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadChats(); }, [loadChats]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    setCountdown(30);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { loadChats(); return 5; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [loadChats]);

  useEffect(() => {
    telegramApi.getHotelsList().then(r => setHotels(r.data.hotels || [])).catch(() => {});
    telegramApi.getTransportSettings().then(r => setTransportSettings(r.data || {})).catch(() => {});
    telegramApi.getRestaurantList().then(r => setRestaurants(r.data.restaurants || [])).catch(() => {});
    telegramApi.getGuidesList().then(r => setGuides(r.data.guides || [])).catch(() => {});
  }, []);

  const handleLinkRestaurant = async (chatId, restaurantName) => {
    try {
      await telegramApi.linkRestaurant(chatId, restaurantName);
      const r = await telegramApi.getRestaurantList();
      setRestaurants(r.data.restaurants || []);
      toast.success(restaurantName ? 'Restaurant bog\'landi!' : 'Bog\'liq olib tashlandi');
    } catch { toast.error('Saqlashda xatolik'); }
  };

  const handleLinkGuide = async (chatId, guideId) => {
    try {
      await telegramApi.linkGuide(chatId, guideId);
      const r = await telegramApi.getGuidesList();
      setGuides(r.data.guides || []);
      toast.success(guideId ? 'Gid bog\'landi!' : 'Bog\'liq olib tashlandi');
    } catch { toast.error('Saqlashda xatolik'); }
  };

  const handleLinkTransport = async (chatId, provider) => {
    try {
      await telegramApi.linkTransport(chatId, provider);
      const r = await telegramApi.getTransportSettings();
      setTransportSettings(r.data || {});
      toast.success(provider ? 'Transport bog\'landi!' : 'Bog\'liq olib tashlandi');
    } catch {
      toast.error('Saqlashda xatolik');
    }
  };

  const handleLinkHotel = async (chatId, hotelId) => {
    try {
      await telegramApi.linkHotel(chatId, hotelId);
      const res = await telegramApi.getHotelsList();
      setHotels(res.data.hotels || []);
      toast.success(hotelId ? 'Hotel bog\'landi!' : 'Bog\'liq olib tashlandi');
    } catch {
      toast.error('Saqlashda xatolik');
    }
  };

  const handleUpdate = async (chatId, data) => {
    try {
      await telegramApi.updateKnownChat(chatId, data);
      setChats(prev => {
        const updated = prev.map(c => c.chatId === chatId ? { ...c, ...data } : c);
        localStorage.setItem(LS_KEY, JSON.stringify(updated));
        return updated;
      });
    } catch {
      toast.error('Saqlashda xatolik');
    }
  };

  const handleDelete = async (chatId, name) => {
    if (!confirm(`"${name}" ni ro'yxatdan o'chirmoqchimisiz?`)) return;
    setDeletingId(chatId);
    try {
      await telegramApi.deleteKnownChat(chatId);
      setChats(prev => prev.filter(c => c.chatId !== chatId));
      toast.success('O\'chirildi');
    } catch {
      toast.error('O\'chirib bo\'lmadi');
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = chats.filter(c => {
    const matchSearch = !search ||
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.username?.toLowerCase().includes(search.toLowerCase()) ||
      c.chatId?.includes(search) ||
      c.phone?.includes(search);
    const matchTab = tabFilter === 'all' || c.role === tabFilter;
    return matchSearch && matchTab;
  });

  const counts = {
    all:        chats.length,
    hotel:      chats.filter(c => c.role === 'hotel').length,
    transport:  chats.filter(c => c.role === 'transport').length,
    restaurant: chats.filter(c => c.role === 'restaurant').length,
    guide:      chats.filter(c => c.role === 'guide').length,
  };

  return (
    <div className="p-4 md:p-6">
      {sendingTo && <SendMessageModal chat={sendingTo} onClose={() => setSendingTo(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500 flex items-center justify-center">
            <MessageCircle size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Telegram Foydalanuvchilar</h1>
            <p className="text-sm text-gray-500">Botga murojaat qilgan barcha chat va guruhlar</p>
          </div>
        </div>
        <button
          onClick={() => { loadChats(); setCountdown(5); }}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Yangilash
          <span className="text-xs text-gray-400">{countdown}s</span>
        </button>
      </div>

      {/* Stats / Tabs */}
      <div className="grid grid-cols-3 md:grid-cols-5 gap-3 mb-5">
        {[
          { key: 'all',        label: 'Hammasi',    icon: Users,            color: 'text-gray-600 bg-gray-100' },
          { key: 'hotel',      label: 'Hotel',      icon: Building,         color: 'text-purple-600 bg-purple-100' },
          { key: 'transport',  label: 'Transport',  icon: Bus,              color: 'text-yellow-600 bg-yellow-100' },
          { key: 'restaurant', label: 'Restaurant', icon: UtensilsCrossed,  color: 'text-green-600 bg-green-100' },
          { key: 'guide',      label: 'Gidlar',     icon: Compass,          color: 'text-blue-600 bg-blue-100' },
        ].map(({ key, label, icon: Icon, color }) => (
          <button
            key={key}
            onClick={() => setTabFilter(key)}
            className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
              tabFilter === key ? 'border-sky-500 bg-sky-50' : 'border-gray-100 bg-white hover:border-gray-200'
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
              <Icon size={16} />
            </div>
            <div className="text-left">
              <div className="text-lg font-bold text-gray-900">{counts[key]}</div>
              <div className="text-xs text-gray-500">{label}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Nom, username, telefon yoki Chat ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <MessageCircle size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Chat topilmadi</p>
          <p className="text-sm mt-1">Botga hali hech kim murojaat qilmagan yoki filter bo'yicha natija yo'q</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">
                    { tabFilter === 'hotel'      ? 'Hotel'
                    : tabFilter === 'transport'  ? 'Provider'
                    : tabFilter === 'restaurant' ? 'Restaurant'
                    : tabFilter === 'guide'      ? 'Guide'
                    : 'Username' }
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">
                    <span className="flex items-center gap-1"><Phone size={13} />Phone</span>
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Chat ID</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Role</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Lang</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(chat => {
                  return (
                    <tr key={chat.chatId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <NameCell chatId={chat.chatId} value={chat.name} onSave={handleUpdate} />
                      </td>
                      <td className="px-4 py-3">
                        { tabFilter === 'hotel'
                          ? <HotelCell chatId={chat.chatId} hotels={hotels} onLink={handleLinkHotel} />
                          : tabFilter === 'transport'
                          ? <TransportCell chatId={chat.chatId} transportSettings={transportSettings} onLink={handleLinkTransport} />
                          : tabFilter === 'restaurant'
                          ? <RestaurantCell chatId={chat.chatId} restaurants={restaurants} onLink={handleLinkRestaurant} />
                          : tabFilter === 'guide'
                          ? <GuideCell chatId={chat.chatId} guides={guides} onLink={handleLinkGuide} />
                          : <span className="text-gray-500">{chat.username || '—'}</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <PhoneCell chatId={chat.chatId} value={chat.phone} onSave={handleUpdate} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                          {chat.chatId}
                        </span>
                        <CopyButton text={chat.chatId} />
                      </td>
                      <td className="px-4 py-3">
                        <RoleCell chatId={chat.chatId} value={chat.role} onSave={handleUpdate} />
                      </td>
                      <td className="px-4 py-3 text-lg">
                        {chat.lang === 'uz' ? '🇺🇿' : chat.lang === 'ru' ? '🇷🇺' : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{formatDate(chat.date)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setSendingTo(chat)}
                            className="p-1.5 rounded-lg text-sky-400 hover:bg-sky-50 hover:text-sky-600 transition-colors"
                            title="Xabar yuborish"
                          >
                            <Send size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(chat.chatId, chat.name)}
                            disabled={deletingId === chat.chatId}
                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-40"
                            title="O'chirish"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-gray-100">
            {filtered.map(chat => {
              return (
                <div key={chat.chatId} className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <NameCell chatId={chat.chatId} value={chat.name} onSave={handleUpdate} />
                        {chat.role && (
                          <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${roleColors[chat.role] || 'bg-gray-100 text-gray-600'}`}>
                            {ROLES.find(r => r.value === chat.role)?.label}
                          </span>
                        )}
                      </div>
                      {chat.username && <div className="text-xs text-gray-500">{chat.username}</div>}
                    </div>
                    <button
                      onClick={() => handleDelete(chat.chatId, chat.name)}
                      disabled={deletingId === chat.chatId}
                      className="p-2 rounded-lg text-red-400 hover:bg-red-50 flex-shrink-0"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{chat.chatId}</span>
                      <CopyButton text={chat.chatId} />
                    </div>
                    <PhoneCell chatId={chat.chatId} value={chat.phone} onSave={handleUpdate} />
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <RoleCell chatId={chat.chatId} value={chat.role} onSave={handleUpdate} />
                    {chat.lang && <span className="text-base">{chat.lang === 'uz' ? '🇺🇿' : '🇷🇺'}</span>}
                  </div>
                  <div className="text-xs text-gray-400 mt-2">{formatDate(chat.date)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {filtered.length > 0 && (
        <p className="text-xs text-gray-400 mt-3 text-right">Jami: {filtered.length} ta</p>
      )}
    </div>
  );
}
