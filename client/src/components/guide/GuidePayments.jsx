import { useState, useEffect } from 'react';
import { guidesApi } from '../../services/api';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import toast from 'react-hot-toast';
import {
  DollarSign,
  Plus,
  Calendar,
  FileText,
  TrendingUp,
  Filter,
  X
} from 'lucide-react';

export default function GuidePayments({ guideId, guide }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [filters, setFilters] = useState({
    year: new Date().getFullYear(),
    month: null
  });
  const [formData, setFormData] = useState({
    amount: '',
    currency: 'UZS',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentType: 'SALARY',
    notes: ''
  });

  useEffect(() => {
    loadPayments();
  }, [guideId, filters]);

  const loadPayments = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.year) params.year = filters.year;
      if (filters.month) params.month = filters.month;

      const response = await guidesApi.getPayments(guideId, params);
      setPayments(response.data);
    } catch (error) {
      console.error('Error loading payments:', error);
      toast.error('Ошибка при загрузке выплат');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error('Введите корректную сумму');
      return;
    }

    try {
      await guidesApi.addPayment(guideId, {
        ...formData,
        amount: parseFloat(formData.amount)
      });
      toast.success('Выплата добавлена успешно');
      setModalOpen(false);
      setFormData({
        amount: '',
        currency: 'UZS',
        paymentDate: new Date().toISOString().split('T')[0],
        paymentType: 'SALARY',
        notes: ''
      });
      loadPayments();
    } catch (error) {
      console.error('Error adding payment:', error);
      toast.error('Ошибка при добавлении выплаты');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const formatCurrency = (amount, currency) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount) + ' ' + currency;
  };

  const getPaymentTypeLabel = (type) => {
    const labels = {
      SALARY: 'Зарплата',
      BONUS: 'Бонус',
      ADVANCE: 'Аванс'
    };
    return labels[type] || type;
  };

  const getPaymentTypeBadge = (type) => {
    const colors = {
      SALARY: 'bg-blue-100 text-blue-800',
      BONUS: 'bg-green-100 text-green-800',
      ADVANCE: 'bg-yellow-100 text-yellow-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  const months = [
    { value: null, label: 'Все месяцы' },
    { value: 1, label: 'Январь' },
    { value: 2, label: 'Февраль' },
    { value: 3, label: 'Март' },
    { value: 4, label: 'Апрель' },
    { value: 5, label: 'Май' },
    { value: 6, label: 'Июнь' },
    { value: 7, label: 'Июль' },
    { value: 8, label: 'Август' },
    { value: 9, label: 'Сентябрь' },
    { value: 10, label: 'Октябрь' },
    { value: 11, label: 'Ноябрь' },
    { value: 12, label: 'Декабрь' }
  ];

  return (
    <div className="space-y-6">
      {/* Header with Stats and Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-primary-50 p-3 rounded-lg">
            <DollarSign className="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Выплаты гиду</h3>
            <p className="text-sm text-gray-600">
              Всего выплат: <span className="font-semibold">{payments.length}</span>
              {payments.length > 0 && (
                <span className="ml-3">
                  Сумма: <span className="font-semibold">{formatCurrency(totalAmount, 'UZS')}</span>
                </span>
              )}
            </p>
          </div>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Plus className="w-5 h-5" />
          Добавить выплату
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
        <Filter className="w-5 h-5 text-gray-500" />
        <div className="flex items-center gap-3">
          <select
            value={filters.year}
            onChange={(e) => setFilters(prev => ({ ...prev, year: parseInt(e.target.value) }))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>

          <select
            value={filters.month || ''}
            onChange={(e) => setFilters(prev => ({ ...prev, month: e.target.value ? parseInt(e.target.value) : null }))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            {months.map(month => (
              <option key={month.value} value={month.value || ''}>{month.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Payments List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : payments.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Нет выплат за выбранный период</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Дата
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Тип
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Сумма
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Заметки
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-900">
                        {format(new Date(payment.paymentDate), 'dd MMM yyyy', { locale: ru })}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getPaymentTypeBadge(payment.paymentType)}`}>
                      {getPaymentTypeLabel(payment.paymentType)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-semibold text-gray-900">
                      {formatCurrency(payment.amount, payment.currency)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600">
                      {payment.notes || '-'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Payment Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Добавить выплату</h3>
                <button
                  onClick={() => setModalOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Сумма <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="amount"
                    value={formData.amount}
                    onChange={handleChange}
                    step="0.01"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Валюта
                  </label>
                  <select
                    name="currency"
                    value={formData.currency}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="UZS">UZS</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Дата выплаты <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="paymentDate"
                    value={formData.paymentDate}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Тип выплаты
                  </label>
                  <select
                    name="paymentType"
                    value={formData.paymentType}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="SALARY">Зарплата</option>
                    <option value="BONUS">Бонус</option>
                    <option value="ADVANCE">Аванс</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Заметки
                  </label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Дополнительная информация..."
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                  >
                    Добавить
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
