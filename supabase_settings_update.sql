-- =========================================================================
-- Skrip Update: Tabel app_settings
-- Jalankan skrip ini di SQL Editor Supabase Anda
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.app_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    is_multi_branch BOOLEAN DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert nilai default (single branch)
INSERT INTO public.app_settings (id, is_multi_branch) 
VALUES (1, false) 
ON CONFLICT (id) DO NOTHING;

-- RLS & Permissions
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Karena ini pengaturan global, izinkan semua (authenticated & anon) untuk membacanya
CREATE POLICY "Enable read for all" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Enable update for all" ON public.app_settings FOR UPDATE USING (true) WITH CHECK (true);

GRANT SELECT, UPDATE ON public.app_settings TO anon, authenticated;
