import { BottomNav } from "@/components/layout/bottom-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { ServiceWorker } from "@/components/layout/service-worker";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Everything in the app shell is per-user; never prerender it.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  const supabase = await createClient();

  const [{ count: unread }, { data: memberships }] = await Promise.all([
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", viewer.id).is("read_at", null),
    supabase.from("conversation_members").select("conversation_id, last_read_at, status").eq("user_id", viewer.id).eq("status", "active"),
  ]);

  let unreadMessages = 0;
  if (memberships && memberships.length > 0) {
    const results = await Promise.all(
      memberships.map(async (m) => {
        const { count } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", m.conversation_id)
          .neq("sender_id", viewer.id)
          .gt("created_at", m.last_read_at);
        return count ?? 0;
      }),
    );
    unreadMessages = results.reduce((a, b) => a + b, 0);
  }

  return (
    <div className="min-h-dvh">
      <Sidebar />
      <div className="lg:pl-60">
        <Topbar userId={viewer.id} initialUnread={unread ?? 0} initialMessages={unreadMessages} />
        <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 lg:px-8 lg:pb-12">{children}</main>
      </div>
      <BottomNav />
      <ServiceWorker />
    </div>
  );
}
