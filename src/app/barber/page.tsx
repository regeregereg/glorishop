import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/session";

export default async function BarberIndexPage() {
  const session = await getStaffSession();
  if (session?.role === "barber") {
    redirect("/barber/dashboard");
  }
  redirect("/barber/login");
}
