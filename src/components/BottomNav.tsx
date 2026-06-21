"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarCheck, Clock, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { NavGradientIcon } from "@/components/NavGradientIcon";

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
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-semibold transition-colors",
                active ? "text-accent" : "text-text-tertiary hover:text-text-secondary"
              )}
            >
              {active ? (
                <NavGradientIcon icon={Icon} maskId={`nav-mask-${item.href.replace(/\W/g, "") || "home"}`} />
              ) : (
                <Icon size={20} strokeWidth={1.8} />
              )}
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
