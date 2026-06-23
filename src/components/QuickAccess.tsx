"use client";

import Link from "next/link";
import { ListOrdered, Users, Scissors, Package, MessageCircle } from "lucide-react";
import { buildWhatsAppUrl } from "@/lib/contact";

// Pesan default yang muncul otomatis di WA saat tombol "Hubungi Admin" ditekan
const WA_DEFAULT_MESSAGE = "Halo Admin Glori Barbershop, saya ingin bertanya 😊";

// Shortcut yang ditampilkan di grid di halaman Home.
// Grid 4 kolom → 5 item = baris 1 penuh (4) + 1 item baris 2, tengah.
const SHORTCUTS = [
  {
    href: "#antrian",
    icon: ListOrdered,
    label: "Cek Antrian",
    color: "text-status-progress",
    bg: "bg-[rgba(225,143,0,0.12)]",
    external: false,
  },
  {
    href: "/barbers",
    icon: Users,
    label: "Barber",
    color: "text-status-confirmed",
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
    color: "text-status-done",
    bg: "bg-[rgba(63,184,114,0.12)]",
    external: false,
  },
  {
    href: buildWhatsAppUrl(WA_DEFAULT_MESSAGE),
    icon: MessageCircle,
    label: "Hubungi Admin",
    // Warna hijau WA — konsisten dengan palet app, mirip text-status-done
    color: "text-[#25D366]",
    bg: "bg-[rgba(37,211,102,0.12)]",
    external: true,
  },
] as const;

export function QuickAccess() {
  return (
    <section className="mt-5 px-5">
      {/* Baris pertama: 4 tombol */}
      <div className="grid grid-cols-4 gap-3">
        {SHORTCUTS.slice(0, 4).map(({ href, icon: Icon, label, color, bg, external }) => (
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

      {/* Baris kedua: tombol Hubungi Admin — lebar penuh agar mudah ditekan */}
      {SHORTCUTS.slice(4).map(({ href, icon: Icon, label, color, bg, external }) => (
        <Link
          key={label}
          href={href}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className="mt-3 flex items-center justify-center gap-2.5 group"
        >
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-[var(--radius-lg)] ${bg} transition-transform active:scale-95 group-hover:scale-105`}
          >
            <Icon size={20} className={color} strokeWidth={1.75} />
          </div>
          <span className="text-[13px] font-semibold text-text-secondary group-hover:text-text-primary transition-colors">
            {label}
          </span>
        </Link>
      ))}
    </section>
  );
}
