# Perubahan yang Dilakukan

## 1. Bug: sesi admin & customer saling tertukar antar tab

**Akar masalah:** endpoint `GET /api/me` (dipakai untuk mengecek "siapa yang
sedang login") tidak punya header anti-cache. Saat dua tab (mis. tab admin dan
tab customer) memanggil `/api/me` di waktu berdekatan, browser bisa menyimpan
(cache) response salah satu tab dan menyajikannya ke tab lain — sehingga
terlihat seperti "tertukar login/logout" padahal cookie sesi di server
sebenarnya sudah benar dan terpisah (`glori_user_session` vs
`glori_staff_session`).

**Perbaikan:**
- `src/app/api/me/route.ts` — ditambahkan `export const dynamic =
  "force-dynamic"` dan header `Cache-Control: no-store` supaya response
  SELALU dihitung ulang per-request, tidak pernah disimpan cache oleh browser.
- Semua pemanggil `fetch("/api/me")` di sisi client (booking, riwayat, profil,
  status booking, dashboard barber) ditambahkan opsi `{ cache: "no-store" }`
  sebagai lapisan pengaman tambahan.

Setelah perubahan ini, buka 2 tab berbeda (1 admin, 1 customer) seharusnya
sudah tidak saling pengaruh lagi.

## 2. Fitur: Upload & tampilkan foto (barber, layanan, produk)

Field `photo_url` sebenarnya **sudah ada** di database & tipe data
(`Staff`, `Service`, `Product`), tapi form admin belum punya input untuk
mengisinya, dan tampilan customer masih pakai icon/inisial sebagai placeholder.

**Yang ditambahkan:**
- `src/app/api/upload/route.ts` — endpoint baru untuk upload foto ke Supabase
  Storage (bucket `photos`), hanya bisa diakses admin yang sudah login.
- `supabase/storage.sql` — **WAJIB dijalankan di Supabase SQL Editor** supaya
  bucket `photos` tersedia (lihat instruksi di bawah).
- `src/components/ImageUpload.tsx` — komponen upload foto reusable (preview,
  loading state, validasi tipe & ukuran file).
- Form **Kelola Layanan** dan **Kelola Barber** sekarang punya input foto.
- Halaman **Kelola Produk** (`/admin/produk`) — baru dibuat dari nol, sebelumnya
  belum ada sama sekali. Sudah ditambahkan ke menu sidebar & menu mobile admin.
- `src/app/api/products/[id]/route.ts` — endpoint PATCH/DELETE produk per-id
  (sebelumnya belum ada).
- Tampilan customer (home, list layanan, detail layanan, list produk, pemilihan
  barber saat booking) sekarang menampilkan foto asli jika sudah diisi admin,
  dan otomatis fallback ke icon/inisial jika foto belum ada.

## Langkah setup di Supabase (WAJIB sebelum upload foto bisa jalan)

1. Buka project Supabase kamu → **SQL Editor** → **New query**.
2. Copy-paste isi file `supabase/storage.sql`, lalu **Run**.
3. Selesai — admin sekarang bisa upload foto lewat menu Kelola Layanan,
   Kelola Barber, dan Kelola Produk.

Tidak perlu mengubah `.env` apapun; upload memakai koneksi Supabase yang
sudah ada (`SUPABASE_SERVICE_ROLE_KEY`).
