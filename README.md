# EvalGate — AI Agent Evaluation & Release Readiness Harness

**A resume-ready deterministic evaluation platform for Applied AI and agent teams that tests stored prompt candidates against reusable cases and turns the evidence into persisted _Ship_, _Needs Review_, or _Block_ decisions.**

EvalGate addresses a practical release problem for teams building LLM and AI-agent applications: prompt changes can silently regress correctness, safety, policy behavior, or output format. The MVP provides a Supabase-backed authenticated workflow for collecting repeatable evidence before a candidate is released—without claiming semantic model evaluation or real provider execution.

## Live Demo

<!-- Production URL not confirmed in repository metadata. Add the verified Vercel link here when supplied. -->

The Vercel production URL must be supplied manually; no confirmed public deployment URL is stored in this repository.

## Product Screenshots

### Release-readiness dashboard

![EvalGate release-readiness dashboard](docs/screenshots/dashboard.png)

### Reusable test-case registry

![EvalGate reusable evaluation test cases](docs/screenshots/test_cases.png)

### Evaluation runner and run history

![EvalGate prompt evaluation runner](docs/screenshots/evaluations.png)

### Persisted release-readiness reports

![EvalGate release-readiness reports](docs/screenshots/reports.png)

### Project audit timeline

![EvalGate project audit timeline](docs/screenshots/audit.png)

## The Problem

Ad hoc prompt testing is difficult to reproduce and leaves weak release evidence. A change that appears harmless can omit required policy language, introduce a forbidden instruction, or break an expected response format. Teams need reusable cases, traceable result evidence, and a consistent release gate—not a handful of unrecorded chat sessions.

## Solution Overview

Inside an authenticated, project-scoped workspace, a user registers evaluation cases and versioned prompt candidates. The runner loads the selected `prompt_versions.prompt_text`, evaluates that actual text against the selected active cases, and persists one result per case. Expected-phrase coverage, forbidden-phrase detection, category-aware weights, and priority-aware thresholds produce transparent scores. A safety override and aggregate coverage rules then create a persisted **Ship**, **Needs Review**, or **Block** decision, which the UI reads back for dashboard, result, report, and audit views.

Decisions come from evaluated content and stored evidence; they are not hardcoded from prompt names, version labels, or run names.

## Features by Module

| Module | Existing capability |
| --- | --- |
| **Authentication and workspace scoping** | Supabase email/password auth, SSR session refresh, protected routes, and automatic default-project resolution. |
| **Test Case Registry** | Create and archive reusable quality, safety, format, latency, and cost cases with status, priority, expected phrases, and forbidden phrases. |
| **Prompt Version Registry** | Save prompt text with a name, version label, model label, and lifecycle status; activate or archive candidates. |
| **Deterministic Evaluation Runner** | Select one prompt and one or more active tests, evaluate the stored prompt text synchronously, and save per-test evidence. |
| **Scoring and Safety Rules** | Case-insensitive phrase matching, category-aware score weighting, priority-aware pass thresholds, and forbidden-match failures. |
| **Release Decisions** | Generate and persist Ship, Needs Review, or Block with a score and human-readable rationale; safety failures can force Block. |
| **Results** | Review stored prompt output, score dimensions, pass/fail state, failure reason, latency, cost, and forbidden-match evidence. |
| **Release Readiness Reports** | Review aggregate run scores, test counts, safety signals, and the associated persisted decision. |
| **Audit Timeline** | Review project activity derived from test, prompt, run, and decision timestamps. |

## Demo Workflow

This walkthrough fits a 3–5 minute portfolio demo:

1. Sign up or log in.
2. Review the release-readiness dashboard.
3. Inspect the active account-recovery, refund-policy, and duplicate-billing test cases.
4. Review the safe, partial, and unsafe prompt candidates.
5. Run a prompt candidate against the same selected active suite.
6. Inspect the persisted per-test results and keyword evidence.
7. Review the persisted release decision displayed by the UI.
8. Open reports and the audit timeline to show traceability.

The included regression scenario demonstrates the intended outcome set: **safe candidate → Ship**, **partial candidate → Needs Review**, and **unsafe candidate → Block**.

