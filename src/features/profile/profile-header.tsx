import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { TIERS } from "@/lib/rank/score";
import type { PerkRow, ProfileRow, RankSnapshotRow } from "@/types/database";

export function ProfileHeader({
  profile, rank, perks, followers, following, rating, children,
}: {
  profile: ProfileRow;
  rank: RankSnapshotRow | null;
  perks: PerkRow[];
  followers: number;
  following: number;
  rating: { avg: number; count: number } | null;
  children?: React.ReactNode;
}) {
  const tier = TIERS.find((t) => t.tier === rank?.tier)?.label ?? "Newcomer";
  const effects = perks.filter((p) => p.kind === "profile_effect").map((p) => p.label);
  const ring = effects.some((e) => e.includes("glow")) ? "ring-2 ring-brand-hover shadow-[0_0_24px_rgba(201,23,58,0.45)]" : effects.length ? "ring-2 ring-brand" : "";
  return (
    <div className="rounded-[var(--radius-card)] border bg-surface p-5">
      <div className="flex items-start gap-4">
        <Avatar name={profile.display_name} src={profile.avatar_url} size={72} className={ring} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-semibold">{profile.display_name}</h1>
            {profile.is_official ? <Badge tone="brand">Official</Badge> : profile.is_demo ? <Badge>Demo profile</Badge> : null}
            <Badge tone="brand">{tier}{rank ? ` · ${Number(rank.score).toFixed(1)}` : ""}</Badge>
          </div>
          <p className="text-sm text-muted">@{profile.handle}</p>
          {profile.bio ? <p className="mt-2 text-sm">{profile.bio}</p> : null}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            <span><b className="text-fg">{followers}</b> followers</span>
            <span><b className="text-fg">{following}</b> following</span>
            {rating ? <span><b className="text-fg">{rating.avg.toFixed(1)}★</b> from {rating.count} review{rating.count === 1 ? "" : "s"}</span> : null}
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {profile.roles.map((r) => <Badge key={r} tone="active">{r}</Badge>)}
        {profile.skills.slice(0, 6).map((s) => <Badge key={s}>{s}</Badge>)}
        {perks.filter((p) => p.kind === "badge").map((p) => <Badge key={p.id} tone="warning">{p.label}</Badge>)}
      </div>
      {children ? <div className="mt-4 border-t pt-4">{children}</div> : null}
    </div>
  );
}
