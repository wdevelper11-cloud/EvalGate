# EvalGate Implementation Tasks

## How to use this plan

Complete phases in order. Do not begin the next phase until:

1. Its acceptance criteria pass.
2. `npm run lint` passes.
3. `npm run build` passes.
4. The manual checklist is complete.
5. The phase is committed.

For any database change:

- Create a new ordered file under `supabase/patches/`.
- Apply it manually through the Supabase Cloud SQL Editor.
- Record the filename and verification result.
- Never require local Supabase or the Supabase CLI.

## Phase status

| Phase | Deliverable | Status |
| ---: | --- | --- |
| 0 | Repository setup | Pending |
| 1 | Command center docs | In progress |
| 2 | Application skeleton | Pending |
| 3 | Supabase schema and RLS | Pending |
| 4 | Authentication and protected routes | Pending |
| 5 | Default workspace resolution | Pending |
| 6 | Test case CRUD | Pending |
| 7 | Prompt version CRUD | Pending |
| 8 | Evaluation runner | Pending |
| 9 | Scoring and release decision | Pending |
| 10 | Live dashboard metrics | Pending |
| 11 | Reports page | Pending |
| 12 | Audit timeline | Pending |
| 13 | Demo data and final polish | Pending |

---

## Phase 0: Repository setup

### Goal

Create a clean Next.js TypeScript repository that can be developed and deployed without adding business features.

### Files likely touched

- `package.json`
- `package-lock.json`
- `next.config.ts`
- `tsconfig.json`
- `eslint.config.mjs`
- `postcss.config.mjs`
- `app/layout.tsx`
- `app/page.tsx`
- `app/globals.css`
- `.gitignore`
- `.env.example`

### Tasks

- Create a Next.js App Router project with TypeScript, Tailwind CSS, and ESLint.
- Use npm consistently for the documented workflow.
- Install `@supabase/supabase-js` and `@supabase/ssr`.
- Add scripts for `dev`, `build`, `start`, and `lint`.
- Add a safe `.env.example`; never commit `.env.local`.
- Confirm no prohibited backend or infrastructure dependency is present.

### Acceptance criteria

- `npm install` completes.
- `npm run dev` opens the starter application.
- `npm run lint` passes.
- `npm run build` passes.
- The repository contains no application secrets.
- No local Supabase, Docker, Prisma, Express, or FastAPI setup exists.

### Manual test checklist

- [ ] Clone or open the repository in a clean environment.
- [ ] Copy `.env.example` to `.env.local` without committing it.
- [ ] Start the app and open `/`.
- [ ] Confirm there are no browser-console errors.
- [ ] Confirm mobile and desktop pages render without overflow.

### Commit message

```text
chore: initialize EvalGate Next.js project
```

---

## Phase 1: Command center docs

### Goal

Create the source-of-truth product, architecture, schema, implementation, resume, and setup documents before code generation.

### Files likely touched

- `docs/01_PRD.md`
- `docs/02_ARCHITECTURE.md`
- `docs/03_DATABASE_SCHEMA.md`
- `docs/04_TASKS.md`
- `docs/05_RESUME_NOTES.md`
- `README.md`

### Tasks

- Review every document for consistency.
- Confirm routes, tables, scoring weights, and decision rules match across files.
- Confirm all out-of-scope boundaries are explicit.
- Confirm the README is labeled as the implementation contract/draft until the app exists.

### Acceptance criteria

- All six requested files exist.
- The seven-table schema is consistent across architecture and SQL.
- The scoring formula produces a 0â€“100 score.
- Any safety failure always leads to Block.
- The implementation plan covers Phases 0â€“13.
- No document instructs Codex to use a prohibited technology.

### Manual test checklist

- [ ] Read the PRD demo flow from start to finish.
- [ ] Compare route names in architecture and README.
- [ ] Compare table names in architecture and schema.
- [ ] Search all docs for `Docker`, `Prisma`, `FastAPI`, and `Express`; confirm they appear only as exclusions.
- [ ] Confirm the SQL uses Supabase Cloud Auth and RLS.
- [ ] Confirm no Next.js application code was generated in this phase.

### Commit message

```text
docs: add EvalGate command center
```

---

## Phase 2: Skeleton generation

### Goal

Create the complete visual and routing skeleton with mock display data, but no working Supabase mutations or evaluation engine.

### Files likely touched

- `app/page.tsx`
- `app/(auth)/login/page.tsx`
- `app/(auth)/signup/page.tsx`
- `app/(dashboard)/layout.tsx`
- All planned protected route `page.tsx` files
- `components/layout/app-sidebar.tsx`
- `components/layout/app-header.tsx`
- `components/ui/*`
- `lib/navigation.ts`
- `app/globals.css`

