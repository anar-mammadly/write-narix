import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetHeader,
} from "@/components/ui/sheet";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

export function SiteHeader({
  isAuthenticated,
  dict,
  locale,
}: {
  isAuthenticated: boolean;
  dict: Dictionary;
  locale: Locale;
}) {
  const navLinks = [
    { href: "/#services", label: dict.nav.services },
    { href: "/#how-it-works", label: dict.nav.howItWorks },
    { href: "/#pricing", label: dict.nav.pricing },
    { href: "/#samples", label: dict.nav.samples },
    { href: "/#faq", label: dict.nav.faq },
    { href: "/#contact", label: dict.nav.contact },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-navy text-navy-foreground font-heading text-sm">N</span>
          <span className="font-heading text-lg font-semibold text-foreground">Narix Academy</span>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <LanguageSwitcher locale={locale} />
          <Button variant="ghost" render={<Link href={isAuthenticated ? "/dashboard" : "/login"} />}>
            {isAuthenticated ? dict.nav.dashboard : dict.nav.login}
          </Button>
          <Button render={<Link href="/#calculator" />}>{dict.nav.getStarted}</Button>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <LanguageSwitcher locale={locale} />
          <Sheet>
            <SheetTrigger
              render={<Button variant="ghost" size="icon" aria-label={dict.nav.menu} />}
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle className="font-heading">Narix Academy</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-4">
                {navLinks.map((link) => (
                  <Link key={link.href} href={link.href} className="rounded-md px-2 py-2.5 text-sm text-foreground hover:bg-muted">
                    {link.label}
                  </Link>
                ))}
              </nav>
              <div className="mt-4 flex flex-col gap-2 px-4">
                <Button variant="outline" render={<Link href={isAuthenticated ? "/dashboard" : "/login"} />}>
                  {isAuthenticated ? dict.nav.dashboard : dict.nav.login}
                </Button>
                <Button render={<Link href="/#calculator" />}>{dict.nav.getStarted}</Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
