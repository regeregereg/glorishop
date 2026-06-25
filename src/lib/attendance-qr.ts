import crypto from "crypto";

// ─── Konfigurasi QR ───────────────────────────────────────────────────────────
const QR_SECRET = (() => {
  if (process.env.QR_ATTENDANCE_SECRET) return process.env.QR_ATTENDANCE_SECRET;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "QR_ATTENDANCE_SECRET belum diset di environment variables. " +
        "Set string acak panjang ini di Vercel sebelum deploy."
    );
  }
  return "dev-qr-secret-glori-2024";
})();

export const QR_WINDOW_SECONDS = 300;

// ─── Generate token 6 karakter (base36 uppercase) ────────────────────────────
export function generateQrToken(offsetWindows = 0): string {
  const timeWindow =
    Math.floor(Date.now() / 1000 / QR_WINDOW_SECONDS) + offsetWindows;
  const hmacBytes = crypto
    .createHmac("sha256", QR_SECRET)
    .update(String(timeWindow))
    .digest();
  const num = hmacBytes.readUInt32BE(0) % Math.pow(36, 6);
  return num.toString(36).toUpperCase().padStart(6, "0");
}

// ─── Verifikasi token ─────────────────────────────────────────────────────────
export function verifyQrToken(token: string): boolean {
  const normalised = token.trim().toUpperCase().replace(/-/g, "");
  return (
    normalised === generateQrToken(0) ||
    normalised === generateQrToken(-1)
  );
}

// ─── Sisa waktu di window saat ini (detik) ───────────────────────────────────
export function secondsUntilNextWindow(): number {
  const secsInWindow = Math.floor(Date.now() / 1000) % QR_WINDOW_SECONDS;
  return QR_WINDOW_SECONDS - secsInWindow;
}

// ─── Validasi GPS radius ──────────────────────────────────────────────────────
// Koordinat default = Glori Barbershop.
// Bisa di-override lewat env: BARBERSHOP_LAT, BARBERSHOP_LNG, BARBERSHOP_RADIUS_METERS

const DEFAULT_LAT    = -7.371111837183355;
const DEFAULT_LNG    = 108.86945762716326;
const DEFAULT_RADIUS = 150; // meter

export interface GpsCoords {
  lat: number;
  lng: number;
}

function haversineMeters(a: GpsCoords, b: GpsCoords): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

export function checkGpsRadius(coords: GpsCoords): {
  ok: boolean;
  reason?: string;
  distanceMeters?: number;
} {
  const lat    = parseFloat(process.env.BARBERSHOP_LAT ?? "")  || DEFAULT_LAT;
  const lng    = parseFloat(process.env.BARBERSHOP_LNG ?? "")  || DEFAULT_LNG;
  const radius = parseFloat(process.env.BARBERSHOP_RADIUS_METERS ?? "") || DEFAULT_RADIUS;

  const shopCoords: GpsCoords = { lat, lng };
  const distance = Math.round(haversineMeters(coords, shopCoords));

  if (distance > radius) {
    return {
      ok: false,
      reason: `Kamu berada ${distance}m dari barbershop. Absen hanya bisa dilakukan di dalam area barbershop (radius ${radius}m).`,
      distanceMeters: distance,
    };
  }

  return { ok: true, distanceMeters: distance };
}
