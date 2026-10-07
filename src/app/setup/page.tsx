import { isSupabaseConfigured } from "@/lib/env";
import { redirect } from "next/navigation";

export const metadata = { title: "Setup required" };

export default function SetupPage() {
  if (isSupabaseConfigured()) redirect("/login");
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 px-5 py-10">
      <h1 className="text-2xl font-semibold">DevMint needs a Supabase project</h1>
      <p className="text-sm text-muted">
        The required environment variables are missing, so there is nothing to sign in to yet. Copy{" "}
        <code className="rounded bg-surface-3 px-1.5 py-0.5">.env.example</code> to{" "}
        <code className="rounded bg-surface-3 px-1.5 py-0.5">.env.local</code>, fill in your Supabase URL, anon key and
        service-role key, apply the migrations in <code className="rounded bg-surface-3 px-1.5 py-0.5">supabase/migrations</code>,
        then restart the dev server. The README has exact steps.
      </p>
    </main>
  );
}
