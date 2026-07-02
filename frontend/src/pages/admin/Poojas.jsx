import { useState, useEffect } from 'react';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Pagination from '../../components/common/Pagination';
import toast from 'react-hot-toast';

const CATEGORIES = ['Griha Pravesh', 'Satyanarayan Katha', 'Navratri', 'Ganesh Puja', 'Laxmi Puja', 'Shradh', 'Vivah', 'Namkaran', 'Mundan', 'Other'];

const emptyForm = { name: '', description: '', category: CATEGORIES[0], duration: '', price: '', includedItems: '', isActive: true };

export default function AdminPoojas() {
  const [poojas, setPoojas] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [image, setImage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);

  const load = () => {
    setLoading(true);
    api.get(`/poojas?page=${page}&limit=10`).then(({ data }) => {
      setPoojas(data.data.poojas);
      setPagination(data.data.pagination);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page]);

  const openCreate = () => { setForm(emptyForm); setEditId(null); setImage(null); setModal(true); };
  const openEdit = (p) => {
    setForm({ name: p.name, description: p.description, category: p.category, duration: p.duration, price: p.price, includedItems: p.includedItems?.join(', ') || '', isActive: p.isActive });
    setEditId(p._id);
    setImage(null);
    setModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (image) fd.append('image', image);
      if (editId) await api.put(`/poojas/${editId}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      else await api.post('/poojas', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(`Pooja ${editId ? 'updated' : 'created'}.`);
      setModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this pooja?')) return;
    try {
      await api.delete(`/poojas/${id}`);
      toast.success('Pooja deleted.');
      load();
    } catch (err) { toast.error('Delete failed.'); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Poojas</h1>
        <button onClick={openCreate} className="btn-primary text-sm">+ Add Pooja</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {poojas.map((p) => (
            <div key={p._id} className="card p-0 overflow-hidden">
              <div className="h-36 bg-orange-50 flex items-center justify-center overflow-hidden">
                {p.image ? <img src={p.image} alt={p.name} className="w-full h-full object-cover" /> : <span className="text-5xl">🪔</span>}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs text-primary-600 font-medium bg-primary-50 px-2 py-0.5 rounded">{p.category}</span>
                    <h3 className="font-semibold text-gray-900 mt-1">{p.name}</h3>
                  </div>
                  <span className={`badge ${p.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{p.isActive ? 'Active' : 'Inactive'}</span>
                </div>
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{p.description}</p>
                <div className="flex items-center justify-between mt-3">
                  <div>
                    <p className="font-bold text-primary-600">₹{p.price?.toLocaleString('en-IN')}</p>
                    <p className="text-xs text-gray-400">{p.duration}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(p)} className="btn-secondary text-xs px-2.5 py-1">Edit</button>
                    <button onClick={() => handleDelete(p._id)} className="btn-danger text-xs px-2.5 py-1">Delete</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Pagination pagination={pagination} onPageChange={setPage} />

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 my-4">
            <h3 className="text-lg font-semibold mb-4">{editId ? 'Edit Pooja' : 'Add New Pooja'}</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
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
                <label className="label">Description *</label>
                <textarea className="input resize-none" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Price (₹) *</label>
                  <input type="number" className="input" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
                </div>
                <div>
                  <label className="label">Duration *</label>
                  <input type="text" className="input" placeholder="e.g. 2-3 hours" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} required />
                </div>
              </div>
              <div>
                <label className="label">Included Items (comma separated)</label>
                <input type="text" className="input" placeholder="Flowers, Prasad, Incense sticks" value={form.includedItems} onChange={(e) => setForm({ ...form, includedItems: e.target.value })} />
              </div>
              <div>
                <label className="label">Image</label>
                <input type="file" accept="image/*" className="input" onChange={(e) => setImage(e.target.files[0])} />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isActive" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="w-4 h-4 accent-primary-500" />
                <label htmlFor="isActive" className="text-sm text-gray-700">Active (visible to users)</label>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Save Pooja'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
