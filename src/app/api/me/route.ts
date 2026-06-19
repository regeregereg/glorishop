import { NextResponse } from "next/server";
import { getUserSession, getStaffSession } from "@/lib/session";

export async function GET() {
  const user = await getUserSession();
  const staff = await getStaffSession();
  return NextResponse.json({ user, staff });
}
