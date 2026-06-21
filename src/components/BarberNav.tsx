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

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border-soft bg-surface/95 backdrop-blur-lg">
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <defs>
          <linearGradient id="nav-order-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--accent-order-0)" />
            <stop offset="14%" stopColor="var(--accent-order-14)" />
            <stop offset="33%" stopColor="var(--accent-order-33)" />
            <stop offset="54%" stopColor="var(--accent-order-54)" />
            <stop offset="80%" stopColor="var(--accent-order-80)" />
            <stop offset="100%" stopColor="var(--accent-order-100)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        <Link
          href="/barber/dashboard"
          className={cn(
            "flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-semibold",
            pathname.startsWith("/barber/dashboard") ? "text-order-gradient" : "text-text-tertiary"
          )}
        >
          <ListChecks
            size={20}
            stroke={pathname.startsWith("/barber/dashboard") ? "url(#nav-order-gradient)" : "currentColor"}
          />
          Antrian
        </Link>
        <Link
          href="/barber/riwayat"
          className={cn(
            "flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-semibold",
            pathname.startsWith("/barber/riwayat") ? "text-order-gradient" : "text-text-tertiary"
          )}
        >
          <History
            size={20}
            stroke={pathname.startsWith("/barber/riwayat") ? "url(#nav-order-gradient)" : "currentColor"}
          />
          Riwayat
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
