import React from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { Settings, Check, X, AlertTriangle } from 'lucide-react';

export default function AdminSettings() {
  const { isMultiBranch, toggleMultiBranch, loadingSettings } = useSettings();
  const [saving, setSaving] = React.useState(false);

  const handleToggle = async (value) => {
    setSaving(true);
    await toggleMultiBranch(value);
    setSaving(false);
  };

  if (loadingSettings) return <div className="p-8 text-center text-muted">Memuat pengaturan...</div>;

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-primary mb-1">Pengaturan Sistem</h1>
        <p className="text-muted">Konfigurasi pengaturan utama aplikasi kasir.</p>
      </div>

      <div className="glass-panel" style={{ padding: '2rem', maxWidth: '800px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ 
            backgroundColor: 'rgba(16, 185, 129, 0.1)', 
            color: 'var(--primary)', 
            padding: '1rem', 
            borderRadius: '12px' 
          }}>
            <Settings size={28} />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', fontWeight: 700 }}>Mode Multi-Cabang</h2>
            <p className="text-muted" style={{ fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '1.5rem' }}>
              Secara default, aplikasi berjalan dalam mode <b>Cabang Tunggal (Pusat)</b> yang menyederhanakan tampilan untuk UMKM.
              Jika usaha Anda memiliki lebih dari 1 cabang dan memerlukan pemisahan stok/laporan per cabang, silakan aktifkan mode ini.
            </p>

            <div style={{ 
              display: 'flex', 
              gap: '1rem', 
              backgroundColor: 'rgba(0,0,0,0.02)', 
              padding: '1rem', 
              borderRadius: '12px',
              border: '1px solid var(--border-color)'
            }}>
              <button 
                disabled={saving || !isMultiBranch}
                onClick={() => handleToggle(false)}
                style={{
                  flex: 1, padding: '1rem', borderRadius: '8px', fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  border: isMultiBranch ? '1px solid var(--border-color)' : '2px solid var(--primary)',
                  backgroundColor: isMultiBranch ? 'transparent' : 'rgba(16,185,129,0.05)',
                  color: isMultiBranch ? 'var(--text-muted)' : 'var(--primary)',
                  cursor: isMultiBranch ? 'pointer' : 'default',
                  opacity: saving ? 0.5 : 1
                }}
              >
                {!isMultiBranch && <Check size={18} />} Cabang Tunggal (Pusat)
              </button>
              <button 
                disabled={saving || isMultiBranch}
                onClick={() => handleToggle(true)}
                style={{
                  flex: 1, padding: '1rem', borderRadius: '8px', fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  border: !isMultiBranch ? '1px solid var(--border-color)' : '2px solid var(--primary)',
                  backgroundColor: !isMultiBranch ? 'transparent' : 'rgba(16,185,129,0.05)',
                  color: !isMultiBranch ? 'var(--text-muted)' : 'var(--primary)',
                  cursor: !isMultiBranch ? 'pointer' : 'default',
                  opacity: saving ? 0.5 : 1
                }}
              >
                {isMultiBranch && <Check size={18} />} Aktifkan Multi-Cabang
              </button>
            </div>
            
            {isMultiBranch && (
              <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.05)', borderRadius: '8px', borderLeft: '4px solid #ef4444' }}>
                <p style={{ fontSize: '0.85rem', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertTriangle size={16} /> Mode Multi-Cabang Aktif. Pilihan cabang kini muncul di menu Kasir, Riwayat, dan Inventaris.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
