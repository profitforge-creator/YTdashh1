"use client";

import { ImagePlus, X } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { ALLOWED_IMAGE, ALLOWED_VIDEO, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES } from "@/lib/validation/community";
import { createPost } from "./actions";

interface Attachment {
  file: File;
  preview: string;
}

const EXT: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "video/mp4": "mp4", "video/webm": "webm",
};

export function Composer({ userId, projects }: { userId: string; projects: { id: string; title: string }[] }) {
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const [projectId, setProjectId] = useState("");
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    const next = [...files];
    for (const f of picked) {
      const isImage = (ALLOWED_IMAGE as readonly string[]).includes(f.type);
      const isVideo = (ALLOWED_VIDEO as readonly string[]).includes(f.type);
      if (!isImage && !isVideo) { toast.error(`${f.name}: use PNG, JPG, WebP, GIF, MP4 or WebM.`); continue; }
      if (f.size > (isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES)) { toast.error(`${f.name} is too large (${isVideo ? "50" : "10"} MB max).`); continue; }
      const hasVideo = next.some((a) => a.file.type.startsWith("video/"));
      if ((isVideo && next.length > 0) || hasVideo || next.length >= 4) { toast.error("Attach one video or up to four images."); continue; }
      next.push({ file: f, preview: URL.createObjectURL(f) });
    }
    setFiles(next);
  }

  function remove(i: number) {
    setFiles((list) => {
      const target = list[i];
      if (target) URL.revokeObjectURL(target.preview);
      return list.filter((_, idx) => idx !== i);
    });
  }

  function submit() {
    startTransition(async () => {
      const supabase = createClient();
      const uploaded: { path: string; mime: string }[] = [];
      try {
        for (const a of files) {
          const path = `${userId}/${crypto.randomUUID()}.${EXT[a.file.type] ?? "bin"}`;
          const { error } = await supabase.storage.from("media").upload(path, a.file, { contentType: a.file.type, upsert: false });
          if (error) throw new Error("Upload failed. Check the file type and size.");
          uploaded.push({ path, mime: a.file.type });
        }
      } catch (err) {
        if (uploaded.length) await supabase.storage.from("media").remove(uploaded.map((u) => u.path));
        toast.error(err instanceof Error ? err.message : "Upload failed.");
        return;
      }
      const res = await createPost({ body, media: uploaded, projectId: projectId || null });
      if (!res.ok) {
        if (uploaded.length) await supabase.storage.from("media").remove(uploaded.map((u) => u.path));
        toast.error(res.error);
        return;
      }
      files.forEach((a) => URL.revokeObjectURL(a.preview));
      setBody(""); setFiles([]); setProjectId("");
      toast.success("Posted.");
    });
  }

  return (
    <div className="rounded-[var(--radius-card)] border bg-surface p-4">
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} placeholder="Share progress, ask for feedback, post a clip…" aria-label="New post" className="min-h-20 resize-none border-0 bg-transparent px-0 focus:border-0" />
      {files.length > 0 ? (
        <div className="mt-2 grid grid-cols-4 gap-2">
          {files.map((a, i) => (
            <div key={a.preview} className="relative aspect-square overflow-hidden rounded-lg bg-surface-2">
              {a.file.type.startsWith("video/") ? <video src={a.preview} className="h-full w-full object-cover" muted /> : (
                // eslint-disable-next-line @next/next/no-img-element -- local blob preview
                <img src={a.preview} alt="" className="h-full w-full object-cover" />
              )}
              <button type="button" onClick={() => remove(i)} aria-label="Remove attachment" className="absolute right-1 top-1 rounded-full bg-black/70 p-1"><X className="h-3 w-3" aria-hidden /></button>
            </div>
          ))}
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
        <input ref={input} type="file" multiple accept={[...ALLOWED_IMAGE, ...ALLOWED_VIDEO].join(",")} onChange={onPick} className="sr-only" aria-label="Attach media" />
        <Button type="button" variant="ghost" size="sm" onClick={() => input.current?.click()} disabled={pending}><ImagePlus className="h-4 w-4" aria-hidden /> Media</Button>
        {projects.length > 0 ? (
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label="Attach a project" className="h-8 max-w-40 rounded-lg border bg-surface-2 px-2 text-xs text-muted">
            <option value="">No project</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        ) : null}
        <span className="ml-auto text-xs text-faint">{body.length}/2000</span>
        <Button size="sm" onClick={submit} loading={pending} disabled={!body.trim() && files.length === 0}>Post</Button>
      </div>
    </div>
  );
}