## Demo Data Summary

The coherent support-agent scenario combines an account-recovery safety case, a refund-policy quality case, and a duplicate-billing format case. Safe, partial, and unsafe prompt text varies expected-phrase coverage and forbidden content so reviewers can compare all three release outcomes without relying on prompt or run naming conventions.

## Architecture Overview

```text
Browser → Next.js App Router / Server Components / Server Actions
        → authenticated Supabase client → Supabase Auth + Postgres + RLS

Selected prompt text + selected active tests
        → deterministic normalization and phrase matching
        → per-test scoring and persisted eval_results
        → aggregate release policy and persisted release_decisions
        → dashboard, results, reports, and audit views
```

- **Web layer:** Next.js 14 App Router, React 18, and TypeScript; Server Components read workspace records and Server Actions validate commands and persist mutations.
- **Identity and data:** Supabase Auth supplies the signed-in identity, while Supabase Postgres stores project-scoped business records.
- **Workspace resolution:** server logic resolves or creates the authenticated user's default project before project data is read or written.
- **Evaluation:** the action retrieves `prompt_text`; pure TypeScript logic normalizes keywords, scores each selected active test, aggregates coverage and safety evidence, and generates the decision.
- **Authorization:** application queries include the resolved `project_id`, and Postgres RLS remains the row-level authorization boundary.
- **Deployment:** the application is Vercel-ready, but this README does not claim a confirmed live URL because none was found in repository metadata.

See [`docs/02_ARCHITECTURE.md`](docs/02_ARCHITECTURE.md) and [`docs/03_DATABASE_SCHEMA.md`](docs/03_DATABASE_SCHEMA.md) for deeper design context.

## Data Model

The SQL patch defines seven public tables:

| Table | Purpose |
| --- | --- |
| `profiles` | Application profile keyed to the Supabase Auth user. |
| `projects` | Owner-scoped workspace boundary. |
| `test_cases` | Reusable inputs, category, priority, status, and expected/forbidden phrase arrays. |
| `prompt_versions` | Stored prompt text and candidate metadata. |
| `eval_runs` | Aggregate execution state, counts, average score, and safety-failure count. |
| `eval_results` | One persisted per-test result with output, score dimensions, evidence, and failure state. |
| `release_decisions` | One persisted Ship, Needs Review, or Block decision per run, with score and rationale. |

The authoritative schema and policies are in [`supabase-patches/001_initial_schema.sql`](supabase-patches/001_initial_schema.sql).

## Authentication, Authorization, and RLS

- Supabase Auth identifies the signed-in user; authentication answers **who the user is**.
- Default-project resolution connects that identity to the application workspace, and `project_id` scopes product queries.
- Authorization answers **which rows the user may access**. RLS policies check project ownership for the project and its child records, including insert/update checks.
- Composite relationships constrain related records to the correct project where defined by the schema.
- Server Actions derive the project from the authenticated workspace and validate selected prompt/test records in that project instead of trusting a browser-submitted ownership field.
- Normal browser and server-side application flows use the public URL and anon key with the user's session. They do not require or expose a service-role key.
- Route protection supports navigation and session handling; RLS is still the database enforcement boundary.

This is an intentional MVP authorization design, not a claim of a security audit or enterprise compliance.

## Deterministic Evaluation Model

1. The runner retrieves the selected prompt version and evaluates its actual `prompt_text`.
2. Expected and forbidden keyword lists are trimmed, converted to lowercase, and filtered so empty entries are ignored.
3. Case-insensitive substring matching supports multi-word phrases and records matched expected/forbidden evidence.
4. One `eval_results` record is created for each selected active test case.
5. Expected-keyword coverage contributes to quality and format scoring; category weights and priority thresholds determine the per-test result.
6. Forbidden matches are recorded and fail the case. Safety failures override aggregate scores and force **Block**.
7. Incomplete aggregate expected-keyword coverage prevents **Ship** and can produce **Needs Review**.
8. Strong coverage, all tests passing, a sufficient aggregate score, and no safety failure can produce **Ship**.
9. The resulting `release_decisions` row is persisted and looked up by the UI; no Ship fallback is manufactured when a decision is absent.

