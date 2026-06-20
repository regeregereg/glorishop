-- ============================================================
-- Setup Supabase Storage untuk bukti transfer pembayaran
-- ============================================================
-- Jalankan SETELAH migration_payment.sql.
--
-- Berbeda dari bucket "photos" (public), bucket ini PRIVAT karena
-- berisi data sensitif (foto bukti transfer / mutasi rekening
-- pelanggan). Akses hanya lewat service_role di server (API route
-- /api/payments/upload-proof dan /api/payments/[id]/proof-url),
-- tidak ada policy public read.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-proofs',
  'payment-proofs',
  false, -- PRIVAT, beda dengan bucket "photos"
  5242880, -- 5MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'application/pdf'];

-- Tidak ada policy select/insert untuk anon/authenticated sama sekali.
-- Semua baca/tulis HANYA lewat service_role key di server kita, yang
-- sudah memverifikasi sesi user/admin terlebih dahulu di API route.
