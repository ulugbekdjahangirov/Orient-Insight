import { useState, useEffect } from 'react';
import { participantsApi } from '../../services/api';
import toast from 'react-hot-toast';
import {
  Plus, Edit, Trash2, Upload, Users, Crown, User,
  X, Save, Search, Download, FileSpreadsheet, FileText,
  AlertCircle, Check, ChevronDown
} from 'lucide-react';

export default function ParticipantsList({ bookingId, onUpdate }) {
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState(null);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    gender: '',
    passportNumber: '',
    dateOfBirth: '',
    passportExpiryDate: '',
    roomPreference: '',
    isGroupLeader: false,
    notes: ''
  });

  // Import state
  const [importing, setImporting] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [importData, setImportData] = useState([]);

  // Export dropdown state
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  useEffect(() => {
    loadParticipants();
  }, [bookingId]);

  const loadParticipants = async () => {
    try {
      setLoading(true);
      const response = await participantsApi.getAll(bookingId);
      setParticipants(response.data.participants || []);
    } catch (error) {
      toast.error('Ошибка загрузки участников');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  };

  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('ru-RU');
  };

  const isPassportExpired = (dateStr) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    return date < new Date();
  };

  const isPassportExpiringSoon = (dateStr) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const sixMonths = new Date();
    sixMonths.setMonth(sixMonths.getMonth() + 6);
    return date < sixMonths && date >= new Date();
  };

  const openModal = (participant = null) => {
    if (participant) {
      setEditingParticipant(participant);
      setForm({
        firstName: participant.firstName || '',
        lastName: participant.lastName || '',
        gender: participant.gender || '',
        passportNumber: participant.passportNumber || '',
        dateOfBirth: formatDate(participant.dateOfBirth),
        passportExpiryDate: formatDate(participant.passportExpiryDate),
        roomPreference: participant.roomPreference || '',
        isGroupLeader: participant.isGroupLeader || false,
        notes: participant.notes || ''
      });
    } else {
      setEditingParticipant(null);
      setForm({
        firstName: '',
        lastName: '',
        gender: '',
        passportNumber: '',
        dateOfBirth: '',
        passportExpiryDate: '',
        roomPreference: '',
        isGroupLeader: false,
        notes: ''
      });
    }
    setModalOpen(true);
  };

  const saveParticipant = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error('Введите имя и фамилию');
      return;
    }

    try {
      const data = {
        ...form,
        dateOfBirth: form.dateOfBirth || null,
        passportExpiryDate: form.passportExpiryDate || null
      };

      if (editingParticipant) {
        await participantsApi.update(bookingId, editingParticipant.id, data);
        toast.success('Участник обновлён');
      } else {
        await participantsApi.create(bookingId, data);
        toast.success('Участник добавлен');
      }
      setModalOpen(false);
      loadParticipants();
      onUpdate?.();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Ошибка сохранения');
    }
  };

  const deleteParticipant = async (participant) => {
    if (!confirm(`Удалить участника "${participant.fullName || participant.lastName}"?`)) return;

    try {
      await participantsApi.delete(bookingId, participant.id);
      toast.success('Участник удалён');
      loadParticipants();
      onUpdate?.();
    } catch (error) {
      toast.error('Ошибка удаления');
    }
  };

  // Import handlers - supports multiple files
  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setImporting(true);
    try {
      const response = await participantsApi.importPreview(bookingId, files);
      setImportPreview(response.data);
      setImportData(response.data.participants.map(p => ({ ...p })));
      setImportModalOpen(true);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Ошибка чтения файлов');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const toggleImportRow = (id) => {
    setImportData(prev => prev.map(p =>
      p.id === id ? { ...p, selected: !p.selected } : p
    ));
  };

  const updateImportCell = (id, field, value) => {
    setImportData(prev => prev.map(p =>
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  const executeImport = async () => {
    const selected = importData.filter(p => p.selected);
    if (selected.length === 0) {
      toast.error('Выберите хотя бы одного участника');
      return;
    }

    setImporting(true);
    try {
      const response = await participantsApi.import(bookingId, selected);
      toast.success(response.data.message);
      setImportModalOpen(false);
      setImportPreview(null);
      setImportData([]);
      loadParticipants();
      onUpdate?.();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Ошибка импорта');
    } finally {
      setImporting(false);
    }
  };

  // Export handlers
  const handleExport = async (format) => {
    setExportMenuOpen(false);
    try {
      const blob = format === 'excel'
        ? await participantsApi.exportExcel(bookingId)
        : await participantsApi.exportPdf(bookingId);

      const url = window.URL.createObjectURL(new Blob([blob.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `participants.${format === 'excel' ? 'xlsx' : 'pdf'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Ошибка экспорта');
    }
  };

  // Filter participants
  const filteredParticipants = participants.filter(p => {
    const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase());
  });

  const roomPreferenceOptions = ['DBL', 'TWN', 'SNGL', 'TRPL', 'Suite'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-primary-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            Участники тура ({participants.length})
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {/* Export dropdown */}
          {participants.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setExportMenuOpen(!exportMenuOpen)}
                className="inline-flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
              >
                <Download className="w-4 h-4" />
                Экспорт
                <ChevronDown className="w-3 h-3" />
              </button>
              {exportMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setExportMenuOpen(false)} />
                  <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                    <button
                      onClick={() => handleExport('excel')}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-green-600" />
                      Excel (.xlsx)
                    </button>
                    <button
                      onClick={() => handleExport('pdf')}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <FileText className="w-4 h-4 text-red-600" />
                      PDF
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Import button - supports multiple files */}
          <label className="inline-flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer text-sm">
            <Upload className="w-4 h-4" />
            {importing ? 'Загрузка...' : 'Импорт'}
            <input
              type="file"
              accept=".xlsx,.xls,.csv,.pdf"
              onChange={handleFileSelect}
              className="hidden"
              disabled={importing}
              multiple
            />
          </label>

          {/* Add button */}
          <button
            onClick={() => openModal()}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
          >
            <Plus className="w-4 h-4" />
            Добавить
          </button>
        </div>
      </div>

      {/* Search */}
      {participants.length > 5 && (
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск по имени..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
          />
        </div>
      )}

      {/* Table */}
      {filteredParticipants.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="py-2 pr-4">Имя</th>
                <th className="py-2 pr-4">Пол</th>
                <th className="py-2 pr-4">Паспорт</th>
                <th className="py-2 pr-4">Дата рожд.</th>
                <th className="py-2 pr-4">Срок пасп.</th>
                <th className="py-2 pr-4">Номер</th>
                <th className="py-2 pr-4">Размещение</th>
                <th className="py-2 text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredParticipants.map((p, index) => (
                <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      {p.isGroupLeader ? (
                        <Crown className="w-4 h-4 text-yellow-500" title="Лидер группы" />
                      ) : (
                        <User className="w-4 h-4 text-gray-400" />
                      )}
                      <span className="font-medium text-gray-900">
                        {p.fullName || `${p.lastName}, ${p.firstName}`}
                      </span>
                    </div>
                  </td>
                  <td className="py-2 pr-4 text-gray-500">
                    {p.gender === 'M' ? 'Муж.' : p.gender === 'F' ? 'Жен.' : '-'}
                  </td>
                  <td className="py-2 pr-4 text-gray-500">
                    {p.passportNumber || '-'}
                  </td>
                  <td className="py-2 pr-4 text-gray-500">
                    {formatDisplayDate(p.dateOfBirth)}
                  </td>
                  <td className="py-2 pr-4">
                    <span className={
                      isPassportExpired(p.passportExpiryDate)
                        ? 'text-red-600 font-medium'
                        : isPassportExpiringSoon(p.passportExpiryDate)
                        ? 'text-orange-500'
                        : 'text-gray-500'
                    }>
                      {formatDisplayDate(p.passportExpiryDate)}
                    </span>
                  </td>
                  <td className="py-2 pr-4">
                    {p.roomPreference && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                        {p.roomPreference}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    {p.accommodation && p.accommodation !== 'Not assigned' ? (
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        p.accommodation === 'Turkmenistan' ? 'bg-purple-100 text-purple-700' :
                        p.accommodation === 'Uzbekistan' ? 'bg-green-100 text-green-700' :
                        p.accommodation === 'Kyrgyzstan' ? 'bg-blue-100 text-blue-700' :
                        p.accommodation === 'Tajikistan' ? 'bg-orange-100 text-orange-700' :
                        p.accommodation === 'Kazakhstan' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {p.accommodation}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">-</span>
                    )}
                  </td>
                  <td className="py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openModal(p)}
                        className="p-1 text-gray-400 hover:text-primary-600 rounded"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteParticipant(p)}
                        className="p-1 text-gray-400 hover:text-red-600 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          {searchQuery ? 'Участники не найдены' : 'Нет участников. Добавьте или импортируйте из Excel/PDF.'}
        </div>
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingParticipant ? 'Редактировать участника' : 'Новый участник'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Имя *</label>
                  <input
                    type="text"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="Peter"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Фамилия *</label>
                  <input
                    type="text"
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="Frenkler"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Пол</label>
                  <select
                    value={form.gender}
                    onChange={(e) => setForm({ ...form, gender: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Не указан</option>
                    <option value="M">Мужской</option>
                    <option value="F">Женский</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Тип номера</label>
                  <select
                    value={form.roomPreference}
                    onChange={(e) => setForm({ ...form, roomPreference: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Не указан</option>
                    {roomPreferenceOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Номер паспорта</label>
                <input
                  type="text"
                  value={form.passportNumber}
                  onChange={(e) => setForm({ ...form, passportNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="XX1234567"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Дата рождения</label>
                  <input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Срок паспорта</label>
                  <input
                    type="date"
                    value={form.passportExpiryDate}
                    onChange={(e) => setForm({ ...form, passportExpiryDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Примечания</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  rows={2}
                />
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.isGroupLeader}
                  onChange={(e) => setForm({ ...form, isGroupLeader: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Лидер группы</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                onClick={saveParticipant}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                <Save className="w-4 h-4" />
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Preview Modal */}
      {importModalOpen && importPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Импорт участников {importPreview.fileCount > 1 ? `(${importPreview.fileCount} файлов)` : ''}
                </h2>
                <p className="text-sm text-gray-500">
                  К импорту: {importData.filter(p => p.selected).length} участников
                </p>
                {/* Warning about replace mode */}
                {importPreview.existingCount > 0 && (
                  <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                    <span className="text-sm text-orange-700">
                      <strong>Режим замены:</strong> {importPreview.existingCount} существующих участников будут удалены и заменены новыми данными
                    </span>
                  </div>
                )}
                {/* File summary */}
                {importPreview.files && importPreview.files.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {importPreview.files.map((f, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                        <FileSpreadsheet className="w-3 h-3" />
                        {f.filename.length > 30 ? f.filename.substring(0, 30) + '...' : f.filename}
                        <span className="text-blue-500">({f.count} чел.)</span>
                        {f.tripType && <span className="font-medium">→ {f.tripType}</span>}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => setImportModalOpen(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="py-2 pr-2 w-10">
                      <input
                        type="checkbox"
                        checked={importData.every(p => p.selected)}
                        onChange={(e) => setImportData(prev => prev.map(p => ({ ...p, selected: e.target.checked })))}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="py-2 pr-2">Имя</th>
                    <th className="py-2 pr-2">Фамилия</th>
                    <th className="py-2 pr-2">Пол</th>
                    <th className="py-2 pr-2">Паспорт</th>
                    <th className="py-2 pr-2">Дата рожд.</th>
                    <th className="py-2 pr-2">Срок пасп.</th>
                    <th className="py-2 pr-2">Номер</th>
                    <th className="py-2 pr-2">Размещение</th>
                    <th className="py-2">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {importData.map((p) => (
                    <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 pr-2">
                        <input
                          type="checkbox"
                          checked={p.selected}
                          onChange={() => toggleImportRow(p.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="text"
                          value={p.firstName || ''}
                          onChange={(e) => updateImportCell(p.id, 'firstName', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-200 rounded text-sm"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="text"
                          value={p.lastName || ''}
                          onChange={(e) => updateImportCell(p.id, 'lastName', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-200 rounded text-sm"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <select
                          value={p.gender || ''}
                          onChange={(e) => updateImportCell(p.id, 'gender', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-200 rounded text-sm"
                        >
                          <option value="">-</option>
                          <option value="M">М</option>
                          <option value="F">Ж</option>
                        </select>
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="text"
                          value={p.passportNumber || ''}
                          onChange={(e) => updateImportCell(p.id, 'passportNumber', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-200 rounded text-sm"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="date"
                          value={formatDate(p.dateOfBirth)}
                          onChange={(e) => updateImportCell(p.id, 'dateOfBirth', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-200 rounded text-sm"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="date"
                          value={formatDate(p.passportExpiryDate)}
                          onChange={(e) => updateImportCell(p.id, 'passportExpiryDate', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-200 rounded text-sm"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <select
                          value={p.roomPreference || ''}
                          onChange={(e) => updateImportCell(p.id, 'roomPreference', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-200 rounded text-sm"
                        >
                          <option value="">-</option>
                          {roomPreferenceOptions.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          p.tripType === 'Turkmenistan' ? 'bg-purple-100 text-purple-700' :
                          p.tripType === 'Uzbekistan' ? 'bg-green-100 text-green-700' :
                          p.tripType === 'Kyrgyzstan' ? 'bg-blue-100 text-blue-700' :
                          p.tripType === 'Tajikistan' ? 'bg-orange-100 text-orange-700' :
                          p.tripType === 'Kazakhstan' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {p.tripType || '-'}
                        </span>
                      </td>
                      <td className="py-2">
                        <span className="inline-flex items-center gap-1 text-xs text-green-600">
                          <Check className="w-3 h-3" />
                          OK
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between p-4 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                Выбрано для импорта: {importData.filter(p => p.selected).length} из {importData.length}
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setImportModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Отмена
                </button>
                <button
                  onClick={executeImport}
                  disabled={importing || importData.filter(p => p.selected).length === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  {importing ? 'Импорт...' : 'Импортировать'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
