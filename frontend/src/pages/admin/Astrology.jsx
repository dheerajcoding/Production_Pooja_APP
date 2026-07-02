import { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const STATUS_COLORS = {
  waiting:   'bg-amber-100 text-amber-700',
  accepted:  'bg-blue-100 text-blue-700',
  active:    'bg-green-100 text-green-700',
  expired:   'bg-orange-100 text-orange-700',
  ended:     'bg-gray-100 text-gray-600',
  rejected:  'bg-red-100 text-red-600',
  cancelled: 'bg-gray-100 text-gray-400',
};

export default function AdminAstrology() {
  const [tab, setTab]             = useState('overview');
  const [stats, setStats]         = useState(null);
  const [pandits, setPandits]     = useState([]);
  const [sessions, setSessions]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [statusFilter, setFilter] = useState('');

  // edit modal
  const [editModal, setEditModal]   = useState(null);  // pandit object
  const [editRate, setEditRate]     = useState('');
  const [editEnabled, setEditEnabled] = useState(false);
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/astro/admin/stats'),
      api.get('/admin/pandits'),
      api.get('/astro/admin/sessions?limit=30'),
    ]).then(([s, p, sess]) => {
      setStats(s.data.data);
      setPandits(p.data.data?.pandits || p.data.data || []);
      setSessions(sess.data.data?.sessions || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const loadSessions = async (status = '') => {
    const { data } = await api.get(`/astro/admin/sessions?limit=30${status ? `&status=${status}` : ''}`);
    setSessions(data.data?.sessions || []);
  };

  const handleFilterChange = (s) => {
    setFilter(s);
    loadSessions(s);
  };

  const openEdit = (pandit) => {
    setEditModal(pandit);
    setEditRate(String(pandit.astroRate || 10));
    setEditEnabled(pandit.isAstrologer || false);
  };

  const saveAstroConfig = async () => {
    if (!editModal) return;
    setSaving(true);
    try {
      const { data } = await api.put(`/astro/admin/pandit/${editModal._id}`, {
        isAstrologer: editEnabled,
        astroRate:    Number(editRate),
      });
      setPandits((prev) =>
        prev.map((p) => (p._id === editModal._id ? { ...p, isAstrologer: editEnabled, astroRate: Number(editRate) } : p))
      );
      toast.success(`Settings saved for ${data.data?.userId?.name || 'pandit'}`);
      setEditModal(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const forceEndSession = async (id) => {
    if (!window.confirm('Force end this session?')) return;
    try {
      await api.put(`/astro/admin/session/${id}/end`);
      setSessions((prev) => prev.map((s) => (s._id === id ? { ...s, status: 'ended' } : s)));
      toast.success('Session ended.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not end session.');
    }
  };

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>;

  return (
    <div className="space-y-5 pb-8">

      {/* Header */}
      <div className="bg-gradient-to-br from-violet-600 to-indigo-600 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-3">
          <span className="text-4xl">🔮</span>
          <div>
            <h1 className="text-xl font-bold">Astrology Chat Management</h1>
            <p className="text-violet-200 text-sm">Control pandits, rates, and sessions</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Sessions',   value: stats.totalSessions,    icon: '📊', color: 'bg-gray-50 border-gray-200' },
            { label: 'Active Now',        value: stats.activeSessions,   icon: '🟢', color: 'bg-green-50 border-green-200' },
            { label: 'Waiting for Pay',   value: stats.acceptedSessions, icon: '💳', color: 'bg-blue-50 border-blue-200' },
            { label: 'Total Revenue',     value: `₹${(stats.totalRevenue || 0).toLocaleString('en-IN')}`, icon: '💰', color: 'bg-violet-50 border-violet-200' },
          ].map((c) => (
            <div key={c.label} className={`border rounded-2xl p-4 text-center ${c.color}`}>
              <p className="text-2xl mb-1">{c.icon}</p>
              <p className="text-2xl font-bold text-gray-900">{c.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{c.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-1">
        {['overview', 'pandits', 'sessions'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-t-xl text-sm font-semibold capitalize transition-colors ${tab === t ? 'bg-violet-600 text-white' : 'text-gray-500 hover:text-gray-800'}`}
          >
            {t === 'overview' ? '📊 Overview' : t === 'pandits' ? '🧘 Pandits' : '💬 Sessions'}
          </button>
        ))}
      </div>

      {/* ── TAB: OVERVIEW ── */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h3 className="font-bold text-gray-900 mb-4">How the Feature Works</h3>
            <div className="space-y-3 text-sm text-gray-600">
              {[
                ['1', 'Admin enables a pandit for astrology and sets the per-minute rate (e.g. ₹10/min = ₹100 for 10 min)'],
                ['2', 'Pandit goes LIVE from their dashboard'],
                ['3', 'User sees live pandits, clicks "Chat Now" — sends a request'],
                ['4', 'Pandit accepts the request'],
                ['5', 'User pays ₹(rate × 10) upfront for 10 minutes'],
                ['6', 'Chat starts — countdown timer from 10:00 for user'],
                ['7', 'At 0:00 — user can Recharge (pay another 10 min) or end'],
                ['8', 'Either party can end the session manually'],
              ].map(([n, desc]) => (
                <div key={n} className="flex gap-3">
                  <span className="bg-violet-100 text-violet-700 text-xs font-bold w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center">{n}</span>
                  <p>{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Active sessions at a glance */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h3 className="font-bold text-gray-900 mb-3">🟢 Active Sessions Right Now</h3>
            {sessions.filter((s) => s.status === 'active').length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">No active sessions</p>
            ) : (
              sessions.filter((s) => s.status === 'active').map((s) => (
                <div key={s._id} className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
                  <span className="text-lg">🟢</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">
                      {s.userId?.name} ↔ {s.panditId?.userId?.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      ₹{s.ratePerMinute}/min • ₹{s.totalPaidAmount} paid
                    </p>
                  </div>
                  <button onClick={() => forceEndSession(s._id)} className="text-xs text-red-600 font-semibold border border-red-200 px-3 py-1.5 rounded-xl hover:bg-red-50 transition-colors flex-shrink-0">
                    Force End
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── TAB: PANDITS ── */}
      {tab === 'pandits' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 px-1">
            Enable/disable astrology for each pandit and set their per-minute rate. Users pay ₹(rate × 10) per 10-minute block.
          </p>
          {pandits.length === 0 ? (
            <div className="text-center py-8 text-gray-400">No approved pandits found.</div>
          ) : (
            pandits
              .filter((p) => p.isApproved)
              .map((p) => (
                <div key={p._id} className={`bg-white border-2 rounded-2xl p-4 ${p.isAstrologer ? 'border-violet-200' : 'border-gray-100'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-violet-100 flex items-center justify-center text-xl overflow-hidden flex-shrink-0">
                      {p.photo ? <img src={p.photo} alt="" className="w-full h-full object-cover" /> : '🧘'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-sm">{p.userId?.name}</p>
                      <p className="text-xs text-gray-400">{(p.expertise || []).slice(0, 2).join(' • ') || 'No expertise listed'}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${p.isAstrologer ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-500'}`}>
                        {p.isAstrologer ? '✅ Enabled' : '❌ Disabled'}
                      </span>
                      {p.isAstrologer && (
                        <span className="text-xs text-gray-500">₹{p.astroRate}/min</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => openEdit(p)}
                    className="mt-3 w-full border border-violet-200 text-violet-700 font-semibold text-sm py-2 rounded-xl hover:bg-violet-50 transition-colors"
                  >
                    ⚙️ Configure Astrology Settings
                  </button>
                </div>
              ))
          )}
        </div>
      )}

      {/* ── TAB: SESSIONS ── */}
      {tab === 'sessions' && (
        <div className="space-y-3">
          {/* Filter */}
          <div className="flex flex-wrap gap-2">
            {['', 'waiting', 'accepted', 'active', 'expired', 'ended', 'rejected', 'cancelled'].map((s) => (
              <button
                key={s}
                onClick={() => handleFilterChange(s)}
                className={`text-xs px-3 py-1.5 rounded-full font-semibold border transition-colors ${
                  statusFilter === s ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300'
                }`}
              >
                {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {sessions.length === 0 ? (
            <div className="text-center py-8 text-gray-400">No sessions found.</div>
          ) : (
            sessions.map((s) => (
              <div key={s._id} className="bg-white border border-gray-100 rounded-2xl p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-gray-900">{s.userId?.name}</p>
                      <span className="text-gray-400 text-xs">↔</span>
                      <p className="text-sm font-bold text-violet-700">{s.panditId?.userId?.name}</p>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(s.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${STATUS_COLORS[s.status] || 'bg-gray-100 text-gray-600'}`}>
                    {s.status}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center text-xs mb-3">
                  <div className="bg-gray-50 rounded-lg py-2">
                    <p className="font-bold text-gray-700">₹{s.ratePerMinute}/m</p>
                    <p className="text-gray-400">Rate</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg py-2">
                    <p className="font-bold text-violet-600">{s.totalPaidMinutes} min</p>
                    <p className="text-gray-400">Paid Mins</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg py-2">
                    <p className="font-bold text-green-600">₹{s.totalPaidAmount}</p>
                    <p className="text-gray-400">Revenue</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg py-2">
                    <p className="font-bold text-gray-700">{s.endedBy || '—'}</p>
                    <p className="text-gray-400">Ended by</p>
                  </div>
                </div>

                {['waiting', 'accepted', 'active', 'expired'].includes(s.status) && (
                  <button
                    onClick={() => forceEndSession(s._id)}
                    className="w-full text-xs text-red-600 font-semibold border border-red-200 py-2 rounded-xl hover:bg-red-50 transition-colors"
                  >
                    🛑 Force End Session
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── EDIT MODAL ── */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4" onClick={() => setEditModal(null)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Astrology Settings</h3>
            <p className="text-sm text-gray-500 mb-5">{editModal.userId?.name}</p>

            {/* Enable toggle */}
            <div className="flex items-center justify-between bg-gray-50 rounded-2xl px-4 py-3 mb-4">
              <div>
                <p className="font-semibold text-gray-900 text-sm">Enable Astrology Chat</p>
                <p className="text-xs text-gray-400">This pandit will appear in astrology section</p>
              </div>
              <button
                onClick={() => setEditEnabled((v) => !v)}
                className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${editEnabled ? 'bg-violet-500' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${editEnabled ? 'left-6' : 'left-0.5'}`} />
              </button>
            </div>

            {editEnabled && (
              <div className="mb-5">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Rate per Minute (₹)
                </label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={editRate}
                  onChange={(e) => setEditRate(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-violet-400"
                  placeholder="e.g. 15"
                />
                <p className="text-xs text-gray-400 mt-1.5">
                  User will pay ₹{(Number(editRate) || 0) * 10} for each 10-minute block
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setEditModal(null)} className="py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={saveAstroConfig}
                disabled={saving || (editEnabled && (!editRate || Number(editRate) < 1))}
                className="py-3 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 text-white font-bold text-sm transition-colors"
              >
                {saving ? '⏳ Saving…' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
