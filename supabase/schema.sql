-- ============================================================================
-- GLORI BARBERSHOP — DATABASE SCHEMA
-- Jalankan file ini di Supabase SQL Editor (Project > SQL Editor > New query)
-- Aman dijalankan ulang (pakai IF NOT EXISTS / DROP ... IF EXISTS di beberapa tempat)
-- ============================================================================

-- 1. EXTENSIONS -------------------------------------------------------------
create extension if not exists "pgcrypto"; -- untuk gen_random_uuid()

-- 2. ENUM TYPES ---------------------------------------------------------------
do $$ begin
  create type booking_status as enum (
    'PENDING', 'CONFIRMED', 'IN_PROGRESS', 'DONE',
    'CANCELLED_USER', 'CANCELLED_ADMIN', 'NO_SHOW'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type service_category as enum ('haircut', 'treatment', 'colouring', 'product');
exception when duplicate_object then null; end $$;

do $$ begin
  create type staff_role as enum ('admin', 'barber');
exception when duplicate_object then null; end $$;

-- 3. TABLES -------------------------------------------------------------------

-- Pelanggan (auth sederhana: nama + nomor telepon, tanpa password)
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Staff: admin & barber pakai username + password (di-hash) terpisah dari users
create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  role staff_role not null,
  name text not null,
  photo_url text,
  bio text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Jadwal kerja barber per hari (0=Minggu .. 6=Sabtu)
create table if not exists public.work_schedules (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.staff(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  is_day_off boolean not null default false,
  unique (barber_id, day_of_week)
);

-- Layanan (haircut, treatment, colouring) — harga tetap atau range
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  -- unique: tanpa ini, blok "insert ... on conflict do nothing" di seed
  -- data (lihat bagian SEED DATA di bawah) tidak benar-benar mencegah
  -- duplikat kalau file ini sempat dijalankan ulang setelah database
  -- sudah terisi data asli — baris seed akan ikut terduplikasi diam-diam.
  name text not null unique,
  description text,
  price numeric(12,0),          -- harga tetap (null jika pakai range)
  price_min numeric(12,0),      -- untuk layanan dengan range (colour/bleaching)
  price_max numeric(12,0),
  duration_minutes int not null default 30,
  photo_url text,
  category service_category not null default 'haircut',
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Produk add-on (tidak butuh slot booking)
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null unique, -- lihat catatan unique di atas (tabel services)
  price numeric(12,0) not null,
  photo_url text,
  stock int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Slot waktu per barber per tanggal
create table if not exists public.slots (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.staff(id) on delete cascade,
  date date not null,
  start_time time not null,
  end_time time not null,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  unique (barber_id, date, start_time)
);

-- Booking
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  walkin_name text,           -- diisi jika booking manual tanpa akun
  walkin_phone text,
  barber_id uuid references public.staff(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  slot_id uuid references public.slots(id) on delete set null,
  status booking_status not null default 'PENDING',
  final_price numeric(12,0),  -- harga final dikonfirmasi barber (untuk layanan range)
  notes text,
  created_by_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Review / rating
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  barber_id uuid references public.staff(id) on delete set null,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (booking_id)
);

-- Notifikasi (in-app log; pengiriman WA/push ditangani oleh layanan eksternal)
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  staff_id uuid references public.staff(id) on delete cascade,
  type text not null,         -- contoh: 'booking_confirmed', 'reminder_h1', dst
  message text not null,
  is_read boolean not null default false,
  sent_at timestamptz not null default now()
);

-- 4. INDEXES ------------------------------------------------------------------
create index if not exists idx_bookings_status on public.bookings(status);
create index if not exists idx_bookings_barber on public.bookings(barber_id);
create index if not exists idx_bookings_user on public.bookings(user_id);
create index if not exists idx_slots_barber_date on public.slots(barber_id, date);
create index if not exists idx_notifications_user on public.notifications(user_id);
create index if not exists idx_notifications_staff on public.notifications(staff_id);

-- 5. TRIGGER: auto update updated_at pada bookings ----------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_bookings_updated_at on public.bookings;
create trigger trg_bookings_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

-- 6. TRIGGER: saat booking di-cancel, buka kembali slotnya --------------------
create or replace function public.release_slot_on_cancel()
returns trigger as $$
begin
  if new.status in ('CANCELLED_USER', 'CANCELLED_ADMIN') and old.status not in ('CANCELLED_USER', 'CANCELLED_ADMIN') then
    update public.slots set is_available = true where id = new.slot_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_release_slot on public.bookings;
create trigger trg_release_slot
  after update on public.bookings
  for each row execute function public.release_slot_on_cancel();

-- 7. ROW LEVEL SECURITY --------------------------------------------------------
-- Catatan: karena auth memakai sistem custom (nama+telepon untuk user,
-- username+password untuk staff) dan BUKAN Supabase Auth, akses tabel
-- dilakukan lewat Next.js API routes menggunakan service_role key di server.
-- RLS tetap diaktifkan untuk mencegah akses langsung dari client (anon key).

alter table public.users enable row level security;
alter table public.staff enable row level security;
alter table public.work_schedules enable row level security;
alter table public.services enable row level security;
alter table public.products enable row level security;
alter table public.slots enable row level security;
alter table public.bookings enable row level security;
alter table public.reviews enable row level security;
alter table public.notifications enable row level security;

-- Layanan & produk aktif boleh dibaca publik (anon) — supaya halaman katalog
-- bisa diakses tanpa login, sesuai catatan developer di dokumen perencanaan.
drop policy if exists "public read active services" on public.services;
create policy "public read active services" on public.services
  for select using (is_active = true);

drop policy if exists "public read active products" on public.products;
create policy "public read active products" on public.products
  for select using (is_active = true);

drop policy if exists "public read barbers" on public.staff;
create policy "public read barbers" on public.staff
  for select using (role = 'barber' and is_active = true);

drop policy if exists "public read available slots" on public.slots;
create policy "public read available slots" on public.slots
  for select using (true);

-- Semua tabel lain hanya bisa diakses lewat service_role (server-side),
-- jadi tidak ada policy tambahan untuk insert/update/delete dari client.
-- service_role key otomatis bypass RLS.

-- ============================================================================
-- SEED DATA — Price list resmi Glori Barbershop (sesuai dokumen perencanaan)
-- ============================================================================

insert into public.services (name, description, price, price_min, price_max, duration_minutes, category, sort_order) values
  ('Haircut Dewasa', 'Potong rambut untuk dewasa', 20000, null, null, 30, 'haircut', 1),
  ('Haircut Anak-anak', 'Potong rambut untuk anak-anak', 15000, null, null, 20, 'haircut', 2),
  ('Botak Licin', 'Cukur botak hingga licin', 25000, null, null, 35, 'haircut', 3),
  ('Shaver', 'Cukur rambut dengan shaver', 5000, null, null, 10, 'haircut', 4),
  ('Dewasa + Keramas + Styling', 'Paket potong, keramas, dan styling dewasa', 25000, null, null, 45, 'treatment', 5),
  ('Anak + Keramas + Styling', 'Paket potong, keramas, dan styling anak', 20000, null, null, 35, 'treatment', 6),
  ('Creambath', 'Perawatan creambath', 35000, null, null, 45, 'treatment', 7),
  ('Creambath + Haircut', 'Paket creambath dan potong rambut', 45000, null, null, 60, 'treatment', 8),
  ('Semir Hitam / Gelap', 'Pewarnaan rambut hitam/gelap, harga tetap', 35000, null, null, 40, 'colouring', 9),
  ('Colour - Hairlight', 'Pewarnaan sebagian rambut, sesuai panjang rambut', null, 130000, 200000, 60, 'colouring', 10),
  ('Colour - Full / Block', 'Pewarnaan seluruh rambut, sesuai panjang rambut', null, 150000, 300000, 90, 'colouring', 11),
  ('Bleaching - Hairlight', 'Bleaching sebagian rambut, sesuai panjang rambut', null, 70000, 150000, 60, 'colouring', 12),
  ('Bleaching - Full / Block', 'Bleaching seluruh rambut, sesuai panjang rambut', null, 100000, 200000, 90, 'colouring', 13)
on conflict (name) do nothing;

insert into public.products (name, price, stock) values
  ('Hair Tonic', 10000, 50),
  ('Gatsby Clay', 23000, 50),
  ('Gatsby Grease', 23000, 50),
  ('Gatsby Pomade', 23000, 50),
  ('Gatsby Powder', 50000, 50)
on conflict (name) do nothing;

-- Akun admin default. Username: admin  Password: glori123
-- (hash di bawah adalah bcrypt dari 'glori123' — GANTI setelah login pertama kali!)
insert into public.staff (username, password_hash, role, name, is_active) values
  ('admin', '$2b$10$VDfyQ5JndSkxphwmR27fcO83iM5ocfJ0982cbqr3a.6x.osYaJOPq', 'admin', 'Owner Glori', true)
on conflict (username) do nothing;

-- Contoh 2 barber (boleh dihapus/diedit dari dashboard admin nanti)
insert into public.staff (username, password_hash, role, name, is_active) values
  ('barber1', '$2b$10$VDfyQ5JndSkxphwmR27fcO83iM5ocfJ0982cbqr3a.6x.osYaJOPq', 'barber', 'Andi', true),
  ('barber2', '$2b$10$VDfyQ5JndSkxphwmR27fcO83iM5ocfJ0982cbqr3a.6x.osYaJOPq', 'barber', 'Budi', true)
on conflict (username) do nothing;
