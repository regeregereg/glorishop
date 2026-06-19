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
