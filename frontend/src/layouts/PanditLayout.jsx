import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const navItems = [
  { to: '/pandit', label: 'Dashboard', icon: '🏠', end: true },
  { to: '/pandit/bookings', label: 'Bookings', icon: '📋' },
  { to: '/pandit/astrology', label: 'Astrology Chat', icon: '🔮' },
  { to: '/pandit/profile', label: 'My Profile', icon: '👤' },
];

export default function PanditLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully.');
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#FFF8F0' }}>
      {/* ── Sidebar ── */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-white transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:inset-auto lg:z-auto flex-shrink-0`}
        style={{ borderRight: '1px solid #EDD9BC' }}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-5" style={{ borderBottom: '1px solid #EDD9BC' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary-500 flex items-center justify-center flex-shrink-0">
                <span className="text-lg">🪔</span>
              </div>
              <div>
                <div className="text-lg font-bold text-primary-600 leading-tight">Saral Pooja</div>
                <div className="text-xs font-medium" style={{ color: '#B8860B' }}>Pandit Portal</div>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? 'bg-primary-50 text-primary-700 font-semibold' : 'hover:bg-temple-50'
                  }`
                }
                style={({ isActive }) => isActive ? {} : { color: '#5C3010' }}
              >
                <span>{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* User footer */}
          <div className="p-4" style={{ borderTop: '1px solid #EDD9BC' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-sm overflow-hidden">
                {user?.profilePhoto ? <img src={user.profilePhoto} alt="" className="w-full h-full object-cover" /> : user?.name?.charAt(0).toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-semibold truncate" style={{ color: '#1C0A00' }}>{user?.name}</p>
                <p className="text-xs font-medium" style={{ color: '#D9531C' }}>Pandit</p>
              </div>
            </div>
            <button onClick={handleLogout} className="w-full btn-secondary text-sm py-2">Logout</button>
          </div>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="bg-white px-4 py-3 flex items-center gap-3 lg:hidden sticky top-0 z-20"
          style={{ borderBottom: '1px solid #EDD9BC' }}>
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg" style={{ color: '#D9531C' }}>
            <span className="text-xl">☰</span>
          </button>
          <span className="text-2xl">🪔</span>
          <span className="font-bold text-primary-600">Saral Pooja – Pandit</span>
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
