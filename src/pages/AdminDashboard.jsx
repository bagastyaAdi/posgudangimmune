import React, { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { TrendingUp, Users, Coffee, Store } from 'lucide-react';
import { supabase } from '../supabase';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';

export default function AdminDashboard() {
  const { userData } = useAuth();
  if (userData?.role !== 'admin' && userData?.role !== 'owner') return <Navigate to="/admin/pos" replace />;
  
  const { isMultiBranch } = useSettings();
  const [loading, setLoading] = useState(true);
  const [statsData, setStatsData] = useState({
    revenue: 0,
    branches: 0,
    staff: 0,
    cups: 0
  });
  const [recentActivities, setRecentActivities] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // 1. Get total active branches
      const { count: branchesCount } = await supabase.from('outlets').select('*', { count: 'exact', head: true });
      
      // 2. Get total branch staff (anyone not admin/owner)
      const { count: staffCount } = await supabase.from('users').select('*', { count: 'exact', head: true }).neq('role', 'admin');
      
      // 3. Get total products (as a proxy for menu size or cups if we don't have detailed cup tracking yet)
      const { count: productCount } = await supabase.from('products').select('*', { count: 'exact', head: true });

      // Update basic stats first so they show up even if sales query fails
      setStatsData(prev => ({
        ...prev,
        branches: branchesCount || 0,
        staff: staffCount || 0,
        cups: productCount || 0
      }));

      // 4. Get total revenue (all time)
      const { data: allTx } = await supabase.from('transactions').select('total_amount');
      let allTimeRevenue = 0;
      if (allTx) {
        allTimeRevenue = allTx.reduce((sum, tx) => sum + (Number(tx.total_amount) || 0), 0);
      }

      setStatsData({
        revenue: allTimeRevenue,
        branches: branchesCount || 0,
        staff: staffCount || 0,
        cups: productCount || 0
      });

      // 5. Get recent stock activities (restock and reductions/sales)
      const { data: stockLogs } = await supabase
        .from('stock_restock_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(6);
      
      if (stockLogs) {
        setRecentActivities(stockLogs);
      }

      // 5. Get recent actual transactions (latest 5)
      const { data: txData } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
        
      if (txData) setRecentTransactions(txData);
      
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const stats = [
    { label: 'Total Revenue (All Time)', value: `Rp ${statsData.revenue.toLocaleString('id-ID')}`, icon: <TrendingUp size={24} />, color: 'var(--primary)' },
    ...(isMultiBranch ? [{ label: 'Total Branches', value: `${statsData.branches}`, icon: <Store size={24} />, color: 'var(--success)' }] : []),
    { label: 'Total Staff', value: `${statsData.staff}`, icon: <Users size={24} />, color: '#3b82f6' },
    { label: 'Menu Items', value: `${statsData.cups}`, icon: <Coffee size={24} />, color: '#a855f7' },
  ];

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-primary mb-1">Dashboard Overview</h1>
          <p className="text-muted">Welcome back, Admin. Here is today's summary.</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {stats.map((stat, idx) => (
          <div key={idx} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{ backgroundColor: `${stat.color}20`, color: stat.color, padding: '1rem', borderRadius: '12px' }}>
              {stat.icon}
            </div>
            <div>
              <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>{stat.label}</p>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
        
        {/* Recent Transactions */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--primary)' }}>
            Transaksi Terakhir
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
             {loading ? (
               <p className="text-muted text-center py-4">Memuat transaksi...</p>
             ) : recentTransactions.length === 0 ? (
               <p className="text-muted text-center py-4">Belum ada transaksi.</p>
             ) : recentTransactions.map(tx => (
               <div key={tx.id} style={{ padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white' }}>
                 <div>
                   <p style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.25rem' }}>Rp {Number(tx.total_amount).toLocaleString('id-ID')}</p>
                   <p className="text-muted" style={{ fontSize: '0.85rem' }}>
                     {new Date(tx.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB • {tx.details?.length || 0} item {isMultiBranch && `• ${tx.branch_name}`}
                   </p>
                 </div>
                 <span style={{ fontSize: '0.85rem', padding: '0.3rem 0.8rem', borderRadius: '20px', backgroundColor: tx.payment_method === 'Tunai' ? 'rgba(16,185,129,0.1)' : 'rgba(59,130,246,0.1)', color: tx.payment_method === 'Tunai' ? 'var(--primary)' : '#3b82f6', fontWeight: 600 }}>
                   {tx.payment_method}
                 </span>
               </div>
             ))}
          </div>
        </div>

        {/* Recent Activities (Stock/Sales Log) */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between' }}>
            Aktivitas Terbaru
            <Link to="/admin/stok" style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--primary)', cursor: 'pointer', textDecoration: 'none' }}>
              Lihat Detail
            </Link>
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
             {loading ? (
               <p className="text-center py-4 text-muted">Memuat aktivitas...</p>
             ) : recentActivities.length === 0 ? (
               <p className="text-center py-4 text-muted">Belum ada aktivitas.</p>
             ) : recentActivities.map(log => {
               const isAddition = log.qty_added > 0;
               const badgeColor = isAddition ? 'var(--success)' : 'var(--danger)';
               const badgeBg = isAddition ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)';
               const actionText = isAddition ? 'Restock Barang Masuk' : 'Pengurangan / Terjual';
               
               return (
                 <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem', borderRadius: '8px', borderBottom: '1px dashed var(--border-color)' }}>
                   <div>
                     <p style={{ fontWeight: 700, fontSize: '0.95rem' }}>{log.product_name}</p>
                     <p className="text-muted" style={{ fontSize: '0.8rem' }}>
                       {new Date(log.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB {isMultiBranch && `• ${log.branch_name}`}
                     </p>
                   </div>
                   <div style={{ textAlign: 'right' }}>
                     <span style={{ backgroundColor: badgeBg, color: badgeColor, padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 800 }}>
                       {isAddition ? '+' : ''}{log.qty_added} item
                     </span>
                     <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem', fontWeight: 600 }}>{actionText}</p>
                   </div>
                 </div>
               );
             })}
          </div>
        </div>
      </div>
    </div>
  );
}
