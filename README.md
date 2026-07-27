# EvalGate — AI Agent Evaluation & Release Readiness Harness

**A resume-ready deterministic evaluation MVP for engineers building LLM and AI-agent applications who need repeatable evidence—not ad hoc prompt checks—before making a release decision.**

EvalGate tests stored prompt candidates against reusable evaluation cases, persists result-level evidence in a Supabase-backed authenticated workspace, and produces an explainable **Ship**, **Needs Review**, or **Block** decision. It is an internship portfolio project, not a semantic model evaluator or a claim of production-scale readiness.

## Live Demo

<!-- Add the confirmed Vercel production URL here when it is available. Do not infer it from the repository name. -->

**Live URL pending:** this repository does not contain a confirmed production URL, so no deployment link is manufactured here. The application is configured for Vercel deployment.

## Product Screenshots

<!-- Embed 3–5 verified files from docs/screenshots/ here after the captured assets are added to this repository. -->

No files are currently present under `docs/screenshots/`; screenshots are therefore not embedded with guessed or broken paths. Once the captured assets are added, the recommended story order is dashboard → test cases → evaluations/results → reports → audit activity.

## The Problem

Prompt and agent changes can silently regress correctness, safety, policy behavior, or output format. Manual chat checks are hard to repeat, provide weak evidence, and make release decisions subjective. Teams building LLM applications need reusable checks, traceable results, and a consistent gate before a candidate moves forward.

## Solution Overview

EvalGate provides a focused, project-scoped workflow:

1. A user authenticates and enters an automatically resolved default workspace.
2. They register reusable test cases and exact, versioned prompt candidates.
3. The deterministic runner loads the selected `prompt_versions.prompt_text` and selected active tests.
4. It evaluates the **actual prompt text** for expected-phrase coverage and forbidden phrases; decisions are not inferred from prompt names or run names.
5. Category weights and priority thresholds produce one persisted result per test. A safety failure can force **Block**, while incomplete expected-keyword coverage prevents **Ship**.
6. The aggregate run and its **Ship**, **Needs Review**, or **Block** record are persisted, then the UI reads and displays that stored decision across evaluations, reports, and the dashboard.
7. Results, release-readiness reports, and derived audit activity preserve a reviewable workflow.

## Features by Module

| Module | Implemented capability |
| --- | --- |
| **Authentication and workspace scoping** | Supabase email/password auth, SSR session refresh, protected routes, default-project resolution, and project-scoped queries |
| **Test Case Registry** | Reusable quality, safety, format, latency, and cost cases with category, priority, lifecycle status, expected phrases, and forbidden phrases |
| **Prompt Version Registry** | Exact prompt text, model context label, version label, and draft/active/archived status |
| **Deterministic Evaluation Runner** | Selects one stored prompt and one or more active tests; evaluates the prompt text synchronously without a provider call |
| **Scoring and Safety Rules** | Case-insensitive phrase matching, category-aware dimension weights, priority-aware thresholds, coverage calculation, and forbidden-phrase detection |
| **Release Decisions** | Persisted **Ship**, **Needs Review**, or **Block** outcome with aggregate score and rationale; safety failures override the aggregate score |
| **Results** | Persisted evaluated text, per-test score dimensions, pass/fail state, failure reason, latency placeholder, estimated cost, and forbidden-match signal |
| **Release Readiness Reports** | Recent run summaries, decision counts, averages, safety signals, and decision rationales |
| **Audit Timeline** | Project activity derived from test, prompt, run, and decision timestamps |

## Demo Workflow

A concise 3–5 minute walkthrough:

1. Sign up or log in.
2. Review the release-readiness dashboard and latest persisted decision.
3. Inspect the active evaluation test cases.
4. Review the safe, partial, and unsafe prompt candidates.
5. Run one candidate against the same selected active test suite.
6. Inspect the persisted result for each selected test.
7. Review the generated **Ship**, **Needs Review**, or **Block** decision.
8. Open release-readiness reports and the derived audit activity.

The regression fixtures demonstrate the intended outcome set: **safe candidate → Ship**, **partial candidate → Needs Review**, and **unsafe candidate → Block**.

### Demo Data Summary

The test suite uses a coherent customer-support scenario: account-recovery safety, refund-policy quality, and duplicate-billing format cases are evaluated against safe, partial, and unsafe prompt text. This compact dataset makes expected coverage, forbidden phrases, and all three release outcomes easy to explain without presenting seed data as real customer activity.

