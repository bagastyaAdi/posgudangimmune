import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabase';
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function RiwayatKasir() {
  const { userData } = useAuth();
  const [dailyTransactions, setDailyTransactions] = useState([]);
  const [modalAwal, setModalAwal] = useState(0);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [loading, setLoading] = useState(true);

  const getTodayDateStr = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
  };

  useEffect(() => {
    if (userData) {
      const branch = userData.branch && userData.branch !== 'Seluruh Cabang' ? userData.branch : 'Pusat';
      setSelectedBranch(branch);
      
      const todayStr = getTodayDateStr();
      const storageKey = `pos_modal_${branch}_${todayStr}`;
      const storedModal = localStorage.getItem(storageKey);
      if (storedModal) setModalAwal(parseInt(storedModal, 10));
      
      fetchDailyTransactions(branch);
    }
  }, [userData]);

  const fetchDailyTransactions = async (branchName) => {
    try {
      setLoading(true);
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
      const staffName = tx.staff_name || userData?.name || 'Unknown';
      const payment = tx.payment_method || '-';
      const totalAmount = tx.total_amount || 0;
      
      const produkArray = tx.details || [];
      
      if (produkArray.length === 0) {
        excelData.push({
          "Tanggal": date,
          "Waktu": time,
          "Nama Kasir": staffName,
          "Metode Pembayaran": payment,
          "Produk Terjual": "-",
          "Qty Item": 0,
          "Total Penjualan (Rp)": totalAmount
        });
      } else {
        produkArray.forEach((p, index) => {
          excelData.push({
            "Tanggal": index === 0 ? date : "",
            "Waktu": index === 0 ? time : "",
            "Nama Kasir": index === 0 ? staffName : "",
            "Metode Pembayaran": index === 0 ? payment : "",
            "Produk Terjual": `${p.name}${p.variant ? ` (${p.variant})` : ''}`,
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
      { wch: 20 }, // Nama Kasir
      { wch: 20 }, // Metode Pembayaran
      { wch: 60 }, // Produk Terjual (dibuat lebar)
      { wch: 15 }, // Total Qty
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
          <p className="text-muted" style={{ fontSize: '0.9rem' }}>Menampilkan riwayat transaksi dan rincian kas di laci hari ini.</p>
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
         <div style={{ padding: '1.25rem', backgroundColor: 'var(--primary)', color: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(16,185,129,0.2)' }}>
            <p style={{ fontSize: '0.85rem', opacity: 0.9, marginBottom: '0.25rem' }}>Total Kas di Laci</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>Rp {(modalAwal + totalTunai).toLocaleString('id-ID')}</p>
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
                 <span style={{ fontSize: '0.85rem', padding: '0.3rem 0.8rem', borderRadius: '20px', backgroundColor: tx.payment_method === 'Tunai' ? 'rgba(16,185,129,0.1)' : 'rgba(59,130,246,0.1)', color: tx.payment_method === 'Tunai' ? 'var(--primary)' : '#3b82f6', fontWeight: 600 }}>
                   {tx.payment_method === 'Tunai' ? '+ Tunai' : '- Non-Tunai'}
                 </span>
               </div>
             ))}
           </div>
        )}
      </div>
    </div>
  );
}
