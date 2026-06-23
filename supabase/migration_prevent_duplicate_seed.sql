-- ============================================================================
-- MIGRATION: CEGAH DUPLIKASI SEED DATA DI MASA DEPAN
-- ============================================================================
-- Jalankan SETELAH cleanup_duplicate_inactive.sql berhasil (pastikan tidak
-- ada lagi baris duplikat aktif sebelum menambahkan unique constraint ini —
-- kalau masih ada duplikat dengan nama yang sama-sama aktif, ALTER TABLE
-- di bawah akan gagal dengan error "could not create unique constraint").
--
-- AKAR MASALAH yang diperbaiki:
-- schema.sql punya blok seed data (insert into services/products ... on
-- conflict do nothing) yang dimaksudkan idempotent — aman dijalankan
-- ulang. Tapi "on conflict do nothing" HANYA berfungsi kalau ada unique
-- constraint yang bisa di-deteksi konfliknya. Karena services.name dan
-- products.name sebelumnya TIDAK punya unique constraint, setiap kali
-- schema.sql dijalankan ulang (mis. untuk mengubah baris lain di file
-- yang sama), 13 baris layanan + 5 baris produk contoh ikut terduplikasi
-- sebagai baris baru. Tabel staff tidak kena masalah ini karena username
-- sudah punya "unique" dari awal.
--
-- Index unik di bawah membuat "on conflict do nothing" itu benar-benar
-- berfungsi untuk kedua tabel ini, sama seperti yang sudah berlaku di
-- kolom username.

create unique index if not exists idx_services_name_unique on public.services(name);
create unique index if not exists idx_products_name_unique on public.products(name);
