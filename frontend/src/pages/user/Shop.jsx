import { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Pagination from '../../components/common/Pagination';
import { Link } from 'react-router-dom';

const CATEGORIES = ['All', 'Pooja Samagri', 'Flowers & Garlands', 'Incense & Dhoop', 'Clothing', 'Accessories', 'Diyas & Lamps', 'Books & Calendars', 'Food & Prasad', 'Other'];

export default function Shop() {
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [addingId, setAddingId] = useState(null);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    loadCart();
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: 12, sort });
    if (category) params.set('category', category);
    if (search) params.set('search', search);
    api.get(`/products?${params}`).then(({ data }) => {
      setProducts(data.data.products);
      setPagination(data.data.pagination);
    }).finally(() => setLoading(false));
  }, [category, search, sort, page]);

  const loadCart = async () => {
    try {
      const { data } = await api.get('/cart');
      setCartCount(data.data.totalItems || 0);
    } catch (_) {}
  };

  const addToCart = async (productId) => {
    setAddingId(productId);
    try {
      await api.post('/cart/add', { productId, quantity: 1 });
      toast.success('Added to cart! 🛒');
      loadCart();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add to cart.');
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pooja Store 🛕</h1>
          <p className="text-gray-500 text-sm mt-0.5">T-shirts, samagri, bangles & everything for your pooja</p>
        </div>
        <Link to="/dashboard/cart" className="relative btn-primary text-sm flex items-center gap-2">
          🛒 Cart
          {cartCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
              {cartCount}
            </span>
          )}
        </Link>
      </div>

      {/* Filters */}
      <div className="card p-4 space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            className="input flex-1"
            placeholder="Search products..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          <select className="input w-36" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="newest">Newest</option>
            <option value="price_low">Price: Low</option>
            <option value="price_high">Price: High</option>
            <option value="popular">Popular</option>
          </select>
        </div>
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

      {/* Products Grid */}
      {loading ? (
        <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
      ) : products.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-gray-500">No products found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((product) => (
            <div key={product._id} className="card p-0 overflow-hidden hover:shadow-md transition-shadow">
              <div className="h-36 bg-orange-50 flex items-center justify-center overflow-hidden relative">
                {product.image ? (
                  <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl">🛍️</span>
                )}
                {product.discountPercent > 0 && (
                  <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded">
                    -{product.discountPercent}%
                  </span>
                )}
                {product.stock === 0 && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="text-white text-xs font-bold bg-red-600 px-2 py-1 rounded">Out of Stock</span>
                  </div>
                )}
              </div>
              <div className="p-3">
                <span className="text-xs text-primary-600 font-medium bg-primary-50 px-1.5 py-0.5 rounded">{product.category}</span>
                <h3 className="font-semibold text-gray-900 text-sm mt-1 line-clamp-2">{product.name}</h3>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{product.description}</p>
                <div className="mt-2 flex items-center justify-between">
                  <div>
                    {product.discountPrice > 0 ? (
                      <div>
                        <span className="font-bold text-primary-600 text-sm">₹{product.discountPrice.toLocaleString('en-IN')}</span>
                        <span className="text-xs text-gray-400 line-through ml-1">₹{product.price.toLocaleString('en-IN')}</span>
                      </div>
                    ) : (
                      <span className="font-bold text-primary-600 text-sm">₹{product.price.toLocaleString('en-IN')}</span>
                    )}
                    <p className="text-xs text-gray-400">Stock: {product.stock}</p>
                  </div>
                </div>
                <button
                  onClick={() => addToCart(product._id)}
                  disabled={addingId === product._id || product.stock === 0}
                  className="btn-primary w-full text-xs py-1.5 mt-2 disabled:opacity-50"
                >
                  {addingId === product._id ? 'Adding...' : product.stock === 0 ? 'Out of Stock' : '+ Add to Cart'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Pagination pagination={pagination} onPageChange={setPage} />
    </div>
  );
}
