-- Work marketplace, protected payments (test mode), tamper-evident ledger, rank, perks.
-- DevMint Balance is an interface over a payment provider; no money is held outside the provider.

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  title text not null check (char_length(title) between 3 and 120),
  description text not null default '',
  category text not null check (category in ('tester', 'scripter', 'map_builder', 'ui_designer', 'modeler', 'animator', 'thumbnail_artist', 'community_manager', 'discord_setup', 'social_media', 'other')),
  deliverables text not null check (char_length(deliverables) >= 5),
  acceptance_conditions text not null check (char_length(acceptance_conditions) >= 5),
  deadline timestamptz not null,
  session_minutes int check (session_minutes between 5 and 600),
  revisions_allowed int not null default 1 check (revisions_allowed between 0 and 5),
  payment_cents int not null check (payment_cents between 500 and 1000000),
  status text not null default 'open' check (status in ('open', 'in_progress', 'closed', 'cancelled')),
  is_official boolean not null default false,
  created_at timestamptz not null default now()
);
create index jobs_status_idx on public.jobs (status, created_at desc);

create table public.job_slots (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  position int not null,
  label text,
  status text not null default 'open' check (status in ('open', 'filled', 'closed')),
  worker_id uuid references public.profiles (id),
  unique (job_id, position)
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  applicant_id uuid not null references public.profiles (id) on delete cascade,
  portfolio_url text check (portfolio_url is null or portfolio_url ~ '^https?://'),
  proof text not null check (char_length(proof) >= 10),
  availability text not null,
  offer text not null check (char_length(offer) >= 10),
  status text not null default 'pending' check (status in ('pending', 'selected', 'rejected', 'withdrawn')),
  created_at timestamptz not null default now(),
  unique (job_id, applicant_id)
);
create index applications_job_idx on public.applications (job_id);

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete restrict,
  slot_id uuid not null unique references public.job_slots (id) on delete restrict,
  buyer_id uuid not null references public.profiles (id),
  worker_id uuid not null references public.profiles (id),
  amount_cents int not null check (amount_cents > 0),
  platform_fee_cents int not null check (platform_fee_cents >= 0),
  fee_bps int not null,
  status text not null default 'awaiting_funding'
    check (status in ('awaiting_funding', 'funded', 'submitted', 'revision_requested', 'approved', 'disputed', 'refunded', 'split')),
  release_reason text check (release_reason in ('approved', 'auto_expired', 'dispute_worker', 'dispute_split')),
  revisions_allowed int not null,
  revisions_used int not null default 0,
  deadline timestamptz not null,
  review_deadline timestamptz,
  created_at timestamptz not null default now(),
  funded_at timestamptz,
  submitted_at timestamptz,
  resolved_at timestamptz,
  check (buyer_id <> worker_id)
);
create index contracts_buyer_idx on public.contracts (buyer_id, created_at desc);
create index contracts_worker_idx on public.contracts (worker_id, created_at desc);
create index contracts_review_idx on public.contracts (review_deadline) where status = 'submitted';

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id) on delete cascade,
  worker_id uuid not null references public.profiles (id),
  note text not null default '',
  evidence jsonb not null default '[]'::jsonb,
  revision_no int not null default 0,
  created_at timestamptz not null default now()
);

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id) on delete cascade,
  opened_by uuid not null references public.profiles (id),
  reason text not null check (char_length(reason) >= 10),
  status text not null default 'open' check (status in ('open', 'resolved')),
  resolution text check (resolution in ('worker', 'buyer', 'split')),
  worker_gross_cents int,
  admin_id uuid references public.profiles (id),
  admin_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create unique index disputes_one_open on public.disputes (contract_id) where status = 'open';

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id),
  reviewee_id uuid not null references public.profiles (id),
  rating int not null check (rating between 1 and 5),
  body text not null default '' check (char_length(body) <= 1000),
  created_at timestamptz not null default now(),
  unique (contract_id, reviewer_id)
);

create table public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id),
  provider text not null check (provider in ('test', 'stripe')),
  provider_ref text not null,
  amount_cents int not null,
  status text not null check (status in ('succeeded', 'refunded', 'partially_refunded')),
  created_at timestamptz not null default now(),
  unique (provider, provider_ref)
);

