import { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const today = new Date().toISOString().split('T')[0];

const blankForm = {
  eventType: '', bookingDate: '', bookingTime: '',
  street: '', city: '', state: '', pincode: '', landmark: '', requirements: '',
};

export default function BookPandit() {
  const [pandits, setPandits]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(null);
  const [form, setForm]         = useState(blankForm);
  const [sending, setSending]   = useState(false);

  useEffect(() => {
    api.get('/offline-bookings/pandits')
      .then(({ data }) => setPandits(data.data))
      .catch(() => toast.error('Failed to load pandits.'))
      .finally(() => setLoading(false));
  }, []);

  const openModal  = (p) => { setSelected(p); setForm(blankForm); };
  const closeModal = () => { setSelected(null); setSending(false); };
  const set = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSendRequest = async (e) => {
    e.preventDefault();
    const { eventType, bookingDate, bookingTime, street, city, state, pincode } = form;
    if (!eventType || !bookingDate || !bookingTime || !street || !city || !state || !pincode) {
      return toast.error('Please fill all required fields.');
    }
    setSending(true);
    try {
      await api.post('/offline-bookings', {
        panditId: selected._id,
        eventType,
        bookingDate,
        bookingTime,
        address: { street, city, state, pincode, landmark: form.landmark },
        requirements: form.requirements,
      });
      toast.success('🙏 Request sent! You will be notified once the pandit accepts.');
      closeModal();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send request.');
      setSending(false);
    }
  };

  const photo     = (p) => p.photo || p.userId?.profilePhoto || null;
  const initials  = (p) => (p.userId?.name || 'P').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  const avgRating = (p) => p.totalRatings > 0 ? (p.rating / p.totalRatings).toFixed(1) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Book a Pandit</h1>
        <p className="text-sm text-gray-500 mt-1">
          Choose a verified pandit for your ceremony. Fees are set by admin — payment is done after pandit accepts your request.
        </p>
      </div>

      {/* Flow explanation */}
      <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
        <p className="text-sm font-semibold text-amber-800 mb-1">How it works</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-amber-700">
          <span>1️⃣ Send a request</span>
          <span>→</span>
          <span>2️⃣ Pandit accepts</span>
          <span>→</span>
          <span>3️⃣ You pay the fee</span>
          <span>→</span>
          <span>4️⃣ Booking confirmed</span>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
      ) : pandits.length === 0 ? (
        <div className="card text-center py-20">
          <p className="text-5xl mb-4">🧘</p>
          <p className="text-gray-600 font-medium">No pandits available right now.</p>
          <p className="text-sm text-gray-400 mt-1">Please check back later.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {pandits.map((p) => {
            const hasPhoto = !!photo(p);
            const rating   = avgRating(p);
            const fee      = p.consultationFee || 0;

            return (
              <div key={p._id} className="card flex flex-col gap-3">
                {/* Header */}
                <div className="flex items-start gap-3">
                  <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-xl overflow-hidden flex-shrink-0">
                    {hasPhoto
                      ? <img src={photo(p)} alt="" className="w-full h-full object-cover" />
                      : <span>{initials(p)}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-gray-900 truncate">{p.userId?.name}</h3>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${p.isAvailable ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {p.isAvailable ? '● Available' : '● Busy'}
                      </span>
                    </div>
                    {p.location && <p className="text-xs text-gray-400 mt-0.5 truncate">📍 {p.location}</p>}
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      {rating && <span>⭐ {rating}</span>}
                      {p.experience > 0 && <span>🗓️ {p.experience} yrs</span>}
                    </div>
                  </div>
                </div>

                {/* Bio */}
                {p.bio && <p className="text-sm text-gray-500 line-clamp-2 -mt-1">{p.bio}</p>}

                {/* Expertise */}
                {p.expertise?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {p.expertise.map((e, i) => (
                      <span key={i} className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full">{e}</span>
                    ))}
                  </div>
                )}

                {/* Languages */}
                {p.languages?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {p.languages.map((l, i) => (
                      <span key={i} className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">🗣️ {l}</span>
                    ))}
                  </div>
                )}

                {/* Fee + Request button */}
                <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100">
                  <div>
                    {fee > 0 ? (
                      <p className="text-xl font-bold text-primary-600">₹{fee.toLocaleString('en-IN')}</p>
                    ) : (
                      <p className="text-sm text-gray-400 italic">Fee not set</p>
                    )}
                    <p className="text-xs text-gray-400">per ceremony</p>
                  </div>
                  <button
                    onClick={() => openModal(p)}
                    disabled={!fee || fee <= 0}
                    className="btn-primary text-sm px-5 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Send Request
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Booking Request Modal ── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 my-4">

            {/* Pandit summary */}
            <div className="flex items-start gap-3 mb-5 pb-4 border-b border-gray-100">
              <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-lg overflow-hidden flex-shrink-0">
                {photo(selected)
                  ? <img src={photo(selected)} alt="" className="w-full h-full object-cover" />
                  : <span>{initials(selected)}</span>}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 text-lg leading-tight">{selected.userId?.name}</h3>
                {selected.location && <p className="text-sm text-gray-400">📍 {selected.location}</p>}
                {selected.expertise?.length > 0 && (
                  <p className="text-xs text-gray-500 mt-0.5">{selected.expertise.join(' · ')}</p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-2xl font-bold text-primary-600">₹{selected.consultationFee?.toLocaleString('en-IN')}</p>
                <p className="text-xs text-gray-400">payable after acceptance</p>
              </div>
            </div>

            <form onSubmit={handleSendRequest} className="space-y-4">
              <div>
                <label className="label">Event / Pooja Type <span className="text-red-500">*</span></label>
                <input name="eventType" type="text" className="input" placeholder="e.g. Griha Pravesh, Satyanarayan Katha, Birthday Puja" value={form.eventType} onChange={set} required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Date <span className="text-red-500">*</span></label>
                  <input name="bookingDate" type="date" className="input" min={today} value={form.bookingDate} onChange={set} required />
                </div>
                <div>
                  <label className="label">Time <span className="text-red-500">*</span></label>
                  <input name="bookingTime" type="time" className="input" value={form.bookingTime} onChange={set} required />
                </div>
              </div>

              <div>
                <label className="label">Street Address <span className="text-red-500">*</span></label>
                <input name="street" type="text" className="input" placeholder="House no., street name" value={form.street} onChange={set} required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">City <span className="text-red-500">*</span></label>
                  <input name="city" type="text" className="input" value={form.city} onChange={set} required />
                </div>
                <div>
                  <label className="label">State <span className="text-red-500">*</span></label>
                  <input name="state" type="text" className="input" value={form.state} onChange={set} required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Pincode <span className="text-red-500">*</span></label>
                  <input name="pincode" type="text" className="input" placeholder="6-digit" maxLength={6} value={form.pincode} onChange={set} required />
                </div>
                <div>
                  <label className="label">Landmark <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input name="landmark" type="text" className="input" placeholder="Near..." value={form.landmark} onChange={set} />
                </div>
              </div>

              <div>
                <label className="label">Special Requirements <span className="text-gray-400 font-normal">(optional)</span></label>
                <textarea name="requirements" className="input resize-none" rows={2} placeholder="Any special items or instructions..." value={form.requirements} onChange={set} maxLength={1000} />
              </div>

              {/* Fee note */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-center gap-3 text-sm text-blue-800">
                <span className="text-xl">ℹ️</span>
                <p>Fee of <strong>₹{selected.consultationFee?.toLocaleString('en-IN')}</strong> will be charged only after the pandit accepts your request.</p>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={closeModal} className="btn-secondary flex-1" disabled={sending}>Cancel</button>
                <button type="submit" disabled={sending} className="btn-primary flex-1">
                  {sending ? 'Sending...' : '📨 Send Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
