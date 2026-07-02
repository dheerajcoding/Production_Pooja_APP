import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/common/LoadingSpinner';

import img1  from '../../images/image1.jpg';
import img2  from '../../images/image2.jpg';
import img3  from '../../images/image3.jpg';
import img5  from '../../images/image5.jpg';
import img6  from '../../images/image6.jpg';
import img10 from '../../images/image10.jpg';
import img12 from '../../images/image12.jpg';
import img13 from '../../images/image13.jpg';
import img15 from '../../images/image15.png';
import img16 from '../../images/image16.jpg';

// ── Service Slides ──────────────────────────────────────────────────────────
const SLIDES = [
  {
    category: 'Griha Pravesh',
    title: 'Griha Pravesh',
    subtitle: 'Housewarming Ceremony',
    desc: 'Bless your new home with sacred Vastu rituals performed by our expert pandits.',
    icon: '🏠',
    bg: 'from-orange-600 to-rose-500',
    badge: 'Most Booked',
    badgeColor: 'bg-white/20 text-white',
    image: img1,
  },
  {
    category: 'Vivah',
    title: 'Vivah Sanskar',
    subtitle: 'Sacred Wedding Ceremonies',
    desc: 'Make your wedding divine with authentic Vedic rituals and experienced pandits.',
    icon: '💍',
    bg: 'from-pink-600 to-rose-600',
    badge: 'Premium',
    badgeColor: 'bg-white/20 text-white',
    image: img3,
  },
  {
    category: 'Satyanarayan Katha',
    title: 'Satyanarayan Katha',
    subtitle: 'Sacred Katha & Prasad',
    desc: 'Invite blessings of Lord Vishnu with the holy Satyanarayan Vrat Katha at your home.',
    icon: '📖',
    bg: 'from-violet-600 to-purple-600',
    badge: 'Popular',
    badgeColor: 'bg-white/20 text-white',
    image: img12,
  },
  {
    category: 'Ganesh Puja',
    title: 'Ganesh Puja',
    subtitle: 'Remove Obstacles, Invite Success',
    desc: 'Begin every auspicious occasion with Ganesh Puja — for success and blessings.',
    icon: '🐘',
    bg: 'from-yellow-500 to-orange-500',
    badge: 'Auspicious',
    badgeColor: 'bg-white/20 text-white',
    image: img5,
  },
  {
    category: 'Laxmi Puja',
    title: 'Laxmi Puja',
    subtitle: 'Prosperity & Wealth Rituals',
    desc: 'Invoke Goddess Laxmi\'s blessings for wealth, prosperity and abundance in your life.',
    icon: '🪙',
    bg: 'from-amber-500 to-yellow-600',
    badge: 'Trending',
    badgeColor: 'bg-white/20 text-white',
    image: img15,
  },
  {
    category: 'Navratri',
    title: 'Navratri Puja',
    subtitle: 'Nine Nights of Devotion',
    desc: 'Celebrate the divine feminine with traditional Navratri puja and aarti at home.',
    icon: '🌺',
    bg: 'from-red-600 to-pink-600',
    badge: 'Festival Special',
    badgeColor: 'bg-white/20 text-white',
    image: img13,
  },
  {
    category: 'Namkaran',
    title: 'Namkaran Sanskar',
    subtitle: 'Baby Naming Ceremony',
    desc: 'Celebrate your baby\'s name with this sacred first Hindu rite of passage.',
    icon: '👶',
    bg: 'from-sky-500 to-blue-600',
    badge: 'Life Event',
    badgeColor: 'bg-white/20 text-white',
    image: img2,
  },
  {
    category: 'Mundan',
    title: 'Mundan Ceremony',
    subtitle: 'First Sacred Haircut',
    desc: 'Mark your child\'s first haircut with this beautiful Vedic ritual full of blessings.',
    icon: '✂️',
    bg: 'from-teal-500 to-emerald-600',
    badge: 'Life Event',
    badgeColor: 'bg-white/20 text-white',
    image: img10,
  },
];

