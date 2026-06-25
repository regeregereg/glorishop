-- ============================================================================
-- MIGRATION: HARGA LAYANAN BERBEDA PER BARBER (OVERRIDE)
-- ============================================================================
-- Jalankan file ini di Supabase SQL Editor SETELAH schema.sql dan
-- migration_walkin_homeservice_commission.sql (butuh tabel staff & services).
-- Aman dijalankan ulang (idempotent).
--
-- RINGKASAN:
-- Defaultnya semua barber pakai harga dasar di tabel services (price /
-- price_min / price_max). Admin BISA mengisi harga khusus untuk kombinasi
-- layanan + barber tertentu lewat tabel baru di bawah — kalau diisi, harga
-- itu yang dipakai untuk barber tersebut; kalau tidak diisi (atau pelanggan
-- pilih "Tanpa Preferensi"), tetap fallback ke harga dasar layanan.
--
-- Bentuk override MENGIKUTI tipe harga layanan aslinya:
-- - Layanan harga tetap (services.price terisi)      -> override pakai price
-- - Layanan harga range (services.price_min/max)      -> override pakai price_min/max
-- Tidak boleh dicampur (satu baris override hanya mengisi salah satu bentuk,
-- divalidasi di kode aplikasi, bukan di constraint DB, supaya pesan errornya
-- bisa lebih ramah ke admin).

create table if not exists public.service_barber_prices (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  barber_id uuid not null references public.staff(id) on delete cascade,
  price numeric(12,0),       -- override harga tetap
  price_min numeric(12,0),   -- override harga range (batas bawah)
  price_max numeric(12,0),   -- override harga range (batas atas)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_id, barber_id)
);

create index if not exists idx_service_barber_prices_service
  on public.service_barber_prices(service_id);
create index if not exists idx_service_barber_prices_barber
  on public.service_barber_prices(barber_id);

comment on table public.service_barber_prices is
  'Override harga per kombinasi layanan+barber. Baris yang tidak ada / kolom yang null = fallback ke harga dasar di tabel services.';

drop trigger if exists trg_service_barber_prices_updated_at on public.service_barber_prices;
create trigger trg_service_barber_prices_updated_at
  before update on public.service_barber_prices
  for each row execute function public.set_updated_at();

alter table public.service_barber_prices enable row level security;

-- Perlu dibaca publik: halaman booking pelanggan harus tahu harga yang
-- benar SEBELUM submit (begitu barber spesifik dipilih), bukan baru tahu
-- setelah submit. Tidak ada data sensitif di tabel ini (cuma angka harga).
drop policy if exists "public read service_barber_prices" on public.service_barber_prices;
create policy "public read service_barber_prices" on public.service_barber_prices
  for select using (true);

-- Insert/update/delete tetap hanya lewat service_role (server-side, endpoint
-- admin) — tidak ada policy tambahan untuk itu, sama seperti tabel lain.

-- ============================================================================
-- Catatan untuk developer:
-- - Resolusi harga efektif (dasar vs override) dilakukan di kode aplikasi,
--   lihat src/lib/pricing.ts (fungsi getEffectivePrice / getEffectivePrices).
-- - Snapshot harga di booking_services (service_price/min/max) TETAP memakai
--   pola yang sudah ada (lihat migration_multi_service.sql) — hanya SUMBER
--   harga yang disnapshot yang berubah (dari getEffectivePrice, bukan
--   langsung dari kolom services). Histori booking lama, perhitungan
--   komisi, dan payment tidak perlu disentuh karena semuanya sudah membaca
--   dari snapshot ini, bukan dari tabel services secara langsung.
-- - "Tanpa Preferensi" (barber belum dipilih) -> selalu pakai harga dasar
--   layanan, TIDAK PERNAH pakai salah satu harga override barber tertentu.
-- ============================================================================
