import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { dashboardApi } from '../services/api';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  CalendarDays,
  Users,
  MapPin,
  TrendingUp,
  ArrowRight,
  Clock,
  BarChart3,
  PieChart as PieChartIcon,
  Hotel,
  Wallet,
  DollarSign
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const statusLabels = {
  PENDING: 'Ожидает',
  CONFIRMED: 'Подтверждено',
  IN_PROGRESS: 'В процессе',
  COMPLETED: 'Завершено',
  CANCELLED: 'Отменено'
};

const statusColors = {
  PENDING: '#F59E0B',      // Желтый (Ожидает)
  CONFIRMED: '#10B981',    // Зеленый (Подтверждено)
  IN_PROGRESS: '#8B5CF6',  // Фиолетовый (В процессе)
  COMPLETED: '#3B82F6',    // Синий (Завершено)
  CANCELLED: '#EF4444'     // Красный (Отменено)
};

const statusClasses = {
  PENDING: 'bg-gradient-to-r from-yellow-200 to-amber-300 text-yellow-900 border-2 border-yellow-400',
  CONFIRMED: 'bg-gradient-to-r from-green-200 to-emerald-300 text-green-900 border-2 border-green-400',
  IN_PROGRESS: 'bg-gradient-to-r from-purple-200 to-violet-300 text-purple-900 border-2 border-purple-400',
  COMPLETED: 'bg-gradient-to-r from-blue-200 to-indigo-300 text-blue-900 border-2 border-blue-400',
  CANCELLED: 'bg-gradient-to-r from-red-200 to-rose-300 text-red-900 border-2 border-red-400'
};

