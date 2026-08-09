import type { Dictionary } from "@/lib/i18n/get-dictionary";

export function HowItWorks({ dict }: { dict: Dictionary }) {
  const steps = [
    { title: dict.howItWorks.step1Title, body: dict.howItWorks.step1Body },
    { title: dict.howItWorks.step2Title, body: dict.howItWorks.step2Body },
    { title: dict.howItWorks.step3Title, body: dict.howItWorks.step3Body },
    { title: dict.howItWorks.step4Title, body: dict.howItWorks.step4Body },
  ];

  return (
    <section id="how-it-works" className="border-t border-border bg-secondary/20 py-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <h2 className="text-center font-heading text-2xl font-semibold text-foreground sm:text-3xl">{dict.howItWorks.title}</h2>
        <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <div key={step.title} className="relative">
              <span className="font-heading text-3xl font-semibold text-primary/25">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-2 font-medium text-foreground">{step.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
