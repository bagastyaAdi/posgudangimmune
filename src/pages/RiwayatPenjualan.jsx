import React, { useState, useEffect } from 'react';
import { Calendar, Filter, Trash2, AlertCircle, Eye, X, Receipt, Download } from 'lucide-react';
import { supabase } from '../supabase';
import { useSettings } from '../contexts/SettingsContext';
import { format, parseISO, differenceInDays } from 'date-fns';
import { id } from 'date-fns/locale';
import * as XLSX from 'xlsx-js-style';

const formatDateTime = (dateStr) => {
  if (!dateStr) return '';
  try {
    return format(parseISO(dateStr), 'dd MMM yyyy, HH:mm', { locale: id });
  } catch (e) {
    return dateStr;
  }
};

export default function AdminPOS() {
  const { isMultiBranch } = useSettings();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterBranch, setFilterBranch] = useState('');
  const [branches, setBranches] = useState([]);
  const [delModalOpen, setDelModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);
  const [saving, setSaving] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [detailRecord, setDetailRecord] = useState(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: bData } = await supabase.from('outlets').select('name');
      if (bData) setBranches(bData);
      const { data: txData, error } = await supabase.from('transactions').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setTransactions(txData || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredData = () => transactions.filter(r => {
    const rDate = r.created_at.split('T')[0];
    const matchBranch = filterBranch ? r.branch_name === filterBranch : true;
    const matchStart  = startDate ? rDate >= startDate : true;
    const matchEnd    = endDate   ? rDate <= endDate   : true;
    return matchBranch && matchStart && matchEnd;
  });

  const handleDelete = (tx) => {
    setSelectedTx(tx);
    setDelModalOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const confirmDelete = async () => {
    if (!selectedTx) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.from('transactions').delete().eq('id', selectedTx.id).select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Penghapusan diblokir oleh sistem database (RLS).');
      
      setTransactions(prev => prev.filter(r => r.id !== selectedTx.id));
      if (detailRecord?.id === selectedTx.id) setDetailRecord(null);
      
      setDelModalOpen(false);
      setSelectedTx(null);
      alert('Transaksi berhasil dihapus.');
    } catch (err) {
      alert('Gagal menghapus transaksi:\n' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const displayRecords = getFilteredData();

  const handleExportExcel = () => {
    if (!startDate || !endDate) {
      alert("Harap pilih Tanggal Mulai dan Tanggal Akhir terlebih dahulu sebelum mengekspor.");
      return;
    }
    if (differenceInDays(parseISO(endDate), parseISO(startDate)) > 30) {
      alert("Rentang waktu maksimal untuk laporan ini adalah 30 hari. Silakan sesuaikan tanggal Anda.");
      return;
    }
    if (displayRecords.length === 0) {
      alert("Tidak ada data transaksi untuk diekspor pada rentang waktu ini.");
      return;
    }

    const workbook = XLSX.utils.book_new();

    // Mengelompokkan transaksi per tanggal
    const dailyTxMap = {};
    displayRecords.forEach(tx => {
      const dateStr = tx.created_at.split('T')[0];
      if (!dailyTxMap[dateStr]) dailyTxMap[dateStr] = [];
      dailyTxMap[dateStr].push(tx);
    });

    const sortedDates = Object.keys(dailyTxMap).sort();

    // ==========================================
    // 1. SHEET RESUME PENJUALAN
    // ==========================================
    const resumeData = [];
    let globalTotalTrans = 0;
    let globalTotalCup = 0;
    let globalTotalPemasukan = 0;
    let globalTotalNonTunai = 0;

    // Untuk tabel grafik
    const tableGrafik = [];

    sortedDates.forEach(dateStr => {
      const txs = dailyTxMap[dateStr];
      let dailyTrans = 0, dailyCup = 0, dailyPemasukan = 0, dailyNonTunai = 0;

      txs.forEach(tx => {
        if (tx.payment_method === 'Modal Awal' || tx.payment_method === 'Tutup Kasir') return;
        
        dailyTrans++;
        
        const txTotal = Number(tx.total_amount) || 0;
        dailyPemasukan += txTotal;
        if (tx.payment_method === 'QRIS' || tx.payment_method === 'Transfer') {
          dailyNonTunai += txTotal;
        }

        let produkArray = tx.details || [];
        if (typeof produkArray === 'string') {
          try { produkArray = JSON.parse(produkArray); } catch(e) {}
        }
        if (Array.isArray(produkArray)) {
          produkArray.forEach(p => dailyCup += (Number(p.qty) || 0));
        }
      });

      const formattedDate = format(parseISO(dateStr), 'dd MMM yyyy', { locale: id });
      
      tableGrafik.push({
        "Tanggal": formattedDate,
        "Total Transaksi": dailyTrans,
        "Total Produk (Item)": dailyCup,
        "Pendapatan Kotor": dailyPemasukan,
        "Pembayaran QR/Transfer": dailyNonTunai,
        "Uang Tunai Bersih": dailyPemasukan - dailyNonTunai
      });

      globalTotalTrans += dailyTrans;
      globalTotalCup += dailyCup;
      globalTotalPemasukan += dailyPemasukan;
      globalTotalNonTunai += dailyNonTunai;
    });

    resumeData.push({ "Tanggal": "LAPORAN RESUME PENJUALAN", "Total Transaksi": "", "Total Produk (Item)": "", "Pendapatan Kotor": "", "Pembayaran QR/Transfer": "", "Uang Tunai Bersih": "" });
    resumeData.push({ "Tanggal": `Rentang: ${format(parseISO(startDate), 'dd MMM yyyy', { locale: id })} - ${format(parseISO(endDate), 'dd MMM yyyy', { locale: id })}`, "Total Transaksi": "", "Total Produk (Item)": "", "Pendapatan Kotor": "", "Pembayaran QR/Transfer": "", "Uang Tunai Bersih": "" });
    if (filterBranch) resumeData.push({ "Tanggal": `Cabang: ${filterBranch}`, "Total Transaksi": "", "Total Produk (Item)": "", "Pendapatan Kotor": "", "Pembayaran QR/Transfer": "", "Uang Tunai Bersih": "" });
    resumeData.push({});
    resumeData.push({ "Tanggal": "Tabel Rekapitulasi Harian (Sorot/Block data di bawah ini lalu klik 'Insert > Chart' di Excel untuk membuat Grafik Otomatis):", "Total Transaksi": "", "Total Produk (Item)": "", "Pendapatan Kotor": "", "Pembayaran QR/Transfer": "", "Uang Tunai Bersih": "" });
    resumeData.push({});

    tableGrafik.forEach(row => resumeData.push(row));

    resumeData.push({});
    resumeData.push({
      "Tanggal": "TOTAL KESELURUHAN",
      "Total Transaksi": globalTotalTrans,
      "Total Produk (Item)": globalTotalCup,
      "Pendapatan Kotor": globalTotalPemasukan,
      "Pembayaran QR/Transfer": globalTotalNonTunai,
      "Uang Tunai Bersih": globalTotalPemasukan - globalTotalNonTunai
    });

    const resumeWs = XLSX.utils.json_to_sheet(resumeData);
    
    // Resume WS Styling
    resumeWs['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 22 }, { wch: 20 }];
    const resumeRange = XLSX.utils.decode_range(resumeWs['!ref']);
    for (let R = resumeRange.s.r; R <= resumeRange.e.r; ++R) {
      for (let C = resumeRange.s.c; C <= resumeRange.e.c; ++C) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        if (!resumeWs[addr]) continue;
        
        let cell = resumeWs[addr];
        let font = null;
        let alignment = { vertical: "center" };
        let border = null;

        // Bold headers and totals
        if (R === 0 || R === 1 || R === 6 || R === resumeRange.e.r) font = { bold: true };
        
        // Alignment
        if (C > 0 && R >= 7) alignment = { horizontal: "right", vertical: "center" };
        
        // Number format
        if (typeof cell.v === 'number' && C >= 3) cell.z = '#,##0';

        // Border for table
        if (R >= 6 && R <= resumeRange.e.r && cell.v !== undefined) {
           border = {
             top: { style: "thin", color: { rgb: "000000" } },
             bottom: { style: "thin", color: { rgb: "000000" } },
             left: { style: "thin", color: { rgb: "000000" } },
             right: { style: "thin", color: { rgb: "000000" } }
           };
        }

        const style = { alignment };
        if (font) style.font = font;
        if (border) style.border = border;
        cell.s = style;
      }
    }
    
    XLSX.utils.book_append_sheet(workbook, resumeWs, "Resume Penjualan");

    // ==========================================
    // 2. SHEET HARIAN (1 Tab per Hari)
    // ==========================================
    sortedDates.forEach(dateStr => {
      const dailyTransactions = dailyTxMap[dateStr];
      const productStats = {};
      let grandTotalCup = 0, grandTotalPemasukan = 0;
      let totalQR = 0, totalTransfer = 0, totalTransaksi = 0, modalAwal = 0;

      dailyTransactions.forEach(tx => {
        const txTotal = Number(tx.total_amount) || 0;
        if (tx.payment_method === 'Modal Awal') modalAwal += txTotal;
        if (tx.payment_method === 'Modal Awal' || tx.payment_method === 'Tutup Kasir') return;

        totalTransaksi++;
        
        if (tx.payment_method === 'QRIS') totalQR += txTotal;
        else if (tx.payment_method === 'Transfer') totalTransfer += txTotal;

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

          if (!productStats[displayName]) productStats[displayName] = { qty: 0, total: 0 };
          productStats[displayName].qty += qty;
          productStats[displayName].total += total;

          grandTotalCup += qty;
          grandTotalPemasukan += total;
        });
      });

      const excelData = [];
      let no = 1;

      Object.keys(productStats).sort().forEach(displayName => {
        const stats = productStats[displayName];
        excelData.push({ "No": no++, "Nama Produk": displayName, "QTY": stats.qty > 0 ? stats.qty : "", "PRICE": stats.total > 0 ? stats.total : "" });
      });

      excelData.push({}); 
      excelData.push({ "No": "", "Nama Produk": "TOTAL", "QTY": grandTotalCup, "PRICE": grandTotalPemasukan });
      excelData.push({});
      excelData.push({});

      excelData.push({ "No": "Cash Awal", "Nama Produk": modalAwal, "QTY": "", "PRICE": "" });
      excelData.push({ "No": "TOTAL Item", "Nama Produk": grandTotalCup, "QTY": "Total Transaksi", "PRICE": totalTransaksi });
      excelData.push({ "No": "Pemasukan", "Nama Produk": grandTotalPemasukan, "QTY": "", "PRICE": "" });
      
      excelData.push({ "No": "Pengeluaran", "Nama Produk": "Pembayaran Transfer", "QTY": -totalTransfer, "PRICE": "" });
      excelData.push({ "No": "", "Nama Produk": "Pembayaran QR", "QTY": -totalQR, "PRICE": `TOTAL PENGELUARAN ${(-(totalTransfer + totalQR)).toLocaleString('id-ID')}` });
      
      const totalPenjualanBersih = grandTotalPemasukan - (totalTransfer + totalQR);
      excelData.push({ "No": "TOTAL PENJUALAN", "Nama Produk": totalPenjualanBersih, "QTY": "", "PRICE": "" });

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      worksheet['!cols'] = [{ wch: 18 }, { wch: 60 }, { wch: 15 }, { wch: 25 }];

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
        if (R === productCount + 1 || R === productCount + 3 || R === productCount + 4) continue;
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          if (!worksheet[cellAddress]) worksheet[cellAddress] = { t: 's', v: '' }; 
          
          const cell = worksheet[cellAddress];
          let font = null;
          let fill = null;
          let alignment = { vertical: "center" };
          let border = { ...borderAll };

          if (R === 0) {
            font = { bold: true };
            fill = { fgColor: { rgb: "D9D9D9" } };
            alignment = { horizontal: "center", vertical: "center" };
          } else if (R > 0 && R <= productCount) {
             if (R % 2 === 0) fill = { fgColor: { rgb: "EAEAEA" } };
             if (C === 0) alignment = { horizontal: "right", vertical: "center" };
             else if (C === 1) alignment = { horizontal: "left", vertical: "center" };
             else alignment = { horizontal: "right", vertical: "center" };
          } else if (R === productCount + 2) {
            fill = { fgColor: { rgb: "D9D9D9" } };
            if (C === 1) alignment = { horizontal: "left", vertical: "center" };
            else alignment = { horizontal: "right", vertical: "center" };
          } else if (R >= summaryStart) {
             if (R === summaryStart + 5) font = { bold: true };
             if (cell.v && String(cell.v).includes("TOTAL PENGELUARAN")) font = { bold: true };
             
             if (R === summaryStart + 3 && C === 0) alignment = { horizontal: "left", vertical: "center" };
             else if (C === 0 || C === 1) alignment = { horizontal: "left", vertical: "center" }; 
             else if (C === 2 || C === 3) alignment = { horizontal: "right", vertical: "center" };
          }

          const style = { alignment, border };
          if (font) style.font = font;
          if (fill) style.fill = fill;
          cell.s = style;

          if (typeof cell.v === 'number') {
             if (C === 3 || (R >= summaryStart && C === 1 && R !== summaryStart + 1) || (R >= summaryStart && C === 2)) {
                 cell.z = '#,##0';
             }
          }
        }
      }

      worksheet['!merges'] = [
        { s: { r: summaryStart + 3, c: 0 }, e: { r: summaryStart + 4, c: 0 } }
      ];

      // Tab Excel title shouldn't be too long, e.g. "12 Jun 26"
      const tabName = format(parseISO(dateStr), 'dd MMM yy', { locale: id });
      XLSX.utils.book_append_sheet(workbook, worksheet, tabName);
    });

    let filename = 'Laporan_Penjualan';
    if (filterBranch) filename += `_${filterBranch}`;
    filename += `_${startDate}_sd_${endDate}.xlsx`;

    XLSX.writeFile(workbook, filename);
  };

  const groupedByDate = displayRecords.reduce((acc, record) => {
    const dateStr = record.created_at.split('T')[0];
    const key = `${dateStr}__${record.branch_name}`;
    if (!acc[key]) acc[key] = { date: dateStr, branch: record.branch_name, total: 0, transactions: [] };
    acc[key].transactions.push(record);
    acc[key].total += record.total_amount;
    return acc;
  }, {});

  const sortedGroups = Object.values(groupedByDate).sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date);
    return a.branch.localeCompare(b.branch);
  });

  // ── Detail Panel Renderer ──────────────────────────────────────
  const renderDetailPanel = () => {
    if (!detailRecord) return null;
    const r = detailRecord;
    const details = r.details || [];

    const paymentColor = 
      r.payment_method === 'Tunai' ? 'var(--primary)' : 
      r.payment_method === 'QRIS' ? '#3b82f6' : '#8b5cf6';

    return (
      <div className="glass-panel animate-fade-in" style={{ marginTop: '1.5rem', padding: '1.5rem', border: '2px solid rgba(16,185,129,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '0.25rem' }}>
              🧾 Detail Transaksi — {r.branch_name}
            </h2>
            <p className="text-muted" style={{ fontSize: '0.82rem' }}>
              📅 {formatDateTime(r.created_at)} &nbsp;|&nbsp; 👤 {r.staff_name} &nbsp;|&nbsp; 
              <strong style={{ color: paymentColor }}>💳 {r.payment_method}</strong>
            </p>
          </div>
          <button onClick={() => setDetailRecord(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ backgroundColor: 'rgba(9,108,70,0.06)', padding: '0.6rem 1rem', borderBottom: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--primary)' }}>🛒 Item Terjual</h3>
          </div>

          {details.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center' }}>
              <p className="text-muted" style={{ fontSize: '0.85rem' }}>Tidak ada rincian item.</p>
            </div>
          ) : (
            details.map((item, idx) => {
              const isLast = idx === details.length - 1;
              const isStandar = !item.variant || item.variant === 'Standar';
              const variantBg = item.variant === 'Ori' ? 'rgba(251,191,36,0.2)' : item.variant === 'Premi' ? 'rgba(99,102,241,0.15)' : 'rgba(236,72,153,0.15)';
              const variantText = item.variant === 'Ori' ? '#d97706' : item.variant === 'Premi' ? '#4f46e5' : '#ec4899';
              
              return (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', borderBottom: isLast ? 'none' : '1px dashed var(--border-color)', backgroundColor: 'white' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{item.name}</div>
                    {!isStandar && (
                      <span style={{ display: 'inline-block', marginTop: '0.2rem', padding: '0.12rem 0.45rem', borderRadius: '5px', fontSize: '0.7rem', fontWeight: 700, backgroundColor: variantBg, color: variantText }}>
                        {item.variant}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', minWidth: '80px' }}>
                    Rp {(item.price || 0).toLocaleString('id-ID')}
                  </span>
                  <span style={{ fontWeight: 800, fontSize: '1rem', minWidth: '30px', textAlign: 'center' }}>x{item.qty}</span>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--primary)', minWidth: '90px', textAlign: 'right' }}>
                    Rp {((item.qty || 0) * (item.price || 0)).toLocaleString('id-ID')}
                  </span>
                </div>
              );
            })
          )}
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem 1rem', backgroundColor: 'rgba(9,108,70,0.06)', borderTop: '2px solid rgba(16,185,129,0.3)' }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Total Transaksi</span>
            <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '1.2rem' }}>Rp {r.total_amount.toLocaleString('id-ID')}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-primary mb-1">Riwayat Penjualan (Per Transaksi)</h1>
          <p className="text-muted">Lihat rincian transaksi langsung dari seluruh cabang.</p>
        </div>
      </div>

      {delModalOpen && (
        <div className="glass-panel mb-6 animate-fade-in" style={{ border: '2px solid var(--danger)', padding: '1.5rem' }}>
          <h2 className="mb-4 text-danger" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertCircle color="var(--danger)" /> Konfirmasi Hapus Transaksi
          </h2>
          <p className="mb-4">
            Apakah Anda yakin ingin menghapus transaksi senilai <strong>Rp {selectedTx?.total_amount.toLocaleString('id-ID')}</strong> pada {formatDateTime(selectedTx?.created_at)}?
          </p>
          <div style={{ backgroundColor: 'rgba(239,68,68,0.1)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
            <p style={{ color: 'var(--danger)', fontSize: '0.85rem', fontWeight: 600 }}>
              ⚠ PERINGATAN: Penghapusan bersifat permanen dan tidak akan mengembalikan stok yang sudah terpotong.
            </p>
          </div>
          <div className="flex justify-between">
            <button disabled={saving} onClick={() => setDelModalOpen(false)} className="btn-secondary">Batal</button>
            <button onClick={confirmDelete} disabled={saving} className="btn-primary" style={{ backgroundColor: 'var(--danger)', borderColor: 'transparent' }}>
              {saving ? 'Menghapus...' : 'Ya, Hapus Permanen'}
            </button>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="glass-panel" style={{ padding: '1rem 1.5rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 auto', flexWrap: 'wrap' }}>
          <Calendar size={18} className="text-muted hidden-mobile" />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
            <input type="date" className="input-field" style={{ width: '100%', padding: '0.4rem 0.6rem' }} value={startDate} onChange={e => setStartDate(e.target.value)} />
            <span className="text-muted">s/d</span>
            <input type="date" className="input-field" style={{ width: '100%', padding: '0.4rem 0.6rem' }} value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flex: '1 1 auto' }}>
          {isMultiBranch && (
            <>
              <Filter size={18} className="text-muted hidden-mobile" />
              <select className="input-field" style={{ width: '100%', padding: '0.4rem 0.6rem' }} value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
                <option value="">Semua Cabang</option>
                {branches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
              </select>
            </>
          )}
          {(filterBranch || startDate || endDate) && (
            <button onClick={() => { setFilterBranch(''); setStartDate(''); setEndDate(''); }}
              style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600, flexShrink: 0 }}>
              Reset Filter
            </button>
          )}
          
          <button 
            onClick={handleExportExcel}
            className="btn-primary" 
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.85rem', marginLeft: 'auto' }}
          >
            <Download size={16} />
            Export Excel
          </button>
        </div>
      </div>

      {loading ? (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <p className="text-muted">Memuat riwayat transaksi...</p>
        </div>
      ) : sortedGroups.length === 0 ? (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <p className="text-muted">Belum ada transaksi.</p>
        </div>
      ) : sortedGroups.map(group => (
        <div key={`${group.date}__${group.branch}`} className="glass-panel animate-fade-in" style={{ marginBottom: '1.5rem', overflow: 'hidden', padding: 0 }}>
          {/* Group Header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '0.75rem 1.25rem', backgroundColor: 'rgba(9,108,70,0.06)', borderBottom: '1px solid var(--border-color)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Calendar size={16} style={{ color: 'var(--primary)' }} />
              <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--primary)' }}>{format(parseISO(group.date), 'dd MMMM yyyy', { locale: id })}</span>
              {isMultiBranch && <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>— {group.branch}</span>}
            </div>
            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary)' }}>
              Total: Rp {group.total.toLocaleString('id-ID')}
            </span>
          </div>

          {/* Transactions List */}
          <div>
            {group.transactions.map((tx, idx) => {
              const isActive = detailRecord?.id === tx.id;
              const paymentColor = tx.payment_method === 'Tunai' ? 'var(--primary)' : tx.payment_method === 'QRIS' ? '#3b82f6' : '#8b5cf6';
              
              return (
                <div key={tx.id} style={{
                  display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1.25rem',
                  borderBottom: idx < group.transactions.length - 1 ? '1px dashed var(--border-color)' : 'none',
                  backgroundColor: isActive ? 'rgba(16,185,129,0.05)' : 'white'
                }}>
                  <div style={{ width: '60px', flexShrink: 0, textAlign: 'center' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>{format(parseISO(tx.created_at), 'HH:mm')}</span>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{tx.staff_name}</span>
                    <span style={{ fontSize: '0.75rem', color: paymentColor, fontWeight: 600 }}>{tx.payment_method}</span>
                  </div>
                  <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.95rem', minWidth: '100px', textAlign: 'right' }}>
                    Rp {tx.total_amount.toLocaleString('id-ID')}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => setDetailRecord(isActive ? null : tx)} className="btn-secondary" style={{ padding: '0.4rem', backgroundColor: isActive ? 'var(--primary)' : undefined, color: isActive ? 'white' : 'var(--text-muted)' }} title="Lihat Detail">
                      <Eye size={16} />
                    </button>
                    <button onClick={() => handleDelete(tx)} className="btn-secondary" style={{ padding: '0.4rem', color: 'var(--danger)' }} title="Hapus">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {renderDetailPanel()}

    </div>
  );
}
