-- DevMint core schema: identity, preferences, credits, projects, AI generation, analytics.
-- Every table has RLS enabled. Writes that move money, credits, or approvals go through
-- SECURITY DEFINER functions or the service role, never direct client writes.

create extension if not exists pgcrypto;

create type app_role as enum ('developer', 'specialist', 'tester', 'player');
create type ai_provider as enum ('claude', 'chatgpt', 'gemini');
create type credit_category as enum ('research', 'blueprints', 'scripts', 'images', 'studio');
create type plan_tier as enum ('free', 'creator', 'pro', 'studio');
create type project_stage as enum ('interview', 'research', 'concept', 'blueprint', 'assets', 'scripts', 'test');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles (public) and preferences (private)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text not null,
  display_name text not null,
  bio text not null default '',
  avatar_url text,
  roles app_role[] not null default '{}',
  experience_level text,
  genres text[] not null default '{}',
  skills text[] not null default '{}',
  dm_policy text not null default 'requests' check (dm_policy in ('open', 'requests')),
  is_admin boolean not null default false,
  is_demo boolean not null default false,
  is_official boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint handle_format check (handle ~ '^[a-z0-9_]{3,24}$')
);
create unique index profiles_handle_key on public.profiles (lower(handle));
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

create table public.user_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  goals text[] not null default '{}',
  weekly_hours int check (weekly_hours between 0 and 168),
  budget_usd int check (budget_usd >= 0),
  preferred_ai ai_provider not null default 'claude',
  onboarded_at timestamptz,
  notification_prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create trigger user_preferences_touch before update on public.user_preferences
  for each row execute function public.touch_updated_at();

