import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// Service-role client. Bypasses RLS entirely — this file is guarded by the
// `server-only` import, and the key itself is never exposed to any bundle
// that reaches the browser. Use only in: the notification-outbox worker
// route, and the guest-token lookup route (both of which perform their own
// equivalent authorization check in place of RLS).
let adminClient: SupabaseClient<Database> | null = null;

export function createAdminSupabaseClient() {
  if (!adminClient) {
    adminClient = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return adminClient;
}
