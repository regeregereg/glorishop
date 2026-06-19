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
