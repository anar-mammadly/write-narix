import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getLocale, type Dictionary } from "@/lib/i18n/get-dictionary";
import { localizeRows } from "@/lib/i18n/localize";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export async function FaqSection({ dict }: { dict: Dictionary }) {
  const supabase = await createServerSupabaseClient();
  const [{ data }, locale] = await Promise.all([
    supabase
      .from("faqs")
      .select("id, question, answer, translations")
      .eq("is_active", true)
      .order("display_order"),
    getLocale(),
  ]);

  if (!data || data.length === 0) return null;
  const faqs = localizeRows(data, locale, ["question", "answer"]);

  return (
    <section id="faq" className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h2 className="text-center font-heading text-2xl font-semibold text-foreground sm:text-3xl">
        {dict.faqSection.title}
      </h2>
      <Accordion className="mt-8">
        {faqs.map((faq) => (
          <AccordionItem key={faq.id} value={faq.id}>
            <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">{faq.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
