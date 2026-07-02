import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function PoojaDetail() {
  const { id } = useParams();
  const [pooja, setPooja] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/poojas/${id}`).then(({ data }) => setPooja(data.data)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>;
  if (!pooja) return <div className="card text-center py-12"><p className="text-gray-500">Pooja not found.</p></div>;

  return (
    <div className="max-w-3xl space-y-6">
      <Link to="/dashboard/poojas" className="text-sm text-primary-600 hover:underline">← Back to Poojas</Link>

      <div className="card p-0 overflow-hidden">
        <div className="h-56 bg-gradient-to-br from-orange-100 to-amber-50 flex items-center justify-center overflow-hidden">
          {pooja.image ? (
            <img src={pooja.image} alt={pooja.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-8xl">🪔</span>
          )}
        </div>
        <div className="p-6">
          <span className="text-xs text-primary-600 font-medium bg-primary-50 px-2 py-0.5 rounded">{pooja.category}</span>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">{pooja.name}</h1>
          <p className="text-gray-600 mt-3 leading-relaxed">{pooja.description}</p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-primary-600">₹{pooja.price.toLocaleString('en-IN')}</p>
              <p className="text-xs text-gray-500 mt-1">Price</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-lg font-semibold text-gray-900">{pooja.duration}</p>
              <p className="text-xs text-gray-500 mt-1">Duration</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-lg font-semibold text-gray-900">{pooja.bookingCount}</p>
              <p className="text-xs text-gray-500 mt-1">Bookings</p>
            </div>
          </div>

          {pooja.includedItems?.length > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold text-gray-900 mb-3">What's Included</h3>
              <ul className="space-y-2">
                {pooja.includedItems.map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="text-green-500">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-gray-100">
            <Link to={`/dashboard/book/${pooja._id}`} className="btn-primary w-full text-center block py-3 text-base">
              Book This Pooja – ₹{pooja.price.toLocaleString('en-IN')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
