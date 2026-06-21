-- =========================================================================
-- Skrip Pembuatan Tabel Supabase Gudang Immune POS
-- Jalankan skrip ini di SQL Editor Supabase Anda
-- =========================================================================

-- 1. Tabel users
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    name TEXT NOT NULL,
    branch TEXT,
    role TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL
);

-- 2. Tabel outlets
CREATE TABLE IF NOT EXISTS public.outlets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    name TEXT UNIQUE NOT NULL,
    address TEXT
);

-- 3. Tabel products
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    name TEXT NOT NULL,
    variant TEXT,
    category TEXT,
    price NUMERIC DEFAULT 0,
    image_url TEXT,
    display_order INTEGER DEFAULT 0
);

-- 4. Tabel operational_items
CREATE TABLE IF NOT EXISTS public.operational_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    name TEXT NOT NULL,
    category TEXT,
    display_order INTEGER DEFAULT 0
);

-- 5. Tabel branch_inventory (Inventaris per cabang)
CREATE TABLE IF NOT EXISTS public.branch_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_name TEXT NOT NULL,
    item_name TEXT NOT NULL,
    current_qty NUMERIC DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (branch_name, item_name)
);

-- 6. Tabel stock_restock_log (Riwayat aktivitas stok)
CREATE TABLE IF NOT EXISTS public.stock_restock_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    branch_name TEXT NOT NULL,
    item_name TEXT NOT NULL,
    qty_added NUMERIC NOT NULL,
    qty_before NUMERIC DEFAULT 0,
    qty_after NUMERIC DEFAULT 0,
    petugas_name TEXT NOT NULL
);

-- 7. Tabel transactions (Riwayat Penjualan Per-Transaksi)
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    branch_name TEXT NOT NULL,
    staff_name TEXT NOT NULL,
    total_amount NUMERIC DEFAULT 0,
    payment_method TEXT NOT NULL,
    details JSONB DEFAULT '[]'::JSONB
);

-- 8. Tabel stock_distributions
CREATE TABLE IF NOT EXISTS public.stock_distributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    branch_name TEXT NOT NULL,
    date DATE NOT NULL,
    items JSONB DEFAULT '[]'::JSONB,
    status TEXT DEFAULT 'pending'
);

-- =========================================================================
-- Beri Hak Akses Penuh (Agar bisa diakses client-side untuk testing)
-- =========================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_restock_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_distributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for users" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for outlets" ON public.outlets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for products" ON public.products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for operational_items" ON public.operational_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for branch_inventory" ON public.branch_inventory FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for stock_restock_log" ON public.stock_restock_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for transactions" ON public.transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for stock_distributions" ON public.stock_distributions FOR ALL USING (true) WITH CHECK (true);