create table public.roblox_connections (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  roblox_user_id text,
  status text not null default 'not_connected' check (status in ('not_connected', 'pending', 'connected')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.roblox_connections enable row level security;

create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- Privilege columns can never be set from the client.
revoke update on public.profiles from authenticated;
grant update (handle, display_name, bio, avatar_url, roles, experience_level, genres, skills, dm_policy)
  on public.profiles to authenticated;

create policy prefs_select_own on public.user_preferences for select to authenticated using (user_id = auth.uid());
create policy prefs_insert_own on public.user_preferences for insert to authenticated with check (user_id = auth.uid());
create policy prefs_update_own on public.user_preferences for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy roblox_select_own on public.roblox_connections for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Plans, subscriptions, credits
-- ---------------------------------------------------------------------------

create table public.plan_allowances (
  plan plan_tier not null,
  category credit_category not null,
  monthly_credits int not null check (monthly_credits >= 0),
  primary key (plan, category)
);
alter table public.plan_allowances enable row level security;
create policy plan_allowances_read on public.plan_allowances for select to authenticated using (true);

-- Allowances are product assumptions; tune them here without a deploy.
insert into public.plan_allowances (plan, category, monthly_credits) values
  ('free', 'research', 10), ('free', 'blueprints', 0), ('free', 'scripts', 0), ('free', 'images', 0), ('free', 'studio', 0),
  ('creator', 'research', 100), ('creator', 'blueprints', 60), ('creator', 'scripts', 100), ('creator', 'images', 40), ('creator', 'studio', 0),
  ('pro', 'research', 250), ('pro', 'blueprints', 150), ('pro', 'scripts', 300), ('pro', 'images', 120), ('pro', 'studio', 50),
  ('studio', 'research', 600), ('studio', 'blueprints', 400), ('studio', 'scripts', 800), ('studio', 'images', 300), ('studio', 'studio', 300);

create table public.subscriptions (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  plan plan_tier not null default 'free',
  status text not null default 'active' check (status in ('active', 'past_due', 'canceled')),
  billing_interval text not null default 'month' check (billing_interval in ('month', 'year')),
  current_period_start timestamptz not null default date_trunc('month', now()),
  current_period_end timestamptz not null default date_trunc('month', now()) + interval '1 month',
  last_grant_at timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create policy subscriptions_select_own on public.subscriptions for select to authenticated using (user_id = auth.uid());

-- subscription_balance rolls forward (paid plans, capped); purchased_balance never expires.
create table public.credit_wallets (
  user_id uuid not null references public.profiles (id) on delete cascade,
  category credit_category not null,
  subscription_balance int not null default 0 check (subscription_balance >= 0),
  purchased_balance int not null default 0 check (purchased_balance >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, category)
);
alter table public.credit_wallets enable row level security;
create policy wallets_select_own on public.credit_wallets for select to authenticated using (user_id = auth.uid());

create table public.credit_transactions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  category credit_category not null,
  delta int not null,
  bucket text not null check (bucket in ('subscription', 'purchased')),
  reason text not null,
  job_id uuid,
  created_at timestamptz not null default now()
);
create index credit_transactions_user_idx on public.credit_transactions (user_id, created_at desc);
alter table public.credit_transactions enable row level security;
create policy credit_tx_select_own on public.credit_transactions for select to authenticated using (user_id = auth.uid());

-- Grants the monthly allowance when the period rolled over. Free credits reset (no rollover);
-- paid credits roll forward up to a six-month accumulation cap.
create or replace function public.grant_monthly_credits(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  sub public.subscriptions%rowtype;
  a record;
  cur int;
  target int;
  cap int;
  period_start timestamptz := date_trunc('month', now());
begin
  select * into sub from public.subscriptions where user_id = p_user for update;
  if not found then return; end if;
  if sub.last_grant_at is not null and sub.last_grant_at >= period_start then return; end if;

  for a in select category, monthly_credits from public.plan_allowances where plan = sub.plan loop
    insert into public.credit_wallets (user_id, category) values (p_user, a.category)
      on conflict do nothing;
    select subscription_balance into cur from public.credit_wallets
      where user_id = p_user and category = a.category for update;
    if sub.plan = 'free' then
      target := a.monthly_credits;
    else
      cap := a.monthly_credits * 6;
      target := least(cur + a.monthly_credits, greatest(cap, cur));
    end if;
    if target <> cur then
      update public.credit_wallets set subscription_balance = target, updated_at = now()
        where user_id = p_user and category = a.category;
      insert into public.credit_transactions (user_id, category, delta, bucket, reason)
        values (p_user, a.category, target - cur, 'subscription',
                case when sub.plan = 'free' then 'free_monthly_reset' else 'monthly_grant' end);
    end if;
  end loop;

  update public.subscriptions
    set last_grant_at = now(), current_period_start = period_start,
        current_period_end = period_start + interval '1 month'
    where user_id = p_user;
end;
$$;

create or replace function public.debit_credits(
  p_user uuid, p_category credit_category, p_amount int, p_reason text, p_job uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  w public.credit_wallets%rowtype;
  from_sub int;
  from_purchased int;
begin
  if p_amount < 0 then raise exception 'invalid_amount'; end if;
  if p_amount = 0 then return; end if;
  select * into w from public.credit_wallets where user_id = p_user and category = p_category for update;
  if not found or w.subscription_balance + w.purchased_balance < p_amount then
    raise exception 'insufficient_credits' using errcode = 'P0001';
  end if;
  from_sub := least(w.subscription_balance, p_amount);
  from_purchased := p_amount - from_sub;
  update public.credit_wallets
    set subscription_balance = subscription_balance - from_sub,
        purchased_balance = purchased_balance - from_purchased, updated_at = now()
    where user_id = p_user and category = p_category;
  if from_sub > 0 then
    insert into public.credit_transactions (user_id, category, delta, bucket, reason, job_id)
      values (p_user, p_category, -from_sub, 'subscription', p_reason, p_job);
  end if;
  if from_purchased > 0 then
    insert into public.credit_transactions (user_id, category, delta, bucket, reason, job_id)
      values (p_user, p_category, -from_purchased, 'purchased', p_reason, p_job);
  end if;
end;
$$;

create or replace function public.refund_credits(p_user uuid, p_category credit_category, p_job uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  t record;
begin
  -- Refund once per job, back into the bucket it was taken from.
  if exists (select 1 from public.credit_transactions where job_id = p_job and reason = 'refund_failed_job') then
    return;
  end if;
  for t in select bucket, -delta as amount from public.credit_transactions
           where job_id = p_job and user_id = p_user and delta < 0 loop
    if t.bucket = 'subscription' then
      update public.credit_wallets set subscription_balance = subscription_balance + t.amount, updated_at = now()
        where user_id = p_user and category = p_category;
    else
      update public.credit_wallets set purchased_balance = purchased_balance + t.amount, updated_at = now()
        where user_id = p_user and category = p_category;
    end if;
    insert into public.credit_transactions (user_id, category, delta, bucket, reason, job_id)
      values (p_user, p_category, t.amount, t.bucket, 'refund_failed_job', p_job);
  end loop;
end;
$$;

revoke all on function public.grant_monthly_credits(uuid) from public, anon, authenticated;
revoke all on function public.debit_credits(uuid, credit_category, int, text, uuid) from public, anon, authenticated;
revoke all on function public.refund_credits(uuid, credit_category, uuid) from public, anon, authenticated;
grant execute on function public.grant_monthly_credits(uuid) to service_role;
grant execute on function public.debit_credits(uuid, credit_category, int, text, uuid) to service_role;
grant execute on function public.refund_credits(uuid, credit_category, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Rate limits (service role only)
-- ---------------------------------------------------------------------------

create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (key, window_start)
);
alter table public.rate_limits enable row level security;

create or replace function public.check_rate_limit(p_key text, p_max int, p_window_seconds int) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  ws timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  h int;
begin
  insert into public.rate_limits as r (key, window_start, hits) values (p_key, ws, 1)
    on conflict (key, window_start) do update set hits = r.hits + 1
    returning hits into h;
  delete from public.rate_limits where window_start < now() - interval '1 day';
  return h <= p_max;
end;
$$;
revoke all on function public.check_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, int, int) to service_role;

-- ---------------------------------------------------------------------------
-- New-user bootstrap
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  base text;
  candidate text;
  n int := 0;
  cat credit_category;
begin
  base := regexp_replace(lower(split_part(coalesce(new.email, 'creator'), '@', 1)), '[^a-z0-9_]', '', 'g');
  if length(base) < 3 then base := base || 'dev'; end if;
  base := left(base, 18);
  candidate := base;
  while exists (select 1 from public.profiles where lower(handle) = candidate) loop
    n := n + 1;
    candidate := base || floor(random() * 9000 + 1000)::int::text;
    exit when n > 20;
  end loop;

  insert into public.profiles (id, handle, display_name, avatar_url)
    values (new.id, candidate,
            coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'name', ''), base),
            new.raw_user_meta_data ->> 'avatar_url');
  insert into public.user_preferences (user_id) values (new.id);
  insert into public.roblox_connections (user_id) values (new.id);
  insert into public.subscriptions (user_id) values (new.id);
  foreach cat in array enum_range(null::credit_category) loop
    insert into public.credit_wallets (user_id, category) values (new.id, cat);
  end loop;
  perform public.grant_monthly_credits(new.id);
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Games and projects
-- ---------------------------------------------------------------------------

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  route text not null check (route in ('discover', 'idea', 'improve')),
  stage project_stage not null default 'interview',
  status text not null default 'active' check (status in ('active', 'archived')),
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  cover_url text,
  progress int not null default 0 check (progress between 0 and 100),
  ai_provider ai_provider not null default 'claude',
  summary jsonb,
  approved_concept_id uuid,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_owner_idx on public.projects (owner_id, updated_at desc);
create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();

create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'viewer' check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index project_members_user_idx on public.project_members (user_id);

create or replace function public.is_project_member(p_project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.project_members where project_id = p_project and user_id = auth.uid());
$$;

create or replace function public.can_edit_project(p_project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.project_members
    where project_id = p_project and user_id = auth.uid() and role in ('owner', 'editor'));
$$;

create or replace function public.add_project_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.project_members (project_id, user_id, role) values (new.id, new.owner_id, 'owner')
    on conflict do nothing;
  return new;
end;
$$;
create trigger projects_add_owner after insert on public.projects
  for each row execute function public.add_project_owner();

alter table public.projects enable row level security;
alter table public.project_members enable row level security;

create policy projects_select on public.projects for select to authenticated
  using (public.is_project_member(id) or visibility = 'public');
create policy projects_insert on public.projects for insert to authenticated
  with check (owner_id = auth.uid() and approved_concept_id is null and stage = 'interview');
create policy projects_update on public.projects for update to authenticated
  using (public.can_edit_project(id)) with check (public.can_edit_project(id));
create policy projects_delete on public.projects for delete to authenticated using (owner_id = auth.uid());
-- Ownership and approval pointer are not client-writable; approval goes through approve_concept().
revoke update on public.projects from authenticated;
grant update (title, stage, status, visibility, cover_url, progress, ai_provider, summary) on public.projects to authenticated;

create policy members_select on public.project_members for select to authenticated
  using (user_id = auth.uid() or public.is_project_member(project_id));

create table public.games (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  name text not null,
  roblox_place_id text,
  description text not null default '',
  cover_url text,
  created_at timestamptz not null default now()
);
alter table public.games enable row level security;
create policy games_select on public.games for select to authenticated using (true);
create policy games_write_own on public.games for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create table public.project_interviews (
  project_id uuid primary key references public.projects (id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  current_step int not null default 0,
  completed_at timestamptz,
  confirmed_at timestamptz,
  updated_at timestamptz not null default now()
);
create trigger project_interviews_touch before update on public.project_interviews
  for each row execute function public.touch_updated_at();
alter table public.project_interviews enable row level security;
create policy interviews_select on public.project_interviews for select to authenticated
  using (public.is_project_member(project_id));
create policy interviews_insert on public.project_interviews for insert to authenticated
  with check (public.can_edit_project(project_id));
create policy interviews_update on public.project_interviews for update to authenticated
  using (public.can_edit_project(project_id)) with check (public.can_edit_project(project_id));

create table public.project_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);
create index project_messages_idx on public.project_messages (project_id, created_at);
alter table public.project_messages enable row level security;
create policy project_messages_select on public.project_messages for select to authenticated
  using (public.is_project_member(project_id));
create policy project_messages_insert on public.project_messages for insert to authenticated
  with check (public.can_edit_project(project_id) and role = 'user');

-- ---------------------------------------------------------------------------
-- AI generation jobs and concepts
-- ---------------------------------------------------------------------------

create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('concepts', 'chat')),
  provider ai_provider not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  credit_category credit_category not null,
  credits_charged int not null default 0,
  params jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index generation_jobs_project_idx on public.generation_jobs (project_id, created_at desc);
alter table public.generation_jobs enable row level security;
create policy jobs_gen_select on public.generation_jobs for select to authenticated
  using (public.is_project_member(project_id));

create table public.concepts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  job_id uuid references public.generation_jobs (id) on delete set null,
  position int not null default 0,
  title text not null,
  hook text not null,
  target_player text not null,
  core_loop text not null,
  progression text not null,
  original_angle text not null,
  comparable_games jsonb not null default '[]'::jsonb,
  difficulty text not null check (difficulty in ('beginner', 'intermediate', 'advanced')),
  scope text not null,
  monetization jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  opportunity_score int not null check (opportunity_score between 0 and 100),
  score_breakdown jsonb not null,
  confidence text not null check (confidence in ('low', 'medium', 'high')),
  score_explanation text not null,
  status text not null default 'proposed'
    check (status in ('proposed', 'approved', 'revision_requested', 'combined', 'superseded')),
  revision_note text,
  is_fixture boolean not null default false,
  created_at timestamptz not null default now()
);
create index concepts_project_idx on public.concepts (project_id, created_at desc, position);
alter table public.concepts enable row level security;
create policy concepts_select on public.concepts for select to authenticated
  using (public.is_project_member(project_id));

