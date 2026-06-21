import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ShoppingCart, Plus, Minus, Trash2, CreditCard, Banknote, QrCode, Search, X } from 'lucide-react';
import { supabase } from '../supabase';
import { useSettings } from '../contexts/SettingsContext';

export default function POS() {
  const { userData } = useAuth();
  const context = useOutletContext();
  const { isMultiBranch } = useSettings();

  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  
  const [products, setProducts] = useState([]);
  const [inventoryMap, setInventoryMap] = useState({});
  const [loading, setLoading] = useState(true);

  // Cart state
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('Tunai');
  const [isProcessing, setIsProcessing] = useState(false);

  // Register State (Modal Awal)
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [cashAwalInput, setCashAwalInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  
  // Daily Summary State
  const [dailyTransactions, setDailyTransactions] = useState([]);
  const [modalAwal, setModalAwal] = useState(0);

  // Mobile Drawer State
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    const handleOpenCart = () => setIsCartOpen(true);
    window.addEventListener('open-cart', handleOpenCart);
    return () => window.removeEventListener('open-cart', handleOpenCart);
  }, []);

  const getTodayDateStr = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
  };
  useEffect(() => {
    fetchBranches();
    fetchProducts();
  }, [userData]);

  useEffect(() => {
    if (selectedBranch) {
      if (context?.setCurrentBranch) {
        context.setCurrentBranch(selectedBranch);
      }
      fetchInventory(selectedBranch);
      setCart([]); // Reset cart when branch changes
      
      // Load stored Modal Awal for today
      const todayStr = getTodayDateStr();
      const storageKey = `pos_modal_${selectedBranch}_${todayStr}`;
      const storedModal = localStorage.getItem(storageKey);
      
      if (storedModal) {
        setModalAwal(parseInt(storedModal, 10));
        setIsRegisterOpen(true);
      } else {
        setModalAwal(0);
        setIsRegisterOpen(false);
      }
      
      setCashAwalInput('');
      fetchDailyTransactions(selectedBranch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranch]);

  const fetchDailyTransactions = async (branchName) => {
    try {
      const today = new Date();
      today.setHours(0,0,0,0);
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('branch_name', branchName)
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setDailyTransactions(data || []);
    } catch (err) {
      console.error("Error fetching daily transactions:", err);
    }
  };

  const fetchBranches = async () => {
    try {
      const { data } = await supabase.from('outlets').select('name');
      if (data) {
        let filteredBranches = data;
        if (userData?.role !== 'admin' && userData?.branch && userData?.branch !== 'Seluruh Cabang') {
          filteredBranches = data.filter(b => b.name === userData.branch);
        }
        setBranches(filteredBranches);
        if (!isMultiBranch) {
          setSelectedBranch('Pusat');
        } else if (!selectedBranch) {
          setSelectedBranch(userData?.branch && userData.branch !== 'Seluruh Cabang'
            ? userData.branch
            : (filteredBranches.length > 0 ? filteredBranches[0].name : ''));
        }
      }
    } catch (err) { console.error(err); }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('products').select('*').order('display_order', { ascending: true, nullsFirst: false }).order('name');
      if (error) throw error;
      setProducts(data || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const fetchInventory = async (branchName) => {
    try {
      const { data } = await supabase
        .from('branch_inventory')
        .select('item_name, current_qty')
        .eq('branch_name', branchName);
      
      if (data) {
        const map = {};
        data.forEach(item => {
          map[item.item_name] = item.current_qty;
        });
        setInventoryMap(map);
      }
    } catch (err) { console.error(err); }
  };

  // ── Cart Operations ───────────────────────────────────────────

  const getStockKey = (prod) => {
    return prod.variant && prod.variant !== 'Standar' ? `${prod.name} ${prod.variant}` : prod.name;
  };

  const addToCart = (product) => {
    const stockKey = getStockKey(product);
    const currentStock = inventoryMap[stockKey] ?? inventoryMap[product.name];

    if (!product.is_unlimited && (currentStock === undefined || currentStock <= 0)) {
      alert('Stok habis!');
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        if (!product.is_unlimited && existing.qty >= currentStock) {
          alert('Mencapai batas stok maksimal!');
          return prev;
        }
        return prev.map(item => item.product.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { product, qty: 1 }];
    });
  };

  const updateCartQty = (productId, delta) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.product.id === productId) {
          const newQty = item.qty + delta;
          if (newQty < 1) return item; // Handled by remove button
          
          const stockKey = getStockKey(item.product);
          const currentStock = inventoryMap[stockKey] ?? inventoryMap[item.product.name];
          if (!item.product.is_unlimited && newQty > currentStock) {
             alert('Mencapai batas stok maksimal!');
             return item;
          }
          return { ...item, qty: newQty };
        }
        return item;
      });
    });
  };

  const removeFromCart = (productId) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.product.price * item.qty), 0);

  // ── Checkout Logic ────────────────────────────────────────────

  const handleOpenRegister = () => {
    if (!selectedBranch) {
      alert('Pilih cabang terlebih dahulu.');
      return;
    }
    if (!cashAwalInput || isNaN(cashAwalInput) || parseInt(cashAwalInput) < 0) {
      alert('Masukkan nominal kas awal yang valid.');
      return;
    }
    
    const val = parseInt(cashAwalInput, 10);
    const todayStr = getTodayDateStr();
    const storageKey = `pos_modal_${selectedBranch}_${todayStr}`;
    localStorage.setItem(storageKey, val.toString());
    
    setModalAwal(val);
    setIsRegisterOpen(true);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (!selectedBranch) {
      alert('Pilih cabang terlebih dahulu.');
      return;
    }

    setIsProcessing(true);

    try {
      // 1. Insert Transaction
      const transactionDetails = cart.map(item => ({
        name: item.product.name,
        variant: item.product.variant || 'Standar',
        price: item.product.price,
        qty: item.qty
      }));

      const { error: txError } = await supabase.from('transactions').insert([{
        branch_name: selectedBranch,
        staff_name: userData?.name || 'Unknown',
        total_amount: cartTotal,
        payment_method: paymentMethod,
        details: transactionDetails
      }]);

      if (txError) throw txError;

      // 2. Deduct Inventory & Add to Log
      for (const item of cart) {
        const itemName = getStockKey(item.product);
        const deductQty = item.qty;
        const currentStock = inventoryMap[itemName] || 0;
        
        if (!item.product.is_unlimited) {
            const newStock = currentStock - deductQty;

            // Update inventory
            await supabase
              .from('branch_inventory')
              .upsert({
                branch_name: selectedBranch,
                item_name: itemName,
                current_qty: newStock,
                updated_at: new Date().toISOString()
              }, { onConflict: 'branch_name, item_name' });

            // Add to stock_restock_log
            await supabase.from('stock_restock_log').insert([{
              branch_name: selectedBranch,
              item_name: itemName,
              qty_added: -deductQty,
              qty_before: currentStock,
              qty_after: newStock,
              petugas_name: userData?.name || 'Kasir (Sistem)'
            }]);
        }
      }

      // Success
      alert('Pembayaran berhasil!');
      setCart([]);
      fetchInventory(selectedBranch); // refresh inventory
      fetchDailyTransactions(selectedBranch); // refresh transactions
      
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan saat menyimpan transaksi:\n' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────

  const categoryEmoji = {
    'Drink': '🥤', 'Tea Series': '🍵', 'Coffee Series': '☕', 'Milky Series': '🥛',
    'Sachet Series': '🛍️', 'Hot Series': '☕🔥', 'Choco Series': '🍫',
    'Food': '🍱', 'Topping': '🍬', 'Lainnya': '📦'
  };

  const categories = ['Semua', ...new Set(products.map(p => p.category).filter(Boolean))];

  const filteredProducts = products.filter(prod => {
    const matchesSearch = prod.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (prod.variant && prod.variant.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'Semua' || prod.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '2rem', height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="text-primary" style={{ fontSize: '1.3rem', marginBottom: '0.25rem' }}>Kasir Penjualan</h1>
          <p className="text-muted mobile-hide" style={{ fontSize: '0.82rem' }}>Pilih produk dan selesaikan transaksi secara real-time.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {isRegisterOpen && (
            <div style={{ padding: '0.4rem 0.8rem', backgroundColor: 'rgba(16,185,129,0.1)', color: 'var(--primary)', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700 }}>
              Modal Awal: Rp {modalAwal.toLocaleString('id-ID')}
            </div>
          )}
          {isMultiBranch && (
            <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} className="input-field" style={{ padding: '0.4rem 0.8rem', minWidth: '150px' }}>
              {branches.length === 0 ? <option value="">Memuat Cabang...</option> : null}
              {branches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {!isRegisterOpen ? (
        <div className="flex justify-center animate-fade-in" style={{ minHeight: '60vh', alignItems: 'center' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem', textAlign: 'center' }}>
            <div className="flex justify-center mb-4 text-primary">
              <Banknote size={48} />
            </div>
            <h2 style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>Buka Kasir</h2>
            <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>Silakan masukkan nominal uang modal awal (cash) yang ada di laci kasir saat ini.</p>

            <div style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
              <label className="text-muted" style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem' }}>Nominal Modal Awal (Rp)</label>
              <input
                type="number"
                className="input-field"
                value={cashAwalInput}
                onChange={e => setCashAwalInput(e.target.value)}
                placeholder="Contoh: 100000"
                style={{ fontSize: '1.1rem', fontWeight: 600 }}
              />
            </div>

            <button
              type="button"
              className="btn-primary"
              style={{ width: '100%', padding: '0.8rem', fontSize: '1rem' }}
              disabled={!cashAwalInput}
              onClick={handleOpenRegister}
            >
              Mulai Sesi Kasir
            </button>
          </div>
        </div>
      ) : (
        <div className="pos-grid">
        
        {/* LEFT: Product Catalog */}
        <div className="glass-panel mobile-glass-compact" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 className="mobile-hide" style={{ fontSize: '1.1rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>Katalog Produk</h2>
            
            <div style={{ position: 'relative', width: '100%', marginBottom: '1rem' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                placeholder="Cari nama atau varian produk..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="input-field search-input"
                style={{ padding: '0.75rem 1rem 0.75rem 2.5rem', fontSize: '0.95rem', borderRadius: '12px', width: '100%' }}
              />
            </div>
            
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
                    color: selectedCategory === cat ? 'white' : 'var(--text-main)',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {categoryEmoji[cat] || ''} {cat}
                </button>
              ))}
            </div>
          </div>
          
          {loading ? (
            <p className="text-muted">Memuat produk...</p>
          ) : filteredProducts.length === 0 ? (
            <p className="text-muted text-center" style={{ padding: '2rem 0' }}>Tidak ada produk yang sesuai.</p>
          ) : (
            <div className="mobile-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem' }}>
              {filteredProducts.map(prod => {
                const stockKey = getStockKey(prod);
                const currentStock = inventoryMap[stockKey] ?? inventoryMap[prod.name];
                const isEmpty = !prod.is_unlimited && (currentStock === undefined || currentStock <= 0);
                const cartItem = cart.find(c => c.product.id === prod.id);
                
                return (
                  <div 
                    key={prod.id} 
                    onClick={() => !isEmpty && addToCart(prod)}
                    style={{
                      border: `2px solid ${cartItem ? 'var(--primary)' : 'var(--border-color)'}`,
                      borderRadius: '12px',
                      padding: '0.75rem',
                      cursor: isEmpty ? 'not-allowed' : 'pointer',
                      opacity: isEmpty ? 0.5 : 1,
                      backgroundColor: cartItem ? 'rgba(16,185,129,0.05)' : 'white',
                      transition: 'all 0.2s',
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                  >
                    {cartItem && (
                      <div style={{
                        position: 'absolute', top: '-8px', right: '-8px',
                        backgroundColor: 'var(--primary)', color: 'white',
                        borderRadius: '50%', width: '24px', height: '24px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.8rem', fontWeight: 'bold'
                      }}>
                        {cartItem.qty}
                      </div>
                    )}
                    <div>
                      <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.25rem', lineHeight: '1.2' }}>{prod.name}</h4>
                      {prod.variant && prod.variant !== 'Standar' && (
                        <span style={{ fontSize: '0.7rem', backgroundColor: 'rgba(0,0,0,0.05)', padding: '0.1rem 0.4rem', borderRadius: '4px', display: 'inline-block', marginBottom: '0.5rem' }}>
                          {prod.variant}
                        </span>
                      )}
                    </div>
                    <div>
                      <div style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '0.9rem', marginTop: '0.5rem' }}>
                        Rp {prod.price.toLocaleString('id-ID')}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: isEmpty ? '#ef4444' : 'var(--text-muted)', marginTop: '0.25rem' }}>
                        {prod.is_unlimited ? 'Stok: Unlimited' : `Stok: ${currentStock || 0}`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT: Cart & Checkout */}
        <>
          {isCartOpen && <div className="sidebar-overlay mobile-only" onClick={() => setIsCartOpen(false)} style={{ zIndex: 1999 }}></div>}
          <div id="cart-section" className={`desktop-sticky-cart mobile-cart-drawer ${isCartOpen ? 'open' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="mobile-only mobile-cart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.2rem', color: 'var(--primary)', fontWeight: 800 }}>Keranjang Belanja</h3>
              <button onClick={() => setIsCartOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>
          
          {/* Riwayat Transaksi Terakhir */}
          {dailyTransactions.length > 0 && (
            <div className="glass-panel animate-fade-in" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontSize: '1rem', color: 'var(--primary)', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                Transaksi Terakhir
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {dailyTransactions.slice(0, 5).map(tx => (
                  <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '0.2rem' }}>Rp {Number(tx.total_amount).toLocaleString('id-ID')}</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(tx.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} • {tx.details.length} item
                      </p>
                    </div>
                    <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '12px', backgroundColor: tx.payment_method === 'Tunai' ? 'rgba(16,185,129,0.1)' : 'rgba(59,130,246,0.1)', color: tx.payment_method === 'Tunai' ? 'var(--primary)' : '#3b82f6', fontWeight: 600 }}>
                      {tx.payment_method}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', minHeight: '60vh' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.1rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShoppingCart size={20} /> Keranjang
              </h2>
              {cart.length > 0 && (
                <button onClick={() => setCart([])} style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '0.8rem', cursor: 'pointer' }}>Kosongkan</button>
              )}
            </div>

            {/* Cart Items */}
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem' }}>
              {cart.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.5 }}>
                  <ShoppingCart size={48} style={{ marginBottom: '1rem' }} />
                  <p>Keranjang masih kosong</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {cart.map(item => (
                    <div key={item.product.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{item.product.name}</div>
                        {item.product.variant && item.product.variant !== 'Standar' && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{item.product.variant}</div>
                        )}
                        <div style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>Rp {(item.product.price * item.qty).toLocaleString('id-ID')}</div>
                      </div>
                      
                      {/* Qty Controls */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'white', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.2rem' }}>
                        <button onClick={() => updateCartQty(item.product.id, -1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><Minus size={14}/></button>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, minWidth: '20px', textAlign: 'center' }}>{item.qty}</span>
                        <button onClick={() => updateCartQty(item.product.id, 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}><Plus size={14}/></button>
                      </div>
                      <button onClick={() => removeFromCart(item.product.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0.2rem' }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Total & Payment */}
            <div style={{ borderTop: '2px solid rgba(16,185,129,0.3)', paddingTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-muted)' }}>Total Tagihan</span>
                <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)' }}>Rp {cartTotal.toLocaleString('id-ID')}</span>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Metode Pembayaran</p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {[
                    { id: 'Tunai', icon: Banknote },
                    { id: 'QRIS', icon: QrCode },
                    { id: 'Transfer', icon: CreditCard }
                  ].map(method => (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setPaymentMethod(method.id)}
                      style={{
                        flex: 1, padding: '0.5rem', borderRadius: '8px',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem',
                        border: `2px solid ${paymentMethod === method.id ? 'var(--primary)' : 'var(--border-color)'}`,
                        backgroundColor: paymentMethod === method.id ? 'rgba(16,185,129,0.1)' : 'white',
                        color: paymentMethod === method.id ? 'var(--primary)' : 'var(--text-muted)',
                        cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem'
                      }}
                    >
                      <method.icon size={18} />
                      {method.id}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleCheckout}
                disabled={cart.length === 0 || isProcessing}
                className="btn-primary"
                style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
              >
                {isProcessing ? 'Memproses...' : 'Selesaikan Pembayaran'}
              </button>
            </div>

          </div>

        </div>
        </>
      </div>
      )}

    </div>
  );
}
