# Optimasi Performa & User Experience

Dokumen ini menjelaskan perubahan yang dilakukan untuk mengoptimalkan
performa aplikasi. **Tidak ada fitur/logika bisnis yang diubah** — semua
perubahan murni di level performa rendering, caching, dan algoritma.
Build (`npm run build`) dan type-check (`npx tsc --noEmit`) sudah diverifikasi
lolos tanpa error setelah semua perubahan ini.

## 1. Gambar: `<img>` mentah → `next/image`

**Akar masalah:** Seluruh aplikasi memuat foto barber, layanan, produk, dan
portofolio (yang umumnya diupload dari kamera HP, ukuran besar) lewat tag
`<img>` biasa. Ini berarti browser mengunduh foto dalam ukuran/format asli
tanpa resize, compress, atau lazy-load otomatis — inilah kontributor
terbesar untuk "kerasa lama" terutama di koneksi mobile.

**Perbaikan:** Diganti ke komponen `next/image` di hampir semua tempat
(`ServiceCard`, `ServiceGridCard`, `HomeView`, `ImageUpload`,
`PortfolioGallery`, halaman publik produk/layanan/barber, halaman admin
layanan/produk/barber, halaman onboarding, dan flow booking). Next.js
otomatis resize ke ukuran tampil yang sebenarnya, convert ke WebP, dan
lazy-load gambar yang belum terlihat di layar.

**Yang SENGAJA dibiarkan `<img>` mentah** (bukan terlewat):
- Preview bukti transfer di `admin/pembayaran/page.tsx` — karena
  `proof_url` adalah **signed URL sementara** (kedaluwarsa 5 menit) dari
  bucket privat, dan filenya bisa berupa **PDF** (sesuai opsi upload di
  booking flow). `next/image` tidak cocok untuk URL temporary/privat dan
  tidak mendukung PDF sama sekali.

**Setup yang dibutuhkan:** `next.config.ts` ditambahkan
`images.remotePatterns` untuk domain `*.supabase.co` (pola wildcard, bukan
hostname spesifik, supaya tetap jalan kalau project Supabase
berpindah/diganti tanpa perlu edit config lagi).

## 2. Bug performa: kalkulasi slot booking O(n²)

**Akar masalah:** Di halaman booking (`src/app/booking/page.tsx`), step
"Pilih Waktu" memanggil fungsi `hasConsecutiveAvailability()` untuk **setiap
slot** yang ditampilkan. Di dalam fungsi itu, seluruh daftar slot
di-`filter()` dan di-`sort()` ulang dari nol — dilakukan berkali-kali untuk
setiap slot, di setiap render. Dengan banyak barber/jam dalam satu hari, ini
jadi ratusan ribu operasi berulang dan terasa berat/delay saat membuka step
pilih waktu.

**Perbaikan:** Logika diubah jadi pre-computed sekali pakai `useMemo`:
1. Slot dikelompokkan per barber+tanggal dan diurutkan **satu kali**
   (`sortedSlotsByBarberDate`).
2. Hasil pengecekan "slot ini cukup berurutan atau tidak" disimpan sebagai
   `Set` (`validSlotIds`), dihitung sekali saat data slot berubah.
3. Saat render, tiap kartu slot tinggal `validSlotIds.has(slot.id)` — lookup
   O(1), bukan filter+sort ulang.

Hasil akhir (slot mana yang valid dipilih) **identik** dengan logika lama —
ini murni optimasi algoritma, bukan perubahan aturan bisnis.

## 3. Caching halaman publik (home, layanan, produk, profil barber)

**Akar masalah:** Halaman `/`, `/layanan`, `/layanan/[id]`, `/produk`,
`/barber/[id]` semua diberi `export const dynamic = "force-dynamic"` —
artinya setiap pengunjung membuka halaman ini, Next.js query ulang Supabase
dari nol dan render ulang seluruh HTML, padahal data layanan/barber/produk
jarang berubah (hanya saat admin mengubahnya lewat dashboard).

