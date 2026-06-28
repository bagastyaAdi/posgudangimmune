import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../supabase';

// MASTER SWITCH: UBAH MENJADI `true` JIKA KLIEN SUDAH BAYAR LUNAS!
export const IS_PREMIUM_UNLOCKED = false; 

const SettingsContext = createContext();

export function useSettings() {
  return useContext(SettingsContext);
}

export function SettingsProvider({ children }) {
  const [isMultiBranch, setIsMultiBranch] = useState(() => {
    return IS_PREMIUM_UNLOCKED && localStorage.getItem('is_multi_branch') === 'true';
  });
  const [isTutupKasirEnabled, setIsTutupKasirEnabled] = useState(() => {
    return IS_PREMIUM_UNLOCKED && localStorage.getItem('is_tutup_kasir_enabled') !== 'false';
  });
  const [loadingSettings, setLoadingSettings] = useState(false);

  // Tidak lagi menggunakan Supabase karena tabel app_settings tidak ditemukan
  useEffect(() => {
    // Kosong, karena kita pakai localStorage langsung
  }, []);

  const toggleMultiBranch = async (newValue) => {
    localStorage.setItem('is_multi_branch', newValue ? 'true' : 'false');
    setIsMultiBranch(newValue);
    return true;
  };

  const toggleTutupKasir = (newValue) => {
    localStorage.setItem('is_tutup_kasir_enabled', newValue);
    setIsTutupKasirEnabled(newValue);
  };

  const value = {
    isMultiBranch,
    toggleMultiBranch,
    isTutupKasirEnabled,
    toggleTutupKasir,
    loadingSettings
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}