create table public.balances (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  pending_cents bigint not null default 0 check (pending_cents >= 0),
  available_cents bigint not null default 0 check (available_cents >= 0),
  processing_cents bigint not null default 0 check (processing_cents >= 0),
  paid_out_cents bigint not null default 0 check (paid_out_cents >= 0),
  refunded_cents bigint not null default 0 check (refunded_cents >= 0),
  disputed_cents bigint not null default 0 check (disputed_cents >= 0),
  last_hash text not null default 'genesis',
  updated_at timestamptz not null default now()
);

create table public.balance_transactions (
  id bigserial primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  contract_id uuid references public.contracts (id) on delete set null,
  kind text not null,
  from_state text check (from_state in ('pending', 'available', 'processing', 'paid_out', 'refunded', 'disputed')),
  to_state text check (to_state in ('pending', 'available', 'processing', 'paid_out', 'refunded', 'disputed')),
  amount_cents bigint not null check (amount_cents > 0),
  prev_hash text not null,
  hash text not null,
  created_at timestamptz not null
);
create index balance_tx_user_idx on public.balance_transactions (user_id, id);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0),
  status text not null default 'processing' check (status in ('processing', 'paid', 'failed')),
  created_at timestamptz not null default now()
);

create table public.rank_events (
  id bigserial primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  component text not null check (component in ('game_performance', 'projects', 'paid_work', 'community', 'activity', 'generation')),
  kind text not null,
  points numeric not null,
  ref_id text,
  dedupe_key text unique,
  created_at timestamptz not null default now()
);
create index rank_events_user_idx on public.rank_events (user_id, created_at);

create table public.rank_snapshots (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  score numeric not null default 0,
  tier text not null default 'newcomer',
  components jsonb not null default '{}'::jsonb,
  specialties text[] not null default '{}',
  computed_at timestamptz not null default now()
);
create index rank_snapshots_score_idx on public.rank_snapshots (score desc);

create table public.perks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('credits', 'profile_effect', 'badge', 'featured_game', 'early_access')),
  label text not null,
  meta jsonb not null default '{}'::jsonb,
  dedupe_key text unique,
  granted_at timestamptz not null default now()
);

alter table public.jobs enable row level security;
alter table public.job_slots enable row level security;
alter table public.applications enable row level security;
alter table public.contracts enable row level security;
alter table public.submissions enable row level security;
alter table public.disputes enable row level security;
alter table public.reviews enable row level security;
alter table public.payment_intents enable row level security;
alter table public.balances enable row level security;
alter table public.balance_transactions enable row level security;
alter table public.payouts enable row level security;
alter table public.rank_events enable row level security;
alter table public.rank_snapshots enable row level security;
alter table public.perks enable row level security;

create or replace function public.is_contract_party(p_contract uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.contracts where id = p_contract and auth.uid() in (buyer_id, worker_id));
$$;

-- Jobs and slots are a public marketplace listing.
create policy jobs_select on public.jobs for select to authenticated using (true);
create policy jobs_insert on public.jobs for insert to authenticated
  with check (owner_id = auth.uid() and is_official = false and status = 'open');
create policy jobs_update_own on public.jobs for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
revoke update on public.jobs from authenticated;
grant update (description, status) on public.jobs to authenticated;

create policy slots_select on public.job_slots for select to authenticated using (true);
create policy slots_insert on public.job_slots for insert to authenticated
  with check (exists (select 1 from public.jobs j where j.id = job_id and j.owner_id = auth.uid()) and status = 'open');

create policy applications_select on public.applications for select to authenticated
  using (applicant_id = auth.uid() or exists (select 1 from public.jobs j where j.id = job_id and j.owner_id = auth.uid()));
create policy applications_insert on public.applications for insert to authenticated
  with check (applicant_id = auth.uid() and status = 'pending'
    and exists (select 1 from public.jobs j where j.id = job_id and j.status = 'open' and j.owner_id <> auth.uid()));
create policy applications_withdraw on public.applications for update to authenticated
  using (applicant_id = auth.uid() and status = 'pending') with check (applicant_id = auth.uid() and status = 'withdrawn');
revoke update on public.applications from authenticated;
grant update (status) on public.applications to authenticated;

create policy contracts_select on public.contracts for select to authenticated
  using (auth.uid() in (buyer_id, worker_id) or public.is_admin());
create policy submissions_select on public.submissions for select to authenticated
  using (public.is_contract_party(contract_id) or public.is_admin());
create policy disputes_select on public.disputes for select to authenticated
  using (public.is_contract_party(contract_id) or public.is_admin());
