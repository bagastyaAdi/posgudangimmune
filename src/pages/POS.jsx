import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ShoppingCart, Plus, Minus, Trash2, CreditCard, Banknote, QrCode, Search, X } from 'lucide-react';
import html2canvas from 'html2canvas';
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
  const [lastTransaction, setLastTransaction] = useState(null);
  const [customerWA, setCustomerWA] = useState('');
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
      setLastTransaction({
        items: [...cart],
        total: cartTotal,
        paymentMethod: paymentMethod,
        date: new Date().toISOString(),
        cashier: userData?.name || 'Unknown',
        branch: selectedBranch
      });
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

  const handlePrintReceipt = () => {
    window.print();
  };

  const handleCopyReceiptWA = async () => {
    const el = document.getElementById('receipt-print-area');
    if (!el) return;
    try {
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' });
      canvas.toBlob(async (blob) => {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          
          let waUrl = 'https://wa.me/?text=Halo,+berikut+adalah+nota+pembelian+Anda.+Silakan+Paste+(Tempel)+gambar+struk+disini%3A';
          if (customerWA && customerWA.trim() !== '') {
            let phone = customerWA.trim().replace(/\D/g, '');
            if (phone.startsWith('0')) {
              phone = '62' + phone.substring(1);
            }
            waUrl = `https://wa.me/${phone}?text=Halo,+berikut+adalah+nota+pembelian+Anda.+Silakan+Paste+(Tempel)+gambar+struk+disini%3A`;
          }
          
          alert('Gambar Struk berhasil disalin!\nSilakan Paste/Tempel di chat WhatsApp Anda.');
          window.open(waUrl, '_blank');
        } catch (err) {
          alert('Gagal menyalin gambar ke clipboard. Browser Anda mungkin tidak mendukung fitur ini.');
          console.error(err);
        }
      }, 'image/png');
    } catch (err) {
      console.error('Failed to generate receipt image', err);
      alert('Gagal membuat gambar struk.');
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
    <div className="animate-fade-in" style={{ paddingBottom: '0', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>

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
        <div className="pos-grid" style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        
        {/* LEFT: Product Catalog */}
        <div className="glass-panel mobile-glass-compact" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          
          <div style={{ marginBottom: '1.5rem', flexShrink: 0 }}>
            <h2 className="mobile-hide" style={{ fontSize: '1.1rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>Katalog Produk</h2>
            
            {/* Mobile Auto Scroll Cart Button */}
            <button 
              className="btn-primary mobile-only-btn" 
              onClick={() => setIsCartOpen(true)}
              style={{ 
                width: '100%', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                padding: '0.8rem 1.25rem', 
                marginBottom: '1rem', 
                borderRadius: '12px',
                boxShadow: '0 4px 6px rgba(9, 108, 70, 0.2)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShoppingCart size={20} />
                <span style={{ fontWeight: 700, fontSize: '1rem' }}>Cek Transaksi / Keranjang</span>
              </div>
              {cart.length > 0 && (
                <div style={{ backgroundColor: 'white', color: 'var(--primary)', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 800 }}>
                  {cart.length} Item
                </div>
              )}
            </button>

            {/* Riwayat Transaksi Terakhir (Moved to Main Content) */}


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
            <div className="mobile-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem', flex: 1, overflowY: 'auto', minHeight: 0, paddingRight: '0.5rem' }}>
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
                    <div style={{ width: '100%', overflow: 'hidden' }}>
                      <h4 style={{ 
                        fontSize: '0.9rem', 
                        fontWeight: 700, 
                        marginBottom: '0.35rem', 
                        lineHeight: '1.2',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        color: 'var(--text-main)',
                        width: '100%'
                      }} title={prod.name}>
                        {prod.name}
                      </h4>
                      {prod.variant && prod.variant !== 'Standar' && (
                        <span style={{ 
                          fontSize: '0.75rem', 
                          backgroundColor: 'rgba(16,185,129,0.1)', 
                          color: 'var(--primary)',
                          padding: '0.2rem 0.5rem', 
                          borderRadius: '6px', 
                          display: 'inline-block', 
                          marginBottom: '0.5rem',
                          fontWeight: 700,
                          border: '1px solid rgba(16,185,129,0.2)'
                        }}>
                          Varian: {prod.variant}
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
          <div id="cart-section" className={`desktop-sticky-cart mobile-cart-drawer ${isCartOpen ? 'open' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
            <div className="mobile-only mobile-cart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.2rem', color: 'var(--primary)', fontWeight: 800 }}>Keranjang Belanja</h3>
              <button onClick={() => setIsCartOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}>
                <X size={24} />
              </button>
            </div>

          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', minHeight: '40vh' }}>
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

          {/* EMBEDDED RECEIPT SECTION */}
          {lastTransaction && (
            <div className="glass-panel animate-fade-in" style={{ padding: '1.5rem', marginTop: '1rem', backgroundColor: '#f8fafc', border: '2px solid var(--primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ color: 'var(--primary)', margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Nota Transaksi</h2>
                <button onClick={() => {
                  setLastTransaction(null);
                  setCustomerWA('');
                }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>
              
              {/* The Actual Receipt */}
              <div id="receipt-print-area" style={{ 
                  backgroundColor: 'white', 
                  color: 'black', 
                  fontFamily: 'monospace', 
                  fontSize: '12px', 
                  padding: '15px', 
                  width: '100%', 
                  border: '1px dashed #cbd5e1',
                  lineHeight: '1.4',
                  borderRadius: '8px'
                }}>
                <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 'bold' }}>Nota Transaksi</div>
                  <div style={{ fontSize: '10px' }}>
                    Cabang: {lastTransaction.branch}
                  </div>
                </div>
                <div style={{ borderBottom: '1px dashed black', margin: '10px 0' }}></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span>Tanggal</span>
                  <span>: {new Date(lastTransaction.date).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span>Transaksi</span>
                  <span>: {lastTransaction.paymentMethod.toUpperCase()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span>Kasir</span>
                  <span>: {lastTransaction.cashier}</span>
                </div>
                
                <div style={{ borderBottom: '1px dashed black', margin: '10px 0' }}></div>
                
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginBottom: '5px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px dashed black' }}>
                      <th style={{ paddingBottom: '5px', fontWeight: 'normal' }}>Produk</th>
                      <th style={{ paddingBottom: '5px', textAlign: 'right', fontWeight: 'normal' }}>Harga</th>
                      <th style={{ paddingBottom: '5px', textAlign: 'center', fontWeight: 'normal' }}>Qty</th>
                      <th style={{ paddingBottom: '5px', textAlign: 'right', fontWeight: 'normal' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lastTransaction.items.map((item, i) => (
                      <React.Fragment key={i}>
                        <tr>
                          <td colSpan={4} style={{ paddingTop: '8px', fontWeight: 'bold' }}>
                            {item.product.name} {item.product.variant && item.product.variant !== 'Standar' ? `(${item.product.variant})` : ''}
                          </td>
                        </tr>
                        <tr>
                          <td></td>
                          <td style={{ textAlign: 'right' }}>{(item.product.price).toLocaleString('id-ID')}</td>
                          <td style={{ textAlign: 'center' }}>{item.qty}</td>
                          <td style={{ textAlign: 'right' }}>{(item.product.price * item.qty).toLocaleString('id-ID')}</td>
                        </tr>
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
                
                <div style={{ borderBottom: '1px dashed black', margin: '10px 0' }}></div>
                
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '20px', marginBottom: '2px' }}>
                  <span style={{ width: '80px', textAlign: 'right' }}>Sub-total :</span>
                  <span style={{ width: '80px', textAlign: 'right' }}>{(lastTransaction.total).toLocaleString('id-ID')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '20px', marginBottom: '2px' }}>
                  <span style={{ width: '80px', textAlign: 'right' }}>Total :</span>
                  <span style={{ width: '80px', textAlign: 'right' }}>{(lastTransaction.total).toLocaleString('id-ID')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '20px', marginBottom: '10px' }}>
                  <span style={{ width: '80px', textAlign: 'right' }}>Bayar :</span>
                  <span style={{ width: '80px', textAlign: 'right' }}>{(lastTransaction.total).toLocaleString('id-ID')}</span>
                </div>
                
                <div style={{ fontWeight: 'bold', marginBottom: '15px' }}>
                  Keterangan : Lunas
                </div>
                
                <div style={{ textAlign: 'center', marginTop: '15px', fontSize: '10px' }}>
                  TERIMA KASIH<br/>
                  Silahkan Berkunjung Kembali
                </div>
              </div>

              <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.5rem' }}>
                <div style={{ padding: '1rem', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem', display: 'block' }}>Kirim ke WhatsApp Pelanggan (Opsional)</label>
                  <input
                    type="text"
                    placeholder="Contoh: 08123456789"
                    value={customerWA}
                    onChange={(e) => setCustomerWA(e.target.value)}
                    className="input-field"
                    style={{ marginBottom: '0.75rem', padding: '0.6rem 1rem' }}
                  />
                  <button className="btn-secondary" onClick={handleCopyReceiptWA} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', backgroundColor: '#25D366', color: 'white', border: 'none', padding: '0.8rem' }}>
                    📋 Copy Gambar & Buka WA
                  </button>
                </div>

                <button className="btn-primary" onClick={handlePrintReceipt} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', padding: '0.9rem' }}>
                  🖨️ Cetak Printer Thermal
                </button>
              </div>
            </div>
          )}

        </div>
        </>
      </div>
      )}

    </div>
  );
}
