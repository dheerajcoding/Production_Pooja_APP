import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import StatusBadge from '../../components/common/StatusBadge';
import Pagination from '../../components/common/Pagination';
import toast from 'react-hot-toast';

const STATUSES         = ['', 'pending', 'assigned', 'confirmed', 'completed', 'cancelled'];
const OFFLINE_STATUSES = ['', 'requested', 'accepted', 'rejected', 'confirmed', 'completed', 'cancelled'];

const OFFLINE_STATUS_STYLES = {
  requested: 'bg-yellow-100 text-yellow-800',
  accepted:  'bg-blue-100 text-blue-800',
  rejected:  'bg-red-100 text-red-800',
  confirmed: 'bg-indigo-100 text-indigo-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-500',
};

export default function AdminBookings() {
  // ── Section toggle ──────────────────────────────────────────────────────────
  const [section, setSection] = useState('pooja'); // 'pooja' | 'offline'

  // ── Pooja Bookings ──────────────────────────────────────────────────────────
  const [bookings, setBookings]       = useState([]);
  const [pandits, setPandits]         = useState([]);
  const [pagination, setPagination]   = useState(null);
  const [loading, setLoading]         = useState(true);
  const [status, setStatus]           = useState('');
  const [page, setPage]               = useState(1);
  const [assignModal, setAssignModal] = useState({ open: false, bookingId: '', panditId: '' });
  const [assigning, setAssigning]     = useState(false);

  // ── Offline Bookings ────────────────────────────────────────────────────────
  const [offlineBookings, setOfflineBookings]       = useState([]);
  const [offlinePagination, setOfflinePagination]   = useState(null);
  const [offlineLoading, setOfflineLoading]         = useState(true);
  const [offlineStatus, setOfflineStatus]           = useState('');
  const [offlinePage, setOfflinePage]               = useState(1);
  const [statusModal, setStatusModal]               = useState({ open: false, bookingId: '', status: '', adminNote: '' });
  const [updatingStatus, setUpdatingStatus]         = useState(false);

  // ── Load pooja bookings ─────────────────────────────────────────────────────
  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: 15 });
    if (status) params.set('status', status);
    api.get(`/admin/bookings?${params}`).then(({ data }) => {
      setBookings(data.data.bookings);
      setPagination(data.data.pagination);
    }).finally(() => setLoading(false));
  }, [status, page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get('/admin/pandits?approved=true&limit=100').then(({ data }) => setPandits(data.data.pandits));
  }, []);

  // ── Load offline bookings ───────────────────────────────────────────────────
  const loadOffline = useCallback(() => {
    setOfflineLoading(true);
    const params = new URLSearchParams({ page: offlinePage, limit: 15 });
    if (offlineStatus) params.set('status', offlineStatus);
    api.get(`/offline-bookings/admin/all?${params}`).then(({ data }) => {
      setOfflineBookings(data.data.bookings);
      setOfflinePagination(data.data.pagination);
    }).finally(() => setOfflineLoading(false));
  }, [offlineStatus, offlinePage]);

  useEffect(() => { loadOffline(); }, [loadOffline]);

  // ── Pooja booking actions ───────────────────────────────────────────────────
  const handleAssign = async () => {
    if (!assignModal.panditId) return toast.error('Please select a pandit.');
    setAssigning(true);
    try {
      await api.put(`/admin/bookings/${assignModal.bookingId}/assign`, { panditId: assignModal.panditId });
      toast.success('Pandit assigned.');
      setAssignModal({ open: false, bookingId: '', panditId: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Assignment failed.');
    } finally {
      setAssigning(false);
    }
  };

  const updateStatus = async (id, newStatus) => {
    try {
      await api.put(`/admin/bookings/${id}/status`, { status: newStatus });
      toast.success('Status updated.');
      load();
    } catch { toast.error('Update failed.'); }
  };

  // ── Offline booking actions ─────────────────────────────────────────────────
  const openStatusModal = (b) => {
    setStatusModal({ open: true, bookingId: b._id, status: b.status, adminNote: b.adminNote || '' });
  };

  const handleOfflineStatusUpdate = async () => {
    setUpdatingStatus(true);
    try {
      await api.put(`/offline-bookings/admin/${statusModal.bookingId}/status`, {
        status:    statusModal.status,
        adminNote: statusModal.adminNote,
      });
      toast.success('Booking updated.');
      setStatusModal({ open: false, bookingId: '', status: '', adminNote: '' });
      loadOffline();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>

      {/* Section toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setSection('pooja')}
          className={`px-5 py-2 rounded-xl text-sm font-medium transition-colors border ${section === 'pooja' ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'}`}
        >
          🪔 Pooja Bookings
        </button>
        <button
          onClick={() => setSection('offline')}
          className={`px-5 py-2 rounded-xl text-sm font-medium transition-colors border ${section === 'offline' ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'}`}
        >
          🧘 Offline Pandit Bookings
        </button>
      </div>

      {/* ── POOJA BOOKINGS ─────────────────────────────────────────────────────── */}
      {section === 'pooja' && (
        <>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {STATUSES.map((s) => (
              <button key={s} onClick={() => { setStatus(s); setPage(1); }} className={`text-sm px-4 py-1.5 rounded-full border font-medium whitespace-nowrap capitalize transition-colors ${status === s ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'}`}>
                {s || 'All'}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
          ) : (
            <div className="space-y-4">
              {bookings.map((b) => (
                <div key={b._id} className="card">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center text-xl overflow-hidden flex-shrink-0">
                        {b.poojaId?.image ? <img src={b.poojaId.image} alt="" className="w-full h-full object-cover rounded-xl" /> : '🪔'}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{b.poojaId?.name}</h3>
                        <p className="text-xs text-gray-400 font-mono">{b._id}</p>
                        <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-600">
                          <span>👤 {b.userId?.name}</span>
                          <span>📅 {new Date(b.bookingDate).toLocaleDateString('en-IN')} · {b.bookingTime}</span>
                          <span>📍 {b.address?.city}, {b.address?.state}</span>
                        </div>
                        {b.panditId && (
                          <p className="text-sm text-amber-700 mt-1">🧘 {b.panditId.userId?.name} ({b.panditId.userId?.phone})</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-start sm:items-end gap-2 flex-shrink-0">
                      <StatusBadge status={b.status} />
                      <p className="font-bold text-primary-600">₹{b.amount?.toLocaleString('en-IN')}</p>
                      <span className={`text-xs ${b.isPaid ? 'text-green-600' : 'text-red-500'}`}>{b.isPaid ? '✓ Paid' : 'Unpaid'}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                    {b.status === 'pending' && (
                      <button onClick={() => setAssignModal({ open: true, bookingId: b._id, panditId: '' })} className="btn-primary text-xs px-3 py-1.5">Assign Pandit</button>
                    )}
                    {['pending', 'assigned', 'confirmed'].includes(b.status) && (
                      <button onClick={() => updateStatus(b._id, 'cancelled')} className="btn-danger text-xs px-3 py-1.5">Cancel</button>
                    )}
                    {b.status === 'confirmed' && (
                      <button onClick={() => updateStatus(b._id, 'completed')} className="text-xs px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg">Mark Completed</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <Pagination pagination={pagination} onPageChange={setPage} />
        </>
      )}

      {/* ── OFFLINE PANDIT BOOKINGS ─────────────────────────────────────────── */}
      {section === 'offline' && (
        <>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {OFFLINE_STATUSES.map((s) => (
              <button key={s} onClick={() => { setOfflineStatus(s); setOfflinePage(1); }} className={`text-sm px-4 py-1.5 rounded-full border font-medium whitespace-nowrap capitalize transition-colors ${offlineStatus === s ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'}`}>
                {s || 'All'}
              </button>
            ))}
          </div>

          {offlineLoading ? (
            <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
          ) : offlineBookings.length === 0 ? (
            <div className="card text-center py-12 text-gray-400">
              <p className="text-3xl mb-2">📭</p>
              <p className="text-sm">No offline bookings found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {offlineBookings.map((b) => (
                <div key={b._id} className="card">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-semibold text-gray-900">{b.eventType}</h3>
                        <p className="text-xs text-gray-400 font-mono">{b._id}</p>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 mt-1">
                        <span>👤 {b.userId?.name} ({b.userId?.phone})</span>
                        <span>🧘 {b.panditId?.userId?.name} ({b.panditId?.userId?.phone})</span>
                        <span>📅 {new Date(b.bookingDate).toLocaleDateString('en-IN')} · {b.bookingTime}</span>
                        <span>📍 {b.address?.city}, {b.address?.state} — {b.address?.pincode}</span>
                      </div>
                      {b.requirements && (
                        <p className="text-xs text-gray-400 mt-1 truncate">📝 {b.requirements}</p>
                      )}
                      {b.adminNote && (
                        <p className="text-xs text-indigo-700 mt-1">💬 Admin note: {b.adminNote}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-start sm:items-end gap-1.5 flex-shrink-0">
                      <span className={`badge text-xs ${OFFLINE_STATUS_STYLES[b.status] || 'bg-gray-100 text-gray-500'}`}>
                        {b.status}
                      </span>
                      {b.amount > 0 && <p className="font-bold text-primary-600 text-sm">₹{b.amount.toLocaleString('en-IN')}</p>}
                      <span className={`text-xs ${b.isPaid ? 'text-green-600' : 'text-red-500'}`}>
                        {b.isPaid ? '✓ Paid' : 'Unpaid'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => openStatusModal(b)}
                      className="btn-secondary text-xs px-3 py-1.5"
                    >
                      Update Status / Add Note
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Pagination pagination={offlinePagination} onPageChange={setOfflinePage} />
        </>
      )}

      {/* ── Assign Pandit Modal (pooja) ─────────────────────────────────────── */}
      {assignModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Assign Pandit</h3>
            <label className="label">Select Pandit</label>
            <select className="input mb-4" value={assignModal.panditId} onChange={(e) => setAssignModal((prev) => ({ ...prev, panditId: e.target.value }))}>
              <option value="">-- Choose pandit --</option>
              {pandits.filter((p) => p.isAvailable).map((p) => (
                <option key={p._id} value={p._id}>{p.userId?.name} – {p.expertise?.join(', ')}</option>
              ))}
            </select>
            <div className="flex gap-3">
              <button onClick={() => setAssignModal({ open: false, bookingId: '', panditId: '' })} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleAssign} disabled={assigning} className="btn-primary flex-1">{assigning ? 'Assigning...' : 'Assign'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Update Offline Booking Status Modal ─────────────────────────────── */}
      {statusModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Update Offline Booking</h3>
            <div className="space-y-4">
              <div>
                <label className="label">Status</label>
                <select
                  className="input"
                  value={statusModal.status}
                  onChange={(e) => setStatusModal((prev) => ({ ...prev, status: e.target.value }))}
                >
                  {OFFLINE_STATUSES.filter(Boolean).map((s) => (
                    <option key={s} value={s} className="capitalize">{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Admin Note <span className="text-gray-400 font-normal">(optional)</span></label>
                <textarea
                  className="input resize-none"
                  rows={3}
                  placeholder="Internal note or message to user..."
                  value={statusModal.adminNote}
                  onChange={(e) => setStatusModal((prev) => ({ ...prev, adminNote: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setStatusModal({ open: false, bookingId: '', status: '', adminNote: '' })} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleOfflineStatusUpdate} disabled={updatingStatus} className="btn-primary flex-1">
                {updatingStatus ? 'Updating...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
