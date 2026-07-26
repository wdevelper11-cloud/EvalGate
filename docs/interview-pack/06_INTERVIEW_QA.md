# EvalGate Interview Questions and Answers

Use these as answer structures, not memorized scripts.

## 1. Product understanding

### 1. What is EvalGate?
It is an AI-agent evaluation and release-readiness MVP: save scenarios and prompt versions, create deterministic evidence, and recommend Ship, Needs Review, or Block.

### 2. What problem does it solve?
It replaces scattered manual prompt checks with repeatable tests and saved evidence connecting candidate, behavior, failure, and release policy.

### 3. Who is it for?
Applied-AI, agent, and full-stack AI engineers plus release reviewers. These are target personas, not claimed customers.

### 4. Explain it to a recruiter.
It is a pre-release checklist for an AI assistant: save important situations, test a proposed instruction set, record results, and show whether it should ship, be reviewed, or be blocked.

### 5. Why three decisions?
Needs Review represents a safe but imperfect middle state. It distinguishes human judgment from both automatic Ship and hard Block.

### 6. Is this just CRUD?
Registries use CRUD, but the core revalidates scope, executes cases, applies weighted/priority scoring, enforces safety overrides, stores detailed and aggregate evidence, and derives policy. It is still an MVP, not a mature platform.

## 2. Architecture

### 7. Describe the architecture.
Next.js App Router provides pages, Server Components, Actions, and middleware. Supabase Cloud provides Auth, Postgres, and RLS. `lib/evalgate` contains domain logic. Evaluation runs synchronously with deterministic TypeScript.

### 8. Why App Router?
It keeps the MVP in one typed codebase and reduces client data plumbing. A larger system could split public APIs and workers.

### 9. What is server-side?
Main reads, all domain mutations, user/project resolution, simulation, scoring, decisions, and persistence. Client code is limited to browser interaction.

### 10. How does a form become a row?
A Server Action parses input, resolves the authenticated project, rechecks references, sends an authenticated query, and lets constraints/RLS validate it before revalidation and redirect.

### 11. What was hardest?
Keeping ownership and referential integrity aligned across prompt, tests, run, results, and decision. Server-derived scope, project queries, and RLS relationship checks address it; atomic completion remains future work.

### 12. Why separate scorer and release policy?
Case scoring answers how one scenario performed; release policy decides what to do across the suite. Separation makes both independently testable and changeable.

### 13. What if a run fails halfway?
The action attempts to mark it failed and reports an error, but writes are not atomic. Production should use a transaction/RPC or idempotent worker.

## 3. Supabase/Auth/RLS

### 14. How does Auth work?
Supabase handles email/password identity. SSR stores cookie sessions, middleware refreshes them, and protected server code verifies users with `auth.getUser()`.

### 15. How does RLS actually protect data?
Policies evaluate `auth.uid()`. Projects store owner IDs; child access requires an owned project. `WITH CHECK` also rejects unauthorized inserted or updated state.

### 16. What happens if a user accesses another project?
Application filters return no record, and direct Supabase requests are still hidden/rejected by RLS under that user's JWT.

### 17. Why is middleware insufficient?
It controls page navigation, not direct database API calls. RLS is the authorization boundary.

### 18. `USING` versus `WITH CHECK`?
`USING` selects targetable existing rows; `WITH CHECK` validates the row state produced by insert/update.

### 19. Why no service role?
It bypasses RLS and is unnecessary for user work. Anon key plus session preserves policies and reduces blast radius.

### 20. Is anon key exposure unsafe?
It is intended public configuration, not a privileged credential. Session identity, grants, and correctly tested RLS control rows.

### 21. How would you test RLS?
Use Alice and Bob. Test allowed owner CRUD, denied foreign CRUD, cross-project references, unauthenticated access, and ownership updates through direct Supabase calls.

## 4. Database design

### 22. Why seven tables?
They separate identity, ownership, reusable definitions, aggregate runs, detailed evidence, and explicit decisions.

### 23. Why runs and results separately?
Runs support status and fast summaries; results preserve one response and score breakdown per selected case.

### 24. Why a decision table?
It makes the release gate and rationale first-class and enforces one decision per run, while allowing future approval/policy metadata.

### 25. How are cross-record links protected?
Foreign keys protect direct references; RLS checks additionally require prompt/run, test/result, and run/decision to share a project. Composite FKs would strengthen production integrity.

### 26. Are results immutable?
Not strictly: owner policies permit update/delete. The UI treats them as evidence, but production should narrow policies and add correction/audit mechanisms.

