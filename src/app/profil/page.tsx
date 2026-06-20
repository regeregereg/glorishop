"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/Button";
import { NotificationToggle } from "@/components/NotificationToggle";
import { initials } from "@/lib/utils";
import { LogOut, Phone, User as UserIcon } from "lucide-react";
import Link from "next/link";

export default function ProfilPage() {
  const router = useRouter();
  const [session, setSession] = useState<{ id: string; name: string } | null | undefined>(
    undefined
  );

  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setSession(d.user));
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "user" }) });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-bg pb-24">
      <header className="px-5 pt-6 pb-2">
        <h1 className="font-display text-2xl font-extrabold">Profil</h1>
      </header>

      <div className="px-5 pt-4">
        {session === undefined && (
          <p className="py-10 text-center text-sm text-text-secondary">Memuat...</p>
        )}

        {session === null && (
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

        {session && (
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

            <div className="mt-5 flex flex-col gap-2">
              <button
                onClick={() => router.push("/booking/status")}
                className="flex items-center justify-between rounded-2xl border border-border-soft bg-surface px-4 py-3.5 text-sm font-medium"
              >
                Status Booking Aktif
                <span className="text-text-tertiary">→</span>
              </button>
              <button
                onClick={() => router.push("/riwayat")}
                className="flex items-center justify-between rounded-2xl border border-border-soft bg-surface px-4 py-3.5 text-sm font-medium"
              >
                Riwayat Kunjungan
                <span className="text-text-tertiary">→</span>
              </button>
            </div>

            <div className="mt-3">
              <NotificationToggle />
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
