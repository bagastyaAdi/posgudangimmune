import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';

// ── Global Error Boundary ──────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('App ErrorBoundary caught:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: '#0f1a14', padding: '2rem', gap: '1rem'
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '16px', padding: '2rem 2.5rem', maxWidth: '560px', width: '100%',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>⚠️</div>
            <h2 style={{ color: '#ef4444', fontWeight: 800, marginBottom: '0.5rem' }}>Terjadi Kesalahan Aplikasi</h2>
            <p style={{ color: '#9ca3af', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
              {this.state.error?.message || 'Error tidak diketahui'}
            </p>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              style={{
                backgroundColor: '#10b981', color: 'white', border: 'none',
                borderRadius: '8px', padding: '0.6rem 1.5rem', fontWeight: 700,
                cursor: 'pointer', fontSize: '0.9rem'
              }}
            >
              🔄 Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Layouts
import AdminLayout from './layouts/AdminLayout';

// Pages
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import AdminStaff from './pages/AdminStaff';
import AdminProducts from './pages/AdminProducts';
import POS from './pages/POS';
import RiwayatPenjualan from './pages/RiwayatPenjualan';
import AdminInventory from './pages/AdminInventory';
import AdminStockHistory from './pages/AdminStockHistory';
import AdminSettings from './pages/AdminSettings';
import AdminOutlets from './pages/AdminOutlets';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import RiwayatKasir from './pages/RiwayatKasir';

// Route Guards
const ProtectedRoute = ({ children, requiredRole }) => {
  const { currentUser, userData, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ 
        height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'var(--bg-dark)', gap: '1.5rem'
      }}>
        <div className="glass-panel animate-pulse" style={{ padding: '2rem', borderRadius: '24px' }}>
          <div style={{ 
            width: '40px', height: '40px', border: '4px solid rgba(16,185,129,0.1)', 
            borderTop: '4px solid var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' 
          }}></div>
        </div>
        <p className="text-primary font-black uppercase tracking-widest text-xs animate-pulse">Menyiapkan Workspace...</p>
        <style>{`
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  if (!currentUser) return <Navigate to="/login" />;
  
  if (requiredRole && userData?.role !== requiredRole && userData?.role !== 'admin') {
     return <Navigate to="/" />;
  }

  return children;
};

// Home Redirect logic
const HomeRedirect = () => {
  const { currentUser, userData, loading } = useAuth();

  if (loading) return null; // Let ProtectedRoute or parent handle loading
  if (!currentUser) return <Navigate to="/login" />;

  if (userData?.role !== 'admin' && userData?.role !== 'owner') return <Navigate to="/admin/pos" />;
  return <Navigate to="/admin" />;
};

export default function App() {
  return (
    <ErrorBoundary>
      <SettingsProvider>
        <Router>
          <Routes>
          {/* Public */}
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Admin Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="pos" element={<POS />} />
            <Route path="riwayat-kasir" element={<RiwayatKasir />} />
            <Route path="riwayat-penjualan" element={<RiwayatPenjualan />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="staff" element={<AdminStaff />} />
            <Route path="inventory" element={<AdminInventory />} />
            <Route path="riwayat-stok" element={<AdminStockHistory />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="outlets" element={<AdminOutlets />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
      </SettingsProvider>
    </ErrorBoundary>
  );
}
