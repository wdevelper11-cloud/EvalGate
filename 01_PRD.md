# EvalGate Product Requirements Document

## Product name

**EvalGate — AI Agent Evaluation & Release Readiness Harness**

## One-line pitch

EvalGate helps teams test prompt and agent changes against repeatable quality, safety, format, latency, and cost checks before deciding whether to ship.

## Problem statement

AI application behavior can change when a prompt, model, tool configuration, or workflow changes. A response may look acceptable in a quick manual test while failing an important safety rule, omitting required information, returning invalid structure, or becoming too slow or expensive.

Small teams often test these changes in scattered documents or by manually chatting with a model. That process is difficult to repeat, produces little evidence, and gives no consistent release decision.

EvalGate turns evaluation scenarios into reusable test cases. A user can register prompt versions, run selected tests with simulated or pasted outputs, score the results using deterministic rules, and receive one of three release decisions:

- **Ship**
- **Needs Review**
- **Block**

## Target users

- Applied AI engineers validating prompt or agent changes
- AI agent engineers testing workflow behavior
- Full-stack AI engineers building LLM-powered products
- Founding engineers at early-stage AI startups
- Product engineers who need a simple release-quality signal
- Technical reviewers who need an auditable evaluation report

## Why this problem matters now

LLM outputs are probabilistic, and changes that improve one scenario can silently break another. Teams need repeatable evaluation datasets, safety gates, and release evidence—not only informal prompt testing. EvalGate demonstrates the same core engineering ideas used in professional LLM evaluation systems while keeping the MVP small enough to build, understand, and demonstrate quickly.

## Product goals

1. Make prompt changes testable against saved scenarios.
2. Make evaluation results deterministic and explainable.
3. Treat safety failures as release blockers.
4. Include latency and estimated cost in release readiness.
5. Preserve prompt versions, test definitions, runs, results, and decisions.
6. Keep every user’s data isolated through project ownership and Supabase RLS.
7. Provide a clear five-minute demonstration suitable for internship interviews.

## MVP scope

### Authentication

- Email/password sign-up, login, and logout with Supabase Auth
- Server-protected application routes
- Session refresh using the current Supabase SSR pattern

### Default project

- One default EvalGate project is created for every authenticated user.
- All product data is scoped to that project.
- The MVP does not expose project switching or team invitations.

### Test case registry

Users can create, read, update, archive, and delete evaluation test cases with:

- Name
- Input
- Expected keywords
- Forbidden keywords
- Category: `quality`, `safety`, `format`, `latency`, or `cost`
- Priority: `low`, `medium`, `high`, or `critical`
- Status: `draft`, `active`, or `archived`
- Optional expected output format
- Optional latency and cost thresholds

### Prompt version registry

Users can create, read, update, archive, and delete prompt versions with:

- Name
- Prompt text
- Model name
- Version label
- Status: `draft`, `active`, or `archived`

### Evaluation runner

- Select one prompt version.
- Select one or more active test cases.
- Generate a deterministic simulated response or paste/edit a response for each test.
- Record simulated latency and estimated cost.
- Run rule-based evaluation.
- Save one aggregate run and one result per selected test.

### Scoring

Each result receives five scores from 0 to 100:

- **Quality:** percentage of expected keywords present
- **Safety:** 100 when no forbidden keyword is present; otherwise 0
- **Format:** JSON validity when JSON is required; otherwise 100
- **Latency:** score based on the test’s latency threshold
- **Cost:** score based on the test’s estimated-cost threshold

The MVP uses fixed weights:

| Dimension | Weight |
| --- | ---: |
| Quality | 30% |
| Safety | 30% |
| Format | 15% |
| Latency | 15% |
| Cost | 10% |

Per-test pass rule:

- Pass when `total_score >= 60` and no forbidden keyword appears.
- Fail otherwise.

Run-level release decision:

- **Ship:** average score is at least 80 and there is no safety failure.
- **Needs Review:** average score is at least 60 and there is no safety failure.
- **Block:** average score is below 60 or any forbidden keyword appears.

### Results, dashboard, reports, and audit

- Results table with prompt, test, response, scores, pass/fail, decision, and timestamp
- Dashboard metrics derived from live Supabase data
- Report summary for an evaluation run
- Audit timeline derived from creation events across the core tables

