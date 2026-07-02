import { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Pagination from '../../components/common/Pagination';
import toast from 'react-hot-toast';

const CATEGORIES = ['Griha Pravesh', 'Satyanarayan Katha', 'Navratri', 'Ganesh Puja', 'Laxmi Puja',
  'Shradh', 'Vivah', 'Namkaran', 'Mundan', 'Rudrabhishek', 'Sundarkand Path', 'Other'];

const BOOKING_STATUS = ['', 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];
const BOOKING_STATUS_STYLES = {
  pending:     'bg-yellow-100 text-yellow-700',
  confirmed:   'bg-blue-100 text-blue-700',
  in_progress: 'bg-indigo-100 text-indigo-700',
  completed:   'bg-green-100 text-green-700',
  cancelled:   'bg-red-100 text-red-700',
};
const BOOKING_STATUS_LABELS = {
  pending:     'Pending Payment',
  confirmed:   'Confirmed',
  in_progress: 'In Progress',
  completed:   'Completed',
  cancelled:   'Cancelled',
};

const emptyForm = {
  name: '', description: '', category: CATEGORIES[0], price: '', duration: '1-2 hours',
  language: 'Hindi', panditName: '', templeLocation: '', deliveryDays: '3',
  includedItems: '', isActive: true,
};

export default function AdminOnlinePoojas() {
  const [view, setView] = useState('poojas'); // 'poojas' | 'bookings'

  // Poojas state
  const [poojas, setPoojas] = useState([]);
  const [poojasPag, setPoojasPag] = useState(null);
  const [poojasPage, setPoojasPage] = useState(1);
  const [poojasLoading, setPoojasLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [image, setImage] = useState(null);
  const [saving, setSaving] = useState(false);

  // Bookings state
  const [bookings, setBookings] = useState([]);
  const [bookingsPag, setBookingsPag] = useState(null);
  const [bookingsPage, setBookingsPage] = useState(1);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingStatusFilter, setBookingStatusFilter] = useState('');

  // Video upload modal
  const [videoModal, setVideoModal] = useState({ open: false, bookingId: '', userName: '', poojaName: '', mode: 'file' }); // mode: 'file' | 'url'
  const [videoFile, setVideoFile] = useState(null);
  const [videoExternalUrl, setVideoExternalUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => { loadPoojas(); }, [poojasPage]);
  useEffect(() => { if (view === 'bookings') loadBookings(); }, [view, bookingsPage, bookingStatusFilter]);

  const loadPoojas = () => {
    setPoojasLoading(true);
    api.get(`/online-poojas?page=${poojasPage}&limit=9`).then(({ data }) => {
      setPoojas(data.data.poojas);
      setPoojasPag(data.data.pagination);
    }).finally(() => setPoojasLoading(false));
  };

  const loadBookings = () => {
    setBookingsLoading(true);
    const params = new URLSearchParams({ page: bookingsPage, limit: 15 });
    if (bookingStatusFilter) params.set('status', bookingStatusFilter);
    api.get(`/online-poojas/admin/bookings?${params}`).then(({ data }) => {
      setBookings(data.data.bookings);
      setBookingsPag(data.data.pagination);
    }).finally(() => setBookingsLoading(false));
  };

  const openCreate = () => { setForm(emptyForm); setEditId(null); setImage(null); setModal(true); };
  const openEdit = (p) => {
    setForm({
      name: p.name, description: p.description, category: p.category,
      price: p.price, duration: p.duration, language: p.language,
      panditName: p.panditName || '', templeLocation: p.templeLocation || '',
      deliveryDays: p.deliveryDays || 3,
      includedItems: p.includedItems?.join(', ') || '',
      isActive: p.isActive,
    });
    setEditId(p._id); setImage(null); setModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (image) fd.append('image', image);
      const opts = { headers: { 'Content-Type': 'multipart/form-data' } };
      if (editId) await api.put(`/online-poojas/${editId}`, fd, opts);
      else await api.post('/online-poojas', fd, opts);
      toast.success(`Special pooja ${editId ? 'updated' : 'created'}.`);
      setModal(false); loadPoojas();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed.');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this special pooja? All bookings will still exist.')) return;
    try {
      await api.delete(`/online-poojas/${id}`);
      toast.success('Deleted.'); loadPoojas();
    } catch { toast.error('Delete failed.'); }
  };

  const updateBookingStatus = async (bookingId, status) => {
    try {
      await api.put(`/online-poojas/admin/bookings/${bookingId}/status`, { status });
      toast.success('Status updated.');
      loadBookings();
    } catch { toast.error('Update failed.'); }
  };

  const openVideoModal = (b) => {
    setVideoModal({ open: true, bookingId: b._id, userName: b.userId?.name, poojaName: b.onlinePoojaId?.name, mode: 'file' });
    setVideoFile(null);
    setVideoExternalUrl('');
  };

  const handleUploadVideo = async () => {
    if (videoModal.mode === 'file' && !videoFile) {
      return toast.error('Please select a video file.');
    }
    if (videoModal.mode === 'url' && !videoExternalUrl) {
      return toast.error('Please enter a video URL.');
    }
    setUploading(true);
    try {
      if (videoModal.mode === 'file') {
        const fd = new FormData();
        fd.append('video', videoFile);
        await api.put(
          `/online-poojas/admin/bookings/${videoModal.bookingId}/upload-video`,
          fd,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
      } else {
        await api.put(
          `/online-poojas/admin/bookings/${videoModal.bookingId}/upload-video`,
          { videoExternalUrl }
        );
      }
      toast.success('✅ Video uploaded! User can now watch and download it.');
      setVideoModal({ open: false, bookingId: '', userName: '', poojaName: '', mode: 'file' });
      loadBookings();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed.');
    } finally { setUploading(false); }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Special Poojas</h1>
          <p className="text-sm text-gray-500">Pandit performs at temple · Upload personal video proof to each user</p>
        </div>
        {view === 'poojas' && (
          <button onClick={openCreate} className="btn-primary text-sm">+ Add Pooja</button>
        )}
      </div>

      {/* View tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[['poojas', '🪔 Manage Poojas'], ['bookings', '📋 Bookings']].map(([key, label]) => (
          <button key={key} onClick={() => setView(key)} className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${view === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── MANAGE POOJAS ── */}
      {view === 'poojas' && (
        <>
          {poojasLoading ? (
            <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
          ) : poojas.length === 0 ? (
            <div className="card text-center py-12 text-gray-400">
              <p className="text-4xl mb-3">🕉️</p>
              <p>No special poojas yet. Add your first one!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {poojas.map((p) => (
                <div key={p._id} className="card p-0 overflow-hidden">
                  <div className="h-32 bg-orange-50 flex items-center justify-center overflow-hidden">
                    {p.image ? <img src={p.image} alt={p.name} className="w-full h-full object-cover" /> : <span className="text-4xl">🕉️</span>}
                  </div>
                  <div className="p-3">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-xs text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded font-medium">{p.category}</span>
                      <span className={`text-xs font-medium ${p.isActive ? 'text-green-600' : 'text-gray-400'}`}>{p.isActive ? '● Active' : '● Hidden'}</span>
                    </div>
                    <h3 className="font-semibold text-gray-900 text-sm line-clamp-1">{p.name}</h3>
                    <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                      <p>💰 ₹{p.price?.toLocaleString('en-IN')} · ⏱️ {p.duration}</p>
                      {p.panditName && <p>🧘 {p.panditName}</p>}
                      {p.templeLocation && <p>📍 {p.templeLocation}</p>}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => openEdit(p)} className="btn-secondary text-xs px-2 py-1 flex-1">Edit</button>
                      <button onClick={() => handleDelete(p._id)} className="btn-danger text-xs px-2 py-1 flex-1">Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Pagination pagination={poojasPag} onPageChange={setPoojasPage} />
        </>
      )}

      {/* ── BOOKINGS ── */}
      {view === 'bookings' && (
        <>
          {/* Status filter */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {BOOKING_STATUS.map((s) => (
              <button key={s} onClick={() => { setBookingStatusFilter(s); setBookingsPage(1); }} className={`text-sm px-4 py-1.5 rounded-full border font-medium whitespace-nowrap capitalize transition-colors ${bookingStatusFilter === s ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
                {s || 'All'}
              </button>
            ))}
          </div>

          {bookingsLoading ? (
            <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
          ) : bookings.length === 0 ? (
            <div className="card text-center py-12 text-gray-400">No bookings found.</div>
          ) : (
            <div className="space-y-3">
              {bookings.map((b) => (
                <div key={b._id} className="card">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* User + Pooja info */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900">{b.userId?.name}</p>
                        <span className="text-xs text-gray-400">#{b._id.slice(-6).toUpperCase()}</span>
                      </div>
                      <p className="text-sm text-gray-600">{b.onlinePoojaId?.name}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500">
                        <span>📧 {b.userId?.email}</span>
                        {b.userId?.phone && <span>📞 {b.userId.phone}</span>}
                        <span>💰 ₹{b.amount?.toLocaleString('en-IN')}</span>
                        <span>🗓️ {new Date(b.createdAt).toLocaleDateString('en-IN')}</span>
                        {b.preferredDate && <span>📅 Preferred: {new Date(b.preferredDate).toLocaleDateString('en-IN')}</span>}
                      </div>
                      {b.memberNames && <p className="text-xs text-gray-500 mt-1">👨‍👩‍👧 {b.memberNames}</p>}
                      {b.gotraName   && <p className="text-xs text-gray-500">📿 Gotra: {b.gotraName}</p>}
                      {b.wishes      && <p className="text-xs text-gray-400 italic">"{b.wishes}"</p>}
                    </div>
                    <div className="text-right flex-shrink-0 space-y-1">
                      <div>
                        <span className={`badge text-xs ${BOOKING_STATUS_STYLES[b.status] || 'bg-gray-100 text-gray-600'}`}>
                          {BOOKING_STATUS_LABELS[b.status] || b.status}
                        </span>
                      </div>
                      <p className={`text-xs ${b.isPaid ? 'text-green-600' : 'text-red-500'}`}>
                        {b.isPaid ? '✓ Paid' : 'Unpaid'}
                      </p>
                      {(b.videoUrl || b.videoExternalUrl) && (
                        <p className="text-xs text-green-600 font-medium">🎬 Video uploaded</p>
                      )}
                    </div>
                  </div>

                  {/* Action row */}
                  <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-2 items-center">
                    <span className="text-xs text-gray-500 font-medium">Status:</span>
                    {['confirmed', 'in_progress', 'completed', 'cancelled'].filter(s => s !== b.status).map((s) => (
                      <button key={s} onClick={() => updateBookingStatus(b._id, s)} className={`text-xs px-2.5 py-1 rounded-lg font-medium capitalize transition-colors ${s === 'cancelled' ? 'bg-red-50 text-red-600 hover:bg-red-100' : s === 'completed' ? 'bg-green-50 text-green-700 hover:bg-green-100' : s === 'in_progress' ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}>
                        {s.replace('_', ' ')}
                      </button>
                    ))}

                    {/* Upload Video button — only for confirmed/in_progress/completed bookings that are paid */}
                    {b.isPaid && ['confirmed', 'in_progress', 'completed'].includes(b.status) && (
                      <button
                        onClick={() => openVideoModal(b)}
                        className={`ml-auto text-xs px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${b.videoUrl || b.videoExternalUrl ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-primary-500 hover:bg-primary-600 text-white'}`}
                      >
                        {b.videoUrl || b.videoExternalUrl ? '🔄 Replace Video' : '📤 Upload Video'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <Pagination pagination={bookingsPag} onPageChange={setBookingsPage} />
        </>
      )}

      {/* ── Create/Edit Pooja Modal ── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 my-4">
            <h3 className="text-lg font-semibold mb-4">{editId ? 'Edit Special Pooja' : 'Add Special Pooja'}</h3>
            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label">Name *</label>
                  <input type="text" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div>
                  <label className="label">Category *</label>
                  <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Price ₹ *</label>
                  <input type="number" className="input" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
                </div>
                <div className="col-span-2">
                  <label className="label">Description *</label>
                  <textarea className="input resize-none" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
                </div>
                <div>
                  <label className="label">Duration</label>
                  <input type="text" className="input" placeholder="e.g. 1-2 hours" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
                </div>
                <div>
                  <label className="label">Language</label>
                  <input type="text" className="input" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} />
                </div>
                <div>
                  <label className="label">Pandit Name</label>
                  <input type="text" className="input" value={form.panditName} onChange={(e) => setForm({ ...form, panditName: e.target.value })} />
                </div>
                <div>
                  <label className="label">Delivery Days <span className="text-gray-400 font-normal">(approx.)</span></label>
                  <input type="number" className="input" min="1" value={form.deliveryDays} onChange={(e) => setForm({ ...form, deliveryDays: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <label className="label">Temple Location</label>
                  <input type="text" className="input" placeholder="e.g. Kashi Vishwanath Temple, Varanasi" value={form.templeLocation} onChange={(e) => setForm({ ...form, templeLocation: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <label className="label">Included Items <span className="text-gray-400 font-normal">(comma separated)</span></label>
                  <input type="text" className="input" placeholder="e.g. Prasad, Tulsi Mala, Pooja Photo" value={form.includedItems} onChange={(e) => setForm({ ...form, includedItems: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <label className="label">Image</label>
                  <input type="file" accept="image/*" className="input" onChange={(e) => setImage(e.target.files[0])} />
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <input type="checkbox" id="isActiveOP" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="w-4 h-4 accent-primary-500" />
                  <label htmlFor="isActiveOP" className="text-sm text-gray-700">Active (visible to users)</label>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Upload Video Modal ── */}
      {videoModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-1">Upload Pooja Video</h3>
            <p className="text-sm text-gray-500 mb-4">
              For <span className="font-medium text-gray-700">{videoModal.userName}</span> · {videoModal.poojaName}
            </p>

            {/* Mode selector */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4">
              {[['file', '📁 Upload File'], ['url', '🔗 External URL']].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setVideoModal((prev) => ({ ...prev, mode: key }))}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${videoModal.mode === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {videoModal.mode === 'file' ? (
              <div>
                <label className="label">Select Video File</label>
                <div
                  className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-primary-300 hover:bg-orange-50 transition-colors"
                  onClick={() => fileRef.current?.click()}
                >
                  {videoFile ? (
                    <div>
                      <p className="text-2xl mb-1">🎬</p>
                      <p className="font-medium text-gray-800 text-sm">{videoFile.name}</p>
                      <p className="text-xs text-gray-400">{(videoFile.size / (1024 * 1024)).toFixed(1)} MB</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-3xl mb-2">📹</p>
                      <p className="text-sm text-gray-600 font-medium">Click to select video</p>
                      <p className="text-xs text-gray-400 mt-1">MP4, MOV, AVI, MKV, WEBM · Max 500 MB</p>
                    </div>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => setVideoFile(e.target.files[0] || null)}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  ✅ User will be able to <strong>watch in-browser</strong> and <strong>download</strong> this video.
                </p>
              </div>
            ) : (
              <div>
                <label className="label">YouTube / Google Drive URL</label>
                <input
                  type="url"
                  className="input"
                  placeholder="https://youtube.com/watch?v=... or https://drive.google.com/..."
                  value={videoExternalUrl}
                  onChange={(e) => setVideoExternalUrl(e.target.value)}
                />
                <p className="text-xs text-gray-400 mt-2">
                  YouTube links will be shown as an embedded player. Drive links will open in a new tab.
                </p>
              </div>
            )}

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setVideoModal({ open: false, bookingId: '', userName: '', poojaName: '', mode: 'file' })}
                className="btn-secondary flex-1"
                disabled={uploading}
              >
                Cancel
              </button>
              <button
                onClick={handleUploadVideo}
                disabled={uploading}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-medium py-2 px-4 rounded-xl transition-colors text-sm"
              >
                {uploading ? 'Uploading...' : '📤 Upload & Share with User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