## Architecture Overview

```text
Browser → Next.js App Router / Server Components / Server Actions
        → Supabase Auth → authenticated project resolution
        → Supabase Postgres + Row Level Security

Selected prompt text + selected active tests
        → normalized deterministic phrase matching
        → category/priority scoring per test
        → persisted eval_results and aggregate eval_run
        → persisted release_decision → evaluations/reports/dashboard/audit
```

- **Application:** Next.js 14 App Router, React, and TypeScript. Server Components read workspace data; Server Actions validate selections, run evaluation logic, and persist records.
- **Identity and data:** Supabase Auth identifies the user; Supabase Postgres stores business records; RLS enforces owner access at the database boundary.
- **Workspace resolution:** Server-side logic resolves the signed-in user's default project and derives `project_id` rather than accepting an arbitrary ownership field from the browser.
- **Evaluator:** The run action retrieves `prompt_text`, normalizes configured phrases, calculates result-level dimensions, aggregates expected-keyword coverage, and generates a decision.
- **Persistence:** `eval_results` stores the evaluated text and score evidence, while `release_decisions` stores the final decision, score, and rationale that the UI later retrieves.
- **Deployment:** The codebase is Vercel-ready, but no confirmed production URL is present in repository files or Git metadata.

For deeper context, see [`docs/02_ARCHITECTURE.md`](docs/02_ARCHITECTURE.md) and [`docs/03_DATABASE_SCHEMA.md`](docs/03_DATABASE_SCHEMA.md).

## Data Model

The SQL patch defines exactly seven public application tables:

| Table | Purpose |
| --- | --- |
| `profiles` | Application profile keyed to the Supabase Auth user |
| `projects` | User-owned EvalGate workspace |
| `test_cases` | Reusable inputs, expected/forbidden phrases, category, priority, and status |
| `prompt_versions` | Versioned prompt text and descriptive model label |
| `eval_runs` | Aggregate run state, counts, score, and safety-failure total |
| `eval_results` | One result per run/test pair with evaluated output and score evidence |
| `release_decisions` | One persisted decision and rationale per evaluation run |

The schema also supplies checks, indexes, timestamps, relationships, a unique result per run/test pair, a unique decision per run, and RLS policies. Apply [`supabase-patches/001_initial_schema.sql`](supabase-patches/001_initial_schema.sql) once through the hosted Supabase SQL Editor.

## Authentication, Authorization, and RLS

Authentication and authorization are intentionally separate:

- **Authentication:** Supabase Auth establishes the signed-in identity and `auth.uid()`; middleware refreshes the cookie-backed session.
- **Application scoping:** Server logic ensures the profile/default project exists, validates that selected prompts and tests belong to that project, and adds the resolved project identifier to writes.
- **Database authorization:** RLS policies relate `profiles.id` or `projects.owner_id` to `auth.uid()`. Child policies traverse project/run relationships, and `WITH CHECK` clauses constrain inserts and updates.
- **Defense in depth:** Application queries explicitly filter by the resolved project, while RLS remains the authorization boundary if a client bypasses the UI.
- **Credentials:** Normal frontend and server-rendered usage relies on the public Supabase URL and anon key under the authenticated session. No browser client uses a service-role key, and a service-role credential is not required by the application.

This is an interview-ready MVP authorization design, not a completed security audit or enterprise compliance claim.

## Deterministic Evaluation Model

EvalGate evaluates the selected prompt's stored `prompt_text`; it does not manufacture output containing the configured expected terms.

1. Expected and forbidden keyword lists are trimmed, lowercased, de-duplicated, and stripped of empty entries.
2. The evaluated prompt text is lowercased for case-insensitive substring matching. Multi-word phrases work because the matcher searches the normalized phrase as a substring.
3. One result is created for every selected active test. Expected coverage drives the quality dimension; forbidden matches are recorded in the result's safety evidence.
4. Category-specific weights combine quality, safety, format, deterministic latency, and zero-cost dimensions. Priority sets the per-test pass threshold: low 60, medium 70, high 80, and critical 90.
5. Aggregate expected-keyword coverage, pass/fail counts, average score, and safety failures generate the release decision:
   - **Block:** any safety failure, an average below 70, or an empty run at the decision layer.
   - **Needs Review:** safety passes, but a test fails, the average is below 85, or expected-keyword coverage is below 85%.
   - **Ship:** every selected test passes, the average is at least 85, expected coverage is at least 85%, and there are no safety failures.
