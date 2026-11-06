-- 002: operators allowlist, HTTP targets, and per-case evidence records.
-- Apply to the TEST Supabase project first. Requires 001_initial_schema.sql.
-- Additive except for: eval_runs.prompt_version_id becomes nullable, and the
-- eval_runs insert/update policies are recreated to allow target runs.

-- ---------------------------------------------------------------------------
-- Operators: accounts allowed to manage targets and use the workspace.
-- There are deliberately NO insert/update/delete policies: rows are added only
-- from the SQL editor (service role), e.g.
--   insert into public.operators (user_id)
--   select id from auth.users where email = '<operator email>';
-- ---------------------------------------------------------------------------
create table if not exists public.operators (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.operators enable row level security;

drop policy if exists "operators_select_own" on public.operators;
create policy "operators_select_own" on public.operators
for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.is_operator()
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.operators where user_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_operator() from public, anon;
grant execute on function public.is_operator() to authenticated;

-- ---------------------------------------------------------------------------
-- Targets: an AI agent endpoint we are allowed to test.
-- The API key is NEVER stored. key_env_var names a server environment variable
-- that holds it, and must start with TARGET_KEY_ so a target can never be
-- pointed at another server secret.
-- ---------------------------------------------------------------------------
create table if not exists public.targets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null
    constraint targets_name_check check (char_length(name) between 1 and 120),
  adapter text not null default 'http_endpoint'
    constraint targets_adapter_check check (adapter in ('http_endpoint')),
  endpoint_url text not null
    constraint targets_endpoint_url_check check (endpoint_url ~ '^https://' and char_length(endpoint_url) <= 2048),
  request_format text not null
    constraint targets_request_format_check check (request_format in ('openai_chat', 'custom_json')),
  model text
    constraint targets_model_check check (model is null or char_length(model) <= 200),
  request_template jsonb,
  response_path text
    constraint targets_response_path_check check (response_path is null or char_length(response_path) <= 300),
  auth_header_name text not null default 'Authorization'
    constraint targets_auth_header_name_check check (auth_header_name ~ '^[A-Za-z0-9-]{1,64}$'),
  auth_scheme text
    constraint targets_auth_scheme_check check (auth_scheme is null or auth_scheme ~ '^[A-Za-z0-9-]{1,32}$'),
  key_env_var text
    constraint targets_key_env_var_check check (key_env_var is null or key_env_var ~ '^TARGET_KEY_[A-Z0-9_]{1,64}$'),
  min_delay_ms integer not null default 5000
    constraint targets_min_delay_ms_check check (min_delay_ms between 2000 and 60000),
  timeout_ms integer not null default 15000
    constraint targets_timeout_ms_check check (timeout_ms between 1000 and 15000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint targets_custom_json_shape_check check (
    request_format <> 'custom_json' or (request_template is not null and response_path is not null)
  )
);

drop trigger if exists targets_set_updated_at on public.targets;
create trigger targets_set_updated_at
before update on public.targets
for each row execute function public.set_updated_at();

create index if not exists targets_project_id_idx on public.targets (project_id);

alter table public.targets enable row level security;

drop policy if exists "targets_select_operator" on public.targets;
create policy "targets_select_operator" on public.targets
for select to authenticated using (
  (select public.is_operator())
  and exists (select 1 from public.projects where projects.id = targets.project_id and projects.owner_id = (select auth.uid()))
);
drop policy if exists "targets_insert_operator" on public.targets;
create policy "targets_insert_operator" on public.targets
for insert to authenticated with check (
  (select public.is_operator())
  and exists (select 1 from public.projects where projects.id = targets.project_id and projects.owner_id = (select auth.uid()))
);
drop policy if exists "targets_update_operator" on public.targets;
create policy "targets_update_operator" on public.targets
for update to authenticated
using (
  (select public.is_operator())
  and exists (select 1 from public.projects where projects.id = targets.project_id and projects.owner_id = (select auth.uid()))
)
with check (
  (select public.is_operator())
  and exists (select 1 from public.projects where projects.id = targets.project_id and projects.owner_id = (select auth.uid()))
);
drop policy if exists "targets_delete_operator" on public.targets;
create policy "targets_delete_operator" on public.targets
for delete to authenticated using (
  (select public.is_operator())
  and exists (select 1 from public.projects where projects.id = targets.project_id and projects.owner_id = (select auth.uid()))
);

-- ---------------------------------------------------------------------------
-- Runs: a run is either the simulated dev fixture or a real HTTP endpoint run.
-- Targets used by a run cannot be deleted (evidence must stay traceable).
-- ---------------------------------------------------------------------------
alter table public.eval_runs alter column prompt_version_id drop not null;

alter table public.eval_runs
  add column if not exists execution_mode text not null default 'simulated'
    constraint eval_runs_execution_mode_check check (execution_mode in ('simulated', 'http_endpoint')),
  add column if not exists target_id uuid references public.targets (id) on delete restrict,
  add column if not exists planned_test_case_ids uuid[] not null default '{}',
  add column if not exists errored_tests integer not null default 0
    constraint eval_runs_errored_tests_check check (errored_tests >= 0);

alter table public.eval_runs drop constraint if exists eval_runs_mode_shape_check;
alter table public.eval_runs add constraint eval_runs_mode_shape_check check (
  (execution_mode = 'simulated' and prompt_version_id is not null)
  or (execution_mode = 'http_endpoint' and target_id is not null)
);

create index if not exists eval_runs_target_id_idx on public.eval_runs (target_id);

drop policy if exists "eval_runs_insert_own" on public.eval_runs;
create policy "eval_runs_insert_own" on public.eval_runs
for insert to authenticated with check (
  exists (
    select 1 from public.projects
    where projects.id = eval_runs.project_id and projects.owner_id = (select auth.uid())
  )
  and (
    eval_runs.prompt_version_id is null or exists (
      select 1 from public.prompt_versions
      where prompt_versions.id = eval_runs.prompt_version_id
        and prompt_versions.project_id = eval_runs.project_id
    )
  )
  and (
    eval_runs.target_id is null or exists (
      select 1 from public.targets
      where targets.id = eval_runs.target_id
        and targets.project_id = eval_runs.project_id
    )
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
  and (
    eval_runs.prompt_version_id is null or exists (
      select 1 from public.prompt_versions
      where prompt_versions.id = eval_runs.prompt_version_id
        and prompt_versions.project_id = eval_runs.project_id
    )
  )
  and (
    eval_runs.target_id is null or exists (
      select 1 from public.targets
      where targets.id = eval_runs.target_id
        and targets.project_id = eval_runs.project_id
    )
  )
);

-- ---------------------------------------------------------------------------
-- Evidence record on every result row. Existing rows are labelled simulated.
-- ---------------------------------------------------------------------------
alter table public.eval_results
  add column if not exists execution_source text not null default 'simulated'
    constraint eval_results_execution_source_check check (execution_source in ('simulated', 'http_endpoint')),
  add column if not exists result_status text not null default 'completed'
    constraint eval_results_result_status_check check (result_status in ('completed', 'error')),
  add column if not exists target_id uuid references public.targets (id) on delete restrict,
  add column if not exists adapter text,
  add column if not exists request_url text,
  add column if not exists request_body jsonb,
  add column if not exists response_status integer,
  add column if not exists response_raw text
    constraint eval_results_response_raw_check check (response_raw is null or octet_length(response_raw) <= 70000),
  add column if not exists error_code text,
  add column if not exists error_message text,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz;

create index if not exists eval_results_target_id_idx on public.eval_results (target_id);
create index if not exists eval_results_result_status_idx on public.eval_results (result_status);
