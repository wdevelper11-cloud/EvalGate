# EvalGate build brief — from where it is today to market-ready by November 8, 2026

Read this whole brief before doing anything. It is the source of truth for this build.
If something here conflicts with the code, the code is what exists; this brief is what we want.
If you think a decision here is wrong, say so and stop. Do not change decisions on your own.

---

## 1. Who we are and why this exists

- The company trades as **Preshock AI** (preshock.com). Founder: Parth Rebhe.
- What we sell: we find failures in other companies' AI agents before their customers do, prove them with the agent's own answers, and install tests so they don't come back.
- **EvalGate is our internal test engine.** It is never named to prospects or clients. Anything a client can see says "Preshock AI" only. (AIMS, our agent monitor, is also internal and is out of scope for this build.)
- The 2026 goal is $7,000 collected by Dec 31, with $3,000 by Nov 30 from 3 closed sales calls. Selling starts the day EvalGate can test real products. **Every hour spent on anything that doesn't help a proof get sent, a call get booked, or a payment clear is an hour lost.**

### How EvalGate is used in the business

1. An agent finds a company with a **public** AI agent (support bot, assistant, etc.).
2. EvalGate asks it **10 normal customer questions** and records exactly what it answered.
3. EvalGate grades the answers against evidence (e.g. the company's own policy page) and picks the **3 worst failures**, each with what it could cost the company.
4. Parth emails the founder (no link). If they reply "yes", they get a private **proof page** showing the scorecard and the failures.
5. On a call, Parth sells the **$1,000 Baseline**: 30–50 tests on their agent, a signed **report** with fixes, a 30-minute readout. Payment by **payment link** during the call.
6. Follow-on: the **$2,500 Release Sprint** turns the failures into a regression test suite the client runs in its own CI.

The only offers sold right now: Baseline ($1,000), Release Sprint ($2,500), agency white-label job ($1,200, or 3 for $2,700). Clients are outside India only.

---

## 2. Current level (what we believe today — VERIFY THIS FIRST)

- Next.js (App Router), TypeScript, Tailwind, Supabase (Auth, Postgres, RLS), deployed on Vercel from GitHub. It is live.
- It has a concept of test cases, runs, and a verdict: **Ship / Needs Review / Block**, with a scorecard.
- **The evaluator is simulated.** It is deterministic (matches prompt substrings), fakes ~120 ms latency and zero cost. It does **not** call real AI agents.
- An "external evidence adapter" was in progress as PR #14 (status unknown).
- The UI is a developer-style dashboard, not something a paying client should see.

**Task 0 (do this before writing any code):** read the repo and this brief, then report back in plain language:
- what actually exists and works (with file paths),
- what is simulated or fake,
- what is missing for each item in section 3,
- the state of PR #14,
- anything risky (exposed keys, missing RLS, client-facing pages that say "EvalGate").
Do not change code in Task 0.

---

## 3. Target level: "market-ready" means these 6 things work for real

### 3.1 Real agent testing (the core)
- **Adapters** that send test cases to a real AI agent and record the real reply:
  - **HTTP endpoint adapter**: POST to a JSON chat API (OpenAI-compatible and custom JSON shapes, configurable request template and response path). Used for paying clients who give us an endpoint and test key.
  - **Transcript adapter**: upload 20+ conversation transcripts (CSV/JSON) and grade them. Used when a client can't give an endpoint.
  - **Public web-chat adapter** (for prospect proofs, since most public bots are website widgets): this needs a headless browser and probably can't run inside a Vercel function. **Propose an approach before building it** (for example a small worker on a separate server). Do not build it without approval.
- Every run stores: test case, exact input sent, exact output received, timestamp, latency, adapter used, and any error. This is the **evidence record**.
- Behave like one normal user: 10 questions, spaced out, no load testing, nothing behind a login, no attacks or jailbreak spam on prospects. Respect rate limits.

### 3.2 Grading you can defend
- Each test case has: the question, what a correct answer must or must not do, and the **source evidence** (e.g. a quote and URL from the company's policy or docs page).
- Grading = deterministic checks where possible + an LLM judge with a written rubric that must cite the evidence. Store the judge's reasoning.
- Severity per failure (critical / high / medium / low) and a one-line "what this could cost" written from the evidence, never invented.
- **Remove the simulated evaluator from every path a client or prospect can see.** Keep it only as a clearly labelled dev/demo fixture, or delete it.

### 3.3 Proof page (client-facing, Preshock AI branded)
- URL like `preshock.com/p/acme-7k2q` with an unguessable random part.
- Shows: company name, date, scorecard (10 questions, pass/fail), the **3 worst failures** each with *question asked → what their bot said → why it's wrong (with the evidence quote)*, severity, cost line, and a **"Book a 30-min call with Parth"** button (Cal.com link from config).
- Optional slot for a 60-second video (Vera). The page must work perfectly without it; video never blocks anything.
- `noindex`, never in the sitemap, **expires 30 days after creation** (then shows a polite "expired" page / 410), and Parth can take any page down instantly.
- Every claim on the page links back to a stored evidence record. If it isn't in a run, it can't be on the page.

### 3.4 Report export (what a paying client receives)
- A clean PDF: Preshock AI branding, client name, date, scope, method in plain words, findings by severity with exact reproduction steps and recommended fixes, an appendix of all test cases and results, and "Reviewed and signed by Parth Rebhe, Founder".
- Never mentions EvalGate or AIMS.

### 3.5 Payment link
- Create a payment link for a fixed offer and amount in USD via **Razorpay** (international cards). Stripe comes later; design so a second provider can be added.
- Webhook with signature verification and idempotency; mark the engagement paid; email confirmation.
- Must pass a real $1 test before the first sale.

### 3.6 Outbound gate (checks emails before they go out)
- A function that checks a draft email and blocks it if it: is generic (doesn't name a real finding in that prospect's product), makes a claim not backed by an evidence record, hides that Vera is an AI, **has any link in a first email**, has more than one link in a reply, or lacks the "reply stop" line.

---

## 4. Look and feel: "authentic high-end software"

Clients see only four things, so polish only these: **preshock.com landing, the proof page, the PDF report, the booking/payment pages.** The internal dashboard can stay plain.

Direction:
- Calm, credible, typographic, like serious B2B infrastructure tools. Not "gamer", no glassmorphism, no neon, no fake 3D, no stock AI imagery.
- One neutral palette plus one accent colour. Generous whitespace. Real data on the page, not decoration.
- Excellent on mobile (founders read on phones). Fast (static where possible).
- Plain words. No hype claims ("revolutionary", "10x"). Every number on the page comes from a run.
- The landing page shows a real human: Parth's name and photo, what Preshock AI does, contact email, and (once registered) business details.

---

## 5. Out of scope (do not build, even if it seems quick)

AIMS, the self-serve Scan page, the $149 pack, Monitoring, a hosted CI gate, EvalGate Cloud, NexusCompute anything, the video pipeline, new frameworks or languages, crypto payments, login for clients. Until $10,000 is collected the rule is: one offer, one channel, no new tools.

---

## 6. Hard rules

- Brand to clients: **Preshock AI** only. Never "EvalGate" or "AIMS" on anything client-facing.
- **No false claims, ever.** No fabricated results, testimonials, client names or numbers.
- Secrets only in environment variables (Vercel / Supabase / the Claude Code environment). Never in code, commits or chat.
- Supabase RLS on every table. Use a separate test project for development, not production.
- Prospect and client data is used only for that job and deleted on schedule (proof pages and videos after 30 days).
- Tests against prospects' agents run from our server (Vercel or a worker), not from the Claude Code session (its network is restricted).
- Small changes: one task per branch, with tests, small PRs. Ask before database schema changes.
- Work in **Plan mode**: show the plan, wait for approval, then build.

---

## 7. Build order (one task per session/branch)

0. **Audit** (section 2). No code.
1. **HTTP endpoint adapter + evidence records** (3.1), with tests.
2. **Grading with evidence and severity** (3.2); retire the simulated evaluator from client paths.
3. **Proof page** (3.3) with expiry, noindex and takedown.
4. **PDF report export** (3.4).
5. **Razorpay payment link + webhook** (3.5).
6. **Outbound gate** (3.6).
7. **Transcript adapter** (3.1).
8. **Propose** the public web-chat adapter approach (3.1). Build only after approval.
9. **Visual polish** of the four client-facing surfaces (section 4).

## 8. Definition of done (acceptance test, target Nov 8)

- A 10-case proof has been run against **5 real AI agents/endpoints** we're allowed to test, with stored evidence for every answer.
- Each produced a proof page that Parth checked line by line and found **100% accurate**.
- One full Baseline-style run of 30+ cases produced a PDF report that reads like professional work.
- A real $1 international payment went through the payment link and was recorded by the webhook.
- No client-facing page, PDF or email contains the words "EvalGate" or "AIMS".
- Nothing simulated can reach a prospect or client.

When a task is done, report: what changed, how to test it (the Vercel preview link and steps), and anything that still needs Parth's decision.
