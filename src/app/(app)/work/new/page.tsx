import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { JobForm } from "@/features/work/job-form";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Post a job" };

export default async function NewJobPage() {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const { data: members } = await supabase.from("project_members").select("project_id").eq("user_id", viewer.id).eq("role", "owner");
  const ids = (members ?? []).map((m) => m.project_id);
  const { data: projects } = ids.length ? await supabase.from("projects").select("id, title").in("id", ids).eq("status", "active") : { data: [] };
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Post a job" subtitle="One person or a whole team: set slots, deliverables and pay." />
      <Card><JobForm projects={projects ?? []} /></Card>
    </div>
  );
}
