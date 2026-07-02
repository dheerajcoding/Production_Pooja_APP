import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const STATUS_STYLES = {
  pending:   'bg-yellow-100 text-yellow-700',
  assigned:  'bg-blue-100 text-blue-700',
  confirmed: 'bg-indigo-100 text-indigo-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-500',
};

const STATUS_LABELS = {
  pending:   'Pending',
  assigned:  'Assigned',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export default function AdminDashboard() {
  const [stats, setStats]         = useState(null);
  const [recentBookings, setRecentBookings] = useState([]);
  const [pendingPandits, setPendingPandits] = useState([]);
  const [loading, setLoading]     = useState(true);

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  useEffect(() => {
    Promise.all([
      api.get('/admin/stats'),
      api.get('/admin/bookings?limit=5&page=1'),
      api.get('/admin/pandits?approved=false&limit=3'),
    ]).then(([s, b, p]) => {
      setStats(s.data.data);
      setRecentBookings(b.data.data.bookings || []);
      setPendingPandits(p.data.data.pandits || []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>;

  const pendingPanditCount = (stats?.panditsCount || 0) - (stats?.approvedPandits || 0);
  const approvalRate   = stats?.panditsCount > 0 ? Math.round((stats.approvedPandits / stats.panditsCount) * 100) : 0;
  const completionRate = stats?.bookingsCount > 0 ? Math.round((stats.completedBookings / stats.bookingsCount) * 100) : 0;

  const STAT_CARDS = [
    {
      label: 'Total Users',
      value: stats?.usersCount?.toLocaleString('en-IN') || '0',
      icon: '👥',
      bg: 'bg-blue-50 border-blue-100',
      text: 'text-blue-600',
      to: '/admin/users',
      sub: 'Registered users',
    },
    {
      label: 'Total Pandits',
      value: stats?.panditsCount?.toLocaleString('en-IN') || '0',
      icon: '🧘',
      bg: 'bg-amber-50 border-amber-100',
      text: 'text-amber-600',
      to: '/admin/pandits',
      sub: `${stats?.approvedPandits || 0} approved`,
    },
    {
      label: 'Total Bookings',
      value: stats?.bookingsCount?.toLocaleString('en-IN') || '0',
      icon: '📋',
      bg: 'bg-indigo-50 border-indigo-100',
      text: 'text-indigo-600',
      to: '/admin/bookings',
      sub: `${stats?.pendingBookings || 0} pending`,
    },
    {
      label: 'Total Revenue',
      value: `₹${(stats?.totalRevenue || 0).toLocaleString('en-IN')}`,
      icon: '💰',
      bg: 'bg-green-50 border-green-100',
      text: 'text-green-600',
      to: '/admin/bookings',
      sub: `₹${(stats?.monthlyRevenue || 0).toLocaleString('en-IN')} this month`,
    },
  ];

  return (
    <div className="space-y-5">

      {/* ── Hero ── */}
      <div className="relative bg-gradient-to-br from-gray-800 via-gray-700 to-gray-800 rounded-2xl p-6 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-5 text-[100px] leading-none text-right pr-4 pt-1 select-none pointer-events-none">🕉️</div>
        <p className="text-gray-400 text-xs mb-1">{dateStr}</p>
        <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
        <p className="text-gray-400 text-sm mt-0.5">Saral Pooja Platform Overview</p>
        <div className="flex gap-3 mt-4 flex-wrap">
          <Link to="/admin/bookings" className="bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            📋 Manage Bookings
          </Link>
          <Link to="/admin/pandits" className="bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            🧘 Manage Pandits
          </Link>
        </div>
      </div>

      {/* ── Urgent Alerts ── */}
      {(pendingPanditCount > 0 || (stats?.pendingBookings || 0) > 0) && (
        <div className="space-y-2">
          {pendingPanditCount > 0 && (
            <Link to="/admin/pandits" className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 hover:bg-amber-100 transition-colors group">
              <div className="flex items-center gap-3">
                <span className="text-xl">🧘</span>
                <div>
                  <p className="text-sm font-bold text-amber-800">{pendingPanditCount} pandit{pendingPanditCount > 1 ? 's' : ''} awaiting approval</p>
                  <p className="text-xs text-amber-600">Review profiles and approve or reject</p>
                </div>
              </div>
              <span className="text-xs font-bold text-amber-700 bg-amber-200 px-3 py-1.5 rounded-lg whitespace-nowrap group-hover:bg-amber-300 transition-colors">
                Review →
              </span>
            </Link>
          )}
          {(stats?.pendingBookings || 0) > 0 && (
            <Link to="/admin/bookings" className="flex items-center justify-between gap-3 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 hover:bg-yellow-100 transition-colors group">
              <div className="flex items-center gap-3">
                <span className="text-xl">📋</span>
                <div>
                  <p className="text-sm font-bold text-yellow-800">{stats.pendingBookings} booking{stats.pendingBookings > 1 ? 's' : ''} need pandit assignment</p>
                  <p className="text-xs text-yellow-600">Assign pandits to complete these bookings</p>
                </div>
              </div>
              <span className="text-xs font-bold text-yellow-700 bg-yellow-200 px-3 py-1.5 rounded-lg whitespace-nowrap group-hover:bg-yellow-300 transition-colors">
                Assign →
              </span>
            </Link>
          )}
        </div>
      )}

      {/* ── Main Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {STAT_CARDS.map((s) => (
          <Link
            key={s.label}
            to={s.to}
            className={`border rounded-xl p-4 hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer ${s.bg}`}
          >
            <div className="flex items-start justify-between">
              <span className="text-2xl">{s.icon}</span>
              <span className="text-xs text-gray-400">→</span>
            </div>
            <p className={`text-2xl font-bold mt-2 ${s.text}`}>{s.value}</p>
            <p className="text-xs font-semibold text-gray-700 mt-0.5">{s.label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
          </Link>
        ))}
      </div>

      {/* ── Secondary Stats Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Monthly Revenue', value: `₹${(stats?.monthlyRevenue || 0).toLocaleString('en-IN')}`, icon: '📈', sub: 'This month', to: '/admin/bookings', color: 'text-emerald-600' },
          { label: 'Pending Bookings', value: stats?.pendingBookings || 0, icon: '⏳', sub: 'Need assignment', to: '/admin/bookings', color: 'text-yellow-600' },
          { label: 'Completed', value: stats?.completedBookings || 0, icon: '✅', sub: `${completionRate}% rate`, to: '/admin/bookings', color: 'text-green-600' },
          { label: 'Approved Pandits', value: stats?.approvedPandits || 0, icon: '✓', sub: `${approvalRate}% approved`, to: '/admin/pandits', color: 'text-blue-600' },
        ].map((s) => (
          <Link key={s.label} to={s.to} className="card p-3 hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer">
            <div className="flex items-center gap-2">
              <span className="text-lg">{s.icon}</span>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </div>
            <p className="text-xs font-semibold text-gray-700 mt-1">{s.label}</p>
            <p className="text-xs text-gray-400">{s.sub}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ── Recent Bookings ── */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Recent Bookings</h2>
            <Link to="/admin/bookings" className="text-xs text-primary-600 font-medium hover:underline">View all →</Link>
          </div>
          {recentBookings.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p className="text-3xl mb-2">📭</p>
              <p className="text-sm">No bookings yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentBookings.map((b) => (
                <div key={b._id} className="flex items-start gap-3 py-3">
                  <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center text-base flex-shrink-0 overflow-hidden">
                    {b.poojaId?.image ? <img src={b.poojaId.image} alt="" className="w-full h-full object-cover rounded-lg" /> : '🪔'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{b.poojaId?.name || 'Pooja'}</p>
                    <p className="text-xs text-gray-400 truncate">{b.userId?.name} · {new Date(b.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[b.status] || 'bg-gray-100 text-gray-500'}`}>
                      {STATUS_LABELS[b.status] || b.status}
                    </span>
                    <p className="text-xs text-gray-500">₹{b.amount?.toLocaleString('en-IN')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Pending Pandit Approvals ── */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Pending Approvals</h2>
            <Link to="/admin/pandits" className="text-xs text-primary-600 font-medium hover:underline">View all →</Link>
          </div>
          {pendingPandits.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p className="text-3xl mb-2">✅</p>
              <p className="text-sm">All pandits reviewed</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingPandits.map((p) => {
                const photo = p.photo || p.userId?.profilePhoto;
                const initials = (p.userId?.name || 'P').charAt(0).toUpperCase();
                return (
                  <Link key={p._id} to="/admin/pandits" className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-amber-50 border border-transparent hover:border-amber-100 transition-all group">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {photo
                        ? <img src={photo} alt="" className="w-full h-full object-cover" />
                        : <span className="font-bold text-amber-600">{initials}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-amber-700">{p.userId?.name}</p>
                      <p className="text-xs text-gray-400 truncate">{p.userId?.email}</p>
                      {p.expertise?.length > 0 && (
                        <p className="text-xs text-gray-400 truncate">{p.expertise.slice(0, 2).join(', ')}</p>
                      )}
                    </div>
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-lg font-medium flex-shrink-0">Pending</span>
                  </Link>
                );
              })}
            </div>
          )}
          {pendingPanditCount > 3 && (
            <Link to="/admin/pandits" className="block text-center text-xs text-amber-600 hover:underline font-medium mt-3 pt-3 border-t border-gray-50">
              +{pendingPanditCount - 3} more pandits waiting →
            </Link>
          )}
        </div>
      </div>

      {/* ── Platform Health ── */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">📊 Platform Health</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">

          {/* Pandit Approval Rate */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <p className="text-xs text-gray-500 font-medium">Pandit Approval Rate</p>
              <p className="text-sm font-bold text-amber-600">{approvalRate}%</p>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${approvalRate}%` }} />
            </div>
            <p className="text-xs text-gray-400 mt-1">{stats?.approvedPandits || 0} of {stats?.panditsCount || 0} approved</p>
          </div>

          {/* Booking Completion Rate */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <p className="text-xs text-gray-500 font-medium">Booking Completion</p>
              <p className="text-sm font-bold text-green-600">{completionRate}%</p>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-green-400 rounded-full transition-all" style={{ width: `${completionRate}%` }} />
            </div>
            <p className="text-xs text-gray-400 mt-1">{stats?.completedBookings || 0} of {stats?.bookingsCount || 0} completed</p>
          </div>

          {/* Avg Booking Value */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <p className="text-xs text-gray-500 font-medium">Avg Booking Value</p>
              <p className="text-sm font-bold text-blue-600">
                {stats?.bookingsCount && stats?.totalRevenue
                  ? `₹${Math.round(stats.totalRevenue / stats.bookingsCount).toLocaleString('en-IN')}`
                  : '–'}
              </p>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: '100%' }} />
            </div>
            <p className="text-xs text-gray-400 mt-1">Per booking average</p>
          </div>
        </div>
      </div>

      {/* ── Quick Actions Grid ── */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: '👥', label: 'Users',         sub: 'Manage accounts',  to: '/admin/users',         bg: 'hover:bg-blue-50 hover:border-blue-200' },
            { icon: '🧘', label: 'Pandits',       sub: 'Approve & set fee', to: '/admin/pandits',       bg: 'hover:bg-amber-50 hover:border-amber-200' },
            { icon: '📋', label: 'Bookings',      sub: 'Assign pandits',    to: '/admin/bookings',      bg: 'hover:bg-indigo-50 hover:border-indigo-200' },
            { icon: '🪔', label: 'Poojas',        sub: 'Add & manage',      to: '/admin/poojas',        bg: 'hover:bg-orange-50 hover:border-orange-200' },
            { icon: '🕉️', label: 'Special Poojas', sub: 'Upload videos',   to: '/admin/online-poojas', bg: 'hover:bg-violet-50 hover:border-violet-200' },
            { icon: '🛍️', label: 'Products',      sub: 'Shop inventory',    to: '/admin/products',      bg: 'hover:bg-green-50 hover:border-green-200' },
            { icon: '🏠', label: 'Offline Bookings', sub: 'Home ceremonies', to: '/admin/offline-bookings', bg: 'hover:bg-yellow-50 hover:border-yellow-200' },
            { icon: '📦', label: 'Orders',        sub: 'Track shipments',   to: '/admin/orders',        bg: 'hover:bg-pink-50 hover:border-pink-200' },
          ].map((a) => (
            <Link
              key={a.label}
              to={a.to}
              className={`flex items-center gap-3 border border-gray-200 rounded-xl p-3 transition-all hover:-translate-y-0.5 hover:shadow-sm bg-white ${a.bg}`}
            >
              <span className="text-2xl flex-shrink-0">{a.icon}</span>
              <div className="min-w-0">
                <p className="font-semibold text-sm text-gray-900 truncate">{a.label}</p>
                <p className="text-xs text-gray-400 truncate">{a.sub}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
}
