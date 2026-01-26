import { useState, useEffect } from 'react';
import { useAuth } from '../../store/AuthContext';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import toast from 'react-hot-toast';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  FileText,
  CreditCard,
  Building2,
  Save,
  X,
  Eye,
  EyeOff,
  Shield,
  Briefcase,
  DollarSign,
  TrendingUp,
  Award
} from 'lucide-react';

export default function GuideInformation({ guide, editing, onSave, onCancel, onUpdate }) {
  const { isAdmin } = useAuth();
  const [showSensitive, setShowSensitive] = useState(false);
  const [formData, setFormData] = useState({
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
  });

  useEffect(() => {
    if (guide) {
      setFormData({
        name: guide.name || '',
        firstName: guide.firstName || '',
        lastName: guide.lastName || '',
        dateOfBirth: guide.dateOfBirth ? guide.dateOfBirth.split('T')[0] : '',
        phone: guide.phone || '',
        email: guide.email || '',
        address: guide.address || '',
        passportNumber: guide.passportNumber || '',
        passportIssueDate: guide.passportIssueDate ? guide.passportIssueDate.split('T')[0] : '',
        passportExpiryDate: guide.passportExpiryDate ? guide.passportExpiryDate.split('T')[0] : '',
        passportIssuedBy: guide.passportIssuedBy || '',
        bankAccountNumber: guide.bankAccountNumber || '',
        bankCardNumber: guide.bankCardNumber || '',
        bankName: guide.bankName || '',
        notes: guide.notes || ''
      });
    }
  }, [guide]);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Имя гида обязательно');
      return;
    }

    onSave(formData);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const formatPassportExpiry = (date) => {
    if (!date) return null;
    const expiryDate = new Date(date);
    const today = new Date();
    const daysLeft = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold bg-red-100 text-red-800 rounded-full">
          Истёк
        </span>
      );
    } else if (daysLeft <= 90) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold bg-yellow-100 text-yellow-800 rounded-full">
          {daysLeft} дней
        </span>
      );
    }
    return null;
  };

  if (editing) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Основная информация
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Имя гида <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Имя (на латинице)
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Фамилия (на латинице)
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Дата рождения
                </label>
                <input
                  type="date"
                  name="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Телефон
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Адрес
                </label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Passport Information - Admin Only */}
          {isAdmin && (
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Паспортные данные
                <span className="ml-2 px-2 py-1 text-xs font-semibold bg-amber-100 text-amber-800 rounded-full flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Конфиденциально
                </span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Номер паспорта
                  </label>
                  <input
                    type="text"
                    name="passportNumber"
                    value={formData.passportNumber}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Кем выдан
                  </label>
                  <input
                    type="text"
                    name="passportIssuedBy"
                    value={formData.passportIssuedBy}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Дата выдачи
                  </label>
                  <input
                    type="date"
                    name="passportIssueDate"
                    value={formData.passportIssueDate}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Срок действия до
                  </label>
                  <input
                    type="date"
                    name="passportExpiryDate"
                    value={formData.passportExpiryDate}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Bank Information - Admin Only */}
          {isAdmin && (
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Банковские данные
                <span className="ml-2 px-2 py-1 text-xs font-semibold bg-amber-100 text-amber-800 rounded-full flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Конфиденциально
                </span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Номер счета
                  </label>
                  <input
                    type="text"
                    name="bankAccountNumber"
                    value={formData.bankAccountNumber}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Номер карты
                  </label>
                  <input
                    type="text"
                    name="bankCardNumber"
                    value={formData.bankCardNumber}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Название банка
                  </label>
                  <input
                    type="text"
                    name="bankName"
                    value={formData.bankName}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Заметки</h3>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Дополнительная информация о гиде..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Отмена
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Сохранить
            </button>
          </div>
        </form>
      </div>
    );
  }

  // View Mode
  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-sm p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Всего туров</p>
              <p className="text-3xl font-bold mt-1">{guide.bookingsCount || 0}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <Briefcase className="w-8 h-8" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-sm p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">Активных туров</p>
              <p className="text-3xl font-bold mt-1">{guide.activeBookingsCount || 0}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <TrendingUp className="w-8 h-8" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-sm p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium">Всего выплат</p>
              <p className="text-3xl font-bold mt-1">{guide.paymentsCount || 0}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <DollarSign className="w-8 h-8" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl shadow-sm p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-amber-100 text-sm font-medium">Рейтинг</p>
              <p className="text-3xl font-bold mt-1">
                {guide.isActive ? 'A+' : 'N/A'}
              </p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <Award className="w-8 h-8" />
            </div>
          </div>
        </div>
      </div>

      {/* Basic Information */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <User className="w-5 h-5" />
          Основная информация
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex items-start gap-3">
            <User className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-sm text-gray-500">Имя гида</p>
              <p className="text-base font-medium text-gray-900">{guide.name || '-'}</p>
            </div>
          </div>

          {(guide.firstName || guide.lastName) && (
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Полное имя</p>
                <p className="text-base font-medium text-gray-900">
                  {guide.firstName} {guide.lastName}
                </p>
              </div>
            </div>
          )}

          {guide.dateOfBirth && (
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Дата рождения</p>
                <p className="text-base font-medium text-gray-900">
                  {format(new Date(guide.dateOfBirth), 'dd MMM yyyy', { locale: ru })}
                </p>
              </div>
            </div>
          )}

          {guide.phone && (
            <div className="flex items-start gap-3">
              <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Телефон</p>
                <p className="text-base font-medium text-gray-900">{guide.phone}</p>
              </div>
            </div>
          )}

          {guide.email && (
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="text-base font-medium text-gray-900">{guide.email}</p>
              </div>
            </div>
          )}

          {guide.address && (
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Адрес</p>
                <p className="text-base font-medium text-gray-900">{guide.address}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Passport Information */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Паспортные данные
            {!isAdmin && (
              <span className="ml-2 px-2 py-1 text-xs font-semibold bg-amber-100 text-amber-800 rounded-full flex items-center gap-1">
                <Shield className="w-3 h-3" />
                Ограничено
              </span>
            )}
          </h3>
          {isAdmin && guide.passportNumber && (
            <button
              onClick={() => setShowSensitive(!showSensitive)}
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-2"
            >
              {showSensitive ? (
                <>
                  <EyeOff className="w-4 h-4" />
                  Скрыть
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  Показать
                </>
              )}
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {guide.passportNumber && (
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Номер паспорта</p>
                <p className="text-base font-medium text-gray-900 font-mono">
                  {isAdmin && showSensitive ? guide.passportNumber : guide.passportNumber}
                </p>
              </div>
            </div>
          )}

          {guide.passportExpiryDate && (
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Срок действия до</p>
                <div className="flex items-center gap-2">
                  <p className="text-base font-medium text-gray-900">
                    {format(new Date(guide.passportExpiryDate), 'dd MMM yyyy', { locale: ru })}
                  </p>
                  {formatPassportExpiry(guide.passportExpiryDate)}
                </div>
              </div>
            </div>
          )}

          {guide.passportIssueDate && (
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Дата выдачи</p>
                <p className="text-base font-medium text-gray-900">
                  {format(new Date(guide.passportIssueDate), 'dd MMM yyyy', { locale: ru })}
                </p>
              </div>
            </div>
          )}

          {guide.passportIssuedBy && (
            <div className="flex items-start gap-3">
              <Building2 className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Кем выдан</p>
                <p className="text-base font-medium text-gray-900">{guide.passportIssuedBy}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bank Information - Admin Only */}
      {isAdmin && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Банковские данные
              <span className="ml-2 px-2 py-1 text-xs font-semibold bg-amber-100 text-amber-800 rounded-full flex items-center gap-1">
                <Shield className="w-3 h-3" />
                Конфиденциально
              </span>
            </h3>
            {(guide.bankAccountNumber || guide.bankCardNumber) && (
              <button
                onClick={() => setShowSensitive(!showSensitive)}
                className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-2"
              >
                {showSensitive ? (
                  <>
                    <EyeOff className="w-4 h-4" />
                    Скрыть
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" />
                    Показать
                  </>
                )}
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {guide.bankAccountNumber && (
              <div className="flex items-start gap-3">
                <CreditCard className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Номер счета</p>
                  <p className="text-base font-medium text-gray-900 font-mono">
                    {showSensitive ? guide.bankAccountNumber : guide.bankAccountNumber}
                  </p>
                </div>
              </div>
            )}

            {guide.bankCardNumber && (
              <div className="flex items-start gap-3">
                <CreditCard className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Номер карты</p>
                  <p className="text-base font-medium text-gray-900 font-mono">
                    {showSensitive ? guide.bankCardNumber : guide.bankCardNumber}
                  </p>
                </div>
              </div>
            )}

            {guide.bankName && (
              <div className="flex items-start gap-3">
                <Building2 className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Банк</p>
                  <p className="text-base font-medium text-gray-900">{guide.bankName}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notes */}
      {guide.notes && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Заметки</h3>
          <p className="text-gray-700 whitespace-pre-wrap">{guide.notes}</p>
        </div>
      )}
    </div>
  );
}
