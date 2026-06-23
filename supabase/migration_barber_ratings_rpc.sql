-- ============================================================================
-- MIGRATION: OPTIMASI RATING BARBER (RPC agregasi, bukan ambil semua baris)
-- ============================================================================
-- Jalankan file ini di Supabase SQL Editor. Aman dijalankan ulang (idempotent).
--
-- MASALAH YANG DIPERBAIKI:
-- Home (src/app/page.tsx) sebelumnya melakukan
--   supabase.from("reviews").select("barber_id, rating")
-- tanpa filter/limit — mengambil SEMUA baris dari tabel reviews (semua
-- barber, semua waktu), lalu menghitung rata-rata & jumlah per barber
-- secara manual di kode Next.js. Ini transfer data yang makin besar dan
-- makin lambat seiring jumlah review bertambah dari waktu ke waktu,
-- padahal yang dibutuhkan cuma angka ringkasan (rata-rata + jumlah per
-- barber), bukan baris mentahnya.
--
-- PERBAIKAN:
-- Fungsi get_barber_ratings() di bawah melakukan GROUP BY + AVG/COUNT
-- LANGSUNG di database (lewat Postgres, jauh lebih cepat untuk agregasi
-- dibanding loop di JavaScript), dan index baru di kolom barber_id supaya
-- GROUP BY ini tidak perlu full table scan.

create index if not exists idx_reviews_barber_id on public.reviews(barber_id);

create or replace function public.get_barber_ratings()
returns table (barber_id uuid, avg_rating numeric, review_count bigint)
language sql
stable
as $$
  select barber_id, avg(rating)::numeric as avg_rating, count(*) as review_count
  from public.reviews
  where barber_id is not null
  group by barber_id;
$$;
