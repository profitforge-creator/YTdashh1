"use client";

import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-20 text-center">
      <h1 className="text-lg font-semibold">This page hit a problem</h1>
      <p className="text-sm text-muted">
        {error.digest ? `Reference: ${error.digest}. ` : ""}Try again, and if it keeps happening let us know.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
