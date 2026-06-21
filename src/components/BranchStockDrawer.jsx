import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { X, PackagePlus, RefreshCw, AlertTriangle, CheckCircle, ClipboardList } from 'lucide-react';

export default function BranchStockDrawer({ isOpen, onClose, branchName, petugasName }) {
  const { userData } = useAuth();
  const [inventory, setInventory] = useState([]);
  const [restockLog, setRestockLog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [restockModal, setRestockModal] = useState(null); // { item_name, current_qty }
  const [restockQty, setRestockQty] = useState('');
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('stock'); // 'stock' | 'log'
  const [logFilter, setLogFilter] = useState('all'); // 'all', 'status', 'deduction', 'addition', 'gudang'

  useEffect(() => {
    if (isOpen && branchName) {
      // Reset stale data first
      setInventory([]);
      setRestockLog([]);
      fetchInventory(branchName);
      fetchRestockLog(branchName);
    }
  }, [isOpen, branchName]);

  const fetchInventory = async (branch) => {
    setLoading(true);
    const { data } = await supabase
      .from('branch_inventory')
      .select('*')
      .eq('branch_name', branch)
      .order('item_name');
    setInventory(data || []);
    setLoading(false);
  };

  const fetchRestockLog = async (branch) => {
    // Only fetch logs for today (current shift)
    const todayStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
    const { data } = await supabase
      .from('stock_restock_log')
      .select('*')
      .eq('branch_name', branch)
      .gte('created_at', `${todayStr}T00:00:00`)
      .order('created_at', { ascending: false })
      .limit(100);
    setRestockLog(data || []);
  };

  const handleRestock = async (e) => {
    e.preventDefault();
    const qty = parseInt(restockQty);
    if (!qty || qty <= 0) return alert('Masukkan jumlah yang valid');
    setSaving(true);
    try {
      const item = inventory.find(i => i.item_name === restockModal.item_name);
      const currentQty = item?.current_qty ?? 0;
      const newQty = currentQty + qty;

      // Upsert branch_inventory
      const { error: invErr } = await supabase.from('branch_inventory').upsert({
        branch_name: branchName,
        item_name: restockModal.item_name,
        current_qty: newQty
      }, { onConflict: 'branch_name,item_name' });
      if (invErr) throw invErr;

      // Log the restock — use logged-in user's name
      const actorName = userData?.name
        ? `${userData.name} (${userData.role || 'kasir'})`
        : (petugasName || 'Kasir');

      const { error: logErr } = await supabase.from('stock_restock_log').insert([{
        branch_name: branchName,
        item_name: restockModal.item_name,
        qty_added: qty,
        qty_before: currentQty,
        qty_after: newQty,
        petugas_name: actorName
      }]);
      if (logErr) throw logErr;

      setRestockModal(null);
      setRestockQty('');
      await fetchInventory(branchName);
      await fetchRestockLog(branchName);
    } catch (err) {
      alert(`Gagal restock: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const getStockColor = (qty) => {
    if (qty === null || qty === undefined) return '#94a3b8';
    if (qty === 0) return '#ef4444';
    if (qty <= 10) return '#f59e0b';
    return 'var(--primary)';
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const isManualAddition = (log) => {
    if (log.qty_added <= 0 || log.item_name === 'Status Aktivitas') return false;
    const name = (log.petugas_name || '').toLowerCase();
    // Exclude automatic system operations
    return !name.includes('buka') && !name.includes('tutup') && !name.includes('shift');
  };

  // Recent additions (last 24h) — for notification banner
  const recentAdditions = restockLog.filter(log => {
    if (!isManualAddition(log)) return false;
    return new Date(log.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000);
  });

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 200
      }} />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: '400px',
        backgroundColor: 'var(--panel-bg)', zIndex: 201, display: 'flex', flexDirection: 'column',
        boxShadow: '-4px 0 30px rgba(0,0,0,0.15)', overflowY: 'auto'
      }}>
        {/* Header */}
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--panel-bg)', position: 'sticky', top: 0, zIndex: 10 }}>
          <div>
            <p style={{ fontWeight: 700, fontSize: '1rem' }}>📦 Stok Inventaris</p>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{branchName}</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button onClick={() => { fetchInventory(branchName); fetchRestockLog(branchName); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: '0.3rem' }} title="Refresh">
              <RefreshCw size={18} />
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.3rem' }}>
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '2px solid var(--border-color)' }}>
          {[['stock', '📋 Stok Sekarang'], ['log', '📜 Riwayat Stok']]
            .map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              flex: 1, padding: '0.6rem', border: 'none', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
              backgroundColor: tab === key ? 'rgba(9, 108, 70, 0.08)' : 'transparent',
              color: tab === key ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: tab === key ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: '-2px',
              position: 'relative'
            }}>
              {label}
              {key === 'log' && recentAdditions.length > 0 && (
                <span style={{
                  position: 'absolute', top: '4px', right: '8px',
                  backgroundColor: 'var(--primary)', color: 'white',
                  borderRadius: '50%', width: '16px', height: '16px',
                  fontSize: '0.6rem', fontWeight: 900,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>{recentAdditions.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: '0.75rem' }}>
          {loading ? (
            <p className="text-muted" style={{ textAlign: 'center', padding: '2rem', fontSize: '0.9rem' }}>Memuat...</p>
          ) : tab === 'stock' ? (
            <>
              {/* Notification Banner: Recent manual additions */}
              {recentAdditions.length > 0 && (
                <div style={{
                  backgroundColor: 'rgba(16,185,129,0.1)',
                  border: '1.5px solid rgba(16,185,129,0.45)',
                  borderRadius: '10px',
                  padding: '0.7rem 0.9rem',
                  marginBottom: '0.85rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem'
                }}>
                  <span style={{ fontSize: '1.15rem', lineHeight: 1 }}>📦</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--primary)', marginBottom: '0.15rem' }}>
                      Penambahan Stok Terbaru
                    </p>
                    <p style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginBottom: '0.25rem', lineHeight: '1.4' }}>
                      <strong>{[...new Set(recentAdditions.map(l => l.item_name))].join(', ')}</strong><br/>
                      <span style={{ fontSize: '0.7rem' }}>Oleh: <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{[...new Set(recentAdditions.map(l => l.petugas_name))].join(', ')}</span></span>
                    </p>
                    <button
                      onClick={() => { setTab('log'); setLogFilter('addition'); }}
                      style={{ background: 'none', border: 'none', padding: 0, fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Lihat Riwayat Masuk →
                    </button>
                  </div>
                </div>
              )}

              {inventory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Belum ada data stok</p>
                  <p className="text-muted" style={{ fontSize: '0.85rem' }}>Hubungi admin untuk set stok awal.</p>
                </div>
              ) : (
                inventory.map(item => {
                  const qty = item.current_qty;
                  const color = getStockColor(qty);
                  const isEmpty = qty === 0;
                  // Check if this item was recently added
                  const recentAdd = recentAdditions.find(l => l.item_name === item.item_name);
                  return (
                    <div key={item.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '0.6rem 0.75rem', marginBottom: '0.4rem',
                      border: `1px solid ${recentAdd ? 'rgba(16,185,129,0.4)' : isEmpty ? 'rgba(239,68,68,0.3)' : 'var(--border-color)'}`,
                      borderRadius: '8px',
                      backgroundColor: recentAdd ? 'rgba(16,185,129,0.04)' : isEmpty ? 'rgba(239,68,68,0.04)' : 'transparent'
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.15rem' }}>
                          <p style={{ fontWeight: 600, fontSize: '0.88rem' }}>{item.item_name}</p>
                          {recentAdd && (
                            <span style={{ backgroundColor: 'rgba(16,185,129,0.15)', color: 'var(--primary)', padding: '0.05rem 0.35rem', borderRadius: '4px', fontSize: '0.62rem', fontWeight: 800 }}>
                              +{recentAdd.qty_added} baru
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          {isEmpty ? (
                            <span style={{ fontSize: '0.72rem', color: '#ef4444', fontWeight: 700 }}>⛔ STOK HABIS</span>
                          ) : qty <= 10 ? (
                            <span style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 700 }}>⚠ Stok Menipis</span>
                          ) : (
                            <span style={{ fontSize: '0.72rem', color: 'var(--primary)' }}>✓ Tersedia</span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{
                          fontWeight: 800, fontSize: '1.1rem', color,
                          minWidth: '40px', textAlign: 'right'
                        }}>{qty ?? '?'}</span>
                        <button
                          onClick={() => { setRestockModal(item); setRestockQty(''); }}
                          style={{ padding: '0.3rem 0.6rem', border: '1.5px solid var(--primary)', borderRadius: '6px', backgroundColor: 'rgba(9, 108, 70, 0.08)', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}
                        >+ Tambah</button>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          ) : (
            // Riwayat Stok tab
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Filter Tabs Mini */}
              <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.75rem', overflowX: 'auto', paddingBottom: '0.4rem' }}>
                {[
                  { id: 'all', label: 'Semua', color: 'var(--text-muted)' },
                  { id: 'addition', label: '📦 Masuk', color: '#10b981' },
                  { id: 'status', label: 'Aktivitas', color: '#3b82f6' },
                  { id: 'deduction', label: 'Keluar', color: 'var(--danger)' }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setLogFilter(f.id)}
                    style={{
                      padding: '0.3rem 0.6rem',
                      borderRadius: '12px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: '1px solid',
                      backgroundColor: logFilter === f.id ? f.color : 'transparent',
                      borderColor: logFilter === f.id ? f.color : 'var(--border-color)',
                      color: logFilter === f.id ? 'white' : 'var(--text-muted)',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {f.label}
                    {f.id === 'addition' && recentAdditions.length > 0 && (
                      <span style={{ marginLeft: '4px', backgroundColor: 'white', color: 'var(--primary)', borderRadius: '50%', padding: '0 4px', fontSize: '0.65rem', fontWeight: 900 }}>
                        {recentAdditions.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div style={{ flex: 1 }}>
                {(() => {
                  const filtered = restockLog.filter(log => {
                    if (logFilter === 'status') return log.item_name === 'Status Aktivitas';
                    if (logFilter === 'deduction') return log.qty_added < 0 && log.item_name !== 'Status Aktivitas';
                    if (logFilter === 'addition') return log.qty_added > 0 && log.item_name !== 'Status Aktivitas';
                    return true;
                  });

                  if (filtered.length === 0) {
                    return <p className="text-muted" style={{ textAlign: 'center', padding: '2rem', fontSize: '0.85rem' }}>Tidak ada riwayat untuk kategori ini.</p>;
                  }

                  return filtered.map(log => {
                    const isAddition = log.qty_added > 0;
                    const isStatus = log.item_name === 'Status Aktivitas';
                    const isManualAdd = isManualAddition(log);
                    const isOpening = (log.petugas_name || '').toLowerCase().includes('buka');
                    const isClosing = (log.petugas_name || '').toLowerCase().includes('tutup');

                    return (
                      <div key={log.id} style={{
                        borderBottom: '1px solid var(--border-color)',
                        padding: '0.75rem 0.25rem',
                        backgroundColor: isManualAdd
                          ? 'rgba(16,185,129,0.05)'
                          : isStatus ? 'rgba(59, 130, 246, 0.02)' : 'transparent',
                        borderLeft: isManualAdd ? '3px solid var(--primary)' : '3px solid transparent'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            <p style={{ fontWeight: 700, fontSize: '0.85rem', color: isStatus ? '#3b82f6' : 'inherit' }}>
                              {isStatus ? '🔔 ' + log.item_name : log.item_name}
                            </p>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                              {formatTime(log.created_at)}
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                              {isManualAdd && (
                                <span style={{
                                  backgroundColor: 'rgba(16,185,129,0.15)', color: 'var(--primary)',
                                  padding: '0.05rem 0.4rem', borderRadius: '4px',
                                  fontSize: '0.65rem', fontWeight: 800
                                }}>📦 MASUK</span>
                              )}
                              {isOpening && <span style={{ color: '#b45309', fontWeight: 700, fontSize: '0.7rem' }}>🔓</span>}
                              {isClosing && <span style={{ color: 'var(--danger)', fontWeight: 700, fontSize: '0.7rem' }}>🔒</span>}
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                {log.petugas_name}
                              </span>
                            </div>
                            {!isStatus && (
                              <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                Stok: {log.qty_before} → <strong style={{ color: isAddition ? 'var(--primary)' : 'var(--danger)' }}>{log.qty_after}</strong>
                              </p>
                            )}
                          </div>
                          {!isStatus && (
                            <span style={{
                              fontWeight: 800,
                              backgroundColor: isAddition ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                              color: isAddition ? 'var(--primary)' : 'var(--danger)',
                              padding: '0.1rem 0.4rem',
                              borderRadius: '4px',
                              fontSize: '0.85rem'
                            }}>
                              {isAddition ? '+' : ''}{log.qty_added}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </div>

        {/* Restock Modal */}
        {restockModal && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div style={{ backgroundColor: 'var(--panel-bg)', borderRadius: '12px', padding: '1.5rem', width: '100%', maxWidth: '340px' }}>
              <h3 style={{ marginBottom: '0.25rem' }}>Tambah Stok</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                <strong>{restockModal.item_name}</strong><br />
                Stok saat ini: <strong>{restockModal.current_qty ?? 0}</strong> unit
              </p>
              <form onSubmit={handleRestock}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.4rem', color: 'var(--text-muted)' }}>
                  Jumlah yang ditambahkan
                </label>
                <input
                  type="number" min="1" required autoFocus
                  style={{ width: '100%', padding: '0.75rem', border: '2px solid var(--border-color)', borderRadius: '8px', fontSize: '1.2rem', textAlign: 'center', fontWeight: 700, marginBottom: '1rem' }}
                  placeholder="0"
                  value={restockQty}
                  onChange={e => setRestockQty(e.target.value)}
                />
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem', textAlign: 'center' }}>
                  Setelah tambah: <strong style={{ color: 'var(--primary)' }}>{(restockModal.current_qty ?? 0) + (parseInt(restockQty) || 0)} unit</strong>
                </p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" onClick={() => setRestockModal(null)} style={{ flex: 1, padding: '0.7rem', border: '1px solid var(--border-color)', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', backgroundColor: 'transparent' }}>Batal</button>
                  <button type="submit" disabled={saving} style={{ flex: 2, padding: '0.7rem', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', backgroundColor: 'var(--primary)', color: 'white' }}>
                    {saving ? 'Menyimpan...' : '✓ Simpan Tambahan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
