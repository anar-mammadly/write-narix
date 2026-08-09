import { ShieldCheck, GraduationCap, Clock3, Gift } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCalculatorConfig } from "@/lib/data/calculator-config";
import { getSiteSettings } from "@/lib/data/site-settings";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { Calculator } from "@/components/calculator/calculator";
import { FaqSection } from "@/components/marketing/faq-section";
import { TestimonialsSection } from "@/components/marketing/testimonials-section";
import { HowItWorks } from "@/components/marketing/how-it-works";

export default async function HomePage() {
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  const locale = await getLocale();
  const [config, settings, dict] = await Promise.all([getCalculatorConfig(locale), getSiteSettings(locale), getDictionary()]);

  return (
    <>
      <section className="relative overflow-hidden bg-secondary/30 pt-16 pb-14 sm:pt-24 sm:pb-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          {settings.earlyOrderBannerEnabled && settings.earlyOrderBannerText && (
            <div className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground">
              <Gift className="size-4" />
              {settings.earlyOrderBannerText}
            </div>
          )}

          <h1 className="font-heading text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            {dict.hero.title}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            {dict.hero.subtitle}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-2"><ShieldCheck className="size-4 text-success" /> {dict.hero.trustConfidential}</span>
            <span className="flex items-center gap-2"><GraduationCap className="size-4 text-success" /> {dict.hero.trustExpert}</span>
            <span className="flex items-center gap-2"><Clock3 className="size-4 text-success" /> {dict.hero.trustOnTime}</span>
          </div>

          <div className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-1.5 text-sm text-muted-foreground">
            <Gift className="size-4 text-primary" />
            {dict.hero.referralBadge}
          </div>
        </div>
      </section>

      <section id="calculator" className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
        <Calculator config={config} isAuthenticated={!!userData.user} dict={dict} />
      </section>

      <HowItWorks dict={dict} />
      <FaqSection dict={dict} />
      <TestimonialsSection dict={dict} />
    </>
  );
}
