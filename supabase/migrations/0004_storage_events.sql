-- Storage buckets with upload restrictions, plus the triggers that record rank events and notifications.

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
-- media:    post images/video, readable by signed-in users, written under "<user_id>/"
-- evidence: job evidence, private to the contract parties, written under "<contract_id>/"
-- references: project reference art, private to project members, under "<project_id>/"

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('media', 'media', false, 52428800, array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']),
  ('evidence', 'evidence', false, 104857600, array['image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/webm', 'application/pdf', 'text/plain', 'application/zip']),
  ('references', 'references', false, 15728640, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy media_read on storage.objects for select to authenticated using (bucket_id = 'media');
create policy media_write on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy evidence_read on storage.objects for select to authenticated
  using (bucket_id = 'evidence'
    and (public.is_contract_party(((storage.foldername(name))[1])::uuid) or public.is_admin()));
create policy evidence_write on storage.objects for insert to authenticated
  with check (bucket_id = 'evidence'
    and public.is_contract_party(((storage.foldername(name))[1])::uuid));

create policy references_read on storage.objects for select to authenticated
  using (bucket_id = 'references' and public.is_project_member(((storage.foldername(name))[1])::uuid));
create policy references_write on storage.objects for insert to authenticated
  with check (bucket_id = 'references' and public.can_edit_project(((storage.foldername(name))[1])::uuid));

-- ---------------------------------------------------------------------------
-- Rank events and notifications from community and project activity
-- ---------------------------------------------------------------------------

create or replace function public.on_post_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not new.is_official then
    insert into public.rank_events (user_id, component, kind, points, ref_id, dedupe_key)
      values (new.author_id, 'community', 'post', 1, new.id::text, 'post:' || new.id)
      on conflict (dedupe_key) do nothing;
    insert into public.rank_events (user_id, component, kind, points, ref_id, dedupe_key)
      values (new.author_id, 'activity', 'daily_post', 1, new.id::text,
              'activity:' || new.author_id || ':' || to_char(now(), 'YYYY-MM-DD'))
      on conflict (dedupe_key) do nothing;
  end if;
  return new;
end;
$$;
create trigger posts_rank after insert on public.posts for each row execute function public.on_post_created();

create or replace function public.on_comment_created() returns trigger
language plpgsql security definer set search_path = public as $$
declare author uuid; who text;
begin
  select author_id into author from public.posts where id = new.post_id;
  if author is not null and author <> new.author_id then
    select display_name into who from public.profiles where id = new.author_id;
    perform public.notify(author, 'comment', who || ' commented on your post', left(new.body, 120),
                          '/feed?post=' || new.post_id, false, 'comment:' || new.post_id);
    insert into public.rank_events (user_id, component, kind, points, ref_id, dedupe_key)
      values (author, 'community', 'comment_received', 0.5, new.id::text, 'comment:' || new.id)
      on conflict (dedupe_key) do nothing;
  end if;
  return new;
end;
$$;
create trigger comments_rank after insert on public.comments for each row execute function public.on_comment_created();

create or replace function public.on_reaction_created() returns trigger
language plpgsql security definer set search_path = public as $$
declare author uuid;
begin
  select author_id into author from public.posts where id = new.post_id;
  if author is not null and author <> new.user_id then
    insert into public.rank_events (user_id, component, kind, points, ref_id, dedupe_key)
      values (author, 'community', 'like_received', 0.2, new.post_id::text, 'like:' || new.post_id || ':' || new.user_id)
      on conflict (dedupe_key) do nothing;
  end if;
  return new;
end;
$$;
create trigger reactions_rank after insert on public.reactions for each row execute function public.on_reaction_created();

create or replace function public.on_follow_created() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text;
begin
  select display_name into who from public.profiles where id = new.follower_id;
  perform public.notify(new.followee_id, 'follow', who || ' followed you', '', '/profile/' ||
                        (select handle from public.profiles where id = new.follower_id), false, 'follow');
  insert into public.rank_events (user_id, component, kind, points, ref_id, dedupe_key)
    values (new.followee_id, 'community', 'follower_gained', 0.5, new.follower_id::text,
            'follow:' || new.follower_id || ':' || new.followee_id)
    on conflict (dedupe_key) do nothing;
  return new;
end;
$$;
create trigger follows_rank after insert on public.follows for each row execute function public.on_follow_created();

create or replace function public.on_concept_approved() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'concept' and new.decision = 'approved' then
    insert into public.rank_events (user_id, component, kind, points, ref_id, dedupe_key)
      values (new.user_id, 'projects', 'concept_approved', 8, new.project_id::text, 'concept_approved:' || new.project_id)
      on conflict (dedupe_key) do nothing;
  end if;
  return new;
end;
$$;
create trigger approvals_rank after insert on public.approvals for each row execute function public.on_concept_approved();

create or replace function public.on_task_completed() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  if new.completed_at is not null and old.completed_at is null then
    select owner_id into owner from public.projects where id = new.project_id;
    insert into public.rank_events (user_id, component, kind, points, ref_id, dedupe_key)
      values (owner, 'projects', 'milestone', 2, new.id::text, 'task:' || new.id)
      on conflict (dedupe_key) do nothing;
  end if;
  return new;
end;
$$;
create trigger build_tasks_rank after update on public.build_tasks for each row execute function public.on_task_completed();

create or replace function public.on_metric_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.rank_events (user_id, component, kind, points, ref_id, dedupe_key)
    values (new.created_by, 'activity', 'metrics_logged', 1, new.id::text,
            'activity:' || new.created_by || ':' || to_char(new.captured_on, 'YYYY-MM-DD'))
    on conflict (dedupe_key) do nothing;
  return new;
end;
$$;
create trigger metrics_rank after insert on public.metric_snapshots for each row execute function public.on_metric_created();

-- Rank events and perks are written only by triggers/service role; keep clients read-only.
revoke insert, update, delete on public.rank_events, public.rank_snapshots, public.perks from authenticated;
