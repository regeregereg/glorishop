# Perubahan yang Dilakukan

## 0. Fitur: Kalender Ketersediaan di Home

**Tujuan:** sebelum ini, pelanggan awam yang cuma mau cek "tanggal sekian ada
slot kosong nggak?" harus masuk ke flow booking penuh (pilih layanan → pilih
barber → baru lihat tanggal) cuma untuk sekadar mengecek. Sekarang ada
kalender ringkas di Home, tepat di atas section Antrian, yang menjawab
pertanyaan itu langsung tanpa komitmen apa pun.

**Cara kerja:**
- Kalender bulanan dengan dot warna per tanggal: hijau = ada slot kosong,
  merah/abu = penuh, polos = belum ada jadwal dibuat. Status **gabungan semua
  barber** — pelanggan belum perlu tahu/pilih nama barber di tahap ini.
- Tap tanggal berwarna hijau → muncul daftar jam kosong (gabungan semua
  barber) di bawah kalender.
- Tap salah satu jam → tombol "Booking jam HH:MM" muncul → lanjut ke
  `/booking?date=YYYY-MM-DD&time=HH:MM`.
- Di halaman booking, tanggal & jam itu otomatis terkunci (badge "Jam HH:MM
  sudah dipilih dari halaman utama" + tombol "Ubah jam" untuk lepas kuncian).
  Pelanggan tinggal pilih layanan & barber seperti biasa; barber yang tidak
  available di jam itu otomatis tidak muncul.

**File baru:**
- `src/app/api/slots/availability-calendar/route.ts` — endpoint publik (tanpa
  login), beda dari `/api/slots/summary` yang admin-only & per-satu-barber.
  Endpoint ini menggabungkan slot dari SEMUA barber jadi satu status per
  tanggal dalam satu bulan.
- `src/components/AvailabilityCalendar.tsx` — komponen kalender + daftar jam
  + tombol booking, dipasang di `HomeView.tsx` sebagai section baru
  "Cek Ketersediaan" tepat sebelum `LiveQueuePanel`.

**File diubah:**
- `src/components/HomeView.tsx` — tambah section + import komponen baru.
- `src/app/booking/page.tsx` — baca query param `date`/`time` di awal,
  inisialisasi `selectedDate`/`viewMonth` sesuai itu, dan filter slot di step
  "Pilih Tanggal & Waktu" supaya hanya jam yang terkunci yang ditampilkan
  (state `lockedTime`, bisa dilepas lewat tombol "Ubah jam").

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

## 3. Fitur: Pilih beberapa layanan sekaligus saat booking (multi-layanan)

Sebelumnya satu booking hanya bisa berisi **satu** layanan. Sekarang
pelanggan bisa pilih beberapa layanan sekaligus dalam satu janji temu
(mis. Haircut + Creambath), persis seperti memilih beberapa barang saat
checkout di e-commerce.

**Perubahan database:**
- Tabel baru `booking_services` (lihat `supabase/migration_multi_service.sql`)
  — relasi 1 booking ke banyak layanan, lengkap dengan snapshot nama/harga
  layanan saat booking dibuat (supaya riwayat lama tidak ikut berubah kalau
  admin mengubah harga layanan di kemudian hari), dan `final_price` per
  layanan untuk layanan dengan range harga (Colour/Bleaching) yang
  dikonfirmasi barber satu per satu.
- Kolom `bookings.service_id` (lama) **tetap dipertahankan** dan otomatis
  disinkronkan ke layanan pertama lewat trigger database, supaya tidak ada
  kode lama yang rusak.
- Backfill otomatis: booking lama yang sudah ada akan dipindahkan datanya ke
  `booking_services` saat migration dijalankan.

**Perubahan logika booking:**
- Total **harga** booking = jumlah harga semua layanan yang dipilih.
- Total **durasi** booking = jumlah durasi semua layanan yang dipilih. Karena
  slot waktu dibuat per-blok (mis. tiap 30 menit), sistem otomatis mengunci
  **beberapa slot berurutan** milik barber yang sama kalau total durasi
  layanan lebih panjang dari satu slot. Kalau slot berikutnya tidak cukup
  tersedia/berurutan, slot tersebut tidak bisa dipilih (ditandai nonaktif di
  halaman booking).
- Pembayaran (DP/Lunas) dihitung dari total harga gabungan semua layanan.

**Yang diubah di kode:**
- `src/app/booking/page.tsx` — step "Pilih Layanan" sekarang berupa checklist
  (centang) multi-pilih, bukan radio-button satu pilihan.
- `src/app/api/bookings/route.ts` — menerima `service_ids` (array). Field lama
  `service_id` (tunggal) masih didukung untuk kompatibilitas mundur.
- `src/app/admin/(protected)/bookings/page.tsx` — form booking walk-in oleh
  admin juga sudah bisa pilih beberapa layanan sekaligus.
- Semua halaman yang menampilkan ringkasan booking (riwayat, status booking,
  dashboard admin/barber, antrian, laporan) sekarang menampilkan **daftar**
  nama layanan dan total harga, bukan cuma 1 layanan.

## Langkah setup di Supabase (WAJIB sebelum fitur multi-layanan bisa jalan)

1. Buka project Supabase kamu → **SQL Editor** → **New query**.
2. Copy-paste isi file `supabase/migration_multi_service.sql`, lalu **Run**.
   File ini aman dijalankan ulang dan otomatis memindahkan data booking lama
   ke struktur baru.
3. Selesai — pelanggan sekarang bisa pilih beberapa layanan sekaligus di
   halaman booking.
