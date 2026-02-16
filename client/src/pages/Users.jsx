import { useState, useEffect } from 'react';
import { usersApi } from '../services/api';
import { useIsMobile } from '../hooks/useMediaQuery';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { Plus, Edit, UserCog, Shield, User, X, Save, Eye, EyeOff } from 'lucide-react';

const roleLabels = {
  ADMIN: 'Администратор',
  MANAGER: 'Менеджер'
};

export default function Users() {
  const isMobile = useIsMobile();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'MANAGER'
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await usersApi.getAll();
      setUsers(response.data.users);
    } catch (error) {
      toast.error('Ошибка загрузки пользователей');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        email: user.email,
        password: '',
        name: user.name,
        role: user.role
      });
    } else {
      setEditingUser(null);
      setFormData({ email: '', password: '', name: '', role: 'MANAGER' });
    }
    setShowPassword(false);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingUser(null);
    setFormData({ email: '', password: '', name: '', role: 'MANAGER' });
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.email.trim()) {
      toast.error('Заполните обязательные поля');
      return;
    }

    if (!editingUser && !formData.password) {
      toast.error('Введите пароль для нового пользователя');
      return;
    }

    try {
      if (editingUser) {
        const updateData = {
          name: formData.name,
          role: formData.role
        };
        if (formData.password) {
          updateData.password = formData.password;
        }
        await usersApi.update(editingUser.id, updateData);
        toast.success('Пользователь обновлён');
      } else {
        await usersApi.create(formData);
        toast.success('Пользователь создан');
      }
      closeModal();
      loadUsers();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Ошибка сохранения');
    }
  };

  const toggleActive = async (user) => {
    try {
      await usersApi.update(user.id, { isActive: !user.isActive });
      toast.success(user.isActive ? 'Пользователь деактивирован' : 'Пользователь активирован');
      loadUsers();
    } catch (error) {
      toast.error('Ошибка обновления');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 p-3 md:p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Пользователи</h1>
          <p className="text-sm md:text-base text-gray-500">Управление доступом к системе</p>
        </div>

        <button
          onClick={() => openModal()}
          className="inline-flex items-center justify-center gap-2 px-4 md:px-5 py-2.5 md:py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm md:text-base font-medium min-h-[44px] w-full sm:w-auto"
        >
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">Добавить пользователя</span>
          <span className="sm:hidden">Добавить</span>
        </button>
      </div>

      {/* Users table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Пользователь
              </th>
              <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Email
              </th>
              <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Роль
              </th>
              <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Статус
              </th>
              <th className="hidden lg:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Создан
              </th>
              <th className="px-3 md:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Действия
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id} className={!user.isActive ? 'bg-gray-50 opacity-60' : ''}>
                <td className="px-3 md:px-6 py-4">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center ${
                      user.role === 'ADMIN' ? 'bg-purple-100' : 'bg-blue-100'
                    }`}>
                      {user.role === 'ADMIN' ? (
                        <Shield className="w-5 h-5 text-purple-600" />
                      ) : (
                        <User className="w-5 h-5 text-blue-600" />
                      )}
                    </div>
                    <span className="font-medium text-sm md:text-base text-gray-900">{user.name}</span>
                  </div>
                </td>
                <td className="px-3 md:px-6 py-4 text-xs md:text-sm text-gray-600 truncate max-w-[150px] md:max-w-none">{user.email}</td>
                <td className="hidden md:table-cell px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    user.role === 'ADMIN'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {roleLabels[user.role]}
                  </span>
                </td>
                <td className="hidden md:table-cell px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    user.isActive
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {user.isActive ? 'Активен' : 'Неактивен'}
                  </span>
                </td>
                <td className="hidden lg:table-cell px-6 py-4 text-sm text-gray-500">
                  {format(new Date(user.createdAt), 'dd.MM.yyyy')}
                </td>
                <td className="px-3 md:px-6 py-4">
                  <div className="flex items-center justify-end gap-1 md:gap-2">
                    <button
                      onClick={() => openModal(user)}
                      className="p-2.5 md:p-1.5 text-gray-400 hover:text-primary-600 rounded min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center"
                      title="Редактировать"
                    >
                      <Edit className="w-5 h-5 md:w-4 md:h-4" />
                    </button>
                    <button
                      onClick={() => toggleActive(user)}
                      className={`p-2.5 md:p-1.5 rounded min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center ${
                        user.isActive
                          ? 'text-gray-400 hover:text-red-600'
                          : 'text-gray-400 hover:text-green-600'
                      }`}
                      title={user.isActive ? 'Деактивировать' : 'Активировать'}
                    >
                      <UserCog className="w-5 h-5 md:w-4 md:h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {users.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            Пользователи не найдены
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 md:p-4">
          <div className="bg-white rounded-lg md:rounded-xl shadow-xl w-full max-w-full md:max-w-md">
            <div className="flex items-center justify-between p-3 md:p-4 border-b border-gray-200">
              <h2 className="text-base md:text-lg font-semibold text-gray-900">
                {editingUser ? 'Редактировать пользователя' : 'Новый пользователь'}
              </h2>
              <button onClick={closeModal} className="p-2 md:p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 md:p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Имя *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-3 md:py-2 text-base md:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="Иван Иванов"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={!!editingUser}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
                  placeholder="user@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Пароль {!editingUser && '*'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 pr-10"
                    placeholder={editingUser ? 'Оставьте пустым, чтобы не менять' : 'Введите пароль'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Роль
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="MANAGER">Менеджер</option>
                  <option value="ADMIN">Администратор</option>
                </select>
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
