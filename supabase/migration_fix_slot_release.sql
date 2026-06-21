-- ============================================================================
-- MIGRATION: PERBAIKAN BUG — slot lanjutan tidak terbuka saat booking
-- multi-layanan dibatalkan/ditolak
-- ============================================================================
-- Jalankan file ini di Supabase SQL Editor SETELAH schema.sql,
-- migration_payment.sql, dan migration_multi_service.sql.
-- Aman dijalankan ulang (idempotent).
--
-- AKAR MASALAH:
-- Trigger lama "release_slot_on_cancel" (di schema.sql) hanya melepas SATU
-- slot, yaitu yang tercatat di bookings.slot_id. Tapi sejak fitur
-- multi-layanan (migration_multi_service.sql), satu booking bisa mengunci
-- BEBERAPA slot berurutan sekaligus kalau total durasi semua layanan yang
-- dipilih lebih panjang dari satu blok slot (mis. Haircut 30 menit +
-- Creambath 45 menit = 75 menit, kalau slot per-blok cuma 30 menit maka
-- perlu 3 slot berurutan).
--
-- Saat booking seperti itu dibatalkan/ditolak (CANCELLED_USER /
-- CANCELLED_ADMIN), trigger lama cuma membuka slot pertama. Slot ke-2, ke-3,
-- dst tetap is_available = false SELAMANYA, padahal tidak ada booking aktif
-- yang memakainya. Lama-lama jadwal barber "kelihatan penuh" padahal
-- sebenarnya kosong.
--
-- PERBAIKAN:
-- Trigger diganti supaya menghitung ULANG seluruh rangkaian slot berurutan
-- milik barber & tanggal yang sama, dimulai dari bookings.slot_id, sepanjang
-- total durasi SEMUA layanan booking ini (dari booking_services), lalu
-- membuka semuanya. Logika ini meniru persis fungsi findConsecutiveSlots()
-- yang dipakai di src/app/api/bookings/route.ts saat booking dibuat,
-- supaya slot yang dilepas sama persis dengan slot yang dikunci.

create or replace function public.release_slot_on_cancel()
returns trigger as $$
declare
  total_duration_min int;
  base_slot record;
  current_slot record;
  accumulated_min int;
  slot_ids_to_release uuid[];
begin
  if new.status in ('CANCELLED_USER', 'CANCELLED_ADMIN')
     and old.status not in ('CANCELLED_USER', 'CANCELLED_ADMIN')
     and new.slot_id is not null then

    -- Total durasi booking ini = jumlah durasi semua layanan di
    -- booking_services. Kalau baris booking_services belum/tidak ada
    -- (mis. data lama sebelum migration multi-layanan), fallback ke 30
    -- menit supaya minimal slot pertama tetap kebuka (perilaku lama).
    select coalesce(sum(bs.duration_minutes), 0) into total_duration_min
    from public.booking_services bs
    where bs.booking_id = new.id;

    if total_duration_min is null or total_duration_min = 0 then
      total_duration_min := 30;
    end if;

    -- Ambil slot dasar (yang tercatat di bookings.slot_id).
    select * into base_slot from public.slots where id = new.slot_id;

    if base_slot.id is not null then
      slot_ids_to_release := array[base_slot.id];
      accumulated_min := extract(epoch from (base_slot.end_time - base_slot.start_time)) / 60;
      current_slot := base_slot;

      -- Jalan terus selama durasi yang sudah terkumpul masih kurang dari
      -- total durasi booking, ambil slot berikutnya yang BERURUTAN
      -- (start_time slot berikutnya == end_time slot saat ini) milik
      -- barber & tanggal yang sama.
      while accumulated_min < total_duration_min loop
        select * into current_slot
        from public.slots
        where barber_id = base_slot.barber_id
          and date = base_slot.date
          and start_time = current_slot.end_time
        limit 1;

        exit when current_slot.id is null; -- tidak ada slot berikutnya, berhenti

        slot_ids_to_release := array_append(slot_ids_to_release, current_slot.id);
        accumulated_min := accumulated_min + (extract(epoch from (current_slot.end_time - current_slot.start_time)) / 60);
      end loop;

      update public.slots
        set is_available = true
        where id = any(slot_ids_to_release);
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

-- Trigger definition tidak berubah, cuma fungsi di baliknya yang diganti
-- (CREATE OR REPLACE di atas sudah cukup), tapi drop+create ulang di sini
-- supaya file ini eksplisit dan gampang dibaca urutannya.
drop trigger if exists trg_release_slot on public.bookings;
create trigger trg_release_slot
  after update on public.bookings
  for each row execute function public.release_slot_on_cancel();

-- ============================================================================
-- CLEANUP DATA LAMA: perbaiki slot yang sudah kadung "hangus" dari booking
-- yang SUDAH dibatalkan SEBELUM migration ini dijalankan.
-- ============================================================================
-- Aman dijalankan: hanya membuka slot yang (a) berasal dari booking yang
-- sudah CANCELLED_USER/CANCELLED_ADMIN, (b) urutan slot persis sama dengan
-- yang akan dihitung trigger di atas, dan (c) TIDAK sedang dipakai booking
-- aktif lain (jaga-jaga ada slot yang sudah benar2 dipakai ulang).

do $$
declare
  b record;
  total_duration_min int;
  base_slot record;
  current_slot record;
  accumulated_min int;
  slot_ids_to_release uuid[];
begin
  for b in
    select id, slot_id, barber_id
    from public.bookings
    where status in ('CANCELLED_USER', 'CANCELLED_ADMIN')
      and slot_id is not null
  loop
    select coalesce(sum(bs.duration_minutes), 0) into total_duration_min
    from public.booking_services bs
    where bs.booking_id = b.id;

    if total_duration_min is null or total_duration_min = 0 then
      total_duration_min := 30;
    end if;

    select * into base_slot from public.slots where id = b.slot_id;
    continue when base_slot.id is null;

    slot_ids_to_release := array[base_slot.id];
    accumulated_min := extract(epoch from (base_slot.end_time - base_slot.start_time)) / 60;
    current_slot := base_slot;

    while accumulated_min < total_duration_min loop
      select * into current_slot
      from public.slots
      where barber_id = base_slot.barber_id
        and date = base_slot.date
        and start_time = current_slot.end_time
      limit 1;

      exit when current_slot.id is null;

      slot_ids_to_release := array_append(slot_ids_to_release, current_slot.id);
      accumulated_min := accumulated_min + (extract(epoch from (current_slot.end_time - current_slot.start_time)) / 60);
    end loop;

    -- Hanya buka slot yang tidak sedang dikunci oleh booking aktif LAIN.
    -- (Booking ini sendiri sudah CANCELLED, jadi aman; tapi double-check
    -- supaya tidak salah buka slot yang kebetulan dipakai booking lain.)
    update public.slots s
      set is_available = true
      where s.id = any(slot_ids_to_release)
        and not exists (
          select 1 from public.bookings b2
          where b2.slot_id = s.id
            and b2.status not in ('CANCELLED_USER', 'CANCELLED_ADMIN')
        );
  end loop;
end $$;

-- ============================================================================
-- Catatan untuk developer:
-- - Migration ini TIDAK mengubah skema tabel apa pun, cuma fungsi trigger +
--   one-time cleanup, jadi aman dijalankan kapan saja tanpa downtime.
-- - Setelah ini jalan, cek menu "Kelola Slot" di admin untuk beberapa
--   tanggal yang ada riwayat booking multi-layanan yang dibatalkan, pastikan
--   slot-slotnya sudah balik jadi hijau (tersedia).
-- ============================================================================
