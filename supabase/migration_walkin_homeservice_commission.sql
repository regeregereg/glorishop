-- ============================================================================
-- MIGRATION: WALK-IN OLEH BARBER + HOME SERVICE (BOOKING ONLY) + KOMISI
-- ============================================================================
-- Jalankan file ini di Supabase SQL Editor SETELAH schema.sql,
-- migration_payment.sql, dan migration_multi_service.sql.
-- Aman dijalankan ulang (idempotent).
--
-- RINGKASAN 3 FITUR:
--
-- 1) WALK-IN OLEH BARBER
--    Barber bisa mencatat pelanggan yang datang langsung ke tempat (tanpa
--    booking sebelumnya, bayar di tempat) lewat dashboard barber sendiri,
--    tanpa perlu admin yang menginput. Dibedakan dari walk-in yang
--    diinput admin (created_by_admin) lewat kolom baru walkin_by_barber,
--    supaya admin tetap bisa melihat siapa yang mencatat transaksi ini.
--    Slot "sekarang" dibuat otomatis di belakang layar (barber tidak perlu
--    pilih tanggal/jam manual), booking langsung CONFIRMED (anggap sudah
--    dibayar di tempat, tidak lewat alur QRIS/upload bukti).
--
-- 2) HOME SERVICE (booking only, barber tertentu, tidak bisa di tempat)
--    Kategori layanan baru 'home_service' untuk paket ke rumah pelanggan.
--    - Hanya bisa dipesan lewat booking (tidak boleh dipakai di walk-in
--      barber maupun walk-in admin — divalidasi di kode aplikasi).
--    - Hanya barber tertentu yang boleh menerima, diatur lewat tabel
--      relasi baru service_barbers (admin pilih barber mana saja yang
--      menerima layanan home service tertentu).
--
-- 3) SISTEM KOMISI / BAGI HASIL PER LAYANAN
--    Tiap layanan punya persentase komisi untuk barber (mis. Haircut 40%,
--    Treatment 30%). Disimpan di services.commission_percentage, lalu
--    di-snapshot ke booking_services.commission_percentage saat booking
--    dibuat (supaya kalau admin ubah persentase di kemudian hari, histori
--    komisi booking lama TIDAK ikut berubah — pola yang sama dengan
--    snapshot harga layanan di migration_multi_service.sql).
--    commission_amount dihitung & disimpan saat booking selesai (DONE)
--    atau final_price diisi, supaya bisa langsung dibaca tanpa hitung ulang
--    di setiap request.

-- 1. ENUM: tambah kategori layanan baru 'home_service' --------------------
do $$ begin
  alter type service_category add value if not exists 'home_service';
exception when duplicate_object then null; end $$;

-- 2. KOLOM BARU: bookings.walkin_by_barber ---------------------------------
-- Menandai booking walk-in yang diinput LANGSUNG oleh barber yang
-- bersangkutan (bukan oleh admin). created_by_admin tetap dipertahankan
-- apa adanya untuk walk-in yang diinput admin dari dashboard admin.
alter table public.bookings
  add column if not exists walkin_by_barber boolean not null default false;

-- 3. KOLOM BARU: services.commission_percentage ----------------------------
-- Persentase bagian barber dari harga layanan ini, contoh 40.00 = 40%.
-- null/0 dianggap belum diatur (tidak dihitung sebagai komisi di laporan).
alter table public.services
  add column if not exists commission_percentage numeric(5,2);

comment on column public.services.commission_percentage is
  'Persentase bagi hasil untuk barber dari harga layanan ini (0-100). Diatur admin per layanan, berlaku sama untuk semua barber.';

-- 4. KOLOM BARU: services.is_home_service_only -----------------------------
-- Penanda eksplisit tambahan (selain category = 'home_service') bahwa
-- layanan ini WAJIB booking dan tidak boleh dipakai untuk walk-in di
-- tempat. Dipisah dari category supaya validasi di kode aplikasi jelas
-- dan tidak bergantung pada nama kategori yang bisa berubah di masa depan.
alter table public.services
  add column if not exists is_home_service_only boolean not null default false;