create policy reviews_select on public.reviews for select to authenticated using (true);
create policy reviews_insert on public.reviews for insert to authenticated
  with check (reviewer_id = auth.uid() and exists (
    select 1 from public.contracts c
    where c.id = contract_id and c.status in ('approved', 'split')
      and ((c.buyer_id = auth.uid() and c.worker_id = reviewee_id)
        or (c.worker_id = auth.uid() and c.buyer_id = reviewee_id))));
create policy payment_intents_select on public.payment_intents for select to authenticated
  using (buyer_id = auth.uid() or public.is_admin());
create policy balances_select on public.balances for select to authenticated using (user_id = auth.uid());
create policy balance_tx_select on public.balance_transactions for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy payouts_select on public.payouts for select to authenticated using (user_id = auth.uid());
create policy rank_events_select on public.rank_events for select to authenticated using (user_id = auth.uid());
create policy rank_snapshots_select on public.rank_snapshots for select to authenticated using (true);
create policy perks_select on public.perks for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Tamper-evident ledger. Balances change only through ledger_append, which chains hashes per user.
-- ---------------------------------------------------------------------------

create or replace function public.balance_tx_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'balance_transactions is append-only';
end;
$$;
create trigger balance_tx_no_update before update or delete on public.balance_transactions
  for each row execute function public.balance_tx_immutable();

create or replace function public.ledger_hash(
  p_prev text, p_id bigint, p_user uuid, p_contract uuid, p_kind text,
  p_from text, p_to text, p_amount bigint, p_at timestamptz
) returns text
language sql immutable as $$
  select encode(extensions.digest(
    concat_ws('|', p_prev, p_id::text, p_user::text, coalesce(p_contract::text, ''), p_kind,
              coalesce(p_from, ''), coalesce(p_to, ''), p_amount::text, extract(epoch from p_at)::text),
    'sha256'), 'hex');
$$;

create or replace function public.ledger_append(
  p_user uuid, p_contract uuid, p_kind text, p_from text, p_to text, p_amount bigint
) returns void
language plpgsql security definer set search_path = public as $$
declare
  b public.balances%rowtype;
  new_id bigint;
  ts timestamptz := clock_timestamp();
  h text;
begin
  if p_amount <= 0 then raise exception 'invalid_amount'; end if;
  insert into public.balances (user_id) values (p_user) on conflict do nothing;
  select * into b from public.balances where user_id = p_user for update;

  if p_from is not null then
    execute format('update public.balances set %I = %I - $1 where user_id = $2', p_from || '_cents', p_from || '_cents')
      using p_amount, p_user;
  end if;
  if p_to is not null then
    execute format('update public.balances set %I = %I + $1 where user_id = $2', p_to || '_cents', p_to || '_cents')
      using p_amount, p_user;
  end if;

  new_id := nextval(pg_get_serial_sequence('public.balance_transactions', 'id'));
  h := public.ledger_hash(b.last_hash, new_id, p_user, p_contract, p_kind, p_from, p_to, p_amount, ts);
  insert into public.balance_transactions
    (id, user_id, contract_id, kind, from_state, to_state, amount_cents, prev_hash, hash, created_at)
    values (new_id, p_user, p_contract, p_kind, p_from, p_to, p_amount, b.last_hash, h, ts);
  update public.balances set last_hash = h, updated_at = now() where user_id = p_user;
end;
$$;

