-- Hardening from the Supabase security/performance advisors.

-- 1. Function privileges. Postgres grants EXECUTE to PUBLIC by default, and Supabase also grants it to anon and
--    authenticated, which exposes every SECURITY DEFINER function at /rest/v1/rpc/*.
revoke execute on all functions in schema public from public, anon;

-- Trigger and internal helpers have no legitimate RPC callers (triggers do not need EXECUTE at fire time).
revoke execute on function
  public.add_project_owner(), public.handle_new_user(), public.notify_admins(text, text, text),
  public.notify_new_application(), public.on_comment_created(), public.on_concept_approved(),
  public.on_follow_created(), public.on_metric_created(), public.on_post_created(), public.on_reaction_created(),
  public.on_task_completed(), public.projects_guard(), public.review_rank_event(), public.balance_tx_immutable(),
  public.touch_updated_at()
from authenticated;

-- Future functions are private until explicitly granted.
alter default privileges in schema public revoke execute on functions from public, anon;

-- 2. Pin search_path on the pure helper functions.
alter function public.touch_updated_at() set search_path = '';
alter function public.balance_tx_immutable() set search_path = '';
alter function public.notification_category(text) set search_path = '';
alter function public.ledger_hash(text, bigint, uuid, uuid, text, text, text, bigint, timestamptz) set search_path = '';

-- 3. Index single-column foreign keys that lack a covering index (speeds joins and cascading deletes).
do $$
declare r record;
begin
  for r in
    select c.conrelid::regclass as tbl, a.attname as col, c.conname
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.connamespace = 'public'::regnamespace and array_length(c.conkey, 1) = 1
      and not exists (select 1 from pg_index i where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1])
  loop
    execute format('create index if not exists %I on %s (%I)', left('idx_' || r.conname, 63), r.tbl, r.col);
  end loop;
end $$;

-- 4. Evaluate auth.uid() once per statement instead of once per row in every RLS policy.
do $$
declare p record; using_sql text; check_sql text; stmt text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check from pg_policies
    where schemaname = 'public' and (qual like '%auth.uid()%' or with_check like '%auth.uid()%')
  loop
    using_sql := replace(replace(p.qual, '( SELECT auth.uid() AS uid)', '@@'), 'auth.uid()', '(select auth.uid())');
    check_sql := replace(replace(p.with_check, '( SELECT auth.uid() AS uid)', '@@'), 'auth.uid()', '(select auth.uid())');
    using_sql := replace(using_sql, '@@', '(select auth.uid())');
    check_sql := replace(check_sql, '@@', '(select auth.uid())');
    stmt := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    if p.qual is not null then stmt := stmt || ' using (' || using_sql || ')'; end if;
    if p.with_check is not null then stmt := stmt || ' with check (' || check_sql || ')'; end if;
    execute stmt;
  end loop;
end $$;

-- 5. One permissive policy per action: split FOR ALL policies that overlap with a SELECT policy.
drop policy blueprint_sections_write on public.blueprint_sections;
create policy blueprint_sections_ins on public.blueprint_sections for insert to authenticated with check (public.can_edit_project(project_id));
create policy blueprint_sections_upd on public.blueprint_sections for update to authenticated using (public.can_edit_project(project_id)) with check (public.can_edit_project(project_id));
create policy blueprint_sections_del on public.blueprint_sections for delete to authenticated using (public.can_edit_project(project_id));

drop policy assets_write on public.assets;
create policy assets_ins on public.assets for insert to authenticated with check (public.can_edit_project(project_id));
create policy assets_upd on public.assets for update to authenticated using (public.can_edit_project(project_id)) with check (public.can_edit_project(project_id));
create policy assets_del on public.assets for delete to authenticated using (public.can_edit_project(project_id));

drop policy script_packages_write on public.script_packages;
create policy script_packages_ins on public.script_packages for insert to authenticated with check (public.can_edit_project(project_id));
create policy script_packages_upd on public.script_packages for update to authenticated using (public.can_edit_project(project_id)) with check (public.can_edit_project(project_id));
create policy script_packages_del on public.script_packages for delete to authenticated using (public.can_edit_project(project_id));

drop policy games_write_own on public.games;
create policy games_ins on public.games for insert to authenticated with check (owner_id = (select auth.uid()));
create policy games_upd on public.games for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy games_del on public.games for delete to authenticated using (owner_id = (select auth.uid()));