create table public.concept_sources (
  id uuid primary key default gen_random_uuid(),
  concept_id uuid not null references public.concepts (id) on delete cascade,
  claim text not null,
  url text not null check (url ~ '^https?://'),
  title text not null,
  publisher text not null,
  source_date date not null
);
create index concept_sources_idx on public.concept_sources (concept_id);
alter table public.concept_sources enable row level security;
create policy concept_sources_select on public.concept_sources for select to authenticated
  using (exists (select 1 from public.concepts c where c.id = concept_id and public.is_project_member(c.project_id)));

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  kind text not null check (kind in ('concept', 'image', 'blueprint')),
  subject_id uuid not null,
  user_id uuid not null references public.profiles (id),
  decision text not null check (decision in ('approved', 'revision_requested', 'combined')),
  note text,
  created_at timestamptz not null default now()
);
alter table public.approvals enable row level security;
create policy approvals_select on public.approvals for select to authenticated
  using (public.is_project_member(project_id));

alter table public.projects
  add constraint projects_approved_concept_fk foreign key (approved_concept_id)
  references public.concepts (id) on delete set null;

-- Blueprint generation cannot start until a concept is approved: enforced here, not in the UI.
create or replace function public.projects_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.stage in ('blueprint', 'assets', 'scripts', 'test') and new.approved_concept_id is null then
    raise exception 'concept_approval_required';
  end if;
  if new.approved_concept_id is distinct from old.approved_concept_id and new.approved_concept_id is not null then
    if not exists (select 1 from public.concepts where id = new.approved_concept_id
                   and project_id = new.id and status = 'approved') then
      raise exception 'invalid_concept_approval';
    end if;
  end if;
  return new;
