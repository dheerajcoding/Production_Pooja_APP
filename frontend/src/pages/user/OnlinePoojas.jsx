import { useState, useEffect } from 'react';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

const CATEGORIES = ['All', 'Griha Pravesh', 'Satyanarayan Katha', 'Navratri', 'Ganesh Puja', 'Laxmi Puja',
  'Shradh', 'Vivah', 'Namkaran', 'Mundan', 'Rudrabhishek', 'Sundarkand Path', 'Other'];

const STATUS_STYLES = {
  pending:     'bg-yellow-100 text-yellow-800',
  confirmed:   'bg-blue-100 text-blue-800',
  in_progress: 'bg-indigo-100 text-indigo-800',
  completed:   'bg-green-100 text-green-800',
  cancelled:   'bg-red-100 text-red-800',
};
const STATUS_LABELS = {
  pending:     '⏳ Awaiting Payment',
  confirmed:   '✅ Confirmed',
  in_progress: '🙏 Pooja In Progress',
  completed:   '🎉 Completed — Video Ready',
  cancelled:   '❌ Cancelled',
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

export default function OnlinePoojas() {
  const [tab, setTab] = useState('browse');
  const [poojas, setPoojas] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [bookModal, setBookModal] = useState({ open: false, pooja: null });
  const [form, setForm] = useState({ preferredDate: '', gotraName: '', memberNames: '', wishes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [retrying, setRetrying] = useState(null); // bookingId being retried

  useEffect(() => {
    if (tab === 'browse') fetchPoojas();
    else fetchBookings();
  }, [tab]);

  const fetchPoojas = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/online-poojas?limit=30');
      setPoojas(data.data.poojas);
    } catch { toast.error('Failed to load special poojas.'); }
    finally { setLoading(false); }
  };

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/online-poojas/my/bookings');
      setBookings(data.data);
    } catch { toast.error('Failed to load bookings.'); }
    finally { setLoading(false); }
  };

  const openBook = (pooja) => {
    setForm({ preferredDate: '', gotraName: '', memberNames: '', wishes: '' });
    setBookModal({ open: true, pooja });
  };

  const handleBook = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { pooja } = bookModal;
      const bookRes = await api.post(`/online-poojas/${pooja._id}/book`, form);
      const newBooking = bookRes.data.data;

      const payRes = await api.post('/online-poojas/booking/payment/create', { bookingId: newBooking._id });
      const { orderId, amount, currency, keyId, bookingId } = payRes.data.data;

      const loaded = await loadRazorpay();
      if (!loaded) { toast.error('Payment gateway failed to load.'); setSubmitting(false); return; }

      const rzp = new window.Razorpay({
        key: keyId,
        amount,
        currency,
        name: 'Saral Pooja',
        description: pooja.name,
        order_id: orderId,
        handler: async (response) => {
          try {
            await api.post('/online-poojas/booking/payment/verify', {
              bookingId,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            toast.success('🙏 Pooja booked! Pandit will perform it soon and upload your video.');
            setBookModal({ open: false, pooja: null });
            setTab('mybookings');
          } catch { toast.error('Payment verification failed.'); }
        },
        modal: {
          ondismiss: () => {
            toast('Payment cancelled. Your booking is saved — go to My Bookings to pay anytime.', { icon: 'ℹ️', duration: 5000 });
            setBookModal({ open: false, pooja: null });
            setTab('mybookings');
          },
        },
        prefill: {},
        theme: { color: '#f97316' },
      });
      rzp.open();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Booking failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // Retry payment for a pending booking (cancelled/failed Razorpay session)
  const retryPayment = async (booking) => {
    setRetrying(booking._id);
    try {
      const loaded = await loadRazorpay();
      if (!loaded) { toast.error('Payment gateway failed to load.'); setRetrying(null); return; }

      // Create a fresh Razorpay order for this existing booking
      const payRes = await api.post('/online-poojas/booking/payment/create', { bookingId: booking._id });
      const { orderId, amount, currency, keyId, bookingId } = payRes.data.data;

      const rzp = new window.Razorpay({
        key: keyId,
        amount,
        currency,
        name: 'Saral Pooja',
        description: booking.onlinePoojaId?.name || 'Special Pooja',
        order_id: orderId,
        handler: async (response) => {
          try {
            await api.post('/online-poojas/booking/payment/verify', {
              bookingId,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            toast.success('🙏 Payment successful! Your pooja is confirmed.');
            fetchBookings();
          } catch { toast.error('Payment verification failed. Please contact support.'); }
        },
        modal: {
          ondismiss: () => { toast('Payment cancelled. You can retry anytime from My Bookings.', { icon: 'ℹ️' }); },
        },
        prefill: {},
        theme: { color: '#f97316' },
      });
      rzp.open();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to initiate payment.');
    } finally {
      setRetrying(null);
    }
  };

  const isYouTube = (url) => url && (url.includes('youtube.com') || url.includes('youtu.be'));
  const getYouTubeEmbed = (url) => {
    const match = url.match(/(?:v=|youtu\.be\/)([^&?/]+)/);
    return match ? `https://www.youtube.com/embed/${match[1]}` : null;
  };

  const filteredPoojas = category === 'All' ? poojas : poojas.filter((p) => p.category === category);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">🕉️ Special Poojas</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Book a pooja — our pandit performs it at the temple on your behalf and sends you a personal video as proof.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[['browse', '🪔 Browse Poojas'], ['mybookings', '📋 My Bookings']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === key ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── BROWSE ── */}
      {tab === 'browse' && (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`text-sm px-4 py-1.5 rounded-full border font-medium whitespace-nowrap transition-colors ${category === c ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'}`}
              >
                {c}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
          ) : filteredPoojas.length === 0 ? (
            <div className="card text-center py-12 text-gray-400">
              <p className="text-4xl mb-3">🕉️</p>
              <p>No special poojas available right now. Check back soon!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPoojas.map((p) => (
                <div key={p._id} className="card p-0 overflow-hidden flex flex-col">
                  <div className="h-40 bg-orange-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {p.image
                      ? <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                      : <span className="text-5xl">🕉️</span>}
                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    <span className="text-xs text-primary-600 bg-primary-50 px-2 py-0.5 rounded font-medium w-fit">{p.category}</span>
                    <h3 className="font-semibold text-gray-900 mt-1">{p.name}</h3>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2 flex-1">{p.description}</p>

                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-3 text-xs text-gray-500">
                      {p.panditName     && <span>🧘 {p.panditName}</span>}
                      {p.duration       && <span>⏱️ {p.duration}</span>}
                      {p.language       && <span>🗣️ {p.language}</span>}
                      {p.deliveryDays   && <span>📅 ~{p.deliveryDays} days</span>}
                      {p.templeLocation && <span className="col-span-2">📍 {p.templeLocation}</span>}
                    </div>

                    {p.includedItems?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {p.includedItems.map((item, i) => (
                          <span key={i} className="text-xs bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded">{item}</span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                      <span className="text-lg font-bold text-primary-600">₹{p.price?.toLocaleString('en-IN')}</span>
                      <button onClick={() => openBook(p)} className="btn-primary text-sm px-4 py-2">
                        Book Now
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── MY BOOKINGS ── */}
      {tab === 'mybookings' && (
        <>
          {loading ? (
            <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
          ) : bookings.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-4xl mb-3">🙏</p>
              <p className="text-gray-600 font-medium">No bookings yet.</p>
              <p className="text-sm text-gray-400 mt-1">Book a special pooja and our pandit will perform it for you.</p>
              <button onClick={() => setTab('browse')} className="btn-primary mt-4 text-sm">Browse Poojas</button>
            </div>
          ) : (
            <div className="space-y-4">
              {bookings.map((b) => (
                <div key={b._id} className="card">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900">{b.onlinePoojaId?.name}</h3>
                        <span className="text-xs text-gray-400">#{b._id.slice(-6).toUpperCase()}</span>
                      </div>
                      <p className="text-sm text-gray-500">{b.onlinePoojaId?.category}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5 text-xs text-gray-500">
                        <span>💰 ₹{b.amount?.toLocaleString('en-IN')}</span>
                        {b.preferredDate && <span>📅 Requested: {new Date(b.preferredDate).toLocaleDateString('en-IN')}</span>}
                        <span>🗓️ Booked: {new Date(b.createdAt).toLocaleDateString('en-IN')}</span>
                      </div>
                      {b.memberNames && <p className="text-xs text-gray-500 mt-1">👨‍👩‍👧 {b.memberNames}</p>}
                      {b.gotraName   && <p className="text-xs text-gray-500">📿 Gotra: {b.gotraName}</p>}
                      {b.wishes      && <p className="text-xs text-gray-400 italic mt-1">"{b.wishes}"</p>}
                      {b.adminNote   && (
                        <p className="text-xs text-indigo-700 mt-1.5 bg-indigo-50 rounded-lg px-2.5 py-1.5">
                          💬 Pandit's Note: {b.adminNote}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0 space-y-1">
                      <div>
                        <span className={`badge text-xs ${STATUS_STYLES[b.status]}`}>
                          {STATUS_LABELS[b.status] || b.status}
                        </span>
                      </div>
                      <p className={`text-xs font-medium ${b.isPaid ? 'text-green-600' : 'text-red-500'}`}>
                        {b.isPaid ? '✓ Paid' : 'Unpaid'}
                      </p>
                    </div>
                  </div>

                  {/* Pending payment — retry option */}
                  {b.status === 'pending' && !b.isPaid && (
                    <div className="mt-3 border-t border-gray-100 pt-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-yellow-700">⚠️ Payment Incomplete</p>
                        <p className="text-xs text-gray-400 mt-0.5">Your booking is saved. Complete payment to confirm your pooja.</p>
                      </div>
                      <button
                        onClick={() => retryPayment(b)}
                        disabled={retrying === b._id}
                        className="flex-shrink-0 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
                      >
                        {retrying === b._id ? 'Opening...' : '💳 Pay Now'}
                      </button>
                    </div>
                  )}

                  {/* Status messages */}
                  {b.status === 'confirmed' && (
                    <div className="mt-3 bg-blue-50 rounded-xl px-4 py-2.5 text-sm text-blue-700">
                      ✅ Booking confirmed! Our pandit will perform your pooja soon. Video will appear here after completion.
                    </div>
                  )}
                  {b.status === 'in_progress' && (
                    <div className="mt-3 bg-indigo-50 rounded-xl px-4 py-2.5 text-sm text-indigo-700">
                      🙏 Your pooja is currently being performed at the temple. Video will be uploaded shortly.
                    </div>
                  )}

                  {/* Video section */}
                  {b.status === 'completed' && (b.videoUrl || b.videoExternalUrl) && (
                    <div className="mt-4 border-t border-gray-100 pt-4">
                      <p className="text-sm font-semibold text-gray-800 mb-3">🎬 Your Personal Pooja Video</p>

                      {/* Local uploaded video — fully downloadable */}
                      {b.videoUrl && (
                        <div className="space-y-3">
                          <video
                            controls
                            className="w-full rounded-xl max-h-72 bg-black"
                            src={b.videoUrl}
                          >
                            Your browser does not support the video tag.
                          </video>
                          <div className="flex gap-3">
                            <a
                              href={b.videoUrl}
                              download={b.videoOriginalName || 'pooja-video.mp4'}
                              className="flex-1 flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold py-2.5 px-4 rounded-xl transition-colors"
                            >
                              ⬇️ Download Video
                            </a>
                            <a
                              href={b.videoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2.5 px-4 rounded-xl transition-colors"
                            >
                              🔗 Full Screen
                            </a>
                          </div>
                        </div>
                      )}

                      {/* External URL (YouTube/Drive) */}
                      {!b.videoUrl && b.videoExternalUrl && (
                        <div className="space-y-3">
                          {isYouTube(b.videoExternalUrl) && getYouTubeEmbed(b.videoExternalUrl) && (
                            <iframe
                              className="w-full rounded-xl aspect-video"
                              src={getYouTubeEmbed(b.videoExternalUrl)}
                              title="Pooja Video"
                              frameBorder="0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          )}
                          <a
                            href={b.videoExternalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold py-2.5 px-4 rounded-xl transition-colors"
                          >
                            ▶️ Watch / Download Video
                          </a>
                        </div>
                      )}

                      {b.videoUploadedAt && (
                        <p className="text-xs text-gray-400 mt-2 text-center">
                          Video uploaded on {new Date(b.videoUploadedAt).toLocaleDateString('en-IN')}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Completed but no video yet */}
                  {b.status === 'completed' && !b.videoUrl && !b.videoExternalUrl && (
                    <div className="mt-3 bg-green-50 rounded-xl px-4 py-2.5 text-sm text-green-700">
                      🎉 Pooja completed! Video is being processed and will appear here soon.
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Booking Modal ── */}
      {bookModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 my-4">
            {/* Pooja info */}
            <div className="flex items-start gap-3 mb-5 pb-4 border-b border-gray-100">
              <div className="w-14 h-14 rounded-xl bg-orange-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                {bookModal.pooja?.image
                  ? <img src={bookModal.pooja.image} alt="" className="w-full h-full object-cover rounded-xl" />
                  : <span className="text-3xl">🕉️</span>}
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg leading-tight">{bookModal.pooja?.name}</h3>
                <p className="text-sm text-gray-500">{bookModal.pooja?.category}</p>
                <p className="text-xl font-bold text-primary-600 mt-0.5">₹{bookModal.pooja?.price?.toLocaleString('en-IN')}</p>
              </div>
            </div>

            <form onSubmit={handleBook} className="space-y-3">
              <div>
                <label className="label">Preferred Date <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  type="date"
                  className="input"
                  value={form.preferredDate}
                  onChange={(e) => setForm({ ...form, preferredDate: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div>
                <label className="label">Family Members' Names <span className="text-gray-400 font-normal text-xs">(for whom the pooja is being done)</span></label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Ramesh Kumar, Sunita Devi"
                  value={form.memberNames}
                  onChange={(e) => setForm({ ...form, memberNames: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Gotra Name <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Kashyap, Bharadwaj"
                  value={form.gotraName}
                  onChange={(e) => setForm({ ...form, gotraName: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Your Wishes / Purpose</label>
                <textarea
                  className="input resize-none"
                  rows={2}
                  placeholder="e.g. Family health and prosperity, new home blessing..."
                  value={form.wishes}
                  onChange={(e) => setForm({ ...form, wishes: e.target.value })}
                />
              </div>

              <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 text-sm text-orange-800 space-y-1">
                <p className="font-semibold">📋 How it works</p>
                <p>1. Pay securely via Razorpay</p>
                <p>2. Our pandit performs the pooja at the temple for you</p>
                <p>3. A personal video is uploaded to your account</p>
                <p>4. You can watch and download your pooja video anytime</p>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setBookModal({ open: false, pooja: null })} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn-primary flex-1">
                  {submitting ? 'Processing...' : `Pay ₹${bookModal.pooja?.price?.toLocaleString('en-IN')}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
