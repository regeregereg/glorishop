"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, LayoutDashboard, ListOrdered, CalendarRange, CalendarClock, Scissors, Users, Package, Image as ImageIcon, BarChart3, Receipt, Wallet, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminBadgeCounts } from "@/lib/useAdminBadge";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/antrian", label: "Antrian Hari Ini", icon: ListOrdered },
  { href: "/admin/bookings", label: "Semua Booking", icon: CalendarRange },
  { href: "/admin/pembayaran", label: "Verifikasi Pembayaran", icon: Wallet },
  { href: "/admin/slot", label: "Kelola Slot", icon: CalendarClock },
  { href: "/admin/layanan", label: "Kelola Layanan", icon: Scissors },
  { href: "/admin/barber", label: "Kelola Barber", icon: Users },
  { href: "/admin/produk", label: "Kelola Produk", icon: Package },
  { href: "/admin/banner", label: "Banner Promo", icon: ImageIcon },
  { href: "/admin/struk", label: "Struk Transaksi", icon: Receipt },
  { href: "/admin/laporan", label: "Laporan", icon: BarChart3 },
  { href: "/admin/resolve", label: "Resolve Data", icon: ListOrdered },
  { href: "/admin/pengaturan", label: "Pengaturan", icon: Settings },
];

export function AdminMobileBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Badge notifikasi — sama seperti AdminSidebar, supaya admin yang akses
  // dari HP juga lihat ada hal yang butuh perhatian tanpa harus buka
  // Dashboard dulu.
  const { pendingPaymentCount, unreadNotificationCount } = useAdminBadgeCounts();
  const totalBadge = pendingPaymentCount + unreadNotificationCount;

  // Sebelumnya drawer mobile ini SAMA SEKALI tidak punya cara untuk
  // logout — hanya ada di sidebar desktop (AdminSidebar). Admin yang
  // mengakses dari HP jadi tidak punya jalan keluar sah dari sesi admin
  // selain hapus cookie manual atau tutup browser. Logic sama persis
  // dengan handleLogout di AdminSidebar, supaya konsisten di kedua tempat.
  async function handleLogout() {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "staff" }),
    });
    router.push("/admin/login");
  }

  return (
    <div className="md:hidden">
      <div className="flex items-center justify-between border-b border-border-soft bg-surface px-5 py-4">
        <p className="font-display text-base font-bold">Glori Admin</p>
        <button onClick={() => setOpen(true)} className="relative text-text-secondary">
          <Menu size={22} />
          {totalBadge > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-status-cancelled text-[9px] font-bold text-white">
              {totalBadge > 9 ? "9+" : totalBadge}
            </span>
          )}
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setOpen(false)}>
          <div
            className="absolute right-0 top-0 flex h-full w-72 flex-col bg-surface p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="font-display text-base font-bold">Menu</p>
              <button onClick={() => setOpen(false)} className="text-text-secondary">
                <X size={20} />
              </button>
            </div>
            <nav className="mt-6 flex flex-1 flex-col gap-1">
              {NAV_ITEMS.map((item) => {
                const active = pathname.startsWith(item.href);
                const Icon = item.icon;
                const badgeCount =
                  item.href === "/admin/dashboard"
                    ? unreadNotificationCount
                    : item.href === "/admin/pembayaran"
                      ? pendingPaymentCount
                      : 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold",
                      active ? "bg-accent-soft text-accent" : "text-text-secondary"
                    )}
                  >
                    <Icon size={18} />
                    <span className="flex-1">{item.label}</span>
                    {badgeCount > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-status-cancelled px-1.5 text-[10px] font-bold text-white">
                        {badgeCount > 99 ? "99+" : badgeCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-border-soft pt-4">
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-status-cancelled hover:bg-status-cancelled/10"
              >
                <LogOut size={16} /> Keluar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