6. The generated `release_decisions` record—not a prompt-name or run-name convention—is displayed by the UI.

This is deterministic substring evaluation, not semantic LLM evaluation. It does not understand natural-language negation, so a forbidden phrase should not appear even inside an otherwise safe instruction such as “never say _[forbidden phrase]_.”

## Why No Real AI API?

The MVP intentionally evaluates stored prompt text deterministically so runs are repeatable, testable, cost-free, and easy to inspect. That keeps the portfolio focus on evaluation architecture, release policy, persistence, and authorization. Future OpenAI, Anthropic, or self-hosted provider adapters could supply model output without replacing the core test-case, result, and release-decision model; none exists in the current application.

## Tech Stack

| Layer | Technology found in the repository |
| --- | --- |
| Frontend | Next.js 14 App Router, React 18, TypeScript |
| Styling | Tailwind CSS, PostCSS, Autoprefixer |
| Server logic | Server Components and Server Actions |
| Authentication | Supabase Auth via `@supabase/ssr` |
| Persistence | Supabase Postgres via `@supabase/supabase-js` |
| Authorization | Supabase Row Level Security |
| Test runner | Node.js built-in test runner with TypeScript stripping |
| Deployment target | Vercel-ready (live URL not confirmed) |

The repository has no AI-provider SDK, vector database, separate API server, ORM, or Supabase service-role dependency.

## Route Map

Only routes backed by the current App Router `page.tsx` files are listed.

| Route | Access | Purpose |
| --- | --- | --- |
| `/` | Public | Product positioning and entry points |
| `/login` | Public | Email/password sign-in |
| `/signup` | Public | Account registration |
| `/dashboard` | Authenticated | Workspace coverage, run health, safety metrics, and latest decision |
| `/test-cases` | Authenticated | Browse and archive reusable test cases |
| `/test-cases/new` | Authenticated | Create a test case |
| `/prompts` | Authenticated | Browse and manage prompt versions |
| `/prompts/new` | Authenticated | Create a prompt version |
| `/evaluations` | Authenticated | Select a prompt/test suite, run evaluation, and review recent runs |
| `/evaluations/new` | Authenticated | Redirect to the evaluation runner |
| `/results` | Authenticated | Review persisted per-test output and score evidence |
| `/reports` | Authenticated | Review aggregate release-readiness reports and decisions |
| `/audit` | Authenticated | Review project activity derived from record timestamps |

## Local Setup

### Prerequisites

- Node.js 18.17 or newer
- npm (the repository includes `package-lock.json`)
- A hosted Supabase project

### Install and configure

```bash
git clone <repository-url>
cd EvalGate
npm install
cp .env.example .env.local
```

Populate only the public client configuration; do not commit values:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Apply [`supabase-patches/001_initial_schema.sql`](supabase-patches/001_initial_schema.sql) once in the Supabase SQL Editor, then configure Supabase Auth site/redirect URLs for the environment. No local Supabase CLI or service-role key is required. See [`docs/06_SUPABASE_CLOUD_SETUP.md`](docs/06_SUPABASE_CLOUD_SETUP.md).

### Run and validate

```bash
npm run dev        # local development server
npm run typecheck  # TypeScript validation
npm run lint       # Next.js ESLint checks
npm test           # deterministic evaluator regression tests
npm run build      # production build
npm start          # serve the completed build
```

The regression suite verifies **Ship**, **Needs Review**, and **Block** behavior; case-insensitive normalization and whitespace trimming; empty keyword handling; and lookup of the persisted UI decision without a synthetic Ship fallback.

## Resume Bullets

- Built a Next.js and Supabase evaluation harness that tests exact prompt-version text against reusable cases and persists **Ship**, **Needs Review**, or **Block** release decisions.
- Designed a deterministic TypeScript evaluation model with normalized phrase matching, category-aware scoring, priority thresholds, aggregate coverage gates, and a safety override.
- Separated prompt versions, test definitions, evaluation runs, per-test evidence, and release decisions across seven relational Postgres tables for traceable review.
- Implemented Supabase Auth, SSR sessions, server-derived project ownership, project-scoped queries, and Row Level Security to isolate each user's workspace.
- Added regression tests covering safe, partial, and unsafe candidates plus normalization, empty keywords, and persisted-decision retrieval.
- Delivered a Vercel-ready full-stack Applied AI portfolio workflow without paid provider calls or unsupported claims of semantic evaluation.

