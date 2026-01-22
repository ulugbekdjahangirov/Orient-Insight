import { useState } from 'react';
import { importApi } from '../services/api';
import toast from 'react-hot-toast';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Download,
  X,
  Loader
} from 'lucide-react';

export default function Import() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (!selectedFile.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('Выберите Excel файл (.xlsx или .xls)');
      return;
    }

    setFile(selectedFile);
    setPreview(null);
    setResult(null);
    setLoading(true);

    try {
      const response = await importApi.preview(selectedFile);
      setPreview(response.data);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Ошибка чтения файла');
      setFile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!preview?.filePath) return;

    setImporting(true);
    setResult(null);

    try {
      const response = await importApi.execute(preview.filePath);
      setResult(response.data);
      toast.success('Импорт завершён!');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Ошибка импорта');
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await importApi.downloadTemplate();
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'booking-template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      toast.error('Ошибка скачивания шаблона');
    }
  };

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
  };

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Импорт из Excel</h1>
          <p className="text-gray-500">Загрузите Excel файл с бронированиями</p>
        </div>

        <button
          onClick={handleDownloadTemplate}
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <Download className="w-5 h-5" />
          Скачать шаблон
        </button>
      </div>

      {/* Upload area */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {!file ? (
          <label className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-primary-500 hover:bg-primary-50 transition-colors">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Upload className="w-12 h-12 text-gray-400 mb-4" />
            <p className="text-lg font-medium text-gray-700">
              Нажмите для выбора файла
            </p>
            <p className="text-sm text-gray-500 mt-1">
              или перетащите Excel файл сюда
            </p>
            <p className="text-xs text-gray-400 mt-4">
              Поддерживаются форматы .xlsx и .xls
            </p>
          </label>
        ) : (
          <div className="space-y-6 p-4">
            {/* File info */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-10 h-10 text-green-600" />
                <div>
                  <p className="font-medium text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-500">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <button
                onClick={clearFile}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Loading */}
            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader className="w-8 h-8 text-primary-600 animate-spin" />
                <span className="ml-3 text-gray-600">Анализ файла...</span>
              </div>
            )}

            {/* Preview */}
            {preview && !loading && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Найденные листы
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(preview.sheets).map(([sheetName, data]) => (
                    <div
                      key={sheetName}
                      className="p-4 border border-gray-200 rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">{sheetName}</h4>
                        <span className="text-sm text-gray-500">
                          {data.rowCount} записей
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        Колонки: {data.headers.filter(h => h).join(', ')}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Import button */}
                <div className="flex justify-end pt-4 border-t border-gray-200">
                  <button
                    onClick={handleImport}
                    disabled={importing}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {importing ? (
                      <>
                        <Loader className="w-5 h-5 animate-spin" />
                        Импорт...
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5" />
                        Импортировать данные
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Result */}
            {result && (
              <div className="space-y-4 pt-4 border-t border-gray-200">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-6 h-6" />
                  <h3 className="text-lg font-semibold">Импорт завершён</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Tour Types */}
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-600 font-medium">Типы туров</p>
                    <p className="text-2xl font-bold text-blue-700">
                      {result.results.tourTypes.created}
                    </p>
                    <p className="text-xs text-blue-500">
                      создано (существовало: {result.results.tourTypes.existing})
                    </p>
                  </div>

                  {/* Guides */}
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-green-600 font-medium">Гиды</p>
                    <p className="text-2xl font-bold text-green-700">
                      {result.results.guides.created}
                    </p>
                    <p className="text-xs text-green-500">
                      создано (существовало: {result.results.guides.existing})
                    </p>
                  </div>

                  {/* Bookings */}
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <p className="text-sm text-purple-600 font-medium">Бронирования</p>
                    <p className="text-2xl font-bold text-purple-700">
                      {result.results.bookings.created}
                    </p>
                    <p className="text-xs text-purple-500">
                      создано (обновлено: {result.results.bookings.updated})
                    </p>
                  </div>
                </div>

                {/* Errors */}
                {result.results.bookings.errors.length > 0 && (
                  <div className="p-4 bg-red-50 rounded-lg">
                    <div className="flex items-center gap-2 text-red-600 mb-2">
                      <AlertCircle className="w-5 h-5" />
                      <p className="font-medium">
                        Ошибки ({result.results.bookings.errors.length})
                      </p>
                    </div>
                    <ul className="text-sm text-red-600 space-y-1 max-h-32 overflow-y-auto">
                      {result.results.bookings.errors.map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Инструкция по импорту
        </h3>

        <div className="space-y-3 text-sm text-gray-600">
          <p>1. Excel файл должен содержать листы с кодами туров: ER, CO, KAS, ZA</p>
          <p>2. Первая строка каждого листа - заголовки колонок</p>
          <p>3. Обязательные колонки: Name der Reise, Depature/Ankunft, Pax</p>
          <p>4. Даты в формате DD.MM.YYYY</p>
          <p>5. Существующие бронирования будут обновлены по номеру</p>
        </div>
      </div>
    </div>
  );
}
