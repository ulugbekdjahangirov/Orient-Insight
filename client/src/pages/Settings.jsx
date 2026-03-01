import { useState, useEffect } from 'react';
import { useAuth } from '../store/AuthContext';
import { Lock, User, Save, Folder, CheckCircle, AlertCircle, FolderOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import {
  isFileSystemAccessSupported,
  selectTourTypeFolder,
  getAllFolderStatuses,
  PDF_CATEGORIES,
} from '../utils/fileSystemUtils';

const TOUR_TYPES = [
  { code: 'ER',  label: 'Erlebnisreisen',          color: '#3b82f6', example: 'ER / ER-01 / Zayavka / ...' },
  { code: 'CO',  label: 'Comfort',                  color: '#10b981', example: 'CO / CO-01 / Zayavka / ...' },
  { code: 'KAS', label: 'Karawanen Seidenstrasse',  color: '#f59e0b', example: 'KAS / KAS-01 / Zayavka / ...' },
  { code: 'ZA',  label: 'Zentralasien',             color: '#8b5cf6', example: 'ZA / ZA-01 / Zayavka / ...' },
];

export default function Settings() {
  const { user } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // PDF folder states
  const [folderNames, setFolderNames] = useState({ ER: null, CO: null, KAS: null, ZA: null });
  const [selectingFolder, setSelectingFolder] = useState(null);
  const fsSupported = isFileSystemAccessSupported();

  useEffect(() => {
    if (fsSupported) {
      getAllFolderStatuses().then(setFolderNames);
    }
  }, []);

  const handleSelectFolder = async (tourType) => {
    setSelectingFolder(tourType);
    try {
      const result = await selectTourTypeFolder(tourType);
      if (result.success) {
        setFolderNames(prev => ({ ...prev, [tourType]: result.folderName }));
        toast.success(`${tourType} papkasi tanlandi: ${result.folderName}`);
      } else if (!result.cancelled) {
        toast.error(result.error || 'Xatolik');
      }
    } finally {
      setSelectingFolder(null);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error('Новый пароль должен содержать минимум 6 символов');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Пароли не совпадают');
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.patch(
        `/api/auth/users/${user.id}`,
        { password: newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Пароль успешно изменен!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Ошибка изменения пароля');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-3 sm:p-6 max-w-2xl mx-auto space-y-4">

      {/* ── PDF Papkalari ── */}
      {fsSupported && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200 p-4 sm:p-5">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Folder className="w-5 h-5 text-emerald-600" />
              PDF Papkalari
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Har bir guruh uchun bir marta asosiy papkani tanlang — PDFlar avtomatik to'g'ri joyga saqlanadi
            </p>
          </div>

          {/* Subfolder legend */}
          <div className="px-4 sm:px-5 pt-3 pb-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Papka strukturasi:</p>
            <div className="flex flex-wrap gap-2 text-xs">
              {Object.entries(PDF_CATEGORIES).map(([key, folder]) => (
                <span key={key} className="px-2 py-1 bg-gray-100 rounded-md text-gray-600 font-mono">
                  {`{Booking} / `}<span className="text-emerald-700 font-bold">{folder}</span>{` / file.pdf`}
                </span>
              ))}
            </div>
          </div>

          {/* Tour type rows */}
          <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TOUR_TYPES.map(({ code, label, color, example }) => {
              const name = folderNames[code];
              const isSelecting = selectingFolder === code;
              return (
                <div key={code} className="border border-gray-200 rounded-xl p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold px-2 py-0.5 rounded-md text-white"
                        style={{ background: color }}>{code}</span>
                      <span className="text-xs text-gray-500 hidden sm:block">{label}</span>
                    </div>
                    {name
                      ? <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      : <AlertCircle className="w-4 h-4 text-gray-300 flex-shrink-0" />
                    }
                  </div>

                  {name ? (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-2 py-1">
                      <FolderOpen className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate font-medium">{name}</span>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">Papka tanlanmagan</p>
                  )}

                  <p className="text-[10px] text-gray-400 font-mono truncate">{example}</p>

                  <button
                    onClick={() => handleSelectFolder(code)}
                    disabled={isSelecting}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-60"
                    style={{ background: name ? '#f0fdf4' : color + '15', color: name ? '#16a34a' : color, border: `1px solid ${name ? '#bbf7d0' : color + '40'}` }}
                  >
                    <Folder className="w-3.5 h-3.5" />
                    {isSelecting ? 'Tanlanmoqda...' : name ? 'Papkani o\'zgartirish' : 'Papka tanlash'}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="px-4 sm:px-5 pb-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              <strong>Eslatma:</strong> Bu funksiya faqat Chrome va Edge brauzerlarida ishlaydi.
              Papka bir marta tanlanadi — keyingi safar brauzer ruxsat so'rashi mumkin.
            </div>
          </div>
        </div>
      )}

      {/* ── Account ── */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200 p-4 sm:p-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Настройки</h1>
          <p className="text-sm text-gray-500 mt-1">Управление аккаунтом и безопасностью</p>
        </div>

        {/* User Info */}
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <User className="w-5 h-5" />
            Информация о пользователе
          </h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Email</label>
              <p className="text-gray-900 break-all">{user?.email}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Имя</label>
              <p className="text-gray-900">{user?.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Роль</label>
              <p className="text-gray-900">{user?.role}</p>
            </div>
          </div>
        </div>

        {/* Change Password */}
        <div className="p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Изменить пароль
          </h2>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Новый пароль</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Минимум 6 символов"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Подтвердите новый пароль</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Повторите новый пароль"
                required
              />
            </div>
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {loading ? 'Сохранение...' : 'Сохранить пароль'}
              </button>
            </div>
          </form>
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">Требования к паролю:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Минимум 6 символов</li>
              <li>• Используйте комбинацию букв, цифр и символов</li>
              <li>• Не используйте простые пароли (123456, password и т.д.)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
