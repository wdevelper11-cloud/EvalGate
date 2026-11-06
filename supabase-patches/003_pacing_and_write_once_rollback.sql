-- ROLLBACK for 003_pacing_and_write_once.sql. Returns the schema to 002.
-- Run BEFORE 002's rollback. Any 'pending' result rows are deleted.

begin;

drop policy if exists "projects_operator_only" on public.projects;
drop policy if exists "test_cases_operator_only" on public.test_cases;
drop policy if exists "prompt_versions_operator_only" on public.prompt_versions;
drop policy if exists "eval_runs_operator_only" on public.eval_runs;
drop policy if exists "eval_results_operator_only" on public.eval_results;
drop policy if exists "release_decisions_operator_only" on public.release_decisions;

alter table public.eval_runs drop constraint if exists eval_runs_planned_cap_check;

drop trigger if exists eval_runs_identity_fixed on public.eval_runs;
drop function if exists public.eval_runs_identity_fixed();
drop trigger if exists release_decisions_write_once on public.release_decisions;
drop function if exists public.release_decisions_write_once();
drop trigger if exists eval_results_write_once on public.eval_results;
drop function if exists public.eval_results_write_once();

drop policy if exists "eval_results_delete_own" on public.eval_results;
create policy "eval_results_delete_own" on public.eval_results
for delete to authenticated using (exists (
  select 1 from public.eval_runs
  join public.projects on projects.id = eval_runs.project_id
  where eval_runs.id = eval_results.eval_run_id and projects.owner_id = (select auth.uid())
));

delete from public.eval_results where result_status = 'pending';
alter table public.eval_results drop constraint if exists eval_results_result_status_check;
alter table public.eval_results add constraint eval_results_result_status_check
  check (result_status in ('completed', 'error'));

drop function if exists public.claim_target_send_slot(uuid);
drop table if exists public.target_pacing;

commit;
