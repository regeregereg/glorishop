"use client";

import { useEffect, useState } from "react";
import { ImageUpload } from "@/components/ImageUpload";
import { Button } from "@/components/Button";
import { NotificationToggle } from "@/components/NotificationToggle";
import { ErrorState } from "@/components/ErrorState";

export default function AdminSettingsPage() {
  const [qrisUrl, setQrisUrl] = useState<string | null>(null);
  const [accountName, setAccountName] = useState("");
  const [dpPercentage, setDpPercentage] = useState("50");
  const [workStartTime, setWorkStartTime] = useState("09:00");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function loadSettings() {
    setLoading(true);
    setLoadError(false);
    fetch("/api/settings")
      .then((r) => {
        if (!r.ok) throw new Error("Gagal memuat pengaturan.");
        return r.json();
      })
      .then((d) => {
        setQrisUrl(d.settings?.qris_image_url ?? null);
        setAccountName(d.settings?.payment_account_name ?? "");
        setDpPercentage(d.settings?.dp_percentage ?? "50");
        setWorkStartTime(d.settings?.work_start_time ?? "09:00");
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadSettings();
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qris_image_url: qrisUrl,
          payment_account_name: accountName,
          dp_percentage: dpPercentage,
          work_start_time: workStartTime,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Gagal menyimpan pengaturan.");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      alert("Gagal menyimpan pengaturan. Periksa koneksi internet kamu.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold">Pengaturan Pembayaran</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Atur QRIS statis dan ketentuan DP yang dipakai di seluruh flow booking.
      </p>

      {loadError ? (
        <ErrorState
          className="mt-6"
          title="Gagal memuat pengaturan"
          message="Periksa koneksi internet kamu, lalu coba lagi."
          onRetry={loadSettings}
        />
      ) : loading ? (
        <p className="mt-8 text-sm text-text-secondary">Memuat...</p>
      ) : (
        <div className="mt-6 flex max-w-md flex-col gap-5 rounded-[var(--radius-card)] border border-border-soft bg-surface p-5">
          <div>
            <p className="mb-1.5 text-sm font-semibold text-text-secondary">QRIS Pembayaran</p>
            <p className="mb-3 text-xs text-text-tertiary">
              Gambar QR statis ini akan ditampilkan ke semua pelanggan saat checkout. Pastikan
              QR sudah benar sebelum disimpan.
            </p>
            <ImageUpload
              value={qrisUrl}
              onChange={setQrisUrl}
              folder="layanan"
              label=""
              shape="square"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-text-secondary">
              Nama Rekening / Merchant
            </label>
            <input
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="Contoh: Glori Barbershop"
              className="w-full rounded-xl border border-border-soft bg-surface-2 px-3.5 py-2.5 text-sm outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-text-secondary">
              Persentase DP (%)
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={dpPercentage}
              onChange={(e) => setDpPercentage(e.target.value)}
              className="w-full rounded-xl border border-border-soft bg-surface-2 px-3.5 py-2.5 text-sm outline-none focus:border-accent"
            />
            <p className="mt-1.5 text-xs text-text-tertiary">
              Berlaku untuk booking baru. Pelanggan tetap bisa pilih bayar lunas.
            </p>
          </div>

          <Button onClick={handleSave} disabled={saving} fullWidth>
            {saving ? "Menyimpan..." : saved ? "Tersimpan!" : "Simpan Pengaturan"}
          </Button>
        </div>
      )}

      <div className="mt-8 max-w-md">
        <h2 className="font-display text-lg font-bold">Jam Kerja & Absensi</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Dipakai sebagai acuan jam masuk standar untuk menghitung keterlambatan di rekap absensi (halaman Laporan).
        </p>
        <div className="mt-3 rounded-[var(--radius-card)] border border-border-soft bg-surface p-5">
          <label className="mb-1.5 block text-sm font-semibold text-text-secondary">
            Jam Masuk Standar
          </label>
          <input
            type="time"
            value={workStartTime}
            onChange={(e) => setWorkStartTime(e.target.value)}
            className="w-full max-w-[160px] rounded-xl border border-border-soft bg-surface-2 px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />
          <p className="mt-1.5 text-xs text-text-tertiary">
            Staff yang absen masuk setelah jam ini akan dihitung &quot;Terlambat&quot; di rekap.
          </p>
          <div className="mt-4">
            <Button onClick={handleSave} disabled={saving} fullWidth>
              {saving ? "Menyimpan..." : saved ? "Tersimpan!" : "Simpan Pengaturan"}
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-8 max-w-md">
        <h2 className="font-display text-lg font-bold">Notifikasi</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Aktifkan untuk dapat notifikasi langsung di perangkat ini setiap ada booking baru masuk.
        </p>
        <div className="mt-3">
          <NotificationToggle />
        </div>
      </div>
    </div>
  );
}
