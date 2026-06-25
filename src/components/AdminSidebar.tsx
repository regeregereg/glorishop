"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ListOrdered,
  CalendarRange,
  CalendarClock,
  Scissors,
  Users,
  Package,
  Image as ImageIcon,
  BarChart3,
  Receipt,
  Wallet,
  Settings,
  LogOut,
  ClipboardCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminBadgeCounts } from "@/lib/useAdminBadge";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/antrian", label: "Antrian Hari Ini", icon: ListOrdered },
  { href: "/admin/bookings", label: "Semua Booking", icon: CalendarRange },
  { href: "/admin/pembayaran", label: "Verifikasi Pembayaran", icon: Wallet },
  { href: "/admin/slot", label: "Kelola Slot", icon: CalendarClock },
  { href: "/admin/absensi", label: "Absensi Staff", icon: ClipboardCheck },
  { href: "/admin/layanan", label: "Kelola Layanan", icon: Scissors },
  { href: "/admin/barber", label: "Kelola Barber", icon: Users },
  { href: "/admin/produk", label: "Kelola Produk", icon: Package },
  { href: "/admin/banner", label: "Banner Promo", icon: ImageIcon },
  { href: "/admin/struk", label: "Struk Transaksi", icon: Receipt },
  { href: "/admin/laporan", label: "Laporan", icon: BarChart3 },
  { href: "/admin/resolve", label: "Resolve Data", icon: ListOrdered },
  { href: "/admin/pengaturan", label: "Pengaturan", icon: Settings },
];

export function AdminSidebar({ adminName }: { adminName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { pendingPaymentCount, unreadNotificationCount } = useAdminBadgeCounts();

  async function handleLogout() {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "staff" }),
    });
    router.push("/admin/login");
  }

  return (
    <aside className="hidden w-16 shrink-0 flex-col border-r border-border-soft bg-surface px-2 py-6 md:flex lg:w-64 lg:px-4">
      <div className="px-1 lg:px-2">
        <p className="hidden font-display text-lg font-extrabold lg:block">Glori Barbershop</p>
        <p className="hidden mt-0.5 text-xs text-text-secondary lg:block">Admin Dashboard</p>
        <p className="text-center font-display text-lg font-extrabold lg:hidden">GB</p>
      </div>

      <nav className="mt-8 flex flex-1 flex-col gap-1 overflow-y-auto">
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
              title={item.label}
              className={cn(
                "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                "justify-center lg:justify-start",
                active
                  ? "bg-accent-soft text-accent"
                  : "text-text-secondary hover:bg-white/5 hover:text-text-primary"
              )}
            >
              <Icon size={18} className="shrink-0" />
              <span className="hidden flex-1 lg:inline">{item.label}</span>
              {badgeCount > 0 && (
                <span
                  className={cn(
                    "flex h-5 min-w-5 items-center justify-center rounded-full bg-status-cancelled px-1.5 text-[10px] font-bold text-white",
                    "absolute right-1 top-1 lg:static lg:right-auto lg:top-auto"
                  )}
                >
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border-soft pt-4">
        <p className="hidden px-3 text-xs text-text-tertiary lg:block">Masuk sebagai</p>
        <p className="hidden px-3 text-sm font-semibold lg:block">{adminName}</p>
        <button
          onClick={handleLogout}
          title="Keluar"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-status-cancelled hover:bg-status-cancelled/10 lg:justify-start"
        >
          <LogOut size={16} className="shrink-0" />
          <span className="hidden lg:inline">Keluar</span>
        </button>
      </div>
    </aside>
  );
}
