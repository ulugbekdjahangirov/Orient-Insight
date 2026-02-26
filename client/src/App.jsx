import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './store/AuthContext';
import { useYear } from './context/YearContext';
import Layout from './components/layout/Layout';
import Login from './pages/Login';

// Lazy-loaded pages — each page is a separate JS chunk
const Dashboard    = lazy(() => import('./pages/Dashboard'));
const Updates      = lazy(() => import('./pages/Updates'));
const Bookings     = lazy(() => import('./pages/Bookings'));
const BookingDetail = lazy(() => import('./pages/BookingDetail'));
const Guides       = lazy(() => import('./pages/Guides'));
const TourTypes    = lazy(() => import('./pages/TourTypes'));
const Hotels       = lazy(() => import('./pages/Hotels'));
const Opex         = lazy(() => import('./pages/Opex'));
const Price        = lazy(() => import('./pages/Price'));
const Rechnung     = lazy(() => import('./pages/Rechnung'));
const Ausgaben     = lazy(() => import('./pages/Ausgaben'));
const Import       = lazy(() => import('./pages/Import'));
const Users        = lazy(() => import('./pages/Users'));
const Settings     = lazy(() => import('./pages/Settings'));
const GmailSettings  = lazy(() => import('./pages/GmailSettings'));
const EmailImports   = lazy(() => import('./pages/EmailImports'));
const Partners       = lazy(() => import('./pages/Partners'));
const Jahresplanung  = lazy(() => import('./pages/Jahresplanung'));

function PageLoader() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
    </div>
  );
}

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
  const { selectedYear } = useYear();
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
        <Route path="dashboard" element={
          <Suspense fallback={<PageLoader />}>
            <Dashboard key={selectedYear} />
          </Suspense>
        } />
        <Route path="updates" element={
          <Suspense fallback={<PageLoader />}>
            <Updates />
          </Suspense>
        } />
        <Route path="bookings" element={
          <Suspense fallback={<PageLoader />}>
            <Bookings />
          </Suspense>
        } />
        <Route path="bookings/:id" element={
          <Suspense fallback={<PageLoader />}>
            <BookingDetail />
          </Suspense>
        } />
        <Route path="guides" element={
          <Suspense fallback={<PageLoader />}>
            <Guides key={selectedYear} />
          </Suspense>
        } />
        <Route path="tour-types" element={
          <Suspense fallback={<PageLoader />}>
            <TourTypes />
          </Suspense>
        } />
        <Route path="hotels" element={
          <Suspense fallback={<PageLoader />}>
            <Hotels />
          </Suspense>
        } />
        <Route path="opex" element={
          <Suspense fallback={<PageLoader />}>
            <Opex key={selectedYear} />
          </Suspense>
        } />
        <Route path="price" element={
          <Suspense fallback={<PageLoader />}>
            <Price key={selectedYear} />
          </Suspense>
        } />
        <Route path="rechnung" element={
          <Suspense fallback={<PageLoader />}>
            <Rechnung key={selectedYear} />
          </Suspense>
        } />
        <Route path="ausgaben" element={
          <Suspense fallback={<PageLoader />}>
            <Ausgaben key={selectedYear} />
          </Suspense>
        } />
        <Route path="import" element={
          <AdminRoute>
            <Suspense fallback={<PageLoader />}>
              <Import />
            </Suspense>
          </AdminRoute>
        } />
        <Route path="users" element={
          <AdminRoute>
            <Suspense fallback={<PageLoader />}>
              <Users />
            </Suspense>
          </AdminRoute>
        } />
        <Route path="gmail-settings" element={
          <AdminRoute>
            <Suspense fallback={<PageLoader />}>
              <GmailSettings />
            </Suspense>
          </AdminRoute>
        } />
        <Route path="email-imports" element={
          <Suspense fallback={<PageLoader />}>
            <EmailImports key={selectedYear} />
          </Suspense>
        } />
        <Route path="partners" element={
          <Suspense fallback={<PageLoader />}>
            <Partners />
          </Suspense>
        } />
        <Route path="jahresplanung" element={
          <Suspense fallback={<PageLoader />}>
            <Jahresplanung />
          </Suspense>
        } />
        <Route path="settings" element={
          <AdminRoute>
            <Suspense fallback={<PageLoader />}>
              <Settings />
            </Suspense>
          </AdminRoute>
        } />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
