// Public, non-secret config — safe to hardcode as a fallback. Cloudflare's
// CI build environment doesn't see .env.local (git-ignored by design), so
// without a fallback these NEXT_PUBLIC_ vars would be inlined as `undefined`
// into the build unless configured separately as Cloudflare build
// variables. The Supabase URL and anon key are meant to be public; baking
// them in here means the app works correctly out of the box regardless of
// the deploy environment, while still respecting an explicit override.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://xvyjgtberntyzfcivhpo.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2eWpndGJlcm50eXpmY2l2aHBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyNzAyODMsImV4cCI6MjEwMTg0NjI4M30.6bLUBIiTiq0l6IZtIWUy6VINHssJfSwkjaftaC_VcwY";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://write.narix.az";
