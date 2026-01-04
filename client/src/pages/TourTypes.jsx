import { useState, useEffect } from 'react';
import { tourTypesApi } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, MapPin, X, Save } from 'lucide-react';

export default function TourTypes() {
  const [tourTypes, setTourTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    color: '#3B82F6'
  });

  useEffect(() => {
    loadTourTypes();
  }, []);

  const loadTourTypes = async () => {
    try {
      const response = await tourTypesApi.getAll(true);
      setTourTypes(response.data.tourTypes);
    } catch (error) {
      toast.error('Ошибка загрузки типов туров');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (type = null) => {
    if (type) {
      setEditingType(type);
      setFormData({
        code: type.code,
        name: type.name,
        description: type.description || '',
        color: type.color || '#3B82F6'
      });
    } else {
      setEditingType(null);
      setFormData({ code: '', name: '', description: '', color: '#3B82F6' });
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingType(null);
    setFormData({ code: '', name: '', description: '', color: '#3B82F6' });
  };

  const handleSave = async () => {
    if (!formData.code.trim() || !formData.name.trim()) {
      toast.error('Заполните обязательные поля');
      return;
    }

    try {
      if (editingType) {
        await tourTypesApi.update(editingType.id, formData);
        toast.success('Тип тура обновлён');
      } else {
        await tourTypesApi.create(formData);
        toast.success('Тип тура добавлен');
      }
      closeModal();
      loadTourTypes();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Ошибка сохранения');
    }
  };

  const handleDelete = async (type) => {
    if (!confirm(`Удалить тип тура ${type.code}?`)) return;

    try {
      await tourTypesApi.delete(type.id);
      toast.success('Тип тура удалён');
      loadTourTypes();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Ошибка удаления');
    }
  };

  const colorOptions = [
    '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6',
    '#EF4444', '#EC4899', '#06B6D4', '#84CC16'
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Типы туров</h1>
          <p className="text-gray-500">Управление категориями туров</p>
        </div>

        <button
          onClick={() => openModal()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Добавить тип
        </button>
      </div>

      {/* Tour types grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {tourTypes.map((type) => (
          <div
            key={type.id}
            className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden ${
              !type.isActive ? 'opacity-60' : ''
            }`}
          >
            <div
              className="h-2"
              style={{ backgroundColor: type.color }}
            />
            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: type.color }}
                  >
                    {type.code}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{type.name}</h3>
                    <p className="text-xs text-gray-500">
                      {type._count?.bookings || 0} бронирований
                    </p>
                  </div>
                </div>
              </div>

              {type.description && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                  {type.description}
                </p>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                <span
                  className={`text-xs font-medium ${
                    type.isActive ? 'text-green-600' : 'text-gray-400'
                  }`}
                >
                  {type.isActive ? 'Активен' : 'Неактивен'}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openModal(type)}
                    className="p-1.5 text-gray-400 hover:text-primary-600 rounded"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(type)}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {tourTypes.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          Типы туров не найдены
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingType ? 'Редактировать тип тура' : 'Новый тип тура'}
              </h2>
              <button onClick={closeModal} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Код *
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="ER"
                  maxLength={10}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Название *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="Тур по Узбекистану"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Описание
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  rows={3}
                  placeholder="Описание типа тура..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Цвет
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-8 h-8 rounded-lg transition-transform ${
                        formData.color === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-8 h-8 rounded cursor-pointer"
                  />
                </div>
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
