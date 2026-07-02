import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Pagination from '../../components/common/Pagination';
import ConfirmModal from '../../components/common/ConfirmModal';
import toast from 'react-hot-toast';

const REGULAR_TABS = ['assigned', 'confirmed', 'completed', 'pending'];

const OFFLINE_STATUS_STYLES = {
  requested: 'bg-yellow-100 text-yellow-800',
  accepted:  'bg-blue-100 text-blue-800',
  rejected:  'bg-red-100 text-red-800',
  confirmed: 'bg-indigo-100 text-indigo-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-500',
};

const OFFLINE_STATUS_LABELS = {
  requested: '⏳ New Request',
  accepted:  '✅ Accepted',
  rejected:  '❌ Rejected',
  confirmed: '🗓️ Confirmed',
  completed: '✔ Completed',
  cancelled: 'Cancelled',
};

const OFFLINE_FILTER_TABS = ['', 'requested', 'accepted', 'confirmed', 'completed', 'rejected', 'cancelled'];

export default function PanditBookings() {
  const [section, setSection] = useState('regular'); // 'regular' | 'offline'

  // ── Regular bookings ──────────────────────────────────────────────────────
  const [bookings, setBookings]         = useState([]);
  const [pagination, setPagination]     = useState(null);
  const [loading, setLoading]           = useState(true);
  const [tab, setTab]                   = useState('assigned');
  const [page, setPage]                 = useState(1);
  const [modal, setModal]               = useState({ open: false, type: '', bookingId: '' });
  const [actionLoading, setActionLoading] = useState(false);

  // ── Offline bookings ──────────────────────────────────────────────────────
  const [offlineBookings, setOfflineBookings]     = useState([]);
  const [offlinePagination, setOfflinePagination] = useState(null);
  const [offlineLoading, setOfflineLoading]       = useState(true);
  const [offlineFilter, setOfflineFilter]         = useState('requested');
  const [offlinePage, setOfflinePage]             = useState(1);
  const [offlineRequestCount, setOfflineRequestCount] = useState(0);

  // Accept / Reject state
  const [acceptModal, setAcceptModal] = useState({ open: false, bookingId: '', note: '' });
  const [accepting, setAccepting]     = useState(false);
  const [rejectModal, setRejectModal] = useState({ open: false, bookingId: '', reason: '' });
  const [rejecting, setRejecting]     = useState(false);
  const [completing, setCompleting]   = useState(null);

  // ── Load regular ──────────────────────────────────────────────────────────
  const loadRegular = useCallback(() => {
    setLoading(true);
    api.get(`/pandits/bookings?status=${tab}&page=${page}&limit=10`)
      .then(({ data }) => {
        setBookings(data.data.bookings);
        setPagination(data.data.pagination);
      }).finally(() => setLoading(false));
  }, [tab, page]);

  useEffect(() => { loadRegular(); }, [loadRegular]);

  // ── Load offline ──────────────────────────────────────────────────────────
  const loadOffline = useCallback(() => {
    setOfflineLoading(true);
    const params = new URLSearchParams({ page: offlinePage, limit: 10 });
    if (offlineFilter) params.set('status', offlineFilter);
    api.get(`/offline-bookings/pandit/bookings?${params}`)
      .then(({ data }) => {
        setOfflineBookings(data.data.bookings);
        setOfflinePagination(data.data.pagination);
      }).finally(() => setOfflineLoading(false));
  }, [offlineFilter, offlinePage]);

  useEffect(() => { loadOffline(); }, [loadOffline]);

  // Fetch pending request count for badge
  useEffect(() => {
    api.get('/offline-bookings/pandit/bookings?status=requested&limit=1')
      .then(({ data }) => setOfflineRequestCount(data.data.pagination.total))
      .catch(() => {});
  }, []);

  // ── Regular actions ───────────────────────────────────────────────────────
  const openModal  = (type, bookingId) => setModal({ open: true, type, bookingId });
  const closeModal = () => setModal({ open: false, type: '', bookingId: '' });

  const handleRegularAction = async () => {
    setActionLoading(true);
    try {
      await api.put(`/pandits/bookings/${modal.bookingId}/${modal.type}`);
      toast.success(`Booking ${modal.type === 'accept' ? 'accepted' : modal.type === 'reject' ? 'rejected' : 'marked complete'}.`);
      closeModal();
      loadRegular();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const modalConfig = {
    accept:   { title: 'Accept Booking',    message: 'Confirm you will attend this ceremony?',       confirm: 'Accept',        danger: false },
    reject:   { title: 'Reject Booking',    message: 'Reject this booking? Admin will reassign it.', confirm: 'Reject',        danger: true  },
    complete: { title: 'Mark as Completed', message: 'Confirm the ceremony has been completed?',     confirm: 'Mark Complete', danger: false },
  };

  // ── Offline accept ────────────────────────────────────────────────────────
  const handleAccept = async () => {
    setAccepting(true);
    try {
      await api.put(`/offline-bookings/pandit/${acceptModal.bookingId}/accept`, { note: acceptModal.note });
      toast.success('Request accepted! User will be notified to complete payment.');
      setAcceptModal({ open: false, bookingId: '', note: '' });
      setOfflineRequestCount((c) => Math.max(0, c - 1));
      loadOffline();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to accept.');
    } finally {
      setAccepting(false);
    }
  };

  // ── Offline reject ────────────────────────────────────────────────────────
  const handleReject = async () => {
    setRejecting(true);
    try {
      await api.put(`/offline-bookings/pandit/${rejectModal.bookingId}/reject`, { reason: rejectModal.reason });
      toast.success('Request rejected.');
      setRejectModal({ open: false, bookingId: '', reason: '' });
      setOfflineRequestCount((c) => Math.max(0, c - 1));
      loadOffline();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject.');
    } finally {
      setRejecting(false);
    }
  };

  // ── Offline complete ──────────────────────────────────────────────────────
  const handleComplete = async (bookingId) => {
    if (!window.confirm('Mark this ceremony as completed?')) return;
    setCompleting(bookingId);
    try {
      await api.put(`/offline-bookings/pandit/${bookingId}/complete`);
      toast.success('Booking marked as completed. 🙏');
      loadOffline();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed.');
    } finally {
      setCompleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">My Bookings</h1>

      {/* Section toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setSection('regular')}
          className={`px-5 py-2 rounded-xl text-sm font-medium transition-colors border ${section === 'regular' ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'}`}
        >
          Regular Bookings
        </button>
        <button
          onClick={() => setSection('offline')}
          className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium transition-colors border ${section === 'offline' ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'}`}
        >
          🏠 Offline Requests
          {offlineRequestCount > 0 && (
            <span className={`text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold ${section === 'offline' ? 'bg-white text-primary-600' : 'bg-red-500 text-white'}`}>
              {offlineRequestCount > 9 ? '9+' : offlineRequestCount}
            </span>
          )}
        </button>
      </div>

      {/* ── REGULAR ──────────────────────────────────────────────────────────── */}
      {section === 'regular' && (
        <>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {REGULAR_TABS.map((t) => (
              <button key={t} onClick={() => { setTab(t); setPage(1); }} className={`text-sm px-4 py-1.5 rounded-full border font-medium whitespace-nowrap capitalize transition-colors ${tab === t ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'}`}>
                {t}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
          ) : bookings.length === 0 ? (
            <div className="card text-center py-12 text-gray-400">
              <p className="text-3xl mb-2">📭</p>
              <p className="text-sm">No {tab} bookings</p>
            </div>
          ) : (
            <div className="space-y-4">
              {bookings.map((b) => (
                <div key={b._id} className="card">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center text-xl overflow-hidden flex-shrink-0">
                        {b.poojaId?.image ? <img src={b.poojaId.image} alt="" className="w-full h-full object-cover rounded-xl" /> : '🪔'}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{b.poojaId?.name}</h3>
                        <p className="text-sm text-gray-500">
                          {new Date(b.bookingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {b.bookingTime}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={b.status} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm py-3 border-y border-gray-100 mb-3">
                    <div>
                      <p className="text-xs text-gray-400 font-medium">User</p>
                      <p className="text-gray-700 font-medium">{b.userId?.name}</p>
                      <p className="text-gray-500">{b.userId?.phone}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 font-medium">Address</p>
                      <p className="text-gray-700">{b.address?.street}, {b.address?.city}, {b.address?.state} {b.address?.pincode}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    {b.status === 'assigned' && (
                      <>
                        <button onClick={() => openModal('reject', b._id)} className="btn-danger text-xs px-3 py-1.5">Reject</button>
                        <button onClick={() => openModal('accept', b._id)} className="btn-primary text-xs px-3 py-1.5">Accept</button>
                      </>
                    )}
                    {b.status === 'confirmed' && (
                      <button onClick={() => openModal('complete', b._id)} className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded-lg">Mark Complete</button>
                    )}
                  </div>
                  {b.specialRequirements && (
                    <div className="mt-3 bg-amber-50 rounded-lg p-3 text-sm text-amber-800">
                      <span className="font-medium">Note:</span> {b.specialRequirements}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <Pagination pagination={pagination} onPageChange={setPage} />
        </>
      )}

      {/* ── OFFLINE ──────────────────────────────────────────────────────────── */}
      {section === 'offline' && (
        <>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {OFFLINE_FILTER_TABS.map((s) => (
              <button
                key={s}
                onClick={() => { setOfflineFilter(s); setOfflinePage(1); }}
                className={`text-sm px-4 py-1.5 rounded-full border font-medium whitespace-nowrap capitalize transition-colors ${offlineFilter === s ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'}`}
              >
                {s || 'All'}
              </button>
            ))}
          </div>

          {offlineLoading ? (
            <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
          ) : offlineBookings.length === 0 ? (
            <div className="card text-center py-12 text-gray-400">
              <p className="text-3xl mb-2">🏠</p>
              <p className="text-sm">No {offlineFilter || ''} offline bookings</p>
            </div>
          ) : (
            <div className="space-y-4">
              {offlineBookings.map((b) => (
                <div key={b._id} className="card">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="font-semibold text-gray-900">{b.userId?.name}</p>
                      <p className="text-sm text-gray-500">{b.userId?.phone}</p>
                    </div>
                    <span className={`badge text-xs flex-shrink-0 ${OFFLINE_STATUS_STYLES[b.status] || 'bg-gray-100 text-gray-500'}`}>
                      {OFFLINE_STATUS_LABELS[b.status] || b.status}
                    </span>
                  </div>

                  {/* Event — prominent */}
                  <div className="bg-primary-50 rounded-xl px-4 py-3 mb-3">
                    <p className="text-xs text-primary-500 font-medium uppercase tracking-wide">Event</p>
                    <p className="text-lg font-bold text-primary-800">{b.eventType}</p>
                  </div>

                  {/* Date + Address */}
                  <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                    <div>
                      <p className="text-xs text-gray-400 font-medium">Date & Time</p>
                      <p className="text-gray-700">
                        {new Date(b.bookingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                      <p className="text-gray-500 text-xs">{b.bookingTime}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 font-medium">Address</p>
                      <p className="text-gray-700">{b.address?.street}, {b.address?.city}</p>
                      <p className="text-gray-700">{b.address?.state} — {b.address?.pincode}</p>
                      {b.address?.landmark && <p className="text-gray-400 text-xs">Near {b.address.landmark}</p>}
                    </div>
                  </div>

                  {/* Requirements */}
                  {b.requirements && (
                    <div className="bg-amber-50 rounded-lg p-3 text-sm text-amber-800 mb-3">
                      <span className="font-medium">Requirements:</span> {b.requirements}
                    </div>
                  )}

                  {/* Payment status (no amount shown) */}
                  <div className="flex items-center gap-2 mb-3">
                    {b.isPaid
                      ? <span className="text-xs text-green-600 font-semibold bg-green-50 px-2 py-0.5 rounded-full">✓ Payment Received</span>
                      : b.status === 'accepted'
                        ? <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">⏳ Awaiting user payment</span>
                        : null
                    }
                  </div>

                  {/* Completion date */}
                  {b.status === 'completed' && b.completedAt && (
                    <p className="text-xs text-gray-400 mb-3">Completed on {new Date(b.completedAt).toLocaleDateString('en-IN')}</p>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2 flex-wrap">
                    {b.status === 'requested' && (
                      <>
                        <button
                          onClick={() => setRejectModal({ open: true, bookingId: b._id, reason: '' })}
                          className="btn-danger text-sm px-4 py-2"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => setAcceptModal({ open: true, bookingId: b._id, note: '' })}
                          className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                        >
                          Accept Request
                        </button>
                      </>
                    )}
                    {b.status === 'confirmed' && (
                      <button
                        onClick={() => handleComplete(b._id)}
                        disabled={completing === b._id}
                        className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-medium py-2 rounded-lg transition-colors"
                      >
                        {completing === b._id ? 'Processing...' : '✓ Mark as Completed'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <Pagination pagination={offlinePagination} onPageChange={setOfflinePage} />
        </>
      )}

      {/* Regular booking confirm modal */}
      <ConfirmModal
        isOpen={modal.open}
        title={modalConfig[modal.type]?.title}
        message={modalConfig[modal.type]?.message}
        confirmText={actionLoading ? 'Processing...' : modalConfig[modal.type]?.confirm}
        danger={modalConfig[modal.type]?.danger}
        onConfirm={handleRegularAction}
        onCancel={closeModal}
      />

      {/* ── Accept offline modal ── */}
      {acceptModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Accept Booking Request</h3>
            <p className="text-sm text-gray-500 mb-4">
              The user will be notified to complete payment. You can leave an optional message.
            </p>
            <label className="label">Message for User <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea
              className="input resize-none mb-4"
              rows={3}
              placeholder="e.g. Please have the puja items ready before I arrive..."
              value={acceptModal.note}
              onChange={(e) => setAcceptModal((prev) => ({ ...prev, note: e.target.value }))}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setAcceptModal({ open: false, bookingId: '', note: '' })}
                className="btn-secondary flex-1"
                disabled={accepting}
              >
                Cancel
              </button>
              <button
                onClick={handleAccept}
                disabled={accepting}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-medium px-4 py-2 rounded-lg flex-1 transition-colors"
              >
                {accepting ? 'Accepting...' : 'Confirm Accept'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject offline modal ── */}
      {rejectModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Reject Booking Request</h3>
            <p className="text-sm text-gray-500 mb-4">Reason will be shown to the user.</p>
            <label className="label">Reason <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea
              className="input resize-none mb-4"
              rows={3}
              placeholder="Why are you unable to accept this booking?"
              value={rejectModal.reason}
              onChange={(e) => setRejectModal((prev) => ({ ...prev, reason: e.target.value }))}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setRejectModal({ open: false, bookingId: '', reason: '' })}
                className="btn-secondary flex-1"
                disabled={rejecting}
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={rejecting}
                className="btn-danger flex-1 disabled:opacity-60"
              >
                {rejecting ? 'Rejecting...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
