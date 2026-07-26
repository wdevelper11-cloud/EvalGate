# EvalGate Resume and Interview Notes

## Project summary

EvalGate is a full-stack evaluation and release-readiness harness for AI agents and LLM applications. It lets engineers register scenario-based tests and prompt versions, run deterministic evaluations with simulated or manually entered outputs, score quality, safety, format, latency, and cost, and produce an explainable Ship, Needs Review, or Block decision.

The project is designed as an industry-connected engineering MVP. It demonstrates how to make prompt changes measurable, repeatable, secure, and auditable without depending on a paid AI API.

## Resume title

**EvalGate â€” AI Agent Evaluation & Release Readiness Harness**

Alternative:

**EvalGate â€” Full-Stack LLM Evaluation and Release Gating Platform**

## Resume bullets

Use only bullets that match the final verified implementation.

- Built a full-stack LLM evaluation harness with Next.js, TypeScript, and Supabase Cloud to test versioned prompts against reusable quality, safety, format, latency, and cost scenarios.
- Designed a deterministic scoring engine that converts per-test evidence into explainable **Ship**, **Needs Review**, or **Block** release decisions, with safety failures acting as hard gates.
- Modeled prompt versions, evaluation runs, per-test score snapshots, and release decisions in Supabase Postgres with constraints and cross-project referential integrity.
- Implemented email/password authentication, protected App Router pages, automatic default-project provisioning, and project-scoped Row Level Security across seven tables.
- Delivered live evaluation metrics, run reports, result drilldowns, and a derived audit timeline, then deployed the application on Vercel.

Compact three-bullet version:

- Built EvalGate, a Next.js and Supabase Cloud harness for testing versioned AI prompts against reusable evaluation scenarios.
- Implemented rule-based quality, safety, JSON-format, latency, and cost scoring with hard safety gates and Ship/Review/Block decisions.
- Secured seven project-scoped Postgres tables with Supabase Auth, RLS, constraints, and protected routes; added live dashboards and auditable run reports.

## Technical skills demonstrated

- Next.js App Router
- React Server and Client Components
- TypeScript
- Tailwind CSS
- Server Actions and form workflows
- Supabase Auth
- Supabase SSR session handling
- PostgreSQL data modeling
- Row Level Security
- SQL constraints, indexes, functions, and triggers
- Vercel deployment
- Responsive UI and state design
- Unit testing of deterministic business logic

## Applied AI skills demonstrated

- Translating AI-product risk into measurable evaluation criteria
- Designing reusable scenario datasets
- Separating evaluation logic from model execution
- Handling nondeterministic-system concerns with deterministic MVP rules
- Treating safety, cost, and latency as product-quality dimensions
- Preserving evidence for model/prompt release review
- Communicating limitations honestly when using simulated outputs

## LLM evaluation skills demonstrated

- Prompt versioning
- Regression-oriented test design
- Expected and forbidden keyword checks
- Safety hard gates
- Structured-output validation
- Multi-dimensional scoring
- Weighted aggregation
- Threshold-based release decisions
- Per-case failure explanations
- Evaluation-run snapshots
- Ruleset versioning
- Dataset coverage across quality, safety, format, latency, and cost

## Backend and security skills demonstrated

- User-to-project ownership modeling
- Automatic profile/project provisioning from Auth
- Project-scoped foreign keys
- Defense in depth: protected routes plus RLS
- `USING` and `WITH CHECK` policy design
- Secure helper functions with fixed search paths
- Database constraints as integrity boundaries
- Immutable result/decision policies
- Safe Cloud SQL patch discipline
- Prevention of browser-side service-role exposure

## Demo explanation

Use this 60-second introduction:

> Teams often change a prompt, test it manually a few times, and ship without knowing whether an old behavior broke. EvalGate turns those important scenarios into reusable tests. I can select a versioned prompt, run quality, safety, format, latency, and cost checks against simulated or manually entered outputs, then produce an explainable Ship, Needs Review, or Block decision. The full history is stored in Supabase, and RLS keeps every userâ€™s project isolated.

