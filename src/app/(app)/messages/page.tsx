import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Chat } from "@/features/messages/chat";
import { RequestActions } from "@/features/messages/request-actions";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn, timeAgo } from "@/lib/utils";

export const metadata = { title: "Messages" };

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c: selectedId } = await searchParams;
  const viewer = await requireViewer();
  const supabase = await createClient();

  const [{ data: mine }, { data: requests }] = await Promise.all([
    supabase.from("conversation_members").select("conversation_id, status, last_read_at").eq("user_id", viewer.id),
    supabase.from("message_requests").select("*").eq("status", "pending").eq("recipient_id", viewer.id),
  ]);
  const convIds = (mine ?? []).filter((m) => m.status === "active").map((m) => m.conversation_id);

  const [{ data: convs }, { data: others }, { data: lastMessages }] = await Promise.all([
    convIds.length ? supabase.from("conversations").select("*").in("id", convIds).order("last_message_at", { ascending: false }) : Promise.resolve({ data: [] }),
    convIds.length ? supabase.from("conversation_members").select("conversation_id, user_id").in("conversation_id", convIds).neq("user_id", viewer.id) : Promise.resolve({ data: [] }),
    convIds.length ? supabase.from("messages").select("conversation_id, body, created_at, sender_id").in("conversation_id", convIds).order("created_at", { ascending: false }).limit(200) : Promise.resolve({ data: [] }),
  ]);

  const requesterIds = (requests ?? []).map((r) => r.sender_id);
  const otherIds = [...new Set([...(others ?? []).map((o) => o.user_id), ...requesterIds])];
  const { data: people } = otherIds.length ? await supabase.from("profiles").select("id, display_name, handle, avatar_url").in("id", otherIds) : { data: [] };
  const person = (id: string) => people?.find((p) => p.id === id);

  const selected = convs?.find((c) => c.id === selectedId) ?? null;
  let selectedMessages: Awaited<ReturnType<typeof loadMessages>> = [];
  async function loadMessages(id: string) {
    const { data } = await supabase.from("messages").select("*").eq("conversation_id", id).order("created_at");
    return data ?? [];
  }
  if (selected) selectedMessages = await loadMessages(selected.id);

  // A sender whose request is still pending can't continue until the recipient accepts.
  let locked: string | null = null;
  if (selected) {
    const { data: members } = await supabase.from("conversation_members").select("user_id, status").eq("conversation_id", selected.id);
    const other = members?.find((m) => m.user_id !== viewer.id);
    if (other?.status === "pending") locked = "Waiting for them to accept your message request.";
  }


  return (
    <div className="space-y-4">
      <PageHeader title="Messages" />

      {(requests ?? []).length > 0 ? (
        <Card>
          <h2 className="mb-3 text-[13px] font-semibold tracking-wide text-muted uppercase">Message requests</h2>
          <ul className="space-y-3">
            {(requests ?? []).map((r) => {
              const p = person(r.sender_id);
              return (
                <li key={r.id} className="flex items-center gap-3">
                  <Avatar name={p?.display_name ?? "?"} src={p?.avatar_url} />
                  <div className="min-w-0 flex-1"><Link href={`/profile/${p?.handle ?? ""}`} className="text-sm font-medium hover:underline">{p?.display_name ?? "Creator"}</Link><p className="text-xs text-muted">wants to message you · {timeAgo(r.created_at)}</p></div>
                  <RequestActions requestId={r.id} />
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      {(convs ?? []).length === 0 ? (
        <EmptyState icon={<MessageSquare className="h-6 w-6" aria-hidden />} title="No conversations yet" body="Open a profile and send a message to start one." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
          <ul className={cn("space-y-1", selected && "hidden lg:block")}>
            {(convs ?? []).map((c) => {
              const o = person((others ?? []).find((x) => x.conversation_id === c.id)?.user_id ?? "");
              const last = (lastMessages ?? []).find((m) => m.conversation_id === c.id);
              const unread = last && last.sender_id !== viewer.id && last.created_at > ((mine ?? []).find((m) => m.conversation_id === c.id)?.last_read_at ?? "");
              return (
                <li key={c.id}>
                  <Link href={`/messages?c=${c.id}`} className={cn("flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-surface-2", c.id === selected?.id && "bg-surface-2")}>
                    <Avatar name={o?.display_name ?? "?"} src={o?.avatar_url} />
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-sm", unread && "font-semibold")}>{o?.display_name ?? "Creator"}</p>
                      <p className="truncate text-xs text-muted">{last?.body ?? ""}</p>
                    </div>
                    {unread ? <span className="h-2 w-2 rounded-full bg-brand-hover" aria-label="Unread" /> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
          <Card className={cn("min-h-[28rem] p-0", !selected && "hidden lg:block")}>
            {selected ? (
              <>
                <Link href="/messages" className="block border-b px-4 py-2 text-xs text-muted lg:hidden">← All conversations</Link>
                <Chat conversationId={selected.id} viewerId={viewer.id} initial={selectedMessages} locked={locked} />
              </>
            ) : (
              <p className="p-6 text-sm text-muted">Select a conversation.</p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
