import { Service } from "@/types";

export function formatRupiah(value: number): string {
  return "Rp " + Math.round(value).toLocaleString("id-ID");
}

export function formatServicePrice(service: Service): string {
  if (service.price_min != null && service.price_max != null) {
    return `mulai dari ${formatRupiah(service.price_min)}`;
  }
  if (service.price != null) {
    return formatRupiah(service.price);
  }
  return "Harga belum diatur";
}

// Gabungkan nama beberapa layanan jadi satu baris teks, contoh:
// "Haircut Dewasa + Creambath" atau "Haircut Dewasa + 2 layanan lainnya"
// kalau terlalu banyak supaya tidak memenuhi layar.
export function formatServiceNames(services: { name: string }[], maxShown = 2): string {
  if (services.length === 0) return "Layanan";
  if (services.length <= maxShown) return services.map((s) => s.name).join(" + ");
  const shown = services.slice(0, maxShown).map((s) => s.name);
  const rest = services.length - maxShown;
  return `${shown.join(" + ")} + ${rest} layanan lainnya`;
}

// Jumlahkan estimasi harga dari beberapa layanan sekaligus. Layanan dengan
// harga tetap dijumlah langsung; layanan dengan range harga dijumlah pakai
// batas bawahnya (price_min) sebagai estimasi minimal, sama seperti aturan
// dasar pembayaran per-layanan di lib/payment.ts.
export function formatServiceListPrice(services: Service[]): string {
  if (services.length === 0) return "Harga belum diatur";
  const hasRange = services.some((s) => s.price_min != null && s.price_max != null);
  const total = services.reduce((sum, s) => {
    if (s.price != null) return sum + s.price;
    if (s.price_min != null) return sum + s.price_min;
    return sum;
  }, 0);
  return hasRange ? `mulai dari ${formatRupiah(total)}` : formatRupiah(total);
}

// Total durasi (menit) dari beberapa layanan, dipakai untuk menentukan
// berapa lama slot waktu yang perlu dikunci saat booking multi-layanan.
export function totalServiceDuration(services: { duration_minutes: number }[]): number {
  return services.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
}

// Ambil label nama layanan dari sebuah objek Booking, memprioritaskan
// daftar booking_services (multi-layanan) dan fallback ke relasi service
// tunggal lama kalau booking_services kosong (booking lama / belum migrasi).
export function getBookingServiceNames(booking: {
  services?: { service_name: string }[];
  service?: { name: string } | null;
}, maxShown = 2): string {
  if (booking.services && booking.services.length > 0) {
    return formatServiceNames(
      booking.services.map((s) => ({ name: s.service_name })),
      maxShown
    );
  }
  return booking.service?.name ?? "Layanan";
}

// Ambil label harga (estimasi) dari sebuah objek Booking, memprioritaskan
// jumlah seluruh booking_services dan fallback ke relasi service tunggal lama.
export function getBookingPriceLabel(booking: {
  services?: { service_price: number | null; service_price_min: number | null; service_price_max: number | null }[];
  service?: { price: number | null; price_min: number | null; price_max: number | null } | null;
}): string {
  if (booking.services && booking.services.length > 0) {
    const hasRange = booking.services.some(
      (s) => s.service_price_min != null && s.service_price_max != null
    );
    const total = booking.services.reduce((sum, s) => {
      if (s.service_price != null) return sum + s.service_price;
      if (s.service_price_min != null) return sum + s.service_price_min;
      return sum;
    }, 0);
    return hasRange ? `mulai dari ${formatRupiah(total)}` : formatRupiah(total);
  }
  if (booking.service) return formatServicePrice(booking.service as Service);
  return "Harga belum diatur";
}

export function formatDateIndo(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });
}

// Mengubah objek Date menjadi string "YYYY-MM-DD" berdasarkan tanggal LOKAL
// (bukan UTC). Jangan gunakan `date.toISOString().slice(0, 10)` untuk ini,
// karena toISOString() selalu mengonversi ke UTC. Untuk zona waktu WIB
// (UTC+7), itu menyebabkan tanggal mundur 1 hari setiap kali diakses
// antara pukul 00:00–06:59 WIB, sehingga tanggal yang dicari tidak pernah
// cocok dengan tanggal slot yang dibuat admin (akibatnya slot terlihat
// kosong padahal datanya ada).
export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatTime(timeStr: string): string {
  // timeStr format "HH:MM:SS" atau "HH:MM"
  return timeStr.slice(0, 5);
}

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}