Then demonstrate:

1. Test registry across five categories
2. Prompt v1 and v2
3. Candidate evaluation
4. A forbidden-keyword safety failure
5. Per-dimension scores
6. Block decision and rationale
7. Previous Ship report
8. Live dashboard and audit timeline

## Interview explanation

### Situation

LLM applications can regress when prompts or models change. Manual testing is not repeatable and usually ignores safety, latency, and cost.

### Task

Build a small but credible system that represents professional evaluation thinking and can be completed without expensive inference APIs or a complex backend.

### Action

- Defined reusable test cases and immutable evaluation history.
- Versioned prompts independently from tests.
- Built a pure TypeScript evaluator with documented weights and hard safety gates.
- Stored aggregate runs and per-test score evidence.
- Used Supabase Auth, project ownership, composite foreign keys, and RLS.
- Added reports and a derived timeline so decisions were explainable.

### Result

The system turns prompt-change evidence into a clear release decision and demonstrates full-stack AI evaluation engineering in a deployable MVP.

## 20 likely interview questions and strong answers

### 1. What problem does EvalGate solve?

It prevents teams from treating a few manual prompt trials as release evidence. EvalGate stores repeatable scenarios, evaluates a specific prompt version, records per-test evidence, and generates a consistent release decision.

### 2. Why did you build it without a real LLM API?

The MVPâ€™s goal is to demonstrate evaluation architecture, scoring, persistence, and security. Simulated or manually entered outputs make the workflow deterministic, free to run, and easy to verify. A provider adapter can be added later without changing the core data model.

### 3. Is keyword matching a sufficient LLM evaluator?

No. It is intentionally a transparent MVP evaluator. It works for required terms and obvious forbidden content but does not measure semantic correctness. A production version would combine deterministic checks, model-based judges, human review, calibrated datasets, and task-specific metrics.

### 4. How is the total score calculated?

Each result receives quality, safety, format, latency, and cost scores. The fixed weights are 30%, 30%, 15%, 15%, and 10%. The weighted sum produces 0â€“100, rounded to two decimals. The rules are versioned as `rule-based-v1`.

### 5. Why is safety a hard gate instead of only a weighted score?

Averages can hide critical failures. A response could score well on quality, format, latency, and cost while exposing forbidden content. Therefore any forbidden keyword sets a safety failure and forces Block, regardless of the average.

### 6. What is the difference between per-test pass/fail and the release decision?

Per-test pass/fail describes one scenario: it passes at 60 or higher with no safety failure. The release decision summarizes the entire run: Ship at an average of at least 80, Needs Review at least 60, and Block below 60 or on any safety failure.

### 7. Why store both `eval_runs` and `eval_results`?

`eval_runs` stores the aggregate execution and makes dashboards efficient. `eval_results` stores evidence for every selected test. The split supports both a fast summary and detailed debugging.

### 8. Why have a separate `release_decisions` table if the run has a decision field?

The run field supports fast listing and dashboard queries. The separate decision record preserves the explicit gate, rationale, safety override, and ruleset version. In production it could also store approval or policy metadata.

### 9. How do you preserve historical accuracy if a test case is edited?

Results store response and score snapshots, so completed reports are not recomputed. The database restricts deletion of referenced prompts and tests. The MVP report still joins display names from current records; a production version would also snapshot the exact prompt and test configuration used by each run.

### 10. How does authentication work?

Supabase Auth handles email/password identity. The Next.js SSR client shares the session through cookies. The application validates claims server-side for protected routes, and all database calls run with the authenticated session.

### 11. Why is route protection not enough?

Users can call the database API independently of the UI. Route protection controls navigation, while RLS controls data access at the database boundary. Both are useful, but RLS is the actual authorization layer.

### 12. How does RLS isolate users?