### Tasks

- Build a focused internal-tool visual system.
- Add landing, auth, dashboard, registry, runner, results, reports, and audit routes.
- Create shared sidebar/header/navigation.
- Add reusable stat cards, badges, tables, empty states, and page headers.
- Use clearly labeled mock content only where layout requires it.
- Add responsive behavior and accessible form labels.

### Acceptance criteria

- Every planned route renders.
- Dashboard routes share one consistent application shell.
- Navigation reaches every protected module.
- Mock data is isolated and visibly temporary.
- There are no Supabase writes.
- The runner cannot claim to have executed a real evaluation.
- Lint and production build pass.

### Manual test checklist

- [ ] Open every route directly.
- [ ] Use sidebar navigation on desktop.
- [ ] Use mobile navigation at a narrow viewport.
- [ ] Verify no horizontal overflow.
- [ ] Verify buttons and links have clear labels.
- [ ] Confirm empty states explain the next action.
- [ ] Confirm no fake success toast claims data was saved.

### Commit message

```text
feat: add EvalGate application skeleton
```

---

## Phase 3: Supabase schema and RLS

### Goal

Create the seven tables, constraints, indexes, triggers, default-project provisioning, and RLS policies in Supabase Cloud.

### Files likely touched

- `supabase/patches/20260726_001_initial_schema.sql`
- `types/database.ts`
- `docs/03_DATABASE_SCHEMA.md` only if implementation discoveries require a new documented decision
- `.env.example`

### Tasks

- Copy the reviewed baseline SQL into the first immutable patch.
- Apply it using the Supabase Cloud SQL Editor.
- Verify all tables and indexes.
- Verify the Auth trigger.
- Verify RLS and policy inventory.
- Add TypeScript database types matching the applied schema.

### Acceptance criteria

- All seven public tables exist.
- RLS is enabled on every table.
- The new-user trigger creates a profile and one default project.
- One user cannot have two default projects.
- Composite foreign keys reject cross-project references.
- Scores and enums are constrained.
- The app still builds using Cloud environment variables only.

### Manual test checklist

- [ ] Run the table/RLS verification query.
- [ ] Run the policy inventory query.
- [ ] Create a temporary user through Supabase Auth or the app.
- [ ] Confirm one profile and one default project were created.
- [ ] Attempt an invalid category and confirm it is rejected.
- [ ] Attempt a score above 100 and confirm it is rejected.
- [ ] Create two users and prove RLS isolation with authenticated clients.
- [ ] Record the applied patch filename.

### Commit message

```text
feat: add Supabase schema and project RLS
```

---

## Phase 4: Supabase Auth and protected routes

### Goal

Implement email/password authentication and secure the application route boundary.

### Files likely touched

- `lib/supabase/client.ts`
- `lib/supabase/server.ts`
- `lib/supabase/proxy.ts`
- `proxy.ts`
- `app/(auth)/login/page.tsx`
- `app/(auth)/signup/page.tsx`
- `app/auth/callback/route.ts`
- `app/(dashboard)/layout.tsx`
- `components/auth/*`
- `app/actions/auth.ts`

### Tasks

- Create browser and server Supabase clients with `@supabase/ssr`.
- Implement session-cookie refresh in the root proxy.
- Validate claims server-side for protected routes.
- Implement sign-up, login, and logout.
- Add validation, pending states, and safe error messages.
- Redirect authenticated users away from login/signup.

### Acceptance criteria

- A user can sign up with email/password.
- A user can log in and log out.
- Protected routes redirect unauthenticated users to `/login`.
- Authenticated users can open `/dashboard`.
- A refresh keeps a valid session.
- The browser bundle contains no service-role key.
- Failed authentication displays a useful error without leaking internals.

### Manual test checklist

- [ ] Sign up with a new email.
- [ ] Handle the configured email-confirmation behavior.
- [ ] Log in with correct credentials.
- [ ] Try an incorrect password.
- [ ] Refresh a protected page.
- [ ] Open a protected URL in a private window.
- [ ] Log out and try browser Back.
- [ ] Inspect client-visible environment values for secret leakage.

### Commit message

```text
feat: implement Supabase authentication
```

---

## Phase 5: Default workspace resolution

### Goal

Resolve one owned default project for every protected request and make it the scope for all future data operations.

### Files likely touched

- `lib/workspace/get-default-project.ts`
- `lib/workspace/ensure-default-project.ts`
- `app/(dashboard)/layout.tsx`
- `components/layout/app-header.tsx`
- `types/app.ts`

### Tasks

