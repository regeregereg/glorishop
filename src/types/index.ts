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

export type ServiceCategory = "haircut" | "treatment" | "colouring" | "product";

export type StaffRole = "admin" | "barber";

export interface AppUser {
  id: string;
  name: string;
  phone: string;
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

export interface Booking {
  id: string;
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
  created_at: string;
  updated_at: string;
  // relasi (joined, opsional)
  service?: Service;
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
