import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabase';
import { Download, X, Printer } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import html2canvas from 'html2canvas';

export default function RiwayatKasir() {
  const { userData } = useAuth();
  const [dailyTransactions, setDailyTransactions] = useState([]);
  const [modalAwal, setModalAwal] = useState(0);
  const [tutupKasirTx, setTutupKasirTx] = useState(null);
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
      
      const txs = data || [];
      
      // Filter out Modal Awal & Tutup Kasir so it doesn't show in the transaction list / export as a normal sale
      const actualSales = txs.filter(tx => tx.payment_method !== 'Modal Awal' && tx.payment_method !== 'Tutup Kasir');
      setDailyTransactions(actualSales);
      
      // Temukan Modal Awal & Tutup Kasir
      const modalTx = txs.find(tx => tx.payment_method === 'Modal Awal');
      setModalAwal(modalTx ? Number(modalTx.total_amount) : 0);
      
      const tutup = txs.find(tx => tx.payment_method === 'Tutup Kasir');
      setTutupKasirTx(tutup || null);
      
    } catch (err) {
      console.error("Error fetching daily transactions:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    try {
      if (dailyTransactions.length === 0) {
        alert("Tidak ada data transaksi untuk diekspor.");
        return;
      }

      // 1. Kumpulkan Data Statistik Produk
      const productStats = {};
      let grandTotalCup = 0;
      let grandTotalPemasukan = 0;
      
      let totalQR = 0;
      let totalTransfer = 0;
      let totalTransaksi = 0; // Hitung jumlah transaksi

      dailyTransactions.forEach(tx => {
        // Skip Modal Awal & Tutup Kasir
        if (tx.payment_method === 'Modal Awal' || tx.payment_method === 'Tutup Kasir') return;

        totalTransaksi++; // Increment transaksi

        // Hitung metode pembayaran non-tunai (sebagai pengeluaran kas)
        const txTotal = Number(tx.total_amount) || 0;
        if (tx.payment_method === 'QRIS') {
          totalQR += txTotal;
        } else if (tx.payment_method === 'Transfer') {
          totalTransfer += txTotal;
        }

        let produkArray = tx.details || [];
        if (typeof produkArray === 'string') {
          try { produkArray = JSON.parse(produkArray); } catch(e) { produkArray = []; }
        }
        if (!Array.isArray(produkArray)) produkArray = [];

        produkArray.forEach(p => {
          const name = p.name;
          const variant = (p.variant && p.variant !== 'Standar') ? p.variant : '';
          const displayName = variant ? `${name} - ${variant}` : name;
          
          const qty = Number(p.qty) || 0;
          const price = Number(p.price) || 0;
          const total = qty * price;

          if (!productStats[displayName]) {
            productStats[displayName] = { qty: 0, total: 0 };
          }
          productStats[displayName].qty += qty;
          productStats[displayName].total += total;

          grandTotalCup += qty;
          grandTotalPemasukan += total;
        });
      });

      // 2. Susun Baris Excel
      const excelData = [];
      let no = 1;

      Object.keys(productStats).sort().forEach(displayName => {
        const stats = productStats[displayName];
        excelData.push({
          "No": no++,
          "Nama Produk": displayName,
          "QTY": stats.qty > 0 ? stats.qty : "",
          "PRICE": stats.total > 0 ? stats.total : ""
        });
      });

      // Baris kosong
      excelData.push({}); 
      
      // Baris TOTAL
      excelData.push({
        "No": "",
        "Nama Produk": "TOTAL",
        "QTY": grandTotalCup,
        "PRICE": grandTotalPemasukan
      });

      // 2 Baris kosong
      excelData.push({});
      excelData.push({});

      // Ringkasan Bawah (Format disesuaikan dengan screenshot terbaru)
      excelData.push({ "No": "Cash Awal", "Nama Produk": modalAwal, "QTY": "", "PRICE": "" });
      excelData.push({ "No": "TOTAL Item", "Nama Produk": grandTotalCup, "QTY": "Total Transaksi", "PRICE": totalTransaksi });
      excelData.push({ "No": "Pemasukan", "Nama Produk": grandTotalPemasukan, "QTY": "", "PRICE": "" });
      
      // Pengeluaran (Non-Tunai / QR / Transfer) dihitung minus
      excelData.push({ "No": "Pengeluaran", "Nama Produk": "Pembayaran Transfer", "QTY": -totalTransfer, "PRICE": "" });
      excelData.push({ "No": "", "Nama Produk": "Pembayaran QR", "QTY": -totalQR, "PRICE": `TOTAL PENGELUARAN ${(-(totalTransfer + totalQR)).toLocaleString('id-ID')}` });
      
      const totalPenjualanBersih = grandTotalPemasukan - (totalTransfer + totalQR);
      excelData.push({ "No": "TOTAL PENJUALAN", "Nama Produk": totalPenjualanBersih, "QTY": "", "PRICE": "" });

      // Buat Worksheet
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // Atur Lebar Kolom
      worksheet['!cols'] = [
        { wch: 18 }, // No / Label
        { wch: 60 }, // Nama Produk
        { wch: 15 }, // QTY / Label Total Transaksi
        { wch: 25 }  // PRICE / Total Pengeluaran string
      ];

      // ==========================================
      // STYLING DENGAN xlsx-js-style
      // ==========================================
      const range = XLSX.utils.decode_range(worksheet['!ref']);
      const productCount = Object.keys(productStats).length;
      const summaryStart = productCount + 5;
      
      const borderAll = {
        top: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } }
      };

      for (let R = range.s.r; R <= range.e.r; ++R) {
        // Skip baris kosong sepenuhnya agar tidak ada kotak border
        if (R === productCount + 1 || R === productCount + 3 || R === productCount + 4) continue;

        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          // Pastikan semua sel pada baris aktif ada objeknya untuk diberi border
          if (!worksheet[cellAddress]) worksheet[cellAddress] = { t: 's', v: '' }; 
          
          const cell = worksheet[cellAddress];
          let font = null;
          let fill = null;
          let alignment = { vertical: "center" };
          let border = { ...borderAll };

          // 1. GAYA HEADER (Baris 0)
          if (R === 0) {
            font = { bold: true };
            fill = { fgColor: { rgb: "D9D9D9" } };
            alignment = { horizontal: "center", vertical: "center" };
          }
          // 2. GAYA PRODUK (Selang-seling / Zebra Striping)
          else if (R > 0 && R <= productCount) {
             if (R % 2 === 0) fill = { fgColor: { rgb: "EAEAEA" } }; // Baris genap abu darker 5%
             
             if (C === 0) alignment = { horizontal: "right", vertical: "center" }; // No
             else if (C === 1) alignment = { horizontal: "left", vertical: "center" }; // Nama Produk
             else alignment = { horizontal: "right", vertical: "center" }; // QTY, PRICE
          }
          // 3. GAYA BARIS TOTAL ITEM
          else if (R === productCount + 2) {
            fill = { fgColor: { rgb: "D9D9D9" } }; // Warna gelap seperti header
            if (C === 1) alignment = { horizontal: "left", vertical: "center" };
            else alignment = { horizontal: "right", vertical: "center" };
          }
          // 4. GAYA SUMMARY BAWAH
          else if (R >= summaryStart) {
             if (R === summaryStart + 5) font = { bold: true }; // TOTAL PENJUALAN
             if (cell.v && String(cell.v).includes("TOTAL PENGELUARAN")) font = { bold: true };
             
             if (R === summaryStart + 3 && C === 0) {
                 // Pengeluaran (Tengah vertikal & horizontal karena di-merge 2 baris)
                 alignment = { horizontal: "left", vertical: "center" };
             } else if (C === 0 || C === 1) {
                 alignment = { horizontal: "left", vertical: "center" }; 
             } else if (C === 2 || C === 3) {
                 alignment = { horizontal: "right", vertical: "center" };
             }
          }

          const style = { alignment, border };
          if (font) style.font = font;
          if (fill) style.fill = fill;
          
          cell.s = style;

          // Format angka ribuan (Accounting / Number format)
          if (typeof cell.v === 'number') {
             // Berikan format ribuan ke kolom PRICE, dan kolom B/C di ringkasan bawah (kecuali kuantitas kecil)
             if (C === 3 || (R >= summaryStart && C === 1 && R !== summaryStart + 1) || (R >= summaryStart && C === 2)) {
                 cell.z = '#,##0';
             }
          }
        }
      }

      // Terapkan Merge Cells untuk tabel bawah
      worksheet['!merges'] = [
        { s: { r: summaryStart + 3, c: 0 }, e: { r: summaryStart + 4, c: 0 } }  // Pengeluaran (Vertical Merge 2 baris)
      ];

      // Buat Workbook
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Harian");
      
      // Proses download manual dengan Blob
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
      
      // Bersihkan nama branch dari karakter aneh
      const safeBranchName = (selectedBranch || 'Cabang').replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `Laporan_Harian_${safeBranchName}_${getTodayDateStr()}.xlsx`;
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      
      // Sembunyikan elemen link
      link.style.display = 'none';
      document.body.appendChild(link);
      
      // Eksekusi klik
      link.click();
      
      // Hapus link dari DOM
      document.body.removeChild(link);
      
      // Beri jeda sebelum menghapus URL Blob agar Chrome tidak gagal membaca nama file
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 500);
      
    } catch (error) {
      console.error("Gagal export excel:", error);
      alert("Terjadi kesalahan saat memproses data Excel. " + error.message);
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem' }}>Memuat rekap hari ini...</div>;
  }

  const totalTunai = dailyTransactions.filter(tx => tx.payment_method === 'Tunai').reduce((s, tx) => s + Number(tx.total_amount), 0);
  const totalNonTunai = dailyTransactions.filter(tx => tx.payment_method !== 'Tunai').reduce((s, tx) => s + Number(tx.total_amount), 0);

  return (
    <div className="animate-fade-in pos-root" style={{ paddingBottom: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <div className="no-print" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
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
      {tutupKasirTx && (
        <div style={{ padding: '1.5rem', backgroundColor: tutupKasirTx.details[0].discrepancy === 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${tutupKasirTx.details[0].discrepancy === 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: '12px', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ color: tutupKasirTx.details[0].discrepancy === 0 ? 'var(--primary)' : '#ef4444', marginBottom: '0.25rem', fontSize: '1.1rem' }}>
              Status Shift: Ditutup ({new Date(tutupKasirTx.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })})
            </h3>
            <p className="text-muted" style={{ fontSize: '0.9rem' }}>
              Fisik Laci: <b>Rp {Number(tutupKasirTx.details[0].actualCash).toLocaleString('id-ID')}</b> | 
              Sistem: Rp {Number(tutupKasirTx.details[0].expectedCash).toLocaleString('id-ID')}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '0.25rem' }}>Selisih</p>
            <p style={{ fontSize: '1.25rem', fontWeight: 800, color: tutupKasirTx.details[0].discrepancy === 0 ? 'var(--primary)' : '#ef4444' }}>
              {tutupKasirTx.details[0].discrepancy > 0 ? '+' : ''}Rp {Number(tutupKasirTx.details[0].discrepancy).toLocaleString('id-ID')}
            </p>
          </div>
        </div>
      )}

      <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
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

      <div className="glass-panel no-print" style={{ padding: '1.5rem' }}>
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
                        cashier: tx.staff_name || userData?.name || 'Kasir',
                        branch: tx.branch_name === 'Pusat' ? 'Jalan Raya Kuta' : tx.branch_name
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
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
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
              fontSize: '11px',
              padding: '5px',
              width: '100%',
              lineHeight: '1.2',
            }}>
              <div style={{ textAlign: 'center', marginBottom: '4px' }}>
                <img src="/logo.png" alt="Logo" style={{ width: '100px', marginBottom: '2px' }} />
                <div style={{ fontSize: '9px' }}>
                  Cabang: {selectedTransaction.branch}
                </div>
              </div>
              <div style={{ borderBottom: '1px dashed black', margin: '4px 0' }}></div>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '5px' }}>
                  <tbody>
                    <tr>
                      <td style={{ paddingBottom: '2px' }}>Tanggal</td>
                      <td style={{ paddingBottom: '2px', textAlign: 'right' }}>: {new Date(selectedTransaction.date).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    </tr>
                    <tr>
                      <td style={{ paddingBottom: '2px' }}>Trx</td>
                      <td style={{ paddingBottom: '2px', textAlign: 'right' }}>: {selectedTransaction.paymentMethod.toUpperCase()}</td>
                    </tr>
                    <tr>
                      <td style={{ paddingBottom: '2px' }}>Kasir</td>
                      <td style={{ paddingBottom: '2px', textAlign: 'right' }}>: {selectedTransaction.cashier}</td>
                    </tr>
                  </tbody>
                </table>

              <div style={{ borderBottom: '1px dashed black', margin: '4px 0' }}></div>

              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginBottom: '2px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px dashed black' }}>
                    <th style={{ paddingBottom: '2px', fontWeight: 'normal' }}>Produk</th>
                    <th style={{ paddingBottom: '2px', textAlign: 'right', fontWeight: 'normal' }}>Harga</th>
                    <th style={{ paddingBottom: '2px', textAlign: 'center', fontWeight: 'normal' }}>Qty</th>
                    <th style={{ paddingBottom: '2px', textAlign: 'right', fontWeight: 'normal' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedTransaction.items.map((item, i) => (
                    <React.Fragment key={i}>
                      <tr>
                        <td colSpan={4} style={{ paddingTop: '4px', fontWeight: 'bold' }}>
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

              <div style={{ borderBottom: '1px dashed black', margin: '4px 0' }}></div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2px', lineHeight: '1' }}>
                <span style={{ marginRight: '10px' }}>Sub :</span>
                <span style={{ minWidth: '70px', textAlign: 'right' }}>{(selectedTransaction.total).toLocaleString('id-ID')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2px', lineHeight: '1' }}>
                <span style={{ marginRight: '10px' }}>Total :</span>
                <span style={{ minWidth: '70px', textAlign: 'right' }}>{(selectedTransaction.total).toLocaleString('id-ID')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px', lineHeight: '1' }}>
                <span style={{ marginRight: '10px' }}>Bayar :</span>
                <span style={{ minWidth: '70px', textAlign: 'right' }}>{(selectedTransaction.total).toLocaleString('id-ID')}</span>
              </div>

              <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '10px' }}>
                Ket: Lunas
              </div>

              <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '9px' }}>
                TERIMA KASIH<br />
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
