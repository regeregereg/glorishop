import crypto from "crypto";

// ─── Konfigurasi ─────────────────────────────────────────────────────────────
// QR_SECRET wajib diset di environment variables (sama seperti SESSION_SECRET).
// Tanpa ini, siapa pun yang tahu source code bisa generate token valid sendiri.
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
// Setiap QR baru di-generate tiap window ini.
export const QR_WINDOW_SECONDS = 300; // 5 menit

// ─── Generate token untuk window saat ini ────────────────────────────────────
// offsetWindows: 0 = sekarang, -1 = window sebelumnya (untuk toleransi)
export function generateQrToken(offsetWindows = 0): string {
  const timeWindow =
    Math.floor(Date.now() / 1000 / QR_WINDOW_SECONDS) + offsetWindows;
  return crypto
    .createHmac("sha256", QR_SECRET)
    .update(String(timeWindow))
    .digest("hex")
    .slice(0, 16)
    .toUpperCase();
}

// ─── Verifikasi token yang dikirim barber ────────────────────────────────────
// Toleransi: accept window saat ini DAN satu window sebelumnya.
// Kenapa? Kalau barber scan 1 detik sebelum window berganti, QR di layar
// masih yang lama — toleransi -1 mencegah false rejection.
export function verifyQrToken(token: string): boolean {
  const normalised = token.trim().toUpperCase();
  return (
    normalised === generateQrToken(0) ||
    normalised === generateQrToken(-1)
  );
}

// ─── Sisa waktu di window saat ini (detik) ───────────────────────────────────
// Dipakai client untuk countdown timer di layar admin.
export function secondsUntilNextWindow(): number {
  const secsInWindow = Math.floor(Date.now() / 1000) % QR_WINDOW_SECONDS;
  return QR_WINDOW_SECONDS - secsInWindow;
}
