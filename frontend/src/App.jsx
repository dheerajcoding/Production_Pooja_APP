import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';

import UserLayout from './layouts/UserLayout';
import UserDashboard from './pages/user/Dashboard';
import UserProfile from './pages/user/Profile';
import UserBookings from './pages/user/Bookings';
import BrowsePoojas from './pages/user/BrowsePoojas';
import PoojaDetail from './pages/user/PoojaDetail';
import BookPooja from './pages/user/BookPooja';
import BookingDetail from './pages/user/BookingDetail';
import Shop from './pages/user/Shop';
import Cart from './pages/user/Cart';
import Orders from './pages/user/Orders';
import OnlinePoojas from './pages/user/OnlinePoojas';
import BookPandit from './pages/user/BookPandit';
import OfflineBookings from './pages/user/OfflineBookings';
import UserAstrology from './pages/user/Astrology';

import PanditLayout from './layouts/PanditLayout';
import PanditDashboard from './pages/pandit/Dashboard';
import PanditProfile from './pages/pandit/Profile';
import PanditBookings from './pages/pandit/Bookings';
import PanditAstrology from './pages/pandit/Astrology';

import AdminLayout from './layouts/AdminLayout';
import AdminDashboard from './pages/admin/Dashboard';
import AdminUsers from './pages/admin/Users';
import AdminPandits from './pages/admin/Pandits';
import AdminPoojas from './pages/admin/Poojas';
import AdminBookings from './pages/admin/Bookings';
import AdminProducts from './pages/admin/Products';
import AdminOnlinePoojas from './pages/admin/OnlinePoojas';
import AdminOrders from './pages/admin/Orders';
import AdminOfflineBookings from './pages/admin/OfflineBookings';
import AdminAstrology from './pages/admin/Astrology';

import LandingPage from './pages/Landing';
import LoadingSpinner from './components/common/LoadingSpinner';

const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner fullScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
};

export default function App() {
  const { loading } = useAuth();
  if (loading) return <LoadingSpinner fullScreen />;

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />

      {/* User Routes */}
      <Route path="/dashboard" element={<ProtectedRoute roles={['user']}><UserLayout /></ProtectedRoute>}>
        <Route index element={<UserDashboard />} />
        <Route path="profile" element={<UserProfile />} />
        <Route path="bookings" element={<UserBookings />} />
        <Route path="bookings/:id" element={<BookingDetail />} />
        <Route path="poojas" element={<BrowsePoojas />} />
        <Route path="poojas/:id" element={<PoojaDetail />} />
        <Route path="book/:poojaId" element={<BookPooja />} />
        <Route path="shop" element={<Shop />} />
        <Route path="cart" element={<Cart />} />
        <Route path="orders" element={<Orders />} />
        <Route path="online-poojas" element={<OnlinePoojas />} />
        <Route path="book-pandit" element={<BookPandit />} />
        <Route path="offline-bookings" element={<OfflineBookings />} />
        <Route path="astrology" element={<UserAstrology />} />
      </Route>

      {/* Pandit Routes */}
      <Route path="/pandit" element={<ProtectedRoute roles={['pandit']}><PanditLayout /></ProtectedRoute>}>
        <Route index element={<PanditDashboard />} />
        <Route path="profile" element={<PanditProfile />} />
        <Route path="bookings" element={<PanditBookings />} />
        <Route path="astrology" element={<PanditAstrology />} />
      </Route>

      {/* Admin Routes */}
      <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminLayout /></ProtectedRoute>}>
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="pandits" element={<AdminPandits />} />
        <Route path="poojas" element={<AdminPoojas />} />
        <Route path="bookings" element={<AdminBookings />} />
        <Route path="products" element={<AdminProducts />} />
        <Route path="online-poojas" element={<AdminOnlinePoojas />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="offline-bookings" element={<AdminOfflineBookings />} />
        <Route path="astrology" element={<AdminAstrology />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
