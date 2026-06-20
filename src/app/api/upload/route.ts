import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// Nama bucket Supabase Storage tempat semua foto (barber, layanan, produk)
// disimpan. Bucket ini harus dibuat dulu di Supabase (lihat
// supabase/storage.sql) dan di-set sebagai "public".
const BUCKET = "photos";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

// Folder yang diizinkan, supaya file tertata rapi di storage:
// photos/barber/xxx.jpg, photos/layanan/xxx.jpg, photos/produk/xxx.jpg
const ALLOWED_FOLDERS = ["barber", "layanan", "produk", "portfolio"];

export async function POST(req: NextRequest) {
  // Hanya admin yang boleh upload foto (form layanan/barber/produk
  // semuanya ada di area admin).
  const staff = await getStaffSession();
  if (!staff || staff.role !== "admin") {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  const folderRaw = formData?.get("folder");
  const folder = ALLOWED_FOLDERS.includes(String(folderRaw)) ? String(folderRaw) : "misc";

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "File tidak ditemukan." }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Format file harus JPG, PNG, WEBP, atau AVIF." },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: "Ukuran file maksimal 5MB." },
      { status: 400 }
    );
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const fileName = `${folder}/${crypto.randomUUID()}.${ext}`;

  const supabase = createAdminClient();
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);

  return NextResponse.json({ url: publicUrlData.publicUrl, path: fileName });
}

// Hapus foto lama dari storage (dipanggil saat ganti foto / hapus data).
export async function DELETE(req: NextRequest) {
  const staff = await getStaffSession();
  if (!staff || staff.role !== "admin") {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const path = body.path as string | undefined;
  if (!path) {
    return NextResponse.json({ error: "Path wajib diisi." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.storage.from(BUCKET).remove([path]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
