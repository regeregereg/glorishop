import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/session";
import { revalidatePath } from "next/cache";

// DELETE /api/barbers/[id]/portfolio/[photoId] -> admin only

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  const staff = await getStaffSession();
  if (!staff || staff.role !== "admin") {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id, photoId } = await params;
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("barber_portfolios")
    .delete()
    .eq("id", photoId)
    .eq("barber_id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath(`/barber/${id}`);

  return NextResponse.json({ ok: true });
}
