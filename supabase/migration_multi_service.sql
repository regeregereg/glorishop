-- ============================================================================
-- MIGRATION: BOOKING MULTI-LAYANAN (pilih beberapa layanan sekaligus)
-- ============================================================================
-- Jalankan file ini di Supabase SQL Editor SETELAH schema.sql dan
-- migration_payment.sql. Aman dijalankan ulang (idempotent).
--
-- RINGKASAN PERUBAHAN:
-- Sebelumnya 1 booking hanya bisa punya 1 layanan (bookings.service_id).
-- Sekarang 1 booking bisa punya BEBERAPA layanan sekaligus (mis. Haircut +
-- Creambath dalam satu janji temu), lewat tabel relasi baru "booking_services".
--
-- bookings.service_id TETAP DIPERTAHANKAN (tidak dihapus) dan otomatis
-- disinkronkan ke layanan PERTAMA yang dipilih lewat trigger di bawah, supaya
-- kode lama yang masih membaca booking.service_id / booking.service (relasi
-- lama) tetap jalan tanpa perlu diubah satu per satu. Kode baru sebaiknya
-- membaca booking_services untuk dapat daftar layanan lengkap.
--
-- Total harga & durasi booking sekarang dihitung dari SEMUA layanan yang
-- dipilih (dijumlah), bukan cuma 1 layanan.

-- 1. TABEL: booking_services ---------------------------------------------------
create table if not exists public.booking_services (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete restrict,
  -- snapshot data layanan saat booking dibuat, supaya kalau harga/nama
  -- layanan diubah admin di kemudian hari, riwayat booking lama tidak ikut
  -- berubah (sama seperti payments.service_price pada migration_payment.sql)
  service_name text not null,
  service_price numeric(12,0),       -- harga tetap saat booking dibuat (snapshot)
  service_price_min numeric(12,0),   -- untuk layanan range, snapshot price_min
  service_price_max numeric(12,0),   -- untuk layanan range, snapshot price_max
  duration_minutes int not null default 30,
  -- harga final per layanan (dikonfirmasi barber satu-satu untuk layanan
  -- dengan range harga seperti Colour/Bleaching, sesuai keputusan bisnis)
  final_price numeric(12,0),
  sort_order int not null default 0, -- urutan tampil sesuai urutan dipilih pelanggan
  created_at timestamptz not null default now(),
  unique (booking_id, service_id)
);

create index if not exists idx_booking_services_booking on public.booking_services(booking_id);
create index if not exists idx_booking_services_service on public.booking_services(service_id);

-- 2. RLS -------------------------------------------------------------------
alter table public.booking_services enable row level security;
-- Tidak ada policy publik tambahan: semua akses lewat API route Next.js
-- dengan service_role key (server-side), sama seperti tabel bookings.

-- 3. TRIGGER: sinkronkan bookings.service_id ke layanan pertama -------------
-- Supaya kolom lama (bookings.service_id) tetap terisi otomatis dengan
-- layanan yang sort_order-nya paling kecil, untuk kompatibilitas mundur.
create or replace function public.sync_booking_primary_service()
returns trigger as $$
begin
  update public.bookings
    set service_id = (
      select bs.service_id
      from public.booking_services bs
      where bs.booking_id = coalesce(new.booking_id, old.booking_id)
      order by bs.sort_order asc, bs.created_at asc
      limit 1
    )
    where id = coalesce(new.booking_id, old.booking_id);
  return coalesce(new, old);
end;
$$ language plpgsql;

drop trigger if exists trg_sync_primary_service_ins on public.booking_services;
create trigger trg_sync_primary_service_ins
  after insert on public.booking_services
  for each row execute function public.sync_booking_primary_service();

drop trigger if exists trg_sync_primary_service_del on public.booking_services;
create trigger trg_sync_primary_service_del
  after delete on public.booking_services
  for each row execute function public.sync_booking_primary_service();

-- 4. BACKFILL: pindahkan data booking lama (service_id tunggal) ke tabel baru
-- supaya booking yang sudah ada sebelum migration ini tetap muncul lengkap
-- saat dibaca lewat booking_services.
insert into public.booking_services
  (booking_id, service_id, service_name, service_price, service_price_min, service_price_max, duration_minutes, final_price, sort_order)
select
  b.id,
  s.id,
  s.name,
  s.price,
  s.price_min,
  s.price_max,
  s.duration_minutes,
  b.final_price,
  0
from public.bookings b
join public.services s on s.id = b.service_id
where b.service_id is not null
on conflict (booking_id, service_id) do nothing;

-- ============================================================================
-- Catatan untuk developer:
-- - Saat membuat booking baru, insert dulu ke "bookings" (tanpa perlu mengisi
--   service_id manual — boleh null di awal), lalu insert banyak baris ke
--   "booking_services" sekaligus. Trigger di atas otomatis mengisi
--   bookings.service_id dengan layanan pertama.
-- - payments.service_price & payments.amount sekarang mencerminkan TOTAL
--   harga gabungan semua layanan dalam booking tsb, bukan 1 layanan saja.
-- - booking_services.duration_minutes dipakai untuk menghitung total durasi
--   booking (dijumlah semua layanan) sehingga slot waktu yang dikunci cukup
--   panjang untuk seluruh layanan yang dipilih.
-- ============================================================================