create or replace function public.verify_ledger(p_user uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  t record;
  prev text := 'genesis';
  b public.balances%rowtype;
begin
  if auth.uid() is distinct from p_user and not public.is_admin() then raise exception 'forbidden'; end if;
  for t in select * from public.balance_transactions where user_id = p_user order by id loop
    if t.prev_hash <> prev then return false; end if;
    if t.hash <> public.ledger_hash(t.prev_hash, t.id, t.user_id, t.contract_id, t.kind,
                                    t.from_state, t.to_state, t.amount_cents, t.created_at) then
      return false;
    end if;
    prev := t.hash;
  end loop;
  select * into b from public.balances where user_id = p_user;
  return not found and prev = 'genesis' or (found and b.last_hash = prev);
end;
$$;
grant execute on function public.verify_ledger(uuid) to authenticated;
revoke all on function public.ledger_append(uuid, uuid, text, text, text, bigint) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Marketplace state machine
-- ---------------------------------------------------------------------------

create or replace function public.notify_admins(p_title text, p_body text, p_href text) returns void
language plpgsql security definer set search_path = public as $$
declare a uuid;
begin
  for a in select id from public.profiles where is_admin loop
    perform public.notify(a, 'admin_dispute', p_title, p_body, p_href, true, null);
  end loop;
end;
$$;

create or replace function public.notify_new_application() returns trigger
language plpgsql security definer set search_path = public as $$
declare j public.jobs%rowtype; who text;
begin
  select * into j from public.jobs where id = new.job_id;
  select display_name into who from public.profiles where id = new.applicant_id;
  perform public.notify(j.owner_id, 'job_application', who || ' applied to "' || j.title || '"', left(new.offer, 120),
                        '/work/' || j.id, false, 'job_application:' || j.id);
  return new;
end;
$$;
create trigger applications_notify after insert on public.applications
  for each row execute function public.notify_new_application();

create or replace function public.select_applicant(p_application uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  app public.applications%rowtype;
  j public.jobs%rowtype;
  slot public.job_slots%rowtype;
  fee_bps int := 1000; -- 10% platform fee; independent of rank by design
  fee int;
  cid uuid;
  open_left int;
begin
  select * into app from public.applications where id = p_application for update;
  if not found then raise exception 'not_found'; end if;
  select * into j from public.jobs where id = app.job_id for update;
  if j.owner_id <> auth.uid() then raise exception 'forbidden'; end if;
  if app.status <> 'pending' then raise exception 'application_not_pending'; end if;
  if j.status not in ('open', 'in_progress') then raise exception 'job_closed'; end if;

  select * into slot from public.job_slots where job_id = j.id and status = 'open'
    order by position limit 1 for update;
  if not found then raise exception 'no_open_slot'; end if;

  fee := (j.payment_cents * fee_bps) / 10000;
  insert into public.contracts (job_id, slot_id, buyer_id, worker_id, amount_cents, platform_fee_cents, fee_bps,
                                revisions_allowed, deadline)
    values (j.id, slot.id, j.owner_id, app.applicant_id, j.payment_cents, fee, fee_bps, j.revisions_allowed, j.deadline)
    returning id into cid;
  update public.job_slots set status = 'filled', worker_id = app.applicant_id where id = slot.id;
  update public.applications set status = 'selected' where id = app.id;

  select count(*) into open_left from public.job_slots where job_id = j.id and status = 'open';
  update public.jobs set status = case when open_left = 0 then 'in_progress' else 'open' end where id = j.id;

  perform public.notify(app.applicant_id, 'job_selected', 'You were selected for "' || j.title || '"',
                        'Work begins once the buyer funds the job.', '/work/contracts/' || cid, true, null);
  return cid;
end;
$$;

create or replace function public.fund_contract(p_contract uuid, p_buyer uuid, p_provider text, p_ref text) returns void
language plpgsql security definer set search_path = public as $$
declare c public.contracts%rowtype;
begin
  select * into c from public.contracts where id = p_contract for update;
  if not found then raise exception 'not_found'; end if;
  if c.buyer_id <> p_buyer then raise exception 'forbidden'; end if;
  if c.status <> 'awaiting_funding' then raise exception 'already_funded'; end if;

  insert into public.payment_intents (contract_id, buyer_id, provider, provider_ref, amount_cents, status)
    values (c.id, c.buyer_id, p_provider, p_ref, c.amount_cents, 'succeeded');
  update public.contracts set status = 'funded', funded_at = now() where id = c.id;
  perform public.ledger_append(c.worker_id, c.id, 'escrow_funded', null, 'pending', c.amount_cents - c.platform_fee_cents);
  perform public.notify(c.worker_id, 'payment_funded', 'Job funded — you can start',
                        'Payment is protected and pending until the work is approved.', '/work/contracts/' || c.id, true, null);
end;
$$;
revoke all on function public.fund_contract(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.fund_contract(uuid, uuid, text, text) to service_role;

create or replace function public.submit_work(p_contract uuid, p_note text, p_evidence jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare c public.contracts%rowtype; title text;
begin
  select * into c from public.contracts where id = p_contract for update;
  if not found or c.worker_id <> auth.uid() then raise exception 'forbidden'; end if;
  if c.status not in ('funded', 'revision_requested') then raise exception 'invalid_state'; end if;
  if char_length(coalesce(p_note, '')) = 0 and jsonb_array_length(coalesce(p_evidence, '[]'::jsonb)) = 0 then
    raise exception 'evidence_required';
  end if;
  insert into public.submissions (contract_id, worker_id, note, evidence, revision_no)
    values (c.id, c.worker_id, coalesce(p_note, ''), coalesce(p_evidence, '[]'::jsonb), c.revisions_used);
  update public.contracts set status = 'submitted', submitted_at = now(), review_deadline = now() + interval '7 days'
    where id = c.id;
  select j.title into title from public.jobs j where j.id = c.job_id;
  perform public.notify(c.buyer_id, 'work_submitted', 'Work submitted for "' || title || '"',
                        'Review within 7 days or it is approved automatically.', '/work/contracts/' || c.id, true, null);
end;
$$;

create or replace function public.request_revision(p_contract uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare c public.contracts%rowtype;
begin
  select * into c from public.contracts where id = p_contract for update;
  if not found or c.buyer_id <> auth.uid() then raise exception 'forbidden'; end if;
  if c.status <> 'submitted' then raise exception 'invalid_state'; end if;
  if c.revisions_used >= c.revisions_allowed then raise exception 'no_revisions_left'; end if;
  update public.contracts set status = 'revision_requested', revisions_used = revisions_used + 1, review_deadline = null
    where id = c.id;
  perform public.notify(c.worker_id, 'revision_requested', 'Revision requested', left(coalesce(p_note, ''), 160),
                        '/work/contracts/' || c.id, false, null);
end;
$$;

create or replace function public._release_contract(p_contract uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare c public.contracts%rowtype; net bigint;
begin
  select * into c from public.contracts where id = p_contract for update;
  if c.status <> 'submitted' then return; end if;
  net := c.amount_cents - c.platform_fee_cents;
  perform public.ledger_append(c.worker_id, c.id, 'release', 'pending', 'available', net);
  update public.contracts set status = 'approved', release_reason = p_reason, resolved_at = now() where id = c.id;
  update public.job_slots set status = 'closed' where id = c.slot_id;
  insert into public.rank_events (user_id, component, kind, points, ref_id, dedupe_key)
    values (c.worker_id, 'paid_work', 'contract_completed', 10, c.id::text, 'contract_completed:' || c.id)
    on conflict (dedupe_key) do nothing;
  insert into public.rank_events (user_id, component, kind, points, ref_id, dedupe_key)
    values (c.buyer_id, 'projects', 'work_completed_as_buyer', 3, c.id::text, 'contract_buyer:' || c.id)
    on conflict (dedupe_key) do nothing;
  perform public.notify(c.worker_id, 'payment_available',
                        'Payment available: $' || to_char(net / 100.0, 'FM999990.00'),
                        case when p_reason = 'auto_expired' then 'The review window ended, so the work was approved.' else 'The buyer approved your work.' end,
                        '/work/contracts/' || c.id, true, null);
end;
$$;
revoke all on function public._release_contract(uuid, text) from public, anon, authenticated;

create or replace function public.approve_contract(p_contract uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c public.contracts%rowtype;
begin
  select * into c from public.contracts where id = p_contract;
  if not found or c.buyer_id <> auth.uid() then raise exception 'forbidden'; end if;
  if c.status <> 'submitted' then raise exception 'invalid_state'; end if;
  perform public._release_contract(p_contract, 'approved');
end;
$$;

-- Idempotent and time-based, so any authenticated caller or the cron route may run it.
create or replace function public.release_expired_reviews() returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select id from public.contracts where status = 'submitted' and review_deadline < now() loop
    perform public._release_contract(r.id, 'auto_expired');
    n := n + 1;
  end loop;
  return n;
end;
$$;

create or replace function public.open_dispute(p_contract uuid, p_reason text) returns uuid
language plpgsql security definer set search_path = public as $$
declare c public.contracts%rowtype; did uuid; other uuid;
begin
  select * into c from public.contracts where id = p_contract for update;
  if not found or auth.uid() not in (c.buyer_id, c.worker_id) then raise exception 'forbidden'; end if;
  if c.status not in ('funded', 'submitted', 'revision_requested') then raise exception 'invalid_state'; end if;
  if char_length(coalesce(p_reason, '')) < 10 then raise exception 'reason_required'; end if;

  insert into public.disputes (contract_id, opened_by, reason) values (c.id, auth.uid(), p_reason) returning id into did;
  perform public.ledger_append(c.worker_id, c.id, 'dispute_opened', 'pending', 'disputed', c.amount_cents - c.platform_fee_cents);
  update public.contracts set status = 'disputed', review_deadline = null where id = c.id;
  other := case when auth.uid() = c.buyer_id then c.worker_id else c.buyer_id end;
  perform public.notify(other, 'dispute_opened', 'A dispute was opened',
                        'Payment is frozen while DevMint reviews the agreement, messages and evidence.',
                        '/work/contracts/' || c.id, true, null);
  perform public.notify_admins('Dispute needs review', left(p_reason, 140), '/admin/disputes');
  return did;
end;
$$;

create or replace function public.resolve_dispute(
  p_dispute uuid, p_resolution text, p_worker_gross_cents int, p_note text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  d public.disputes%rowtype;
  c public.contracts%rowtype;
  worker_gross int;
  fee_part int;
  worker_net int;
  held int;
  forfeit int;
  refund int;
  final_status text;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select * into d from public.disputes where id = p_dispute for update;
  if not found or d.status <> 'open' then raise exception 'dispute_not_open'; end if;
  select * into c from public.contracts where id = d.contract_id for update;

  worker_gross := case p_resolution
    when 'worker' then c.amount_cents
    when 'buyer' then 0
    when 'split' then p_worker_gross_cents
    else null end;
  if worker_gross is null then raise exception 'invalid_resolution'; end if;
  if p_resolution = 'split' and (worker_gross <= 0 or worker_gross >= c.amount_cents) then
    raise exception 'invalid_split';
  end if;

  fee_part := (worker_gross * c.fee_bps) / 10000;
  worker_net := worker_gross - fee_part;
  held := c.amount_cents - c.platform_fee_cents;
  forfeit := held - worker_net;
  refund := c.amount_cents - worker_gross;

  if worker_net > 0 then
    perform public.ledger_append(c.worker_id, c.id, 'dispute_release', 'disputed', 'available', worker_net);
  end if;
  if forfeit > 0 then
    perform public.ledger_append(c.worker_id, c.id, 'dispute_forfeit', 'disputed', null, forfeit);
  end if;
  if refund > 0 then
    perform public.ledger_append(c.buyer_id, c.id, 'dispute_refund', null, 'refunded', refund);
    update public.payment_intents set status = case when worker_gross = 0 then 'refunded' else 'partially_refunded' end
      where contract_id = c.id;
  end if;

  final_status := case p_resolution when 'worker' then 'approved' when 'buyer' then 'refunded' else 'split' end;
  update public.contracts
    set status = final_status, resolved_at = now(),
        release_reason = case p_resolution when 'worker' then 'dispute_worker' when 'split' then 'dispute_split' else null end
    where id = c.id;
  update public.job_slots set status = 'closed' where id = c.slot_id;
  update public.disputes
    set status = 'resolved', resolution = p_resolution, worker_gross_cents = worker_gross,
        admin_id = auth.uid(), admin_note = p_note, resolved_at = now()
    where id = d.id;

  perform public.notify(c.worker_id, 'dispute_resolved', 'Dispute resolved', coalesce(p_note, ''),
                        '/work/contracts/' || c.id, true, null);
  perform public.notify(c.buyer_id, 'dispute_resolved', 'Dispute resolved', coalesce(p_note, ''),
                        '/work/contracts/' || c.id, true, null);
end;
$$;

grant execute on function public.select_applicant(uuid) to authenticated;
grant execute on function public.submit_work(uuid, text, jsonb) to authenticated;
grant execute on function public.request_revision(uuid, text) to authenticated;
grant execute on function public.approve_contract(uuid) to authenticated;
grant execute on function public.release_expired_reviews() to authenticated;
grant execute on function public.open_dispute(uuid, text) to authenticated;
grant execute on function public.resolve_dispute(uuid, text, int, text) to authenticated;

-- Reviews feed rank events.
create or replace function public.review_rank_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.rank_events (user_id, component, kind, points, ref_id, dedupe_key)
    values (new.reviewee_id, 'paid_work', 'review_received',
            case new.rating when 5 then 6 when 4 then 3 when 3 then 0 when 2 then -3 else -6 end,
            new.id::text, 'review:' || new.id)
    on conflict (dedupe_key) do nothing;
  perform public.notify(new.reviewee_id, 'review', 'You received a ' || new.rating || '-star review', left(new.body, 120),
                        '/profile', false, 'review');
  return new;
end;
$$;
create trigger reviews_rank after insert on public.reviews
  for each row execute function public.review_rank_event();
