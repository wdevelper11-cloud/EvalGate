# EvalGate Project Overview

## 1. Project name

**EvalGate — AI Agent Evaluation & Release Readiness Harness**

## 2. Problem statement

Prompt and agent behavior can regress after a prompt, model, tool, or workflow change. A few manual chats are inconsistent, hard to repeat, and leave no structured evidence. EvalGate organizes evaluation inputs, deterministic execution evidence, scoring, and a release recommendation. It does not host models or orchestrate agents.

## 3. Target users

Applied AI engineers, agent engineers, full-stack AI engineers, small product teams, and technical release reviewers. These are intended personas, not claimed customers.

## 4. Why the problem matters now

AI behavior is not fully described by normal unit tests. A change may help one example while breaking safety or format elsewhere. Teams need reusable datasets, recorded outputs, multiple risk dimensions, and clear policies—while recognizing that this MVP's heuristics do not replace a mature evaluation platform.

## 5. Product solution

Users authenticate into a private project, define tests, register prompt versions, choose a candidate and active suite, run deterministic simulation, inspect five score dimensions, and review a saved release decision.

## 6. Core workflow

```text
Login → resolve project → create tests → create prompt version
→ select prompt and active tests → validate ownership → simulate and score
→ persist run/results → persist decision → review reports/audit
```

Decision policy:

- **Ship:** all tests pass, average ≥85, no safety failure.
- **Needs Review:** no safety failure and average ≥70, but a case fails or average <85.
- **Block:** average <70, any forbidden match, or zero tests at the policy layer.

Case thresholds are low 60, medium 70, high 80, and critical 90.

## 7. MVP scope

- Public landing page and email/password Auth.
- SSR cookie sessions and protected workspace routes.
- Default project resolution per user in normal application flow.
- Quality, safety, format, latency, and cost test registry.
- Prompt version registry.
- Deterministic synchronous evaluation.
- Persisted aggregate runs, case evidence, and decisions.
- Dashboard, results, reports, and derived audit timeline.
- Seven Postgres tables protected by RLS.

## 8. Explicitly out of scope

- Real model inference, streaming, tokens, and provider billing.
- Semantic metrics, embeddings, vector search, and calibrated LLM judges.
- Agent/tool runtime or orchestration.
- Organizations, roles, approvals, or shared workspaces.
- Queues, retries, atomic completion, and CI release gates.
- Append-only compliance audit, observability, billing, SLAs, or certification.
- Verified deployment; the repository has no confirmed live URL.

## 9. Why it is resume-ready

It presents a relevant end-to-end problem, an explainable rules engine, relational evidence design, authenticated server workflows, and database-level authorization. The extension points and limitations are clear enough to defend in an interview.

## 10. What an interviewer should notice

1. Evaluation is separated from model execution.
2. Safety cannot be hidden by averages.
3. The browser does not select trusted ownership.
4. RLS protects direct API access, not only navigation.
5. Detailed and aggregate evidence have separate models.
6. Dashboard and reports read saved records.
7. The implementation's limitations are stated precisely.
