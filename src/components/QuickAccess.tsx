"use client";

import Link from "next/link";
import { ListOrdered, Users, Scissors, Package } from "lucide-react";

// Shortcut yang ditampilkan di grid 4 kolom di halaman Home.
// Urutan: Antrian (paling sering dicari) → Barber → Layanan → Produk.
const SHORTCUTS = [
  {
    href: "#antrian",           // scroll ke section antrian di halaman sama
    icon: ListOrdered,
    label: "Cek Antrian",
    color: "text-status-progress",
    bg: "bg-[rgba(225,143,0,0.12)]",
  },
  {
    href: "/barbers",
    icon: Users,
    label: "Barber",
    color: "text-status-confirmed",
    bg: "bg-[rgba(77,141,240,0.12)]",
  },
  {
    href: "/layanan",
    icon: Scissors,
    label: "Layanan",
    color: "text-accent",
    bg: "bg-accent-soft",
  },
  {
    href: "/produk",
    icon: Package,
    label: "Produk",
    color: "text-status-done",
    bg: "bg-[rgba(63,184,114,0.12)]",
  },
] as const;

export function QuickAccess() {
  return (
    <section className="mt-5 px-5">
      <div className="grid grid-cols-4 gap-3">
        {SHORTCUTS.map(({ href, icon: Icon, label, color, bg }) => (
          <Link
            key={label}
            href={href}
            className="flex flex-col items-center gap-2 group"
          >
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-[var(--radius-lg)] ${bg} transition-transform active:scale-95 group-hover:scale-105`}
            >
              <Icon size={22} className={color} strokeWidth={1.75} />
            </div>
            <span className="text-center text-[11px] font-semibold leading-tight text-text-secondary">
              {label}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
