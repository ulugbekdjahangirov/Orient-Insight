import { NavLink } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useYear } from '../../context/YearContext';
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  MapPin,
  Upload,
  UserCog,
  ChevronLeft,
  ChevronRight,
  Building2,
  Bell,
  Wallet,
  Mail,
  Settings,
  DollarSign,
  FileText,
  Receipt,
  X,
  Handshake,
  CalendarRange
} from 'lucide-react';

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/updates', icon: Bell, label: 'Updates' },
  { path: '/bookings', icon: CalendarDays, label: 'Bookings' },
  { path: '/jahresplanung', icon: CalendarRange, label: 'Jahresplanung' },
  { path: '/guides', icon: Users, label: 'Guides' },
  { path: '/tour-types', icon: MapPin, label: 'Tours' },
  { path: '/hotels', icon: Building2, label: 'Hotels' },
  { path: '/opex', icon: Wallet, label: 'OPEX' },
  { path: '/price', icon: DollarSign, label: 'Price' },
  { path: '/rechnung', icon: FileText, label: 'Invoice' },
  { path: '/ausgaben', icon: Receipt, label: 'Ausgaben' },
  { path: '/email-imports', icon: Mail, label: 'Email Imports' },
  { path: '/partners', icon: Handshake, label: 'Hamkorlar' },
];

const adminItems = [
  { path: '/import', icon: Upload, label: 'Import Excel' },
  { path: '/gmail-settings', icon: Settings, label: 'Sozlamalar' },
  { path: '/users', icon: UserCog, label: 'Users' },
];

export default function Sidebar({ open, onToggle }) {
  const { isAdmin } = useAuth();
  const isMobile = useIsMobile();
  const { selectedYear, changeYear } = useYear();

  // On mobile, sidebar should be completely hidden when closed (drawer pattern)
  // On desktop, sidebar collapses to narrow state (w-20)
  const sidebarClasses = isMobile
    ? `fixed left-0 top-0 h-full bg-gray-900 text-white transition-transform duration-300 z-50 w-64 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`
    : `fixed left-0 top-0 h-full bg-gray-900 text-white transition-all duration-300 z-40 ${
        open ? 'w-64' : 'w-20'
      }`;

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isMobile && open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-300"
          onClick={onToggle}
          aria-label="Close sidebar"
        />
      )}

      <aside className={`${sidebarClasses} flex flex-col`}>
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Orient Insight" className="w-10 h-10 rounded-lg object-cover" />
          {open && (
            <div>
              <h1 className="font-bold text-lg">Orient Insight</h1>
              <p className="text-xs text-gray-400">Tour Management System</p>
            </div>
          )}
        </div>

        {/* Close button on mobile */}
        {isMobile && open && (
          <button
            onClick={onToggle}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Close menu"
          >
            <X className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Year selector */}
      <div className="px-4 py-3 border-b border-gray-800">
        {open ? (
          <div className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2">
            <button
              onClick={() => changeYear(selectedYear - 1)}
              className="text-gray-400 hover:text-white transition-colors px-1"
            >
              ‹
            </button>
            <span className="text-white font-bold text-sm tracking-widest">{selectedYear}</span>
            <button
              onClick={() => changeYear(selectedYear + 1)}
              className="text-gray-400 hover:text-white transition-colors px-1"
            >
              ›
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => changeYear(selectedYear - 1)}
              className="text-gray-500 hover:text-white leading-none text-xs"
            >▲</button>
            <span className="text-white font-bold text-xs">{selectedYear}</span>
            <button
              onClick={() => changeYear(selectedYear + 1)}
              className="text-gray-500 hover:text-white leading-none text-xs"
            >▼</button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-2">
        {open && (
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-4 px-3">
            MENU
          </p>
        )}

        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={isMobile ? onToggle : undefined} // Close sidebar on mobile after navigation
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 rounded-lg transition-colors ${
                isMobile ? 'py-3' : 'py-2.5'
              } ${
                isActive
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <item.icon className={isMobile ? 'w-6 h-6 flex-shrink-0' : 'w-5 h-5 flex-shrink-0'} />
            {open && <span>{item.label}</span>}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            {open && (
              <p className="text-xs text-gray-500 uppercase tracking-wider mt-6 mb-4 px-3">
                ADMINISTRATION
              </p>
            )}
            {!open && <div className="border-t border-gray-800 my-4" />}

            {adminItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={isMobile ? onToggle : undefined} // Close sidebar on mobile after navigation
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 rounded-lg transition-colors ${
                    isMobile ? 'py-3' : 'py-2.5'
                  } ${
                    isActive
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`
                }
              >
                <item.icon className={isMobile ? 'w-6 h-6 flex-shrink-0' : 'w-5 h-5 flex-shrink-0'} />
                {open && <span>{item.label}</span>}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* Toggle Button - Desktop only */}
      {!isMobile && (
        <button
          onClick={onToggle}
          className="absolute bottom-4 right-0 translate-x-1/2 w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
        >
          {open ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      )}
    </aside>
    </>
  );
}
