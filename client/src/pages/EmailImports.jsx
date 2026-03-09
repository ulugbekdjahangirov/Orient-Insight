import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { gmailApi } from '../services/api';
import { useYear } from '../context/YearContext';

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
  const { selectedYear } = useYear();
  const navigate = useNavigate();
  const [imports, setImports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedImport, setSelectedImport] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    loadImports();
  }, [page, statusFilter, selectedYear]);

  const loadImports = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20, year: selectedYear };
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

  const handleBulkDelete = async () => {
    const filterText = statusFilter
      ? `со статусом "${STATUS_LABELS[statusFilter]}"`
      : 'все';

    const message = `Вы уверены, что хотите удалить ${filterText} импорты?\n\nЭто действие:\n✅ Удалит записи импортов\n✅ Удалит загруженные файлы\n❌ НЕ удалит созданные бронирования\n\nПродолжить?`;

    if (!confirm(message)) return;

    try {
      const params = statusFilter ? { status: statusFilter } : {};
      const response = await gmailApi.bulkDeleteImports(params);
      alert(`Успешно удалено: ${response.data.deletedCount} импорт(ов)`);
      loadImports();
    } catch (error) {
      console.error('Failed to bulk delete imports:', error);
      alert('Ошибка при массовом удалении');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('ru-RU');
  };

  const getFileTypeBadge = (imp) => {
    const name = (imp.attachmentName || '').toLowerCase();
    const type = (imp.attachmentType || '').toLowerCase();
    if (name.endsWith('.pdf') || type.includes('pdf')) {
      return { label: 'PDF', icon: '📄', cls: 'bg-red-100 text-red-700 border border-red-200' };
    }
    if (name.endsWith('.xlsx') || name.endsWith('.xls') || type.includes('excel') || type.includes('spreadsheet')) {
      return { label: 'Excel', icon: '📊', cls: 'bg-green-100 text-green-700 border border-green-200' };
    }
    return { label: 'Email', icon: '📧', cls: 'bg-blue-100 text-blue-700 border border-blue-200' };
  };

  return (
    <div className="max-w-full mx-auto p-3 sm:p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">Email Импорты</h1>
        <div className="flex gap-2">
          <button
            onClick={handleBulkDelete}
            className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700"
          >
            Удалить все
          </button>
          <button
            onClick={loadImports}
            className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >
            Обновить
          </button>
        </div>
      </div>

      {/* Status Filter */}
      <div className="mb-4 sm:mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Фильтр по статусу
        </label>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Все</option>
          <option value="PENDING">Ожидание</option>
          <option value="PROCESSING">Обработка</option>
          <option value="SUCCESS">Успешно</option>
          <option value="FAILED">Ошибка</option>
          <option value="MANUAL_REVIEW">Требует проверки</option>
        </select>
      </div>

      {/* Imports List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="text-gray-500">Загрузка...</div>
        </div>
      ) : imports.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <div className="text-gray-500">Нет импортов</div>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {imports.map((imp) => (
              <div key={imp.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
                {/* Top row: date + status + tour type + file type */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">{formatDate(imp.emailDate)}</span>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {imp.tourTypeCodes && (
                      <span
                        className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-semibold cursor-pointer hover:bg-blue-200 transition-colors"
                        onClick={() => { const id = imp.bookingIds?.split(',')[0]?.trim(); if (id) navigate(`/bookings/${id}`); }}
                      >
                        {imp.tourTypeCodes}
                      </span>
                    )}
                    {(() => { const f = getFileTypeBadge(imp); return (
                      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-semibold ${f.cls}`}>
                        <span>{f.icon}</span>{f.label}
                      </span>
                    ); })()}
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${STATUS_COLORS[imp.status]}`}>
                      {STATUS_LABELS[imp.status]}
                    </span>
                  </div>
                </div>

                {/* From */}
                <p className="text-xs font-medium text-gray-900 truncate mb-0.5">{imp.emailFrom}</p>

                {/* Subject */}
                <p className="text-xs text-gray-500 truncate mb-2">{imp.emailSubject || '(Без темы)'}</p>

                {/* Result / Error */}
                {imp.status === 'SUCCESS' && (
                  <p className="text-xs text-green-600 mb-2">
                    ✓ Создано: +{imp.bookingsCreated} / Обновлено: ~{imp.bookingsUpdated}
                  </p>
                )}
                {(imp.status === 'FAILED' || imp.status === 'MANUAL_REVIEW') && imp.errorMessage && (
                  <p className="text-xs text-red-600 mb-2 line-clamp-2">
                    ⚠️ {imp.errorMessage}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  {imp.status === 'SUCCESS' && (
                    <button
                      onClick={() => handleViewDetails(imp.id)}
                      className="flex-1 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100"
                    >
                      Детали
                    </button>
                  )}
                  {(imp.status === 'FAILED' || imp.status === 'MANUAL_REVIEW' || imp.status === 'SUCCESS') && (
                    <button
                      onClick={() => handleRetry(imp.id)}
                      className="flex-1 py-1.5 text-xs font-medium text-green-600 bg-green-50 rounded hover:bg-green-100"
                    >
                      Повторить
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(imp.id)}
                    className="flex-1 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full table-fixed divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap w-[10%]">Дата</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-[15%]">От кого</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-[12%]">Тема</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap w-[8%]">Статус</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap w-[10%]">Tour Type</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap w-[10%]">Результат</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-[18%]">Сообщение</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap w-[8%]">Fayl turi</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap w-[11%]">Действия</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {imports.map((imp) => (
                  <tr key={imp.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-500 truncate">
                      {formatDate(imp.emailDate)}
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-900 truncate">
                      {imp.emailFrom}
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-900 truncate">
                      {imp.emailSubject || '(Без темы)'}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap truncate">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${STATUS_COLORS[imp.status]}`}>
                        {STATUS_LABELS[imp.status]}
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-xs font-medium text-gray-900 truncate">
                      {imp.tourTypeCodes ? (
                        <span
                          className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold cursor-pointer hover:bg-blue-200 transition-colors"
                          onClick={() => { const id = imp.bookingIds?.split(',')[0]?.trim(); if (id) navigate(`/bookings/${id}`); }}
                          title="Bronni ochish"
                        >
                          {imp.tourTypeCodes}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-500 truncate">
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
                    <td className="px-3 py-3 text-xs truncate">
                      {imp.status === 'SUCCESS' ? (
                        <span className="text-green-600 font-medium">✓</span>
                      ) : imp.status === 'FAILED' || imp.status === 'MANUAL_REVIEW' ? (
                        <span className="text-red-700 text-xs">
                          ⚠️ {imp.errorMessage || 'Неизвестная ошибка'}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {(() => { const f = getFileTypeBadge(imp); return (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${f.cls}`}>
                          <span>{f.icon}</span>{f.label}
                        </span>
                      ); })()}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-right text-xs font-medium space-x-1">
                      {imp.status === 'SUCCESS' && (
                        <>
                          <button
                            onClick={() => handleViewDetails(imp.id)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Детали
                          </button>
                          <button
                            onClick={() => handleRetry(imp.id)}
                            className="text-green-600 hover:text-green-900"
                          >
                            Повторить
                          </button>
                        </>
                      )}
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
          </div>

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="px-4 sm:px-6 py-4 flex items-center justify-between bg-white rounded-lg shadow mt-2 sm:mt-0 sm:rounded-t-none sm:border-t border-gray-200">
              <div className="text-xs sm:text-sm text-gray-700">
                {pagination.page} / {pagination.pages} ({pagination.total})
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="px-3 py-1 border rounded text-sm disabled:opacity-50"
                >
                  ←
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page === pagination.pages}
                  className="px-3 py-1 border rounded text-sm disabled:opacity-50"
                >
                  →
                </button>
              </div>
            </div>
          )}
        </>
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
              {selectedImport.attachmentName && (
                selectedImport.attachmentName.toLowerCase().endsWith('.xlsx') ||
                selectedImport.attachmentName.toLowerCase().endsWith('.xls')
              ) && (
                <div className="mb-6">
                  <h3 className="font-semibold mb-2">Excel файл:</h3>
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded">
                    <span className="text-2xl">📊</span>
                    <span className="text-green-800 font-medium">{selectedImport.attachmentName}</span>
                  </div>
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
