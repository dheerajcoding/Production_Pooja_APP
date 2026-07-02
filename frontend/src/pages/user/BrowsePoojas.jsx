import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Pagination from '../../components/common/Pagination';

import img1  from '../../images/image1.jpg';
import img2  from '../../images/image2.jpg';
import img5  from '../../images/image5.jpg';
import img10 from '../../images/image10.jpg';
import img12 from '../../images/image12.jpg';
import img13 from '../../images/image13.jpg';
import img15 from '../../images/image15.png';
import img16 from '../../images/image16.jpg';

const CATEGORIES = ['All', 'Griha Pravesh', 'Satyanarayan Katha', 'Navratri', 'Ganesh Puja', 'Laxmi Puja', 'Shradh', 'Vivah', 'Namkaran', 'Mundan', 'Other'];

const CATEGORY_SHOWCASE = [
  { label: 'Ganesh Puja',         image: img5,  gradient: 'from-yellow-700/80 to-orange-700/70' },
  { label: 'Navratri',            image: img13, gradient: 'from-red-800/80 to-pink-700/70' },
  { label: 'Laxmi Puja',          image: img15, gradient: 'from-amber-700/80 to-yellow-600/70' },
  { label: 'Satyanarayan Katha',  image: img12, gradient: 'from-violet-800/80 to-purple-700/70' },
  { label: 'Griha Pravesh',       image: img1,  gradient: 'from-orange-800/80 to-rose-700/70' },
  { label: 'Vivah',               image: img2,  gradient: 'from-pink-800/80 to-rose-700/70' },
];

export default function BrowsePoojas() {
  const [searchParams] = useSearchParams();
  const [poojas, setPoojas] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: 9 });
    if (category) params.set('category', category);
    if (search) params.set('search', search);
    api.get(`/poojas?${params}`).then(({ data }) => {
      setPoojas(data.data.poojas);
      setPagination(data.data.pagination);
    }).finally(() => setLoading(false));
  }, [category, search, page]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
  };

  return (
    <div className="space-y-5">

      {/* ── Header Photo Banner ── */}
      <div className="relative rounded-2xl overflow-hidden" style={{ height: '150px' }}>
        <img src={img10} alt="Browse Poojas" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-orange-900/90 via-orange-700/70 to-transparent" />
        <div className="absolute inset-0 flex items-center px-6">
          <div className="text-white">
            <h1 className="text-2xl font-bold drop-shadow">Browse Poojas 🪔</h1>
            <p className="text-orange-100 text-sm mt-1">Choose from our sacred ceremonies</p>
          </div>
        </div>
      </div>

      {/* ── Category Showcase (horizontal scroll) ── */}
      <div className="overflow-x-auto -mx-4 px-4">
        <div className="flex gap-3 pb-1" style={{ width: 'max-content' }}>
          {CATEGORY_SHOWCASE.map((cat) => (
            <button
              key={cat.label}
              onClick={() => { setCategory(category === cat.label ? '' : cat.label); setPage(1); }}
              className={`relative rounded-xl overflow-hidden flex-shrink-0 transition-all hover:scale-105 active:scale-95 ${category === cat.label ? 'ring-3 ring-orange-500 ring-offset-1' : ''}`}
              style={{ width: '110px', height: '70px' }}
            >
              <img src={cat.image} alt={cat.label} className="absolute inset-0 w-full h-full object-cover" />
              <div className={`absolute inset-0 bg-gradient-to-t ${cat.gradient}`} />
              <span className="absolute inset-0 flex items-end justify-center pb-1.5 text-white text-xs font-bold text-center px-1 leading-tight drop-shadow">
                {cat.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Search & Filter Chips ── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3 shadow-sm">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            className="input flex-1"
            placeholder="Search poojas..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          <button type="submit" className="btn-primary px-4">Search</button>
        </form>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => { setCategory(cat === 'All' ? '' : cat); setPage(1); }}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${(cat === 'All' && !category) || category === cat ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
      ) : poojas.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-gray-500">No poojas found. Try a different search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {poojas.map((pooja) => {
            const fallbackImages = { 'Ganesh Puja': img5, 'Navratri': img13, 'Laxmi Puja': img15, 'Satyanarayan Katha': img12, 'Griha Pravesh': img1, 'Vivah': img2, 'Havan': img10 };
            const fallback = fallbackImages[pooja.category] || img16;
            return (
            <Link key={pooja._id} to={`/dashboard/poojas/${pooja._id}`} className="card hover:shadow-md transition-shadow p-0 overflow-hidden group">
              <div className="h-44 bg-gradient-to-br from-orange-100 to-amber-50 overflow-hidden relative">
                <img
                  src={pooja.image || fallback}
                  alt={pooja.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {/* Category badge overlay */}
                <span className="absolute top-2 left-2 bg-black/50 backdrop-blur-sm text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                  {pooja.category}
                </span>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-gray-900">{pooja.name}</h3>
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{pooja.description}</p>
                <div className="flex items-center justify-between mt-3">
                  <div>
                    <p className="text-lg font-bold text-primary-600">₹{pooja.price.toLocaleString('en-IN')}</p>
                    <p className="text-xs text-gray-400">{pooja.duration}</p>
                  </div>
                  <span className="btn-primary text-xs px-3 py-1.5">Book Now</span>
                </div>
              </div>
            </Link>
            );
          })}
        </div>
      )}

      <Pagination pagination={pagination} onPageChange={setPage} />
    </div>
  );
}
