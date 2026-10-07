import Link from "next/link";
import { Hammer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { STAGE_LABELS } from "@/lib/constants";
import type { ProjectRow } from "@/types/database";

export function CurrentProjectCard({ project }: { project: ProjectRow | null }) {
  if (!project) {
    return (
      <Card>
        <CardHeader title="Current project" />
        <p className="text-base font-medium">Turn an idea into an approved game blueprint</p>
        <p className="mt-1 text-sm text-muted">Answer a short interview, get three researched concepts, and approve one.</p>
        <Link href="/build" className="mt-4 inline-block"><Button>Start a project</Button></Link>
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center gap-4 p-4">
        {project.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- user-supplied cover host is unknown
          <img src={project.cover_url} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
        ) : (
          <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-soft"><Hammer className="h-7 w-7" aria-hidden /></span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold tracking-wide text-muted uppercase">Current project</p>
          <p className="truncate text-lg font-semibold">{project.title}</p>
          <div className="mt-1 flex items-center gap-2"><Badge tone="brand">{STAGE_LABELS[project.stage]}</Badge><span className="text-xs text-muted">{project.progress}% complete</span></div>
        </div>
      </div>
      <div className="px-4"><Progress value={project.progress} /></div>
      <div className="p-4"><Link href={`/build/${project.id}`}><Button className="w-full sm:w-auto">Resume build</Button></Link></div>
    </Card>
  );
}
