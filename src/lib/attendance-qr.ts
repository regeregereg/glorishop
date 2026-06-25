import crypto from "crypto";

// ─── Konfigurasi ─────────────────────────────────────────────────────────────
const QR_SECRET = (() => {
  if (process.env.QR_ATTENDANCE_SECRET) return process.env.QR_ATTENDANCE_SECRET;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "QR_ATTENDANCE_SECRET belum diset di environment variables. " +
        "Set string acak panjang ini di Vercel sebelum deploy."
    );
  }
  return "dev-qr-secret-glori-2024"; // fallback development only
})();

// Durasi satu window (detik). Default 5 menit.
export const QR_WINDOW_SECONDS = 300;

// ─── Generate token 6 karakter (base36 uppercase) ────────────────────────────
// Contoh output: "A3K9ZR"
// 36^6 = 2.176.782.336 kemungkinan → cukup aman untuk absensi lokasi.
export function generateQrToken(offsetWindows = 0): string {
  const timeWindow =
    Math.floor(Date.now() / 1000 / QR_WINDOW_SECONDS) + offsetWindows;
  const hmacBytes = crypto
    .createHmac("sha256", QR_SECRET)
    .update(String(timeWindow))
    .digest();
  // Ambil 4 byte pertama → integer → base36 → 6 karakter uppercase
  const num = hmacBytes.readUInt32BE(0) % Math.pow(36, 6);
  return num.toString(36).toUpperCase().padStart(6, "0");
}

// ─── Verifikasi token yang dikirim barber ────────────────────────────────────
// Toleransi: accept window saat ini DAN satu window sebelumnya.
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
