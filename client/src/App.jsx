import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './store/AuthContext';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Updates from './pages/Updates';
import Bookings from './pages/Bookings';
import BookingDetail from './pages/BookingDetail';
import Guides from './pages/Guides';
import TourTypes from './pages/TourTypes';
import Hotels from './pages/Hotels';
import Import from './pages/Import';
import Users from './pages/Users';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return user ? children : <Navigate to="/login" />;
}

function AdminRoute({ children }) {
  const { isAdmin } = useAuth();
  return isAdmin ? children : <Navigate to="/dashboard" />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="updates" element={<Updates />} />
        <Route path="bookings" element={<Bookings />} />
        <Route path="bookings/:id" element={<BookingDetail />} />
        <Route path="guides" element={<Guides />} />
        <Route path="tour-types" element={<TourTypes />} />
        <Route path="hotels" element={<Hotels />} />
        <Route
          path="import"
          element={
            <AdminRoute>
              <Import />
            </AdminRoute>
          }
        />
        <Route
          path="users"
          element={
            <AdminRoute>
              <Users />
            </AdminRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
