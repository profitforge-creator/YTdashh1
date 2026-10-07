export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-5 py-10">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-lg font-bold">D</span>
        <span className="text-lg font-semibold tracking-tight">DevMint</span>
      </div>
      {children}
    </main>
  );
}
