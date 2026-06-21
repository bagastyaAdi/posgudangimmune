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
  const [recentSales, setRecentSales] = useState([]);
  const [dailyStatus, setDailyStatus] = useState([]);
  const [todayRevenue, setTodayRevenue] = useState(0);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // 1. Get total active branches
      const { count: branchesCount } = await supabase.from('outlets').select('*', { count: 'exact', head: true });
      
      // 2. Get total branch staff
      const { count: staffCount } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'branch');
      
      // 3. Get total products (as a proxy for menu size or cups if we don't have detailed cup tracking yet)
      const { count: productCount } = await supabase.from('products').select('*', { count: 'exact', head: true });

      // Update basic stats first so they show up even if sales query fails
      setStatsData(prev => ({
        ...prev,
        branches: branchesCount || 0,
        staff: staffCount || 0,
        cups: productCount || 0
      }));

      // 4. Get today's sales reports (using 'date' column which is more reliable)
      const todayString = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];

      const { data: salesData, error: salesError } = await supabase.from('sales_reports')
        .select('*')
        .eq('date', todayString)
        .order('id', { ascending: false });

      if (salesError) {
          console.warn("Sales reports query failed:", salesError);
      }

      const { data: allBranches } = await supabase.from('outlets').select('name');

      if (salesData) {
        const total = salesData.reduce((sum, report) => sum + (report.cash_akhir || 0), 0);
        setTodayRevenue(total);
        
        // Update the stats overview with fetched counts and revenue
        setStatsData({
          revenue: total, // Using today's total as summary for now
          branches: branchesCount || 0,
          staff: staffCount || 0,
          cups: productCount || 0
        });

        const formattedSales = salesData.map(sale => ({
          id: sale.id,
          branch: sale.branch_name,
          shift: sale.shift,
          staff: sale.staff_name,
          totalRp: sale.cash_akhir || 0,
          status: sale.cash_akhir !== null ? 'CLOSED' : 'OPEN',
          time: sale.created_at ? new Date(sale.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Ongoing'
        }));
        setRecentSales(formattedSales);

        // Map branches to status
        if (allBranches) {
          const statusMap = allBranches.map(b => {
            const bSales = salesData.filter(s => s.branch_name === b.name);
            return {
              name: b.name,
              shift1: bSales.find(s => s.shift === '1'),
              shift2: bSales.find(s => s.shift === '2'),
              full: bSales.find(s => s.shift === '3')
            };
          });
          setDailyStatus(statusMap);
        }
      }
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
        
        {/* Daily Status Monitoring */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            📅 Monitoring Laporan Harian
            <span style={{ fontSize: '0.8rem', backgroundColor: 'var(--primary)', color: 'white', padding: '0.2rem 0.6rem', borderRadius: '12px' }}>Hari Ini</span>
          </h2>

          <div className="table-responsive">
            <table className="data-table" style={{ marginTop: 0 }}>
              <thead>
                <tr>
                  {isMultiBranch && <th>Cabang</th>}
                  <th className="text-center">Shift 1</th>
                  <th className="text-center">Shift 2</th>
                  <th className="text-right">Total Hari Ini</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="4" className="text-center py-4">Memuat status...</td></tr>
                ) : dailyStatus.map(b => {
                  const s1Status = b.full ? 'FULL' : b.shift1 ? (b.shift1.cash_akhir !== null ? 'CLOSED' : 'OPEN') : 'EMPTY';
                  const s2Status = b.full ? 'FULL' : b.shift2 ? (b.shift2.cash_akhir !== null ? 'CLOSED' : 'OPEN') : 'EMPTY';
                  const total = (b.shift1?.cash_akhir || 0) + (b.shift2?.cash_akhir || 0) + (b.full?.cash_akhir || 0);

                  const getBadge = (status) => {
                    if (status === 'CLOSED') return <span style={{ backgroundColor: 'rgba(16,185,129,0.1)', color: 'var(--primary)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>CLOSED</span>;
                    if (status === 'OPEN') return <span style={{ backgroundColor: 'rgba(251,191,36,0.15)', color: '#b45309', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>OPEN</span>;
                    if (status === 'FULL') return <span style={{ backgroundColor: 'rgba(99,102,241,0.1)', color: '#4f46e5', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>FULL SHIFT</span>;
                    return <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Belum Buka</span>;
                  };

                  return (
                    <tr key={b.name}>
                      {isMultiBranch && <td style={{ fontWeight: 600 }}>{b.name}</td>}
                      <td className="text-center">{getBadge(s1Status)}</td>
                      <td className="text-center">{getBadge(s2Status)}</td>
                      <td className="text-right" style={{ fontWeight: 700 }}>Rp {total.toLocaleString('id-ID')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Shift Reports */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between' }}>
            Aktivitas Terbaru
            <Link to="/admin/riwayat-penjualan" style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--primary)', cursor: 'pointer', textDecoration: 'none' }}>
              Lihat Riwayat
            </Link>
          </h2>
          
          <table className="data-table" style={{ marginTop: 0 }}>
            <thead>
              <tr>
                <th>Waktu</th>
                {isMultiBranch && <th>Cabang</th>}
                <th>Shift</th>
                <th className="text-right">Setor</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="4" className="text-center py-4">Memuat data...</td></tr>
              ) : recentSales.length === 0 ? (
                <tr><td colSpan="4" className="text-center py-4 text-muted">Belum ada aktivitas hari ini.</td></tr>
              ) : recentSales.map(sale => (
                <tr key={sale.id}>
                  <td className="text-muted" style={{ fontSize: '0.8rem' }}>{sale.time}</td>
                  {isMultiBranch && <td style={{ fontWeight: 500 }}>{sale.branch}</td>}
                  <td>
                    {sale.shift} {sale.status === 'OPEN' && <span style={{ marginLeft: '0.4rem', color: '#b45309', fontWeight: 800 }}>●</span>}
                  </td>
                  <td className="text-right" style={{ fontWeight: 600, color: sale.status === 'CLOSED' ? 'var(--success)' : 'var(--text-muted)' }}>
                    {sale.status === 'CLOSED' ? `Rp ${sale.totalRp.toLocaleString('id-ID')}` : 'OPEN'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
