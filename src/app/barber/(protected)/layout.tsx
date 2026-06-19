import { getStaffSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { BarberNav } from "@/components/BarberNav";

export default async function BarberProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getStaffSession();

  if (!session || session.role !== "barber") {
    redirect("/barber/login");
  }

  return (
    <div className="min-h-screen bg-bg pb-24">
      {children}
      <BarberNav />
    </div>
  );
}
