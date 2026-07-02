import { useState, useEffect } from 'react';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Pagination from '../../components/common/Pagination';
import toast from 'react-hot-toast';

const STATUSES = ['', 'pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'];
const STATUS_STYLES = { pending: 'bg-yellow-100 text-yellow-800', paid: 'bg-blue-100 text-blue-800', processing: 'bg-indigo-100 text-indigo-800', shipped: 'bg-purple-100 text-purple-800', delivered: 'bg-green-100 text-green-800', cancelled: 'bg-red-100 text-red-800' };

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: 15 });
    if (status) params.set('status', status);
    api.get(`/orders?${params}`).then(({ data }) => {
      setOrders(data.data.orders);
      setPagination(data.data.pagination);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [status, page]);

  const updateStatus = async (id, newStatus) => {
    try {
      await api.put(`/orders/${id}/status`, { status: newStatus });
      toast.success('Order status updated.');
      load();
    } catch { toast.error('Update failed.'); }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Shop Orders</h1>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {STATUSES.map((s) => (
          <button key={s} onClick={() => { setStatus(s); setPage(1); }} className={`text-sm px-4 py-1.5 rounded-full border font-medium whitespace-nowrap capitalize transition-colors ${status === s ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
      ) : orders.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">No orders found.</div>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <div key={o._id} className="card">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-gray-900">#{o._id.slice(-8).toUpperCase()}</p>
                  <p className="text-sm text-gray-500">{o.userId?.name} · {o.userId?.phone}</p>
                  <p className="text-xs text-gray-400">{new Date(o.createdAt).toLocaleDateString('en-IN')}</p>
                </div>
                <div className="text-right">
                  <span className={`badge capitalize ${STATUS_STYLES[o.status]}`}>{o.status}</span>
                  <p className="font-bold text-primary-600 mt-1">₹{o.totalAmount?.toLocaleString('en-IN')}</p>
                  <span className={`text-xs ${o.isPaid ? 'text-green-600' : 'text-red-500'}`}>{o.isPaid ? '✓ Paid' : 'Unpaid'}</span>
                </div>
              </div>

              <div className="border-y border-gray-100 py-2 mb-3 space-y-1">
                {o.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{item.name} × {item.quantity}</span>
                    <span className="text-gray-900 font-medium">₹{(item.price * item.quantity).toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>

              <div className="text-xs text-gray-500 mb-3">
                📍 {o.address?.street}, {o.address?.city}, {o.address?.state} – {o.address?.pincode}
              </div>

              <div className="flex gap-2 flex-wrap">
                <span className="text-xs text-gray-500 font-medium self-center">Update:</span>
                {['processing', 'shipped', 'delivered', 'cancelled'].filter(s => s !== o.status).map((s) => (
                  <button key={s} onClick={() => updateStatus(o._id, s)} className={`text-xs px-2.5 py-1 rounded-lg font-medium capitalize transition-colors ${s === 'cancelled' ? 'bg-red-50 text-red-600 hover:bg-red-100' : s === 'delivered' ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <Pagination pagination={pagination} onPageChange={setPage} />
    </div>
  );
}