Projects have an `owner_id`. Child tables include `project_id`. Policies call a narrow ownership helper that checks whether the authenticated user owns that project. Insert and update policies also use `WITH CHECK` so users cannot move rows into projects they do not own.

### 13. How do you prevent cross-project references?

Tables expose composite uniqueness such as `(id, project_id)`. Composite foreign keys require a runâ€™s prompt, and a resultâ€™s run and test, to share the same project. RLS controls access; the foreign keys protect structural consistency.

### 14. Why create the default project in a database trigger?

It keeps profile and project provisioning attached to account creation, independent of which UI creates the user. The trigger is small, idempotent, and runs with a fixed search path. A partial unique index prevents multiple defaults.

### 15. Why use Supabase as the only backend?

It satisfies the project constraint while still demonstrating a real backend: Auth, Postgres, RLS, constraints, functions, triggers, and cloud persistence. Avoiding a second API server reduces deployment and debugging work without removing the important engineering decisions.

### 16. What happens if an evaluation write fails halfway?

The MVP creates a run in `running`, inserts results and a decision, then updates it to `completed`. If persistence fails, it attempts to mark the run `failed` and shows a retryable error. A production system would execute the operation in a Postgres function/transaction or an idempotent job worker.

### 17. How do you calculate latency and cost without a model API?

The runner accepts deterministic simulated values or user-entered values. The system evaluates those values against thresholds. This proves the release-gating design; real provider adapters would later populate measured latency, usage, and pricing.

### 18. How is the audit timeline implemented?

The MVP derives events from timestamps on test cases, prompt versions, runs, and decisions, merges them, and sorts them newest-first. This avoids an unnecessary table. A production audit log would be append-only and capture actors, updates, and before/after values.

### 19. What would you test most carefully?

Scoring boundaries, case-insensitive keyword behavior, forbidden-keyword overrides, valid/invalid JSON, threshold edges, zero-result dashboard calculations, auth refresh, and two-user RLS isolation. The evaluator should have unit tests because small mistakes directly change release decisions.

### 20. What would you build next for production?

I would add provider adapters, transactional/idempotent runs, exact configuration snapshots, team roles, dataset import, model-based and human judges, CI integration, statistical comparisons between prompt versions, real usage-based cost calculations, and observability.

## Future production improvements

### Evaluation quality

- Semantic similarity and task-specific metrics
- LLM-as-a-judge with calibrated rubrics
- Human-review queues and adjudication
- Golden datasets and dataset versions
- Pairwise prompt comparison
- Confidence intervals and significance testing
- False-positive/false-negative analysis
- Ruleset and evaluator version management

### Execution

- Provider adapters for OpenAI, Anthropic, Groq, and open models
- Controlled concurrency and rate limits
- Background jobs with retries
- Idempotency keys
- Streaming run progress
- Token usage and real pricing tables
- CI/CD checks and pull-request status gates

### Data integrity

- Snapshot exact prompt/test configuration per result
- Database transaction or RPC for completing a run
- Append-only audit records
- Soft deletion and retention rules
- Exportable JSON/CSV reports

### Collaboration and security

- Organizations, memberships, and roles
- Reviewer approvals and release overrides
- API keys and scoped service accounts
- SSO and enterprise policy controls
- More formal threat modeling and security tests

### Product experience

- Prompt-version comparison charts
- Failure clustering and trend analysis
- Saved evaluation suites
- Search, filters, pagination, and bulk operations
- Notifications and webhooks

## Honest positioning

Do not claim:

- Production-scale model evaluation
- Real model inference
- Semantic evaluation
- Enterprise compliance
- Statistical validation
- Automated CI gating unless it is later implemented

Do claim:

- A working full-stack evaluation workflow
- Deterministic and explainable scoring
- Prompt and scenario version-aware design
- Safety, latency, and cost release thinking
- Supabase data modeling and RLS
- Resume-ready deployment and demonstration