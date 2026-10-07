import { CardSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton lines={4} />
      <CardSkeleton lines={4} />
    </div>
  );
}
