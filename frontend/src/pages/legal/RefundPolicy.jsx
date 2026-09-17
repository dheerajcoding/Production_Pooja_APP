import { Link } from 'react-router-dom';
import { REFUND_SECTIONS, COMPANY_META } from './legalContent';

export default function RefundPolicy() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-primary-600 font-bold text-xl hover:opacity-90">
            <span className="text-2xl">🪔</span>
            <span>Saral Pooja</span>
          </Link>
          <div className="flex items-center gap-4 text-sm font-medium">
            <Link to="/privacy-policy" className="text-gray-600 hover:text-primary-600">Privacy Policy</Link>
            <Link to="/delete-account" className="text-gray-600 hover:text-primary-600">Delete Account</Link>
            <Link to="/" className="btn-secondary py-1.5 px-3 text-xs">Back to Home</Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-10 w-full">
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 mb-8">
          <div className="inline-flex items-center gap-2 bg-orange-50 text-orange-700 text-xs font-semibold px-3 py-1 rounded-full mb-4">
            <span>💸</span> Cancellation & Refunds
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">
            Refund & Cancellation Policy
          </h1>
          <p className="text-xs text-gray-500 mb-4">Effective Date: {COMPANY_META.effective}</p>
          <p className="text-gray-600 text-sm leading-relaxed">
            This policy outlines customer eligibility, timelines, and procedures for booking cancellations and refund processing on {COMPANY_META.brand}.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 space-y-6">
          {REFUND_SECTIONS.map((sec) => (
            <div key={sec.n} className="space-y-2 pb-4 border-b border-gray-50 last:border-0 last:pb-0">
              <h2 className="text-lg font-bold text-gray-900">
                {sec.n}. {sec.title}
              </h2>
              {sec.body.map((p, i) => (
                <p key={i} className="text-sm text-gray-600 leading-relaxed">
                  {p}
                </p>
              ))}
            </div>
          ))}

          {/* Contact Box */}
          <div className="bg-orange-50/60 rounded-xl p-5 border border-orange-100 mt-6">
            <h3 className="font-bold text-gray-900 text-sm mb-2">Refund Assistance</h3>
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
            <Link to="/refund-policy" className="text-white font-semibold">Refund Policy</Link>
            <Link to="/delete-account" className="hover:text-white">Account Deletion</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
