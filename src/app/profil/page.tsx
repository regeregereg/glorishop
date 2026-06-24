"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/Button";
import { NotificationToggle } from "@/components/NotificationToggle";
import { ErrorState } from "@/components/ErrorState";
import { initials } from "@/lib/utils";
import { LogOut, Phone, User as UserIcon, MessageCircle, AtSign, MapPin } from "lucide-react";
import Link from "next/link";
import { buildWhatsAppUrl, INSTAGRAM_URL, MAPS_URL } from "@/lib/contact";

export default function ProfilPage() {
  const router = useRouter();
  const [session, setSession] = useState<{ id: string; name: string; phone: string; wa_number: string | null } | null | undefined>(
    undefined
  );
  // State untuk edit nomor WA
  const [waMode, setWaMode] = useState<"same" | "different" | null>(null); // null = belum load
  const [waInput, setWaInput] = useState("");
  const [waSaving, setWaSaving] = useState(false);
  const [waError, setWaError] = useState("");
  const [waSuccess, setWaSuccess] = useState(false);
  const [loadError, setLoadError] = useState(false);

  function loadSession() {
    setLoadError(false);
    setSession(undefined);
    fetch("/api/me", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("Gagal memuat sesi.");
        return r.json();
      })
      .then((d) => {
        setSession(d.user);
        if (d.user) {
          if (d.user.wa_number && d.user.wa_number !== d.user.phone) {
            setWaMode("different");
            setWaInput(d.user.wa_number.startsWith("62")
              ? "0" + d.user.wa_number.slice(2)
              : d.user.wa_number);
          } else {
            setWaMode("same");
          }
        }
      })
      .catch(() => setLoadError(true));
  }

  useEffect(() => {
    loadSession();
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "user" }) });
    router.push("/");
    router.refresh();
  }

  async function saveWaNumber() {
    setWaSaving(true);
    setWaError("");
    setWaSuccess(false);
    try {
      const payload = waMode === "same" ? { wa_number: null } : { wa_number: waInput };
      const res = await fetch("/api/me/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setWaError(data.error || "Gagal menyimpan.");
        return;
      }
      setWaSuccess(true);
      setTimeout(() => setWaSuccess(false), 3000);
      // Update session lokal
      if (session) {
        setSession({ ...session, wa_number: waMode === "same" ? null : waInput });
      }
    } catch {
      setWaError("Terjadi kesalahan. Coba lagi.");
    } finally {
      setWaSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg pb-24">
      <header className="px-5 pt-6 pb-2">
        <h1 className="font-display text-2xl font-extrabold">Profil</h1>
      </header>

      <div className="px-5 pt-4">
        {session === undefined && !loadError && (
          <p className="py-10 text-center text-sm text-text-secondary">Memuat...</p>
        )}

        {loadError && (
          <ErrorState
            title="Gagal memuat profil"
            message="Periksa koneksi internet kamu, lalu coba lagi."
            onRetry={loadSession}
          />
        )}

        {!loadError && session === null && (
          <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-border-soft bg-surface px-6 py-12 text-center">
            <UserIcon size={32} className="text-text-tertiary" />
            <p className="mt-3 font-display text-sm font-semibold">Kamu belum masuk</p>
            <p className="mt-1 text-xs text-text-secondary">
              Login untuk melihat profil dan riwayat booking.
            </p>
            <Button className="mt-5" onClick={() => router.push("/login?next=/profil")}>
              Masuk Sekarang
            </Button>
          </div>
        )}

        {!loadError && session && (
          <>
            <div className="flex items-center gap-4 rounded-[var(--radius-card)] border border-border-soft bg-surface p-5">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft font-display text-xl font-bold text-accent">
                {initials(session.name)}
              </div>
              <div>
                <p className="font-display text-lg font-bold">{session.name}</p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-text-secondary">
                  <Phone size={12} /> Pelanggan Glori Barbershop
                </p>
              </div>
            </div>

            {/* Section Nomor WhatsApp */}
            <div className="mt-4 rounded-2xl border border-border-soft bg-surface p-4">
              <p className="text-xs font-semibold text-text-secondary">Nomor WhatsApp</p>
              <p className="mt-0.5 text-[11px] text-text-tertiary">
                Dipakai admin untuk menghubungi kamu soal booking.
              </p>
              <div className="mt-3 flex flex-col gap-2">
                {/* Pilihan: sama atau beda */}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setWaMode("same"); setWaError(""); setWaSuccess(false); }}
                    className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                      waMode === "same"
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-border-soft bg-surface-2 text-text-secondary"
                    }`}
                  >
                    Sama dengan nomor login
                  </button>
                  <button
                    onClick={() => { setWaMode("different"); setWaError(""); setWaSuccess(false); }}
                    className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                      waMode === "different"
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-border-soft bg-surface-2 text-text-secondary"
                    }`}
                  >
                    Nomor WA berbeda
                  </button>
                </div>

                {/* Info nomor aktif saat ini */}
                {waMode === "same" && session && (
                  <p className="rounded-xl bg-surface-2 px-3.5 py-2.5 text-sm text-text-secondary">
                    📱 {session.phone.startsWith("62") ? "0" + session.phone.slice(2) : session.phone}
                  </p>
                )}

                {/* Input nomor WA berbeda */}
                {waMode === "different" && (
                  <input
                    type="tel"
                    value={waInput}
                    onChange={(e) => { setWaInput(e.target.value); setWaError(""); setWaSuccess(false); }}
                    placeholder="08xxxxxxxxxx"
                    className="w-full rounded-xl border border-border-soft bg-surface-2 px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent outline-none"
                  />
                )}

                {waError && (
                  <p className="text-xs text-status-cancelled">{waError}</p>
                )}
                {waSuccess && (
                  <p className="text-xs text-status-done">✓ Nomor WhatsApp berhasil disimpan.</p>
                )}

                <Button
                  size="sm"
                  onClick={saveWaNumber}
                  disabled={waSaving || (waMode === "different" && !waInput.trim())}
                >
                  {waSaving ? "Menyimpan..." : "Simpan"}
                </Button>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <button
                onClick={() => router.push("/booking/status")}
                className="flex items-center justify-between rounded-2xl border border-border-soft bg-surface px-4 py-3.5 text-sm font-semibold"
              >
                Status Booking Aktif
                <span className="text-text-tertiary">→</span>
              </button>
              <button
                onClick={() => router.push("/riwayat")}
                className="flex items-center justify-between rounded-2xl border border-border-soft bg-surface px-4 py-3.5 text-sm font-semibold"
              >
                Riwayat Kunjungan
                <span className="text-text-tertiary">→</span>
              </button>
            </div>

            <div className="mt-3">
              <NotificationToggle />
            </div>

            <div className="mt-5 rounded-2xl border border-border-soft bg-surface p-4">
              <p className="text-xs font-semibold text-text-secondary">Hubungi Kami</p>
              <div className="mt-3 flex flex-col gap-2">
                <a
                  href={buildWhatsAppUrl("Halo, saya ingin bertanya tentang Glori Barbershop.")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl px-1 py-1.5 text-sm font-semibold text-text-primary"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
                    <MessageCircle size={16} />
                  </span>
                  WhatsApp Admin
                </a>
                <a
                  href={INSTAGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl px-1 py-1.5 text-sm font-semibold text-text-primary"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
                    <AtSign size={16} />
                  </span>
                  Instagram @glori.barbershop
                </a>
                <a
                  href={MAPS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl px-1 py-1.5 text-sm font-semibold text-text-primary"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
                    <MapPin size={16} />
                  </span>
                  Lihat Lokasi di Maps
                </a>
              </div>
            </div>

            <Button
              variant="secondary"
              fullWidth
              className="mt-6"
              icon={<LogOut size={16} />}
              onClick={handleLogout}
            >
              Keluar
            </Button>
          </>
        )}
      </div>

      <div className="mt-10 px-5 text-center text-xs text-text-tertiary">
        <p>Staff Glori Barbershop?</p>
        <div className="mt-2 flex justify-center gap-4">
          <a href="/admin/login" className="text-accent">Login Admin</a>
          <Link href="/barber/login" className="text-accent">Login Barber</Link>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