end;
$$;
create trigger projects_guard_trg before update on public.projects
  for each row execute function public.projects_guard();

create or replace function public.approve_concept(p_concept uuid, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  c public.concepts%rowtype;
begin
  select * into c from public.concepts where id = p_concept for update;
  if not found then raise exception 'not_found'; end if;
  if not exists (select 1 from public.project_members
                 where project_id = c.project_id and user_id = auth.uid() and role = 'owner') then
    raise exception 'forbidden';
  end if;
  if c.status <> 'proposed' then raise exception 'concept_not_pending'; end if;

  update public.concepts set status = 'superseded'
    where project_id = c.project_id and id <> c.id and status in ('proposed', 'approved');
  update public.concepts set status = 'approved' where id = c.id;
  update public.projects
    set approved_concept_id = c.id, stage = 'blueprint', progress = greatest(progress, 40),
        title = case when title like 'Untitled%' then c.title else title end
    where id = c.project_id;
  insert into public.approvals (project_id, kind, subject_id, user_id, decision, note)
    values (c.project_id, 'concept', c.id, auth.uid(), 'approved', p_note);
  insert into public.build_tasks (project_id, title, detail, position)
    values (c.project_id, 'Review your approved concept and choose a title',
            'Read the concept brief and pick the title you want to build around.', 0),
           (c.project_id, 'Confirm progression and map priorities',
            'Progression, map, UI, thumbnail and the gameplay loop get the most attention in the blueprint.', 1);
end;
$$;

create or replace function public.request_concept_revision(p_concept uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare
  c public.concepts%rowtype;
begin
  select * into c from public.concepts where id = p_concept for update;
  if not found then raise exception 'not_found'; end if;
  if not public.can_edit_project(c.project_id) then raise exception 'forbidden'; end if;
  if c.status <> 'proposed' then raise exception 'concept_not_pending'; end if;
  update public.concepts set status = 'revision_requested', revision_note = p_note where id = c.id;
  insert into public.approvals (project_id, kind, subject_id, user_id, decision, note)
    values (c.project_id, 'concept', c.id, auth.uid(), 'revision_requested', p_note);
end;
$$;

grant execute on function public.approve_concept(uuid, text) to authenticated;
grant execute on function public.request_concept_revision(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Blueprint, assets, scripts, tasks (spec data model; generation at scale is post-beta)
-- ---------------------------------------------------------------------------

create table public.blueprint_sections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  section_key text not null,
  title text not null,
  content jsonb,
  status text not null default 'pending' check (status in ('pending', 'generating', 'review', 'approved', 'needs_review')),
  updated_at timestamptz not null default now(),
  unique (project_id, section_key)
);
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  kind text not null,
  storage_path text,
  created_at timestamptz not null default now()
);
create table public.image_references (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  purpose text not null check (purpose in ('map', 'ui', 'thumbnail', 'character', 'asset')),
  storage_path text not null,
  status text not null default 'review' check (status in ('review', 'approved', 'replaced')),
  uploaded_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);
create table public.script_packages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  system_name text not null,
  studio_location text not null,
  dependencies text[] not null default '{}',
  spec jsonb not null default '{}'::jsonb,
  status text not null default 'specified',
  created_at timestamptz not null default now()
);
create table public.build_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  detail text not null default '',
  due_at timestamptz default (now() + interval '3 days'),
  completed_at timestamptz,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index build_tasks_project_idx on public.build_tasks (project_id, completed_at, position);

