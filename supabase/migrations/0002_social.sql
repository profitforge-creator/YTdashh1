-- Community: posts, media, reactions, follows, messaging, moderation, notifications.

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null default '' check (char_length(body) <= 2000),
  kind text not null default 'text' check (kind in ('text', 'image', 'video', 'repost')),
  project_id uuid references public.projects (id) on delete set null,
  repost_of uuid references public.posts (id) on delete cascade,
  is_official boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint post_has_content check (kind = 'repost' or char_length(body) > 0 or kind in ('image', 'video'))
);
create index posts_created_idx on public.posts (created_at desc) where deleted_at is null;
create index posts_author_idx on public.posts (author_id, created_at desc);

create table public.media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null,
  mime text not null,
  kind text not null check (kind in ('image', 'video')),
  created_at timestamptz not null default now()
);
create index media_post_idx on public.media (post_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index comments_post_idx on public.comments (post_id, created_at);

create table public.reactions (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'like' check (kind in ('like')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, kind)
);

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index follows_followee_idx on public.follows (followee_id);

create table public.bookmarks (
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create table public.mutes (
  muter_id uuid not null references public.profiles (id) on delete cascade,
  muted_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (muter_id, muted_id),
  check (muter_id <> muted_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('post', 'comment', 'profile', 'message', 'job')),
  target_id uuid not null,
  reason text not null check (reason in ('spam', 'harassment', 'unsafe', 'scam', 'impersonation', 'other')),
  details text check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at timestamptz not null default now()
);
create index reports_status_idx on public.reports (status, created_at);

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.reports (id) on delete set null,
  admin_id uuid not null references public.profiles (id),
  action text not null check (action in ('remove_content', 'dismiss', 'warn_user')),
  note text,
  created_at timestamptz not null default now()
);

alter table public.posts enable row level security;
alter table public.media enable row level security;
alter table public.comments enable row level security;
alter table public.reactions enable row level security;
alter table public.follows enable row level security;
alter table public.bookmarks enable row level security;
alter table public.blocks enable row level security;
alter table public.mutes enable row level security;
alter table public.reports enable row level security;
alter table public.moderation_actions enable row level security;

create or replace function public.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;

-- Posts are readable unless removed or the author and viewer have a block between them.
create policy posts_select on public.posts for select to authenticated
  using (deleted_at is null and not public.is_blocked_between(auth.uid(), author_id));
create policy posts_insert on public.posts for insert to authenticated
  with check (author_id = auth.uid() and is_official = false
    and (project_id is null or public.is_project_member(project_id)));
create policy posts_update_own on public.posts for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
revoke update on public.posts from authenticated;
grant update (body, deleted_at) on public.posts to authenticated;

create policy media_select on public.media for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy media_insert on public.media for insert to authenticated
  with check (owner_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));

create policy comments_select on public.comments for select to authenticated
  using (deleted_at is null and not public.is_blocked_between(auth.uid(), author_id)
    and exists (select 1 from public.posts p where p.id = post_id));
create policy comments_insert on public.comments for insert to authenticated
  with check (author_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id));
create policy comments_update_own on public.comments for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
revoke update on public.comments from authenticated;
grant update (deleted_at) on public.comments to authenticated;

create policy reactions_select on public.reactions for select to authenticated using (true);
create policy reactions_insert on public.reactions for insert to authenticated with check (user_id = auth.uid());
create policy reactions_delete on public.reactions for delete to authenticated using (user_id = auth.uid());

create policy follows_select on public.follows for select to authenticated using (true);
create policy follows_insert on public.follows for insert to authenticated
  with check (follower_id = auth.uid() and not public.is_blocked_between(follower_id, followee_id));
create policy follows_delete on public.follows for delete to authenticated using (follower_id = auth.uid());

create policy bookmarks_all on public.bookmarks for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy blocks_all on public.blocks for all to authenticated
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());
create policy mutes_all on public.mutes for all to authenticated
  using (muter_id = auth.uid()) with check (muter_id = auth.uid());

create policy reports_insert on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy reports_select on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_admin());
create policy moderation_select on public.moderation_actions for select to authenticated using (public.is_admin());

