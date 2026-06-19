import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Client ini HANYA boleh dipakai di server (API routes / server actions).
// Memakai service_role key sehingga bypass RLS — jangan pernah expose ke browser.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );
}
