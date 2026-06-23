"use client";

import Link from "next/link";
import { ListOrdered, Users, Scissors, Package, MessageCircle } from "lucide-react";
import { buildWhatsAppUrl } from "@/lib/contact";

const WA_MESSAGE = "Halo Admin Glori Barbershop, saya ingin bertanya 😊";

// Shortcut grid 5 kolom di halaman Home.
const SHORTCUTS = [
  {
    href: "#antrian",
    icon: ListOrdered,
    label: "Cek Antrian",
    color: "text-accent",
    bg: "bg-[rgba(225,143,0,0.12)]",
    external: false,
  },
  {
    href: "/barbers",
    icon: Users,
    label: "Barber",
    color: "text-accent",
    bg: "bg-[rgba(77,141,240,0.12)]",
    external: false,
  },
  {
    href: "/layanan",
    icon: Scissors,
    label: "Layanan",
    color: "text-accent",
    bg: "bg-accent-soft",
    external: false,
  },
  {
    href: "/produk",
    icon: Package,
    label: "Produk",
    color: "text-accent",
    bg: "bg-[rgba(63,184,114,0.12)]",
    external: false,
  },
  {
    href: buildWhatsAppUrl(WA_MESSAGE),
    icon: MessageCircle,
    label: "Hubungi Admin",
    color: "text-accent",
    bg: "bg-[rgba(226,85,77,0.12)]",
    external: true,
  },
] as const;

export function QuickAccess() {
  return (
    <section className="mt-5 px-5">
      <div className="grid grid-cols-5 gap-2">
        {SHORTCUTS.map(({ href, icon: Icon, label, color, bg, external }) => (
          <Link
            key={label}
            href={href}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
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