### 27. Important constraints?
Enum checks, score/count ranges, one result per run/test, and one decision per run.

## 5. Feature implementation

### 28. How is output generated?
A fixed response normally includes expected terms. The marker `simulate incomplete answer` creates a fixed incomplete response. Latency is 120 ms and cost zero; no provider is called.

### 29. How is quality scored?
Case-insensitive deduplicated expected-term coverage; 40 if no terms match and 85 if no terms are configured. It is not semantic evaluation.

### 30. How are other dimensions scored?
Forbidden matches set safety to 20; otherwise 100. Format uses length, and latency/cost use fixed bands. Category changes weights.

### 31. How does priority work?
Totals must reach 60/70/80/90 for low/medium/high/critical. Forbidden matches fail regardless.

### 32. How is release decided?
Block for zero tests, safety failure, or average below 70; Needs Review for safe imperfect results or average below 85; otherwise Ship.

### 33. How does audit work?
It merges timestamps from tests, prompts, runs, and decisions. It is a derived timeline, not compliance audit.

### 34. Empty versus error state?
Empty means no records yet and suggests the next action. Error means the query/setup failed and should not imply data loss.

## 6. Security and tradeoffs

### 35. Main security controls?
Verified user lookup, SSR sessions, route redirects, server-derived project scope, project-filtered references, RLS on seven tables, relationship policies, and constraints. No formal audit is claimed.

### 36. Missing validation/security?
No comprehensive runtime schema library, detailed size limits, abuse prevention, structured security logging, or automated policy suite.

### 37. What breaks at scale?
Synchronous requests, non-atomic writes, limited pagination, repeated report queries, no queues/provider rate limits, and no observability/retention plan.

### 38. Why no Docker/local Supabase?
Cloud-only reduced MVP setup. It costs offline reproducibility and isolated integration environments; a team should automate these.

### 39. Can averages hide failures?
Safety cannot, because it hard-blocks; Ship also requires every test to pass. Production may need additional category hard gates.

## 7. Applied AI relevance

### 40. Why no real AI API?
The goal was evaluation architecture, persistence, security, and policy without cost or nondeterministic demos. Current evidence validates the harness, not a model.

### 41. How is this AI engineering?
AI engineering includes behavioral datasets, regression measurement, prompt identity, safety gates, traces, and release decisions—not only inference calls.

### 42. Is keyword matching sufficient?
No. It is transparent for exact requirements but misses semantics, factuality, and nuance. Production should combine deterministic checks, task metrics, calibrated judges, and humans.

### 43. Would you use an LLM judge?
Only after rubric definition and calibration against human labels, with judge/version evidence and bias checks.

### 44. How add providers?
Create an executor interface returning output, usage, latency, errors, and provider metadata; implement queued adapters while keeping scoring/policy downstream.

## 8. Limitations and improvements

### 45. What improve first?
Scorer tests, two-user RLS tests, atomic/idempotent runs, and exact configuration snapshots; then providers, calibrated evaluation, teams, audit, and observability.

### 46. What test carefully?
Normalization, forbidden overrides, boundary scores, duplicate IDs, partial writes, auth refresh, cross-user isolation, and empty calculations.

### 47. Is deployment verified?
No confirmed URL is present. Vercel-readiness is not proof of a deployed and smoke-tested environment.

### 48. What is missing for production?
Provider execution, transactions/jobs, snapshots, roles/approvals, robust tests, observability, retention/backups, append-only audit, calibrated metrics, and load/security testing.

## 9. Resume/project defense

### 49. What did you learn?
To separate execution from evaluation and scoring from policy; to use `WITH CHECK`; to distrust browser IDs; and to prefer evidence and honest boundaries over AI hype.

### 50. What are you proud of?
The consistent path from a real product problem through secure evidence to a clear decision, especially the hard safety override and honest simulation label.

### 51. What would you do differently?
Design transactional completion and automated RLS/scorer tests earlier, and snapshot exact configurations from the start.

### 52. How defend the AI label?
It is a harness for AI prompt/agent release evaluation, not an AI model. I explicitly call its executor deterministic simulation.

### 53. What proves resume bullets?
Routes prove workflow, TypeScript proves rules, SQL proves tables/RLS, and read views prove persisted evidence. Nothing proves users, revenue, real inference, or live deployment, so I omit them.

### 54. Why should an internship interviewer care?
It shows product scoping, frontend/backend implementation, data modeling, authorization, applied-AI system thinking, tradeoff analysis, and clear communication.
