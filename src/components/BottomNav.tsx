"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarCheck, Clock, User } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/booking/status", label: "Status", icon: CalendarCheck },
  { href: "/riwayat", label: "Riwayat", icon: Clock },
  { href: "/profil", label: "Profil", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border-soft bg-surface/95 backdrop-blur-lg">
      {/* Definisi gradient dipakai bersama oleh semua icon nav aktif via stroke="url(#nav-order-gradient)" */}
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
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-semibold transition-colors",
                active ? "text-order-gradient" : "text-text-tertiary hover:text-text-secondary"
              )}
            >
              <Icon
                size={20}
                strokeWidth={active ? 2.4 : 1.8}
                stroke={active ? "url(#nav-order-gradient)" : "currentColor"}
              />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
