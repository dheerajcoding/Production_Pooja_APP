import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: '📊', end: true },
  { to: '/admin/users', label: 'Users', icon: '👥' },
  { to: '/admin/pandits', label: 'Pandits', icon: '🧘' },
  { to: '/admin/poojas', label: 'Poojas', icon: '🪔' },
  { to: '/admin/online-poojas', label: 'Online Poojas', icon: '🕉️' },
  { to: '/admin/products', label: 'Products', icon: '🛍️' },
  { to: '/admin/orders', label: 'Orders', icon: '📦' },
  { to: '/admin/bookings', label: 'Bookings', icon: '📋' },
  { to: '/admin/offline-bookings', label: 'Offline Bookings', icon: '🏠' },
  { to: '/admin/astrology', label: 'Astrology Chat', icon: '🔮' },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    toast.success('Logged out.');
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#FFF8F0' }}>
      {/* ── Admin Sidebar — deep temple maroon ── */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:inset-auto lg:z-auto flex-shrink-0`}
        style={{ backgroundColor: '#2C0F05', borderRight: '1px solid #4A1403' }}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-5" style={{ borderBottom: '1px solid #4A1403' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary-500 flex items-center justify-center flex-shrink-0">
                <span className="text-lg">🪔</span>
              </div>
              <div>
                <div className="text-lg font-bold leading-tight" style={{ color: '#F5A623' }}>Saral Pooja</div>
                <div className="text-xs" style={{ color: '#D4B483' }}>Admin Panel</div>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? 'font-semibold' : ''
                  }`
                }
                style={({ isActive }) => isActive
                  ? { backgroundColor: '#D9531C', color: '#FFFFFF' }
                  : { color: '#D4B483' }
                }
                onMouseEnter={(e) => { if (!e.currentTarget.classList.contains('font-semibold')) e.currentTarget.style.backgroundColor = '#3D1505'; }}
                onMouseLeave={(e) => { if (!e.currentTarget.classList.contains('font-semibold')) e.currentTarget.style.backgroundColor = ''; }}
              >
                <span>{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* User footer */}
          <div className="p-4" style={{ borderTop: '1px solid #4A1403' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm"
                style={{ backgroundColor: '#D9531C33', color: '#F5A623' }}>
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-semibold truncate text-white">{user?.name}</p>
                <p className="text-xs font-medium" style={{ color: '#F5A623' }}>Administrator</p>
              </div>
            </div>
            <button onClick={handleLogout}
              className="w-full text-sm py-2 rounded-lg transition-colors font-medium"
              style={{ backgroundColor: '#3D1505', color: '#D4B483', border: '1px solid #4A1403' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4A1403'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#3D1505'; }}
            >Logout</button>
          </div>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="bg-white px-4 py-3 flex items-center gap-3 lg:hidden sticky top-0 z-20"
          style={{ borderBottom: '1px solid #EDD9BC' }}>
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg" style={{ color: '#D9531C' }}>
            <span className="text-xl">☰</span>
          </button>
          <span className="text-2xl">🪔</span>
          <span className="font-bold" style={{ color: '#D9531C' }}>Saral Pooja Admin</span>
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