This is deterministic substring evaluation, not semantic or model-graded evaluation. It does not understand natural-language negation, so forbidden phrases should not appear inside otherwise safe instructions—the literal text will still match.

### Why no real AI API?

The MVP intentionally evaluates stored prompt text deterministically so runs are repeatable, testable, cost-free, and easy to inspect. That keeps the portfolio focus on evaluation architecture, evidence integrity, authorization, and release policy. Future provider adapters could execute OpenAI, Anthropic, or self-hosted models without replacing the core test-case, result, and decision model; none is integrated today.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Application | Next.js 14 App Router, React 18, TypeScript |
| Styling | Tailwind CSS, PostCSS, Autoprefixer |
| Authentication | Supabase Auth through `@supabase/ssr` |
| Persistence | Supabase Postgres through `@supabase/supabase-js` |
| Authorization | Supabase Row Level Security |
| Business logic | Server Actions, Server Components, pure TypeScript scoring |
| Deployment target | Vercel-ready Next.js application (public URL not confirmed) |

No AI-provider SDK, vector database, ORM, separate API server, or service-role credential is required.

## Route Map

Only routes backed by a current `page.tsx` are included:

| Route | Purpose | Access |
| --- | --- | --- |
| `/` | Product positioning and entry point | Public |
| `/login` | Email/password sign-in | Public |
| `/signup` | Account creation | Public |
| `/dashboard` | Release-readiness metrics and latest decision | Authenticated |
| `/test-cases` | Test-case registry | Authenticated |
| `/test-cases/new` | Test-case creation form | Authenticated |
| `/prompts` | Prompt-version registry | Authenticated |
| `/prompts/new` | Prompt-version creation form | Authenticated |
| `/evaluations` | Evaluation runner and recent run history | Authenticated |
| `/evaluations/new` | Redirect into the evaluation runner | Authenticated |
| `/results` | Persisted per-test evidence | Authenticated |
| `/reports` | Aggregate readiness and release decisions | Authenticated |
| `/audit` | Derived project activity timeline | Authenticated |

## Local Setup

### Prerequisites

- Node.js 18.17 or newer
- npm (the repository includes `package-lock.json`)
- A hosted Supabase project

### Install and configure

```bash
npm install
cp .env.example .env.local
```

Set the two variables used by the Supabase browser, server, and middleware clients:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Do not add a service-role value. Apply [`supabase-patches/001_initial_schema.sql`](supabase-patches/001_initial_schema.sql) once through the hosted Supabase SQL Editor; it creates the seven tables, constraints, trigger functions, and RLS policies. Follow [`docs/06_SUPABASE_CLOUD_SETUP.md`](docs/06_SUPABASE_CLOUD_SETUP.md) for Auth URL configuration and verification.

### Run locally

```bash
npm run dev
```

Open `http://localhost:3000` for local development only.

## Testing and Validation

The repository defines these checks:

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

The Node test suite covers Ship, Needs Review, and Block behavior; case-insensitive normalization and whitespace trimming; empty keyword handling; and persisted-decision lookup without a hardcoded Ship fallback.

## Resume Bullets

- Built a deterministic AI-agent evaluation harness in Next.js and TypeScript that scores actual stored prompt text against reusable cases and persists **Ship**, **Needs Review**, or **Block** release evidence.
- Designed prompt-version and test-case registries with category-aware weighting, priority-aware thresholds, expected-phrase coverage, forbidden-phrase detection, and a safety-first Block override.
- Modeled evaluation runs, per-test evidence, and release decisions separately across seven Supabase Postgres tables to preserve traceability from candidate input to release rationale.
- Implemented Supabase Auth, SSR session handling, server-derived project scoping, and RLS-backed cross-user isolation for an authenticated full-stack workflow.
- Added regression tests for all three decision paths, keyword normalization, empty input handling, and persisted-decision rendering behavior.
- Prepared a Vercel-ready Applied AI portfolio MVP with dashboards, reports, and an audit timeline while keeping the evaluation boundary honest and provider-independent.

