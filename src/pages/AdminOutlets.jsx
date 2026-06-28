import React, { useState, useEffect } from 'react';
import { Store, Plus, Edit2, Trash2, X } from 'lucide-react';
import { supabase } from '../supabase';
import { useSettings } from '../contexts/SettingsContext';
import { Navigate } from 'react-router-dom';

export default function AdminOutlets() {
  const { isMultiBranch } = useSettings();
  const [branches, setBranches] = useState([]);
  const [loadingBranches, setLoadingBranches] = useState(true);
  
  const [newBranchName, setNewBranchName] = useState('');
  const [editingBranch, setEditingBranch] = useState(null);
  const [editBranchName, setEditBranchName] = useState('');

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    try {
      setLoadingBranches(true);
      const { data, error } = await supabase.from('outlets').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      
      let fetchedBranches = data || [];

      // Hanya buat cabang awal jika database cabang benar-benar kosong (awal mula)
      if (fetchedBranches.length === 0) {
        try {
          const { data: newPusat, error: insErr } = await supabase.from('outlets').insert([{ name: 'Pusat' }]).select();
          if (!insErr && newPusat && newPusat.length > 0) {
            fetchedBranches = [newPusat[0]];
          }
        } catch(e) {
          console.error('Gagal auto-create cabang awal:', e);
        }
      }

      setBranches(fetchedBranches);
    } catch (err) {
      console.error('Error fetching branches:', err);
    } finally {
      setLoadingBranches(false);
    }
  };

  const handleAddBranch = async (e) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;
    try {
      const { error } = await supabase.from('outlets').insert([{ name: newBranchName.trim() }]);
      if (error) throw error;
      setNewBranchName('');
      fetchBranches();
    } catch (err) {
      alert('Gagal menambah cabang: ' + err.message);
    }
  };

  const handleUpdateBranch = async (e) => {
    e.preventDefault();
    const newName = editBranchName.trim();
    if (!newName || !editingBranch) return;
    try {
      const oldName = editingBranch.name;
      
      // Update di tabel outlets utama
      const { error } = await supabase.from('outlets').update({ name: newName }).eq('id', editingBranch.id);
      if (error) throw error;
      
      // Update nama cabang di riwayat transaksi, inventaris, dan log jika namanya benar-benar berubah
      if (oldName !== newName) {
        await Promise.all([
          supabase.from('transactions').update({ branch_name: newName }).eq('branch_name', oldName),
          supabase.from('branch_inventory').update({ branch_name: newName }).eq('branch_name', oldName),
          supabase.from('stock_restock_log').update({ branch_name: newName }).eq('branch_name', oldName)
        ]).catch(err => console.error("Gagal sinkronisasi nama cabang lama:", err));
      }

      setEditingBranch(null);
      setEditBranchName('');
      fetchBranches();
    } catch (err) {
      alert('Gagal mengubah nama cabang: ' + err.message);
    }
  };

  const handleDeleteBranch = async (id, name) => {
    if (!window.confirm(`Yakin ingin menghapus cabang "${name}"? Perhatian: Data transaksi cabang ini mungkin akan ikut terhapus atau error jika belum di-backup!`)) return;
    try {
      const { error } = await supabase.from('outlets').delete().eq('id', id);
      if (error) throw error;
      fetchBranches();
    } catch (err) {
      alert('Gagal menghapus cabang (kemungkinan ada data transaksi yang masih terkait): ' + err.message);
    }
  };

  // Jika multi-cabang mati, tendang user kembali ke dashboard
  if (!isMultiBranch) {
    return <Navigate to="/admin" />;
  }

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem' }}>
      <div className="mb-6">
        <h1 className="text-primary mb-1">Kelola Cabang</h1>
        <p className="text-muted">Manajemen nama dan daftar cabang toko Anda.</p>
      </div>

      <div className="glass-panel" style={{ padding: '2rem', maxWidth: '800px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.5rem' }}>
          <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '1rem', borderRadius: '12px' }}>
            <Store size={28} />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', fontWeight: 700 }}>Daftar Nama Cabang</h2>
            <p className="text-muted" style={{ fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '1.5rem' }}>
              Anda bisa mengganti nama cabang default ("Pusat") menjadi nama toko Anda (Misal: <b>Gudang Immune Central</b>) atau menambahkan cabang baru.
            </p>

            {loadingBranches ? (
              <p className="text-muted">Memuat data cabang...</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                {branches.map(branch => (
                  <div key={branch.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', backgroundColor: 'white', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                    {editingBranch?.id === branch.id ? (
                      <form onSubmit={handleUpdateBranch} style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
                        <input 
                          type="text" 
                          className="input-field" 
                          value={editBranchName} 
                          onChange={e => setEditBranchName(e.target.value)} 
                          style={{ flex: 1, padding: '0.5rem' }} 
                          autoFocus
                        />
                        <button type="submit" className="btn-primary" style={{ padding: '0.5rem 1rem' }}>Simpan</button>
                        <button type="button" onClick={() => setEditingBranch(null)} style={{ padding: '0.5rem', background: 'none', border: 'none', cursor: 'pointer' }}>
                          <X size={20} color="var(--text-muted)" />
                        </button>
                      </form>
                    ) : (
                      <>
                        <span style={{ fontWeight: 600 }}>{branch.name}</span>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button 
                            onClick={() => { setEditingBranch(branch); setEditBranchName(branch.name); }} 
                            style={{ padding: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6' }}
                            title="Edit Nama"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => handleDeleteBranch(branch.id, branch.name)} 
                            style={{ padding: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}
                            title="Hapus Cabang"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleAddBranch} style={{ display: 'flex', gap: '0.75rem' }}>
              <input 
                type="text" 
                className="input-field" 
                placeholder="Ketik nama cabang baru..." 
                value={newBranchName}
                onChange={e => setNewBranchName(e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 1.25rem' }}>
                <Plus size={18} /> Tambah
              </button>
            </form>

          </div>
        </div>
      </div>
    </div>
  );
}
