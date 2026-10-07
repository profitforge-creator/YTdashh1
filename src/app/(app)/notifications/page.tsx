import { Bell } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { NotificationList } from "@/features/profile/notification-list";
import { requireViewer } from "@/lib/auth";
import { groupNotifications } from "@/lib/notifications/group";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const { data } = await supabase.from("notifications").select("*").eq("user_id", viewer.id).order("created_at", { ascending: false }).limit(100);
  const groups = groupNotifications(data ?? []);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Notifications" subtitle="Payments and security alerts are always immediate; busy events are grouped." />
      {groups.length === 0 ? <EmptyState icon={<Bell className="h-6 w-6" aria-hidden />} title="Nothing here yet" body="Job updates, messages, payments and build results show up here." /> : <NotificationList groups={groups} />}
    </div>
  );
}
