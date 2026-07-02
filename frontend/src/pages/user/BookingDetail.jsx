import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../services/api';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ConfirmModal from '../../components/common/ConfirmModal';
import toast from 'react-hot-toast';

const loadRazorpay = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });

export default function BookingDetail() {
  const { id } = useParams();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [paying, setPaying] = useState(false);

  const fetchBooking = () =>
    api.get(`/bookings/${id}`).then(({ data }) => setBooking(data.data)).finally(() => setLoading(false));

  useEffect(() => { fetchBooking(); }, [id]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const { data } = await api.put(`/bookings/${id}/cancel`, { reason: 'Cancelled by user.' });
      setBooking(data.data);
      toast.success('Booking cancelled.');
      setCancelModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cancellation failed.');
    } finally {
      setCancelling(false);
    }
  };

  const handlePay = async () => {
    setPaying(true);
    try {
      const loaded = await loadRazorpay();
      if (!loaded) { toast.error('Payment gateway failed to load.'); setPaying(false); return; }

      // Create a fresh Razorpay order for this booking
      const { data } = await api.post('/payments/create-order', { bookingId: booking._id });
      const { orderId, amount, currency, keyId } = data.data;

      const rzp = new window.Razorpay({
        key: keyId,
        amount,
        currency,
        name: 'Saral Pooja',
        description: booking.poojaId?.name || 'Pooja Booking',
        order_id: orderId,
        handler: async (response) => {
          try {
            const verifyRes = await api.post('/payments/verify', {
              bookingId: booking._id,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            setBooking(verifyRes.data.data.booking);
            toast.success('✅ Payment successful! Booking confirmed.');
          } catch {
            toast.error('Payment verification failed. Please contact support.');
          }
        },
        modal: {
          ondismiss: () => toast('Payment cancelled. You can try again anytime.', { icon: 'ℹ️' }),
        },
        prefill: {},
        theme: { color: '#f97316' },
      });
      rzp.open();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not initiate payment.');
    } finally {
      setPaying(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>;
  if (!booking) return <div className="card text-center py-12 text-gray-500">Booking not found.</div>;

  const canCancel = !['completed', 'cancelled'].includes(booking.status);
  const canPay = !booking.isPaid && booking.status !== 'cancelled';

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/dashboard/bookings" className="text-sm text-primary-600 hover:underline">← Bookings</Link>
      </div>

      <div className="card">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{booking.poojaId?.name}</h1>
            <p className="text-sm text-gray-500">Booking ID: {booking._id}</p>
          </div>
          <StatusBadge status={booking.status} />
        </div>

        {/* Pending payment banner */}
        {canPay && (
          <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-yellow-800">⚠️ Payment Pending</p>
              <p className="text-xs text-yellow-700 mt-0.5">Complete your payment to confirm this booking.</p>
            </div>
            <button
              onClick={handlePay}
              disabled={paying}
              className="flex-shrink-0 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors"
            >
              {paying ? 'Opening...' : '💳 Pay Now'}
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 py-4 border-y border-gray-100">
          <div>
            <p className="text-xs text-gray-400 uppercase font-medium">Date</p>
            <p className="font-medium text-gray-900">
              {new Date(booking.bookingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase font-medium">Time</p>
            <p className="font-medium text-gray-900">{booking.bookingTime}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase font-medium">Amount</p>
            <p className="font-bold text-primary-600 text-lg">₹{booking.amount?.toLocaleString('en-IN')}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase font-medium">Payment</p>
            <p className={`font-semibold ${booking.isPaid ? 'text-green-600' : 'text-red-500'}`}>
              {booking.isPaid ? '✓ Paid' : 'Pending'}
            </p>
          </div>
        </div>

        <div className="py-4 border-b border-gray-100">
          <p className="text-xs text-gray-400 uppercase font-medium mb-2">Address</p>
          <p className="text-gray-700">
            {booking.address?.street},{booking.address?.landmark && ` ${booking.address.landmark},`}{' '}
            {booking.address?.city}, {booking.address?.state} – {booking.address?.pincode}
          </p>
        </div>

        {booking.panditId && (
          <div className="py-4 border-b border-gray-100">
            <p className="text-xs text-gray-400 uppercase font-medium mb-2">Assigned Pandit</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-semibold">
                {booking.panditId.userId?.name?.charAt(0)}
              </div>
              <div>
                <p className="font-medium text-gray-900">{booking.panditId.userId?.name}</p>
                {booking.panditId.userId?.phone && <p className="text-sm text-gray-500">{booking.panditId.userId.phone}</p>}
              </div>
            </div>
          </div>
        )}

        {booking.specialRequirements && (
          <div className="py-4 border-b border-gray-100">
            <p className="text-xs text-gray-400 uppercase font-medium mb-2">Special Requirements</p>
            <p className="text-gray-700 text-sm">{booking.specialRequirements}</p>
          </div>
        )}

        {booking.status === 'cancelled' && booking.cancellationReason && (
          <div className="py-4 bg-red-50 -mx-6 px-6 mt-4 rounded-b-xl">
            <p className="text-xs text-red-400 uppercase font-medium mb-1">Cancellation Reason</p>
            <p className="text-red-700 text-sm">{booking.cancellationReason}</p>
          </div>
        )}

        {canCancel && (
          <div className="mt-4 flex items-center gap-3">
            {canPay && (
              <button onClick={handlePay} disabled={paying} className="btn-primary text-sm">
                {paying ? 'Opening...' : '💳 Pay Now'}
              </button>
            )}
            <button onClick={() => setCancelModal(true)} className="btn-danger text-sm">
              Cancel Booking
            </button>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={cancelModal}
        title="Cancel Booking"
        message="Are you sure you want to cancel this booking? This action cannot be undone."
        confirmText={cancelling ? 'Cancelling...' : 'Yes, Cancel'}
        danger
        onConfirm={handleCancel}
        onCancel={() => setCancelModal(false)}
      />
    </div>
  );
}
