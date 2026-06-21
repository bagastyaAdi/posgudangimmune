import React, { useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, LayoutDashboard, Store, Package, FileSpreadsheet, Users, PackageSearch, Menu, X, Warehouse, Wrench, ClipboardCheck, Settings, ShoppingCart } from 'lucide-react';

export default function AdminLayout() {
  const { logout, userData } = useAuth();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const closeSidebar = () => setIsSidebarOpen(false);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/admin/login');
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };

  return (
    <div className="flex" style={{ minHeight: '100vh', backgroundColor: 'var(--bg-dark)' }}>
      {/* Mobile Top Header */}
      <div className="mobile-header items-center justify-between glass-panel" style={{ 
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 900, 
        padding: '1rem', borderRadius: 0, borderBottom: '1px solid var(--border-color)' 
      }}>
        <img src="/logo.png" alt="GUDANG IMMUNE" style={{ height: '32px', objectFit: 'contain' }} />
        <button onClick={toggleSidebar} style={{ background: 'none', border: 'none', color: 'var(--text-main)' }}>
          <Menu size={24} />
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && <div className="sidebar-overlay" onClick={closeSidebar}></div>}

      {/* Sidebar */}
      <aside className={`glass-panel admin-sidebar ${isSidebarOpen ? 'open' : ''}`} style={{ 
        width: '260px', borderRadius: '0', display: 'flex', flexDirection: 'column', 
        borderRight: '1px solid var(--border-color)', backgroundColor: 'var(--panel-bg)'
      }}>
        <div className="flex justify-between items-center" style={{ padding: '2rem 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
          <div>
            <h2 style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '1.25rem', lineHeight: '1.2' }}>Gudang<br/>Immune Bali</h2>
            <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Admin Portal</p>
          </div>
          <button className="mobile-header" onClick={closeSidebar} style={{ background: 'none', border: 'none', color: 'var(--text-main)' }}>
            <X size={20} />
          </button>
        </div>
        
        <nav style={{ flex: 1, padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto' }}>
          {(userData?.role === 'admin' || userData?.role === 'owner') && (
            <Link to="/admin" onClick={closeSidebar} className="btn-secondary" style={{ justifyContent: 'flex-start', border: 'none' }}>
              <LayoutDashboard size={18} /> Dashboard
            </Link>
          )}
          <Link to="/admin/pos" onClick={closeSidebar} className="btn-secondary" style={{ justifyContent: 'flex-start', border: 'none' }}>
            <FileSpreadsheet size={18} /> Input Penjualan
          </Link>
          <Link 
            to="/admin/pos" 
            onClick={(e) => {
              closeSidebar();
              setTimeout(() => window.dispatchEvent(new Event('open-cart')), 100);
            }} 
            className="btn-secondary mobile-only" 
            style={{ justifyContent: 'flex-start', border: 'none' }}
          >
            <ShoppingCart size={18} /> Keranjang
          </Link>
          <Link to="/admin/riwayat-kasir" onClick={closeSidebar} className="btn-secondary" style={{ justifyContent: 'flex-start', border: 'none' }}>
            <FileSpreadsheet size={18} /> Rekap Hari Ini
          </Link>
          {(userData?.role === 'admin' || userData?.role === 'owner') && (
            <>
              <Link to="/admin/riwayat-penjualan" onClick={closeSidebar} className="btn-secondary" style={{ justifyContent: 'flex-start', border: 'none' }}>
                <FileSpreadsheet size={18} /> Riwayat Penjualan
              </Link>
              <Link to="/admin/products" onClick={closeSidebar} className="btn-secondary" style={{ justifyContent: 'flex-start', border: 'none' }}>
                <Package size={18} /> Master Produk
              </Link>
              <Link to="/admin/staff" onClick={closeSidebar} className="btn-secondary" style={{ justifyContent: 'flex-start', border: 'none' }}>
                <Users size={18} /> Data Karyawan
              </Link>
              <Link to="/admin/inventory" onClick={closeSidebar} className="btn-secondary" style={{ justifyContent: 'flex-start', border: 'none' }}>
                <Package size={18} /> Inventaris Stok
              </Link>
              <Link to="/admin/riwayat-stok" onClick={closeSidebar} className="btn-secondary" style={{ justifyContent: 'flex-start', border: 'none' }}>
                <FileSpreadsheet size={18} /> Riwayat Stok
              </Link>
            </>
          )}
          {userData?.role === 'admin' && (
            <Link to="/admin/settings" onClick={closeSidebar} className="btn-secondary" style={{ justifyContent: 'flex-start', border: 'none' }}>
              <Settings size={18} /> Pengaturan
            </Link>
          )}
        </nav>

        <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ marginBottom: '1rem' }}>
            <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>{userData?.name || 'Admin'}</p>
            <p className="text-muted" style={{ fontSize: '0.8rem' }}>
              {userData?.role === 'admin' ? 'Administrator' : userData?.role === 'owner' ? 'Owner / Pemilik' : 'Kasir Cabang'}
            </p>
          </div>
          <button onClick={handleLogout} className="btn-secondary" style={{ width: '100%', borderColor: 'rgba(239, 68, 68, 0.5)', color: 'var(--danger)' }}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content" style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
}
