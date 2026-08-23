-- EvalGate additive external-execution evidence patch.
-- Apply only after taking a schema backup and validating in a non-production project.

alter table public.eval_runs
  add column if not exists execution_mode text not null default 'deterministic'
    constraint eval_runs_execution_mode_check
    check (execution_mode in ('deterministic', 'http_endpoint', 'recorded_trace'));

alter table public.eval_results
  add column if not exists execution_source text not null default 'deterministic'
    constraint eval_results_execution_source_check
    check (execution_source in ('deterministic', 'http_endpoint', 'recorded_trace')),
  add column if not exists provider_name text,
  add column if not exists provider_request_id text,
  add column if not exists input_payload jsonb,
  add column if not exists trace_payload jsonb,
  add column if not exists input_tokens integer
    constraint eval_results_input_tokens_check check (input_tokens is null or input_tokens >= 0),
  add column if not exists output_tokens integer
    constraint eval_results_output_tokens_check check (output_tokens is null or output_tokens >= 0);

create index if not exists eval_runs_execution_mode_idx on public.eval_runs (execution_mode);
create index if not exists eval_results_execution_source_idx on public.eval_results (execution_source);
create index if not exists eval_results_provider_request_id_idx on public.eval_results (provider_request_id)
  where provider_request_id is not null;

comment on column public.eval_results.trace_payload is
  'Buyer-approved execution trace after agreed redaction; never store secrets or unnecessary personal data.';