- Query the default project using the authenticated server client.
- Add a safe recovery path for historical users without a project.
- Show the project name in the application shell.
- Provide typed project context to pages or query helpers.
- Handle loading, missing-project, and query-error states.

### Acceptance criteria

- A new user lands in the auto-created default project.
- The project persists across refreshes and logins.
- The app never uses a hard-coded project ID.
- A missing project is recovered once without creating duplicates.
- A user cannot resolve another ownerâ€™s project.

### Manual test checklist

- [ ] Sign in as user A and note the project ID.
- [ ] Refresh and confirm the ID is unchanged.
- [ ] Sign in as user B and confirm a different project.
- [ ] Attempt to request user Aâ€™s project as user B.
- [ ] Test the missing-project recovery path with a controlled test account.
- [ ] Confirm only one `is_default = true` row exists per owner.

### Commit message

```text
feat: resolve authenticated default workspace
```

---

## Phase 6: Test case CRUD

### Goal

Replace the test registry mockup with project-scoped Supabase CRUD.

### Files likely touched

- `app/(dashboard)/test-cases/page.tsx`
- `app/(dashboard)/test-cases/new/page.tsx`
- `app/(dashboard)/test-cases/[id]/edit/page.tsx`
- `app/actions/test-cases.ts`
- `components/test-cases/test-case-form.tsx`
- `components/test-cases/test-case-table.tsx`
- `lib/queries/test-cases.ts`
- `lib/validation/test-case.ts`

### Tasks

- List current-project test cases.
- Create and edit all documented fields.
- Convert comma/newline keyword input into normalized arrays.
- Archive and restore cases.
- Allow deletion only when database history rules permit it.
- Display validation and relational errors clearly.

### Acceptance criteria

- Create, read, update, archive, restore, and valid delete flows work.
- Invalid category, threshold, blank name, or blank input is rejected.
- Lists use live Supabase data.
- Data remains after refresh.
- RLS prevents cross-project access.
- Referenced cases cannot be deleted and the UI recommends archiving.

### Manual test checklist

- [ ] Create one case in each category.
- [ ] Create expected and forbidden keyword lists.
- [ ] Test JSON-format selection.
- [ ] Test latency and cost thresholds.
- [ ] Edit a case and refresh.
- [ ] Archive and restore a case.
- [ ] Delete an unreferenced case.
- [ ] Confirm an empty registry state is useful.
- [ ] Repeat an access attempt using a second user.

### Commit message

```text
feat: add evaluation test case registry
```

---

## Phase 7: Prompt version CRUD

### Goal

Replace prompt mockups with a versioned, project-scoped prompt registry.

### Files likely touched

- `app/(dashboard)/prompts/page.tsx`
- `app/(dashboard)/prompts/new/page.tsx`
- `app/(dashboard)/prompts/[id]/edit/page.tsx`
- `app/actions/prompt-versions.ts`
- `components/prompts/prompt-version-form.tsx`
- `components/prompts/prompt-version-table.tsx`
- `lib/queries/prompt-versions.ts`
- `lib/validation/prompt-version.ts`

### Tasks

- List prompt versions with name, version, model, status, and date.
- Create and edit prompt records.
- Enforce unique name/version labels within a project.
- Archive and restore versions.
- Preserve versions referenced by evaluation history.

### Acceptance criteria

- All prompt fields persist.
- Duplicate `(name, version_label)` values are rejected within a project.
- Two prompt versions can share a name when labels differ.
- Archived prompts are excluded from the runnerâ€™s default selection.
- Referenced prompt versions cannot be deleted.
- RLS isolation passes.

### Manual test checklist

- [ ] Create Support Agent Prompt `v1`.
- [ ] Create Support Agent Prompt `v2`.
- [ ] Attempt a duplicate `v2`.
- [ ] Edit model name and prompt text.
- [ ] Archive and restore a version.
- [ ] Delete an unreferenced version.
- [ ] Confirm the empty state and validation messages.
- [ ] Test access with a second user.

### Commit message

```text
feat: add prompt version registry
```

---

## Phase 8: Evaluation runner

### Goal

Create the end-to-end runner workflow with prompt/test selection, deterministic simulation or manual output entry, and a review step.

### Files likely touched

- `app/(dashboard)/evaluations/new/page.tsx`
- `components/evaluations/evaluation-runner.tsx`
- `components/evaluations/test-selector.tsx`
- `components/evaluations/response-editor.tsx`
- `lib/eval/simulator.ts`
- `lib/eval/types.ts`
- `lib/queries/evaluation-options.ts`

### Tasks

