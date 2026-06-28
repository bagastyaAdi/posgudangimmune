import React, { useState } from 'react';
import { useSettings, IS_PREMIUM_UNLOCKED } from '../contexts/SettingsContext';
import { Settings, Check } from 'lucide-react';

export default function AdminSettings() {
  const { isMultiBranch, toggleMultiBranch, isTutupKasirEnabled, toggleTutupKasir, loadingSettings } = useSettings();
  const [saving, setSaving] = useState(false);

  const handleToggleMultiBranch = async (value) => {
    if (!IS_PREMIUM_UNLOCKED) {
      return; // Diam-diam tidak melakukan apa-apa (silent fail)
    }
    setSaving(true);
    await toggleMultiBranch(value);
    setSaving(false);
  };

  const handleToggleTutup = (value) => {
    if (!IS_PREMIUM_UNLOCKED) {
      return; // Diam-diam tidak melakukan apa-apa (silent fail)
    }
    toggleTutupKasir(value);
  };

  if (loadingSettings) return <div className="p-8 text-center text-muted">Memuat pengaturan...</div>;

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem' }}>
      <div className="mb-6">
        <h1 className="text-primary mb-1">Pengaturan Sistem</h1>
        <p className="text-muted">Konfigurasi pengaturan utama aplikasi kasir.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '800px' }}>
        
        {/* Toggle Multi Cabang */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.5rem' }}>
            <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--primary)', padding: '1rem', borderRadius: '12px' }}>
              <Settings size={28} />
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', fontWeight: 700 }}>Mode Multi-Cabang</h2>
              <p className="text-muted" style={{ fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '1.5rem' }}>
                Secara default, aplikasi berjalan dalam mode <b>Cabang Tunggal</b>. 
                Jika usaha Anda memiliki lebih dari 1 cabang dan memerlukan pemisahan stok/laporan per cabang, silakan aktifkan mode ini.
              </p>
              <div style={{ display: 'flex', gap: '1rem', backgroundColor: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <button 
                  disabled={saving || !isMultiBranch}
                  onClick={() => handleToggleMultiBranch(false)}
                  style={{
                    flex: 1, padding: '1rem', borderRadius: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    border: isMultiBranch ? '1px solid var(--border-color)' : '2px solid var(--primary)',
                    backgroundColor: isMultiBranch ? 'transparent' : 'rgba(16,185,129,0.05)', color: isMultiBranch ? 'var(--text-muted)' : 'var(--primary)',
                    cursor: 'pointer', opacity: saving ? 0.5 : 1
                  }}
                >
                  {!isMultiBranch && <Check size={18} />} Cabang Tunggal
                </button>
                <button 
                  disabled={saving || isMultiBranch}
                  onClick={() => handleToggleMultiBranch(true)}
                  style={{
                    flex: 1, padding: '1rem', borderRadius: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    border: !isMultiBranch ? '1px solid var(--border-color)' : '2px solid var(--primary)',
                    backgroundColor: !isMultiBranch ? 'transparent' : 'rgba(16,185,129,0.05)', color: !isMultiBranch ? 'var(--text-muted)' : 'var(--primary)',
                    cursor: 'pointer', opacity: saving ? 0.5 : 1
                  }}
                >
                  {isMultiBranch && <Check size={18} />} Aktifkan Multi-Cabang
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Toggle Tutup Kasir - HANYA MUNCUL JIKA PREMIUM UNLOCKED */}
        {IS_PREMIUM_UNLOCKED && (
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.5rem' }}>
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '1rem', borderRadius: '12px' }}>
                <Settings size={28} />
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', fontWeight: 700 }}>Fitur Tutup Kasir</h2>
                <p className="text-muted" style={{ fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '1.5rem' }}>
                  Mengaktifkan fitur rekonsiliasi akhir hari (tutup shift). Jika aktif, layar kasir akan mendeteksi Shift dan menampilkan tombol "Tutup Kasir" bagi pegawai.
                </p>
                <div style={{ display: 'flex', gap: '1rem', backgroundColor: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <button 
                    onClick={() => handleToggleTutup(false)}
                    style={{
                      flex: 1, padding: '1rem', borderRadius: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                      border: !isTutupKasirEnabled ? '1px solid var(--border-color)' : '2px solid #ef4444',
                      backgroundColor: !isTutupKasirEnabled ? 'transparent' : 'rgba(239,68,68,0.05)', color: !isTutupKasirEnabled ? 'var(--text-muted)' : '#ef4444',
                      cursor: 'pointer'
                    }}
                  >
                    {!isTutupKasirEnabled && <Check size={18} />} Nonaktifkan Fitur
                  </button>
                  <button 
                    onClick={() => handleToggleTutup(true)}
                    style={{
                      flex: 1, padding: '1rem', borderRadius: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                      border: isTutupKasirEnabled ? '1px solid var(--border-color)' : '2px solid #ef4444',
                      backgroundColor: isTutupKasirEnabled ? 'transparent' : 'rgba(239,68,68,0.05)', color: isTutupKasirEnabled ? 'var(--text-muted)' : '#ef4444',
                      cursor: 'pointer'
                    }}
                  >
                    {isTutupKasirEnabled && <Check size={18} />} Aktifkan Fitur (Direkomendasikan)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
