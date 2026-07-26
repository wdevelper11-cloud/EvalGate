# EvalGate Interview Master Guide

## 1. Project identity

**EvalGate — AI Agent Evaluation & Release Readiness Harness** is a full-stack engineering MVP. It models how an AI team can turn repeatable prompt tests into reviewable release evidence. It is not a model runtime, production SaaS, or verified live deployment.

## 2. One-line explanation

EvalGate evaluates saved prompt candidates against reusable test cases with deterministic simulation and returns an explainable **Ship**, **Needs Review**, or **Block** recommendation.

## 3. Best 30-second pitch

> AI teams often change a prompt and rely on a few manual chats before release. EvalGate replaces that informal process with reusable quality, safety, format, latency, and cost tests. A user selects a prompt version and active suite; the MVP creates deterministic simulated responses, scores every result, stores the evidence, and produces a Ship, Needs Review, or Block recommendation. I built it with Next.js, TypeScript, Supabase Auth, Postgres, and project-scoped RLS. It deliberately makes no real AI-provider call, keeping the workflow reproducible and inspectable.

## 4. Best 2-minute pitch

> Prompt or agent changes can improve one case while silently breaking another. Manual chats are difficult to reproduce and provide weak release evidence, so I built EvalGate to model a professional evaluation workflow at student-MVP scope.
>
> An authenticated user gets a private default project. They create test cases with expected and forbidden keywords, a category, and a priority, then save prompt candidates as separate versions. The evaluation Server Action re-resolves the project and verifies that all selected records belong to it. A deterministic simulator—not a real model—creates responses. A pure TypeScript engine scores quality, safety, format, latency, and cost using category-specific weights and priority thresholds.
>
> The app stores an aggregate run and per-test evidence separately. It then applies a release policy: Ship requires every test to pass, an average of at least 85, and no safety failure; Needs Review represents safe but imperfect runs at 70 or above; Block covers lower averages, zero tests at the policy layer, or any forbidden-keyword match. Dashboard, results, reports, and audit views read persisted records.
>
> The important engineering is the separation of test definitions, prompt identity, execution, scoring, policy, persistence, and authorization. Supabase RLS is the data boundary, and actions derive `project_id` instead of trusting the form. For production I would add provider adapters, jobs and transactions, configuration snapshots, calibrated metrics, human review, team roles, and observability.

## 5. Problem solved

Ad hoc chats are not regression suites; averages can hide safety failures; and reviewers need saved evidence connecting a scenario and candidate to a decision. EvalGate creates the path **scenario → candidate → evidence → decision**.

## 6. AI/agent engineering relevance

Applied AI is more than calling a model. It includes behavioral test design, regression measurement, safety gates, trace preservation, and release policy. EvalGate demonstrates those system concerns. Its current results validate the harness, not a real model's intelligence.

## 7. Main technical strengths

- Separate models for definitions, runs, results, and decisions.
- Explainable category-weighted scoring and priority thresholds.
- Safety failures cannot be averaged away.
- Cookie-backed Supabase sessions and RLS on seven tables.
- Server-derived workspace ownership and revalidated selections.
- Reports and audit derived from persisted records.
- Honest boundary between simulation and provider inference.

## 8. Interview risks and honest answers

| Risk | Best answer |
| --- | --- |
| Is output AI-generated? | No. It is deterministic simulation with fixed latency and zero estimated cost. |
| Does keyword matching prove quality? | No. It is an inspectable baseline; semantic metrics, calibrated judges, and human review are future work. |
| Is it production-ready? | No. Transactions, jobs, roles, observability, snapshots, and formal security testing are missing. |
| Is deployment verified? | No confirmed live URL exists; the repository is only Vercel-ready. |
| Is audit compliance-grade? | No. It is a timestamp-derived timeline, not append-only history. |
| Is it just CRUD? | Registries use CRUD, but the core is a validated scoring, evidence, safety, and decision pipeline. |
| Are there real users or revenue? | Neither is claimed; this is a portfolio MVP. |

## 9. Reading order

Read this guide, then `01_PROJECT_OVERVIEW`, `04_FEATURE_WALKTHROUGH`, `08_DEMO_SCRIPT`, `02_ARCHITECTURE_DEEP_DIVE`, `03_DATABASE_AND_RLS_EXPLANATION`, `05_ENGINEERING_DECISIONS`, `06_INTERVIEW_QA`, and finally `07_RESUME_BULLETS`.

## 10. Using the pack with NotebookLM

1. Upload all nine files with the README and core docs.
2. Ask for separate recruiter, full-stack, security, and applied-AI mock interviews.
3. Require grading on accuracy, honesty, clarity, and technical depth.
4. Ask for flashcards on routes, tables, RLS, score thresholds, and limitations.
5. Ask it to challenge any production or AI claim unsupported by sources.
6. Practice the 30-second pitch, two-minute pitch, and demo aloud.

Useful prompts: “Make me explain one unauthorized request,” “Compare simulation, scoring, and release policy,” and “Interrupt my demo with difficult follow-ups.”

## 11. Final interviewer narrative

**AI teams need repeatable evidence before releasing prompt or agent changes. EvalGate saves scenarios and prompt versions, evaluates them deterministically, records per-case evidence, and translates that evidence into Ship, Needs Review, or Block. The MVP intentionally avoids provider inference. Its serious value is the secure, traceable evaluation architecture and an honest production roadmap.**
