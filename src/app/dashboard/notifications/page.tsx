import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { MarkNotificationsRead } from "@/components/dashboard/mark-notifications-read";
import { cn } from "@/lib/utils";

export default async function NotificationsPage() {
  const supabase = await createServerSupabaseClient();
  const [{ data: userData }, dict] = await Promise.all([supabase.auth.getUser(), getDictionary()]);
  if (!userData.user) return null;

  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, type, title, body, is_read, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-semibold text-foreground">{dict.dashboard.notifications.title}</h1>
        <MarkNotificationsRead ids={(notifications ?? []).filter((n) => !n.is_read).map((n) => n.id)} label={dict.dashboard.notifications.markAllRead} />
      </div>

      <ul className="mt-6 space-y-2">
        {(notifications ?? []).map((n) => (
          <li key={n.id} className={cn("rounded-lg border border-border p-4", !n.is_read && "bg-accent/60")}>
            <p className="text-sm font-medium text-foreground">{n.title}</p>
            {n.body && <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>}
            <p className="mt-1 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
          </li>
        ))}
        {(!notifications || notifications.length === 0) && (
          <p className="text-sm text-muted-foreground">{dict.dashboard.notifications.empty}</p>
        )}
      </ul>
    </div>
  );
}
