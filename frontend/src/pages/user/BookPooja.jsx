import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const loadRazorpay = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

export default function BookPooja() {
  const { poojaId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pooja, setPooja] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    bookingDate: '',
    bookingTime: '',
    specialRequirements: '',
    address: {
      street: user?.address?.street || '',
      city: user?.address?.city || '',
      state: user?.address?.state || '',
      pincode: user?.address?.pincode || '',
      landmark: '',
    },
  });

  useEffect(() => {
    api.get(`/poojas/${poojaId}`).then(({ data }) => setPooja(data.data)).finally(() => setLoading(false));
  }, [poojaId]);

  const handleBook = async (e) => {
    e.preventDefault();
    if (!form.bookingDate || !form.bookingTime) return toast.error('Please select date and time.');

    setSubmitting(true);
    try {
      const { data: bookingRes } = await api.post('/bookings', { poojaId, ...form });
      const booking = bookingRes.data;

      const loaded = await loadRazorpay();
      if (!loaded) return toast.error('Payment gateway failed to load. Please try again.');

      const { data: orderRes } = await api.post('/payments/create-order', { bookingId: booking._id });
      const { orderId, amount, currency, keyId } = orderRes.data;

      const options = {
        key: keyId,
        amount,
        currency,
        name: 'Saral Pooja',
        description: pooja.name,
        order_id: orderId,
        prefill: { name: user?.name, email: user?.email, contact: user?.phone },
        theme: { color: '#f97316' },
        handler: async (response) => {
          try {
            await api.post('/payments/verify', {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              bookingId: booking._id,
            });
            toast.success('Booking confirmed! Payment received.');
            navigate(`/dashboard/bookings/${booking._id}`);
          } catch {
            toast.error('Payment verification failed. Contact support.');
          }
        },
        modal: {
          ondismiss: () => {
            toast('Payment cancelled. Your booking is saved — you can pay later.', { icon: 'ℹ️' });
            navigate('/dashboard/bookings');
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Booking failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>;
  if (!pooja) return <div className="card text-center py-12 text-gray-500">Pooja not found.</div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Book Pooja</h1>
        <p className="text-gray-500 text-sm mt-1">Fill in details for your ceremony</p>
      </div>

      {/* Pooja Summary */}
      <div className="card bg-orange-50 border-orange-100">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-white flex items-center justify-center overflow-hidden">
            {pooja.image ? <img src={pooja.image} alt="" className="w-full h-full object-cover" /> : <span className="text-3xl">🪔</span>}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{pooja.name}</h3>
            <p className="text-sm text-gray-500">{pooja.category} · {pooja.duration}</p>
            <p className="text-xl font-bold text-primary-600 mt-1">₹{pooja.price.toLocaleString('en-IN')}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleBook} className="space-y-5">
        {/* Date & Time */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Schedule</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Date *</label>
              <input type="date" className="input" min={today} value={form.bookingDate} onChange={(e) => setForm({ ...form, bookingDate: e.target.value })} required />
            </div>
            <div>
              <label className="label">Time *</label>
              <input type="time" className="input" value={form.bookingTime} onChange={(e) => setForm({ ...form, bookingTime: e.target.value })} required />
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Ceremony Address</h3>
          <div className="space-y-3">
            <div>
              <label className="label">Street Address *</label>
              <input type="text" className="input" placeholder="House No., Street, Area" value={form.address.street} onChange={(e) => setForm({ ...form, address: { ...form.address, street: e.target.value } })} required />
            </div>
            <div>
              <label className="label">Landmark</label>
              <input type="text" className="input" placeholder="Near temple, school, etc." value={form.address.landmark} onChange={(e) => setForm({ ...form, address: { ...form.address, landmark: e.target.value } })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">City *</label>
                <input type="text" className="input" value={form.address.city} onChange={(e) => setForm({ ...form, address: { ...form.address, city: e.target.value } })} required />
              </div>
              <div>
                <label className="label">State *</label>
                <input type="text" className="input" value={form.address.state} onChange={(e) => setForm({ ...form, address: { ...form.address, state: e.target.value } })} required />
              </div>
            </div>
            <div>
              <label className="label">Pincode *</label>
              <input type="text" className="input" pattern="[0-9]{6}" placeholder="6-digit pincode" value={form.address.pincode} onChange={(e) => setForm({ ...form, address: { ...form.address, pincode: e.target.value } })} required />
            </div>
          </div>
        </div>

        {/* Special Requirements */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-3">Special Requirements</h3>
          <textarea
            className="input resize-none"
            rows={3}
            placeholder="Any special requirements or notes for the pandit..."
            value={form.specialRequirements}
            onChange={(e) => setForm({ ...form, specialRequirements: e.target.value })}
            maxLength={500}
          />
          <p className="text-xs text-gray-400 mt-1">{form.specialRequirements.length}/500</p>
        </div>

        <div className="card bg-gray-50">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Pooja Fee</span>
            <span>₹{pooja.price.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between font-bold text-gray-900 text-base border-t pt-2">
            <span>Total Amount</span>
            <span className="text-primary-600">₹{pooja.price.toLocaleString('en-IN')}</span>
          </div>
        </div>

        <button type="submit" disabled={submitting} className="btn-primary w-full py-3 text-base">
          {submitting ? 'Processing...' : `Proceed to Pay ₹${pooja.price.toLocaleString('en-IN')}`}
        </button>
        <p className="text-center text-xs text-gray-400">🔒 Secured by Razorpay. We accept UPI, Cards, Net Banking.</p>
      </form>
    </div>
  );
}
