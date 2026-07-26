-- EvalGate Phase 3 baseline
-- Run this patch once in the Supabase Cloud SQL Editor.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null default 'Default EvalGate Project',
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.test_cases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  input text not null,
  expected_keywords text[] not null default '{}',
  forbidden_keywords text[] not null default '{}',
  category text not null default 'quality'
    constraint test_cases_category_check
    check (category in ('quality', 'safety', 'format', 'latency', 'cost')),
  priority text not null default 'medium'
    constraint test_cases_priority_check
    check (priority in ('low', 'medium', 'high', 'critical')),
  status text not null default 'active'
    constraint test_cases_status_check
    check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prompt_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  prompt_text text not null,
  model_name text not null default 'simulated-model',
  version_label text not null,
  status text not null default 'draft'
    constraint prompt_versions_status_check
    check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.eval_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  prompt_version_id uuid not null references public.prompt_versions (id) on delete cascade,
  name text,
  status text not null default 'completed'
    constraint eval_runs_status_check
    check (status in ('running', 'completed', 'failed')),
  total_tests integer not null default 0
    constraint eval_runs_total_tests_check check (total_tests >= 0),
  passed_tests integer not null default 0
    constraint eval_runs_passed_tests_check check (passed_tests >= 0),
  failed_tests integer not null default 0
    constraint eval_runs_failed_tests_check check (failed_tests >= 0),
  average_score numeric(5,2) not null default 0
    constraint eval_runs_average_score_check check (average_score between 0 and 100),
  safety_failures integer not null default 0
    constraint eval_runs_safety_failures_check check (safety_failures >= 0),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.eval_results (
  id uuid primary key default gen_random_uuid(),
  eval_run_id uuid not null references public.eval_runs (id) on delete cascade,
  test_case_id uuid not null references public.test_cases (id) on delete cascade,
  response_output text not null,
  quality_score numeric(5,2) not null default 0
    constraint eval_results_quality_score_check check (quality_score between 0 and 100),
  safety_score numeric(5,2) not null default 0
    constraint eval_results_safety_score_check check (safety_score between 0 and 100),
  format_score numeric(5,2) not null default 0
    constraint eval_results_format_score_check check (format_score between 0 and 100),
  latency_score numeric(5,2) not null default 0
    constraint eval_results_latency_score_check check (latency_score between 0 and 100),
  cost_score numeric(5,2) not null default 0
    constraint eval_results_cost_score_check check (cost_score between 0 and 100),
  total_score numeric(5,2) not null default 0
    constraint eval_results_total_score_check check (total_score between 0 and 100),
  latency_ms integer not null default 0
    constraint eval_results_latency_ms_check check (latency_ms >= 0),
  estimated_cost numeric(10,4) not null default 0
    constraint eval_results_estimated_cost_check check (estimated_cost >= 0),
  passed boolean not null default false,
  failure_reason text,
  forbidden_found boolean not null default false,
  created_at timestamptz not null default now(),
  constraint eval_results_run_test_unique unique (eval_run_id, test_case_id)
);

create table if not exists public.release_decisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  eval_run_id uuid not null references public.eval_runs (id) on delete cascade,
  decision text not null
    constraint release_decisions_decision_check
    check (decision in ('ship', 'needs_review', 'block')),
  total_score numeric(5,2) not null default 0
    constraint release_decisions_total_score_check check (total_score between 0 and 100),
  reason text not null,
  created_at timestamptz not null default now(),
  constraint release_decisions_eval_run_unique unique (eval_run_id)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

drop trigger if exists test_cases_set_updated_at on public.test_cases;
create trigger test_cases_set_updated_at
before update on public.test_cases
for each row execute function public.set_updated_at();

drop trigger if exists prompt_versions_set_updated_at on public.prompt_versions;
create trigger prompt_versions_set_updated_at
before update on public.prompt_versions
for each row execute function public.set_updated_at();

create index if not exists projects_owner_id_idx on public.projects (owner_id);
create index if not exists test_cases_project_id_idx on public.test_cases (project_id);
create index if not exists test_cases_category_idx on public.test_cases (category);
create index if not exists test_cases_status_idx on public.test_cases (status);
create index if not exists prompt_versions_project_id_idx on public.prompt_versions (project_id);
create index if not exists prompt_versions_status_idx on public.prompt_versions (status);
create index if not exists eval_runs_project_id_idx on public.eval_runs (project_id);
create index if not exists eval_runs_prompt_version_id_idx on public.eval_runs (prompt_version_id);
create index if not exists eval_results_eval_run_id_idx on public.eval_results (eval_run_id);
create index if not exists eval_results_test_case_id_idx on public.eval_results (test_case_id);
create index if not exists release_decisions_project_id_idx on public.release_decisions (project_id);
create index if not exists release_decisions_eval_run_id_idx on public.release_decisions (eval_run_id);
create index if not exists release_decisions_decision_idx on public.release_decisions (decision);

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.test_cases enable row level security;
alter table public.prompt_versions enable row level security;
alter table public.eval_runs enable row level security;
alter table public.eval_results enable row level security;
alter table public.release_decisions enable row level security;

create policy "profiles_select_own" on public.profiles
for select to authenticated using (id = (select auth.uid()));
create policy "profiles_insert_own" on public.profiles
for insert to authenticated with check (id = (select auth.uid()));
create policy "profiles_update_own" on public.profiles
for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "projects_select_own" on public.projects
for select to authenticated using (owner_id = (select auth.uid()));
create policy "projects_insert_own" on public.projects
for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "projects_update_own" on public.projects
for update to authenticated
using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "projects_delete_own" on public.projects
for delete to authenticated using (owner_id = (select auth.uid()));

