import { getStaffSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/AdminSidebar";
import { AdminMobileBar } from "@/components/AdminMobileBar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getStaffSession();

  if (!session || session.role !== "admin") {
    redirect("/admin/login");
  }

  return (
    <div className="flex min-h-screen bg-bg">
      <AdminSidebar adminName={session.name} />
      <div className="flex-1">
        <AdminMobileBar />
        <main className="px-5 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
