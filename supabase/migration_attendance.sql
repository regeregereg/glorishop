-- ============================================================================
-- GLORI BARBERSHOP — FITUR ABSENSI STAFF
-- Jalankan di Supabase SQL Editor
-- ============================================================================

-- 1. Tabel utama absensi
create table if not exists public.attendance (
  id            uuid primary key default gen_random_uuid(),
  staff_id      uuid not null references public.staff(id) on delete cascade,
  date          date not null default current_date,
  clock_in      timestamptz,
  clock_out     timestamptz,
  note          text,         -- opsional: keterangan dari admin (izin, sakit, dsb)
  created_at    timestamptz not null default now(),
  unique (staff_id, date)     -- 1 baris per staff per hari
);

-- 2. Index untuk query harian & per staff
create index if not exists idx_attendance_date     on public.attendance(date);
create index if not exists idx_attendance_staff    on public.attendance(staff_id);
create index if not exists idx_attendance_staff_date on public.attendance(staff_id, date);

-- 3. RLS — hanya service_role (server) yang boleh baca/tulis
--    (app pakai createAdminClient() dengan service_role key, bukan anon)
alter table public.attendance enable row level security;

-- Izinkan service_role penuh (server-side)
create policy "service_role_all" on public.attendance
  for all
  to service_role
  using (true)
  with check (true);

-- 4. Function: auto-close clock_out tengah malam (23:59:59 WIB)
--    Dipanggil oleh pg_cron atau cukup dijalankan manual setiap hari.
--    Jam tutup = 23:59:59 Asia/Jakarta di hari yang sama.
create or replace function public.auto_close_attendance()
returns void
language plpgsql
as $$
begin
  update public.attendance
  set clock_out = (date::text || ' 23:59:59')::timestamptz at time zone 'Asia/Jakarta'
  where clock_in  is not null
    and clock_out is null
    and date < current_date;  -- hanya hari kemarin ke belakang
end;
$$;

-- 5. (Opsional tapi direkomendasikan) Jadwalkan auto-close dengan pg_cron
--    Aktifkan extension pg_cron dulu di Supabase: Database > Extensions > pg_cron
--    Lalu jalankan baris di bawah SEKALI saja:
--
-- select cron.schedule(
--   'auto-close-attendance',   -- nama job
--   '1 0 * * *',               -- tiap hari jam 00:01 UTC (07:01 WIB)
--   $$select public.auto_close_attendance()$$
-- );
--
-- Kalau pg_cron tidak diaktifkan, clock_out akan di-set dari sisi
-- aplikasi (API /api/attendance otomatis menutup saat absen masuk
-- hari berikutnya, atau admin bisa tutup manual dari halaman absensi).
