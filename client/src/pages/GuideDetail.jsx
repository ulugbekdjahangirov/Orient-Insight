import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { guidesApi } from '../services/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  User,
  DollarSign,
  Briefcase,
  Edit,
  Save,
  X,
  Shield
} from 'lucide-react';

// Import components for tabs
import GuideInformation from '../components/guide/GuideInformation';
import GuidePayments from '../components/guide/GuidePayments';
import GuideTours from '../components/guide/GuideTours';

export default function GuideDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [guide, setGuide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  // Tab management with localStorage persistence
  const getInitialTab = () => {
    try {
      const saved = localStorage.getItem(`guideDetail_${id}_activeTab`);
      return saved || 'information';
    } catch {
      return 'information';
    }
  };

  const [activeTabState, setActiveTabState] = useState(getInitialTab());

  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    try {
      localStorage.setItem(`guideDetail_${id}_activeTab`, tab);
    } catch (e) {
      console.error('Failed to save tab preference:', e);
    }
  };

  useEffect(() => {
    loadGuide();
  }, [id]);

  const loadGuide = async () => {
    try {
      setLoading(true);
      const response = await guidesApi.getById(id);
      setGuide(response.data);
    } catch (error) {
      console.error('Error loading guide:', error);
      toast.error('Ошибка при загрузке данных гида');
      navigate('/guides');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (updatedData) => {
    try {
      await guidesApi.update(id, updatedData);
      toast.success('Данные гида успешно обновлены');
      loadGuide();
      setEditing(false);
    } catch (error) {
      console.error('Error updating guide:', error);
      toast.error('Ошибка при обновлении данных гида');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!guide) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <User className="w-16 h-16 mb-4" />
        <p>Гид не найден</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/guides')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{guide.name}</h1>
              <div className="flex items-center gap-3 mt-1">
                {guide.firstName && guide.lastName && (
                  <span className="text-sm text-gray-600">
                    {guide.firstName} {guide.lastName}
                  </span>
                )}
                <span
                  className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    guide.isActive
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {guide.isActive ? 'Активен' : 'Неактивен'}
                </span>
              </div>
            </div>
          </div>

          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Edit className="w-5 h-5" />
              Редактировать
            </button>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-gradient-to-b from-gray-50 to-white border-b-2 border-gray-200 shadow-sm">
        <nav className="flex space-x-2 overflow-x-auto px-2 py-2">
          {[
            { id: 'information', label: 'Информация', icon: User },
            { id: 'payments', label: 'Выплаты', icon: DollarSign },
            { id: 'tours', label: 'Туры', icon: Briefcase }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-xl transition-all duration-200 whitespace-nowrap ${
                activeTabState === tab.id
                  ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg scale-105'
                  : 'bg-white text-gray-600 hover:text-gray-900 hover:bg-gradient-to-r hover:from-gray-100 hover:to-gray-50 hover:shadow-md border border-gray-200'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTabState === 'information' && (
        <GuideInformation
          guide={guide}
          editing={editing}
          onSave={handleSave}
          onCancel={() => setEditing(false)}
          onUpdate={loadGuide}
        />
      )}

      {activeTabState === 'payments' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <GuidePayments guideId={parseInt(id)} guide={guide} />
        </div>
      )}

      {activeTabState === 'tours' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <GuideTours guideId={parseInt(id)} guide={guide} />
        </div>
      )}
    </div>
  );
}
