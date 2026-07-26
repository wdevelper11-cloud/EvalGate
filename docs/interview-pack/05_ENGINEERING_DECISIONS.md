# EvalGate Engineering Decisions

## 1. Why Next.js App Router

It provides public/auth layouts, Server Components, Server Actions, and middleware in one TypeScript deployment unit. This reduces MVP operations; the tradeoff is framework coupling and less explicit API separation.

## 2. Why TypeScript

Shared domain types reduce mismatches across UI, scorer, actions, and data. It helps refactoring, but form/database boundaries still require runtime validation.

## 3. Why Tailwind

Tailwind enabled a consistent responsive UI without another component dependency. Shared patterns were extracted; the tradeoff is dense utility-class JSX.

## 4. Why Supabase Cloud

Hosted Postgres, Auth, RLS, and SSR tooling created a real backend boundary without a second server. The tradeoffs are service coupling, network dependence, and cloud configuration.

## 5. Why Supabase Auth

It supplies identity and sessions without building password/token infrastructure. Authorization still belongs to RLS and project ownership.

## 6. Why RLS

Users can call database APIs outside the UI. RLS applies per row at the boundary; `USING` protects existing rows and `WITH CHECK` protects new state.

## 7. Why project/workspace scoping

One ownership root makes policies and queries consistent and leaves room for future collaboration. The MVP avoids team roles and a project switcher.

## 8. Why server-side actions/helpers

Actions keep parsing, user lookup, project derivation, reference verification, scoring, persistence, and redirects traceable. Production complexity would justify service layers and workers.

## 9. Why no service-role key

Ordinary requests should not bypass RLS. Anon key plus user session is sufficient and reduces the impact of application mistakes.

## 10. Why no real AI API

The learning target is evaluation architecture, evidence, security, and policy. Simulation is free, repeatable, and inspectable. The cost is that it does not validate a real model or semantic quality. A future executor interface should capture provider configuration, latency, tokens, costs, errors, and request IDs.

## 11. Why no Docker/local Supabase

Cloud-only setup reduced tooling and kept focus on the product. It sacrifices offline reproducibility and disposable integration environments; a team should automate migrations and isolated tests.

## 12. EvalGate-specific decisions

**Deterministic scoring:** reproducible category weights and priority thresholds are easy to explain, but heuristics lack semantic understanding.

**Simulated responses:** normal output includes expected terms; an exact incomplete marker produces controlled failure; latency is 120 ms and cost zero. These are fixtures, not telemetry.

**Deterministic release policy:** safety cannot be averaged away and recommendations have stable reasons. Human approval and statistical confidence are future concerns.

**Persisted reports/derived audit:** saved evidence prevents fabricated metrics. Timestamp merging avoids another table, but is not complete audit history.

## 13. Key tradeoffs

| Choice | Benefit | Cost |
| --- | --- | --- |
| Heuristics | Explainable/repeatable | Weak semantics |
| Synchronous runner | Simple | No retries/progress/concurrency |
| Multi-step writes | Easy SDK flow | Partial failure |
| Default workspace | Focused UX | No collaboration |
| RLS + filters | Defense in depth | Needs careful tests |
| Derived audit | No event write path | Not append-only |
| Recent views | Simple reports | No robust pagination/trends |

## 14. Mistakes avoided

- Calling simulation AI-generated.
- Hiding safety in averages.
- Trusting submitted project IDs.
- Treating middleware as authorization.
- Using service role for ordinary work.
- Fabricating dashboard metrics.
- Adding vector/agent dependencies without need.
- Claiming users, revenue, certification, production scale, or verified deployment.

## 15. Improvements next

First add scorer boundary tests, two-user RLS tests, atomic/idempotent completion, and configuration snapshots. Next add provider adapters and measured telemetry. Then add calibrated task metrics, human review, jobs, teams/approvals, append-only audit, CI integration, retention, and observability. Reliability should precede feature breadth.
