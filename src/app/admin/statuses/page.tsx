import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { Badge } from "@/components/ui/badge";
import { StatusCreateForm } from "@/components/admin/status-create-form";
import { StatusActiveToggle } from "@/components/admin/status-active-toggle";

export default async function AdminStatusesPage() {
  const supabase = await createServerSupabaseClient();
  const [{ data: statuses }, dict] = await Promise.all([
    supabase.from("order_statuses").select("id, name, color, display_order, is_active, is_terminal").order("display_order"),
    getDictionary(),
  ]);
  const t = dict.admin.statuses;

  const nextOrder = ((statuses ?? []).at(-1)?.display_order ?? 0) + 10;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">{t.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>

      <div className="mt-6 rounded-xl border border-border bg-card">
        <ul className="divide-y divide-border">
          {(statuses ?? []).map((s) => (
            <li key={s.id} className="flex items-center justify-between px-5 py-3.5">
              <span className="flex items-center gap-3">
                <Badge style={{ backgroundColor: s.color, color: "white" }}>{s.name}</Badge>
                {s.is_terminal && <span className="text-xs text-muted-foreground">{t.terminal}</span>}
              </span>
              <StatusActiveToggle id={s.id} active={s.is_active} />
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6">
        <StatusCreateForm nextOrder={nextOrder} dict={dict} />
      </div>
    </div>
  );
}
