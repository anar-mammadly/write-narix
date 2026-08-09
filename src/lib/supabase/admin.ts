import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { SUPABASE_URL } from "@/lib/public-env";

// Service-role client. Bypasses RLS entirely — this file is guarded by the
// `server-only` import, and the key itself is never exposed to any bundle
// that reaches the browser. Use only in: the notification-outbox worker
// route, and the guest-token lookup route (both of which perform their own
// equivalent authorization check in place of RLS). Unlike the URL/anon key,
// the service role key is a real secret and has no fallback — it must come
// from the deploy environment.
let adminClient: SupabaseClient<Database> | null = null;

export function createAdminSupabaseClient() {
  if (!adminClient) {
    adminClient = createClient<Database>(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return adminClient;
}
