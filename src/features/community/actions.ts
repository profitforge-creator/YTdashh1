"use server";

import { revalidatePath } from "next/cache";
import { dbErrorMessage, fail, ok, type ActionResult } from "@/lib/action-result";
import { getViewer } from "@/lib/auth";
import { allow } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { ALLOWED_IMAGE, commentSchema, createPostSchema, profileSchema, reportSchema } from "@/lib/validation/community";

export async function createPost(input: unknown): Promise<ActionResult<{ id: string }>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.");
  const parsed = createPostSchema.safeParse(input);
  if (!parsed.success) return fail("That post isn't valid.");
  const { body, media, projectId } = parsed.data;
  if (!body && media.length === 0) return fail("Write something or attach media.");
  if (!(await allow(`post:${viewer.id}`, 20, 3600))) return fail("You're posting too fast. Try again soon.");

  // Uploads happen directly to storage under the author's folder; refuse paths that aren't theirs.
  if (media.some((m) => !m.path.startsWith(`${viewer.id}/`) || m.path.includes(".."))) return fail("Invalid media upload.");
  const hasVideo = media.some((m) => !(ALLOWED_IMAGE as readonly string[]).includes(m.mime));
  if (hasVideo && media.length > 1) return fail("Attach one video or up to four images.");

  const supabase = await createClient();
  const { data: post, error } = await supabase
    .from("posts")
    .insert({ author_id: viewer.id, body, kind: media.length === 0 ? "text" : hasVideo ? "video" : "image", project_id: projectId ?? null })
    .select("id")
    .single();
  if (error || !post) return fail("Couldn't publish your post.");

  if (media.length > 0) {
    const { error: mediaError } = await supabase.from("media").insert(
      media.map((m) => ({
        post_id: post.id, owner_id: viewer.id, storage_path: m.path, mime: m.mime,
        kind: (ALLOWED_IMAGE as readonly string[]).includes(m.mime) ? ("image" as const) : ("video" as const),
      })),
    );
    if (mediaError) {
      await supabase.from("posts").update({ deleted_at: new Date().toISOString() }).eq("id", post.id);
      return fail("Couldn't attach your media.");
    }
  }
  revalidatePath("/feed");
  revalidatePath("/home");
  return ok({ id: post.id });
}

export async function toggleLike(postId: string, liked: boolean): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.");
  const supabase = await createClient();
  const { error } = liked
    ? await supabase.from("reactions").delete().eq("post_id", postId).eq("user_id", viewer.id)
    : await supabase.from("reactions").insert({ post_id: postId, user_id: viewer.id });
  if (error && !liked) return fail("Couldn't like that post.");
  return ok();
}

export async function toggleBookmark(postId: string, bookmarked: boolean): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.");
  const supabase = await createClient();
  const { error } = bookmarked
    ? await supabase.from("bookmarks").delete().eq("post_id", postId).eq("user_id", viewer.id)
    : await supabase.from("bookmarks").insert({ post_id: postId, user_id: viewer.id });
  if (error && !bookmarked) return fail("Couldn't save that post.");
  revalidatePath("/feed");
  return ok();
}

export async function toggleRepost(postId: string, reposted: boolean): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.");
  const supabase = await createClient();
  if (reposted) {
    await supabase.from("posts").update({ deleted_at: new Date().toISOString() }).eq("repost_of", postId).eq("author_id", viewer.id);
  } else {
    const { data: original } = await supabase.from("posts").select("id, kind").eq("id", postId).single();
    if (!original || original.kind === "repost") return fail("That post can't be reposted.");
    const { error } = await supabase.from("posts").insert({ author_id: viewer.id, kind: "repost", repost_of: postId, body: "" });
    if (error) return fail("Couldn't repost.");
  }
  revalidatePath("/feed");
  return ok();
}

export async function addComment(input: unknown): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.");
  const parsed = commentSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "That comment isn't valid.");
  if (!(await allow(`comment:${viewer.id}`, 60, 3600))) return fail("You're commenting too fast.");
  const supabase = await createClient();
  const { error } = await supabase.from("comments").insert({ post_id: parsed.data.postId, author_id: viewer.id, body: parsed.data.body });
  if (error) return fail("Couldn't post your comment.");
  revalidatePath(`/feed/${parsed.data.postId}`);
  return ok();
}

export async function deletePost(postId: string): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.");
  const supabase = await createClient();
  const { error } = await supabase.from("posts").update({ deleted_at: new Date().toISOString() }).eq("id", postId).eq("author_id", viewer.id);
  if (error) return fail("Couldn't delete that post.");
  revalidatePath("/feed");
  return ok();
}

export async function deleteComment(commentId: string, postId: string): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.");
  const supabase = await createClient();
  const { error } = await supabase.from("comments").update({ deleted_at: new Date().toISOString() }).eq("id", commentId).eq("author_id", viewer.id);
  if (error) return fail("Couldn't delete that comment.");
  revalidatePath(`/feed/${postId}`);
  return ok();
}

export async function setFollow(userId: string, follow: boolean): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.");
  if (userId === viewer.id) return fail("You can't follow yourself.");
  const supabase = await createClient();
  const { error } = follow
    ? await supabase.from("follows").insert({ follower_id: viewer.id, followee_id: userId })
    : await supabase.from("follows").delete().eq("follower_id", viewer.id).eq("followee_id", userId);
  if (error && follow) return fail("Couldn't follow this user.");
  revalidatePath("/feed");
  return ok();
}

export async function setBlock(userId: string, block: boolean): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.");
  if (userId === viewer.id) return fail("You can't block yourself.");
  const supabase = await createClient();
  if (block) {
    const { error } = await supabase.from("blocks").insert({ blocker_id: viewer.id, blocked_id: userId });
    if (error) return fail("Couldn't block this user.");
    await supabase.from("follows").delete().eq("follower_id", viewer.id).eq("followee_id", userId);
  } else {
    await supabase.from("blocks").delete().eq("blocker_id", viewer.id).eq("blocked_id", userId);
  }
  revalidatePath("/", "layout");
  return ok();
}

export async function setMute(userId: string, mute: boolean): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.");
  const supabase = await createClient();
  const { error } = mute
    ? await supabase.from("mutes").insert({ muter_id: viewer.id, muted_id: userId })
    : await supabase.from("mutes").delete().eq("muter_id", viewer.id).eq("muted_id", userId);
  if (error && mute) return fail("Couldn't mute this user.");
  revalidatePath("/feed");
  return ok();
}

export async function submitReport(input: unknown): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.");
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return fail("Choose a reason for the report.");
  if (!(await allow(`report:${viewer.id}`, 20, 3600))) return fail("You've sent a lot of reports. Try again later.");
  const supabase = await createClient();
  const { error } = await supabase.from("reports").insert({
    reporter_id: viewer.id, target_type: parsed.data.targetType, target_id: parsed.data.targetId,
    reason: parsed.data.reason, details: parsed.data.details ?? null,
  });
  if (error) return fail("Couldn't send your report.");
  return ok();
}

export async function updateProfile(input: unknown): Promise<ActionResult<{ handle: string }>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.");
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return fail("Check the highlighted fields.", fieldErrors);
  }
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", viewer.id);
  if (error) {
    if (error.code === "23505") return fail("That handle is taken.", { handle: "That handle is taken." });
    return fail(dbErrorMessage(error, "Couldn't save your profile."));
  }
  revalidatePath("/profile", "layout");
  return ok({ handle: parsed.data.handle });
}
