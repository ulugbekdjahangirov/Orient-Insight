import { useState, useEffect, useCallback } from 'react';
import { telegramApi } from '../services/api';
import { RefreshCw, Trash2, Copy, Check, Users, MessageCircle, Hash, Building, Phone, Pencil, X } from 'lucide-react';
import toast from 'react-hot-toast';

const typeLabels = {
  private:    { label: 'Shaxsiy',    color: 'bg-blue-100 text-blue-800',   icon: MessageCircle },
  group:      { label: 'Guruh',      color: 'bg-green-100 text-green-800', icon: Users },
  supergroup: { label: 'Supergroup', color: 'bg-purple-100 text-purple-800', icon: Users },
  channel:    { label: 'Kanal',      color: 'bg-orange-100 text-orange-800', icon: Hash },
};

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

export default function TelegramUsers() {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [deletingId, setDeletingId] = useState(null);

  const loadChats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await telegramApi.getKnownChats();
      setChats(res.data.chats || []);
    } catch {
      toast.error('Yuklab bo\'lmadi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadChats(); }, [loadChats]);

  const handleUpdate = async (chatId, data) => {
    try {
      await telegramApi.updateKnownChat(chatId, data);
      setChats(prev => prev.map(c => c.chatId === chatId ? { ...c, ...data } : c));
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
    const matchType = typeFilter === 'all' || c.type === typeFilter || (typeFilter === 'group' && c.type === 'supergroup');
    const matchRole = roleFilter === 'all' || (roleFilter === 'none' ? !c.role : c.role === roleFilter);
    return matchSearch && matchType && matchRole;
  });

  const counts = {
    all: chats.length,
    private: chats.filter(c => c.type === 'private').length,
    group: chats.filter(c => c.type === 'group' || c.type === 'supergroup').length,
    channel: chats.filter(c => c.type === 'channel').length,
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
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
          onClick={loadChats}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Yangilash
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { key: 'all',     label: 'Hammasi', icon: Users,          color: 'text-gray-600 bg-gray-100' },
          { key: 'private', label: 'Shaxsiy', icon: MessageCircle,  color: 'text-blue-600 bg-blue-100' },
          { key: 'group',   label: 'Guruh',   icon: Users,          color: 'text-green-600 bg-green-100' },
          { key: 'channel', label: 'Kanal',   icon: Hash,           color: 'text-orange-600 bg-orange-100' },
        ].map(({ key, label, icon: Icon, color }) => (
          <button
            key={key}
            onClick={() => setTypeFilter(key)}
            className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
              typeFilter === key ? 'border-sky-500 bg-sky-50' : 'border-gray-100 bg-white hover:border-gray-200'
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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Nom, username, telefon yoki Chat ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
        >
          <option value="all">Barcha rollar</option>
          <option value="none">Belgilanmagan</option>
          {ROLES.filter(r => r.value).map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
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
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Nom</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Username</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">
                    <span className="flex items-center gap-1"><Phone size={13} />Telefon</span>
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Chat ID</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Tur</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Rol</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Oxirgi xabar</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Sana</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(chat => {
                  const typeInfo = typeLabels[chat.type] || { label: chat.type, color: 'bg-gray-100 text-gray-600', icon: Building };
                  const TypeIcon = typeInfo.icon;
                  return (
                    <tr key={chat.chatId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{chat.name || '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{chat.username || '—'}</td>
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
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${typeInfo.color}`}>
                          <TypeIcon size={11} />
                          {typeInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <RoleCell chatId={chat.chatId} value={chat.role} onSave={handleUpdate} />
                      </td>
                      <td className="px-4 py-3 text-gray-500 max-w-[160px] truncate" title={chat.lastMessage}>
                        {chat.lastMessage || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{formatDate(chat.date)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDelete(chat.chatId, chat.name)}
                          disabled={deletingId === chat.chatId}
                          className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-40"
                        >
                          <Trash2 size={15} />
                        </button>
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
              const typeInfo = typeLabels[chat.type] || { label: chat.type, color: 'bg-gray-100 text-gray-600', icon: Building };
              const TypeIcon = typeInfo.icon;
              return (
                <div key={chat.chatId} className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-gray-900">{chat.name || '—'}</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${typeInfo.color}`}>
                          <TypeIcon size={10} />{typeInfo.label}
                        </span>
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
                  <div className="mt-2">
                    <RoleCell chatId={chat.chatId} value={chat.role} onSave={handleUpdate} />
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
