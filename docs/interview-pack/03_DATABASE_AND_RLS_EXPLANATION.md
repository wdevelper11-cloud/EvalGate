# EvalGate Database and RLS Explanation

## 1. Database purpose

Postgres stores identity-linked workspace metadata, reusable definitions, execution evidence, and release recommendations. Constraints and RLS protect consistency and isolation even if the UI is bypassed.

## 2. Main tables

`profiles`, `projects`, `test_cases`, `prompt_versions`, `eval_runs`, `eval_results`, and `release_decisions`.

## 3. Table-by-table explanation

### `profiles`

Keyed to `auth.users(id)`; stores email, optional name, and timestamps. Users can access only the row matching `auth.uid()`.

### `projects`

Stores the ownership root through `owner_id`, plus name/description/timestamps. The UI resolves a default project, but the schema does not enforce exactly one per owner.

### `test_cases`

Stores project, scenario input, expected/forbidden keyword arrays, category, priority, status, and timestamps. Checks restrict category to quality/safety/format/latency/cost, priority to low/medium/high/critical, and status to active/archived.

### `prompt_versions`

Stores project, prompt text, name, model/version labels, lifecycle status, and timestamps. Model label is descriptive metadata only. Status is draft/active/archived.

### `eval_runs`

References project and prompt, and stores running/completed/failed status, counts, average, safety failures, and completion time. Numeric checks prevent invalid values.

### `eval_results`

References one run and test; stores response, five scores, total, latency, estimated cost, pass/fail, reason, and forbidden flag. Score/range checks and unique `(eval_run_id, test_case_id)` protect evidence structure.

### `release_decisions`

References project and run; stores ship/needs_review/block, score, reason, and timestamp. A unique run ID allows one decision per run.

## 4. Relationships

```text
auth.users 1—1 profiles 1—* projects
projects 1—* test_cases, prompt_versions, eval_runs, release_decisions
prompt_versions 1—* eval_runs
eval_runs 1—* eval_results
test_cases 1—* eval_results
eval_runs 1—0..1 release_decisions
```

Same-project relationships are checked in RLS policies. The implemented SQL does not contain composite foreign keys, so do not claim that it does.

## 5. Why project scoping exists

Project scope gives every domain record one ownership boundary, makes RLS consistent, and leaves a future path to collaboration. The current UI remains single-default-workspace and has no membership roles.

## 6. Supabase Auth relationship

Supabase Auth owns `auth.users`; profile IDs reuse those UUIDs. `auth.getUser()` verifies identity server-side and policies read JWT-derived `auth.uid()`. The application resolver creates missing profiles/projects using the user's own session; the SQL patch has no Auth-user creation trigger.

## 7. RLS policy model

RLS is enabled on all seven tables:

- Profiles compare ID directly with `auth.uid()`.
- Projects compare `owner_id` with `auth.uid()`.
- Tests/prompts require an owned matching project.
- Run insert/update also requires its prompt to share the project.
- Result insert/update requires an owned run and a test in the run project.
- Decision insert/update requires an owned project and matching run.

`USING` controls visible/targetable existing rows. `WITH CHECK` validates inserted or updated row state.

## 8. Cross-user isolation

If Alice submits Bob's prompt ID, the Server Action's project-filtered lookup finds nothing. A direct Supabase call still carries Alice's JWT, so RLS hides Bob's project. Relationship checks prevent linking foreign records into Alice's run. Middleware is useful UX; RLS is the actual data boundary.

## 9. Why no service-role key

Service role bypasses RLS. Normal user requests need only the anon key and authenticated session. Avoiding service role limits blast radius and ensures server code remains subject to the same policies.

## 10. Avoiding trust in the browser

Actions derive `project_id`, requery chosen records by project and status, include project filters on mutations, validate allowed values, and rely on database checks plus RLS. Browser-supplied IDs are selectors, never proof of ownership.

## 11. Common RLS questions

**Is middleware enough?** No; direct database API calls bypass page navigation.

**Does anon key make data public?** No. It is public client configuration; grants, session identity, and RLS decide access.

**What happens without a session?** `auth.uid()` is null and authenticated policies grant nothing.

**Can a user move data to another project?** `WITH CHECK` rejects the resulting unauthorized row.

**Is isolation formally audited?** No. The model is sound for an MVP, but production needs automated two-user adversarial tests and review.

## 12. Limitations and production improvements

- Add automated RLS tests for every operation and cross-reference.
- Automate migrations and disposable test environments.
- Add composite foreign keys for structural same-project integrity.
- Snapshot exact definitions for historical accuracy.
- Restrict update/delete on completed evidence if immutability is required; current owner policies permit them.
- Add membership roles, append-only audit, retention/backups, and recovery.
- Complete runs transactionally/idempotently and tune indexes from measured workloads.
