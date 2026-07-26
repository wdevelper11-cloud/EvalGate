# EvalGate Feature Walkthrough

## 1. Landing page

The landing page frames manual prompt testing as weak evidence and highlights reusable tests, version-aware evaluation, and explainable gates. Its example card communicates the outcome without claiming live customer data.

## 2. Authentication

Sign-up/login use Supabase email/password Auth through Server Actions. Middleware refreshes cookie sessions and redirects protected routes. The first workspace request creates missing profile/project rows through the signed-in, RLS-limited session.

## 3. Dashboard

The dashboard summarizes persisted project counts, safety failures, blocked decisions, readiness, and latest decision. It is a read model, not a separate analytics service or scale claim.

## 4. Main modules/pages

### Test cases

`/test-cases/new` creates a scenario with expected/forbidden terms, category, priority, and status. `/test-cases` shows and archives definitions. Only active cases are selectable.

### Prompts

`/prompts/new` saves prompt text plus name, version/model labels, and status. `/prompts` lists and archives candidates. Model label does not cause inference.

### Evaluations

`/evaluations` selects one prompt and active tests. The server revalidates scope, creates a run, simulates and scores cases, stores results, completes the aggregate, and creates a decision. Execution is synchronous.

### Results

`/results` shows up to 50 recent per-test responses, five dimension scores, total, pass/fail, and failure reason. It answers “what happened in this case?”

### Reports

`/reports` summarizes completed runs, decision counts, averages, pass/fail totals, safety signals, prompt labels, and reasons. It answers “why this recommendation?”

### Audit

`/audit` merges timestamps from tests, prompts, runs, and decisions. It is useful traceability, not an immutable compliance log.

## 5. Data created

| Action | Data |
| --- | --- |
| Sign up | Auth user; profile/project upon workspace resolution. |
| Create test | One scenario definition. |
| Create prompt | One prompt-version record. |
| Evaluate | Run, one result per case, normally one decision. |
| Archive | Status update. |
| View read pages | No domain write. |

## 6. Data displayed

Registries show definitions; evaluations show execution summaries; results show evidence; reports show aggregate readiness; audit shows chronological derived activity.

## 7. Product movement

Navigation mirrors the workflow: Overview → Test cases → Prompt versions → Evaluations → Results → Reports → Audit. New users define prerequisites first; returning users can jump from dashboard to failures.

## 8. Empty states

No tests means requirements are undefined; no prompts means no candidate exists; no runs/results means no evidence exists; no decision means no completed recommendation; no audit means none of its source records exist. Empty is a valid first-use state with a next action.

## 9. Error states

Workspace error means ownership setup failed. Registry/report errors mean the query failed, not that data is empty. Unavailable selection can mean missing, inactive, or foreign data. Run failure can leave partial state because writes are not atomic. Raw database errors are not shown.

## 10. Smooth demo

Prepare an account, quality and safety cases, an incomplete-marker critical case, a prompt, and verified runs. Begin at landing, orient on dashboard, show definitions briefly, spend time on execution/evidence/decision, and close at audit. Clearly say “deterministic simulated response.” Verify any desired Needs Review or Block outcome before the interview rather than improvising data.
