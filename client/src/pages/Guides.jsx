import { useState, useEffect } from 'react';
import { guidesApi } from '../services/api';
import { useAuth } from '../store/AuthContext';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import toast from 'react-hot-toast';
import {
  Plus,
  Edit,
  Trash2,
  User,
  Phone,
  Mail,
  X,
  Save,
  AlertTriangle,
  CreditCard,
  FileText,
  Calendar,
  MapPin,
  Eye,
  EyeOff,
  Shield,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export default function Guides() {
  const { isAdmin } = useAuth();
  const [guides, setGuides] = useState([]);
  const [alerts, setAlerts] = useState({ alerts: [], expiredCount: 0, expiringSoonCount: 0 });
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGuide, setEditingGuide] = useState(null);
  const [showSensitive, setShowSensitive] = useState({});
  const [expandedGuide, setExpandedGuide] = useState(null);
  const [formData, setFormData] = useState(getEmptyFormData());

  function getEmptyFormData() {
    return {
      name: '',
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      phone: '',
      email: '',
      address: '',
      passportNumber: '',
      passportIssueDate: '',
      passportExpiryDate: '',
      passportIssuedBy: '',
      bankAccountNumber: '',
      bankCardNumber: '',
      bankName: '',
      notes: ''
    };
  }

  useEffect(() => {
    loadGuides();
    loadAlerts();
  }, []);

  const loadGuides = async () => {
    try {
      const response = await guidesApi.getAll(true);
      setGuides(response.data.guides);
    } catch (error) {
      toast.error('Ошибка загрузки гидов');
    } finally {
      setLoading(false);
    }
  };

  const loadAlerts = async () => {
    try {
      const response = await guidesApi.getAlerts();
      setAlerts(response.data);
    } catch (error) {
      console.error('Error loading alerts:', error);
    }
  };

  const openModal = (guide = null) => {
    if (guide) {
      setEditingGuide(guide);
      setFormData({
        name: guide.name || '',
        firstName: guide.firstName || '',
        lastName: guide.lastName || '',
        dateOfBirth: guide.dateOfBirth ? format(new Date(guide.dateOfBirth), 'yyyy-MM-dd') : '',
        phone: guide.phone || '',
        email: guide.email || '',
        address: guide.address || '',
        passportNumber: guide.passportNumber || '',
        passportIssueDate: guide.passportIssueDate ? format(new Date(guide.passportIssueDate), 'yyyy-MM-dd') : '',
        passportExpiryDate: guide.passportExpiryDate ? format(new Date(guide.passportExpiryDate), 'yyyy-MM-dd') : '',
        passportIssuedBy: guide.passportIssuedBy || '',
        bankAccountNumber: guide.bankAccountNumber || '',
        bankCardNumber: guide.bankCardNumber || '',
        bankName: guide.bankName || '',
        notes: guide.notes || ''
      });
    } else {
      setEditingGuide(null);
      setFormData(getEmptyFormData());
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingGuide(null);
    setFormData(getEmptyFormData());
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Введите имя гида');
      return;
    }

    try {
      if (editingGuide) {
        await guidesApi.update(editingGuide.id, formData);
        toast.success('Гид обновлён');
      } else {
        await guidesApi.create(formData);
        toast.success('Гид добавлен');
      }
      closeModal();
      loadGuides();
      loadAlerts();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Ошибка сохранения');
    }
  };

  const handleDelete = async (guide) => {
    if (!confirm(`Удалить гида ${guide.name}?`)) return;

    try {
      await guidesApi.delete(guide.id);
      toast.success('Гид удалён');
      loadGuides();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Ошибка удаления');
    }
  };

  const toggleActive = async (guide) => {
    try {
      await guidesApi.update(guide.id, { isActive: !guide.isActive });
      toast.success(guide.isActive ? 'Гид деактивирован' : 'Гид активирован');
      loadGuides();
    } catch (error) {
      toast.error('Ошибка обновления');
    }
  };

  const toggleSensitive = (guideId) => {
    setShowSensitive(prev => ({ ...prev, [guideId]: !prev[guideId] }));
  };

  const getPassportStatusBadge = (status) => {
    if (!status) return null;

    if (status.isExpired) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
          <AlertTriangle className="w-3 h-3" />
          Истёк
        </span>
      );
    }

    if (status.isExpiringSoon) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
          <AlertTriangle className="w-3 h-3" />
          {status.daysLeft} дней
        </span>
      );
    }

    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Гиды</h1>
          <p className="text-gray-500">Управление профилями гидов</p>
        </div>

        {isAdmin && (
          <button
            onClick={() => openModal()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Добавить гида
          </button>
        )}
      </div>

      {/* Passport Alerts */}
      {(alerts.expiredCount > 0 || alerts.expiringSoonCount > 0) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-yellow-800">Внимание: Проверьте паспорта</h3>
              <p className="text-sm text-yellow-700 mt-1">
                {alerts.expiredCount > 0 && (
                  <span className="font-medium text-red-600">{alerts.expiredCount} истёкших</span>
                )}
                {alerts.expiredCount > 0 && alerts.expiringSoonCount > 0 && ', '}
                {alerts.expiringSoonCount > 0 && (
                  <span className="font-medium text-yellow-600">{alerts.expiringSoonCount} истекают скоро</span>
                )}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {alerts.alerts.map(alert => (
                  <span
                    key={alert.id}
                    className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                      alert.passportStatus.isExpired
                        ? 'bg-red-100 text-red-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {alert.name}: {alert.passportStatus.message}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Guides Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Гид</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Контакты</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Паспорт</th>
              {isAdmin && (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Банк</th>
              )}
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Туры</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {guides.map((guide) => (
              <tr key={guide.id} className={!guide.isActive ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50'}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{guide.name}</p>
                      {(guide.firstName || guide.lastName) && (
                        <p className="text-xs text-gray-500">
                          {guide.firstName} {guide.lastName}
                        </p>
                      )}
                      {guide.dateOfBirth && (
                        <p className="text-xs text-gray-400">
                          {format(new Date(guide.dateOfBirth), 'dd.MM.yyyy')}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-1 text-sm">
                    {guide.phone && (
                      <div className="flex items-center gap-1 text-gray-600">
                        <Phone className="w-3 h-3" />
                        {guide.phone}
                      </div>
                    )}
                    {guide.email && (
                      <div className="flex items-center gap-1 text-gray-600">
                        <Mail className="w-3 h-3" />
                        {guide.email}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-1">
                    {guide.passportNumber && (
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                          {showSensitive[guide.id] && isAdmin ? guide.passportNumber : guide.passportNumber}
                        </code>
                        {isAdmin && (
                          <button
                            onClick={() => toggleSensitive(guide.id)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            {showSensitive[guide.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                        )}
                      </div>
                    )}
                    {guide.passportExpiryDate && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">
                          до {format(new Date(guide.passportExpiryDate), 'dd.MM.yyyy')}
                        </span>
                        {getPassportStatusBadge(guide.passportStatus)}
                      </div>
                    )}
                    {!guide.passportNumber && <span className="text-xs text-gray-400">—</span>}
                  </div>
                </td>
                {isAdmin && (
                  <td className="px-4 py-3">
                    <div className="space-y-1 text-xs">
                      {guide.bankCardNumber && (
                        <div className="flex items-center gap-1 text-gray-600">
                          <CreditCard className="w-3 h-3" />
                          {guide.bankCardNumber}
                        </div>
                      )}
                      {guide.bankName && (
                        <div className="text-gray-500">{guide.bankName}</div>
                      )}
                      {!guide.bankCardNumber && !guide.bankName && (
                        <span className="text-gray-400">—</span>
                      )}
                    </div>
                  </td>
                )}
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                    {guide._count?.bookings || 0} туров
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                    guide.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {guide.isActive ? 'Активен' : 'Неактивен'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => openModal(guide)}
                      className="p-1.5 text-gray-400 hover:text-primary-600 rounded"
                      title="Редактировать"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => toggleActive(guide)}
                          className="p-1.5 text-gray-400 hover:text-yellow-600 rounded"
                          title={guide.isActive ? 'Деактивировать' : 'Активировать'}
                        >
                          <Shield className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(guide)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                          title="Удалить"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {guides.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            Гиды не найдены
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingGuide ? 'Редактировать гида' : 'Новый гид'}
              </h2>
              <button onClick={closeModal} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Basic Info */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Основная информация
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Отображаемое имя *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      placeholder="Zokir"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Имя</label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Фамилия</label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Дата рождения</label>
                    <input
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Телефон</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      placeholder="+998901234567"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Адрес</label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
              </div>

              {/* Passport Info - Admin Only */}
              {isAdmin && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Паспортные данные
                    <span className="text-xs text-red-500">(конфиденциально)</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Номер паспорта</label>
                      <input
                        type="text"
                        value={formData.passportNumber}
                        onChange={(e) => setFormData({ ...formData, passportNumber: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        placeholder="AA1234567"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Кем выдан</label>
                      <input
                        type="text"
                        value={formData.passportIssuedBy}
                        onChange={(e) => setFormData({ ...formData, passportIssuedBy: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Дата выдачи</label>
                      <input
                        type="date"
                        value={formData.passportIssueDate}
                        onChange={(e) => setFormData({ ...formData, passportIssueDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Срок действия</label>
                      <input
                        type="date"
                        value={formData.passportExpiryDate}
                        onChange={(e) => setFormData({ ...formData, passportExpiryDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Bank Info - Admin Only */}
              {isAdmin && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Банковские данные
                    <span className="text-xs text-red-500">(конфиденциально)</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Номер счёта</label>
                      <input
                        type="text"
                        value={formData.bankAccountNumber}
                        onChange={(e) => setFormData({ ...formData, bankAccountNumber: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Номер карты</label>
                      <input
                        type="text"
                        value={formData.bankCardNumber}
                        onChange={(e) => setFormData({ ...formData, bankCardNumber: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        placeholder="8600 1234 5678 9012"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Название банка</label>
                      <input
                        type="text"
                        value={formData.bankName}
                        onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        placeholder="Kapitalbank, Hamkorbank..."
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Примечания</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="Дополнительная информация..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200">
              <button
                onClick={closeModal}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                onClick={handleSave}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                <Save className="w-4 h-4" />
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
