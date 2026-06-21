import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabase';
import { Download, X, Printer } from 'lucide-react';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';

export default function RiwayatKasir() {
  const { userData } = useAuth();
  const [dailyTransactions, setDailyTransactions] = useState([]);
  const [modalAwal, setModalAwal] = useState(0);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [customerWA, setCustomerWA] = useState('');

  const handlePrintReceipt = () => {
    window.print();
  };

  const handleCopyReceiptWA = async () => {
    const printArea = document.getElementById('receipt-print-area');
    if (!printArea) return;
    try {
      const canvas = await html2canvas(printArea, { scale: 2, backgroundColor: '#ffffff' });
      canvas.toBlob(async (blob) => {
        if (blob) {
          const item = new ClipboardItem({ 'image/png': blob });
          await navigator.clipboard.write([item]);
          const waUrl = customerWA ? `https://wa.me/${customerWA.replace(/\D/g, '')}` : `https://web.whatsapp.com/`;
          window.open(waUrl, '_blank');
        }
      });
    } catch (err) {
      console.error("Gagal menyalin gambar struk:", err);
      alert("Browser Anda tidak mendukung fitur copy gambar otomatis.");
    }
  };

  const getTodayDateStr = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
  };

  useEffect(() => {
    if (userData) {
      if (userData.role === 'admin' || userData.role === 'owner') {
        supabase.from('outlets').select('name').then(({ data }) => {
          if (data && data.length > 0) {
            setBranches(data);
            const initialBranch = data[0].name;
            setSelectedBranch(initialBranch);
            loadDataForBranch(initialBranch);
          } else {
            setSelectedBranch('Pusat');
            loadDataForBranch('Pusat');
          }
        });
      } else {
        const branch = userData.branch && userData.branch !== 'Seluruh Cabang' ? userData.branch : 'Pusat';
        setSelectedBranch(branch);
        loadDataForBranch(branch);
      }
    }
  }, [userData]);

  const loadDataForBranch = (branch) => {
    const todayStr = getTodayDateStr();
    const storageKey = `pos_modal_${branch}_${todayStr}`;
    const storedModal = localStorage.getItem(storageKey);
    setModalAwal(storedModal ? parseInt(storedModal, 10) : 0);
    fetchDailyTransactions(branch);
  };

  const handleBranchChange = (e) => {
    const branch = e.target.value;
    setSelectedBranch(branch);
    loadDataForBranch(branch);
  };

  const fetchDailyTransactions = async (branchName) => {
    try {
      setLoading(true);
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      
      let query = supabase.from('transactions').select('*');
      
      if (branchName !== 'Semua Cabang') {
        query = query.eq('branch_name', branchName);
      }
      
      const { data, error } = await query
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString())
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setDailyTransactions(data || []);
    } catch (err) {
      console.error("Error fetching daily transactions:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (dailyTransactions.length === 0) {
      alert("Tidak ada data transaksi untuk diekspor.");
      return;
    }

    // Persiapkan Data untuk Excel
    const excelData = [];
    
    dailyTransactions.forEach(tx => {
      const dateObj = new Date(tx.created_at);
      const date = dateObj.toLocaleDateString('id-ID');
      const time = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      const branchName = tx.branch_name || '-';
      const staffName = tx.staff_name || userData?.name || 'Unknown';
      const payment = tx.payment_method || '-';
      const totalAmount = tx.total_amount || 0;
      
      const produkArray = tx.details || [];
      
      if (produkArray.length === 0) {
        excelData.push({
          "Tanggal": date,
          "Waktu": time,
          "Cabang": branchName,
          "Nama Kasir": staffName,
          "Metode": payment,
          "Produk Terjual": "-",
          "Qty Item": 0,
          "Total Penjualan (Rp)": totalAmount
        });
      } else {
        produkArray.forEach((p, index) => {
          excelData.push({
            "Tanggal": index === 0 ? date : "",
            "Waktu": index === 0 ? time : "",
            "Cabang": index === 0 ? branchName : "",
            "Nama Kasir": index === 0 ? staffName : "",
            "Metode": index === 0 ? payment : "",
            "Produk Terjual": `${p.name}${p.variant && p.variant !== 'Standar' ? ` (${p.variant})` : ''}`,
            "Qty Item": p.qty,
            "Total Penjualan (Rp)": index === 0 ? totalAmount : ""
          });
        });
      }
    });

    // Buat Worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    // Atur Lebar Kolom agar rapi
    worksheet['!cols'] = [
      { wch: 12 }, // Tanggal
      { wch: 10 }, // Waktu
      { wch: 20 }, // Cabang
      { wch: 20 }, // Nama Kasir
      { wch: 15 }, // Metode
      { wch: 60 }, // Produk Terjual (dibuat lebar)
      { wch: 10 }, // Qty Item
      { wch: 20 }  // Total Penjualan
    ];

    // Buat Workbook dan download
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Harian");
    XLSX.writeFile(workbook, `Laporan_Harian_${selectedBranch}_${getTodayDateStr()}.xlsx`);
  };

  if (loading) {
    return <div style={{ padding: '2rem' }}>Memuat rekap hari ini...</div>;
  }

  const totalTunai = dailyTransactions.filter(tx => tx.payment_method === 'Tunai').reduce((s, tx) => s + Number(tx.total_amount), 0);
  const totalNonTunai = dailyTransactions.filter(tx => tx.payment_method !== 'Tunai').reduce((s, tx) => s + Number(tx.total_amount), 0);

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="text-primary" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Rekap Penjualan Hari Ini</h1>
          <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>Menampilkan riwayat transaksi dan rincian kas di laci hari ini.</p>
          {(userData?.role === 'admin' || userData?.role === 'owner') && branches.length > 0 && (
            <select 
              value={selectedBranch} 
              onChange={handleBranchChange}
              className="input-field" 
              style={{ maxWidth: '250px', padding: '0.5rem', fontSize: '0.9rem' }}
            >
              {branches.map(b => (
                <option key={b.name} value={b.name}>{b.name}</option>
              ))}
              <option value="Semua Cabang">Semua Cabang (Tanpa Modal Awal)</option>
            </select>
          )}
        </div>
        <button 
          onClick={handleExportExcel}
          className="btn-primary" 
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', fontSize: '0.9rem' }}
        >
          <Download size={18} />
          Export Excel
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
         <div style={{ padding: '1.25rem', backgroundColor: 'white', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>Modal Awal</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>Rp {modalAwal.toLocaleString('id-ID')}</p>
         </div>
         <div style={{ padding: '1.25rem', backgroundColor: 'white', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>Penjualan Tunai</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#3b82f6' }}>Rp {totalTunai.toLocaleString('id-ID')}</p>
         </div>
         <div style={{ padding: '1.25rem', backgroundColor: 'white', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>Penjualan QR/Transfer</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#8b5cf6' }}>Rp {totalNonTunai.toLocaleString('id-ID')}</p>
         </div>
         <div style={{ padding: '1.25rem', backgroundColor: 'rgba(59,130,246,0.1)', borderRadius: '12px', border: '1px solid rgba(59,130,246,0.3)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>Total Penjualan (Hari Ini)</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#2563eb' }}>Rp {(totalTunai + totalNonTunai).toLocaleString('id-ID')}</p>
            <p style={{ fontSize: '0.75rem', marginTop: '0.35rem', color: '#2563eb', opacity: 0.75 }}>(Tunai + QR/Transfer)</p>
         </div>
         <div style={{ padding: '1.25rem', backgroundColor: 'var(--primary)', borderRadius: '12px', color: 'white', boxShadow: '0 4px 6px rgba(16,185,129,0.2)' }}>
            <p style={{ fontSize: '0.85rem', marginBottom: '0.25rem', opacity: 0.9 }}>Total Kas di Laci</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 800 }}>Rp {(modalAwal + totalTunai).toLocaleString('id-ID')}</p>
            <p style={{ fontSize: '0.75rem', marginTop: '0.35rem', opacity: 0.8 }}>(Modal Awal + Penjualan Tunai)</p>
         </div>
      </div>
      
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          Riwayat Transaksi ({dailyTransactions.length})
        </h3>
        {dailyTransactions.length === 0 ? (
           <p className="text-muted text-center" style={{ padding: '2rem 0' }}>Belum ada transaksi hari ini.</p>
        ) : (
             <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
               {dailyTransactions.map(tx => (
                 <div key={tx.id} style={{ padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white' }}>
                   <div>
                     <p style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.25rem' }}>Rp {Number(tx.total_amount).toLocaleString('id-ID')}</p>
                     <p className="text-muted" style={{ fontSize: '0.85rem' }}>
                       {new Date(tx.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB • {tx.payment_method} • {tx.details.length} item
                     </p>
                   </div>
                   <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                     <span style={{ fontSize: '0.85rem', padding: '0.3rem 0.8rem', borderRadius: '20px', backgroundColor: tx.payment_method === 'Tunai' ? 'rgba(16,185,129,0.1)' : 'rgba(59,130,246,0.1)', color: tx.payment_method === 'Tunai' ? 'var(--primary)' : '#3b82f6', fontWeight: 600 }}>
                       {tx.payment_method === 'Tunai' ? '+ Tunai' : '- Non-Tunai'}
                     </span>
                     <button 
                       onClick={() => {
                         setSelectedTransaction({
                           items: tx.details.map(d => ({ product: { name: d.name, variant: d.variant, price: d.price }, qty: d.qty })),
                           total: tx.total_amount,
                           paymentMethod: tx.payment_method,
                           date: tx.created_at,
                           cashier: tx.staff_name,
                           branch: tx.branch_name
                         });
                       }}
                       className="btn-secondary" 
                       style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem' }}
                     >
                       <Printer size={16} /> Cetak
                     </button>
                   </div>
                 </div>
               ))}
             </div>
          )}
        </div>

        {/* RECEIPT MODAL FOR REPRINT */}
        {selectedTransaction && (
          <div className="sidebar-overlay" style={{ zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)' }}>
            <div className="glass-panel" style={{ backgroundColor: 'white', padding: '2rem', maxWidth: '400px', width: '100%', borderRadius: '16px', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ color: 'var(--primary)', margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Nota Transaksi</h2>
                <button onClick={() => {
                  setSelectedTransaction(null);
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
                  <img src="/logo.png" alt="Logo" style={{ width: '120px', marginBottom: '5px' }} />
                  <div style={{ fontSize: '10px' }}>
                    Cabang: {selectedTransaction.branch}
                  </div>
                </div>
                <div style={{ borderBottom: '1px dashed black', margin: '10px 0' }}></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span>Tanggal</span>
                  <span>: {new Date(selectedTransaction.date).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span>Transaksi</span>
                  <span>: {selectedTransaction.paymentMethod.toUpperCase()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span>Kasir</span>
                  <span>: {selectedTransaction.cashier}</span>
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
                    {selectedTransaction.items.map((item, i) => (
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
                  <span style={{ width: '80px', textAlign: 'right' }}>{(selectedTransaction.total).toLocaleString('id-ID')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '20px', marginBottom: '2px' }}>
                  <span style={{ width: '80px', textAlign: 'right' }}>Total :</span>
                  <span style={{ width: '80px', textAlign: 'right' }}>{(selectedTransaction.total).toLocaleString('id-ID')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '20px', marginBottom: '10px' }}>
                  <span style={{ width: '80px', textAlign: 'right' }}>Bayar :</span>
                  <span style={{ width: '80px', textAlign: 'right' }}>{(selectedTransaction.total).toLocaleString('id-ID')}</span>
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
                <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem', display: 'block' }}>Kirim ke WhatsApp Pelanggan</label>
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
          </div>
        )}
    </div>
  );
}
