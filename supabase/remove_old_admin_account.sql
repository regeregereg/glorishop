-- ============================================================================
-- HAPUS AKUN ADMIN LAMA YANG TERSISA (duplikat dari kejadian sebelumnya)
-- ============================================================================
-- Akun yang dihapus di sini SPESIFIK lewat id (bukan lewat WHERE role =
-- 'admin' yang bisa kena ke akun yang sedang dipakai) — supaya 100% tidak
-- mungkin salah hapus akun yang sekarang sedang aktif kamu pakai
-- (adminglori26).
--
-- LANGKAH 1 — Lihat dulu (pastikan id di bawah cocok dengan akun LAMA,
-- yaitu yang username-nya "admin", BUKAN "adminglori26").
select id, username, name, role from public.staff
where id = 'd08a7d40-f0db-4bb0-9eb3-2470a97c4b8b';

-- LANGKAH 2 — Hapus permanen akun admin lama tersebut.
-- Aman: tabel staff tidak punya data booking/transaksi yang menempel
-- langsung ke baris admin (admin bukan barber, tidak pernah jadi
-- barber_id di booking manapun).
delete from public.staff
where id = 'd08a7d40-f0db-4bb0-9eb3-2470a97c4b8b';

-- LANGKAH 3 — Verifikasi: harus tersisa TEPAT 1 baris, username adminglori26.
select id, username, name, role, is_active from public.staff where role = 'admin';
