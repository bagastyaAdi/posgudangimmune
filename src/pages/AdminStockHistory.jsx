import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Calendar, Filter, Store, Activity, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';

export default function AdminStockHistory() {
  const { isMultiBranch } = useSettings();
  const [stockLogs, setStockLogs] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('Semua Cabang');
  const [logStartDate, setLogStartDate] = useState('');
  const [logEndDate, setLogEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [logFilter, setLogFilter] = useState('all');

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    try {
      const { data } = await supabase.from('outlets').select('name').order('name');
      setBranches(data || []);
      fetchLogs('Semua Cabang');
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLogs = async (branchName) => {
    setLoading(true);
    let query = supabase
      .from('stock_restock_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300);
      
    if (branchName !== 'Semua Cabang') {
      query = query.eq('branch_name', branchName);
    }
    
    if (logStartDate) {
      query = query.gte('created_at', `${logStartDate}T00:00:00`);
    }
    if (logEndDate) {
      query = query.lte('created_at', `${logEndDate}T23:59:59`);
    }

    const { data } = await query;
    setStockLogs(data || []);
    setLoading(false);
  };

  const handleBranchChange = (e) => {
    const branch = e.target.value;
    setSelectedBranch(branch);
    fetchLogs(branch);
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    try {
      return format(parseISO(ts), 'dd MMMM yyyy, HH:mm', { locale: id });
    } catch (e) {
      const d = new Date(ts);
      return d.toLocaleString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
  };

  const filteredLogs = stockLogs.filter(log => {
    if (logFilter === 'status') return log.item_name === 'Status Aktivitas';
    if (logFilter === 'deduction') return log.qty_added < 0 && log.item_name !== 'Status Aktivitas';
    if (logFilter === 'addition') return log.qty_added > 0 && log.item_name !== 'Status Aktivitas';
    return true;
  });

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-primary mb-1">Riwayat Aktivitas Stok</h1>
          <p className="text-muted">Pantau semua histori penambahan, pengurangan, dan aktivitas operasional stok dari berbagai cabang secara realtime.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        {/* Row 1: Cabang & Tanggal */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', width: '100%' }}>
          {isMultiBranch && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: '1 1 300px' }}>
              <Store size={18} className="text-primary hidden-mobile" />
              <select className="input-field" style={{ width: '100%', marginBottom: 0 }} value={selectedBranch} onChange={handleBranchChange}>
                <option value="Semua Cabang">🌐 Semua Cabang</option>
                {branches.map(b => <option key={b.name} value={b.name}>📍 {b.name}</option>)}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 300px' }}>
            <Calendar size={18} className="text-muted hidden-mobile" />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
              <input 
                type="date" 
                className="input-field" 
                style={{ width: '100%', padding: '0.4rem 0.6rem', marginBottom: 0 }} 
                value={logStartDate} 
                onChange={(e) => setLogStartDate(e.target.value)} 
              />
              <span className="text-muted" style={{ fontSize: '0.9rem' }}>s/d</span>
              <input 
                type="date" 
                className="input-field" 
                style={{ width: '100%', padding: '0.4rem 0.6rem', marginBottom: 0 }} 
                value={logEndDate} 
                onChange={(e) => setLogEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Row 2: Status Filters & Action Buttons */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', flex: '1 1 auto' }}>
            {[
              { id: 'all', label: 'Semua', icon: null },
              { id: 'addition', label: 'Masuk', icon: <ArrowDownRight size={14} /> },
              { id: 'deduction', label: 'Keluar', icon: <ArrowUpRight size={14} /> },
              { id: 'status', label: 'Aktivitas Shift', icon: <Activity size={14} /> }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setLogFilter(f.id)}
                style={{
                  padding: '0.4rem 0.8rem',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  flex: '1 1 auto',
                  justifyContent: 'center',
                  border: logFilter === f.id ? 'none' : '1px solid var(--border-color)',
                  backgroundColor: logFilter === f.id ? 'var(--primary)' : 'transparent',
                  color: logFilter === f.id ? 'white' : 'var(--text-muted)'
                }}
              >
                {f.icon} {f.label}
              </button>
            ))}
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', flex: '0 0 auto', marginLeft: 'auto' }}>
            {(logStartDate || logEndDate) && (
              <button 
                onClick={() => { setLogStartDate(''); setLogEndDate(''); fetchLogs(selectedBranch); }}
                style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }}
              >
                Reset
              </button>
            )}
            <button 
              onClick={() => fetchLogs(selectedBranch)} 
              className="btn-secondary" 
              style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
            >
              <Filter size={16} /> Terapkan
            </button>
          </div>
        </div>
      </div>

      {/* Desktop View */}
      <div className="glass-panel table-responsive desktop-only" style={{ overflowX: 'auto', overflowY: 'hidden' }}>
        <table className="data-table" style={{ marginTop: 0, minWidth: '800px' }}>
          <thead style={{ backgroundColor: 'rgba(0,0,0,0.02)' }}>
            <tr>
              <th style={{ width: '170px' }}>Waktu</th>
              {isMultiBranch && <th style={{ width: '150px' }}>Cabang</th>}
              <th>Nama Item</th>
              <th>Petugas / Keterangan</th>
              <th className="text-center">Stok Awal</th>
              <th className="text-center">Perubahan</th>
              <th className="text-center">Sisa Stok</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center text-muted py-8">Memuat riwayat aktivitas...</td></tr>
            ) : filteredLogs.length === 0 ? (
              <tr><td colSpan={7} className="text-center text-muted py-8">Belum ada riwayat aktivitas yang sesuai filter.</td></tr>
            ) : filteredLogs.map(log => {
                const isAddition = log.qty_added > 0;
                const isOpening = log.petugas_name?.toLowerCase().includes('buka');
                const isClosing = log.petugas_name?.toLowerCase().includes('tutup');
                const isManualAdd = isAddition && !isOpening && !isClosing && !log.item_name?.includes('Aktivitas');

                let rowStyle = {};
                if (isManualAdd) rowStyle = { backgroundColor: 'rgba(16, 185, 129, 0.05)', borderLeft: '3px solid var(--primary)' };
                else if (isOpening) rowStyle = { backgroundColor: 'rgba(251, 191, 36, 0.08)' };
                else if (isClosing) rowStyle = { backgroundColor: 'rgba(239, 68, 68, 0.05)' };

                return (
                  <tr key={log.id} style={rowStyle}>
                    <td className="text-muted" style={{ fontSize: '0.85rem' }}>{formatTime(log.created_at)}</td>
                    {isMultiBranch && <td style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-muted)' }}>{log.branch_name}</td>}
                    <td style={{ fontWeight: 600 }}>{log.item_name}</td>
                    <td style={{ fontSize: '0.85rem' }}>
                      {isManualAdd ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <span style={{
                            backgroundColor: 'rgba(16,185,129,0.15)', color: 'var(--primary)',
                            padding: '0.1rem 0.45rem', borderRadius: '5px', fontSize: '0.7rem', fontWeight: 800
                          }}>📦 MASUK</span>
                          <span style={{ fontWeight: 600 }}>{log.petugas_name}</span>
                        </div>
                      ) : isOpening ? (
                        <span style={{ color: '#b45309', fontWeight: 700 }}>🔓 {log.petugas_name}</span>
                      ) : isClosing ? (
                        <span style={{ color: 'var(--danger)', fontWeight: 700 }}>🔒 {log.petugas_name}</span>
                      ) : (
                        <span className="text-muted">{log.petugas_name}</span>
                      )}
                    </td>
                    <td className="text-center text-muted">{log.qty_before}</td>
                    <td className="text-center">
                      <span style={{
                        display: 'inline-block', minWidth: '60px', padding: '0.2rem 0', borderRadius: '4px',
                        backgroundColor: isAddition ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)',
                        color: isAddition ? 'var(--primary)' : 'var(--danger)',
                        fontWeight: 700, fontSize: '0.9rem'
                      }}>
                        {isAddition ? '+' : ''}{log.qty_added}
                      </span>
                    </td>
                    <td className="text-center" style={{ fontWeight: 700, fontSize: '1rem' }}>{log.qty_after}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingBottom: '1rem' }}>
        {loading ? (
          <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
            <p className="text-muted">Memuat riwayat aktivitas...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
            <p className="text-muted">Belum ada riwayat aktivitas yang sesuai filter.</p>
          </div>
        ) : filteredLogs.map(log => {
          const isAddition = log.qty_added > 0;
          const isOpening = log.petugas_name?.toLowerCase().includes('buka');
          const isClosing = log.petugas_name?.toLowerCase().includes('tutup');
          const isManualAdd = isAddition && !isOpening && !isClosing && !log.item_name?.includes('Aktivitas');

          return (
            <div key={log.id} className="glass-panel" style={{ 
              padding: '1rem', 
              borderLeft: isManualAdd ? '4px solid var(--primary)' : isOpening ? '4px solid #f59e0b' : isClosing ? '4px solid var(--danger)' : '1px solid var(--border-color)',
              backgroundColor: isManualAdd ? 'rgba(16, 185, 129, 0.03)' : isOpening ? 'rgba(251, 191, 36, 0.03)' : isClosing ? 'rgba(239, 68, 68, 0.03)' : 'var(--panel-bg)',
              borderRadius: '12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div>
                  <p style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)', marginBottom: '0.15rem' }}>{log.item_name}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatTime(log.created_at)}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ 
                    display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: '6px',
                    backgroundColor: isAddition ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                    color: isAddition ? 'var(--primary)' : 'var(--danger)',
                    fontWeight: 800, fontSize: '0.95rem'
                  }}>
                    {isAddition ? '+' : ''}{log.qty_added}
                  </span>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                {isMultiBranch && (
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', backgroundColor: '#f1f5f9', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                    {log.branch_name}
                  </span>
                )}
                {isManualAdd ? (
                  <span style={{ backgroundColor: 'rgba(16,185,129,0.15)', color: 'var(--primary)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800 }}>📦 MASUK</span>
                ) : isOpening ? (
                  <span style={{ color: '#b45309', fontWeight: 700, fontSize: '0.75rem' }}>🔓</span>
                ) : isClosing && (
                  <span style={{ color: 'var(--danger)', fontWeight: 700, fontSize: '0.75rem' }}>🔒</span>
                )}
                <span style={{ fontSize: '0.8rem', color: 'var(--text-main)', fontWeight: 600 }}>{log.petugas_name}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '0.1rem' }}>Stok Awal</p>
                  <p style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-muted)' }}>{log.qty_before}</p>
                </div>
                <div style={{ color: 'var(--border-color)', fontWeight: 'bold' }}>→</div>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '0.1rem' }}>Sisa Stok</p>
                  <p style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--primary)' }}>{log.qty_after}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
