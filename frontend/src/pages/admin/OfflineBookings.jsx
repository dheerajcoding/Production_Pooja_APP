import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Pagination from '../../components/common/Pagination';
import toast from 'react-hot-toast';

const STATUS_STYLES = {
  requested: 'bg-yellow-100 text-yellow-800',
  accepted:  'bg-blue-100 text-blue-800',
  rejected:  'bg-red-100 text-red-600',
  confirmed: 'bg-indigo-100 text-indigo-800',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

const STATUS_LABELS = {
  requested: '⏳ Requested',
  accepted:  '✅ Accepted',
  rejected:  '❌ Rejected',
  confirmed: '🗓️ Confirmed',
  completed: '✔ Completed',
  cancelled: 'Cancelled',
};

const FILTERS = ['', 'requested', 'accepted', 'confirmed', 'completed', 'rejected', 'cancelled'];

export default function AdminOfflineBookings() {
  const [bookings, setBookings]     = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState('');
  const [page, setPage]             = useState(1);
  const [updating, setUpdating]     = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: 15 });
    if (filter) params.set('status', filter);
    api.get(`/offline-bookings/admin/all?${params}`)
      .then(({ data }) => {
        setBookings(data.data.bookings || []);
        setPagination(data.data.pagination);
      })
      .catch(() => toast.error('Failed to load bookings.'))
      .finally(() => setLoading(false));
  }, [filter, page]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id, status) => {
    setUpdating(id);
    try {
      await api.put(`/offline-bookings/admin/${id}/status`, { status });
      toast.success(`Status updated to ${status}`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update.');
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Offline Bookings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Home ceremony bookings — track and manage</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1); }}
            className={`text-sm px-4 py-1.5 rounded-full border font-medium whitespace-nowrap capitalize transition-colors flex-shrink-0 ${filter === f ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'}`}
          >
            {f || 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
      ) : bookings.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <p className="text-3xl mb-2">🏠</p>
          <p className="text-sm">No {filter || ''} offline bookings found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => (
            <div key={b._id} className="card">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="font-semibold text-gray-900">{b.userId?.name}</p>
                  <p className="text-xs text-gray-400">{b.userId?.phone} · {b.userId?.email}</p>
                </div>
                <span className={`badge text-xs flex-shrink-0 ${STATUS_STYLES[b.status] || 'bg-gray-100 text-gray-500'}`}>
                  {STATUS_LABELS[b.status] || b.status}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-3">
                <div>
                  <p className="text-xs text-gray-400 font-medium">Event</p>
                  <p className="font-semibold text-gray-900">{b.eventType}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium">Pandit</p>
                  <p className="text-gray-700">{b.panditId?.userId?.name || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium">Date & Time</p>
                  <p className="text-gray-700">{new Date(b.bookingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  <p className="text-gray-500 text-xs">{b.bookingTime}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium">Amount</p>
                  <p className="font-bold text-primary-600">₹{b.amount?.toLocaleString('en-IN')}</p>
                  {b.isPaid && <span className="text-xs text-green-600 font-medium">✓ Paid</span>}
                </div>
              </div>

              <div className="text-xs text-gray-400 mb-3">
                📍 {b.address?.street}, {b.address?.city}, {b.address?.state} — {b.address?.pincode}
              </div>

              {/* Admin status override */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-500 font-medium">Change status:</span>
                {['confirmed', 'completed', 'cancelled'].map((s) => (
                  <button
                    key={s}
                    onClick={() => updateStatus(b._id, s)}
                    disabled={b.status === s || updating === b._id}
                    className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors disabled:opacity-40 capitalize ${
                      b.status === s ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-default' : 'bg-white border-gray-200 hover:border-primary-300 hover:text-primary-600 text-gray-600'
                    }`}
                  >
                    {updating === b._id ? '...' : s}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Pagination pagination={pagination} onPageChange={setPage} />
    </div>
  );
}