## Out of scope

- Real OpenAI, Groq, Anthropic, or OpenRouter calls
- Model hosting or inference infrastructure
- RAG, embeddings, or vector search
- Fine-tuning
- LLM-as-a-judge or human-review queues
- Statistical significance testing
- Dataset import/export at scale
- Background workers or job queues
- Multi-user teams, roles, invitations, or billing
- Payments and subscription management
- Public API or SDK
- CI/CD integration
- Webhooks
- Real token-based cost calculation
- Enterprise compliance features
- Local Supabase, Supabase CLI, Docker, or a second backend

## User stories

### Authentication and project

- As a new user, I want to create an account so that my evaluations are private.
- As a returning user, I want to sign in and continue from my existing project.
- As a user, I want a default project created automatically so I can start without setup friction.
- As a user, I want unauthenticated visitors redirected away from protected pages.

### Test cases

- As an AI engineer, I want to save a realistic scenario so I can rerun it after prompt changes.
- As an AI engineer, I want expected keywords so I can check whether required content is present.
- As a safety reviewer, I want forbidden keywords so unsafe output blocks a release.
- As an engineer, I want latency and cost thresholds so operational regressions affect readiness.
- As a user, I want to archive old cases without losing their historical results.

### Prompt versions

- As a prompt engineer, I want separate version labels so I can compare what was evaluated.
- As a user, I want the exact prompt text stored so every run has traceable configuration.
- As a user, I want to archive superseded versions while preserving old run history.

### Evaluation and release

- As an engineer, I want to select a prompt and multiple tests so I can evaluate a candidate release.
- As a user, I want simulated or manually supplied responses so the MVP works without paid AI APIs.
- As a reviewer, I want explainable dimension scores so I understand why a test failed.
- As a release owner, I want a clear Ship, Needs Review, or Block decision.
- As a safety reviewer, I want any forbidden keyword to override a high average score.

### Reporting

- As a user, I want dashboard metrics so I can understand evaluation health quickly.
- As a reviewer, I want a report that summarizes one run and its individual results.
- As an interviewer, I want an audit timeline so I can see the product’s end-to-end activity.

## Success criteria

### Functional

- A user can sign up, log in, log out, and access only protected pages when authenticated.
- A default profile and project exist after sign-up.
- A user can complete CRUD flows for test cases and prompt versions.
- An evaluation run saves aggregate and per-test records.
- The scoring output matches the documented deterministic rules.
- A forbidden keyword always creates a safety failure and a Block decision.
- Dashboard, report, result, and audit views use persisted Supabase data.
- Refreshing a page does not lose saved data.

### Security

- RLS is enabled on every public table.
- An authenticated user can access only rows owned through their project.
- Cross-project foreign-key combinations are rejected by the database.
- The browser uses only the Supabase publishable/anon key.
- No service-role key is exposed to the application client.
- Protected routes validate identity server-side.

### Engineering quality

- `npm run lint` and `npm run build` pass after every implementation phase.
- Empty, loading, success, validation-error, and failure states are represented.
- TypeScript avoids unbounded `any`.
- Database changes are stored as ordered SQL patch files and applied through the Supabase Cloud SQL Editor.

### Demo readiness

- Demo data tells a coherent story involving two prompt versions and at least five tests.
- At least one run produces Ship and one produces Block.
- The complete demo can be shown in five minutes.
- README setup instructions work from a fresh clone with a Supabase Cloud project.

## Demo flow

1. Open the landing page and explain the release-risk problem.
2. Sign in and show the automatically resolved default project.
3. Open the test registry and show quality, safety, format, latency, and cost cases.
4. Open two prompt versions and explain why versioned configuration matters.
5. Start an evaluation with the candidate prompt and select several tests.
6. Show or edit simulated responses, including one forbidden-keyword failure.
7. Run the evaluation and explain the five dimension scores.
8. Show the Block decision and its safety rationale.
9. Open a previous passing run and show the Ship decision.
10. Finish on the dashboard, report, and audit timeline to demonstrate persistence, metrics, and traceability.

## MVP product principle

EvalGate should look and behave like a focused internal engineering tool. Every screen must support the evaluation-and-release story. Features that do not strengthen that story are deferred.
