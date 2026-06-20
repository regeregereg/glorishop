# Glori Barbershop — Booking System

Sistem booking online untuk Glori Barbershop. Dibangun dengan **Next.js 16 (App Router)**, **Tailwind CSS**, dan **Supabase** (database + storage), sesuai dengan dokumen perencanaan `Glori_Barbershop_Booking_System_Plan_v2.docx`.

Tiga area aplikasi:
- **`/`** — Aplikasi pelanggan (booking, riwayat, profil) — mobile-first
- **`/admin`** — Dashboard owner/admin — desktop-friendly
- **`/barber`** — Aplikasi barber (antrian, update status) — mobile-first

---

## 1. Yang Perlu Disiapkan

- [Node.js](https://nodejs.org) versi 18 atau lebih baru
- Akun [Supabase](https://supabase.com) (gratis)
- Editor kode (disarankan VS Code + Claude Code / Cursor / Copilot, sesuai rekomendasi di dokumen)

---

## 2. Setup Supabase (Step-by-Step)

### a. Buat Project Supabase

1. Buka [supabase.com](https://supabase.com) → **Sign up / Login**
2. Klik **New Project**
3. Isi nama project (misal: `glori-barbershop`), pilih password database (simpan baik-baik), pilih region terdekat (Singapore untuk Indonesia)
4. Klik **Create new project** dan tunggu ±2 menit sampai project siap

### b. Jalankan Skema Database

1. Di dashboard Supabase, buka menu **SQL Editor** (ikon di sidebar kiri)
2. Klik **New query**
3. Buka file `supabase/schema.sql` di folder project ini, copy semua isinya
4. Paste ke SQL Editor di Supabase, lalu klik **Run** (atau Ctrl+Enter)
5. Tunggu sampai muncul "Success" — ini akan membuat semua tabel, relasi, dan mengisi data awal (price list, 2 contoh barber, 1 akun admin)

### c. Ambil API Keys

1. Di dashboard Supabase, buka **Project Settings** (ikon gear) → **API**
2. Catat 3 nilai berikut:
   - **Project URL** → contoh: `https://xxxxxxxxxxxx.supabase.co`
   - **anon public key** → key panjang di bagian "Project API keys"
   - **service_role key** → key rahasia di bagian yang sama (klik "Reveal" untuk melihat)

### d. Isi Environment Variables

1. Di folder project, copy file `.env.example` menjadi `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Buka `.env.local` dan isi dengan nilai dari Supabase:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=isi-dengan-anon-key
   SUPABASE_SERVICE_ROLE_KEY=isi-dengan-service-role-key
   SESSION_SECRET=ganti-dengan-string-acak-panjang-minimal-32-karakter
   ```
   Untuk `SESSION_SECRET`, isi dengan string acak apa saja (minimal 32 karakter) — ini dipakai untuk mengamankan sesi login. Contoh cara generate cepat:
   ```bash
   openssl rand -hex 32
   ```

⚠️ **Jangan pernah membagikan `service_role key` ke publik atau commit ke git** — key ini punya akses penuh ke database tanpa pembatasan keamanan (RLS bypass).

---

## 3. Menjalankan Aplikasi

```bash
npm install
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) di browser.

### Akun default untuk testing

| Role | Username | Password |
| --- | --- | --- |
| Admin | `admin` | `glori123` |
| Barber 1 | `barber1` | `glori123` |
| Barber 2 | `barber2` | `glori123` |

**Penting:** Ganti password ini setelah login pertama kali (lewat Supabase Table Editor, kolom `password_hash` di tabel `staff` — perlu di-hash ulang dengan bcrypt; atau tambahkan fitur ubah password jika diperlukan ke depannya).

Untuk pelanggan (User), tidak perlu password — cukup masukkan nama dan nomor WhatsApp di halaman `/login`. Akun otomatis dibuat saat pertama kali login.

---

## 4. Sebelum Bisa Menerima Booking

Setelah setup database, ada 2 langkah yang perlu dilakukan admin sebelum pelanggan bisa booking:

1. **Buat slot waktu** — Login sebagai admin → menu **Kelola Slot** → pilih barber, tanggal, jam operasional, lalu klik "Generate Slot". Lakukan ini untuk setiap barber, setiap hari (atau bisa dikembangkan jadi otomatis mingguan ke depannya).
2. **Cek layanan & harga** — Menu **Kelola Layanan** sudah otomatis terisi sesuai price list dari dokumen perencanaan, tapi bisa diedit/ditambah kapan saja.

---

## 5. Struktur Folder Penting

```
src/
  app/
    page.tsx              → Home (user)
    booking/               → Flow booking (layanan → barber → slot → konfirmasi)
    layanan/                → Katalog layanan
    produk/                 → Katalog produk add-on
    riwayat/, profil/       → Halaman user lainnya
    admin/(protected)/      → Semua halaman admin (dilindungi login)
    barber/(protected)/     → Semua halaman barber (dilindungi login)
    api/                    → Semua API routes (backend logic)
  components/                → Komponen UI yang dipakai berulang
  lib/                       → Supabase client, session, utils
  types/                     → TypeScript types sesuai skema database
supabase/
  schema.sql                 → Skema database lengkap + seed data
```

---

## 6. Catatan Teknis

- **Auth**: Sistem sesi custom berbasis cookie (HMAC-signed), bukan Supabase Auth — karena dipilih login simpel (nama+telepon untuk pelanggan, username+password untuk staff).
- **Race condition booking**: Saat booking dibuat, slot dikunci secara atomik (conditional update) sebelum insert booking, untuk mencegah dua pelanggan mendapat slot yang sama secara bersamaan.
- **Real-time status**: Saat ini menggunakan polling (refresh otomatis tiap 15-20 detik). Bisa ditingkatkan ke Supabase Realtime (WebSocket) untuk update instan jika dibutuhkan.
- **Notifikasi WhatsApp**: Belum terhubung ke provider WA (Fonnte/Wablas) — saat ini notifikasi hanya tersimpan di tabel `notifications` (in-app log). Untuk mengaktifkan kirim WA asli, tambahkan integrasi API Fonnte/Wablas di titik-titik yang sudah menulis ke tabel `notifications` (lihat `src/app/api/bookings/[id]/route.ts` dan `src/app/api/bookings/route.ts`).
- **Font**: Project ini menggunakan font sistem (system font stack) karena environment build tidak memiliki akses internet ke Google Fonts saat development. Untuk hasil visual terbaik di production, silakan kembalikan ke Google Fonts (Plus Jakarta Sans untuk heading, Inter untuk body) di `src/app/layout.tsx` — cukup tambahkan kembali import `next/font/google`.
- **Pembayaran online & loyalty**: Termasuk Fase 2 di dokumen, belum dibangun di versi ini.

---

## 7. Deploy ke Production

Rekomendasi sesuai dokumen: **Vercel** (frontend) + **Supabase** (backend/database), keduanya gratis untuk skala awal.

1. Push project ini ke GitHub
2. Buka [vercel.com](https://vercel.com) → Import project dari GitHub
3. Tambahkan environment variables yang sama seperti di `.env.local` ke Vercel (menu Settings → Environment Variables)
4. Deploy

---

*Dokumen ini adalah living document — update sesuai perkembangan proyek, sama seperti dokumen perencanaan aslinya.*
