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
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="flex flex-1 flex-col items-center">
              <span
                className={cn(
                  "flex flex-col items-center gap-1 rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition-colors",
                  active
                    ? "btn-order-gradient text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]"
                    : "text-text-tertiary hover:text-text-secondary"
                )}
              >
                <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
