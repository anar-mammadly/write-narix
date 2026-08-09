import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

export function SiteFooter({ dict }: { dict: Dictionary }) {
  return (
    <footer id="contact" className="border-t border-border bg-secondary/40">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 sm:grid-cols-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-navy text-navy-foreground font-heading text-xs">N</span>
            <span className="font-heading text-base font-semibold text-foreground">Narix Academy</span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">{dict.footer.tagline}</p>
        </div>

        <div>
          <p className="text-sm font-medium text-foreground">{dict.footer.company}</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link href="/#services" className="hover:text-foreground">{dict.nav.services}</Link></li>
            <li><Link href="/#faq" className="hover:text-foreground">{dict.nav.faq}</Link></li>
            <li><Link href="/#samples" className="hover:text-foreground">{dict.nav.samples}</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-medium text-foreground">{dict.footer.getInTouch}</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>support@narix.az</li>
            <li>051-560-06-25</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Narix Academy. {dict.footer.rights}
      </div>
    </footer>
  );
}