comment on column public.services.is_home_service_only is
  'true = layanan ke rumah, wajib booking di muka, tidak bisa dipakai untuk walk-in (barber maupun admin).';

-- 5. KOLOM BARU: booking_services.commission_percentage & commission_amount
-- Snapshot persentase saat booking dibuat (tidak berubah meski admin ubah
-- commission_percentage di tabel services kemudian). commission_amount
-- dihitung dari harga FINAL layanan tersebut (final_price jika sudah
-- dikonfirmasi barber, atau service_price/service_price_min sebagai
-- estimasi sebelum final_price diisi).
alter table public.booking_services
  add column if not exists commission_percentage numeric(5,2),
  add column if not exists commission_amount numeric(12,0);

comment on column public.booking_services.commission_percentage is
  'Snapshot persentase komisi layanan ini saat booking dibuat — tidak berubah meski admin ubah persentase di tabel services kemudian.';
comment on column public.booking_services.commission_amount is
  'Nominal komisi (Rp) untuk barber dari layanan ini, dihitung dari harga final x commission_percentage.';

-- 6. TABEL BARU: service_barbers -------------------------------------------
-- Relasi banyak-ke-banyak: layanan home_service mana saja yang bisa
-- dikerjakan barber mana saja. Hanya relevan untuk layanan dengan
-- is_home_service_only = true / category = 'home_service' — untuk
-- layanan biasa (haircut/treatment/colouring di tempat), tabel ini TIDAK
-- dipakai untuk membatasi (semua barber aktif boleh menerima layanan biasa,
-- sesuai cara kerja sekarang).
create table if not exists public.service_barbers (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  barber_id uuid not null references public.staff(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (service_id, barber_id)
);

create index if not exists idx_service_barbers_service on public.service_barbers(service_id);
create index if not exists idx_service_barbers_barber on public.service_barbers(barber_id);

alter table public.service_barbers enable row level security;
-- Tidak ada policy publik tambahan secara default — tapi daftar barber
-- mana yang menerima layanan home service tertentu memang perlu dibaca
-- publik (halaman booking pelanggan harus tahu opsi barber yang valid
-- SEBELUM submit, bukan baru ditolak setelah submit).
drop policy if exists "public read service_barbers" on public.service_barbers;
create policy "public read service_barbers" on public.service_barbers
  for select using (true);

-- 7. RLS: pastikan kolom baru tidak membuka akses tambahan -----------------
-- (Tidak ada policy tambahan yang dibutuhkan untuk bookings/services/
-- booking_services karena RLS tabel-tabel ini sudah aktif dari
-- schema.sql/migration sebelumnya dan akses tetap lewat service_role di
-- server, bukan langsung dari client.)

-- 8. SEED contoh (opsional) — boleh dihapus/diedit dari dashboard admin ----
-- Set komisi default 40% untuk semua layanan yang belum diatur sama
-- sekali, supaya laporan komisi tidak kosong total saat fitur ini pertama
-- kali diaktifkan. Admin bisa ubah satu-satu nanti dari dashboard.
update public.services
  set commission_percentage = 40
  where commission_percentage is null;

-- ============================================================================
-- Catatan untuk developer:
-- - Saat admin/barber membuat booking untuk layanan home_service, WAJIB
--   pilih barber spesifik (bukan "Tanpa Preferensi") dan barber tersebut
--   WAJIB ada di service_barbers untuk layanan itu — divalidasi di
--   POST /api/bookings.
-- - Endpoint walk-in barber (POST /api/bookings/walkin) menolak body yang
--   berisi service dengan is_home_service_only = true / category =
--   'home_service'.
-- - commission_amount di booking_services dihitung ulang setiap kali
--   final_price (atau status jadi DONE) di-update, lewat kode aplikasi di
--   PATCH /api/bookings/[id] — bukan trigger DB, supaya logikanya mudah
--   diubah tanpa migration baru.
-- ============================================================================