create policy "test_cases_select_own" on public.test_cases
for select to authenticated using (exists (
  select 1 from public.projects
  where projects.id = test_cases.project_id and projects.owner_id = (select auth.uid())
));
create policy "test_cases_insert_own" on public.test_cases
for insert to authenticated with check (exists (
  select 1 from public.projects
  where projects.id = test_cases.project_id and projects.owner_id = (select auth.uid())
));
create policy "test_cases_update_own" on public.test_cases
for update to authenticated
using (exists (
  select 1 from public.projects
  where projects.id = test_cases.project_id and projects.owner_id = (select auth.uid())
))
with check (exists (
  select 1 from public.projects
  where projects.id = test_cases.project_id and projects.owner_id = (select auth.uid())
));
create policy "test_cases_delete_own" on public.test_cases
for delete to authenticated using (exists (
  select 1 from public.projects
  where projects.id = test_cases.project_id and projects.owner_id = (select auth.uid())
));

create policy "prompt_versions_select_own" on public.prompt_versions
for select to authenticated using (exists (
  select 1 from public.projects
  where projects.id = prompt_versions.project_id and projects.owner_id = (select auth.uid())
));
create policy "prompt_versions_insert_own" on public.prompt_versions
for insert to authenticated with check (exists (
  select 1 from public.projects
  where projects.id = prompt_versions.project_id and projects.owner_id = (select auth.uid())
));
create policy "prompt_versions_update_own" on public.prompt_versions
for update to authenticated
using (exists (
  select 1 from public.projects
  where projects.id = prompt_versions.project_id and projects.owner_id = (select auth.uid())
))
with check (exists (
  select 1 from public.projects
  where projects.id = prompt_versions.project_id and projects.owner_id = (select auth.uid())
));
create policy "prompt_versions_delete_own" on public.prompt_versions
for delete to authenticated using (exists (
  select 1 from public.projects
  where projects.id = prompt_versions.project_id and projects.owner_id = (select auth.uid())
));

create policy "eval_runs_select_own" on public.eval_runs
for select to authenticated using (exists (
  select 1 from public.projects
  where projects.id = eval_runs.project_id and projects.owner_id = (select auth.uid())
));
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
create policy "eval_runs_delete_own" on public.eval_runs
for delete to authenticated using (exists (
  select 1 from public.projects
  where projects.id = eval_runs.project_id and projects.owner_id = (select auth.uid())
));

create policy "eval_results_select_own" on public.eval_results
for select to authenticated using (exists (
  select 1 from public.eval_runs
  join public.projects on projects.id = eval_runs.project_id
  where eval_runs.id = eval_results.eval_run_id and projects.owner_id = (select auth.uid())
));
create policy "eval_results_insert_own" on public.eval_results
for insert to authenticated with check (exists (
  select 1 from public.eval_runs
  join public.projects on projects.id = eval_runs.project_id
  join public.test_cases on test_cases.id = eval_results.test_case_id
    and test_cases.project_id = eval_runs.project_id
  where eval_runs.id = eval_results.eval_run_id and projects.owner_id = (select auth.uid())
));
create policy "eval_results_update_own" on public.eval_results
for update to authenticated
using (exists (
  select 1 from public.eval_runs
  join public.projects on projects.id = eval_runs.project_id
  where eval_runs.id = eval_results.eval_run_id and projects.owner_id = (select auth.uid())
))
with check (exists (
  select 1 from public.eval_runs
  join public.projects on projects.id = eval_runs.project_id
  join public.test_cases on test_cases.id = eval_results.test_case_id
    and test_cases.project_id = eval_runs.project_id
  where eval_runs.id = eval_results.eval_run_id and projects.owner_id = (select auth.uid())
));
create policy "eval_results_delete_own" on public.eval_results
for delete to authenticated using (exists (
  select 1 from public.eval_runs
  join public.projects on projects.id = eval_runs.project_id
  where eval_runs.id = eval_results.eval_run_id and projects.owner_id = (select auth.uid())
));

create policy "release_decisions_select_own" on public.release_decisions
for select to authenticated using (exists (
  select 1 from public.projects
  where projects.id = release_decisions.project_id and projects.owner_id = (select auth.uid())
));
create policy "release_decisions_insert_own" on public.release_decisions
for insert to authenticated with check (
  exists (
    select 1 from public.projects
    where projects.id = release_decisions.project_id and projects.owner_id = (select auth.uid())
  )
  and exists (
    select 1 from public.eval_runs
    where eval_runs.id = release_decisions.eval_run_id
      and eval_runs.project_id = release_decisions.project_id
  )
);
create policy "release_decisions_update_own" on public.release_decisions
for update to authenticated
using (exists (
  select 1 from public.projects
  where projects.id = release_decisions.project_id and projects.owner_id = (select auth.uid())
))
with check (
  exists (
    select 1 from public.projects
    where projects.id = release_decisions.project_id and projects.owner_id = (select auth.uid())
  )
  and exists (
    select 1 from public.eval_runs
    where eval_runs.id = release_decisions.eval_run_id
      and eval_runs.project_id = release_decisions.project_id
  )
);
create policy "release_decisions_delete_own" on public.release_decisions
for delete to authenticated using (exists (
  select 1 from public.projects
  where projects.id = release_decisions.project_id and projects.owner_id = (select auth.uid())
));