## Interview Talking Points

| Topic | Concise answer |
| --- | --- |
| **Why it matters** | Prompt changes can regress behavior silently; EvalGate converts important scenarios into repeatable evidence and a consistent release recommendation. |
| **More than CRUD** | The core workflow retrieves real candidate content, normalizes phrases, computes weighted result scores and aggregate coverage, applies safety/coverage gates, persists evidence, and retrieves the resulting decision. |
| **Architecture** | Browser requests reach Next.js Server Components/Actions; Supabase supplies Auth, Postgres, and RLS; pure TypeScript rules handle deterministic evaluation. |
| **Auth vs. authorization** | Auth proves identity; project resolution and RLS decide which rows that identity may access. Route protection is UX, not the sole security boundary. |
| **Workspace scoping** | A server-resolved default project supplies `project_id`; prompt/test selections are queried within it, and RLS independently checks ownership. |
| **Hardest decision** | Keeping provider execution outside the MVP made behavior inspectable and regression-testable while preserving a future adapter boundary. |
| **Debugging lesson** | The original evaluator generated synthetic responses containing every expected keyword instead of evaluating selected `prompt_text`. The fix loaded and scored the actual prompt content, persisted that real evaluated output and its keyword-derived evidence, and enforced safety and coverage gates. |
| **Major tradeoffs** | Transparent substring rules over semantic grading; synchronous execution over jobs/retries; one workspace per user over organizations/roles; derived activity over an append-only event log. |
| **Why no real AI API** | The project demonstrates evaluation architecture, persistence, authorization, and release gating with free, reproducible behavior—not provider inference. |
| **Improve next** | Add provider adapters, semantic evaluators, baselines, configurable thresholds, human review, CI checks, and organization roles. |
| **Scaling path** | Introduce versioned datasets/snapshots, idempotent queued runs, bounded provider concurrency, batched writes, observability, and calibrated evaluator services. |

## Limitations

- Matching is deterministic substring evaluation, not semantic or model-graded evaluation.
- No OpenAI, Anthropic, LangChain, LangGraph, embedding, vector-database, or other real AI execution exists.
- Negation and broader natural-language meaning are not interpreted.
- Latency and cost fields are deterministic placeholders, not provider telemetry or billing measurements.
- Execution is synchronous; the MVP has no queues, retries, CI/CD release integration, or transactional run orchestration.
- The audit timeline is derived from timestamps rather than an immutable append-only audit log.
- Collaboration is limited to one default user-owned project; there are no organization roles, approval workflows, or billing.
- Vercel readiness does not establish an enterprise deployment guarantee, production scale, or a confirmed live URL.

## Future Improvements

These are roadmap ideas, not current capabilities:

- OpenAI, Anthropic, and self-hosted provider adapters
- Semantic, model-graded, and task-specific evaluators with rubric calibration
- Versioned datasets, exact run snapshots, and baseline regression comparison
- Configurable thresholds and policy versions
- CI/CD release checks and human-review workflows
- Dataset import/export and richer historical analysis
- Idempotent background execution, retries, provider concurrency controls, and observability
- Organization membership, roles, and approval controls

## Documentation and NotebookLM Readiness

The README, [`docs/`](docs/), [`docs/interview-pack/`](docs/interview-pack/), schema documentation, and SQL patch can be uploaded to NotebookLM for architecture review and interview preparation. The existing interview pack is retained as-is:

- [`docs/01_PRD.md`](docs/01_PRD.md) — product requirements and scope
- [`docs/02_ARCHITECTURE.md`](docs/02_ARCHITECTURE.md) — architecture and boundaries
- [`docs/03_DATABASE_SCHEMA.md`](docs/03_DATABASE_SCHEMA.md) — relational model and RLS
- [`docs/05_RESUME_NOTES.md`](docs/05_RESUME_NOTES.md) — portfolio narrative
- [`docs/interview-pack/00_INTERVIEW_MASTER_GUIDE.md`](docs/interview-pack/00_INTERVIEW_MASTER_GUIDE.md) — interview-pack entry point
- [`docs/06_SUPABASE_CLOUD_SETUP.md`](docs/06_SUPABASE_CLOUD_SETUP.md) — hosted Supabase setup
