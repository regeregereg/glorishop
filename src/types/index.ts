// Tipe data utama — mencerminkan skema di supabase/schema.sql

export type BookingStatus =
  | "WAITING_PAYMENT"
  | "PENDING"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "DONE"
  | "CANCELLED_USER"
  | "CANCELLED_ADMIN"
  | "NO_SHOW";

export type PaymentStatus = "WAITING_PROOF" | "PENDING_REVIEW" | "CONFIRMED" | "REJECTED";

export type PaymentType = "DP" | "FULL";

export type ServiceCategory = "haircut" | "treatment" | "colouring" | "product" | "home_service";

export type StaffRole = "admin" | "barber";

export interface AppUser {
  id: string;
  name: string;
  phone: string;
  // Nomor WA khusus — diset pelanggan di halaman Profil jika beda dari phone.
  // Null = belum diset, gunakan phone sebagai fallback.
  wa_number: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Staff {
  id: string;
  username: string;
  password_hash?: string;
  role: StaffRole;
  name: string;
  photo_url: string | null;
  bio: string | null;
  is_active: boolean;
  created_at: string;
}

export interface WorkSchedule {
  id: string;
  barber_id: string;
  day_of_week: number; // 0=Minggu .. 6=Sabtu
  start_time: string;
  end_time: string;
  is_day_off: boolean;
}

// Satu foto hasil kerja barber di galeri portofolio (foto polos, tanpa
// tag layanan — lihat supabase/migration_portfolio.sql)
export interface BarberPortfolio {
  id: string;
  barber_id: string;
  photo_url: string;
  sort_order: number;
  created_at: string;
}

// Satu device/browser yang sudah mengizinkan web push notification
// (lihat supabase/migration_push_notifications.sql)
export interface PushSubscriptionRecord {
  id: string;
  user_id: string | null;
  staff_id: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
}

export interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  price_min: number | null;
  price_max: number | null;
  duration_minutes: number;
  photo_url: string | null;
  category: ServiceCategory;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  // persentase komisi/bagi hasil untuk barber dari layanan ini (0-100),
  // null/0 = belum diatur. Lihat supabase/migration_walkin_homeservice_commission.sql
  commission_percentage: number | null;
  // true = layanan ke rumah, wajib booking di muka, tidak bisa dipakai
  // untuk walk-in (barber maupun admin); hanya barber tertentu yang
  // boleh menerima, lihat service_barbers di bawah.
  is_home_service_only: boolean;
  // daftar id barber yang boleh menerima layanan ini, HANYA relevan saat
  // is_home_service_only = true (relasi, joined opsional)
  barber_ids?: string[];
  // override harga khusus per barber untuk layanan ini (relasi, joined
  // opsional). Baris yang tidak ada di sini untuk barber tertentu = barber
  // itu pakai harga dasar (price/price_min/price_max) di atas. Lihat
  // supabase/migration_barber_service_prices.sql dan src/lib/pricing.ts.
  barber_prices?: ServiceBarberPrice[];
}

// Satu baris override harga untuk kombinasi layanan + barber tertentu.
// null pada price/price_min/price_max berarti kolom itu tidak di-override
// (ikut harga dasar layanan untuk kolom tersebut).
export interface ServiceBarberPrice {
  id: string;
  service_id: string;
  barber_id: string;
  price: number | null;
  price_min: number | null;
  price_max: number | null;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  photo_url: string | null;
  stock: number;
  is_active: boolean;
  created_at: string;
}

// Satu baris penjualan produk retail (bukan layanan) — dicatat lewat
// "Catat Cepat" (barber) atau "Catat Penjualan" (admin). Lihat
// supabase/migration_product_sales.sql. Sengaja terpisah dari
// Booking/BookingService karena penjualan produk tidak butuh slot waktu.
export interface ProductSale {
  id: string;
  product_id: string | null;
  // snapshot nama & harga saat transaksi dibuat (tidak berubah meski admin
  // mengubah harga/nama produk aslinya di kemudian hari)
  product_name: string;
  unit_price: number;
  quantity: number;
  total_price: number;
  payment_method: "cash" | "qris";
  sold_by: string | null;
  notes: string | null;
  created_at: string;
  // relasi (joined, opsional)
  product?: Product;
  seller?: Staff;
}

