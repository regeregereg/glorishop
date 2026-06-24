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
  Wallet,
  Settings,
  ShieldAlert,
  LogOut,
} from "lucide-react";
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
  { href: "/admin/laporan", label: "Laporan", icon: BarChart3 },
  { href: "/admin/resolve", label: "Resolve Data", icon: ShieldAlert },
  { href: "/admin/pengaturan", label: "Pengaturan", icon: Settings },
];

export function AdminSidebar({ adminName }: { adminName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  // Badge notifikasi (pembayaran menunggu verifikasi + notif belum dibaca)
  // — supaya admin lihat ada yang butuh perhatian dari MANAPUN dia berada
  // di dashboard, tidak cuma saat membuka halaman Dashboard.
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
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border-soft bg-surface px-4 py-6 lg:flex">
      <div className="px-2">
        <p className="font-display text-lg font-extrabold">Glori Barbershop</p>
        <p className="mt-0.5 text-xs text-text-secondary">Admin Dashboard</p>
      </div>

      <nav className="mt-8 flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          // Badge khusus per item: total notif belum dibaca muncul di
          // Dashboard (karena daftar notifikasi lengkap ada di sana), dan
          // jumlah pembayaran menunggu verifikasi muncul langsung di menu
          // Verifikasi Pembayaran (lebih aktionable, langsung tahu mau ke
          // mana untuk menindaklanjuti).
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
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                active
                  ? "bg-accent-soft text-accent"
                  : "text-text-secondary hover:bg-white/5 hover:text-text-primary"
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
        <p className="px-3 text-xs text-text-tertiary">Masuk sebagai</p>
        <p className="px-3 text-sm font-semibold">{adminName}</p>
        <button
          onClick={handleLogout}
          className="mt-3 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-status-cancelled hover:bg-status-cancelled/10"
        >
          <LogOut size={16} /> Keluar
        </button>
      </div>
    </aside>
  );
}
