-- ============================================================================
-- MIGRATION: PORTOFOLIO HASIL CUKUR PER BARBER
-- ============================================================================
-- Jalankan file ini di Supabase SQL Editor SETELAH schema.sql.
-- Aman dijalankan ulang (idempotent).
--
-- RINGKASAN ALUR:
-- 1. Admin (hanya admin) upload foto hasil kerja seorang barber lewat
--    dashboard admin (halaman Kelola Barber).
-- 2. Foto disimpan sebagai galeri polos (tanpa tag layanan), diurutkan
--    pakai sort_order, terbaru ditambah di akhir secara default.
-- 3. Pelanggan klik barber di Home -> masuk ke halaman profil barber
--    (/barber/[id]) yang publik, lihat bio + galeri portofolio + rating,
--    baru kemudian klik "Booking dengan [Nama]" untuk lanjut ke alur
--    booking yang sudah ada.

-- 1. TABEL: barber_portfolios -------------------------------------------------
create table if not exists public.barber_portfolios (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.staff(id) on delete cascade,
  photo_url text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_barber_portfolios_barber
  on public.barber_portfolios(barber_id, sort_order);

-- 2. ROW LEVEL SECURITY --------------------------------------------------------
alter table public.barber_portfolios enable row level security;

-- Siapa pun (termasuk anon) boleh membaca portofolio milik barber yang aktif,
-- supaya halaman profil barber bisa diakses publik tanpa login.
drop policy if exists "public read barber portfolios" on public.barber_portfolios;
create policy "public read barber portfolios" on public.barber_portfolios
  for select using (
    exists (
      select 1 from public.staff s
      where s.id = barber_portfolios.barber_id
        and s.role = 'barber'
        and s.is_active = true
    )
  );

-- Insert/update/delete TIDAK ada policy untuk anon/authenticated -> hanya bisa
-- lewat service_role di server (API /api/barbers/[id]/portfolio), yang sudah
-- mengecek sesi admin terlebih dahulu. Konsisten dengan pola tabel lain.
