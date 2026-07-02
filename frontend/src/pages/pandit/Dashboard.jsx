import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

import img11 from '../../images/image11.jpg';
import img12 from '../../images/image12.jpg';

// Format date as "Somvar, 9 June 2026"
function formatDate(d) {
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// Format booking date nicely
function fmtBookingDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
}

export default function PanditDashboard() {
  const { user } = useAuth();

  const [bookings, setBookings]                         = useState([]);
  const [profile, setProfile]                           = useState(null);
  const [loading, setLoading]                           = useState(true);
  const [toggling, setToggling]                         = useState(false);
  const [upcomingOffline, setUpcomingOffline]           = useState([]);
  const [upcomingOfflineTotal, setUpcomingOfflineTotal] = useState(0);
  const [newRequestCount, setNewRequestCount]           = useState(0);
  const [totalBookings, setTotalBookings]               = useState(0);
  const [completedBookings, setCompletedBookings]       = useState(0);

  const today = new Date();

  useEffect(() => {
    Promise.all([
      api.get('/pandits/bookings?status=assigned&limit=5'),
      api.get('/pandits/profile'),
      api.get('/offline-bookings/pandit/bookings?status=confirmed&limit=5'),
      api.get('/offline-bookings/pandit/bookings?status=requested&limit=1'),
      api.get('/pandits/earnings'),
    ]).then(([b, p, o, r, e]) => {
      setBookings(b.data.data.bookings || []);
      setProfile(p.data.data);
      setUpcomingOffline(o.data.data.bookings || []);
      setUpcomingOfflineTotal(o.data.data.pagination?.total || 0);
      setNewRequestCount(r.data.data.pagination?.total || 0);
      setTotalBookings(e.data.data?.totalBookings || 0);
      setCompletedBookings(e.data.data?.completedBookings || 0);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const toggleAvailability = async () => {
    setToggling(true);
    try {
      const { data } = await api.put('/pandits/availability');
      setProfile((prev) => ({ ...prev, isAvailable: data.data.isAvailable }));
      toast.success(data.message);
    } catch {
      toast.error('Could not update. Please try again.');
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <LoadingSpinner size="lg" />
        <p className="text-gray-400 text-sm">Loading your dashboard...</p>
      </div>
    );
  }

  if (!profile?.isApproved) {
    return (
      <div className="max-w-sm mx-auto mt-10 px-4">
        <div className="bg-white rounded-3xl shadow-lg text-center py-12 px-6">
          <div className="text-7xl mb-4">⏳</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Verification Pending</h2>
          <p className="text-base text-gray-500 mb-2">
            <span className="font-semibold text-amber-600">Admin ji</span> is reviewing your profile.
          </p>
          <p className="text-sm text-gray-400 mb-6">You will get access once approved.</p>
          <Link
            to="/pandit/profile"
            className="block w-full bg-orange-500 hover:bg-orange-600 text-white text-base font-bold py-3 rounded-xl transition-colors"
          >
            📝 Complete My Profile
          </Link>
        </div>
      </div>
    );
  }

  const totalPending  = bookings.length + newRequestCount;
  const initials = (user?.name || 'P').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="space-y-4 pb-6">

      {/* ══════════════════════════════════════
          HEADER — Greeting + Date + Availability
      ══════════════════════════════════════ */}
      <div className="relative bg-gradient-to-br from-orange-600 via-orange-500 to-amber-400 rounded-3xl p-5 text-white overflow-hidden">
        {/* Pandit puja image — right side decorative */}
        <img src={img11} alt="" className="absolute right-0 top-0 h-full w-2/5 object-cover opacity-30" style={{ objectPosition: 'center top' }} />
        <div className="absolute inset-0 bg-gradient-to-r from-orange-600/95 via-orange-500/80 to-transparent pointer-events-none" />

        {/* Top row: avatar + greeting */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-14 h-14 rounded-full bg-white/25 border-2 border-white/50 flex items-center justify-center text-white font-bold text-xl flex-shrink-0 overflow-hidden">
            {profile?.photo
              ? <img src={profile.photo} alt="" className="w-full h-full object-cover" />
              : <span>{initials}</span>}
          </div>
          <div>
            <p className="text-white/80 text-xs">{formatDate(today)}</p>
            <h1 className="text-xl font-bold leading-tight">Namaste, {user?.name?.split(' ')[0]} ji 🙏</h1>
            <p className="text-white/70 text-xs mt-0.5">Aaj ka din subha ho!</p>
          </div>
        </div>

        {/* BIG Availability toggle */}
        <div className="bg-black/15 rounded-2xl p-3">
          <p className="text-white/80 text-xs font-medium mb-2 text-center">
            Kya aap aaj pooja ke liye available hain?
          </p>
          <button
            onClick={toggleAvailability}
            disabled={toggling}
            className={`w-full py-3 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-3 active:scale-95 ${
              profile?.isAvailable
                ? 'bg-green-500 hover:bg-green-400 text-white shadow-lg'
                : 'bg-white/20 hover:bg-white/30 text-white border-2 border-dashed border-white/50'
            }`}
          >
            {toggling ? (
              <>⏳ Updating...</>
            ) : profile?.isAvailable ? (
              <><span className="text-2xl">🟢</span> AVAILABLE — Booking Open</>
            ) : (
              <><span className="text-2xl">🔴</span> NOT AVAILABLE — Tap to Open</>
            )}
          </button>
          <p className="text-white/60 text-xs text-center mt-1.5">
            {profile?.isAvailable
              ? 'Users can book you right now'
              : 'Turn ON so users can book you'}
          </p>
        </div>
      </div>

      {/* ══════════════════════════════════════
          ACTION NEEDED — New Requests (most important)
      ══════════════════════════════════════ */}
      {(newRequestCount > 0 || bookings.length > 0) && (
        <div className="bg-red-50 border-2 border-red-200 rounded-3xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl animate-bounce">🔔</span>
            <div>
              <p className="text-base font-bold text-red-800">Action Needed!</p>
              <p className="text-xs text-red-500">Aapko kuch karna hai abhi</p>
            </div>
            <span className="ml-auto bg-red-500 text-white text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0">
              {totalPending}
            </span>
          </div>

          <div className="space-y-2">
            {/* Offline requests */}
            {newRequestCount > 0 && (
              <Link
                to="/pandit/bookings"
                className="flex items-center gap-3 bg-white border border-red-200 rounded-2xl px-4 py-3 hover:bg-red-50 transition-colors active:scale-98"
              >
                <span className="text-3xl flex-shrink-0">🏠</span>
                <div className="flex-1">
                  <p className="font-bold text-gray-900 text-sm">
                    {newRequestCount} Home Visit Request{newRequestCount > 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-gray-500">Ghar mein pooja ke liye request aayi hai</p>
                </div>
                <div className="bg-orange-500 text-white text-xs font-bold px-3 py-2 rounded-xl flex-shrink-0">
                  Dekho →
                </div>
              </Link>
            )}

            {/* Regular bookings pending */}
            {bookings.length > 0 && (
              <Link
                to="/pandit/bookings"
                className="flex items-center gap-3 bg-white border border-orange-200 rounded-2xl px-4 py-3 hover:bg-orange-50 transition-colors"
              >
                <span className="text-3xl flex-shrink-0">🪔</span>
                <div className="flex-1">
                  <p className="font-bold text-gray-900 text-sm">
                    {bookings.length} Pooja Booking{bookings.length > 1 ? 's' : ''} Waiting
                  </p>
                  <p className="text-xs text-gray-500">Accept ya reject karo</p>
                </div>
                <div className="bg-orange-500 text-white text-xs font-bold px-3 py-2 rounded-xl flex-shrink-0">
                  Dekho →
                </div>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          HOW IT WORKS — Simple 3-step guide
      ══════════════════════════════════════ */}
      <div className="bg-blue-50 border border-blue-100 rounded-3xl p-4">
        <p className="text-sm font-bold text-blue-800 mb-3 text-center">📖 Kaise Kaam Karta Hai?</p>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { step: '1', icon: '📩', title: 'Request Aati Hai', sub: 'User books you' },
            { step: '2', icon: '✅', title: 'Aap Accept Karo', sub: 'You say Yes/No' },
            { step: '3', icon: '🏠', title: 'Pooja Karo', sub: 'Go & complete it' },
          ].map((s) => (
            <div key={s.step} className="bg-white rounded-2xl py-3 px-2 relative">
              <div className="absolute -top-2 -left-1 bg-blue-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {s.step}
              </div>
              <p className="text-3xl mb-1">{s.icon}</p>
              <p className="text-xs font-bold text-gray-800 leading-tight">{s.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════
          MY NUMBERS — Simple counts
      ══════════════════════════════════════ */}
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">Mera Record</p>
        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/pandit/bookings"
            className="bg-white border border-gray-200 rounded-2xl p-4 text-center hover:shadow-md hover:-translate-y-0.5 transition-all active:scale-95"
          >
            <p className="text-4xl mb-1">📋</p>
            <p className="text-3xl font-bold text-gray-900">{totalBookings}</p>
            <p className="text-sm font-semibold text-gray-600 mt-1">Total Bookings</p>
            <p className="text-xs text-gray-400">Kul kiye kaam</p>
          </Link>
          <Link
            to="/pandit/bookings"
            className="bg-white border border-gray-200 rounded-2xl p-4 text-center hover:shadow-md hover:-translate-y-0.5 transition-all active:scale-95"
          >
            <p className="text-4xl mb-1">✅</p>
            <p className="text-3xl font-bold text-green-600">{completedBookings}</p>
            <p className="text-sm font-semibold text-gray-600 mt-1">Completed</p>
            <p className="text-xs text-gray-400">Puri ki gayi poojas</p>
          </Link>
        </div>
      </div>

      {/* ══════════════════════════════════════
          UPCOMING CEREMONIES — Confirmed bookings
      ══════════════════════════════════════ */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <div>
            <p className="text-base font-bold text-gray-900">📅 Aane Wali Pooja</p>
            <p className="text-xs text-gray-400">Confirmed home ceremonies</p>
          </div>
          {upcomingOfflineTotal > 0 && (
            <Link to="/pandit/bookings" className="text-xs text-primary-600 font-semibold bg-primary-50 px-3 py-1 rounded-full hover:bg-primary-100 transition-colors">
              Sab Dekho ({upcomingOfflineTotal})
            </Link>
          )}
        </div>

        {upcomingOffline.length === 0 ? (
          <div className="bg-gray-50 border border-gray-100 rounded-2xl text-center py-8">
            <p className="text-4xl mb-2">😴</p>
            <p className="text-sm font-semibold text-gray-500">Abhi koi upcoming ceremony nahi</p>
            <p className="text-xs text-gray-400 mt-1">New bookings ayengi toh yahan dikhenge</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingOffline.map((b, idx) => {
              const bDate = new Date(b.bookingDate);
              const isToday = bDate.toDateString() === today.toDateString();
              const isTomorrow = bDate.toDateString() === new Date(today.getTime() + 86400000).toDateString();
              const dayLabel = isToday ? '🔥 AAJ' : isTomorrow ? '⭐ KAL' : null;

              return (
                <div
                  key={b._id}
                  className={`rounded-2xl border-2 overflow-hidden ${isToday ? 'border-orange-400 bg-orange-50' : 'border-indigo-100 bg-indigo-50'}`}
                >
                  {/* Date strip */}
                  <div className={`px-4 py-2 flex items-center gap-2 ${isToday ? 'bg-orange-500' : 'bg-indigo-500'}`}>
                    <span className="text-lg">📅</span>
                    <p className="text-white font-bold text-sm flex-1">
                      {dayLabel && <span className="mr-2">{dayLabel}</span>}
                      {fmtBookingDate(b.bookingDate)}
                    </p>
                    <p className="text-white/80 text-sm font-semibold">{b.bookingTime}</p>
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    {/* Event type — BIG */}
                    <p className="text-xl font-bold text-gray-900 mb-3">{b.eventType}</p>

                    {/* User info */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">👤</span>
                      <p className="text-sm font-semibold text-gray-800">{b.userId?.name}</p>
                    </div>

                    {/* Address — big and clear */}
                    <div className="flex items-start gap-2 mb-3">
                      <span className="text-lg mt-0.5">📍</span>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{b.address?.street}</p>
                        {b.address?.landmark && <p className="text-xs text-gray-500">Near: {b.address.landmark}</p>}
                        <p className="text-sm text-gray-700">{b.address?.city}, {b.address?.state}</p>
                        <p className="text-xs text-gray-500">PIN: {b.address?.pincode}</p>
                      </div>
                    </div>

                    {/* Requirements */}
                    {b.requirements && (
                      <div className="bg-amber-100 rounded-xl p-3 mb-3 flex items-start gap-2">
                        <span className="text-base">📝</span>
                        <div>
                          <p className="text-xs font-bold text-amber-800">Special Instructions:</p>
                          <p className="text-sm text-amber-700">{b.requirements}</p>
                        </div>
                      </div>
                    )}

                    {/* Status + Maps button */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1.5 rounded-full">
                        ✅ Confirmed — User has paid
                      </span>
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(`${b.address?.street} ${b.address?.city} ${b.address?.pincode}`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-full transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        🗺️ Get Directions
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════
          PENDING REGULAR BOOKINGS (from admin)
      ══════════════════════════════════════ */}
      {bookings.length > 0 && (
        <div>
          <p className="text-base font-bold text-gray-900 mb-2 px-1">🪔 Pooja Accept Karo</p>
          <div className="space-y-3">
            {bookings.map((b) => (
              <div key={b._id} className="bg-white border-2 border-yellow-200 rounded-2xl overflow-hidden">
                {/* Orange header strip */}
                <div className="bg-yellow-400 px-4 py-2 flex items-center gap-2">
                  <span className="text-lg">⏳</span>
                  <p className="text-yellow-900 font-bold text-sm flex-1">New Booking — Your Decision Needed</p>
                </div>
                <div className="p-4">
                  {/* Pooja name BIG */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center text-2xl overflow-hidden flex-shrink-0">
                      {b.poojaId?.image
                        ? <img src={b.poojaId.image} alt="" className="w-full h-full object-cover rounded-xl" />
                        : '🪔'}
                    </div>
                    <div>
                      <p className="text-lg font-bold text-gray-900 leading-tight">{b.poojaId?.name}</p>
                      <p className="text-xs text-gray-500">{b.poojaId?.category}</p>
                    </div>
                  </div>

                  {/* Date + User + Address */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-base w-6">📅</span>
                      <p className="text-sm font-semibold text-gray-800">
                        {fmtBookingDate(b.bookingDate)} at {b.bookingTime}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-base w-6">👤</span>
                      <p className="text-sm text-gray-700">{b.userId?.name}</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-base w-6 mt-0.5">📍</span>
                      <p className="text-sm text-gray-700">
                        {b.address?.street}, {b.address?.city}, {b.address?.state}
                      </p>
                    </div>
                  </div>

                  {/* Big Accept button + instructions */}
                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-500 mb-2">
                      Accept karne ke liye "All Bookings" mein jao
                    </p>
                    <Link
                      to="/pandit/bookings"
                      className="block w-full bg-green-500 hover:bg-green-600 text-white font-bold text-base py-3 rounded-xl transition-colors active:scale-95"
                    >
                      👉 Accept / Reject Karo
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          ASTROLOGY CHAT PROMO
      ══════════════════════════════════════ */}
      {profile?.isAstrologer ? (
        <Link
          to="/pandit/astrology"
          className="relative rounded-2xl overflow-hidden h-20 hover:shadow-lg transition-all active:scale-95 group block"
        >
          <img src={img12} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          <div className="absolute inset-0 bg-gradient-to-r from-violet-900/90 to-indigo-700/70" />
          <div className="relative z-10 flex items-center gap-3 p-4 h-full text-white">
            <span className="text-4xl drop-shadow">🔮</span>
            <div className="flex-1">
              <p className="font-bold text-base">Astrology Chat</p>
              <p className="text-violet-200 text-xs">Go live and earn ₹{profile.astroRate}/min from users</p>
            </div>
            <span className="bg-white/20 text-white text-xs font-bold px-3 py-2 rounded-xl flex-shrink-0">Open →</span>
          </div>
        </Link>
      ) : (
        <div className="relative rounded-2xl overflow-hidden h-16">
          <img src={img12} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-violet-100/80" />
          <div className="relative z-10 flex items-center gap-3 p-4 h-full">
            <span className="text-3xl">🔮</span>
            <div>
              <p className="font-semibold text-violet-800 text-sm">Astrology Chat — Not Enabled</p>
              <p className="text-xs text-violet-500">Ask Admin to enable live chat for your account</p>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          BOTTOM QUICK ACTIONS — large buttons
      ══════════════════════════════════════ */}
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">Quick Access</p>
        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/pandit/bookings"
            className="relative rounded-2xl overflow-hidden h-20 hover:shadow-md transition-all active:scale-95 group"
          >
            <img src={img11} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            <div className="absolute inset-0 bg-gradient-to-br from-orange-700/85 to-orange-500/70" />
            <div className="relative z-10 flex items-center gap-2 p-3 h-full text-white">
              <span className="text-2xl drop-shadow">📋</span>
              <div>
                <p className="font-bold text-sm leading-tight">All Bookings</p>
                <p className="text-orange-100 text-xs">Manage karo</p>
              </div>
            </div>
          </Link>
          <Link
            to="/pandit/profile"
            className="relative rounded-2xl overflow-hidden h-20 hover:shadow-md transition-all active:scale-95 group"
          >
            <img src={img12} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-700/85 to-indigo-500/70" />
            <div className="relative z-10 flex items-center gap-2 p-3 h-full text-white">
              <span className="text-2xl drop-shadow">👤</span>
              <div>
                <p className="font-bold text-sm leading-tight">My Profile</p>
                <p className="text-indigo-200 text-xs">Update karo</p>
              </div>
            </div>
          </Link>
        </div>
      </div>

    </div>
  );
}
