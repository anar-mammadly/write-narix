"use client";

import { useActionState } from "react";
import { updateProfileAction, type ProfileActionResult } from "@/lib/actions/profile";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ProfileActionResult = { error: null };

export function ProfileForm({
  fullName,
  phone,
  university,
  country,
  dict,
}: {
  fullName: string | null;
  phone: string | null;
  university: string | null;
  country: string | null;
  dict: Dictionary;
}) {
  const [state, formAction, pending] = useActionState(updateProfileAction, initialState);

  return (
    <form action={formAction} className="grid gap-5 sm:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor="fullName">{dict.dashboard.profile.fullName}</Label>
        <Input id="fullName" name="fullName" defaultValue={fullName ?? ""} required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="phone">{dict.dashboard.profile.phone}</Label>
        <Input id="phone" name="phone" defaultValue={phone ?? ""} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="university">{dict.dashboard.profile.university}</Label>
        <Input id="university" name="university" defaultValue={university ?? ""} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="country">{dict.dashboard.profile.country}</Label>
        <Input id="country" name="country" defaultValue={country ?? ""} />
      </div>
      <div className="sm:col-span-2">
        {state.error && <p className="mb-3 text-sm text-destructive">{state.error}</p>}
        {state.success && <p className="mb-3 text-sm text-success">{dict.common.saved}.</p>}
        <Button type="submit" disabled={pending}>{pending ? dict.common.loading : dict.common.save}</Button>
      </div>
    </form>
  );
}
