import React, { useState, useEffect } from 'react';
import { Package, Plus, Trash2, Edit, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../supabase';

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setModalOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', category: 'Drink', variant: '', price: '', image_url: '' });
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [delModalOpen, setDelModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Bulk States
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkCategory, setBulkCategory] = useState('');

  // Category Filter State
  const [selectedCategory, setSelectedCategory] = useState('Semua');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('products').select('*').order('category').order('name');
      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      alert(`Gagal mengambil data produk:\n${error.message || JSON.stringify(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);

      const productData = {
        name: newProduct.name,
        category: newProduct.category,
        variant: newProduct.variant || 'Standar',
        price: parseInt(newProduct.price) || 0,
        image_url: newProduct.image_url || null
      };

      let error;
      if (editingId) {
        const { error: updateErr } = await supabase.from('products').update(productData).eq('id', editingId);
        error = updateErr;
      } else {
        const { error: insertErr } = await supabase.from('products').insert([productData]);
        error = insertErr;
      }

      if (error) {
        if (error.code === 'PGRST204' || error.message?.includes('image_url')) {
          throw new Error("Kolom 'image_url' belum ada di tabel 'products' database Supabase Anda. Anda harus menambahkannya terlebih dahulu melalui Supabase Dashboard.");
        }
        throw error;
      }
      
      await fetchProducts();
      setModalOpen(false);
      setEditingId(null);
      setNewProduct({ name: '', category: 'Drink', variant: 'Standar', price: '', image_url: '' });
    } catch (error) {
      console.error('Error adding product:', error);
      alert(`Gagal menyimpan produk:\n${error.message || JSON.stringify(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e) => {
    try {
      if (!e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      if (file.size > 2 * 1024 * 1024) {
        alert('Ukuran file maksimal 2MB');
        return;
      }
      setUploadingImage(true);

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage.from('products').upload(filePath, file);

      if (uploadError) {
        if (uploadError.message.includes('bucket')) {
           throw new Error("Bucket storage 'products' belum dibuat di Supabase Anda atau belum diset Public. Buat terlebih dahulu di menu Storage.");
        }
        throw uploadError;
      }

      const { data } = supabase.storage.from('products').getPublicUrl(filePath);
      
      setNewProduct({...newProduct, image_url: data.publicUrl});
    } catch (error) {
      alert('Error mengunggah foto:\n' + error.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleEdit = (prod) => {
    setNewProduct({ 
      name: prod.name, 
      category: prod.category || 'Drink', 
      variant: prod.variant && prod.variant !== 'Standar' ? prod.variant : '', 
      price: prod.price || '', 
      image_url: prod.image_url || ''
    });
    setEditingId(prod.id);
    setDelModalOpen(false);
    setModalOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (prod) => {
    setSelectedProduct(prod);
    setModalOpen(false);
    setDelModalOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const confirmDelete = async () => {
    if (!selectedProduct) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.from('products').delete().eq('id', selectedProduct.id).select();
      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error("Penghapusan diblokir oleh sistem database (Row Level Security). Anda perlu menambahkan policy DELETE di Supabase.");
      }

      await fetchProducts();
      setDelModalOpen(false);
      setSelectedProduct(null);
      alert("Produk berhasil dihapus.");
    } catch (error) {
      console.error('Error deleting:', error);
      alert('Gagal menghapus produk dari database:\n' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const categories = ['Semua', ...new Set(products.map(p => p.category).filter(Boolean))];

  const filteredProducts = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        (p.variant && p.variant.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchCategory = selectedCategory === 'Semua' || p.category === selectedCategory;
    return matchSearch && matchCategory;
  });

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredProducts.length && filteredProducts.length > 0) setSelectedIds([]);
    else setSelectedIds(filteredProducts.map(p => p.id));
  };

  const handleBulkUpdate = async () => {
    if (selectedIds.length === 0 || !bulkCategory) {
      alert('Pilih produk dan kategori tujuan terlebih dahulu.');
      return;
    }
    
    if (!confirm(`Ganti kategori ${selectedIds.length} produk menjadi "${bulkCategory}"?`)) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('products')
        .update({ category: bulkCategory })
        .in('id', selectedIds);
      
      if (error) throw error;
      
      await fetchProducts();
      setSelectedIds([]);
      setBulkCategory('');
      alert(`${selectedIds.length} produk berhasil diperbarui!`);
    } catch (err) {
      alert('Gagal update massal:\n' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-primary mb-1">Master Menu & Produk</h1>
          <p className="text-muted">Kelola harga, foto, dan kategori minuman atau topping.</p>
        </div>
        <button onClick={() => {
            setEditingId(null);
            setNewProduct({ name: '', category: 'Drink', variant: '', price: '', image_url: '' });
            setDelModalOpen(false);
            setModalOpen(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }} className="btn-primary">
          <Plus size={18} /> Tambah Menu Baru
        </button>
      </div>
      
      <div className="mb-4 animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <input 
          type="text" 
          className="input-field" 
          placeholder="Cari nama atau varian produk..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: '100%', maxWidth: '400px', marginBottom: 0 }}
        />
        
        {/* Category Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }} className="hide-scrollbar">
          {categories.map(cat => (
            <button 
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className="mobile-category-tab"
              style={{
                padding: '0.4rem 1rem', 
                borderRadius: '20px', 
                fontSize: '0.85rem',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                border: `1px solid ${selectedCategory === cat ? 'var(--primary)' : 'var(--border-color)'}`,
                backgroundColor: selectedCategory === cat ? 'var(--primary)' : 'white',
                color: selectedCategory === cat ? 'white' : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {cat === 'Semua' ? 'Semua Kategori' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="glass-panel mb-6 animate-fade-in" style={{ padding: '1.25rem', border: '2px solid var(--primary)', display: 'flex', gap: '1rem', alignItems: 'center', backgroundColor: 'rgba(9, 108, 70, 0.05)', borderRadius: '12px' }}>
          <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '1rem', flexShrink: 0 }}>
             📦 {selectedIds.length} Item Terpilih
          </div>
          <div style={{ height: '30px', width: '2px', backgroundColor: 'var(--border-color)' }}></div>
          <span className="text-muted" style={{ fontSize: '0.9rem', fontWeight: 600 }}>Ubah Kategori Ke:</span>
          <input 
            type="text" 
            list="bulk-category-options"
            className="input-field" 
            style={{ width: '220px', marginBottom: 0 }} 
            value={bulkCategory} 
            onChange={e => setBulkCategory(e.target.value)}
            placeholder="Ketik atau pilih kategori..."
          />
          <datalist id="bulk-category-options">
            {categories.filter(c => c !== 'Semua').map(c => <option key={c} value={c} />)}
          </datalist>
          <button onClick={handleBulkUpdate} disabled={saving || !bulkCategory} className="btn-primary" style={{ padding: '0.6rem 1.25rem' }}>
            Terapkan Sekaligus
          </button>
          <button onClick={() => setSelectedIds([])} className="btn-secondary" style={{ padding: '0.6rem 1rem' }}>
            Batal
          </button>
        </div>
      )}

      {isModalOpen && (
        <div className="glass-panel mb-6 animate-fade-in" style={{ border: '2px solid var(--primary)', padding: '1.5rem' }}>
          <h2 className="mb-4 text-primary">{editingId ? 'Edit Menu' : 'Tambah Menu Baru'}</h2>
          <form onSubmit={handleAddProduct} className="flex-col gap-4">
            
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
               <label style={{ width: '100px', height: '100px', backgroundColor: 'rgba(0,0,0,0.03)', border: '2px dashed rgba(0,0,0,0.1)', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: uploadingImage ? 'not-allowed' : 'pointer', position: 'relative', overflow: 'hidden' }}>
                 {uploadingImage ? (
                   <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>Loading...</span>
                 ) : newProduct.image_url ? (
                   <img src={newProduct.image_url} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                 ) : (
                   <>
                     <ImageIcon size={24} className="text-muted mb-2" />
                     <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Upload Foto</span>
                   </>
                 )}
                 <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} disabled={uploadingImage} />
               </label>
            </div>

            <div>
              <label className="text-muted" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Nama Produk</label>
              <input type="text" className="input-field" required value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} placeholder="Matcha Latte" />
            </div>

            <div>
              <label className="text-muted" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Kategori (Pilih atau Ketik Baru)</label>
              <input 
                type="text" 
                list="category-options" 
                className="input-field" 
                required 
                value={newProduct.category} 
                onChange={e => setNewProduct({...newProduct, category: e.target.value})} 
                placeholder="Contoh: Kurma, Minuman..." 
              />
              <datalist id="category-options">
                {categories.filter(c => c !== 'Semua').map(c => <option key={c} value={c} />)}
              </datalist>
            </div>

            <div>
              <label className="text-muted" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Varian Produk (Opsional)</label>
              <input type="text" className="input-field" value={newProduct.variant} onChange={e => setNewProduct({...newProduct, variant: e.target.value})} placeholder="Contoh: 500Gr, Ori, 1 Kg" />
            </div>

            <div>
              <label className="text-muted" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Harga</label>
              <input type="number" className="input-field" required value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} placeholder="Rp" />
            </div>
            
            <div className="flex justify-between mt-6">
              <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Batal</button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? 'Menyimpan...' : (editingId ? 'Update Menu' : 'Simpan Menu')}
              </button>
            </div>
          </form>
        </div>
      )}

      {delModalOpen && (
        <div className="glass-panel mb-6 animate-fade-in" style={{ border: '2px solid var(--danger)', padding: '1.5rem' }}>
          <h2 className="mb-4 text-danger">Konfirmasi Hapus</h2>
          <p className="text-muted mb-6">
            Apakah Anda yakin ingin menghapus produk <strong>"{selectedProduct?.name}"</strong> secara permanen?
          </p>
          <div className="flex justify-between">
            <button onClick={() => setDelModalOpen(false)} className="btn-secondary">Batal</button>
            <button 
              onClick={confirmDelete} 
              disabled={saving} 
              className="btn-primary" 
              style={{ backgroundColor: 'var(--danger)', color: 'white', borderColor: 'transparent' }}
            >
              {saving ? 'Menghapus...' : 'Ya, Hapus'}
            </button>
          </div>
        </div>
      )}

      <div className="glass-panel table-responsive" style={{ overflowX: 'auto', overflowY: 'hidden' }}>
        <table className="data-table" style={{ marginTop: 0, minWidth: '800px' }}>
          <thead style={{ backgroundColor: 'rgba(0,0,0,0.03)' }}>
            <tr>
              <th style={{ width: '40px' }}>
                <input type="checkbox" checked={selectedIds.length === filteredProducts.length && filteredProducts.length > 0} onChange={toggleSelectAll} />
              </th>
              <th style={{ width: '60px' }}>Foto</th>
              <th style={{ minWidth: '250px' }}>Nama Item</th>
              <th>Kategori</th>
              <th>Varian</th>
              <th>Harga</th>
              <th className="text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8" className="text-center text-muted py-4">Memuat data dari Supabase...</td></tr>
            ) : filteredProducts.length === 0 ? (
              <tr><td colSpan="8" className="text-center text-muted py-4">Tidak ada produk yang ditemukan.</td></tr>
            ) : filteredProducts.map(prod => (
              <tr key={prod.id} style={{ backgroundColor: selectedIds.includes(prod.id) ? 'rgba(16, 185, 129, 0.05)' : 'transparent' }}>
                <td>
                  <input type="checkbox" checked={selectedIds.includes(prod.id)} onChange={() => toggleSelect(prod.id)} />
                </td>
                <td>
                  <div style={{ width: '40px', height: '40px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', overflow: 'hidden' }}>
                    {prod.image_url ? (
                      <img src={prod.image_url} alt={prod.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <ImageIcon size={20} />
                    )}
                  </div>
                </td>
                <td style={{ fontWeight: 600 }}>{prod.name}</td>
                <td>
                  <span style={{ 
                    backgroundColor: prod.category === 'Drink' ? 'rgba(9, 108, 70, 0.1)' : 
                                    prod.category === 'Tea Series' ? 'rgba(16, 185, 129, 0.1)' :
                                    prod.category === 'Coffee Series' ? 'rgba(120, 113, 108, 0.1)' :
                                    prod.category === 'Milky Series' ? 'rgba(14, 165, 233, 0.1)' :
                                    prod.category === 'Sachet Series' ? 'rgba(236, 72, 153, 0.1)' :
                                    prod.category === 'Hot Series' ? 'rgba(249, 115, 22, 0.1)' :
                                    prod.category === 'Choco Series' ? 'rgba(146, 64, 14, 0.1)' :
                                    'rgba(59, 130, 246, 0.1)', 
                    color: prod.category === 'Drink' ? 'var(--primary)' : 
                           prod.category === 'Tea Series' ? '#10b981' :
                           prod.category === 'Coffee Series' ? '#78716c' :
                           prod.category === 'Milku Series' ? '#0ea5e9' :
                           prod.category === 'Sachet Series' ? '#ec4899' :
                           prod.category === 'Hot Series' ? '#f97316' :
                           prod.category === 'Choco Series' ? '#92400e' :
                           '#3b82f6', 
                    padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 600 
                  }}>
                    {prod.category}
                  </span>
                </td>
                <td>
                  <span style={{
                    backgroundColor: prod.variant === 'Ori' ? 'rgba(251,191,36,0.15)' : prod.variant === 'Premi' ? 'rgba(99,102,241,0.15)' : prod.variant?.startsWith('Sachet') ? 'rgba(236,72,153,0.15)' : 'rgba(0,0,0,0.05)',
                    color: prod.variant === 'Ori' ? '#d97706' : prod.variant === 'Premi' ? '#4f46e5' : prod.variant?.startsWith('Sachet') ? '#ec4899' : 'var(--text-muted)',
                    padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.82rem', fontWeight: 700
                  }}>
                    {prod.variant || 'Standar'}
                  </span>
                </td>
                <td style={{ fontWeight: 600 }}>Rp {(prod.price || 0).toLocaleString('id-ID')}</td>
                <td className="text-center">
                  <div className="flex justify-center gap-2">
                    <button onClick={() => handleEdit(prod)} className="btn-secondary" style={{ padding: '0.4rem', borderColor: 'transparent' }} title="Edit"><Edit size={16} /></button>
                    <button onClick={() => handleDelete(prod)} className="btn-secondary" style={{ padding: '0.4rem', borderColor: 'transparent', color: 'var(--danger)' }} title="Hapus"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