-- Admin moderation: acts on a report in one transaction.
create or replace function public.moderate_report(p_report uuid, p_action text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  r public.reports%rowtype;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select * into r from public.reports where id = p_report for update;
  if not found then raise exception 'not_found'; end if;
  if p_action not in ('remove_content', 'dismiss', 'warn_user') then raise exception 'invalid_action'; end if;

  if p_action = 'remove_content' then
    if r.target_type = 'post' then
      update public.posts set deleted_at = now() where id = r.target_id;
    elsif r.target_type = 'comment' then
      update public.comments set deleted_at = now() where id = r.target_id;
    end if;
  end if;
  update public.reports set status = case when p_action = 'dismiss' then 'dismissed' else 'actioned' end
    where id = r.id;
  insert into public.moderation_actions (report_id, admin_id, action, note)
    values (r.id, auth.uid(), p_action, p_note);
end;
$$;
grant execute on function public.moderate_report(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Messaging
-- ---------------------------------------------------------------------------

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'pending', 'declined')),
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conversation_members_user_idx on public.conversation_members (user_id);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index messages_conv_idx on public.messages (conversation_id, created_at);
create table public.message_requests (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null unique references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now()
);

create or replace function public.is_conversation_member(p_conv uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.conversation_members where conversation_id = p_conv and user_id = auth.uid());
$$;

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_requests enable row level security;

create policy conversations_select on public.conversations for select to authenticated
  using (public.is_conversation_member(id));
create policy conv_members_select on public.conversation_members for select to authenticated
  using (public.is_conversation_member(conversation_id));
create policy messages_select on public.messages for select to authenticated
  using (public.is_conversation_member(conversation_id));
create policy message_requests_select on public.message_requests for select to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  href text,
  immediate boolean not null default false,
  group_key text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
create policy notifications_select_own on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update_own on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Maps an event kind to the preference category shown in Settings. Unmapped kinds (comments, follows) always notify.
create or replace function public.notification_category(p_kind text) returns text
language sql immutable as $$
  select case
    when p_kind in ('job_application', 'job_selected', 'work_submitted', 'revision_requested', 'review') then 'jobs'
    when p_kind in ('message', 'message_request') then 'messages'
    when p_kind like 'payment_%' or p_kind like 'dispute_%' or p_kind = 'admin_dispute' then 'payments'
    when p_kind = 'build_complete' then 'builds'
    when p_kind = 'analytics' then 'analytics'
    when p_kind = 'rank' then 'rank'
    when p_kind = 'task' then 'tasks'
    else null end;
$$;