- Load active prompts and active tests.
- Require one prompt and at least one test.
- Add select-all and individual selection.
- Generate deterministic response text from test metadata.
- Allow the user to edit every response.
- Add latency and estimated-cost inputs.
- Review selections and outputs before execution.
- Do not yet persist final scores if Phase 9 scoring is not implemented.

### Acceptance criteria

- Only current-project active records appear.
- The user cannot continue without required selections.
- Simulation produces repeatable output for the same input.
- Manual output editing works.
- Latency and cost values reject negatives.
- Reloading does not falsely claim a run completed.
- UI labels simulated behavior honestly.

### Manual test checklist

- [ ] Run with one test selected.
- [ ] Select multiple categories.
- [ ] Use select-all and clear-all.
- [ ] Generate the same simulation twice and compare it.
- [ ] Edit one simulated response.
- [ ] Enter invalid latency and cost values.
- [ ] Test the no-active-prompts state.
- [ ] Test the no-active-tests state.

### Commit message

```text
feat: add simulated evaluation runner
```

---

## Phase 9: Scoring and release decision

### Goal

Implement, test, and persist deterministic scores, per-test outcomes, run aggregates, and the final release decision.

### Files likely touched

- `lib/eval/evaluator.ts`
- `lib/eval/types.ts`
- `lib/eval/evaluator.test.ts`
- `app/actions/evaluations.ts`
- `app/(dashboard)/evaluations/[id]/page.tsx`
- `app/(dashboard)/results/page.tsx`
- `components/evaluations/score-breakdown.tsx`
- `components/evaluations/decision-badge.tsx`
- Optional corrective SQL patch only if the applied schema requires a change

### Tasks

- Implement keyword, safety, JSON, latency, and cost scoring.
- Implement weighted total and per-test pass rule.
- Implement aggregate metrics and release decision.
- Save run, results, decision, then complete the run.
- Store structured failure reasons.
- Show failed-run recovery when persistence fails.
- Add unit tests for boundary conditions.

### Acceptance criteria

- All five scores match the documented rules.
- Weights total 100%.
- Scores are rounded consistently.
- A forbidden keyword always sets `safety_failure = true`, fails the test, and blocks the release.
- Exact average boundaries behave correctly: 80 = Ship, 60 = Needs Review.
- Run, results, and one release decision persist.
- Result history survives page refresh.
- Unit tests, lint, and build pass.

### Manual test checklist

- [ ] All expected keywords present.
- [ ] Some expected keywords missing.
- [ ] No expected keywords configured.
- [ ] Forbidden keyword with otherwise high scores.
- [ ] Valid JSON and invalid JSON.
- [ ] At threshold, 1.5Ã— threshold, and above 1.5Ã—.
- [ ] Produce average scores at 80, 60, and below 60.
- [ ] Verify one result per selected test.
- [ ] Verify one decision per run.
- [ ] Refresh the report.

### Commit message

```text
feat: add rule-based scoring and release gates
```

---

## Phase 10: Live dashboard metrics

### Goal

Replace dashboard mock data with current-project evaluation health metrics.

### Files likely touched

- `app/(dashboard)/dashboard/page.tsx`
- `lib/queries/dashboard.ts`
- `components/dashboard/metric-card.tsx`
- `components/dashboard/latest-decision.tsx`
- `components/dashboard/recent-runs.tsx`

### Tasks

- Calculate total test cases.
- Calculate active prompt versions.
- Calculate total completed runs.
- Calculate pass rate from results.
- Count blocked releases.
- Calculate average run score.
- Count safety failures.
- Show latest release decision.
- Show sensible empty states and zero denominators.

### Acceptance criteria

- All eight requested metrics come from Supabase.
- Metrics are scoped to the default project.
- Pass rate handles zero results without division errors.
- Latest decision uses deterministic recent ordering.
- Running or failed runs do not distort completed-run averages.
- Dashboard updates after a completed evaluation.

### Manual test checklist

- [ ] View dashboard with no product data.
- [ ] Add tests and prompts and confirm counts.
- [ ] Complete a passing run.
- [ ] Complete a blocked run.
- [ ] Verify pass rate manually.
- [ ] Verify average score manually.
- [ ] Confirm latest decision changes.
- [ ] Confirm user B sees only user Bâ€™s metrics.

### Commit message

```text
feat: connect live evaluation dashboard metrics
```

---

## Phase 11: Reports page

### Goal

Provide a clear run-level report with aggregate release evidence and individual results.

### Files likely touched

- `app/(dashboard)/reports/page.tsx`
- `app/(dashboard)/reports/[id]/page.tsx`
- `lib/queries/reports.ts`
- `components/reports/report-summary.tsx`
- `components/reports/result-breakdown.tsx`
- `components/reports/release-rationale.tsx`

