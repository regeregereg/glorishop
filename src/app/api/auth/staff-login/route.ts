import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { setStaffSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const username = (body.username as string)?.trim().toLowerCase();
    const password = body.password as string;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username dan password wajib diisi." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const { data: staff, error } = await supabase
      .from("staff")
      .select("*")
      .eq("username", username)
      .eq("is_active", true)
      .maybeSingle();

    if (error) throw error;

    if (!staff || !bcrypt.compareSync(password, staff.password_hash)) {
      return NextResponse.json(
        { error: "Username atau password salah." },
        { status: 401 }
      );
    }

    await setStaffSession({
      type: "staff",
      id: staff.id,
      name: staff.name,
      role: staff.role,
    });

    return NextResponse.json({
      staff: { id: staff.id, name: staff.name, role: staff.role },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal login. Coba lagi." }, { status: 500 });
  }
}