-- In-app preferences are enforced at creation so unread counts stay consistent.
-- Immediate events (payments, security) ignore preferences.
create or replace function public.notify(
  p_user uuid, p_kind text, p_title text, p_body text default '', p_href text default null,
  p_immediate boolean default false, p_group text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  cat text := public.notification_category(p_kind);
  wanted text;
begin
  if cat is not null and not p_immediate then
    select notification_prefs -> cat ->> 'in_app' into wanted from public.user_preferences where user_id = p_user;
    if wanted = 'false' then return; end if;
  end if;
  insert into public.notifications (user_id, kind, title, body, href, immediate, group_key)
    values (p_user, p_kind, p_title, p_body, p_href, p_immediate, p_group);
end;
$$;
revoke all on function public.notify(uuid, text, text, text, text, boolean, text) from public, anon, authenticated;
grant execute on function public.notify(uuid, text, text, text, text, boolean, text) to service_role;

-- Messaging functions (after notify so they can call it).
create or replace function public.start_conversation(p_recipient uuid, p_body text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  policy text;
  conv uuid;
  existing uuid;
  sender_name text;
begin
  if me is null then raise exception 'unauthenticated'; end if;
  if me = p_recipient then raise exception 'cannot_message_self'; end if;
  if public.is_blocked_between(me, p_recipient) then raise exception 'blocked'; end if;
  select dm_policy into policy from public.profiles where id = p_recipient;
  if policy is null then raise exception 'not_found'; end if;

  select cm1.conversation_id into existing
    from public.conversation_members cm1
    join public.conversation_members cm2 on cm1.conversation_id = cm2.conversation_id
    where cm1.user_id = me and cm2.user_id = p_recipient limit 1;
  if existing is not null then
    perform public.send_message(existing, p_body);
    return existing;
  end if;

  insert into public.conversations default values returning id into conv;
  insert into public.conversation_members (conversation_id, user_id, status)
    values (conv, me, 'active'),
           (conv, p_recipient, case when policy = 'open' then 'active' else 'pending' end);
  insert into public.messages (conversation_id, sender_id, body) values (conv, me, p_body);
  select display_name into sender_name from public.profiles where id = me;

  if policy = 'requests' then
    insert into public.message_requests (conversation_id, sender_id, recipient_id) values (conv, me, p_recipient);
    perform public.notify(p_recipient, 'message_request', sender_name || ' sent a message request', left(p_body, 120),
                          '/messages', false, 'message_request');
  else
    perform public.notify(p_recipient, 'message', 'New message from ' || sender_name, left(p_body, 120),
                          '/messages?c=' || conv, false, 'message:' || conv);
  end if;
  return conv;
end;
$$;

create or replace function public.send_message(p_conv uuid, p_body text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  my_status text;
  other uuid;
  other_status text;
  sent int;
  mid uuid;
  sender_name text;
begin
  select status into my_status from public.conversation_members where conversation_id = p_conv and user_id = me;
  if my_status is null then raise exception 'forbidden'; end if;
  if my_status = 'declined' then raise exception 'declined'; end if;
  select user_id, status into other, other_status from public.conversation_members
    where conversation_id = p_conv and user_id <> me limit 1;
  if public.is_blocked_between(me, other) then raise exception 'blocked'; end if;

  if other_status = 'pending' then
    -- Until the request is accepted the sender gets a single message.
    select count(*) into sent from public.messages where conversation_id = p_conv and sender_id = me;
    if sent >= 1 then raise exception 'request_pending'; end if;
  end if;
  if other_status = 'declined' then raise exception 'declined'; end if;

  insert into public.messages (conversation_id, sender_id, body) values (p_conv, me, p_body) returning id into mid;
  update public.conversations set last_message_at = now() where id = p_conv;
  if other_status = 'active' then
    select display_name into sender_name from public.profiles where id = me;
    perform public.notify(other, 'message', 'New message from ' || sender_name, left(p_body, 120),
                          '/messages?c=' || p_conv, false, 'message:' || p_conv);
  end if;
  return mid;
end;
$$;

create or replace function public.respond_message_request(p_request uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  r public.message_requests%rowtype;
begin
  select * into r from public.message_requests where id = p_request for update;
  if not found or r.recipient_id <> auth.uid() then raise exception 'forbidden'; end if;
  if r.status <> 'pending' then return; end if;
  update public.message_requests set status = case when p_accept then 'accepted' else 'declined' end where id = r.id;
  update public.conversation_members set status = case when p_accept then 'active' else 'declined' end
    where conversation_id = r.conversation_id and user_id = r.recipient_id;
end;
$$;

create or replace function public.mark_conversation_read(p_conv uuid) returns void
language sql security definer set search_path = public as $$
  update public.conversation_members set last_read_at = now()
    where conversation_id = p_conv and user_id = auth.uid();
$$;

grant execute on function public.start_conversation(uuid, text) to authenticated;
grant execute on function public.send_message(uuid, text) to authenticated;
grant execute on function public.respond_message_request(uuid, boolean) to authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- Realtime for live chat and notification badges.
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;

-- ---------------------------------------------------------------------------
-- Feed stats in one round trip (security invoker, so RLS still applies)
-- ---------------------------------------------------------------------------

create or replace function public.post_stats(p_ids uuid[])
returns table (post_id uuid, likes bigint, comments bigint, reposts bigint, liked boolean, bookmarked boolean, reposted boolean)
language sql stable security invoker set search_path = public as $$
  select p.id,
    (select count(*) from public.reactions r where r.post_id = p.id),
    (select count(*) from public.comments c where c.post_id = p.id and c.deleted_at is null),
    (select count(*) from public.posts rp where rp.repost_of = p.id and rp.deleted_at is null),
    exists (select 1 from public.reactions r where r.post_id = p.id and r.user_id = auth.uid()),
    exists (select 1 from public.bookmarks b where b.post_id = p.id and b.user_id = auth.uid()),
    exists (select 1 from public.posts rp where rp.repost_of = p.id and rp.author_id = auth.uid() and rp.deleted_at is null)
  from public.posts p where p.id = any (p_ids);
$$;
grant execute on function public.post_stats(uuid[]) to authenticated;
