import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSiteSettings } from "@/lib/data/site-settings";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { WhatsAppButton } from "@/components/layout/whatsapp-button";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  const settings = await getSiteSettings();
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);

  return (
    <>
      <SiteHeader isAuthenticated={!!data.user} dict={dict} locale={locale} />
      <main className="flex-1">{children}</main>
      <SiteFooter dict={dict} />
      <WhatsAppButton number={settings.whatsappNumber} message={dict.whatsapp.orderMessage} ariaLabel={dict.whatsapp.aria} />
    </>
  );
}
