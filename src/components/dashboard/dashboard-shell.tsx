import Link from "next/link";
import {
  LayoutDashboard,
  ListOrdered,
  Bell,
  Gift,
  UserRound,
  LogOut,
  Menu,
} from "lucide-react";
import { signOutAction } from "@/lib/actions/auth";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";

export function DashboardShell({
  children,
  unreadCount = 0,
  dict,
}: {
  children: React.ReactNode;
  unreadCount?: number;
  dict: Dictionary;
}) {
  const nav = [
    { href: "/dashboard", label: dict.dashboard.nav.overview, icon: LayoutDashboard },
    { href: "/dashboard/orders", label: dict.dashboard.nav.myOrders, icon: ListOrdered },
    { href: "/dashboard/notifications", label: dict.dashboard.nav.notifications, icon: Bell },
    { href: "/dashboard/referral", label: dict.dashboard.nav.referral, icon: Gift },
    { href: "/dashboard/profile", label: dict.dashboard.nav.profile, icon: UserRound },
  ];

  return (
    <div className="flex min-h-screen bg-secondary/20">
      <aside className="hidden w-60 shrink-0 border-r border-border bg-card sm:flex sm:flex-col">
        <Link href="/" className="flex items-center gap-2 border-b border-border px-5 py-5">
          <span className="flex size-7 items-center justify-center rounded-md bg-navy text-navy-foreground font-heading text-xs">N</span>
          <span className="font-heading text-base font-semibold text-foreground">Narix Academy</span>
        </Link>
        <nav className="flex-1 px-3 py-4">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-muted"
            >
              <span className="flex items-center gap-2.5">
                <item.icon className="size-4 text-muted-foreground" />
                {item.label}
              </span>
              {item.href === "/dashboard/notifications" && unreadCount > 0 && (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                  {unreadCount}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <form action={signOutAction} className="border-t border-border p-3">
          <Button variant="ghost" className="w-full justify-start gap-2.5" type="submit">
            <LogOut className="size-4" /> {dict.common.signOut}
          </Button>
        </form>
      </aside>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3 sm:hidden">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-navy text-navy-foreground font-heading text-xs">N</span>
            <span className="font-heading text-sm font-semibold text-foreground">Narix Academy</span>
          </Link>
          <Sheet>
            <SheetTrigger render={<Button variant="ghost" size="icon" aria-label={dict.nav.menu} />}>
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <SheetHeader>
                <SheetTitle className="font-heading">{dict.nav.menu}</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-4">
                {nav.map((item) => (
                  <Link key={item.href} href={item.href} className="flex items-center gap-2.5 rounded-md px-2 py-2.5 text-sm text-foreground hover:bg-muted">
                    <item.icon className="size-4 text-muted-foreground" />
                    {item.label}
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
        {children}
      </div>
    </div>
  );
}
