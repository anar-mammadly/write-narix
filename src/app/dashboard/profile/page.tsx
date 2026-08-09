import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { Badge } from "@/components/ui/badge";

export default async function ProfilePage() {
  const supabase = await createServerSupabaseClient();
  const [{ data: userData }, dict] = await Promise.all([supabase.auth.getUser(), getDictionary()]);
  if (!userData.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone, university, country, email_verified")
    .eq("id", userData.user.id)
    .single();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">{dict.dashboard.profile.title}</h1>

      <div className="mt-4 flex items-center gap-3 text-sm">
        <span className="text-muted-foreground">{userData.user.email}</span>
        <Badge variant={profile?.email_verified ? "default" : "outline"}>
          {profile?.email_verified ? dict.dashboard.profile.verified : dict.dashboard.profile.unverified}
        </Badge>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card p-6">
        <ProfileForm
          dict={dict}
          fullName={profile?.full_name ?? null}
          phone={profile?.phone ?? null}
          university={profile?.university ?? null}
          country={profile?.country ?? null}
        />
      </div>
    </div>
  );
}
