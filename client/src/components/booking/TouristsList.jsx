import { useState, useEffect } from 'react';
import { touristsApi } from '../../services/api';
import toast from 'react-hot-toast';
import {
  Plus, Edit, Trash2, Upload, Users, Crown, User,
  X, Save, Search, Download, FileSpreadsheet, FileText,
  AlertCircle, Check, ChevronDown
} from 'lucide-react';
import { useIsMobile } from '../../hooks/useMediaQuery';

export default function TouristsList({ bookingId, onUpdate }) {
  const [tourists, setTourists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const isMobile = useIsMobile();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTourist, setEditingTourist] = useState(null);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    gender: '',
    country: '',
    passportNumber: '',
    dateOfBirth: '',
    passportExpiryDate: '',
    roomPreference: '',
    accommodation: '',
    remarks: '',
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
    loadTourists();
  }, [bookingId]);

  const loadTourists = async () => {
    try {
      setLoading(true);
      const response = await touristsApi.getAll(bookingId);
      setTourists(response.data.tourists || []);
    } catch (error) {
      toast.error('Error loading tourists');
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
    // Use UTC methods to avoid timezone issues
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}.${month}.${year}`;
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

  const openModal = (tourist = null) => {
    if (tourist) {
      setEditingTourist(tourist);
      setForm({
        firstName: tourist.firstName || '',
        lastName: tourist.lastName || '',
        gender: tourist.gender || '',
        country: tourist.country || '',
        passportNumber: tourist.passportNumber || '',
        dateOfBirth: formatDate(tourist.dateOfBirth),
        passportExpiryDate: formatDate(tourist.passportExpiryDate),
        roomPreference: tourist.roomPreference || '',
        accommodation: tourist.accommodation || '',
        remarks: tourist.remarks || '',
        isGroupLeader: tourist.isGroupLeader || false,
        notes: tourist.notes || ''
      });
    } else {
      setEditingTourist(null);
      setForm({
        firstName: '',
        lastName: '',
        gender: '',
        country: '',
        passportNumber: '',
        dateOfBirth: '',
        passportExpiryDate: '',
        roomPreference: '',
        accommodation: '',
        remarks: '',
        isGroupLeader: false,
        notes: ''
      });
    }
    setModalOpen(true);
  };

  const saveTourist = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error('Enter first and last name');
      return;
    }

    try {
      const data = {
        ...form,
        dateOfBirth: form.dateOfBirth || null,
        passportExpiryDate: form.passportExpiryDate || null
      };

      if (editingTourist) {
        await touristsApi.update(bookingId, editingTourist.id, data);
        toast.success('Tourist updated');
      } else {
        await touristsApi.create(bookingId, data);
        toast.success('Tourist added');
      }
      setModalOpen(false);
      loadTourists();
      onUpdate?.();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error saving');
    }
  };

  const deleteTourist = async (tourist) => {
    if (!confirm(`Delete tourist "${tourist.fullName || tourist.lastName}"?`)) return;

    try {
      await touristsApi.delete(bookingId, tourist.id);
      toast.success('Tourist deleted');
      loadTourists();
      onUpdate?.();
    } catch (error) {
      toast.error('Error deleting');
    }
  };

  // Import handlers - supports multiple Excel + PDF files
  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setImporting(true);
    try {
      const response = await touristsApi.importPreview(bookingId, files);
      setImportPreview(response.data);
      setImportData(response.data.tourists.map(p => ({ ...p })));
      setImportModalOpen(true);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error reading files');
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
      toast.error('Select at least one tourist');
      return;
    }

    setImporting(true);
    try {
      const response = await touristsApi.import(bookingId, selected, { replaceAll: true });
      toast.success(response.data.message);
      setImportModalOpen(false);
      setImportPreview(null);
      setImportData([]);
      loadTourists();
      onUpdate?.();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Import error');
    } finally {
      setImporting(false);
    }
  };

  // Export handlers
  const handleExport = async (format) => {
    setExportMenuOpen(false);
    try {
      const blob = format === 'excel'
        ? await touristsApi.exportExcel(bookingId)
        : await touristsApi.exportPdf(bookingId);

      const url = window.URL.createObjectURL(new Blob([blob.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `tourists.${format === 'excel' ? 'xlsx' : 'pdf'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Export error');
    }
  };

  // Filter tourists
  const filteredTourists = tourists.filter(p => {
    const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase());
  });

  const roomPreferenceOptions = ['DBL', 'TWN', 'SNGL', 'TRPL', 'Suite'];
  const countryOptions = ['Germany', 'Austria', 'Switzerland', 'France', 'Netherlands', 'Belgium', 'Italy', 'Spain', 'United Kingdom', 'United States'];
  const accommodationOptions = ['Uzbekistan', 'Turkmenistan', 'Kyrgyzstan', 'Tajikistan', 'Kazakhstan'];

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
            Tourists ({tourists.length})
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {/* Export dropdown */}
          {tourists.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setExportMenuOpen(!exportMenuOpen)}
                className="inline-flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
              >
                <Download className="w-4 h-4" />
                Export
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

          {/* Import button - supports multiple Excel files only */}
          <label className="inline-flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer text-sm">
            <Upload className="w-4 h-4" />
            {importing ? 'Loading...' : 'Import Excel'}
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
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
            Add
          </button>
        </div>
      </div>

      {/* Search */}
      {tourists.length > 5 && (
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
          />
        </div>
      )}

      {/* Card-style List */}
      {filteredTourists.length > 0 ? (
        <div className="space-y-4">
          {/* Header */}
          <div className="bg-gradient-to-br from-gray-100 via-gray-50 to-white rounded-2xl border-2 border-gray-300 p-5 shadow-lg hidden md:block">
            <div className="grid grid-cols-12 gap-3 items-center text-xs font-bold text-gray-600 uppercase">
              <div className="col-span-1">No</div>
              <div className="col-span-3">Name</div>
              <div className="col-span-1">Gender</div>
              <div className="col-span-2">Nationality</div>
              <div className="col-span-2">Passport</div>
              <div className="col-span-1">Birth</div>
              <div className="col-span-1">Pass. Exp.</div>
              <div className="col-span-1 text-right">Actions</div>
            </div>
          </div>

          {/* Tourist Cards */}
          {filteredTourists.map((p, index) => (
            isMobile ? (
              /* MOBILE: Vertical stacked layout */
              <div
                key={p.id}
                className="bg-gradient-to-br from-white to-gray-50 rounded-2xl border-2 shadow-md p-4 space-y-3"
              >
                {/* Header: Number + Name + Leader Icon */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 border-2 border-gray-300 flex items-center justify-center shadow-sm flex-shrink-0">
                    <span className="text-sm font-bold text-gray-700">{index + 1}</span>
                  </div>
                  {p.isGroupLeader && (
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-100 to-yellow-200 border-2 border-yellow-300 flex items-center justify-center flex-shrink-0">
                      <Crown className="w-4 h-4 text-yellow-600" />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 text-sm">
                      {p.fullName || `${p.lastName}, ${p.firstName}`}
                    </div>
                  </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">Gender:</span>
                    <span className="ml-1 text-gray-900">{p.gender === 'M' ? 'M' : p.gender === 'F' ? 'F' : '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Country:</span>
                    <span className="ml-1 text-gray-900">{p.country && p.country !== 'Not provided' ? p.country : '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Passport:</span>
                    <span className="ml-1 text-gray-900">{p.passportNumber && p.passportNumber !== 'Not provided' ? p.passportNumber : '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Birth:</span>
                    <span className="ml-1 text-gray-900">{formatDisplayDate(p.dateOfBirth)}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Pass. Exp:</span>
                    <span className={`ml-1 ${
                      isPassportExpired(p.passportExpiryDate)
                        ? 'text-red-600 font-semibold'
                        : isPassportExpiringSoon(p.passportExpiryDate)
                        ? 'text-orange-500 font-medium'
                        : 'text-gray-900'
                    }`}>
                      {formatDisplayDate(p.passportExpiryDate)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t border-gray-200">
                  <button
                    onClick={() => openModal(p)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-xl transition-all text-sm font-medium"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => deleteTourist(p)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-all text-sm font-medium"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            ) : (
              /* DESKTOP: 12-column grid layout */
              <div
                key={p.id}
                className="bg-gradient-to-br from-white to-gray-50 rounded-2xl border-2 shadow-md hover:shadow-xl hover:scale-[1.01] transition-all duration-300 p-4"
              >
                <div className="grid grid-cols-12 gap-3 items-center text-sm">
                  {/* Number */}
                  <div className="col-span-1">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 border-2 border-gray-300 flex items-center justify-center shadow-sm">
                      <span className="text-base font-bold text-gray-700">{index + 1}</span>
                    </div>
                  </div>

                  {/* Name */}
                  <div className="col-span-3">
                    <div className="flex items-center gap-3">
                      {p.isGroupLeader ? (
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-100 to-yellow-200 border-2 border-yellow-300 flex items-center justify-center flex-shrink-0 shadow-sm">
                          <Crown className="w-5 h-5 text-yellow-600" title="Group leader" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 border-2 border-blue-300 flex items-center justify-center flex-shrink-0 shadow-sm">
                          <User className="w-5 h-5 text-blue-700" />
                        </div>
                      )}
                      <span className="font-semibold text-gray-900 text-sm">
                        {p.fullName || `${p.lastName}, ${p.firstName}`}
                      </span>
                    </div>
                  </div>

                  {/* Gender */}
                  <div className="col-span-1 text-gray-600">
                    {p.gender === 'M' ? 'M' : p.gender === 'F' ? 'F' : '-'}
                  </div>

                  {/* Nationality */}
                  <div className="col-span-2 text-gray-600 text-sm">
                    {p.country && p.country !== 'Not provided' ? p.country : '-'}
                  </div>

                  {/* Passport */}
                  <div className="col-span-2 text-gray-600 text-sm">
                    {p.passportNumber && p.passportNumber !== 'Not provided' ? p.passportNumber : '-'}
                  </div>

                  {/* Birth */}
                  <div className="col-span-1 text-gray-600 text-xs">
                    {formatDisplayDate(p.dateOfBirth)}
                  </div>

                  {/* Passport Expiry */}
                  <div className="col-span-1 text-xs">
                    <span className={
                      isPassportExpired(p.passportExpiryDate)
                        ? 'text-red-600 font-semibold'
                        : isPassportExpiringSoon(p.passportExpiryDate)
                        ? 'text-orange-500 font-medium'
                        : 'text-gray-600'
                    }>
                      {formatDisplayDate(p.passportExpiryDate)}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="col-span-1">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openModal(p)}
                        className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-xl hover:scale-110 transition-all duration-200"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteTourist(p)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl hover:scale-110 transition-all duration-200"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-gradient-to-b from-gray-50 to-white rounded-xl border-2 border-dashed border-gray-200">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">
            {searchQuery ? 'No tourists found' : 'No tourists. Add or import from Excel/PDF.'}
          </p>
        </div>
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingTourist ? 'Edit Tourist' : 'New Tourist'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="Peter"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                  <select
                    value={form.gender}
                    onChange={(e) => setForm({ ...form, gender: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Not specified</option>
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nationality</label>
                  <select
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Not specified</option>
                    {countryOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Room Type</label>
                  <select
                    value={form.roomPreference}
                    onChange={(e) => setForm({ ...form, roomPreference: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Not specified</option>
                    {roomPreferenceOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Placement</label>
                  <select
                    value={form.accommodation}
                    onChange={(e) => setForm({ ...form, accommodation: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Not specified</option>
                    {accommodationOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Passport Number</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Passport Expiry</label>
                  <input
                    type="date"
                    value={form.passportExpiryDate}
                    onChange={(e) => setForm({ ...form, passportExpiryDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                <textarea
                  value={form.remarks}
                  onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  rows={2}
                  placeholder="Additional notes about tourist"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Internal Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  rows={2}
                  placeholder="Internal notes (not exported)"
                />
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.isGroupLeader}
                  onChange={(e) => setForm({ ...form, isGroupLeader: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Group Leader</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={saveTourist}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                <Save className="w-4 h-4" />
                Save
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
                  Import Tourists {importPreview.fileCount > 1 ? `(${importPreview.fileCount} files)` : ''}
                </h2>
                <p className="text-sm text-gray-500">
                  To import: {importData.filter(p => p.selected).length} tourists
                  {importPreview.mergedCount > 0 && (
                    <span className="ml-2 text-blue-600">
                      ({importPreview.mergedCount} merged from Excel + PDF)
                    </span>
                  )}
                </p>
                {/* Warning about replace mode */}
                {importPreview.existingCount > 0 && (
                  <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                    <span className="text-sm text-orange-700">
                      <strong>Replace mode:</strong> {importPreview.existingCount} existing tourists will be deleted and replaced
                    </span>
                  </div>
                )}
                {/* File summary */}
                {importPreview.files && importPreview.files.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {importPreview.files.map((f, idx) => (
                      <span key={idx} className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                        f.type === 'pdf' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
                      }`}>
                        {f.type === 'pdf' ? <FileText className="w-3 h-3" /> : <FileSpreadsheet className="w-3 h-3" />}
                        {f.filename.length > 30 ? f.filename.substring(0, 30) + '...' : f.filename}
                        <span className="opacity-70">({f.count})</span>
                        {f.purpose && <span className="font-medium">- {f.purpose}</span>}
                        {f.tripType && <span className="font-medium">- {f.tripType}</span>}
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
                  <tr className="border-b border-gray-200 text-left text-gray-500 text-xs">
                    <th className="py-2 pr-1 w-8">
                      <input
                        type="checkbox"
                        checked={importData.every(p => p.selected)}
                        onChange={(e) => setImportData(prev => prev.map(p => ({ ...p, selected: e.target.checked })))}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="py-2 pr-1">First Name</th>
                    <th className="py-2 pr-1">Last Name</th>
                    <th className="py-2 pr-1">Gender</th>
                    <th className="py-2 pr-1">Nationality</th>
                    <th className="py-2 pr-1">Passport</th>
                    <th className="py-2 pr-1">Birth</th>
                    <th className="py-2 pr-1">Pass. exp.</th>
                    <th className="py-2 pr-1">Room</th>
                    <th className="py-2 pr-1">Placement</th>
                    <th className="py-2 pr-1">Remarks</th>
                    <th className="py-2">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {importData.map((p) => (
                    <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50 text-xs">
                      <td className="py-1 pr-1">
                        <input
                          type="checkbox"
                          checked={p.selected}
                          onChange={() => toggleImportRow(p.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="py-1 pr-1">
                        <input
                          type="text"
                          value={p.firstName || ''}
                          onChange={(e) => updateImportCell(p.id, 'firstName', e.target.value)}
                          className="w-full px-1 py-0.5 border border-gray-200 rounded text-xs"
                        />
                      </td>
                      <td className="py-1 pr-1">
                        <input
                          type="text"
                          value={p.lastName || ''}
                          onChange={(e) => updateImportCell(p.id, 'lastName', e.target.value)}
                          className="w-full px-1 py-0.5 border border-gray-200 rounded text-xs"
                        />
                      </td>
                      <td className="py-1 pr-1">
                        <select
                          value={p.gender || ''}
                          onChange={(e) => updateImportCell(p.id, 'gender', e.target.value)}
                          className="w-full px-1 py-0.5 border border-gray-200 rounded text-xs"
                        >
                          <option value="">-</option>
                          <option value="M">M</option>
                          <option value="F">F</option>
                        </select>
                      </td>
                      <td className="py-1 pr-1">
                        <select
                          value={p.country || ''}
                          onChange={(e) => updateImportCell(p.id, 'country', e.target.value)}
                          className="w-full px-1 py-0.5 border border-gray-200 rounded text-xs"
                        >
                          <option value="">-</option>
                          {countryOptions.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-1 pr-1">
                        <input
                          type="text"
                          value={p.passportNumber || ''}
                          onChange={(e) => updateImportCell(p.id, 'passportNumber', e.target.value)}
                          className="w-full px-1 py-0.5 border border-gray-200 rounded text-xs"
                        />
                      </td>
                      <td className="py-1 pr-1">
                        <input
                          type="date"
                          value={formatDate(p.dateOfBirth)}
                          onChange={(e) => updateImportCell(p.id, 'dateOfBirth', e.target.value)}
                          className="w-full px-1 py-0.5 border border-gray-200 rounded text-xs"
                        />
                      </td>
                      <td className="py-1 pr-1">
                        <input
                          type="date"
                          value={formatDate(p.passportExpiryDate)}
                          onChange={(e) => updateImportCell(p.id, 'passportExpiryDate', e.target.value)}
                          className="w-full px-1 py-0.5 border border-gray-200 rounded text-xs"
                        />
                      </td>
                      <td className="py-1 pr-1">
                        <select
                          value={p.roomPreference || ''}
                          onChange={(e) => updateImportCell(p.id, 'roomPreference', e.target.value)}
                          className="w-full px-1 py-0.5 border border-gray-200 rounded text-xs"
                        >
                          <option value="">-</option>
                          {roomPreferenceOptions.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-1 pr-1">
                        <span className={`px-1.5 py-0.5 rounded text-xs ${
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
                      <td className="py-1 pr-1">
                        <input
                          type="text"
                          value={p.remarks || ''}
                          onChange={(e) => updateImportCell(p.id, 'remarks', e.target.value)}
                          className="w-full px-1 py-0.5 border border-gray-200 rounded text-xs"
                          placeholder="-"
                        />
                      </td>
                      <td className="py-1">
                        <span className={`inline-flex items-center gap-1 text-xs ${
                          p.source === 'merged' ? 'text-blue-600' :
                          p.source === 'pdf-only' ? 'text-purple-600' :
                          'text-green-600'
                        }`}>
                          {p.source === 'merged' ? 'Merged' :
                           p.source === 'pdf-only' ? 'PDF' :
                           p.source === 'excel' ? 'Excel' : 'OK'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between p-4 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                Selected for import: {importData.filter(p => p.selected).length} of {importData.length}
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setImportModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={executeImport}
                  disabled={importing || importData.filter(p => p.selected).length === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  {importing ? 'Importing...' : 'Import'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
