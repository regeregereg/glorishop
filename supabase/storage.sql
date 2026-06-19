-- ============================================================
-- Setup Supabase Storage untuk foto (barber, layanan, produk)
-- ============================================================
-- Jalankan file ini di Supabase SQL Editor (Project > SQL Editor > New query)
-- SETELAH menjalankan schema.sql.
--
-- Bucket ini dipakai oleh /api/upload (lihat src/app/api/upload/route.ts)
-- untuk menyimpan foto barber, foto layanan, dan foto produk.

-- 1. Buat bucket "photos" (public, supaya foto bisa ditampilkan
--    langsung di app tanpa perlu signed URL).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photos',
  'photos',
  true,
  5242880, -- 5MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

-- 2. Izinkan siapa saja MEMBACA (lihat) foto di bucket "photos".
--    Ini aman karena hanya foto tampilan publik (barber/layanan/produk),
--    bukan data pribadi.
drop policy if exists "Public read access for photos" on storage.objects;
create policy "Public read access for photos"
on storage.objects for select
to public
using (bucket_id = 'photos');

-- 3. Upload, update, dan hapus foto HANYA boleh lewat service_role
--    (yaitu lewat API route /api/upload di server kita, yang sudah
--    mengecek sesi admin terlebih dahulu). Tidak ada policy insert/update/delete
--    untuk role "anon"/"authenticated", jadi browser tidak bisa upload langsung
--    ke Supabase Storage tanpa lewat API kita.
