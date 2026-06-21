# Bug: Halaman macet (stuck spinner) saat fetch gagal — tanpa pesan error

## Akar masalah

Hampir semua halaman client (`"use client"`) yang mengambil data lewat
`fetch()` di dalam `useEffect` ditulis tanpa `.catch()` / try-catch yang
memadai. Selama koneksi internet lancar dan API selalu berhasil, ini tidak
kelihatan masalahnya. Tapi begitu satu request gagal (koneksi terputus
sebentar, server restart, timeout, dsb), yang terjadi:

- State `loading` tidak pernah di-set `false` (karena `.then()` berikutnya
  yang mengandung `setLoading(false)` tidak pernah jalan) → halaman macet
  selamanya di tulisan "Memuat...".
- Tidak ada pesan error sama sekali ke pengguna — pengguna cuma melihat
  spinner/teks "Memuat..." tanpa tahu harus apa, dan satu-satunya cara
  keluar adalah refresh manual (yang sering tidak terpikir oleh pengguna
  awam).
- Untuk halaman dengan polling (antrian admin, dashboard, status booking,
  dashboard barber), error yang tidak ditangkap di `setInterval` callback
  bisa menumpuk di console tanpa pernah terlihat pengguna, dan beberapa
  state turunan (mis. daftar booking) bisa berhenti ter-update tanpa
  indikasi apa pun.

Komponen `ErrorState` dan `PageSpinner` sebenarnya **sudah ada** di
codebase (`src/components/ErrorState.tsx`, `src/components/PageSpinner.tsx`)
dan sudah dipakai dengan benar di beberapa halaman (mis.
`src/app/booking/status/[id]/page.tsx`), tapi belum diterapkan secara
konsisten di halaman lain.

## Halaman yang diperbaiki

**Customer-facing:**
- `src/app/profil/page.tsx`
- `src/app/riwayat/page.tsx`
- `src/app/booking/status/page.tsx`
- `src/app/booking/page.tsx` (booking flow utama — load sesi, layanan, barber)

**Barber:**
- `src/app/barber/(protected)/dashboard/page.tsx`
- `src/app/barber/(protected)/riwayat/page.tsx`

**Admin:**
- `src/app/admin/(protected)/dashboard/page.tsx`
- `src/app/admin/(protected)/antrian/page.tsx`
- `src/app/admin/(protected)/pembayaran/page.tsx`
- `src/app/admin/(protected)/barber/page.tsx` (termasuk modal portofolio)
- `src/app/admin/(protected)/layanan/page.tsx`
- `src/app/admin/(protected)/produk/page.tsx`
- `src/app/admin/(protected)/laporan/page.tsx`
- `src/app/admin/(protected)/slot/page.tsx`
- `src/app/admin/(protected)/pengaturan/page.tsx`

## Pola perbaikan yang dipakai

1. **Pemuatan data awal** (sekali per halaman): tambahkan `.catch()` /
   try-catch yang men-set state `loadError` dan tetap menjalankan
   `setLoading(false)`, lalu tampilkan komponen `<ErrorState onRetry={...} />`
   yang sudah ada di codebase — bukan UI baru, supaya konsisten dengan
   halaman yang sudah benar sebelumnya.

2. **Halaman dengan polling** (`antrian`, `pembayaran`, dashboard admin,
   dashboard barber, `booking/status`): dibedakan antara pemuatan
   **pertama** vs **polling berikutnya**.
   - Gagal di pemuatan pertama → tampilkan `ErrorState` penuh (belum ada
     data apa pun untuk ditampilkan).
   - Gagal di polling berikutnya (mis. koneksi sempat putus 1 siklus) →
     diamkan saja, data lama yang sudah tampil TETAP ditampilkan, dicoba
     lagi otomatis di siklus berikutnya. Ini supaya antrian/dashboard yang
     sedang dipakai aktif tidak tiba-tiba "hilang" dan diganti layar error
     hanya karena satu request polling gagal sesaat.

3. **Aksi (submit/update/delete)**: ditambahkan `catch` untuk kegagalan
   jaringan pada `fetch` itu sendiri (sebelumnya kalau request gagal total,
   bukan cuma dapat response error, kode akan throw exception tak
   tertangani dan tombol aksi macet di status "memproses").

## Tidak ada perubahan database / API

Semua perbaikan murni di sisi client (`"use client"` components). Tidak ada
perubahan skema, endpoint API, atau logika bisnis. Aman di-deploy tanpa
migration tambahan.

## Cara verifikasi manual

Cara termudah mensimulasikan kegagalan fetch: buka DevTools → tab Network
→ set ke "Offline" sesaat sebelum halaman dimuat, lalu kembalikan ke
"Online" untuk tes tombol "Coba Lagi". Untuk halaman dengan polling, coba
set "Offline" SETELAH data pertama berhasil dimuat — pastikan halaman tidak
mendadak menampilkan layar error penuh selama data lama masih terlihat.