**Perbaikan:**
- `/layanan`, `/layanan/[id]`, `/produk`, `/barber/[id]` — halaman ini
  **tidak membaca data personal/sesi pengguna**, jadi aman diberi
  `export const revalidate = 60` (cache 60 detik, dibagi ke semua
  pengunjung).
- `/` (homepage) — halaman ini **membaca sesi cookie** untuk menampilkan
  nama pengguna & status booking aktif (data per-orang). Memberi cache ke
  seluruh halaman ini **berbahaya** (bisa menyajikan data sesi satu orang ke
  orang lain — kelas bug yang sama dengan "sesi admin/customer tertukar"
  yang pernah diperbaiki sebelumnya, lihat `PERUBAHAN.md`). Solusinya: hanya
  bagian **query Supabase** (layanan/barber/rating, bukan sesi) yang
  dibungkus `unstable_cache` dengan cache 60 detik. Bagian sesi tetap dibaca
  langsung dari cookie di setiap request, tidak pernah ikut cache.

**Invalidasi otomatis saat admin mengubah data:** Supaya admin tidak perlu
menunggu 60 detik melihat perubahannya sendiri, endpoint admin
(`/api/services`, `/api/barbers`, `/api/products`, dan portofolio barber)
ditambahkan `revalidateTag(...)` / `revalidatePath(...)` setiap kali ada
create/update/delete — cache langsung dipaksa segar lagi saat itu juga.

> Catatan teknis: project ini pakai Next.js 16 **tanpa** mengaktifkan flag
> `cacheComponents` di `next.config.ts`. Artinya model caching yang dipakai
> di sini adalah model "Previous/Legacy" Next.js (route segment config
> `revalidate`/`dynamic`, plus `unstable_cache`) — bukan direktif `"use
> cache"` yang lebih baru. Ini pilihan yang disengaja: migrasi ke
> `cacheComponents` adalah perubahan arsitektur besar yang berisiko untuk
> aplikasi yang sedang dipakai, dan di luar lingkup optimasi performa kali
> ini. Kalau di kemudian hari ingin migrasi ke model baru, semua titik cache
> di atas sudah terdokumentasi dan bisa jadi peta migrasi.

## 4. Query database yang dirampingkan

`select("*")` di endpoint `/api/barber-stats` (dipanggil halaman riwayat
kerja barber) dirampingkan jadi hanya kolom yang benar dipakai di tampilan,
mengurangi ukuran response yang dikirim ke browser.

**Yang SENGAJA tidak diubah** (sudah dicek satu-satu, bukan terlewat):
- `services`, `products`, `slots` — tabelnya kecil dan semua kolom memang
  dipakai langsung di tipe data; merampingkan di sini tidak memberi manfaat
  performa nyata dan menambah risiko maintenance.
- `GET /api/bookings` (endpoint transaksi inti, dipakai di 8+ halaman
  berbeda dengan kebutuhan field yang bervariasi per role admin/barber/
  customer) — risiko salah pangkas field yang dipakai salah satu konsumen
  jauh lebih besar daripada manfaat performanya tanpa testing menyeluruh di
  semua role. Dibiarkan apa adanya demi keamanan.
- Query di dalam transaksi pembuatan booking (`POST /api/bookings`) yang
  berkaitan dengan locking slot & rollback — ini bagian paling sensitif
  secara bisnis, tidak disentuh sama sekali.

## Catatan tambahan (bukan dikerjakan, sekadar informasi)

Saat menjalankan `npm run lint`, ditemukan ~24 error `react-hooks/
set-state-in-effect` di hampir semua halaman client (`useEffect` yang
langsung memanggil fungsi `setState`). **Ini bukan regresi dari perubahan
performa di atas** — sudah dicek, error yang sama muncul juga di file yang
sama sekali tidak disentuh (misalnya `admin/laporan/page.tsx`). Ini pola
arsitektur fetching data yang sudah ada sejak awal project. Tidak diperbaiki
di sesi ini karena di luar lingkup permintaan (performa & UX, bukan lint
compliance) dan berisiko mengubah logic fetching di banyak halaman tanpa
testing menyeluruh.
