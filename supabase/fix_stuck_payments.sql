-- Cek dulu payment mana yang nyangkut (PENDING_REVIEW tapi booking-nya sudah
-- tidak PENDING lagi, biasanya karena CANCELLED_USER/CANCELLED_ADMIN).
-- Jalankan SELECT ini dulu untuk lihat datanya sebelum diupdate.
select p.id as payment_id, p.booking_id, p.status as payment_status,
       b.status as booking_status, b.created_at
from payments p
join bookings b on b.id = p.booking_id
where p.status = 'PENDING_REVIEW'
  and b.status != 'PENDING';

-- Setelah dicek dan yakin ini memang data yang salah (booking sudah batal
-- tapi payment masih menggantung), jalankan UPDATE ini untuk membersihkannya:
update payments
set status = 'REJECTED',
    rejection_reason = 'Booking sudah dibatalkan sebelumnya, pembayaran ditutup otomatis (cleanup data lama).'
where status = 'PENDING_REVIEW'
  and booking_id in (
    select id from bookings where status != 'PENDING'
  );
