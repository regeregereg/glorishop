# Ringkasan Perubahan — Glori Barbershop

Tiga fitur yang diminta sudah diimplementasikan. Dokumen ini menjelaskan apa yang berubah, cara menjalankannya, dan beberapa hal yang perlu kamu putuskan/atur dari sisi admin setelah migration dijalankan.

---

## 0. LANGKAH WAJIB SEBELUM DEPLOY

Jalankan file ini di **Supabase SQL Editor**:

```
supabase/migration_walkin_homeservice_commission.sql
```

File ini aman dijalankan ulang (idempotent) dan **tidak menghapus data apa pun**. Isinya:
- Tambah kategori layanan baru `home_service`
- Tambah kolom `bookings.walkin_by_barber`
- Tambah kolom `services.commission_percentage` dan `services.is_home_service_only`
- Tambah kolom `booking_services.commission_percentage` dan `booking_services.commission_amount`
- Tambah tabel baru `service_barbers` (relasi layanan ↔ barber yang menerima)
- Set komisi default 40% untuk semua layanan yang belum diatur (supaya laporan tidak kosong total — silakan ubah nanti satu-satu dari halaman Kelola Layanan)

Setelah migration jalan, **cek dan atur ulang persentase komisi tiap layanan** di halaman admin Kelola Layanan, karena default 40% itu cuma sementara.

---

## 1. Walk-in oleh Barber (cukur di tempat, tanpa booking)

**Dashboard Barber** sekarang ada tombol **"Cukur Langsung"** di pojok kanan atas.

Saat barber tap tombol itu:
1. Muncul form sederhana: nama pelanggan (opsional), nomor telepon (opsional), pilih layanan (boleh lebih dari satu).
2. Kalau layanan yang dipilih punya range harga (misal Colouring Rp150rb–300rb), barber wajib isi harga final saat itu juga.
3. Setelah disimpan, sistem otomatis membuat slot waktu "sekarang" untuk barber tersebut dan booking langsung berstatus **CONFIRMED** (anggap sudah bayar di tempat) — barber tidak perlu pilih tanggal/jam manual sama sekali.
4. Booking ini **otomatis muncul di Admin → Semua Booking** dengan badge **"Walk-in Barber"** (beda dari badge "Walk-in Admin" untuk yang diinput admin sendiri lewat fitur Booking Walk-in yang sudah ada sebelumnya).
5. Admin juga mendapat notifikasi (in-app + push, kalau push sudah aktif).

**Catatan:** Layanan kategori Home Service **tidak akan muncul** di pilihan form ini — karena memang wajib booking di muka (lihat poin 2).

**Penting soal komisi barber lain:** Barber hanya bisa mencatat walk-in untuk dirinya sendiri, tidak bisa atas nama barber lain — supaya tidak ada yang bisa mencatut komisi rekan kerja.

---

## 2. Home Service (ke rumah, booking only, barber tertentu)

Di halaman **Admin → Kelola Layanan**, sekarang ada:
- Kategori baru: **"Home Service (ke rumah)"**
- Toggle **"Wajib booking (home service)"** — begitu diaktifkan:
  - Layanan ini otomatis **tidak bisa dipakai untuk walk-in** (baik dicatat barber maupun admin)
  - Muncul daftar centang **barber yang menerima layanan ini** — pilih satu atau lebih barber

Di sisi pelanggan (halaman Booking):
- Begitu pelanggan memilih layanan home service, sistem **memaksa** mereka memilih barber tertentu (opsi "Tanpa Preferensi" otomatis hilang)
- Daftar barber yang ditampilkan **disaring otomatis** — hanya barber yang memang sudah kamu tandai menerima layanan itu
- Kalau pelanggan pilih 2 layanan home service sekaligus dengan barber penerima yang berbeda-beda, sistem hanya menampilkan barber yang menerima **kombinasi keduanya**

Validasi ini double-checked di server (bukan cuma di tampilan), jadi tidak bisa "diakali" dari luar.

---

## 3. Sistem Persentase Komisi per Layanan

Di halaman **Admin → Kelola Layanan**, tiap layanan sekarang punya field **"Persentase komisi barber (%)"**.

Contoh sesuai yang kamu jelaskan:
- Haircut biasa → isi `40`
- Treatment → isi `30`

**Aturan:** Persentase berlaku **sama untuk semua barber** yang mengerjakan layanan tersebut (bukan per-barber). Kalau nanti kamu butuh persentase beda per barber, itu perubahan terpisah — kabari saya kalau mau ditambahkan.

**Di mana komisi ini muncul:**
- **Dashboard Barber** — kartu "Estimasi komisi hari ini" (berjalan real-time sepanjang hari, dihitung dari semua booking yang sudah confirmed)
- **Riwayat Barber** — total komisi keseluruhan + komisi per transaksi di tiap baris riwayat
- **Admin → Laporan** — 4 kartu ringkasan: Total Omset, Total Transaksi, **Total Komisi Barber**, dan **Bagian Barbershop** (= Omset − Komisi). Juga muncul breakdown komisi per layanan dan per barber.

**Cara hitungnya:** Persentase di-"snapshot" ke setiap booking saat booking itu dibuat. Artinya kalau kamu ubah persentase Haircut dari 40% jadi 35% besok, booking-booking yang **sudah ada sebelumnya** tetap pakai 40% (histori tidak berubah), hanya booking baru yang pakai 35%. Ini supaya laporan masa lalu tidak tiba-tiba berubah sendiri.

---

## File yang berubah/ditambah (untuk referensi developer)

**Migration baru:**
- `supabase/migration_walkin_homeservice_commission.sql`

**Helper baru:**
- `src/lib/commission.ts` — semua logika hitung komisi terpusat di sini

**API baru:**
- `POST /api/bookings/walkin` — endpoint walk-in barber

**API yang diperbarui:**
- `POST /api/bookings` — validasi home service + snapshot komisi
- `PATCH /api/bookings/[id]` — hitung ulang komisi saat harga final diisi/status DONE
- `GET/POST /api/services`, `PATCH /api/services/[id]` — field komisi, home service, relasi barber
- `GET /api/admin-reports` — tambah data komisi
- `GET /api/barber-stats` — tambah kolom komisi

**Halaman yang diperbarui:**
- Dashboard Barber, Riwayat Barber, Admin → Kelola Layanan, Admin → Semua Booking, Admin → Laporan, halaman Booking pelanggan

---

## Yang BELUM termasuk (di luar permintaan awal, tapi mungkin relevan ke depan)

- Komisi per-barber-per-layanan (saat ini hanya per-layanan)
- Riwayat/laporan komisi historis yang bisa di-export (PDF/Excel)
- Notifikasi WhatsApp otomatis ke barber soal komisi harian

Kalau salah satu di atas dibutuhkan, bilang saja — bisa ditambahkan terpisah.
