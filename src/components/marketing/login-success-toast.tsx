"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

// Login lands on the homepage (not /dashboard) with a `?login=success`
// marker; this fires the confirmation toast once, then strips the marker
// from the URL so a refresh or share of the link doesn't re-trigger it.
export function LoginSuccessToast({ message }: { message: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shouldNotify = searchParams.get("login") === "success";

  useEffect(() => {
    if (!shouldNotify) return;
    toast.success(message, { duration: 3000 });
    const params = new URLSearchParams(searchParams);
    params.delete("login");
    const query = params.toString();
    router.replace(query ? `/?${query}` : "/", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run exactly once for this landing, not on every searchParams identity change
  }, [shouldNotify]);

  return null;
}
