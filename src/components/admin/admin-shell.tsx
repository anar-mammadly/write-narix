import Link from "next/link";
import {
  LayoutDashboard,
  ListOrdered,
  Gift,
  ListChecks,
  Percent,
  Settings,
  LogOut,
  BookOpen,
  Menu,
  Zap,
} from "lucide-react";
import { signOutAction } from "@/lib/actions/auth";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";

export function AdminShell({
  children,
  pendingReferrals = 0,
  dict,
}: {
  children: React.ReactNode;
  pendingReferrals?: number;
  dict: Dictionary;
}) {
  const nav = [
    { href: "/admin", label: dict.admin.nav.dashboard, icon: LayoutDashboard },
    { href: "/admin/orders", label: dict.admin.nav.orders, icon: ListOrdered },
    { href: "/admin/one-click-orders", label: dict.admin.nav.oneClickOrders, icon: Zap },
    { href: "/admin/referrals", label: dict.admin.nav.referrals, icon: Gift },
    { href: "/admin/statuses", label: dict.admin.nav.statuses, icon: ListChecks },
    { href: "/admin/services", label: dict.admin.nav.services, icon: BookOpen },
    { href: "/admin/discounts", label: dict.admin.nav.discounts, icon: Percent },
    { href: "/admin/settings", label: dict.admin.nav.settings, icon: Settings },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-secondary/10 sm:flex-row">
      <aside className="hidden w-60 shrink-0 border-r border-border bg-navy sm:flex sm:flex-col">
        <Link href="/admin" className="flex items-center gap-2 border-b border-white/10 px-5 py-5">
          <span className="flex size-7 items-center justify-center rounded-md bg-white/10 text-navy-foreground font-heading text-xs">N</span>
          <span className="font-heading text-base font-semibold text-navy-foreground">Narix Admin</span>
        </Link>
        <nav className="flex-1 px-3 py-4">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-navy-foreground/85 hover:bg-white/5"
            >
              <span className="flex items-center gap-2.5">
                <item.icon className="size-4" />
                {item.label}
              </span>
              {item.href === "/admin/referrals" && pendingReferrals > 0 && (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                  {pendingReferrals}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <form action={signOutAction} className="border-t border-white/10 p-3">
          <Button variant="ghost" className="w-full justify-start gap-2.5 text-navy-foreground hover:bg-white/5 hover:text-navy-foreground" type="submit">
            <LogOut className="size-4" /> {dict.common.signOut}
          </Button>
        </form>
      </aside>
      <div className="flex items-center justify-between border-b border-border bg-navy px-4 py-3 sm:hidden">
        <Link href="/admin" className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-white/10 text-navy-foreground font-heading text-xs">N</span>
          <span className="font-heading text-sm font-semibold text-navy-foreground">Narix Admin</span>
        </Link>
        <Sheet>
          <SheetTrigger render={<Button variant="ghost" size="icon" aria-label={dict.nav.menu} className="text-navy-foreground hover:bg-white/10 hover:text-navy-foreground" />}>
            <Menu className="size-5" />
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <SheetHeader>
              <SheetTitle className="font-heading">Narix Admin</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-1 px-4">
              {nav.map((item) => (
                <Link key={item.href} href={item.href} className="flex items-center justify-between rounded-md px-2 py-2.5 text-sm text-foreground hover:bg-muted">
                  <span className="flex items-center gap-2.5">
                    <item.icon className="size-4 text-muted-foreground" />
                    {item.label}
                  </span>
                  {item.href === "/admin/referrals" && pendingReferrals > 0 && (
                    <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                      {pendingReferrals}
                    </span>
                  )}
                </Link>
              ))}
            </nav>
            <form action={signOutAction} className="mt-2 px-4">
              <Button variant="ghost" className="w-full justify-start gap-2.5" type="submit">
                <LogOut className="size-4" /> {dict.common.signOut}
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
