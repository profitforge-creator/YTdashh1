"use server";

import { revalidatePath } from "next/cache";
import { dbErrorMessage, fail, ok, type ActionResult } from "@/lib/action-result";
import { getViewer } from "@/lib/auth";
import { allow } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const bodySchema = z.string().trim().min(1, "Write a message first.").max(2000);

export async function startConversation(recipientId: string, body: string): Promise<ActionResult<{ conversationId: string }>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.");
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid message.");
  if (!(await allow(`dm:${viewer.id}`, 30, 3600))) return fail("You're sending messages too fast.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_conversation", { p_recipient: recipientId, p_body: parsed.data });
  if (error || !data) return fail(dbErrorMessage(error, "Couldn't send your message."));
  revalidatePath("/messages");
  return ok({ conversationId: data });
}

export async function sendMessage(conversationId: string, body: string): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.");
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid message.");
  if (!(await allow(`dm:${viewer.id}`, 60, 3600))) return fail("You're sending messages too fast.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("send_message", { p_conv: conversationId, p_body: parsed.data });
  if (error) return fail(dbErrorMessage(error, "Couldn't send your message."));
  return ok();
}

export async function respondToRequest(requestId: string, accept: boolean): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_message_request", { p_request: requestId, p_accept: accept });
  if (error) return fail(dbErrorMessage(error, "Couldn't update that request."));
  revalidatePath("/messages");
  return ok();
}

export async function markRead(conversationId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("mark_conversation_read", { p_conv: conversationId });
}
