import { NextRequest, NextResponse } from "next/server";
import { clearUserSession, clearStaffSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (body.type === "staff") {
    await clearStaffSession();
  } else {
    await clearUserSession();
  }
  return NextResponse.json({ ok: true });
}
