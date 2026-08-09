"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/database.types";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/public-env";

export function createClient() {
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
}