do $$
declare t text;
begin
  foreach t in array array['blueprint_sections', 'assets', 'image_references', 'script_packages', 'build_tasks'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_project_member(project_id))', t || '_select', t);
  end loop;
end $$;

create policy blueprint_sections_write on public.blueprint_sections for all to authenticated
  using (public.can_edit_project(project_id)) with check (public.can_edit_project(project_id));
create policy assets_write on public.assets for all to authenticated
  using (public.can_edit_project(project_id)) with check (public.can_edit_project(project_id));
create policy image_references_insert on public.image_references for insert to authenticated
  with check (public.can_edit_project(project_id) and uploaded_by = auth.uid() and status = 'review');
create policy script_packages_write on public.script_packages for all to authenticated
  using (public.can_edit_project(project_id)) with check (public.can_edit_project(project_id));
create policy build_tasks_insert on public.build_tasks for insert to authenticated
  with check (public.can_edit_project(project_id));
create policy build_tasks_update on public.build_tasks for update to authenticated
  using (public.can_edit_project(project_id)) with check (public.can_edit_project(project_id));
create policy build_tasks_delete on public.build_tasks for delete to authenticated
  using (public.can_edit_project(project_id));

-- ---------------------------------------------------------------------------
-- Analytics (private to project members)
-- ---------------------------------------------------------------------------