// ── Banner Slider Component ─────────────────────────────────────────────────
function ServiceBanner() {
  const [current, setCurrent]   = useState(0);
  const [paused, setPaused]     = useState(false);
  const [animating, setAnimating] = useState(false);
  const timerRef = useRef(null);

  const goTo = useCallback((idx) => {
    if (animating) return;
    setAnimating(true);
    setCurrent(idx);
    setTimeout(() => setAnimating(false), 400);
  }, [animating]);

  const prev = () => goTo((current - 1 + SLIDES.length) % SLIDES.length);
  const next = useCallback(() => goTo((current + 1) % SLIDES.length), [current, goTo]);

  useEffect(() => {
    if (paused) { clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(next, 4000);
    return () => clearInterval(timerRef.current);
  }, [paused, next]);

  const slide = SLIDES[current];

  return (
    <div
      className="relative rounded-2xl overflow-hidden select-none"
      style={{ height: '180px' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Slide background — crossfade with image */}
      {SLIDES.map((s, i) => (
        <div
          key={i}
          className={`absolute inset-0 transition-opacity duration-500 ${i === current ? 'opacity-100' : 'opacity-0'}`}
        >
          {/* Photo on right */}
          {s.image && (
            <img
              src={s.image}
              alt=""
              className="absolute right-0 top-0 h-full w-1/2 object-cover"
            />
          )}
          {/* Gradient overlay — strong on left, fades to semi-transparent on right */}
          <div className={`absolute inset-0 bg-gradient-to-r ${s.bg}`} style={{ opacity: s.image ? 0.82 : 1 }} />
        </div>
      ))}

      {/* Content */}
      <div className="relative h-full flex items-center px-6 pr-28">
        <div
          key={current}
          className="flex items-center gap-5"
          style={{ animation: 'slideIn 0.4s ease-out' }}
        >
          <div className="text-6xl flex-shrink-0 drop-shadow-md" style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.15))' }}>
            {slide.icon}
          </div>
          <div className="text-white min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${slide.badgeColor}`}>
                {slide.badge}
              </span>
            </div>
            <h2 className="text-xl font-bold leading-tight">{slide.title}</h2>
            <p className="text-white/80 text-xs font-medium mt-0.5">{slide.subtitle}</p>
            <p className="text-white/70 text-xs mt-1 line-clamp-2 max-w-xs">{slide.desc}</p>
            <Link
              to={`/dashboard/poojas?category=${encodeURIComponent(slide.category)}`}
              className="inline-flex items-center gap-1 mt-3 bg-white/90 hover:bg-white text-gray-900 font-semibold text-xs px-4 py-1.5 rounded-lg transition-colors shadow-sm"
            >
              Book Now →
            </Link>
          </div>
        </div>
      </div>

      {/* Left arrow */}
      <button
        onClick={prev}
        className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 text-white flex items-center justify-center transition-colors z-10"
        aria-label="Previous"
      >
        ‹
      </button>

      {/* Right arrow */}
      <button
        onClick={next}
        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 text-white flex items-center justify-center transition-colors z-10"
        aria-label="Next"
      >
        ›
      </button>

      {/* Dots */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`rounded-full transition-all duration-300 ${i === current ? 'bg-white w-5 h-1.5' : 'bg-white/50 w-1.5 h-1.5'}`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>

      {/* Progress bar */}
      {!paused && (
        <div className="absolute bottom-0 left-0 h-0.5 bg-white/40 w-full">
          <div
            key={`${current}-progress`}
            className="h-full bg-white/80 rounded-full"
            style={{ animation: 'progress 4s linear forwards' }}
          />
        </div>
      )}

      {/* CSS animations */}
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes progress {
          from { width: 0%; }
          to   { width: 100%; }
        }
      `}</style>
    </div>
  );
}

const STATUS_STYLES = {
  pending:   'bg-yellow-100 text-yellow-700',
  assigned:  'bg-blue-100 text-blue-700',
  confirmed: 'bg-indigo-100 text-indigo-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

const STATUS_LABELS = {
  pending:   'Pending',
  assigned:  'Pandit Assigned',
  confirmed: 'Confirmed',
  completed: 'Completed',
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

export default function UserDashboard() {
  const { user } = useAuth();
  const navigate  = useNavigate();

  const [bookings, setBookings]           = useState([]);
  const [offlineBookings, setOfflineBookings] = useState([]);
  const [orders, setOrders]               = useState([]);
  const [loading, setLoading]             = useState(true);
  const [payingId, setPayingId]           = useState(null);

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  useEffect(() => {
    Promise.all([
      api.get('/users/bookings?limit=5'),
      api.get('/offline-bookings/my'),
      api.get('/orders?limit=3').catch(() => ({ data: { data: { orders: [] } } })),
    ]).then(([b, o, ord]) => {
      setBookings(b.data.data.bookings || []);
      setOfflineBookings((o.data.data || []).slice(0, 3));
      setOrders(ord.data.data?.orders || []);
    }).finally(() => setLoading(false));
  }, []);

  const counts = {
    pending:   bookings.filter((b) => b.status === 'pending').length,
    upcoming:  bookings.filter((b) => ['assigned', 'confirmed'].includes(b.status)).length,
    completed: bookings.filter((b) => b.status === 'completed').length,
  };

  const pendingPayments = bookings.filter((b) => b.status === 'pending' && !b.isPaid);
  const acceptedOffline = offlineBookings.filter((b) => b.status === 'accepted' && !b.isPaid);

  const handlePayBooking = async (b) => {
    setPayingId(b._id);
    try {
      const loaded = await loadRazorpay();
      if (!loaded) { alert('Payment gateway failed to load.'); setPayingId(null); return; }
      const { data } = await api.post('/payments/create-order', { bookingId: b._id });
      const { orderId, amount, currency, keyId } = data.data;
      const rzp = new window.Razorpay({
        key: keyId, amount, currency, name: 'Saral Pooja',
        description: b.poojaId?.name || 'Pooja Booking',
        order_id: orderId,
        handler: async (res) => {
          await api.post('/payments/verify', {
            bookingId: b._id,
            razorpayOrderId: res.razorpay_order_id,
            razorpayPaymentId: res.razorpay_payment_id,
            razorpaySignature: res.razorpay_signature,
          });
          window.location.reload();
        },
        theme: { color: '#f97316' },
      });
      rzp.open();
    } catch { /* handled by rzp */ } finally { setPayingId(null); }
  };

  const QUICK_ACTIONS = [
    { icon: '🪔', label: 'Book a Pooja',     desc: 'Browse ceremonies',    to: '/dashboard/poojas',          bg: 'bg-orange-50 hover:bg-orange-100 border-orange-100' },
    { icon: '🧘', label: 'Book a Pandit',    desc: 'Home ceremonies',      to: '/dashboard/book-pandit',     bg: 'bg-amber-50 hover:bg-amber-100 border-amber-100' },
    { icon: '🕉️', label: 'Special Poojas',  desc: 'Temple ceremonies',    to: '/dashboard/online-poojas',   bg: 'bg-yellow-50 hover:bg-yellow-100 border-yellow-100' },
    { icon: '🛍️', label: 'Pooja Shop',       desc: 'Samagri & items',      to: '/dashboard/shop',            bg: 'bg-green-50 hover:bg-green-100 border-green-100' },
    { icon: '📋', label: 'My Bookings',      desc: 'Track ceremonies',     to: '/dashboard/bookings',        bg: 'bg-blue-50 hover:bg-blue-100 border-blue-100' },
    { icon: '📦', label: 'My Orders',        desc: 'Order history',        to: '/dashboard/orders',          bg: 'bg-purple-50 hover:bg-purple-100 border-purple-100' },
  ];

  return (
    <div className="space-y-5">

      {/* ── Hero Banner ── */}
      <div className="relative rounded-2xl overflow-hidden" style={{ minHeight: '160px' }}>
        {/* Background image */}
        <img src={img6} alt="" className="absolute inset-0 w-full h-full object-cover object-top" />
        {/* Gradient overlay — strong on left for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-r from-orange-900/90 via-orange-700/75 to-orange-500/30" />
        {/* Content */}
        <div className="relative z-10 p-6 text-white">
          <p className="text-orange-200 text-xs font-medium mb-1">{dateStr}</p>
          <h1 className="text-2xl font-bold drop-shadow">Namaste, {user?.name?.split(' ')[0]} 🙏</h1>
          <p className="text-orange-100 text-sm mt-1">Welcome to Saral Pooja. What would you like to do today?</p>
          <div className="flex gap-3 mt-4 flex-wrap">
            <Link to="/dashboard/poojas" className="bg-white text-orange-700 text-sm font-bold px-4 py-2 rounded-lg hover:bg-orange-50 transition-colors shadow">
              Browse Poojas →
            </Link>
            <Link to="/dashboard/book-pandit" className="bg-white/20 hover:bg-white/30 text-white text-sm font-semibold px-4 py-2 rounded-lg border border-white/30 transition-colors backdrop-blur-sm">
              Book Pandit
            </Link>
          </div>
        </div>
      </div>

      {/* ── Service Slider ── */}
      <ServiceBanner />

      {/* ── Alerts ── */}
      {(pendingPayments.length > 0 || acceptedOffline.length > 0) && (
        <div className="space-y-2">
          {pendingPayments.map((b) => (
            <div key={b._id} className="flex items-center justify-between gap-3 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-lg flex-shrink-0">⚠️</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-yellow-800 truncate">Payment pending: {b.poojaId?.name}</p>
                  <p className="text-xs text-yellow-600">{new Date(b.bookingDate).toLocaleDateString('en-IN')} · ₹{b.amount?.toLocaleString('en-IN')}</p>
                </div>
              </div>
              <button
                onClick={() => handlePayBooking(b)}
                disabled={payingId === b._id}
                className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex-shrink-0 disabled:opacity-60 transition-colors"
              >
                {payingId === b._id ? '...' : '💳 Pay Now'}
              </button>
            </div>
          ))}
          {acceptedOffline.map((b) => (
            <div key={b._id} className="flex items-center justify-between gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-lg flex-shrink-0">✅</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-blue-800 truncate">Pandit accepted: {b.eventType}</p>
                  <p className="text-xs text-blue-600">Pay ₹{b.amount?.toLocaleString('en-IN')} to confirm booking</p>
                </div>
              </div>
              <Link to="/dashboard/offline-bookings" className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex-shrink-0 transition-colors">
                💳 Pay Now
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Pending',   count: counts.pending,   color: 'bg-yellow-50 border border-yellow-100', textColor: 'text-yellow-600', to: '/dashboard/bookings', icon: '⏳' },
          { label: 'Upcoming',  count: counts.upcoming,  color: 'bg-blue-50 border border-blue-100',     textColor: 'text-blue-600',   to: '/dashboard/bookings', icon: '🗓️' },
          { label: 'Completed', count: counts.completed, color: 'bg-green-50 border border-green-100',   textColor: 'text-green-600',  to: '/dashboard/bookings', icon: '✅' },
        ].map((s) => (
          <Link key={s.label} to={s.to} className={`rounded-xl p-3 text-center cursor-pointer transition-transform hover:scale-105 active:scale-95 ${s.color}`}>
            <p className="text-lg mb-0.5">{s.icon}</p>
            <p className={`text-2xl font-bold ${s.textColor}`}>{loading ? '–' : s.count}</p>
            <p className={`text-xs font-medium ${s.textColor} opacity-80`}>{s.label}</p>
          </Link>
        ))}
      </div>

      {/* ── Quick Actions Grid ── */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {QUICK_ACTIONS.map((a) => (
            <Link
              key={a.label}
              to={a.to}
              className={`flex items-center gap-3 border rounded-xl p-3 transition-all hover:-translate-y-0.5 hover:shadow-sm ${a.bg}`}
            >
              <span className="text-2xl flex-shrink-0">{a.icon}</span>
              <div className="min-w-0">
                <p className="font-semibold text-sm text-gray-900 truncate">{a.label}</p>
                <p className="text-xs text-gray-500 truncate">{a.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><LoadingSpinner size="lg" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* ── Recent Bookings ── */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Recent Pooja Bookings</h2>
              <Link to="/dashboard/bookings" className="text-xs text-primary-600 hover:underline font-medium">View all →</Link>
            </div>
            {bookings.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-4xl mb-2">🪔</p>
                <p className="text-gray-400 text-sm">No bookings yet</p>
                <Link to="/dashboard/poojas" className="text-primary-600 text-sm font-medium hover:underline mt-1 inline-block">Book your first pooja →</Link>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {bookings.slice(0, 4).map((b) => (
                  <Link key={b._id} to={`/dashboard/bookings/${b._id}`} className="flex items-center gap-3 py-2.5 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors group">
                    <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center text-lg overflow-hidden flex-shrink-0">
                      {b.poojaId?.image ? <img src={b.poojaId.image} alt="" className="w-full h-full object-cover rounded-lg" /> : '🪔'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate group-hover:text-primary-600">{b.poojaId?.name}</p>
                      <p className="text-xs text-gray-400">{new Date(b.bookingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {b.bookingTime}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[b.status] || 'bg-gray-100 text-gray-500'}`}>
                        {STATUS_LABELS[b.status] || b.status}
                      </span>
                      <p className="text-xs text-gray-500">₹{b.amount?.toLocaleString('en-IN')}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* ── Pandit Bookings ── */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">🏠 Pandit Bookings</h2>
              <Link to="/dashboard/offline-bookings" className="text-xs text-primary-600 hover:underline font-medium">View all →</Link>
            </div>
            {offlineBookings.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-4xl mb-2">🧘</p>
                <p className="text-gray-400 text-sm">No pandit bookings yet</p>
                <Link to="/dashboard/book-pandit" className="text-primary-600 text-sm font-medium hover:underline mt-1 inline-block">Book a pandit →</Link>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {offlineBookings.map((b) => {
                  const statusStyle = {
                    requested: 'bg-yellow-100 text-yellow-700',
                    accepted:  'bg-blue-100 text-blue-700',
                    confirmed: 'bg-indigo-100 text-indigo-700',
                    completed: 'bg-green-100 text-green-700',
                    rejected:  'bg-red-100 text-red-600',
                    cancelled: 'bg-gray-100 text-gray-500',
                  }[b.status] || 'bg-gray-100 text-gray-500';
                  const statusLabel = { requested: 'Requested', accepted: 'Accepted ✓', confirmed: 'Confirmed', completed: 'Completed', rejected: 'Rejected', cancelled: 'Cancelled' }[b.status] || b.status;
                  return (
                    <Link key={b._id} to="/dashboard/offline-bookings" className="flex items-center gap-3 py-2.5 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors group">
                      <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-lg flex-shrink-0">🏠</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate group-hover:text-primary-600">{b.eventType}</p>
                        <p className="text-xs text-gray-400">{b.panditId?.userId?.name} · {new Date(b.bookingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusStyle}`}>{statusLabel}</span>
                        <p className="text-xs text-gray-500">₹{b.amount?.toLocaleString('en-IN')}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
            <div className="mt-3 pt-3 border-t border-gray-50">
              <Link to="/dashboard/book-pandit" className="flex items-center justify-center gap-2 text-sm text-primary-600 font-medium hover:text-primary-700 transition-colors">
                <span>+</span> Book another pandit
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Feature Banners ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link to="/dashboard/online-poojas" className="relative rounded-xl overflow-hidden h-24 hover:shadow-lg transition-all hover:-translate-y-0.5 group">
          <img src={img16} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          <div className="absolute inset-0 bg-gradient-to-r from-violet-900/90 to-purple-700/60" />
          <div className="relative z-10 flex items-center gap-3 p-4 h-full text-white">
            <span className="text-3xl drop-shadow">🕉️</span>
            <div>
              <p className="font-bold text-sm">Special Poojas</p>
              <p className="text-xs text-purple-200">Pandit performs at temple • Video delivered</p>
            </div>
            <span className="ml-auto text-white/70 text-xl">›</span>
          </div>
        </Link>
        <Link to="/dashboard/shop" className="relative rounded-xl overflow-hidden h-24 hover:shadow-lg transition-all hover:-translate-y-0.5 group">
          <img src={img2} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          <div className="absolute inset-0 bg-gradient-to-r from-green-900/90 to-emerald-700/60" />
          <div className="relative z-10 flex items-center gap-3 p-4 h-full text-white">
            <span className="text-3xl drop-shadow">🛍️</span>
            <div>
              <p className="font-bold text-sm">Pooja Shop</p>
              <p className="text-xs text-green-200">Samagri, idols &amp; puja essentials</p>
            </div>
            <span className="ml-auto text-white/70 text-xl">›</span>
          </div>
        </Link>
      </div>

    </div>
  );
}
