import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../supabase';

const SettingsContext = createContext();

export function useSettings() {
  return useContext(SettingsContext);
}

export function SettingsProvider({ children }) {
  const [isMultiBranch, setIsMultiBranch] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('is_multi_branch')
        .eq('id', 1)
        .single();
        
      if (!error && data) {
        setIsMultiBranch(data.is_multi_branch);
      }
    } catch (err) {
      console.error("Failed to load settings", err);
    } finally {
      setLoadingSettings(false);
    }
  };

  const toggleMultiBranch = async (newValue) => {
    try {
      const { error } = await supabase
        .from('app_settings')
        .update({ is_multi_branch: newValue })
        .eq('id', 1);
        
      if (error) throw error;
      setIsMultiBranch(newValue);
      return true;
    } catch (err) {
      console.error("Failed to update setting", err);
      return false;
    }
  };

  const value = {
    isMultiBranch,
    toggleMultiBranch,
    loadingSettings
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}
