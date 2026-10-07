"use client";

import { LogOut } from "lucide-react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { signOut } from "./actions";

export function SignOutButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button variant="secondary" loading={pending} onClick={() => startTransition(() => signOut())}>
      <LogOut className="h-4 w-4" aria-hidden /> Sign out
    </Button>
  );
}