### Tasks

- List recent completed reports.
- Join each report to its prompt version and decision.
- Show selected prompt, test count, pass/fail count, average, safety failures, and decision.
- Show recent per-test results and failure reasons.
- Add not-found handling for missing or unauthorized run IDs.

### Acceptance criteria

- The report summary contains every required field.
- Per-test rows show response, five scores, total, pass/fail, and reasons.
- The final decision and rationale are prominent.
- Unauthorized IDs return the same safe not-found behavior as missing IDs.
- Reports are recent-first and project-scoped.

### Manual test checklist

- [ ] Open a Ship report.
- [ ] Open a Needs Review report.
- [ ] Open a Block report.
- [ ] Inspect a safety-failure reason.
- [ ] Inspect a missing-keyword reason.
- [ ] Open an invalid UUID or missing run.
- [ ] Attempt to open another userâ€™s run ID.
- [ ] Verify responsive table/card behavior.

### Commit message

```text
feat: add evaluation readiness reports
```

---

## Phase 12: Audit timeline

### Goal

Show recent project activity without adding a separate audit-events table.

### Files likely touched

- `app/(dashboard)/audit/page.tsx`
- `lib/queries/audit.ts`
- `components/audit/audit-timeline.tsx`
- `components/audit/audit-event.tsx`

### Tasks

- Query recent test cases, prompt versions, runs, and decisions.
- Map records to common event objects.
- Merge, sort descending, and limit the timeline.
- Use distinct labels/icons for each event type.
- Link events to relevant records when a safe destination exists.

### Acceptance criteria

- Timeline includes test created, prompt created, run completed, and decision generated.
- Events are scoped to the default project.
- Events are sorted consistently by timestamp.
- An empty timeline has a useful next action.
- No eighth table is introduced.

### Manual test checklist

- [ ] Create a test and find its event.
- [ ] Create a prompt and find its event.
- [ ] Complete a run and find the run event.
- [ ] Find its separate decision event.
- [ ] Verify newest-first ordering.
- [ ] Verify user B cannot see user Aâ€™s activity.
- [ ] Verify event links.

### Commit message

```text
feat: add derived evaluation audit timeline
```

---

## Phase 13: Demo data and final polish

### Goal

Turn the working MVP into a coherent, resume-ready demonstration without changing its core architecture.

### Files likely touched

- `app/actions/demo-data.ts`
- `lib/demo/demo-data.ts`
- `components/demo/load-demo-data.tsx`
- Visual components across modules
- `README.md`
- `docs/05_RESUME_NOTES.md`
- Optional `supabase/patches/20260726_002_demo_support.sql` only if a database correction is truly required

### Tasks

- Add an authenticated, idempotent â€œLoad demo dataâ€ action.
- Create at least five tests covering all five categories.
- Create Support Agent Prompt v1 and v2.
- Create or guide the user through one Ship and one Block run.
- Polish empty/loading/error states and responsive layouts.
- Add metadata, favicon, screenshots, and final README setup.
- Deploy to Vercel and run a production smoke test.
- Update resume bullets only with features that actually work.

### Acceptance criteria

- Demo loading affects only the signed-in project.
- Re-running demo loading does not create uncontrolled duplicates.
- Demo data covers quality, safety, format, latency, and cost.
- The demo contains at least one Ship and one Block decision.
- No mock metric remains in a live feature.
- Lint and production build pass.
- Vercel deployment works with Supabase Auth redirects.
- README instructions match the final repository.
- The five-minute demo flow succeeds.

### Manual test checklist

- [ ] Start with a fresh account.
- [ ] Load demo data once and twice.
- [ ] Verify record counts stay controlled.
- [ ] Run the complete five-minute demo.
- [ ] Test desktop and mobile layouts.
- [ ] Check loading, empty, error, and success states.
- [ ] Check browser console and failed network requests.
- [ ] Test production sign-up, login, refresh, and logout.
- [ ] Test production CRUD and evaluation persistence.
- [ ] Verify RLS again with two production test accounts.
- [ ] Confirm README links and screenshots.
- [ ] Confirm every resume claim is demonstrated by the deployed app.

### Commit message

```text
feat: finalize EvalGate demo experience
```

## Final definition of done

EvalGate is resume-ready when:

- All phases pass their gates.
- The hosted demo works from a fresh user account.
- RLS isolation is manually proven with two users.
- A viewer can understand the problem and release decision without explanation.
- The repository contains reproducible Cloud SQL patches.
- The README tells the same technical story as the implementation.
- The resume bullets describe only verified behavior.