import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const STATUS_STYLES = {
  requested: 'bg-yellow-100 text-yellow-800',
  accepted:  'bg-blue-100 text-blue-800',
  rejected:  'bg-red-100 text-red-800',
  confirmed: 'bg-indigo-100 text-indigo-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-500',
};

const STATUS_LABELS = {
  requested: '⏳ Request Sent',
  accepted:  '✅ Accepted — Pay Now',
  rejected:  '❌ Rejected',
  confirmed: '🗓️ Confirmed',
  completed: '✔ Completed',
  cancelled: 'Cancelled',
};

const loadRazorpay = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });

export default function OfflineBookings() {
  const [bookings, setBookings]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [payingId, setPayingId]         = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  const fetchBookings = useCallback(() => {
    setLoading(true);
    api.get('/offline-bookings/my')
      .then(({ data }) => setBookings(data.data))
      .catch(() => toast.error('Failed to load bookings.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this booking?')) return;
    setCancellingId(id);
    try {
      await api.put(`/offline-bookings/${id}/cancel`);
      toast.success('Booking cancelled.');
      fetchBookings();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel.');
    } finally {
      setCancellingId(null);
    }
  };

  const handlePay = async (booking) => {
    setPayingId(booking._id);
    try {
      const loaded = await loadRazorpay();
      if (!loaded) { toast.error('Payment gateway failed to load.'); setPayingId(null); return; }

      const { data: payData } = await api.post(`/offline-bookings/${booking._id}/pay/create`);
      const { orderId, amount, currency, keyId, bookingId } = payData.data;
      const panditName = booking.panditId?.userId?.name || 'Pandit';

      const rzp = new window.Razorpay({
        key:         keyId,
        amount,
        currency,
        name:        'Saral Pooja',
        description: `${booking.eventType} — ${panditName}`,
        order_id:    orderId,
        handler: async (response) => {
          try {
            await api.post(`/offline-bookings/${bookingId}/pay/verify`, {
              razorpayOrderId:   response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            toast.success('🙏 Payment successful! Booking confirmed.');
            fetchBookings();
          } catch {
            toast.error('Payment verification failed. Please contact support.');
          }
        },
        modal: { ondismiss: () => toast('Payment cancelled.', { icon: 'ℹ️' }) },
        prefill: {},
        theme: { color: '#f97316' },
      });
      rzp.open();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to initiate payment.');
    } finally {
      setPayingId(null);
    }
  };

  const getPanditPhoto    = (b) => b.panditId?.photo || b.panditId?.userId?.profilePhoto || null;
  const getPanditInitials = (b) => (b.panditId?.userId?.name || 'P').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pandit Bookings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Your offline pandit booking requests</p>
        </div>
        <Link to="/dashboard/book-pandit" className="btn-primary text-sm">+ Book Pandit</Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
      ) : bookings.length === 0 ? (
        <div className="card text-center py-20">
          <p className="text-5xl mb-4">📿</p>
          <p className="text-gray-600 font-medium">No pandit bookings yet.</p>
          <p className="text-sm text-gray-400 mt-1">Book a pandit for your next ceremony at home.</p>
          <Link to="/dashboard/book-pandit" className="btn-primary text-sm mt-4 inline-block">Browse Pandits</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((b) => {
            const photo    = getPanditPhoto(b);
            const initials = getPanditInitials(b);

            return (
              <div key={b._id} className="card">
                {/* Top row */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold overflow-hidden flex-shrink-0">
                      {photo ? <img src={photo} alt="" className="w-full h-full object-cover" /> : <span>{initials}</span>}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{b.panditId?.userId?.name || 'Pandit'}</p>
                      {b.panditId?.location && <p className="text-xs text-gray-400">📍 {b.panditId.location}</p>}
                    </div>
                  </div>
                  <span className={`badge text-xs flex-shrink-0 ${STATUS_STYLES[b.status] || 'bg-gray-100 text-gray-500'}`}>
                    {STATUS_LABELS[b.status] || b.status}
                  </span>
                </div>

                {/* Pay Now banner — shown only when accepted */}
                {b.status === 'accepted' && !b.isPaid && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-blue-800">Pandit has accepted your request!</p>
                      <p className="text-xs text-blue-600">Complete payment to confirm your booking</p>
                    </div>
                    <button
                      onClick={() => handlePay(b)}
                      disabled={payingId === b._id}
                      className="bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg whitespace-nowrap transition-colors"
                    >
                      {payingId === b._id ? 'Opening...' : `💳 Pay ₹${b.amount?.toLocaleString('en-IN')}`}
                    </button>
                  </div>
                )}

                {/* Details grid */}
                <div className="grid grid-cols-2 gap-3 text-sm py-3 border-y border-gray-100 mb-3">
                  <div>
                    <p className="text-xs text-gray-400 font-medium">Event</p>
                    <p className="font-semibold text-gray-900">{b.eventType}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium">Date & Time</p>
                    <p className="text-gray-700">
                      {new Date(b.bookingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    <p className="text-gray-500 text-xs">{b.bookingTime}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-gray-400 font-medium">Address</p>
                    <p className="text-gray-700">
                      {b.address?.street}{b.address?.landmark ? `, ${b.address.landmark}` : ''}, {b.address?.city}, {b.address?.state} — {b.address?.pincode}
                    </p>
                  </div>
                  {b.requirements && (
                    <div className="col-span-2">
                      <p className="text-xs text-gray-400 font-medium">Requirements</p>
                      <p className="text-gray-600 text-sm">{b.requirements}</p>
                    </div>
                  )}
                </div>

                {/* Fee row */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-primary-600">Fee: ₹{b.amount?.toLocaleString('en-IN')}</p>
                    {b.isPaid && <span className="text-xs text-green-600 font-semibold bg-green-50 px-2 py-0.5 rounded-full">✓ Paid</span>}
                  </div>
                  {b.status === 'completed' && b.completedAt && (
                    <p className="text-xs text-gray-400">Completed {new Date(b.completedAt).toLocaleDateString('en-IN')}</p>
                  )}
                </div>

                {/* Pandit note */}
                {b.panditNote && (
                  <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-800 mb-2">
                    <span className="font-medium">Pandit's message:</span> {b.panditNote}
                  </div>
                )}

                {/* Rejection reason */}
                {b.status === 'rejected' && b.rejectionReason && (
                  <div className="bg-red-50 rounded-lg p-3 text-sm text-red-700 mb-2">
                    <span className="font-medium">Reason:</span> {b.rejectionReason}
                  </div>
                )}

                {/* Admin note */}
                {b.adminNote && (
                  <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600 mb-2">
                    <span className="font-medium">Admin note:</span> {b.adminNote}
                  </div>
                )}

                {/* Cancel — only for requested (unpaid) */}
                {(b.status === 'requested') && !b.isPaid && (
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => handleCancel(b._id)}
                      disabled={cancellingId === b._id}
                      className="text-sm text-red-600 hover:text-red-700 font-medium disabled:opacity-60"
                    >
                      {cancellingId === b._id ? 'Cancelling...' : 'Cancel Request'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
