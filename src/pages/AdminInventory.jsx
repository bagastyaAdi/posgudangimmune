import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { Package, Plus, Save, Store, RefreshCw, AlertTriangle, Calendar, Filter } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';

// No more hardcoded items — all fetched from Supabase dynamically

export default function AdminInventory() {
  const { userData } = useAuth();
  const { isMultiBranch } = useSettings();
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isRestockOpen, setRestockOpen] = useState(false);
  const [allItems, setAllItems] = useState([]); // dynamic: products + physical
  const [restock, setRestock] = useState({ item_name: '', qty: '' });

  useEffect(() => {
    fetchBranches();
  }, [isMultiBranch]);

  const fetchBranches = async () => {
    // Fetch branches and products (with variant)
    const [branchRes, productRes] = await Promise.all([
      supabase.from('outlets').select('name'),
      supabase.from('products').select('name, variant')
    ]);

    // Build item list: use "name variant" as unique key (e.g. "Es Teh Ori", "Es Teh Premi")
    const productNames = [...new Set(
      (productRes.data || []).map(p =>
        p.variant && p.variant !== 'Standar' ? `${p.name} ${p.variant}` : p.name
      )
    )];
    setAllItems(productNames);
    
    if (restock.item_name === '' && productNames.length > 0) {
      setRestock(r => ({ ...r, item_name: productNames[0] }));
    }

    setBranches(branchRes.data || []);
    
    let branchToSelect = 'Pusat';
    if (isMultiBranch && branchRes.data && branchRes.data.length > 0) {
      branchToSelect = branchRes.data[0].name;
    }
    
    setSelectedBranch(branchToSelect);
    await fetchInventory(branchToSelect, productNames);
    
    setLoading(false);
  };

  const fetchInventory = async (branchName, itemList) => {
    setLoading(true);
    const items = itemList || allItems;
    
    // Inventory Data
    const { data } = await supabase
      .from('branch_inventory')
      .select('*')
      .eq('branch_name', branchName);
    
    const map = {};
    (data || []).forEach(row => { map[row.item_name] = row; });

    const merged = items.map(name => ({
      item_name: name,
      current_qty: map[name]?.current_qty ?? null,
      original_qty: map[name]?.current_qty ?? 0,
      id: map[name]?.id ?? null,
    }));
    setInventory(merged);
    setLoading(false);
  };

  const handleBranchChange = (e) => {
    setSelectedBranch(e.target.value);
    fetchInventory(e.target.value, allItems);
  };

  const handleQtyChange = (itemName, value) => {
    setInventory(prev => prev.map(i => i.item_name === itemName ? { ...i, current_qty: value } : i));
  };

  const handleSaveAll = async () => {
    try {
      setSaving(true);
      const rawUpsert = inventory
        .filter(i => i.current_qty !== null && i.current_qty !== '')
        .map(i => ({
          branch_name: selectedBranch,
          item_name: i.item_name,
          current_qty: parseFloat(i.current_qty) || 0,
          updated_at: new Date().toISOString()
        }));

      // Deduplicate by item_name to prevent ON CONFLICT error with duplicate rows
      const seen = new Set();
      const toUpsert = rawUpsert.filter(row => {
        if (seen.has(row.item_name)) return false;
        seen.add(row.item_name);
        return true;
      });

      const { error } = await supabase.from('branch_inventory').upsert(toUpsert, {
        onConflict: 'branch_name,item_name'
      });

      if (error) throw error;

      // Log every change manually (to maintain audit trail)
      const actorName = userData?.name
        ? `${userData.name} (${userData.role || 'admin'})`
        : 'Admin (Update Massal)';
      const logPromises = inventory
        .filter(i => i.current_qty !== null && i.current_qty !== '' && parseFloat(i.current_qty) !== i.original_qty)
        .map(i => {
           const beforeQty = i.original_qty || 0;
           const afterQty = parseFloat(i.current_qty) || 0;
           const qtyAdded = afterQty - beforeQty;
           return supabase.from('stock_restock_log').insert([{
             branch_name: selectedBranch,
             item_name: i.item_name,
             qty_added: qtyAdded,
             qty_before: beforeQty,
             qty_after: afterQty,
             petugas_name: actorName
           }]);
        });
      
      await Promise.all(logPromises);

      alert('Stok awal berhasil disimpan!');
      await fetchInventory(selectedBranch);
    } catch (err) {
      alert(`Gagal menyimpan: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRestock = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const qty = parseFloat(restock.qty) || 0;
      if (qty <= 0) { alert('Masukkan jumlah restock yang valid!'); return; }

      // Get current stock first
      const { data: current } = await supabase.from('branch_inventory')
        .select('*')
        .eq('branch_name', selectedBranch)
        .eq('item_name', restock.item_name)
        .single();

      const newQty = (current?.current_qty || 0) + qty;

      const { error } = await supabase.from('branch_inventory').upsert({
        branch_name: selectedBranch,
        item_name: restock.item_name,
        current_qty: newQty,
        updated_at: new Date().toISOString()
      }, { onConflict: 'branch_name,item_name' });

      if (error) throw error;

      // Log the restock action
      const actorName = userData?.name
        ? `${userData.name} (${userData.role || 'gudang'})`
        : 'Admin';
      const { error: logError } = await supabase.from('stock_restock_log').insert([{
        branch_name: selectedBranch,
        item_name: restock.item_name,
        qty_added: qty,
        qty_before: current?.current_qty || 0,
        qty_after: newQty,
        petugas_name: actorName
      }]);

      if (logError) console.error("Error logging restock:", logError);

      alert(`Stok ${restock.item_name} berhasil ditambah ${qty} unit. Total sekarang: ${newQty}`);
      setRestockMenuOpen(false); // just to match original logic conceptually but using setRestockOpen
      setRestockOpen(false);
      setRestock({ item_name: allItems[0] || '', qty: '' });
      await fetchInventory(selectedBranch, allItems);
    } catch (err) {
      alert(`Gagal restock: ${err.message}`);
    } finally {
      setSaving(false);
    }
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

  const lowStockItems = inventory.filter(i => i.current_qty !== null && i.current_qty <= 10);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-primary mb-1">Manajemen Stok Inventaris</h1>
          <p className="text-muted">Atur stok awal & distribusi per cabang. Stok berkurang otomatis saat laporan shift masuk.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setRestockOpen(true)} className="btn-secondary">
            <Plus size={18} /> Tambah Stok (Restock)
          </button>
          <button onClick={handleSaveAll} disabled={saving} className="btn-primary">
            <Save size={18} /> {saving ? 'Menyimpan...' : 'Simpan Semua'}
          </button>
        </div>
      </div>

      {/* Restock Form */}
      {isRestockOpen && (
        <div className="glass-panel mb-6 animate-fade-in" style={{ border: '2px solid var(--primary)', padding: '1.5rem' }}>
          <h2 className="mb-4 text-primary">Tambah Stok (Distribusi Masuk)</h2>
          <p className="text-muted mb-4" style={{ fontSize: '0.9rem' }}>
            {isMultiBranch ? <>Cabang: <strong>{selectedBranch}</strong> — </> : null}Stok akan ditambahkan ke stok saat ini.
          </p>
          <form onSubmit={handleRestock} className="flex-col gap-4">
            <div>
              <label className="text-muted" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Nama Item</label>
              <select className="input-field" value={restock.item_name} onChange={e => setRestock({...restock, item_name: e.target.value})}>
                {allItems.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-muted" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Jumlah Masuk (Unit)</label>
              <input type="number" min="1" required className="input-field" placeholder="Contoh: 24" value={restock.qty} onChange={e => setRestock({...restock, qty: e.target.value})} />
            </div>
            <div className="flex justify-between mt-6">
              <button type="button" onClick={() => setRestockOpen(false)} className="btn-secondary">Batal</button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? 'Menyimpan...' : '+ Tambahkan ke Stok'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <div style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <AlertTriangle size={20} color="var(--danger)" style={{ marginTop: '2px', flexShrink: 0 }} />
          <div>
            <p style={{ fontWeight: 700, color: 'var(--danger)', marginBottom: '0.25rem' }}>⚠ Stok Menipis di {selectedBranch}</p>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              {lowStockItems.map(i => `${i.item_name} (sisa ${i.current_qty})`).join(' • ')}
            </p>
          </div>
        </div>
      )}

      {/* Branch Selector & Tabs */}
      <div className="glass-panel" style={{ padding: '0.5rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0' }}>
        
        {/* Top bar: Branch & Refresh */}
        <div style={{ padding: '0.75rem 1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {isMultiBranch && (
            <>
              <Store size={20} className="text-muted" />
              <select className="input-field" style={{ maxWidth: '260px', marginBottom: 0 }} value={selectedBranch} onChange={handleBranchChange}>
                {branches.map(b => <option key={b.name} value={b.name}>📍 {b.name}</option>)}
              </select>
            </>
          )}
          <button onClick={() => fetchInventory(selectedBranch)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}>
            <RefreshCw size={18} />
          </button>
          <span className="text-muted" style={{ fontSize: '0.82rem', marginLeft: 'auto' }}>
            Edit stok → Simpan Semua
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="glass-panel table-responsive" style={{ overflowX: 'auto', overflowY: 'hidden' }}>
        <table className="data-table" style={{ marginTop: 0, minWidth: '800px' }}>
          <thead style={{ backgroundColor: 'rgba(0,0,0,0.03)' }}>
            <tr>
              <th>No</th>
              <th>Nama Item</th>
              <th style={{ textAlign: 'center' }}>Stok Saat Ini</th>
              <th style={{ textAlign: 'center' }}>Status</th>
              <th style={{ width: '180px' }}>Update Stok Manual</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center text-muted py-8">Memuat data inventaris...</td></tr>
            ) : inventory.map((item, idx) => {
              const qty = item.current_qty;
              const isLow = qty !== null && qty <= 10;
              const isNotSet = qty === null;
              return (
                <tr key={item.item_name}>
                  <td className="text-muted" style={{ width: '40px' }}>{idx + 1}</td>
                  <td style={{ fontWeight: 600 }}>{item.item_name}</td>
                  <td style={{ textAlign: 'center', fontSize: '1.1rem', fontWeight: 700, fontFamily: 'monospace', color: isLow ? 'var(--danger)' : isNotSet ? 'var(--text-muted)' : 'inherit' }}>
                    {isNotSet ? '—' : qty}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {isNotSet ? (
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Belum diset</span>
                    ) : isLow ? (
                      <span style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--danger)', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700 }}>⚠ Menipis</span>
                    ) : (
                      <span style={{ backgroundColor: 'rgba(16,185,129,0.1)', color: 'var(--primary)', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700 }}>✓ Aman</span>
                    )}
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      className="input-field"
                      style={{ padding: '0.4rem 0.6rem', fontSize: '0.9rem' }}
                      placeholder="Set qty"
                      value={qty ?? ''}
                      onChange={e => handleQtyChange(item.item_name, e.target.value)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
