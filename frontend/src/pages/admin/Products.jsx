import { useState, useEffect } from 'react';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Pagination from '../../components/common/Pagination';
import toast from 'react-hot-toast';

const CATEGORIES = ['Pooja Samagri', 'Flowers & Garlands', 'Incense & Dhoop', 'Clothing', 'Accessories', 'Diyas & Lamps', 'Books & Calendars', 'Food & Prasad', 'Other'];
const empty = { name: '', description: '', category: CATEGORIES[0], price: '', discountPrice: '', stock: '', tags: '', relatedPoojas: '', isActive: true };

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [image, setImage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);

  const load = () => {
    setLoading(true);
    api.get(`/products?page=${page}&limit=12`).then(({ data }) => {
      setProducts(data.data.products);
      setPagination(data.data.pagination);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page]);

  const openCreate = () => { setForm(empty); setEditId(null); setImage(null); setModal(true); };
  const openEdit = (p) => {
    setForm({ name: p.name, description: p.description, category: p.category, price: p.price, discountPrice: p.discountPrice || '', stock: p.stock, tags: p.tags?.join(', ') || '', relatedPoojas: p.relatedPoojas?.join(', ') || '', isActive: p.isActive });
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
      const opts = { headers: { 'Content-Type': 'multipart/form-data' } };
      if (editId) await api.put(`/products/${editId}`, fd, opts);
      else await api.post('/products', fd, opts);
      toast.success(`Product ${editId ? 'updated' : 'created'}.`);
      setModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      await api.delete(`/products/${id}`);
      toast.success('Product deleted.');
      load();
    } catch { toast.error('Delete failed.'); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-sm text-gray-500">T-shirts, bangles, samagri & more</p>
        </div>
        <button onClick={openCreate} className="btn-primary text-sm">+ Add Product</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((p) => (
            <div key={p._id} className="card p-0 overflow-hidden">
              <div className="h-36 bg-orange-50 flex items-center justify-center overflow-hidden">
                {p.image ? <img src={p.image} alt={p.name} className="w-full h-full object-cover" /> : <span className="text-4xl">🛍️</span>}
              </div>
              <div className="p-3">
                <div className="flex items-start justify-between gap-1">
                  <span className="text-xs text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded font-medium">{p.category}</span>
                  <span className={`badge text-xs ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{p.isActive ? 'Active' : 'Hidden'}</span>
                </div>
                <h3 className="font-semibold text-gray-900 text-sm mt-1 line-clamp-1">{p.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  {p.discountPrice > 0 ? (
                    <>
                      <span className="font-bold text-primary-600 text-sm">₹{p.discountPrice.toLocaleString('en-IN')}</span>
                      <span className="text-xs text-gray-400 line-through">₹{p.price.toLocaleString('en-IN')}</span>
                    </>
                  ) : (
                    <span className="font-bold text-primary-600 text-sm">₹{p.price.toLocaleString('en-IN')}</span>
                  )}
                </div>
                <p className="text-xs text-gray-500">Stock: {p.stock} · Sold: {p.soldCount}</p>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => openEdit(p)} className="btn-secondary text-xs px-2 py-1 flex-1">Edit</button>
                  <button onClick={() => handleDelete(p._id)} className="btn-danger text-xs px-2 py-1 flex-1">Delete</button>
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
            <h3 className="text-lg font-semibold mb-4">{editId ? 'Edit Product' : 'Add Product'}</h3>
            <form onSubmit={handleSave} className="space-y-3">
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
                <textarea className="input resize-none" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Price ₹ *</label>
                  <input type="number" className="input" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
                </div>
                <div>
                  <label className="label">Discount ₹</label>
                  <input type="number" className="input" min="0" placeholder="0 = no discount" value={form.discountPrice} onChange={(e) => setForm({ ...form, discountPrice: e.target.value })} />
                </div>
                <div>
                  <label className="label">Stock</label>
                  <input type="number" className="input" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">Tags (comma separated)</label>
                <input type="text" className="input" placeholder="puja, thali, brass" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
              </div>
              <div>
                <label className="label">Related Poojas (comma separated)</label>
                <input type="text" className="input" placeholder="Griha Pravesh, Ganesh Puja" value={form.relatedPoojas} onChange={(e) => setForm({ ...form, relatedPoojas: e.target.value })} />
              </div>
              <div>
                <label className="label">Image</label>
                <input type="file" accept="image/*" className="input" onChange={(e) => setImage(e.target.files[0])} />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isActiveP" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="w-4 h-4 accent-primary-500" />
                <label htmlFor="isActiveP" className="text-sm text-gray-700">Active (visible to users)</label>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Save Product'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
