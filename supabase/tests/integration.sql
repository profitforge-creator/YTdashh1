-- Integration tests for RLS, credits, approvals, messaging, marketplace and the ledger.
-- Run via scripts/db-test.sh against a scratch database. Any failed assertion aborts the run.

create or replace function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, false);
  execute 'set role authenticated';
end $$;

create or replace function pg_temp.as_service() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
  execute 'set role service_role';
end $$;

create or replace function pg_temp.expect_error(sql text, needle text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    if sqlerrm like '%' || needle || '%' then return; end if;
    raise exception 'expected error containing "%" but got "%"', needle, sqlerrm;
  end;
  raise exception 'expected error containing "%" but statement succeeded: %', needle, sql;
end $$;

create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'ASSERTION FAILED: %', msg; end if;
end $$;

-- Users: buyer A, worker B, admin C ---------------------------------------------------------
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'buyer@example.com'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'worker@example.com'),
  ('cccccccc-0000-0000-0000-000000000003', 'admin@example.com');
update public.profiles set is_admin = true where id = 'cccccccc-0000-0000-0000-000000000003';

-- bootstrap ---------------------------------------------------------------------------------
select pg_temp.assert((select count(*) from public.profiles) = 3, 'profiles created by trigger');
select pg_temp.assert((select count(*) from public.credit_wallets where user_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 5, 'five wallets per user');
select pg_temp.assert((select subscription_balance from public.credit_wallets where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' and category = 'research') = 10, 'free plan grants 10 research credits');

-- credits -----------------------------------------------------------------------------------
select pg_temp.as_service();
select public.debit_credits('aaaaaaaa-0000-0000-0000-000000000001', 'research', 10, 'test', null);
select pg_temp.expect_error($$select public.debit_credits('aaaaaaaa-0000-0000-0000-000000000001', 'research', 1, 'test', null)$$, 'insufficient_credits');
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.expect_error($$select public.debit_credits('aaaaaaaa-0000-0000-0000-000000000001', 'research', 1, 'x', null)$$, 'permission denied');
-- RLS has no update policy, so this affects zero rows rather than raising.
update public.credit_wallets set purchased_balance = 999;
select pg_temp.assert((select purchased_balance from public.credit_wallets where category = 'research' and user_id = auth.uid()) = 0, 'client cannot grant itself credits');
reset role;

-- grant is idempotent within a month, and refunds go back to the original bucket
select pg_temp.as_service();
select public.grant_monthly_credits('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.assert((select subscription_balance from public.credit_wallets where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' and category = 'research') = 0, 'no double grant in the same month');
insert into public.projects (id, owner_id, title, route) values ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'P1', 'idea');
insert into public.generation_jobs (id, project_id, user_id, kind, provider, credit_category) values ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'concepts', 'claude', 'research');
update public.credit_wallets set subscription_balance = 10 where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' and category = 'research';
select public.debit_credits('aaaaaaaa-0000-0000-0000-000000000001', 'research', 10, 'concept_research', '22222222-0000-0000-0000-000000000001');
select public.refund_credits('aaaaaaaa-0000-0000-0000-000000000001', 'research', '22222222-0000-0000-0000-000000000001');
select public.refund_credits('aaaaaaaa-0000-0000-0000-000000000001', 'research', '22222222-0000-0000-0000-000000000001');
select pg_temp.assert((select subscription_balance from public.credit_wallets where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' and category = 'research') = 10, 'refund restores credits exactly once');
reset role;

-- profile privilege escalation ---------------------------------------------------------------
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.expect_error($$update public.profiles set is_admin = true where id = auth.uid()$$, 'permission denied');
reset role;

-- project and metrics privacy ----------------------------------------------------------------
select pg_temp.as_service();
insert into public.metric_snapshots (project_id, captured_on, active_players, robux_revenue, source, created_by)
  values ('11111111-0000-0000-0000-000000000001', current_date, 500, 12000, 'manual', 'aaaaaaaa-0000-0000-0000-000000000001');
insert into public.project_interviews (project_id, answers) values ('11111111-0000-0000-0000-000000000001', '{}');
reset role;
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.assert((select count(*) from public.projects) = 0, 'private project invisible to others');
select pg_temp.assert((select count(*) from public.metric_snapshots) = 0, 'private revenue invisible to others');
select pg_temp.assert((select count(*) from public.project_interviews) = 0, 'interview invisible to others');
select pg_temp.expect_error($$insert into public.metric_snapshots (project_id, captured_on, source, created_by, active_players) values ('11111111-0000-0000-0000-000000000001', current_date - 1, 'manual', auth.uid(), 1)$$, 'row-level security');
reset role;
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.assert((select count(*) from public.metric_snapshots) = 1, 'owner sees own metrics');
reset role;

-- concept approval gating ---------------------------------------------------------------------
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.expect_error($$update public.projects set stage = 'blueprint' where id = '11111111-0000-0000-0000-000000000001'$$, 'concept_approval_required');
reset role;
select pg_temp.as_service();
insert into public.concepts (id, project_id, title, hook, target_player, core_loop, progression, original_angle, difficulty, scope, opportunity_score, score_breakdown, confidence, score_explanation)
  values ('33333333-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Concept', 'hook hook hook', 'tp', 'loop loop loop', 'prog prog prog', 'angle angle', 'beginner', 'small', 70, '{}', 'medium', 'x');
reset role;
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.assert((select count(*) from public.concepts) = 0, 'concepts invisible to non-members');
select pg_temp.expect_error($$select public.approve_concept('33333333-0000-0000-0000-000000000001')$$, 'forbidden');
reset role;
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.expect_error($$update public.projects set approved_concept_id = '33333333-0000-0000-0000-000000000001' where id = '11111111-0000-0000-0000-000000000001'$$, 'permission denied');
select public.approve_concept('33333333-0000-0000-0000-000000000001');
select pg_temp.assert((select stage::text from public.projects where id = '11111111-0000-0000-0000-000000000001') = 'blueprint', 'approval moves project to blueprint');
select pg_temp.expect_error($$select public.approve_concept('33333333-0000-0000-0000-000000000001')$$, 'concept_not_pending');
reset role;
select pg_temp.assert((select count(*) from public.rank_events where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' and kind = 'concept_approved') = 1, 'approval records a rank event');

-- messaging: requests -----------------------------------------------------------------------------
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select public.start_conversation('aaaaaaaa-0000-0000-0000-000000000001', 'hi, want to work together?');
select pg_temp.expect_error($$select public.send_message((select conversation_id from public.conversation_members where user_id = auth.uid() limit 1), 'follow up')$$, 'request_pending');
reset role;
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.assert((select count(*) from public.message_requests where recipient_id = auth.uid() and status = 'pending') = 1, 'recipient sees a pending request');
select public.respond_message_request((select id from public.message_requests limit 1), true);
select public.send_message((select conversation_id from public.message_requests limit 1), 'sure');
reset role;
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select public.send_message((select conversation_id from public.conversation_members where user_id = auth.uid() limit 1), 'great');
reset role;
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.assert((select count(*) from public.messages) = 0, 'outsiders cannot read messages');
reset role;

-- blocking prevents contact -----------------------------------------------------------------------
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), 'cccccccc-0000-0000-0000-000000000003');
reset role;
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect_error($$select public.start_conversation('aaaaaaaa-0000-0000-0000-000000000001', 'hello')$$, 'blocked');
reset role;

-- marketplace: happy path ---------------------------------------------------------------------------
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
insert into public.jobs (id, owner_id, title, category, deliverables, acceptance_conditions, deadline, payment_cents, revisions_allowed)
  values ('44444444-0000-0000-0000-000000000001', auth.uid(), 'Playtest my obby', 'tester', 'report + video', '5 findings', now() + interval '7 days', 2000, 1);
insert into public.job_slots (job_id, position) values ('44444444-0000-0000-0000-000000000001', 1), ('44444444-0000-0000-0000-000000000001', 2);
reset role;
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
insert into public.applications (id, job_id, applicant_id, proof, availability, offer)
  values ('55555555-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000001', auth.uid(), 'tested 20 games', 'evenings', 'I will deliver a thorough report');
select pg_temp.expect_error($$select public.select_applicant('55555555-0000-0000-0000-000000000001')$$, 'forbidden');
reset role;
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.assert((select count(*) from public.notifications where user_id = auth.uid() and kind = 'job_application') = 1, 'owner notified of application');
select public.select_applicant('55555555-0000-0000-0000-000000000001');
reset role;
select pg_temp.assert((select status from public.contracts limit 1) = 'awaiting_funding', 'contract awaits funding');
select pg_temp.assert((select platform_fee_cents from public.contracts limit 1) = 200, '10% fee');

-- clients cannot fund directly
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.expect_error($$select public.fund_contract((select id from public.contracts limit 1), auth.uid(), 'test', 'x')$$, 'permission denied');
reset role;
select pg_temp.as_service();
select public.fund_contract((select id from public.contracts limit 1), 'aaaaaaaa-0000-0000-0000-000000000001', 'test', 'test_pi_1');
select pg_temp.expect_error($$select public.fund_contract((select id from public.contracts limit 1), 'aaaaaaaa-0000-0000-0000-000000000001', 'test', 'test_pi_2')$$, 'already_funded');
reset role;
select pg_temp.assert((select pending_cents from public.balances where user_id = 'bbbbbbbb-0000-0000-0000-000000000002') = 1800, 'worker pending = amount - fee');

select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.expect_error($$select public.submit_work((select id from public.contracts limit 1), '', '[]'::jsonb)$$, 'evidence_required');
select public.submit_work((select id from public.contracts limit 1), 'Found 6 bugs', '[{"path":"x/a.png","name":"a.png","mime":"image/png"}]'::jsonb);
reset role;
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.assert((select count(*) from public.balances) >= 0, 'admin query ok');
reset role;
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select public.request_revision((select id from public.contracts limit 1), 'add repro steps');
select pg_temp.expect_error($$select public.request_revision((select id from public.contracts limit 1), 'again')$$, 'invalid_state');
reset role;
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select public.submit_work((select id from public.contracts limit 1), 'With repro steps', '[]'::jsonb);
reset role;
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.expect_error($$select public.approve_contract('00000000-0000-0000-0000-000000000000')$$, 'forbidden');
select public.approve_contract((select id from public.contracts limit 1));
select pg_temp.expect_error($$select public.approve_contract((select id from public.contracts limit 1))$$, 'invalid_state');
reset role;
select pg_temp.assert((select available_cents from public.balances where user_id = 'bbbbbbbb-0000-0000-0000-000000000002') = 1800, 'approval releases payment to available');
select pg_temp.assert((select pending_cents from public.balances where user_id = 'bbbbbbbb-0000-0000-0000-000000000002') = 0, 'pending cleared');
select pg_temp.assert((select count(*) from public.rank_events where user_id = 'bbbbbbbb-0000-0000-0000-000000000002' and kind = 'contract_completed') = 1, 'rank event for completed work');

-- reviews only by parties of a decided contract, and feed rank
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
insert into public.reviews (contract_id, reviewer_id, reviewee_id, rating, body) values ((select id from public.contracts limit 1), auth.uid(), 'bbbbbbbb-0000-0000-0000-000000000002', 5, 'great');
select pg_temp.expect_error($$insert into public.reviews (contract_id, reviewer_id, reviewee_id, rating) values ((select id from public.contracts limit 1), auth.uid(), 'bbbbbbbb-0000-0000-0000-000000000002', 4)$$, 'duplicate');
reset role;
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect_error($$insert into public.reviews (contract_id, reviewer_id, reviewee_id, rating) values ((select id from public.contracts limit 1), auth.uid(), 'bbbbbbbb-0000-0000-0000-000000000002', 1)$$, 'row-level security');
reset role;

-- ledger tamper evidence --------------------------------------------------------------------------------
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.assert(public.verify_ledger(auth.uid()), 'ledger verifies');
reset role;
select pg_temp.expect_error($$update public.balance_transactions set amount_cents = 1$$, 'append-only');
select pg_temp.expect_error($$delete from public.balance_transactions$$, 'append-only');
alter table public.balance_transactions disable trigger balance_tx_no_update;
update public.balance_transactions set amount_cents = amount_cents + 1 where id = (select min(id) from public.balance_transactions);
alter table public.balance_transactions enable trigger balance_tx_no_update;
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.assert(not public.verify_ledger(auth.uid()), 'tampering is detected');
reset role;
alter table public.balance_transactions disable trigger balance_tx_no_update;
update public.balance_transactions set amount_cents = amount_cents - 1 where id = (select min(id) from public.balance_transactions);
alter table public.balance_transactions enable trigger balance_tx_no_update;

-- second slot: dispute with a split ------------------------------------------------------------------------
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
insert into public.applications (id, job_id, applicant_id, proof, availability, offer)
  values ('55555555-0000-0000-0000-000000000002', '44444444-0000-0000-0000-000000000001', auth.uid(), 'some proof here', 'anytime', 'I can do this one');
reset role;
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select public.select_applicant('55555555-0000-0000-0000-000000000002');
reset role;
select pg_temp.as_service();
select public.fund_contract((select id from public.contracts where worker_id = 'cccccccc-0000-0000-0000-000000000003'), 'aaaaaaaa-0000-0000-0000-000000000001', 'test', 'test_pi_3');
reset role;
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select public.submit_work((select id from public.contracts where worker_id = auth.uid()), 'done', '[]'::jsonb);
reset role;
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.expect_error($$select public.open_dispute((select id from public.contracts where worker_id = 'cccccccc-0000-0000-0000-000000000003'), 'short')$$, 'reason_required');
select public.open_dispute((select id from public.contracts where worker_id = 'cccccccc-0000-0000-0000-000000000003'), 'The report did not include repro steps');
reset role;
select pg_temp.assert((select disputed_cents from public.balances where user_id = 'cccccccc-0000-0000-0000-000000000003') = 1800, 'dispute freezes payment');
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.expect_error($$select public.resolve_dispute((select id from public.disputes limit 1), 'buyer', 0, 'no')$$, 'forbidden');
reset role;
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect_error($$select public.resolve_dispute((select id from public.disputes limit 1), 'split', 2000, 'no')$$, 'invalid_split');
select public.resolve_dispute((select id from public.disputes limit 1), 'split', 1000, 'Partial credit');
reset role;
-- worker gross 1000 -> fee 100 -> net 900 available; held was 1800 so 900 forfeited; buyer refunded 1000
select pg_temp.assert((select available_cents from public.balances where user_id = 'cccccccc-0000-0000-0000-000000000003') = 900, 'split pays worker net share');
select pg_temp.assert((select disputed_cents from public.balances where user_id = 'cccccccc-0000-0000-0000-000000000003') = 0, 'dispute cleared');
select pg_temp.assert((select refunded_cents from public.balances where user_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 1000, 'buyer refunded the remainder');
select pg_temp.assert((select status from public.contracts where worker_id = 'cccccccc-0000-0000-0000-000000000003') = 'split', 'contract marked split');
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.assert(public.verify_ledger(auth.uid()), 'admin ledger verifies');
reset role;

-- auto-release after the 7-day window ------------------------------------------------------------------------
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
insert into public.jobs (id, owner_id, title, category, deliverables, acceptance_conditions, deadline, payment_cents)
  values ('44444444-0000-0000-0000-000000000002', auth.uid(), 'Map polish', 'map_builder', 'a polished map', 'looks good', now() + interval '3 days', 5000);
insert into public.job_slots (job_id, position) values ('44444444-0000-0000-0000-000000000002', 1);
reset role;
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
insert into public.applications (id, job_id, applicant_id, proof, availability, offer)
  values ('55555555-0000-0000-0000-000000000003', '44444444-0000-0000-0000-000000000002', auth.uid(), 'map portfolio here', 'always', 'I will polish it nicely');
reset role;
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select public.select_applicant('55555555-0000-0000-0000-000000000003');
reset role;
select pg_temp.as_service();
select public.fund_contract((select id from public.contracts where job_id = '44444444-0000-0000-0000-000000000002'), 'aaaaaaaa-0000-0000-0000-000000000001', 'test', 'test_pi_4');
reset role;
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select public.submit_work((select id from public.contracts where job_id = '44444444-0000-0000-0000-000000000002'), 'polished', '[]'::jsonb);
select pg_temp.assert(public.release_expired_reviews() = 0, 'nothing expired yet');
reset role;
update public.contracts set review_deadline = now() - interval '1 minute' where job_id = '44444444-0000-0000-0000-000000000002';
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.assert(public.release_expired_reviews() = 1, 'expired review auto-releases');
select pg_temp.assert(public.release_expired_reviews() = 0, 'release is idempotent');
reset role;
select pg_temp.assert((select release_reason from public.contracts where job_id = '44444444-0000-0000-0000-000000000002') = 'auto_expired', 'auto-expired reason');
select pg_temp.assert((select available_cents from public.balances where user_id = 'bbbbbbbb-0000-0000-0000-000000000002') = 1800 + 4500, 'worker paid after expiry');

-- feed: posts, stats, mutes ----------------------------------------------------------------------------------
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
insert into public.posts (id, author_id, body) values ('66666666-0000-0000-0000-000000000001', auth.uid(), 'shipping my obby');
reset role;
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
insert into public.reactions (post_id, user_id) values ('66666666-0000-0000-0000-000000000001', auth.uid());
insert into public.comments (post_id, author_id, body) values ('66666666-0000-0000-0000-000000000001', auth.uid(), 'nice');
select pg_temp.assert((select likes from public.post_stats(array['66666666-0000-0000-0000-000000000001']::uuid[])) = 1, 'post_stats counts likes');
select pg_temp.assert((select liked from public.post_stats(array['66666666-0000-0000-0000-000000000001']::uuid[])), 'post_stats knows viewer liked');
select pg_temp.expect_error($$insert into public.posts (author_id, body, is_official) values (auth.uid(), 'fake official', true)$$, 'row-level security');
select pg_temp.expect_error($$update public.posts set author_id = auth.uid() where id = '66666666-0000-0000-0000-000000000001'$$, 'permission denied');
reset role;
select pg_temp.assert((select count(*) from public.rank_events where kind = 'like_received') = 1, 'like becomes a rank event');

-- reports and moderation ---------------------------------------------------------------------------------------
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
insert into public.reports (reporter_id, target_type, target_id, reason) values (auth.uid(), 'post', '66666666-0000-0000-0000-000000000001', 'spam');
select pg_temp.assert((select count(*) from public.reports) = 1, 'reporter sees own report');
select pg_temp.expect_error($$select public.moderate_report((select id from public.reports limit 1), 'remove_content')$$, 'forbidden');
reset role;
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select public.moderate_report((select id from public.reports limit 1), 'remove_content', 'spam');
reset role;
select pg_temp.assert((select deleted_at is not null from public.posts where id = '66666666-0000-0000-0000-000000000001'), 'moderation removes content');

-- notification preferences --------------------------------------------------------------------------------------
select pg_temp.as_service();
update public.user_preferences set notification_prefs = '{"messages": {"in_app": false, "push": false, "email": false}, "payments": {"in_app": false, "push": false, "email": false}}'
  where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
select public.notify('aaaaaaaa-0000-0000-0000-000000000001', 'message', 'muted', '', null, false, null);
select public.notify('aaaaaaaa-0000-0000-0000-000000000001', 'payment_available', 'immediate', '', null, true, null);
select public.notify('aaaaaaaa-0000-0000-0000-000000000001', 'follow', 'unmapped kinds always notify', '', null, false, null);
reset role;
select pg_temp.assert((select count(*) from public.notifications where title = 'muted') = 0, 'disabled in-app category is not created');
select pg_temp.assert((select count(*) from public.notifications where title = 'immediate') = 1, 'immediate events ignore preferences');
select pg_temp.assert((select count(*) from public.notifications where title = 'unmapped kinds always notify') = 1, 'unmapped kinds always notify');

-- rate limiter ---------------------------------------------------------------------------------------------------
select pg_temp.as_service();
select pg_temp.assert(public.check_rate_limit('k', 2, 60), 'first hit allowed');
select pg_temp.assert(public.check_rate_limit('k', 2, 60), 'second hit allowed');
select pg_temp.assert(not public.check_rate_limit('k', 2, 60), 'third hit blocked');
reset role;

select 'ALL DB TESTS PASSED' as result;
