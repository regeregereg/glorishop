"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ListChecks, History, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

export function BarberNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "staff" }),
    });
    router.push("/barber/login");
  }

  const dashboardActive = pathname.startsWith("/barber/dashboard");
  const riwayatActive = pathname.startsWith("/barber/riwayat");

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border-soft bg-surface/95 backdrop-blur-lg">
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        <Link href="/barber/dashboard" className="flex flex-1 flex-col items-center">
          <span
            className={cn(
              "flex flex-col items-center gap-1 rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition-colors",
              dashboardActive
                ? "btn-order-gradient text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]"
                : "text-text-tertiary"
            )}
          >
            <ListChecks size={20} strokeWidth={dashboardActive ? 2.2 : 1.8} />
            Antrian
          </span>
        </Link>
        <Link href="/barber/riwayat" className="flex flex-1 flex-col items-center">
          <span
            className={cn(
              "flex flex-col items-center gap-1 rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition-colors",
              riwayatActive
                ? "btn-order-gradient text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]"
                : "text-text-tertiary"
            )}
          >
            <History size={20} strokeWidth={riwayatActive ? 2.2 : 1.8} />
            Riwayat
          </span>
        </Link>
        <button
          onClick={handleLogout}
          className="flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-semibold text-status-cancelled"
        >
          <LogOut size={20} />
          Keluar
        </button>
      </div>
    </nav>
  );
}
