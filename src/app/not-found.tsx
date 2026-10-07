import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-5 text-center">
      <p className="text-5xl font-semibold tracking-tight text-brand-hover">404</p>
      <h1 className="text-lg font-semibold">We couldn&apos;t find that page</h1>
      <p className="max-w-sm text-sm text-muted">It may have moved, or you may not have access to it.</p>
      <Link href="/home" className="mt-2 rounded-xl bg-brand px-4 py-2 text-sm font-medium hover:bg-brand-hover">Back to Home</Link>
    </main>
  );
}
