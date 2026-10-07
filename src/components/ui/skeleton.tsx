import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton h-4 w-full", className)} aria-hidden />;
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-[var(--radius-card)] border bg-surface p-4" role="status" aria-label="Loading">
      <Skeleton className="mb-4 h-3 w-24" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={i === 0 ? "mb-2 h-8 w-1/2" : "mb-2 h-3 w-full"} />
      ))}
    </div>
  );
}
