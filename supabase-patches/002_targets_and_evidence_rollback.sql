-- ROLLBACK for 002_targets_and_evidence.sql. Returns the schema to 001.
-- DESTRUCTIVE: deletes every HTTP-endpoint run (and, by cascade, its results and
-- release decisions), all evidence columns, all targets and the operators list.
-- Take a backup first. Run in one transaction.

begin;

-- 1. Runs that only exist because of 002 (no prompt version) must go before
--    prompt_version_id can be NOT NULL again.
alter table public.eval_runs drop constraint if exists eval_runs_mode_shape_check;
delete from public.eval_runs where prompt_version_id is null;

-- 2. Evidence columns on results (their indexes drop with them).
alter table public.eval_results
  drop column if exists execution_source,
  drop column if exists result_status,
  drop column if exists target_id,
  drop column if exists adapter,
  drop column if exists request_url,
  drop column if exists request_body,
  drop column if exists response_status,
  drop column if exists response_raw,
  drop column if exists error_code,
  drop column if exists error_message,
  drop column if exists started_at,
  drop column if exists completed_at;

-- 3. Restore the 001 eval_runs insert/update policies FIRST: the 002 versions
--    reference eval_runs.target_id, so that column cannot be dropped before this.
drop policy if exists "eval_runs_insert_own" on public.eval_runs;
create policy "eval_runs_insert_own" on public.eval_runs
for insert to authenticated with check (
  exists (
    select 1 from public.projects
    where projects.id = eval_runs.project_id and projects.owner_id = (select auth.uid())
  )
  and exists (
    select 1 from public.prompt_versions
    where prompt_versions.id = eval_runs.prompt_version_id
      and prompt_versions.project_id = eval_runs.project_id
  )
);
drop policy if exists "eval_runs_update_own" on public.eval_runs;
create policy "eval_runs_update_own" on public.eval_runs
for update to authenticated
using (exists (
  select 1 from public.projects
  where projects.id = eval_runs.project_id and projects.owner_id = (select auth.uid())
))
with check (
  exists (
    select 1 from public.projects
    where projects.id = eval_runs.project_id and projects.owner_id = (select auth.uid())
  )
  and exists (
    select 1 from public.prompt_versions
    where prompt_versions.id = eval_runs.prompt_version_id
      and prompt_versions.project_id = eval_runs.project_id
  )
);

-- 4. Run columns and the original NOT NULL.
alter table public.eval_runs
  drop column if exists execution_mode,
  drop column if exists target_id,
  drop column if exists planned_test_case_ids,
  drop column if exists errored_tests;
alter table public.eval_runs alter column prompt_version_id set not null;

-- 5. Targets (policies, trigger and index drop with the table), then operators.
drop table if exists public.targets;
drop function if exists public.is_operator();
drop table if exists public.operators;

commit;
