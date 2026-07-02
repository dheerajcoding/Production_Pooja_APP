import { useState, useEffect } from 'react';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Pagination from '../../components/common/Pagination';
import toast from 'react-hot-toast';

export default function AdminPandits() {
  const [pandits, setPandits]       = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState('');
  const [page, setPage]             = useState(1);

  // Reject modal
  const [rejectModal, setRejectModal] = useState({ open: false, id: '', reason: '' });

  // Set Fee modal
  const [feeModal, setFeeModal]   = useState({ open: false, id: '', name: '', currentFee: '' });
  const [feeInput, setFeeInput]   = useState('');
  const [savingFee, setSavingFee] = useState(false);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: 20 });
    if (filter !== '') params.set('approved', filter);
    api.get(`/admin/pandits?${params}`).then(({ data }) => {
      setPandits(data.data.pandits);
      setPagination(data.data.pagination);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filter, page]);

  const approve = async (id) => {
    try {
      await api.put(`/admin/pandits/${id}/approve`);
      toast.success('Pandit approved.');
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
  };

  const reject = async () => {
    try {
      await api.put(`/admin/pandits/${rejectModal.id}/reject`, { reason: rejectModal.reason });
      toast.success('Pandit rejected.');
      setRejectModal({ open: false, id: '', reason: '' });
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
  };

  const openFeeModal = (p) => {
    setFeeInput(p.consultationFee > 0 ? String(p.consultationFee) : '');
    setFeeModal({ open: true, id: p._id, name: p.userId?.name || 'Pandit', currentFee: p.consultationFee });
  };

  const saveFee = async () => {
    const fee = Number(feeInput);
    if (!feeInput || isNaN(fee) || fee < 0) return toast.error('Please enter a valid fee amount (0 or more).');
    setSavingFee(true);
    try {
      await api.put(`/admin/pandits/${feeModal.id}`, { consultationFee: fee });
      toast.success(`Fee set to ₹${fee.toLocaleString('en-IN')} for ${feeModal.name}`);
      setFeeModal({ open: false, id: '', name: '', currentFee: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save fee.');
    } finally {
      setSavingFee(false);
    }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Pandits</h1>

      <div className="flex gap-2">
        {[['', 'All'], ['true', 'Approved'], ['false', 'Pending']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => { setFilter(val); setPage(1); }}
            className={`text-sm px-4 py-1.5 rounded-full border font-medium transition-colors ${filter === val ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
      ) : (
        <div className="space-y-4">
          {pandits.map((p) => (
            <div key={p._id} className="card">
              <div className="flex items-start justify-between gap-3">
                {/* Left: photo + info */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {p.photo || p.userId?.profilePhoto ? (
                      <img src={p.photo || p.userId?.profilePhoto} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl font-bold text-amber-600">{p.userId?.name?.charAt(0)}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900">{p.userId?.name}</h3>
                    <p className="text-sm text-gray-500">{p.userId?.email}</p>
                    {p.userId?.phone && <p className="text-sm text-gray-500">{p.userId?.phone}</p>}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {p.expertise?.slice(0, 3).map((e) => (
                        <span key={e} className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded">{e}</span>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-gray-500 mt-1">
                      {p.experience > 0 && <span>{p.experience} yrs exp</span>}
                      {p.location && <span>📍 {p.location}</span>}
                      {p.totalBookings > 0 && <span>📋 {p.totalBookings} bookings</span>}
                    </div>
                    {p.rejectionReason && (
                      <p className="text-xs text-red-500 mt-1">Rejection: {p.rejectionReason}</p>
                    )}

                    {/* Fee badge */}
                    <div className="mt-2 flex items-center gap-2">
                      {p.consultationFee > 0 ? (
                        <span className="text-sm font-bold text-primary-600 bg-primary-50 px-3 py-0.5 rounded-full">
                          ₹{p.consultationFee.toLocaleString('en-IN')} / ceremony
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full italic">No fee set</span>
                      )}
                      {p.isApproved && (
                        <button
                          onClick={() => openFeeModal(p)}
                          className="text-xs text-primary-600 hover:text-primary-700 font-medium border border-primary-200 hover:border-primary-400 px-2 py-0.5 rounded-full transition-colors"
                        >
                          ✏️ Set Fee
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: status + actions */}
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <span className={`badge ${p.isApproved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {p.isApproved ? '✓ Approved' : '⏳ Pending'}
                  </span>
                  <div className="flex gap-2 flex-wrap justify-end">
                    {!p.isApproved && (
                      <button onClick={() => approve(p._id)} className="btn-primary text-xs px-3 py-1.5">Approve</button>
                    )}
                    {p.isApproved && (
                      <button onClick={() => openFeeModal(p)} className="bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
                        💰 Set Fee
                      </button>
                    )}
                    <button
                      onClick={() => setRejectModal({ open: true, id: p._id, reason: '' })}
                      className="btn-danger text-xs px-3 py-1.5"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Pagination pagination={pagination} onPageChange={setPage} />

      {/* ── Reject Modal ── */}
      {rejectModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Reject Pandit</h3>
            <label className="label">Reason <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea
              className="input resize-none mb-4"
              rows={3}
              value={rejectModal.reason}
              onChange={(e) => setRejectModal((prev) => ({ ...prev, reason: e.target.value }))}
              placeholder="Reason for rejection..."
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setRejectModal({ open: false, id: '', reason: '' })} className="btn-secondary text-sm">Cancel</button>
              <button onClick={reject} className="btn-danger text-sm">Confirm Reject</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Set Fee Modal ── */}
      {feeModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Set Consultation Fee</h3>
            <p className="text-sm text-gray-500 mb-4">
              This fee will be shown to users when they book <span className="font-medium text-gray-700">{feeModal.name}</span>.
            </p>

            {feeModal.currentFee > 0 && (
              <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3 text-sm text-amber-700">
                Current fee: <strong>₹{Number(feeModal.currentFee).toLocaleString('en-IN')}</strong>
              </div>
            )}

            <label className="label">Fee Amount (₹) <span className="text-red-500">*</span></label>
            <input
              type="number"
              min="0"
              step="50"
              className="input mb-1"
              placeholder="e.g. 2000"
              value={feeInput}
              onChange={(e) => setFeeInput(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-gray-400 mb-4">Enter 0 to remove the fee (booking will be disabled).</p>

            <div className="flex gap-3">
              <button
                onClick={() => setFeeModal({ open: false, id: '', name: '', currentFee: '' })}
                className="btn-secondary flex-1"
                disabled={savingFee}
              >
                Cancel
              </button>
              <button
                onClick={saveFee}
                disabled={savingFee || feeInput === ''}
                className="btn-primary flex-1 disabled:opacity-60"
              >
                {savingFee ? 'Saving...' : `Save ₹${feeInput ? Number(feeInput).toLocaleString('en-IN') : '—'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
