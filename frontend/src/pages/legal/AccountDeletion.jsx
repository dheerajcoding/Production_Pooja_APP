import { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { DELETION_SECTIONS, COMPANY_META } from './legalContent';

export default function AccountDeletion() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    reason: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '', id: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email) {
      setStatus({ type: 'error', message: 'Please provide a valid registered email address.' });
      return;
    }

    setSubmitting(true);
    setStatus({ type: '', message: '', id: '' });

    try {
      const res = await axios.post('/api/users/request-deletion', formData);
      if (res.data?.success) {
        setStatus({
          type: 'success',
          message: res.data.message || 'Your account deletion request has been recorded successfully.',
          id: res.data?.data?.id || '',
        });
        setFormData({ name: '', email: '', phone: '', reason: '' });
      } else {
        setStatus({ type: 'error', message: res.data?.message || 'Failed to submit deletion request.' });
      }
    } catch (err) {
      setStatus({
        type: 'error',
        message: err?.response?.data?.message || 'Network error. Please try again or email us directly.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-primary-600 font-bold text-xl hover:opacity-90">
            <span className="text-2xl">🪔</span>
            <span>Ritual Mitra</span>
          </Link>
          <div className="flex items-center gap-4 text-sm font-medium">
            <Link to="/privacy-policy" className="text-gray-600 hover:text-primary-600">Privacy Policy</Link>
            <Link to="/terms-and-conditions" className="text-gray-600 hover:text-primary-600">Terms</Link>
            <Link to="/" className="btn-secondary py-1.5 px-3 text-xs">Back to Home</Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-10 w-full">
        {/* Title Card */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 mb-8">
          <div className="inline-flex items-center gap-2 bg-red-50 text-red-700 text-xs font-semibold px-3 py-1 rounded-full mb-4">
            <span>🛡️</span> Data Safety & User Privacy
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 mb-3">
            Account & Data Deletion
          </h1>
          <p className="text-gray-600 text-base leading-relaxed">
            At Ritual Mitra, we respect your privacy and give you complete control over your personal data.
            You can request the deletion of your account and associated data directly through this page or inside our mobile app.
          </p>
        </div>

        {/* Request Form Card */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-primary-100 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center text-xl font-bold">
              📝
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Submit Account Deletion Request</h2>
              <p className="text-xs text-gray-500">No app installation or password login required</p>
            </div>
          </div>

          {status.type === 'success' ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
              <div className="text-4xl mb-3">✅</div>
              <h3 className="text-lg font-bold text-green-900 mb-1">Request Received</h3>
              <p className="text-sm text-green-700 max-w-md mx-auto mb-4">{status.message}</p>
              {status.id && (
                <p className="text-xs text-gray-500 font-mono bg-white inline-block px-3 py-1 rounded border border-gray-200">
                  Request Ref: {status.id}
                </p>
              )}
              <div className="mt-6">
                <button
                  onClick={() => setStatus({ type: '', message: '', id: '' })}
                  className="btn-secondary text-xs px-4 py-2"
                >
                  Submit Another Request
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {status.type === 'error' && (
                <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg border border-red-200">
                  {status.message}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Registered Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="yourname@gmail.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input w-full text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Registered Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="input w-full text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Full Name (as registered in account)
                </label>
                <input
                  type="text"
                  placeholder="Your Full Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input w-full text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Reason for Deletion (Optional)
                </label>
                <textarea
                  rows="3"
                  placeholder="Help us improve: why would you like to delete your account?"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="input w-full text-sm resize-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary w-full sm:w-auto px-6 py-2.5 text-sm font-semibold flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      Submitting Request...
                    </>
                  ) : (
                    'Submit Account Deletion Request'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Data Deletion Summary Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 text-red-600 font-bold mb-3">
              <span className="text-xl">🗑️</span>
              <h3 className="text-base text-gray-900">What Personal Data is Deleted</h3>
            </div>
            <ul className="text-xs text-gray-600 space-y-2 list-disc pl-5">
              <li>Profile information (name, email, phone number)</li>
              <li>Saved doorstep addresses & locations</li>
              <li>Uploaded profile photos and images</li>
              <li>Active cart items & checkout preferences</li>
              <li>Astrology chats and submitted birth details</li>
              <li>Push notification tokens & device identifiers</li>
            </ul>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 text-amber-600 font-bold mb-3">
              <span className="text-xl">📋</span>
              <h3 className="text-base text-gray-900">What Data May Be Retained & Why</h3>
            </div>
            <ul className="text-xs text-gray-600 space-y-2 list-disc pl-5">
              <li>Statutory tax invoices and payment transactions (required under Indian financial & accounting laws)</li>
              <li>Completed booking receipts for dispute defense and audit compliance</li>
              <li>All retained records are archived securely and never used for marketing</li>
              <li>Processing timeline: requests completed within 30 days</li>
            </ul>
          </div>
        </div>

        {/* Full Policy Sections */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 space-y-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
            Account Deletion Policy Details
          </h2>

          {DELETION_SECTIONS.map((sec) => (
            <div key={sec.n} className="space-y-2">
              <h3 className="text-base font-bold text-gray-900">
                {sec.n}. {sec.title}
              </h3>
              {sec.body.map((p, i) => (
                <p key={i} className="text-sm text-gray-600 leading-relaxed">
                  {p}
                </p>
              ))}
            </div>
          ))}

          {/* Contact Support Box */}
          <div className="bg-orange-50/60 rounded-xl p-5 border border-orange-100 mt-6">
            <h4 className="font-bold text-gray-900 text-sm mb-2">Need Immediate Assistance?</h4>
            <p className="text-xs text-gray-600 mb-2">
              You can also contact our Data Privacy & Support team directly:
            </p>
            <div className="text-xs text-gray-700 space-y-1">
              <p>📧 Email: <a href={`mailto:${COMPANY_META.supportEmail}`} className="text-primary-600 underline font-medium">{COMPANY_META.supportEmail}</a></p>
              <p>📞 Phone: <a href={`tel:${COMPANY_META.supportPhone}`} className="text-primary-600 underline font-medium">{COMPANY_META.supportPhone}</a></p>
              <p>📍 Office: {COMPANY_META.address}</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-6 px-4 text-center text-xs">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} {COMPANY_META.brand}. All rights reserved.</p>
          <div className="flex gap-4">
            <Link to="/privacy-policy" className="hover:text-white">Privacy Policy</Link>
            <Link to="/terms-and-conditions" className="hover:text-white">Terms & Conditions</Link>
            <Link to="/refund-policy" className="hover:text-white">Refund Policy</Link>
            <Link to="/delete-account" className="text-white font-semibold">Account Deletion</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