// Helper to calculate status based on PAX, departure date, and end date
const calculateStatus = (pax, departureDate, endDate) => {
  const paxCount = parseInt(pax) || 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check if tour has ended
  if (endDate) {
    const tourEndDate = new Date(endDate);
    tourEndDate.setHours(0, 0, 0, 0);
    if (tourEndDate < today) {
      return 'COMPLETED';
    }
  }

  if (departureDate) {
    const daysUntilDeparture = Math.ceil((new Date(departureDate) - today) / (1000 * 60 * 60 * 24));

    if (daysUntilDeparture < 30 && paxCount < 4) {
      return 'CANCELLED';
    }
  }

  if (paxCount >= 6) {
    return 'CONFIRMED';
  } else if (paxCount === 4 || paxCount === 5) {
    return 'IN_PROGRESS';
  } else {
    return 'PENDING';
  }
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, upcomingRes, monthlyRes] = await Promise.all([
        dashboardApi.getStats(),
        dashboardApi.getUpcoming(5),
        dashboardApi.getMonthly(new Date().getFullYear())
      ]);

      setStats(statsRes.data);
      setUpcoming(upcomingRes.data.bookings);
      setMonthly(monthlyRes.data.monthlyStats);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-blue-200"></div>
            <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-blue-600 absolute top-0"></div>
          </div>
          <p className="text-gray-700 font-bold text-lg">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
  const chartData = monthly.map((m, i) => ({
    name: monthNames[i],
    bookings: m.bookings,
    pax: m.pax
  }));

  const pieData = stats?.bookingsByStatus.map(item => ({
    name: statusLabels[item.status],
    value: item._count.status,
    color: statusColors[item.status]
  })) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6 space-y-6">
      {/* Page header */}
      <div className="relative overflow-hidden bg-white rounded-3xl shadow-2xl border-2 border-blue-100 p-8">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-purple-500/10"></div>
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-blue-400/20 to-indigo-400/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-gradient-to-br from-purple-400/20 to-blue-400/20 rounded-full blur-3xl"></div>

        <div className="relative flex items-center gap-6">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 rounded-3xl shadow-lg flex items-center justify-center transform hover:scale-110 transition-all duration-300">
            <TrendingUp className="w-10 h-10 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-black bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
              Dashboard
            </h1>
            <p className="text-gray-600 font-semibold text-base">Activity Overview & Statistics</p>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={CalendarDays}
          label="Всего бронирований"
          value={stats?.overview.totalBookings || 0}
          color="blue"
        />
        <StatCard
          icon={Users}
          label="Всего туристов"
          value={stats?.overview.totalPax || 0}
          color="green"
        />
        <StatCard
          icon={TrendingUp}
          label="Предстоящие"
          value={stats?.overview.upcomingBookings || 0}
          color="purple"
        />
        <StatCard
          icon={MapPin}
          label="Активных гидов"
          value={stats?.overview.guidesCount || 0}
          color="amber"
        />
        <StatCard
          icon={Hotel}
          label="Hotels"
          value={stats?.overview.hotelsCount || 0}
          color="blue"
        />
        <StatCard
          icon={Wallet}
          label="OPEX"
          value={stats?.overview.opexCount || 0}
          color="green"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly chart */}
        <div className="lg:col-span-2 bg-white rounded-3xl shadow-2xl border-2 border-gray-100 p-8 hover:shadow-blue-500/20 transition-all duration-300">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-black text-gray-900">
              Бронирования по месяцам ({new Date().getFullYear()})
            </h2>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="bookings" name="Бронирования" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pax" name="Туристы" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status pie chart */}
        <div className="bg-white rounded-3xl shadow-2xl border-2 border-gray-100 p-8 hover:shadow-purple-500/20 transition-all duration-300">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg">
              <PieChartIcon className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-black text-gray-900">По статусам</h2>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3 mt-6">
            {pieData.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-transparent rounded-xl hover:from-gray-100 transition-all duration-200">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full shadow-md" style={{ backgroundColor: item.color }} />
                  <span className="text-gray-700 font-semibold">{item.name}</span>
                </div>
                <span className="font-bold text-gray-900 px-3 py-1 bg-white rounded-lg shadow-sm">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Upcoming bookings */}
      <div className="bg-white rounded-3xl shadow-2xl border-2 border-gray-100 overflow-hidden">
        <div className="p-8 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-b-2 border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <CalendarDays className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-black text-gray-900">Ближайшие бронирования</h2>
          </div>
          <Link
            to="/bookings"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl shadow-lg hover:shadow-xl hover:from-blue-600 hover:to-indigo-700 hover:-translate-y-1 transition-all duration-300 font-bold text-sm"
          >
            Все бронирования
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>

        {upcoming.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {upcoming.map((booking) => {
              const status = calculateStatus(booking.pax, booking.departureDate, booking.endDate);

              return (
              <Link
                key={booking.id}
                to={`/bookings/${booking.id}`}
                className="flex items-center justify-between p-6 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-300 group"
              >
                <div className="flex items-center gap-5">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-base shadow-lg group-hover:scale-110 transition-all duration-300"
                    style={{ backgroundColor: booking.tourType?.color || '#6B7280' }}
                  >
                    {booking.tourType?.code}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-lg group-hover:text-blue-600 transition-colors">{booking.bookingNumber}</p>
                    <p className="text-sm text-gray-600 font-medium mt-1">
                      {booking.guide?.name || 'Гид не назначен'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-5 text-sm">
                  <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl shadow-md">
                    <Clock className="w-5 h-5 text-blue-500" />
                    <span className="font-semibold text-gray-700">
                      {format(new Date(booking.departureDate), 'd MMM yyyy', { locale: ru })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl shadow-md">
                    <Users className="w-5 h-5 text-green-500" />
                    <span className="font-semibold text-gray-700">{booking.pax} чел.</span>
                  </div>
                  <span className={`inline-flex items-center px-4 py-2 rounded-xl text-sm font-bold shadow-md ${statusClasses[status]}`}>
                    {statusLabels[status]}
                  </span>
                </div>
              </Link>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-indigo-200 rounded-full flex items-center justify-center shadow-lg mb-4">
              <CalendarDays className="w-12 h-12 text-blue-500" />
            </div>
            <p className="text-xl font-bold text-gray-700 mb-2">Нет предстоящих бронирований</p>
            <p className="text-gray-500">Создайте новое бронирование для начала работы</p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  const colorClasses = {
    blue: {
      gradient: 'from-blue-500 to-indigo-600',
      shadow: 'shadow-blue-500/30',
      bg: 'bg-gradient-to-br from-blue-100 to-indigo-100',
      ring: 'ring-blue-200'
    },
    green: {
      gradient: 'from-green-500 to-emerald-600',
      shadow: 'shadow-green-500/30',
      bg: 'bg-gradient-to-br from-green-100 to-emerald-100',
      ring: 'ring-green-200'
    },
    purple: {
      gradient: 'from-purple-500 to-violet-600',
      shadow: 'shadow-purple-500/30',
      bg: 'bg-gradient-to-br from-purple-100 to-violet-100',
      ring: 'ring-purple-200'
    },
    amber: {
      gradient: 'from-amber-500 to-orange-600',
      shadow: 'shadow-amber-500/30',
      bg: 'bg-gradient-to-br from-amber-100 to-orange-100',
      ring: 'ring-amber-200'
    }
  };

  const colors = colorClasses[color];

  return (
    <div className="relative group bg-white rounded-3xl shadow-xl border-2 border-gray-100 p-6 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 overflow-hidden">
      <div className={`absolute inset-0 ${colors.bg} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>

      <div className="relative flex items-center gap-5">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-br ${colors.gradient} shadow-lg ${colors.shadow} transform group-hover:scale-110 transition-all duration-300`}>
          <Icon className="w-8 h-8 text-white" />
        </div>
        <div>
          <p className="text-3xl font-black text-gray-900 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:bg-clip-text group-hover:from-gray-900 group-hover:to-gray-700 transition-all duration-300">{value}</p>
          <p className="text-sm font-semibold text-gray-600 mt-1">{label}</p>
        </div>
      </div>
    </div>
  );
}
