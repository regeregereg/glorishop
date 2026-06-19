"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, LayoutDashboard, ListOrdered, CalendarRange, CalendarClock, Scissors, Users, Package, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/antrian", label: "Antrian Hari Ini", icon: ListOrdered },
  { href: "/admin/bookings", label: "Semua Booking", icon: CalendarRange },
  { href: "/admin/slot", label: "Kelola Slot", icon: CalendarClock },
  { href: "/admin/layanan", label: "Kelola Layanan", icon: Scissors },
  { href: "/admin/barber", label: "Kelola Barber", icon: Users },
  { href: "/admin/produk", label: "Kelola Produk", icon: Package },
  { href: "/admin/laporan", label: "Laporan", icon: BarChart3 },
];

export function AdminMobileBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <div className="flex items-center justify-between border-b border-border-soft bg-surface px-5 py-4">
        <p className="font-display text-base font-bold">Glori Admin</p>
        <button onClick={() => setOpen(true)} className="text-text-secondary">
          <Menu size={22} />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setOpen(false)}>
          <div
            className="absolute right-0 top-0 h-full w-72 bg-surface p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="font-display text-base font-bold">Menu</p>
              <button onClick={() => setOpen(false)} className="text-text-secondary">
                <X size={20} />
              </button>
            </div>
            <nav className="mt-6 flex flex-col gap-1">
              {NAV_ITEMS.map((item) => {
                const active = pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                      active ? "bg-accent-soft text-accent" : "text-text-secondary"
                    )}
                  >
                    <Icon size={18} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
