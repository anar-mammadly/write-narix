import { Star } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getLocale, type Dictionary } from "@/lib/i18n/get-dictionary";
import { localizeRows } from "@/lib/i18n/localize";

export async function TestimonialsSection({ dict }: { dict: Dictionary }) {
  const supabase = await createServerSupabaseClient();
  const [{ data }, locale] = await Promise.all([
    supabase
      .from("testimonials")
      .select("id, author_name, author_context, quote, rating, translations")
      .eq("is_active", true)
      .order("display_order"),
    getLocale(),
  ]);

  if (!data || data.length === 0) return null;
  const testimonials = localizeRows(data, locale, ["author_name", "author_context", "quote"]);

  return (
    <section id="samples" className="border-t border-border bg-secondary/20 py-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <h2 className="text-center font-heading text-2xl font-semibold text-foreground sm:text-3xl">
          {dict.testimonials.title}
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {testimonials.map((t) => (
            <div key={t.id} className="rounded-xl border border-border bg-card p-6">
              <div className="flex gap-0.5">
                {Array.from({ length: t.rating ?? 5 }).map((_, i) => (
                  <Star key={i} className="size-4 fill-primary text-primary" />
                ))}
              </div>
              <p className="mt-3 text-sm text-foreground">&ldquo;{t.quote}&rdquo;</p>
              <p className="mt-4 text-sm font-medium text-foreground">{t.author_name}</p>
              {t.author_context && <p className="text-xs text-muted-foreground">{t.author_context}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
