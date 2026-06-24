-- Tambah kolom wa_number ke tabel users.
-- Kolom ini terpisah dari phone (nomor yang dipakai login) karena
-- pelanggan kadang mendaftar dengan nomor yang berbeda dari nomor WA-nya.
-- Null = belum diset, artinya admin fallback ke kolom phone.

alter table public.users
  add column if not exists wa_number text;

-- Index untuk memudahkan pencarian (opsional, untuk skala besar)
create index if not exists users_wa_number_idx on public.users (wa_number);

comment on column public.users.wa_number is
  'Nomor WhatsApp pelanggan jika berbeda dari phone (nomor login). Null = pakai phone.';
