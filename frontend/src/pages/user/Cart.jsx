import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const loadRazorpay = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });

export default function Cart() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkoutStep, setCheckoutStep] = useState('cart'); // cart | address | processing
  const [address, setAddress] = useState({
    street: user?.address?.street || '',
    city: user?.address?.city || '',
    state: user?.address?.state || '',
    pincode: user?.address?.pincode || '',
    landmark: '',
  });
  const [placing, setPlacing] = useState(false);

  const loadCart = async () => {
    try {
      const { data } = await api.get('/cart');
      setCart(data.data);
    } catch (_) {}
    finally { setLoading(false); }
  };

  useEffect(() => { loadCart(); }, []);

  const updateQty = async (productId, quantity) => {
    try {
      const { data } = await api.put('/cart/update', { productId, quantity });
      setCart(data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed.');
    }
  };

  const removeItem = async (productId) => {
    try {
      const { data } = await api.delete(`/cart/item/${productId}`);
      setCart(data.data);
      toast.success('Item removed.');
    } catch (_) {
      toast.error('Failed to remove item.');
    }
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    if (!address.street || !address.city || !address.state || !address.pincode) {
      return toast.error('Please fill in your delivery address.');
    }
    setPlacing(true);
    try {
      // Create order
      const { data: orderData } = await api.post('/orders', { address });
      const shopOrder = orderData.data;

      // Create Razorpay payment
      const { data: payData } = await api.post('/orders/payment/create', { orderId: shopOrder._id });
      const { orderId, amount, currency, keyId } = payData.data;

      const loaded = await loadRazorpay();
      if (!loaded) return toast.error('Payment gateway failed to load.');

      const options = {
        key: keyId,
        amount,
        currency,
        name: 'Saral Pooja Store',
        description: `Order #${shopOrder._id}`,
        order_id: orderId,
        prefill: { name: user?.name, email: user?.email, contact: user?.phone },
        theme: { color: '#f97316' },
        handler: async (response) => {
          try {
            await api.post('/orders/payment/verify', {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              shopOrderId: shopOrder._id,
            });
            toast.success('🎉 Order placed successfully!');
            navigate('/dashboard/orders');
          } catch {
            toast.error('Payment verification failed. Contact support.');
          }
        },
        modal: {
          ondismiss: () => toast('Payment cancelled.', { icon: 'ℹ️' }),
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to place order.');
    } finally {
      setPlacing(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>;

  const items = cart?.items || [];
  const total = items.reduce((sum, item) => sum + item.priceAtAdd * item.quantity, 0);

  if (items.length === 0) {
    return (
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Your Cart</h1>
        <div className="card text-center py-16">
          <p className="text-6xl mb-4">🛒</p>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Your cart is empty</h2>
          <p className="text-gray-500 text-sm mb-6">Browse our store and add items to your cart.</p>
          <Link to="/dashboard/shop" className="btn-primary text-sm px-6">Go to Shop</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Your Cart ({items.length} items)</h1>
        <Link to="/dashboard/shop" className="text-sm text-primary-600 hover:underline">← Continue Shopping</Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-3">
          {items.map((item) => {
            const product = item.productId;
            return (
              <div key={product?._id} className="card p-4 flex items-start gap-3">
                <div className="w-16 h-16 rounded-lg bg-orange-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {product?.image ? <img src={product.image} alt="" className="w-full h-full object-cover rounded-lg" /> : <span className="text-2xl">🛍️</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 text-sm truncate">{product?.name}</h3>
                  <p className="text-xs text-gray-500">{product?.category}</p>
                  <p className="font-bold text-primary-600 mt-1">₹{item.priceAtAdd.toLocaleString('en-IN')}</p>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                    <button onClick={() => updateQty(product._id, item.quantity - 1)} className="px-2.5 py-1 hover:bg-gray-100 text-gray-600 font-bold">−</button>
                    <span className="px-3 py-1 text-sm font-medium border-x border-gray-200">{item.quantity}</span>
                    <button onClick={() => updateQty(product._id, item.quantity + 1)} className="px-2.5 py-1 hover:bg-gray-100 text-gray-600 font-bold">+</button>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">₹{(item.priceAtAdd * item.quantity).toLocaleString('en-IN')}</p>
                  <button onClick={() => removeItem(product._id)} className="text-xs text-red-500 hover:underline">Remove</button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Order Summary + Address */}
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-3">Order Summary</h3>
            <div className="space-y-2 text-sm">
              {items.map((item) => (
                <div key={item.productId?._id} className="flex justify-between text-gray-600">
                  <span className="truncate mr-2">{item.productId?.name} × {item.quantity}</span>
                  <span className="flex-shrink-0">₹{(item.priceAtAdd * item.quantity).toLocaleString('en-IN')}</span>
                </div>
              ))}
              <div className="border-t pt-2 flex justify-between font-bold text-gray-900">
                <span>Total</span>
                <span className="text-primary-600">₹{total.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Delivery Address */}
          <form onSubmit={handlePlaceOrder} className="card space-y-3">
            <h3 className="font-semibold text-gray-900">Delivery Address</h3>
            <div>
              <label className="label">Street *</label>
              <input type="text" className="input" placeholder="House no., Street" value={address.street} onChange={(e) => setAddress({ ...address, street: e.target.value })} required />
            </div>
            <div>
              <label className="label">Landmark</label>
              <input type="text" className="input" placeholder="Near temple..." value={address.landmark} onChange={(e) => setAddress({ ...address, landmark: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">City *</label>
                <input type="text" className="input" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} required />
              </div>
              <div>
                <label className="label">State *</label>
                <input type="text" className="input" value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} required />
              </div>
            </div>
            <div>
              <label className="label">Pincode *</label>
              <input type="text" className="input" pattern="[0-9]{6}" value={address.pincode} onChange={(e) => setAddress({ ...address, pincode: e.target.value })} required />
            </div>
            <button type="submit" disabled={placing} className="btn-primary w-full py-2.5 text-sm">
              {placing ? 'Processing...' : `Pay ₹${total.toLocaleString('en-IN')} →`}
            </button>
            <p className="text-center text-xs text-gray-400">🔒 Secured by Razorpay</p>
          </form>
        </div>
      </div>
    </div>
  );
}
