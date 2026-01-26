import React, { useState, useEffect } from 'react';
import { gmailApi } from '../services/api';

const STATUS_COLORS = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  SUCCESS: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  MANUAL_REVIEW: 'bg-orange-100 text-orange-800'
};

const STATUS_LABELS = {
  PENDING: 'Ожидание',
  PROCESSING: 'Обработка',
  SUCCESS: 'Успешно',
  FAILED: 'Ошибка',
  MANUAL_REVIEW: 'Требует проверки'
};

export default function EmailImports() {
  const [imports, setImports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedImport, setSelectedImport] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    loadImports();
  }, [page, statusFilter]);

  const loadImports = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;

      const response = await gmailApi.getImports(params);
      setImports(response.data.imports);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Failed to load imports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (importId) => {
    try {
      const response = await gmailApi.getImport(importId);
      setSelectedImport(response.data);
      setShowDetailsModal(true);
    } catch (error) {
      console.error('Failed to load import details:', error);
    }
  };

  const handleRetry = async (importId) => {
    if (!confirm('Повторить обработку этого импорта?')) return;

    try {
      await gmailApi.retryImport(importId);
      alert('Обработка запущена. Обновите страницу через несколько секунд.');
      loadImports();
    } catch (error) {
      console.error('Failed to retry import:', error);
      alert('Ошибка при повторной обработке');
    }
  };

  const handleDelete = async (importId) => {
    if (!confirm('Удалить этот импорт?')) return;

    try {
      await gmailApi.deleteImport(importId);
      loadImports();
    } catch (error) {
      console.error('Failed to delete import:', error);
      alert('Ошибка при удалении');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('ru-RU');
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Email Импорты</h1>
        <button
          onClick={loadImports}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Обновить
        </button>
      </div>

      {/* Status Filter */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Фильтр по статусу
        </label>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Все</option>
          <option value="PENDING">Ожидание</option>
          <option value="PROCESSING">Обработка</option>
          <option value="SUCCESS">Успешно</option>
          <option value="FAILED">Ошибка</option>
          <option value="MANUAL_REVIEW">Требует проверки</option>
        </select>
      </div>

      {/* Imports Table */}
      {loading ? (
        <div className="text-center py-12">
          <div className="text-gray-500">Загрузка...</div>
        </div>
      ) : imports.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <div className="text-gray-500">Нет импортов</div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">От кого</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Тема</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Результат</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Действия</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {imports.map((imp) => (
                <tr key={imp.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(imp.emailDate)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {imp.emailFrom}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {imp.emailSubject || '(Без темы)'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${STATUS_COLORS[imp.status]}`}>
                      {STATUS_LABELS[imp.status]}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {imp.status === 'SUCCESS' ? (
                      <span className="text-green-600">
                        +{imp.bookingsCreated} / ~{imp.bookingsUpdated}
                      </span>
                    ) : imp.status === 'FAILED' || imp.status === 'MANUAL_REVIEW' ? (
                      <span className="text-red-600">Ошибка</span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <button
                      onClick={() => handleViewDetails(imp.id)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Детали
                    </button>
                    {(imp.status === 'FAILED' || imp.status === 'MANUAL_REVIEW') && (
                      <button
                        onClick={() => handleRetry(imp.id)}
                        className="text-green-600 hover:text-green-900"
                      >
                        Повторить
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(imp.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="px-6 py-4 flex items-center justify-between border-t">
              <div className="text-sm text-gray-700">
                Страница {pagination.page} из {pagination.pages} ({pagination.total} всего)
              </div>
              <div className="space-x-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  Назад
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page === pagination.pages}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  Вперед
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedImport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold">Детали импорта #{selectedImport.id}</h2>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              {/* Basic Info */}
              <div className="space-y-3 mb-6">
                <div>
                  <span className="font-medium">От кого:</span> {selectedImport.emailFrom}
                </div>
                <div>
                  <span className="font-medium">Тема:</span> {selectedImport.emailSubject}
                </div>
                <div>
                  <span className="font-medium">Дата письма:</span> {formatDate(selectedImport.emailDate)}
                </div>
                <div>
                  <span className="font-medium">Статус:</span>{' '}
                  <span className={`px-2 py-1 text-xs font-medium rounded ${STATUS_COLORS[selectedImport.status]}`}>
                    {STATUS_LABELS[selectedImport.status]}
                  </span>
                </div>
                {selectedImport.attachmentName && (
                  <div>
                    <span className="font-medium">Вложение:</span> {selectedImport.attachmentName}
                  </div>
                )}
                {selectedImport.processedAt && (
                  <div>
                    <span className="font-medium">Обработано:</span> {formatDate(selectedImport.processedAt)}
                  </div>
                )}
              </div>

              {/* Results */}
              {selectedImport.status === 'SUCCESS' && (
                <div className="mb-6 p-4 bg-green-50 rounded">
                  <h3 className="font-semibold mb-2">Результаты:</h3>
                  <div>Создано бронирований: {selectedImport.bookingsCreated}</div>
                  <div>Обновлено бронирований: {selectedImport.bookingsUpdated}</div>
                  {selectedImport.bookingIds && (
                    <div>ID бронирований: {selectedImport.bookingIds}</div>
                  )}
                </div>
              )}

              {/* Error Message */}
              {selectedImport.errorMessage && (
                <div className="mb-6 p-4 bg-red-50 rounded">
                  <h3 className="font-semibold mb-2 text-red-800">Ошибка:</h3>
                  <pre className="text-sm text-red-700 whitespace-pre-wrap">{selectedImport.errorMessage}</pre>
                </div>
              )}

              {/* Raw Parsed Data */}
              {selectedImport.rawParsedData && (
                <div className="mb-6">
                  <h3 className="font-semibold mb-2">Распознанные данные (JSON):</h3>
                  <pre className="bg-gray-50 p-4 rounded text-sm overflow-x-auto">
                    {selectedImport.rawParsedData}
                  </pre>
                </div>
              )}

              {/* Attachment Preview */}
              {selectedImport.attachmentUrl && selectedImport.attachmentType?.startsWith('image/') && (
                <div className="mb-6">
                  <h3 className="font-semibold mb-2">Скриншот:</h3>
                  <img
                    src={selectedImport.attachmentUrl.replace('C:\\Users\\Asus\\orient-insight\\server\\', '/')}
                    alt="Screenshot"
                    className="border rounded max-w-full"
                  />
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