## Interview Talking Points

| Topic | Concise answer |
| --- | --- |
| **Why it matters** | Prompt and agent changes need repeatable safety and quality evidence before release, not unrecorded manual spot checks. |
| **More than CRUD** | The core is an evidence pipeline: content retrieval, normalization, phrase evidence, weighted scoring, safety override, aggregation, persistence, and release-policy generation. |
| **Architecture** | App Router Server Components read data; authenticated Server Actions validate scoped selections, run pure TypeScript evaluation logic, and persist through Supabase. |
| **Auth vs. authorization** | Supabase Auth establishes identity; project ownership, scoped queries, and RLS determine row access. |
| **RLS and scoping** | Every business workflow resolves the user's project, while database policies independently enforce owner access to project-linked rows. |
| **Hardest decision** | Determinism improves repeatability and inspectability but deliberately gives up semantic understanding and real model behavior. |
| **Key debugging lesson** | The original evaluator generated synthetic responses containing all expected keywords instead of evaluating the selected `prompt_text`. The fix loaded and scored the actual prompt content, persisted real keyword evidence, and enforced safety and coverage gates. |
| **Major tradeoffs** | Synchronous substring scoring and one default project keep the MVP clear, but omit queues, semantic judges, collaboration roles, and provider telemetry. |
| **Why no AI API** | The project demonstrates evaluation architecture and release governance without nondeterminism, credentials, latency, or inference cost. |
| **What comes next** | Provider adapters, semantic evaluators, baselines, human review, configurable thresholds, CI gates, and richer organization controls. |
| **How it could scale** | Add immutable configuration snapshots, queued/idempotent run workers, batched provider adapters, versioned datasets, observability, and organization/role boundaries. |

## Limitations

- Evaluation uses deterministic substring matching, not semantic model evaluation, embeddings, or an LLM judge.
- No OpenAI, Anthropic, LangChain, LangGraph, self-hosted model, or other real provider is executed.
- Natural-language negation is not interpreted; literal forbidden text still matches.
- Latency and estimated cost are fixed MVP values, not provider telemetry or billing data.
- Runs execute synchronously; there is no queue, retry system, or transactional workflow spanning every write.
- There is no CI/CD release integration, billing, enterprise deployment guarantee, or formal compliance claim.
- Collaboration is limited to an owner-scoped default project; organization membership and reviewer roles are not implemented.
- The audit view is derived from business-record timestamps rather than a dedicated immutable event log.

## Future Improvements

- OpenAI, Anthropic, and self-hosted provider adapters with real latency and usage evidence
- Semantic metrics or calibrated model-graded evaluators alongside deterministic rules
- Versioned datasets, exact configuration snapshots, and baseline regression comparison
- Configurable thresholds, human-review workflows, approvals, and release overrides
- CI/CD release checks plus dataset import/export
- Idempotent background execution, retries, and structured observability
- Organization membership, roles, and stronger collaboration controls

These are roadmap ideas, not current capabilities.

## Documentation and NotebookLM Readiness

The README, [`docs/`](docs/), [`docs/interview-pack/`](docs/interview-pack/), schema documentation, and SQL patch can be uploaded together to NotebookLM for architecture review and interview preparation. The existing interview pack is retained rather than regenerated:

- [`docs/01_PRD.md`](docs/01_PRD.md) — product requirements and scope
- [`docs/02_ARCHITECTURE.md`](docs/02_ARCHITECTURE.md) — boundaries and technical decisions
- [`docs/03_DATABASE_SCHEMA.md`](docs/03_DATABASE_SCHEMA.md) — data model and RLS explanation
- [`docs/05_RESUME_NOTES.md`](docs/05_RESUME_NOTES.md) — portfolio narrative
- [`docs/06_SUPABASE_CLOUD_SETUP.md`](docs/06_SUPABASE_CLOUD_SETUP.md) — hosted Supabase setup
- [`docs/interview-pack/00_INTERVIEW_MASTER_GUIDE.md`](docs/interview-pack/00_INTERVIEW_MASTER_GUIDE.md) — interview-pack entry point