create table public.metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  captured_on date not null,
  active_players int check (active_players >= 0),
  retention_d1 numeric(5, 2) check (retention_d1 between 0 and 100),
  retention_d7 numeric(5, 2) check (retention_d7 between 0 and 100),
  retention_d30 numeric(5, 2) check (retention_d30 between 0 and 100),
  robux_revenue bigint check (robux_revenue >= 0),
  visits int check (visits >= 0),
  avg_session_minutes numeric(6, 2) check (avg_session_minutes >= 0),
  conversion_rate numeric(5, 2) check (conversion_rate between 0 and 100),
  source text not null check (source in ('manual', 'csv')),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (project_id, captured_on)
);
create index metric_snapshots_idx on public.metric_snapshots (project_id, captured_on desc);
alter table public.metric_snapshots enable row level security;
create policy metrics_select on public.metric_snapshots for select to authenticated
  using (public.is_project_member(project_id));
create policy metrics_insert on public.metric_snapshots for insert to authenticated
  with check (public.can_edit_project(project_id) and created_by = auth.uid());
create policy metrics_update on public.metric_snapshots for update to authenticated
  using (public.can_edit_project(project_id)) with check (public.can_edit_project(project_id));
create policy metrics_delete on public.metric_snapshots for delete to authenticated
  using (public.can_edit_project(project_id));

create table public.analytics_imports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  filename text not null,
  rows_imported int not null default 0,
  status text not null check (status in ('succeeded', 'failed')),
  error text,
  created_at timestamptz not null default now()
);
alter table public.analytics_imports enable row level security;
create policy analytics_imports_select on public.analytics_imports for select to authenticated
  using (public.is_project_member(project_id));
create policy analytics_imports_insert on public.analytics_imports for insert to authenticated
  with check (public.can_edit_project(project_id) and user_id = auth.uid());
