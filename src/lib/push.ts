import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

// Konfigurasi VAPID — kunci identitas server untuk web push (GRATIS,
// berbeda dari WhatsApp Business API yang berbayar). Kunci ini sekali
// generate dan dipakai terus; lihat README untuk cara generate ulang
// kalau diperlukan (`npx web-push generate-vapid-keys`).
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@glori-barbershop.com";

let configured = false;
function ensureConfigured() {
  if (configured) return;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    throw new Error(
      "VAPID keys belum diatur. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY dan VAPID_PRIVATE_KEY di .env.local"
    );
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string; // halaman yang dibuka saat notifikasi diklik, contoh "/booking/status"
  icon?: string;
  tag?: string; // mengelompokkan notifikasi serupa (mis. update status booking yang sama)
}

/**
 * Kirim push notification ke semua device milik satu pelanggan (user_id)
 * atau satu staff (staff_id). Subscription yang sudah tidak valid (404/410
 * dari browser, mis. karena uninstall) otomatis dihapus dari database.
 */
export async function sendPushToTarget(
  target: { userId?: string; staffId?: string },
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  ensureConfigured();
  const supabase = createAdminClient();

  let query = supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth");
  if (target.userId) query = query.eq("user_id", target.userId);
  else if (target.staffId) query = query.eq("staff_id", target.staffId);
  else return { sent: 0, failed: 0 };

  const { data: subs } = await query;
  if (!subs || subs.length === 0) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  const staleIds: string[] = [];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload)
        );
        sent++;
      } catch (err: unknown) {
        failed++;
        // 404/410 berarti subscription sudah tidak valid (browser uninstall,
        // izin dicabut, dll) — bersihkan dari database supaya tidak terus
        // dicoba kirim ke endpoint mati.
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          staleIds.push(sub.id);
        }
      }
    })
  );

  if (staleIds.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", staleIds);
  }

  return { sent, failed };
}

/**
 * Kirim push notification ke SEMUA staff dengan role admin (broadcast).
 * Dipakai untuk notifikasi yang relevan untuk semua admin, mis. "ada
 * booking baru masuk" — bukan ditujukan ke satu staff tertentu.
 */
export async function sendPushToAllAdmins(payload: PushPayload): Promise<{ sent: number; failed: number }> {
  ensureConfigured();
  const supabase = createAdminClient();

  const { data: admins } = await supabase.from("staff").select("id").eq("role", "admin");
  if (!admins || admins.length === 0) return { sent: 0, failed: 0 };

  const results = await Promise.all(
    admins.map((admin) => sendPushToTarget({ staffId: admin.id }, payload))
  );

  return results.reduce(
    (acc, r) => ({ sent: acc.sent + r.sent, failed: acc.failed + r.failed }),
    { sent: 0, failed: 0 }
  );
}