export interface Slot {
  id: string;
  barber_id: string;
  date: string; // YYYY-MM-DD
  start_time: string;
  end_time: string;
  is_available: boolean;
  created_at: string;
}

export interface Payment {
  id: string;
  booking_id: string;
  payment_type: PaymentType;
  amount: number;
  service_price: number | null;
  proof_url: string | null;
  proof_uploaded_at: string | null;
  status: PaymentStatus;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

// Satu baris layanan di dalam sebuah booking. Booking sekarang bisa punya
// BEBERAPA layanan sekaligus (mis. Haircut + Creambath dalam satu janji
// temu), jadi ini relasi 1-ke-banyak dari bookings -> booking_services.
export interface BookingService {
  id: string;
  booking_id: string;
  service_id: string;
  // snapshot data layanan saat booking dibuat (tidak berubah meski admin
  // mengubah harga/nama layanan aslinya di kemudian hari)
  service_name: string;
  service_price: number | null;
  service_price_min: number | null;
  service_price_max: number | null;
  duration_minutes: number;
  // harga final per layanan, dikonfirmasi barber satu-satu (terutama untuk
  // layanan dengan range harga seperti Colour/Bleaching)
  final_price: number | null;
  sort_order: number;
  created_at: string;
  // snapshot persentase komisi saat booking dibuat + nominal komisi (Rp)
  // yang dihitung dari harga final layanan ini. Lihat src/lib/commission.ts
  commission_percentage: number | null;
  commission_amount: number | null;
  // relasi (joined, opsional) — data layanan saat ini (bisa beda dari snapshot
  // kalau admin sudah edit layanan setelah booking ini dibuat)
  service?: Service;
}

export interface Booking {
  id: string;
  // Kode booking pendek untuk verifikasi (contoh: "GLR-4X9K2M").
  // Dibuat otomatis saat booking dibuat, unik, mudah dibaca/diucapkan.
  booking_code: string;
  user_id: string | null;
  walkin_name: string | null;
  walkin_phone: string | null;
  barber_id: string | null;
  service_id: string | null;
  slot_id: string | null;
  status: BookingStatus;
  final_price: number | null;
  notes: string | null;
  created_by_admin: boolean;
  // true = booking walk-in yang diinput LANGSUNG oleh barber yang
  // bersangkutan dari dashboard barber (bukan oleh admin)
  walkin_by_barber: boolean;
  created_at: string;
  updated_at: string;
  // relasi (joined, opsional)
  service?: Service; // layanan utama/pertama saja — dipertahankan untuk kompatibilitas kode lama
  services?: BookingService[]; // SEMUA layanan yang dipilih di booking ini — pakai ini untuk tampilan baru
  barber?: Staff;
  slot?: Slot;
  user?: AppUser;
  payment?: Payment;
}

export interface Review {
  id: string;
  booking_id: string;
  user_id: string | null;
  barber_id: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string | null;
  staff_id: string | null;
  type: string;
  message: string;
  is_read: boolean;
  sent_at: string;
}

export const STATUS_LABELS: Record<BookingStatus, string> = {
  WAITING_PAYMENT: "Menunggu Pembayaran",
  PENDING: "Menunggu Verifikasi",
  CONFIRMED: "Dikonfirmasi",
  IN_PROGRESS: "Sedang dikerjakan",
  DONE: "Selesai",
  CANCELLED_USER: "Dibatalkan (User)",
  CANCELLED_ADMIN: "Dibatalkan (Admin)",
  NO_SHOW: "Tidak datang",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  WAITING_PROOF: "Menunggu Bukti Transfer",
  PENDING_REVIEW: "Menunggu Verifikasi Admin",
  CONFIRMED: "Pembayaran Terverifikasi",
  REJECTED: "Pembayaran Ditolak",
};

export const SERVICE_CATEGORY_LABELS: Record<ServiceCategory, string> = {
  haircut: "Haircut",
  treatment: "Treatment",
  colouring: "Colouring",
  product: "Produk",
  home_service: "Home Service (ke rumah)",
};
