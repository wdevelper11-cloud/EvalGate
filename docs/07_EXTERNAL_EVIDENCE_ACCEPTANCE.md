# Acceptance checklist

## Code and schema

- [ ] Migration applies to a clean schema and an existing baseline schema.
- [ ] Existing deterministic tests still pass unchanged.
- [ ] Adapter rejects non-HTTPS production URLs, invalid JSON, empty output, negative cost/latency, and malformed traces.
- [ ] JSON and CSV imports reject duplicate or missing selected-case keys.
- [ ] Typecheck, tests, lint, and build pass in CI.

## Security and data

- [ ] No provider secret appears in browser bundles, logs, screenshots, fixtures, or Git history.
- [ ] Authorization values come only from server-side configuration.
- [ ] Buyer has approved which trace fields may be stored.
- [ ] Personal or sensitive fields are redacted before persistence.
- [ ] File/import size and row-count limits are enforced.

## Evidence integrity

- [ ] Deterministic, endpoint, and recorded-trace results are visibly distinguished.
- [ ] Imported output is never described as live execution.
- [ ] Endpoint cost is labeled estimated unless billing-reconciled.
- [ ] A failed external call cannot generate a Ship decision.
- [ ] Each result traces to one run, one selected test, and one execution source.

## Commercial demo

- [ ] One safe endpoint or recorded-trace fixture produces persisted results.
- [ ] Reports display the source, scores, failures, and persisted decision.
- [ ] A regression changes the decision in a reproducible test.
- [ ] README limitations match deployed behavior.
- [ ] Rollback was rehearsed in a non-production project.

