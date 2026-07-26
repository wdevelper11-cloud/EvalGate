# EvalGate Resume Bullets

## 1. Short project title

**EvalGate — AI Agent Evaluation & Release Harness**

## 2. One-line description

Full-stack Next.js and Supabase MVP that converts reusable prompt test cases into deterministic per-case evidence and explainable Ship, Needs Review, or Block recommendations.

## 3. Six strong bullets

- Built an end-to-end AI-agent evaluation workflow with Next.js App Router, TypeScript, Tailwind CSS, and Supabase Cloud, from reusable scenario creation to persisted release recommendations.
- Designed deterministic scoring across quality, safety, format, latency, and cost using category weights and low-to-critical priority thresholds.
- Implemented a safety-first policy that prevents forbidden-keyword failures from being hidden by averages and returns explainable **Ship**, **Needs Review**, or **Block** outcomes.
- Modeled profiles, projects, tests, prompt versions, aggregate runs, per-test results, and decisions across seven Postgres tables.
- Secured project-scoped reads/writes with Supabase Auth, SSR sessions, RLS, server-derived ownership, and relationship checks.
- Built dashboard, detailed result, report, and derived audit views from persisted evidence while clearly separating simulation from real model inference.

## 4. Three short bullets

- Built a Next.js/Supabase harness for repeatable prompt evaluation and release gating.
- Added deterministic five-dimension scoring with priority thresholds and safety overrides.
- Protected seven project-scoped tables with Supabase Auth, RLS, and server ownership checks.

## 5. Three technical bullets

- Orchestrated authenticated Server Actions that revalidate prompt/test ownership and persist multi-record evaluation evidence.
- Designed Postgres checks, foreign keys, unique constraints, indexes, and RLS `USING`/`WITH CHECK` policies.
- Separated pure case scoring from aggregate policy, preserving an extension seam for provider adapters.

## 6. Three product/business bullets

- Translated unreliable manual testing into a workflow connecting scenarios, candidates, evidence, and go/no-go recommendations.
- Prioritized explainability through dimension scores, failure reasons, safety signals, and decision rationale.
- Scoped for reproducibility and zero provider cost, documenting inference, semantic judging, collaboration, and operations as future work.

## 7. Skills demonstrated

Next.js, React, TypeScript, Server Components/Actions, Tailwind, Supabase SSR/Auth, PostgreSQL, RLS, SQL constraints, data modeling, middleware, evaluation design, prompt versioning, safety gates, release policy, MVP scoping, and technical communication.

## 8. ATS keywords

`Applied AI`, `AI Agents`, `LLM Evaluation`, `Prompt Evaluation`, `Regression Testing`, `Release Readiness`, `Safety Evaluation`, `Next.js`, `React`, `TypeScript`, `Supabase`, `PostgreSQL`, `Authentication`, `Row Level Security`, `Server Actions`, `Full Stack`, `AI Product Engineering`.

Do not add OpenAI API, production scale, or deployed SaaS unless later proven.

## 9. LinkedIn/GitHub description

EvalGate is a portfolio MVP for AI-agent evaluation and release readiness. An authenticated user defines quality, safety, format, latency, and cost scenarios; registers prompt candidates; runs deterministic simulated evaluation; inspects case evidence; and receives an explainable release recommendation. It uses Next.js, TypeScript, Tailwind, Supabase Auth, Postgres, and RLS. No real provider call is made. Future work includes provider adapters, calibrated evaluation, transactional jobs, human review, teams, and observability.

## 10. Thirty-second recruiter explanation

> I built EvalGate because AI teams need more than a few manual chats before changing a prompt. It saves test situations and prompt versions, runs deterministic simulation, scores quality and risk, and stores a Ship, Needs Review, or Block recommendation. It demonstrates full-stack Next.js/Supabase engineering including Auth and RLS. I deliberately did not use a paid AI API, so the working harness and future inference layer are clearly separated.

## Claim checklist

Say “simulated response” and “release recommendation.” Do not claim real users, revenue, enterprise certification, production scale, real inference, or verified deployment.
