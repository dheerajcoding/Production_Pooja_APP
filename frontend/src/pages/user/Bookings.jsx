import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Pagination from '../../components/common/Pagination';
import toast from 'react-hot-toast';

const TABS = ['all', 'pending', 'assigned', 'confirmed', 'completed', 'cancelled'];

const loadRazorpay = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });

export default function UserBookings() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [page, setPage] = useState(1);
  const [paying, setPaying] = useState(null); // bookingId currently being paid

  const fetchBookings = () => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: 10 });
    if (tab !== 'all') params.set('status', tab);
    api.get(`/users/bookings?${params}`).then(({ data }) => {
      setBookings(data.data.bookings);
      setPagination(data.data.pagination);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchBookings(); }, [tab, page]);

  const handlePay = async (e, booking) => {
    e.preventDefault(); // stop the Link navigation
    e.stopPropagation();
    setPaying(booking._id);
    try {
      const loaded = await loadRazorpay();
      if (!loaded) { toast.error('Payment gateway failed to load.'); setPaying(null); return; }

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
            await api.post('/payments/verify', {
              bookingId: booking._id,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            toast.success('✅ Payment successful! Booking confirmed.');
            fetchBookings(); // refresh list
          } catch {
            toast.error('Payment verification failed. Please contact support.');
          }
        },
        modal: {
          ondismiss: () => toast('Payment cancelled. Click "Pay Now" anytime to retry.', { icon: 'ℹ️' }),
        },
        prefill: {},
        theme: { color: '#f97316' },
      });
      rzp.open();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not initiate payment.');
    } finally {
      setPaying(null);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">My Bookings</h1>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setPage(1); }}
            className={`text-sm px-4 py-1.5 rounded-full border font-medium whitespace-nowrap capitalize transition-colors ${tab === t ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
      ) : bookings.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-gray-500">No {tab !== 'all' ? tab : ''} bookings found.</p>
          <Link to="/dashboard/poojas" className="btn-primary text-sm mt-4 inline-block">Browse Poojas</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => {
            const isPending = !b.isPaid && b.status !== 'cancelled';
            return (
              <div key={b._id} className="card hover:shadow-md transition-shadow">
                <Link to={`/dashboard/bookings/${b._id}`} className="block">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center text-xl overflow-hidden flex-shrink-0">
                        {b.poojaId?.image
                          ? <img src={b.poojaId.image} alt="" className="w-full h-full object-cover rounded-xl" />
                          : '🪔'}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{b.poojaId?.name}</h3>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {new Date(b.bookingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {b.bookingTime}
                        </p>
                        <p className="text-sm text-gray-500">{b.address?.city}, {b.address?.state}</p>
                        {b.panditId?.userId && (
                          <p className="text-sm text-gray-600 mt-1">
                            Pandit: <span className="font-medium">{b.panditId.userId.name}</span>
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <StatusBadge status={b.status} />
                      <p className="text-sm font-semibold text-gray-900 mt-2">₹{b.amount?.toLocaleString('en-IN')}</p>
                      {b.isPaid ? (
                        <span className="text-xs text-green-600 font-medium">✓ Paid</span>
                      ) : (
                        <span className="text-xs text-red-500 font-medium">Unpaid</span>
                      )}
                    </div>
                  </div>
                </Link>

                {/* Pay Now strip — visible only on pending unpaid bookings */}
                {isPending && (
                  <div className="mt-3 pt-3 border-t border-yellow-100 flex items-center justify-between gap-3 bg-yellow-50 -mx-6 px-6 pb-1 rounded-b-xl">
                    <p className="text-xs text-yellow-700 font-medium">⚠️ Payment pending — your booking is saved</p>
                    <button
                      onClick={(e) => handlePay(e, b)}
                      disabled={paying === b._id}
                      className="flex-shrink-0 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors"
                    >
                      {paying === b._id ? 'Opening...' : '💳 Pay Now'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Pagination pagination={pagination} onPageChange={setPage} />
    </div>
  );
}
