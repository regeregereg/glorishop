import { NextRequest, NextResponse } from "next/server";
import { getUserSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(req: NextRequest) {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json({ error: "Belum login." }, { status: 401 });
  }

  const body = await req.json();
  let waNumber: string | null = (body.wa_number as string | null) ?? null;

  // Kalau dikirim string kosong, simpan null (artinya "gunakan nomor login")
  if (waNumber !== null) {
    waNumber = waNumber.trim();
    if (waNumber === "") {
      waNumber = null;
    } else {
      // Normalisasi: hapus spasi/strip, ubah 0 di depan → 62
      waNumber = waNumber.replace(/[\s-]/g, "");
      if (waNumber.startsWith("0")) waNumber = "62" + waNumber.slice(1);
      if (waNumber.startsWith("+")) waNumber = waNumber.slice(1);

      if (!/^\d{9,15}$/.test(waNumber)) {
        return NextResponse.json(
          { error: "Format nomor WhatsApp tidak valid." },
          { status: 400 }
        );
      }
    }
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("users")
    .update({ wa_number: waNumber })
    .eq("id", session.id);

  if (error) {
    console.error("Update wa_number error:", error);
    return NextResponse.json({ error: "Gagal menyimpan. Coba lagi." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
