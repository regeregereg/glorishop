-- ============================================================================
-- MIGRATION: BANNER PROMO / EVENT (carousel di Home)
-- ============================================================================
-- Jalankan file ini di Supabase SQL Editor SETELAH schema.sql.
-- Aman dijalankan ulang (idempotent).
--
-- RINGKASAN ALUR:
-- 1. Admin upload gambar banner (rasio 2:1, disarankan 1080x540px) lewat
--    halaman admin "Banner Promo".
-- 2. Banner yang is_active = true tampil sebagai carousel di Home, urutan
--    sesuai sort_order (kecil ke besar).
-- 3. Banner murni gambar statis — tidak bisa diklik/diarahkan ke link
--    apa pun, sesuai keputusan desain saat ini.

create table if not exists public.banners (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  -- Path file di Supabase Storage (bucket "photos", folder "banner"),
  -- disimpan supaya gambar lama bisa dihapus dari storage saat banner
  -- dihapus/diganti — pola yang sama dengan foto barber/layanan/produk.
  image_path text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_banners_active_sort
  on public.banners(is_active, sort_order);

-- Row Level Security: tidak ada policy publik, semua akses lewat
-- service_role di server (API routes /api/banners/*), konsisten dengan
-- pola tabel lain di project ini.
alter table public.banners enable row level security;
