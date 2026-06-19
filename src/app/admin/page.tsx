import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/session";

export default async function AdminIndexPage() {
  const session = await getStaffSession();
  if (session?.role === "admin") {
    redirect("/admin/dashboard");
  }
  redirect("/admin/login");
}
