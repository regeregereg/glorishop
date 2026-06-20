-- ============================================================================
-- MIGRATION: SISTEM PEMBAYARAN (DP / FULL) SEBELUM BOOKING DIKONFIRMASI
-- ============================================================================
-- Jalankan file ini di Supabase SQL Editor SETELAH schema.sql.
-- Aman dijalankan ulang (idempotent).
--
-- RINGKASAN ALUR:
-- 1. Pelanggan pilih layanan + slot, lalu pilih jenis bayar: DP 50% atau Lunas.
-- 2. Booking dibuat dengan status WAITING_PAYMENT, slot langsung dikunci
--    (is_available = false) supaya tidak direbut orang lain.
-- 3. Pelanggan diberi QRIS statis (gambar dari app_settings) + upload bukti
--    transfer -> baris di tabel "payments" dibuat, booking pindah ke PENDING
--    (artinya: menunggu verifikasi admin).
-- 4. Admin cek bukti transfer di dashboard:
--    - KONFIRMASI -> booking jadi CONFIRMED, payment jadi CONFIRMED.
--    - TOLAK -> booking jadi CANCELLED_ADMIN (otomatis melepas slot lewat
--      trigger yang sudah ada di schema.sql), payment jadi REJECTED.
--      Pelanggan harus booking ulang dari awal (sesuai keputusan bisnis).
-- 5. Jika dalam 30 menit booking belum di-upload buktinya (masih
--    WAITING_PAYMENT), dianggap kedaluwarsa -> CANCELLED_ADMIN otomatis,
--    slot dilepas. Pengecekan ini dilakukan "lazy" di kode aplikasi
--    (saat ada GET /api/bookings), bukan via cron job.

-- 1. ENUM: tambah status baru ke booking_status -----------------------------
do $$ begin
  alter type booking_status add value if not exists 'WAITING_PAYMENT';
exception when duplicate_object then null; end $$;

-- 2. ENUM: status verifikasi pembayaran -------------------------------------
do $$ begin
  create type payment_status as enum (
    'WAITING_PROOF',   -- booking dibuat, pelanggan belum upload bukti transfer
    'PENDING_REVIEW',  -- bukti sudah diupload, menunggu dicek admin
    'CONFIRMED',       -- admin verifikasi -> pembayaran sah
    'REJECTED'         -- admin tolak buktinya
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_type as enum ('DP', 'FULL');
exception when duplicate_object then null; end $$;

-- 3. TABEL: payments ---------------------------------------------------------
-- Dipisah dari "bookings" (bukan ditempel sebagai kolom) supaya riwayat
-- pembayaran tetap rapi kalau suatu saat butuh multi-attempt, dan supaya
-- query laporan keuangan tidak bercampur dengan data booking.
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  payment_type payment_type not null default 'DP',
  amount numeric(12,0) not null,           -- nominal yang wajib dibayar (DP 50% atau full)
  service_price numeric(12,0),              -- snapshot harga layanan saat booking dibuat
  proof_url text,                           -- URL bukti transfer (di bucket privat payment-proofs)
  proof_uploaded_at timestamptz,
  status payment_status not null default 'WAITING_PROOF',
  rejection_reason text,
  reviewed_by uuid references public.staff(id) on delete set null,
  reviewed_at timestamptz,
  expires_at timestamptz not null,          -- created_at + 30 menit; lewat ini & masih WAITING_PROOF -> auto cancel
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id) -- satu booking hanya punya satu baris payment (sesuai aturan: ditolak = booking batal, harus booking baru)
);

create index if not exists idx_payments_booking on public.payments(booking_id);
create index if not exists idx_payments_status on public.payments(status);

drop trigger if exists trg_payments_updated_at on public.payments;
create trigger trg_payments_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

-- 4. TABEL: app_settings ------------------------------------------------------
-- Key-value sederhana untuk pengaturan yang bisa diubah admin tanpa redeploy,
-- contoh: gambar QRIS statis, nama rekening tujuan, dsb.
create table if not exists public.app_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_app_settings_updated_at on public.app_settings;
create trigger trg_app_settings_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

insert into public.app_settings (key, value) values
  ('qris_image_url', null),
  ('payment_account_name', 'Glori Barbershop'),
  ('dp_percentage', '50')
on conflict (key) do nothing;

-- 5. RLS -----------------------------------------------------------------------
alter table public.payments enable row level security;
alter table public.app_settings enable row level security;
-- Tidak ada policy publik tambahan: semua akses payments & app_settings
-- lewat API route Next.js dengan service_role key (server-side).
-- Kecuali qris_image_url yang memang perlu dibaca publik (ditampilkan di
-- halaman booking sebelum login pun boleh, supaya pelanggan bisa lihat QR):
drop policy if exists "public read qris setting" on public.app_settings;
create policy "public read qris setting" on public.app_settings
  for select using (key = 'qris_image_url' or key = 'payment_account_name' or key = 'dp_percentage');

-- 6. TRIGGER: saat payment REJECTED, otomatis batalkan booking terkait -------
create or replace function public.cancel_booking_on_payment_rejected()
returns trigger as $$
begin
  if new.status = 'REJECTED' and old.status is distinct from 'REJECTED' then
    update public.bookings
      set status = 'CANCELLED_ADMIN'
      where id = new.booking_id
        and status not in ('CANCELLED_USER', 'CANCELLED_ADMIN', 'DONE');
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_cancel_booking_on_payment_rejected on public.payments;
create trigger trg_cancel_booking_on_payment_rejected
  after update on public.payments
  for each row execute function public.cancel_booking_on_payment_rejected();

-- Catatan: trigger pelepasan slot (trg_release_slot) sudah ada di schema.sql
-- dan otomatis jalan begitu booking berstatus CANCELLED_ADMIN/CANCELLED_USER,
-- jadi tidak perlu trigger tambahan untuk melepas slot di sini.
