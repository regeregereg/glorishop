# File yang Diubah — Fix Bug: Tombol "Kembali" Tidak Berfungsi di Halaman Print

Struktur folder di bawah SAMA seperti struktur project asli.
Tinggal copy-timpa langsung ke project kamu.

## Bug yang diperbaiki
Tombol "Kembali" di halaman cetak (Struk, Laporan Harian, Rekap Absensi)
kadang diam saja saat diklik.

**Sebab:** tombol itu sebelumnya pakai `router.back()`, yang bergantung
pada riwayat (history) browser di tab itu. Kalau halaman print dibuka
sebagai entry PERTAMA di tab (misalnya lewat link yang `target="_blank"`,
atau setelah refresh), tidak ada "halaman sebelumnya" untuk dikembalikan —
jadi tombolnya tidak melakukan apa-apa.

**Perbaikan:** tombol "Kembali" sekarang menuju ke alamat tetap yang sudah
ditentukan per halaman (`/admin/struk`, `/admin/laporan`), bukan
bergantung pada riwayat. Selalu jalan, terlepas dari cara halaman itu
dibuka.

## File DIUBAH
- `src/components/PrintActions.tsx`
  → Tambah prop opsional `backHref`. Kalau diisi, tombol "Kembali" jadi
    link biasa ke alamat itu (selalu jalan). Kalau TIDAK diisi, tetap
    fallback ke `router.back()` tapi dengan pengaman tambahan: kalau tidak
    ada riwayat sama sekali di tab itu, lempar ke `/admin/dashboard`
    (lebih baik daripada diam saja, walau bukan tujuan paling presisi —
    karena itu sebaiknya `backHref` selalu diisi di setiap pemanggilan,
    lihat 3 file di bawah).

- `src/app/admin/(print)/struk/[id]/page.tsx`
  → Tambah `backHref="/admin/struk"` (halaman daftar struk transaksi).

- `src/app/admin/(print)/laporan-harian/page.tsx`
  → Tambah `backHref="/admin/struk"` (halaman ini biasa dibuka dari
    Struk Transaksi → tombol "Laporan Harian").

- `src/app/admin/(print)/laporan-absensi/page.tsx`
  → Tambah `backHref="/admin/laporan"`. **File ini sudah versi LENGKAP**
    (gabungan fitur rekap absensi sebelumnya + fix ini) — kalau kamu
    belum sempat timpa zip fitur rekap absensi sebelumnya, file ini sudah
    cukup dipakai sendiri, tidak perlu gabung manual.

## Cara timpa
Copy 4 file di atas ke path yang sama persis di project kamu (replace
file lama). Tidak ada file baru, tidak ada migration SQL.

## Yang perlu dicek setelah ditimpa
1. Jalankan `npx tsc --noEmit` dan `npm run build` — sudah saya tes sendiri
   di sisi saya, keduanya lolos tanpa error.
2. Buka halaman cetak struk dari Bookings (klik ikon struk pada booking
   status DONE) — klik "Kembali", harus langsung balik ke halaman Struk
   Transaksi.
3. Buka Laporan Harian dari halaman Struk Transaksi — klik "Kembali",
   harus balik ke halaman Struk Transaksi.
4. Buka Rekap Absensi dari halaman Laporan — klik "Kembali", harus balik
   ke halaman Laporan.
5. Coba juga skenario lain: buka salah satu halaman print itu langsung
   lewat URL (paste di address bar baru, atau refresh halaman print itu
   sendiri) — klik "Kembali" tetap harus jalan, karena sekarang tidak
   bergantung riwayat sama sekali.

## Catatan
Bug `router.back()` ini sebenarnya sudah ada di kode sebelum sesi ini
(bukan cuma di halaman Rekap Absensi yang baru saya buat) — jadi
perbaikan ini juga sekaligus membenahi halaman Struk dan Laporan Harian
yang sudah lama ada di project kamu.
