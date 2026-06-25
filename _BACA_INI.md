# File yang Diubah — Rekap Absensi Harian untuk Evaluasi Owner

Struktur folder di bawah SAMA seperti struktur project asli.
Tinggal copy-timpa langsung ke project kamu.

## Yang ditambahkan
Owner sekarang bisa melihat rekap kehadiran staff (hadir, terlambat, tidak
masuk, total jam kerja) untuk rentang tanggal apa pun, langsung di halaman
Laporan yang sudah ada — plus bisa dicetak/download PDF.

## File BARU
- `src/app/api/admin-reports/attendance/route.ts`
  → API baru: `GET /api/admin-reports/attendance?from=YYYY-MM-DD&to=YYYY-MM-DD`.
    Menghitung per staff aktif: jumlah hari hadir, jumlah hari terlambat
    (dibandingkan jam masuk standar dari Pengaturan), jumlah hari tidak
    masuk (hanya menghitung hari yang sudah lewat/hari ini, tidak menghitung
    tanggal di masa depan), dan total jam kerja (dari clock_in–clock_out).
    Hanya bisa diakses admin (pakai `getStaffSession()` sama seperti API
    absensi lain).

- `src/components/AttendanceReportDocument.tsx`
  → Komponen dokumen cetak A4, gaya dan strukturnya niru
    `DailyReportDocument` yang sudah ada (header bisnis, kotak ringkasan,
    tabel per staff, footer "dicetak otomatis").

- `src/app/admin/(print)/laporan-absensi/page.tsx`
  → Halaman cetak baru di `/admin/laporan-absensi?from=...&to=...`.
    Pakai komponen `PrintActions` yang sudah ada (tombol Print & Download
    PDF), sama seperti halaman `/admin/laporan-harian`. Tidak pakai
    sidebar admin (route group `(print)`), sama seperti halaman cetak lain.

## File DIUBAH
- `src/app/api/settings/route.ts`
  → Tambah `work_start_time` ke `PUBLIC_KEYS`, supaya bisa disimpan/diambil
    lewat API settings yang sudah ada (key-value `app_settings`, tidak
    perlu migration SQL baru sama sekali).

- `src/app/admin/(protected)/pengaturan/page.tsx`
  → Tambah section baru "Jam Kerja & Absensi" dengan input jam (`<input
    type="time">`), default `09:00` kalau belum pernah diisi. Ini jadi
    acuan untuk hitung "Terlambat" di rekap absensi. Ada tombol simpan
    sendiri di section ini (tidak perlu scroll ke atas).

- `src/app/admin/(protected)/laporan/page.tsx`
  → Tambah section "Rekap Absensi Staff" di bagian bawah halaman Laporan,
    pakai rentang tanggal (`from`/`to`) yang SAMA dengan filter laporan
    omset yang sudah ada di atasnya — jadi owner cukup atur tanggal sekali.
    Tabel menampilkan: nama + peran, hadir, terlambat (ikon warning kuning
    kalau > 0), tidak masuk (ikon merah kalau > 0), total jam kerja.
    Ada tombol "Cetak Rekap" yang membuka halaman print di tab baru.

## Cara timpa
Copy semua file di atas ke path yang sama persis di project kamu (replace
file lama untuk yang DIUBAH, tambahkan baru untuk yang BARU).

## TIDAK perlu migration SQL
Fitur ini full pakai tabel yang sudah ada (`attendance`, `staff`,
`app_settings`) — tidak ada kolom atau tabel baru. Tinggal copy-timpa file,
tidak ada langkah Supabase SQL Editor yang perlu dijalankan.

## Yang perlu dicek setelah ditimpa
1. Jalankan `npx tsc --noEmit` dan `npm run build` — sudah saya tes sendiri
   di sisi saya dan keduanya **lolos tanpa error**, tapi tetap baik untuk
   cross-check di environment kamu.
2. Buka **Admin → Pengaturan**, scroll ke "Jam Kerja & Absensi", pastikan
   jam masuk standarnya sudah benar (default 09:00), lalu klik Simpan
   sekali — supaya key `work_start_time` benar-benar tersimpan di database
   (sebelum disimpan pertama kali, API akan otomatis fallback ke "09:00").
3. Buka **Admin → Laporan**, scroll ke bawah, cek apakah tabel "Rekap
   Absensi Staff" muncul dan datanya masuk akal dibandingkan data di
   halaman Absensi Staff harian yang sudah ada.
4. Klik tombol "Cetak Rekap", cek tampilan halaman cetaknya, coba tombol
   Print dan Download PDF.
5. Catatan tentang "Tidak Masuk": dihitung dari jumlah hari kalender dalam
   rentang yang dipilih (sampai hari ini, tidak termasuk hari di masa
   depan), dikurangi jumlah hari staff itu absen masuk. Ini BELUM
   memperhitungkan hari libur toko atau jadwal kerja per-barber (field
   `work_schedules` ada di database tapi belum dipakai di fitur manapun
   di project ini) — jadi kalau ada staff yang memang terjadwal libur di
   hari tertentu, hari itu masih akan tercatat sebagai "tidak masuk".
   Kalau ini perlu diperbaiki (misal: skip hari libur toko/staff dari
   hitungan), kasih tahu saya — itu di luar scope yang sudah dikerjakan
   sekarang.
