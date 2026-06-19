import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { setUserSession } from "@/lib/session";

// Login sederhana: nama + nomor telepon.
// Jika nomor telepon belum terdaftar, otomatis buat akun baru.
// Jika sudah terdaftar, pakai nama yang tersimpan (login ulang).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = (body.name as string)?.trim();
    let phone = (body.phone as string)?.trim();

    if (!phone) {
      return NextResponse.json({ error: "Nomor telepon wajib diisi." }, { status: 400 });
    }

    // Normalisasi nomor: hapus spasi/strip, ubah 0 di depan jadi 62
    phone = phone.replace(/[\s-]/g, "");
    if (phone.startsWith("0")) phone = "62" + phone.slice(1);
    if (phone.startsWith("+")) phone = phone.slice(1);

    if (!/^\d{9,15}$/.test(phone)) {
      return NextResponse.json(
        { error: "Format nomor telepon tidak valid." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: existing, error: findError } = await supabase
      .from("users")
      .select("*")
      .eq("phone", phone)
      .maybeSingle();

    if (findError) throw findError;

    let user = existing;

    if (!user) {
      if (!name) {
        return NextResponse.json(
          { error: "Nama wajib diisi untuk pendaftaran baru." },
          { status: 400 }
        );
      }
      const { data: created, error: createError } = await supabase
        .from("users")
        .insert({ name, phone })
        .select("*")
        .single();
      if (createError) throw createError;
      user = created;
    }

    await setUserSession({ type: "user", id: user.id, name: user.name });

    return NextResponse.json({ user });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal login. Coba lagi." }, { status: 500 });
  }
}
