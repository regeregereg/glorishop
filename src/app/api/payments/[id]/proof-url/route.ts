import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserSession, getStaffSession } from "@/lib/session";

const BUCKET = "payment-proofs";
const SIGNED_URL_TTL_SECONDS = 60 * 5; // 5 menit, cukup untuk dilihat admin/pelanggan saat itu

// GET /api/payments/[id]/proof-url
// Mengembalikan signed URL sementara untuk melihat bukti transfer.
// Bucket privat, jadi tidak ada public URL permanen — harus selalu lewat sini.
// Diizinkan untuk: admin (semua), atau pelanggan pemilik booking tersebut.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const staffSession = await getStaffSession();
  const userSession = await getUserSession();

  if (!staffSession && !userSession) {
    return NextResponse.json({ error: "Silakan login terlebih dahulu." }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("*, booking:bookings(user_id)")
    .eq("id", id)
    .single();

  if (paymentError || !payment) {
    return NextResponse.json({ error: "Data pembayaran tidak ditemukan." }, { status: 404 });
  }

  const isAdmin = staffSession?.role === "admin";
  const isOwner = userSession && payment.booking?.user_id === userSession.id;

  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  if (!payment.proof_url) {
    return NextResponse.json({ error: "Bukti transfer belum diunggah." }, { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(payment.proof_url, SIGNED_URL_TTL_SECONDS);

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Gagal membuat URL." }, { status: 500 });
  }

  return NextResponse.json({ url: data.signedUrl });
}
