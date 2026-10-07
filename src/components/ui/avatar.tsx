import { cn, initials } from "@/lib/utils";

export function Avatar({
  name,
  src,
  size = 36,
  className,
}: {
  name: string;
  src?: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const style = { width: size, height: size, fontSize: Math.max(10, size * 0.36) };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- avatars come from arbitrary OAuth hosts
    return <img src={src} alt="" style={style} className={cn("shrink-0 rounded-full object-cover", className)} />;
  }
  return (
    <span
      style={style}
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-brand-soft font-semibold text-[#ff8da1]",
        className,
      )}
    >
      {initials(name) || "?"}
    </span>
  );
}
