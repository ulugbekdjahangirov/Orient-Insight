import { NavLink } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  MapPin,
  Upload,
  UserCog,
  ChevronLeft,
  ChevronRight,
  Compass,
  Building2,
  Bell
} from 'lucide-react';

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Панель управления' },
  { path: '/updates', icon: Bell, label: 'Updates' },
  { path: '/bookings', icon: CalendarDays, label: 'Бронирования' },
  { path: '/guides', icon: Users, label: 'Гиды' },
  { path: '/tour-types', icon: MapPin, label: 'Типы туров' },
  { path: '/hotels', icon: Building2, label: 'Отели' },
];

const adminItems = [
  { path: '/import', icon: Upload, label: 'Импорт Excel' },
  { path: '/users', icon: UserCog, label: 'Пользователи' },
];

export default function Sidebar({ open, onToggle }) {
  const { isAdmin } = useAuth();

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-gray-900 text-white transition-all duration-300 z-40 ${
        open ? 'w-64' : 'w-20'
      }`}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
            <Compass className="w-6 h-6" />
          </div>
          {open && (
            <div>
              <h1 className="font-bold text-lg">Orient Insight</h1>
              <p className="text-xs text-gray-400">Система туров</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-2">
        {open && (
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-4 px-3">
            Меню
          </p>
        )}

        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                isActive
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {open && <span>{item.label}</span>}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            {open && (
              <p className="text-xs text-gray-500 uppercase tracking-wider mt-6 mb-4 px-3">
                Администрирование
              </p>
            )}
            {!open && <div className="border-t border-gray-800 my-4" />}

            {adminItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`
                }
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {open && <span>{item.label}</span>}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className="absolute bottom-4 right-0 translate-x-1/2 w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
      >
        {open ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
    </aside>
  );
}
