import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { Menu, Bell, User, LogOut, Settings, Search } from 'lucide-react';
import GlobalSearch from '../common/GlobalSearch';

export default function Header({ onMenuClick }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
    <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    <header className="h-14 md:h-16 bg-white border-b border-gray-200 flex items-center justify-between px-3 md:px-6 sticky top-0 z-30">
      {/* Hamburger menu - Mobile only */}
      <button
        onClick={onMenuClick}
        className="md:hidden p-3 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Toggle menu"
      >
        <Menu className="w-6 h-6 text-gray-600" />
      </button>

      {/* Search bar - Desktop */}
      <button
        onClick={() => setSearchOpen(true)}
        className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors w-56"
      >
        <Search className="w-4 h-4" />
        <span className="flex-1 text-left">Qidirish...</span>
        <kbd className="text-xs bg-white px-1.5 py-0.5 rounded border border-gray-200 text-gray-400 font-mono">Ctrl K</kbd>
      </button>

      {/* Right side */}
      <div className="flex items-center gap-2 md:gap-4">
        {/* Search button - Mobile only */}
        <button
          onClick={() => setSearchOpen(true)}
          className="md:hidden p-3 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <Search className="w-6 h-6 text-gray-600" />
        </button>
        {/* Notifications */}
        <button className="p-3 md:p-2 rounded-lg hover:bg-gray-100 transition-colors relative">
          <Bell className={isMobile ? 'w-6 h-6 text-gray-600' : 'w-5 h-5 text-gray-600'} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>

        {/* User dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 md:gap-3 p-3 md:p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className={isMobile ? 'w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center' : 'w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center'}>
              <User className={isMobile ? 'w-5 h-5 text-primary-600' : 'w-4 h-4 text-primary-600'} />
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-sm font-medium text-gray-900">{user?.name}</p>
              <p className="text-xs text-gray-500">
                {user?.role === 'ADMIN' ? 'Администратор' : 'Менеджер'}
              </p>
            </div>
          </button>

          {dropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setDropdownOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    navigate('/settings');
                  }}
                  className={`w-full flex items-center gap-3 px-4 text-sm text-gray-700 hover:bg-gray-100 ${
                    isMobile ? 'py-3' : 'py-2'
                  }`}
                >
                  <Settings className={isMobile ? 'w-5 h-5' : 'w-4 h-4'} />
                  Настройки
                </button>
                <hr className="my-1" />
                <button
                  onClick={handleLogout}
                  className={`w-full flex items-center gap-3 px-4 text-sm text-red-600 hover:bg-red-50 ${
                    isMobile ? 'py-3' : 'py-2'
                  }`}
                >
                  <LogOut className={isMobile ? 'w-5 h-5' : 'w-4 h-4'} />
                  Выйти
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
    </>
  );
}
