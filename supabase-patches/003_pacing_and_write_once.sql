-- 003: atomic per-target pacing, write-once evidence, 50-case cap in the
-- database, operator-only workspace. Requires 001 and 002. Safe to re-run.
-- Roll back with 003_pacing_and_write_once_rollback.sql (before rolling back 002).

-- ---------------------------------------------------------------------------
-- 1. Pacing: one row per target holding the earliest time the next question
--    may be sent. Claimed atomically before every send (runs and test
--    connections), so parallel calls cannot send inside the window.
-- ---------------------------------------------------------------------------
create table if not exists public.target_pacing (
  target_id uuid primary key references public.targets (id) on delete cascade,
  next_send_at timestamptz not null
);

alter table public.target_pacing enable row level security;

drop policy if exists "target_pacing_select_operator" on public.target_pacing;
create policy "target_pacing_select_operator" on public.target_pacing
for select to authenticated using (
  (select public.is_operator())
  and exists (select 1 from public.targets where targets.id = target_pacing.target_id)
);
drop policy if exists "target_pacing_insert_operator" on public.target_pacing;
create policy "target_pacing_insert_operator" on public.target_pacing
for insert to authenticated with check (
  (select public.is_operator())
  and exists (select 1 from public.targets where targets.id = target_pacing.target_id)
);
drop policy if exists "target_pacing_update_operator" on public.target_pacing;
create policy "target_pacing_update_operator" on public.target_pacing
for update to authenticated
using ((select public.is_operator()) and exists (select 1 from public.targets where targets.id = target_pacing.target_id))
with check ((select public.is_operator()) and exists (select 1 from public.targets where targets.id = target_pacing.target_id));

-- Returns 0 when the caller now owns the next send slot for this target,
-- a positive number of ms to wait otherwise, or -1 if the target is not
-- visible to the caller. Runs as the caller, so RLS applies.
create or replace function public.claim_target_send_slot(p_target_id uuid)
returns integer
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_claimed timestamptz;
  v_next timestamptz;
begin
  insert into public.target_pacing as tp (target_id, next_send_at)
  select t.id, now() + make_interval(secs => t.min_delay_ms / 1000.0)
  from public.targets t
  where t.id = p_target_id
  on conflict (target_id) do update
    set next_send_at = excluded.next_send_at
    where tp.next_send_at <= now()
  returning tp.next_send_at into v_claimed;

  if v_claimed is not null then
    return 0;
  end if;

  select next_send_at into v_next from public.target_pacing where target_id = p_target_id;
  if v_next is null then
    return -1;
  end if;
  return greatest(1, ceil(extract(epoch from (v_next - now())) * 1000))::integer;
end;
$$;

revoke execute on function public.claim_target_send_slot(uuid) from public, anon;
grant execute on function public.claim_target_send_slot(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Evidence is write-once. A result row may be inserted as 'pending' (the
--    send slot for that case is taken) and updated exactly once to its final
--    state; after that it can never change. Results cannot be deleted
--    directly (deleting the whole run still cascades). Decisions never change.
-- ---------------------------------------------------------------------------
alter table public.eval_results drop constraint if exists eval_results_result_status_check;
alter table public.eval_results add constraint eval_results_result_status_check
  check (result_status in ('pending', 'completed', 'error'));

create or replace function public.eval_results_write_once()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.result_status <> 'pending' then
    raise exception 'evidence records are write-once (result % is already %)', old.id, old.result_status
      using errcode = 'P0001';
  end if;
  if new.result_status = 'pending' then
    raise exception 'a pending evidence record can only be finalised' using errcode = 'P0001';
  end if;
  if new.eval_run_id <> old.eval_run_id
    or new.test_case_id <> old.test_case_id
    or new.execution_source <> old.execution_source
    or new.target_id is distinct from old.target_id
    or new.started_at is distinct from old.started_at then
    raise exception 'evidence identity fields cannot change' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists eval_results_write_once on public.eval_results;
create trigger eval_results_write_once
before update on public.eval_results
for each row execute function public.eval_results_write_once();

drop policy if exists "eval_results_delete_own" on public.eval_results;

create or replace function public.release_decisions_write_once()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'release decisions are write-once' using errcode = 'P0001';
end;
$$;

drop trigger if exists release_decisions_write_once on public.release_decisions;
create trigger release_decisions_write_once
before update on public.release_decisions
for each row execute function public.release_decisions_write_once();

-- A run's identity is fixed at creation, and a finished run cannot restart.
create or replace function public.eval_runs_identity_fixed()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.project_id <> old.project_id
    or new.execution_mode <> old.execution_mode
    or new.target_id is distinct from old.target_id
    or new.prompt_version_id is distinct from old.prompt_version_id
    or new.planned_test_case_ids <> old.planned_test_case_ids then
    raise exception 'a run''s mode, target, prompt and plan cannot change' using errcode = 'P0001';
  end if;
  if old.status <> 'running' and new.status <> old.status then
    raise exception 'a finished run cannot change status' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists eval_runs_identity_fixed on public.eval_runs;
create trigger eval_runs_identity_fixed
before update on public.eval_runs
for each row execute function public.eval_runs_identity_fixed();

-- ---------------------------------------------------------------------------
-- 3. 50-case cap in the database.
-- ---------------------------------------------------------------------------
alter table public.eval_runs drop constraint if exists eval_runs_planned_cap_check;
alter table public.eval_runs add constraint eval_runs_planned_cap_check
  check (cardinality(planned_test_case_ids) <= 50);

-- ---------------------------------------------------------------------------
-- 4. Operator-only workspace: a RESTRICTIVE policy is ANDed with every
--    existing policy, so non-operators can neither read nor write.
--    profiles stays as is (own row only).
-- ---------------------------------------------------------------------------
drop policy if exists "projects_operator_only" on public.projects;
create policy "projects_operator_only" on public.projects as restrictive
for all to authenticated using ((select public.is_operator())) with check ((select public.is_operator()));

drop policy if exists "test_cases_operator_only" on public.test_cases;
create policy "test_cases_operator_only" on public.test_cases as restrictive
for all to authenticated using ((select public.is_operator())) with check ((select public.is_operator()));

drop policy if exists "prompt_versions_operator_only" on public.prompt_versions;
create policy "prompt_versions_operator_only" on public.prompt_versions as restrictive
for all to authenticated using ((select public.is_operator())) with check ((select public.is_operator()));

drop policy if exists "eval_runs_operator_only" on public.eval_runs;
create policy "eval_runs_operator_only" on public.eval_runs as restrictive
for all to authenticated using ((select public.is_operator())) with check ((select public.is_operator()));

drop policy if exists "eval_results_operator_only" on public.eval_results;
create policy "eval_results_operator_only" on public.eval_results as restrictive
for all to authenticated using ((select public.is_operator())) with check ((select public.is_operator()));

drop policy if exists "release_decisions_operator_only" on public.release_decisions;
create policy "release_decisions_operator_only" on public.release_decisions as restrictive
for all to authenticated using ((select public.is_operator())) with check ((select public.is_operator()));
