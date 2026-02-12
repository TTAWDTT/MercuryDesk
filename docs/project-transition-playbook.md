# MercuryDesk Project Transition Playbook

This document helps you do three things in order:

1. Stop forcing MercuryDesk into a product that you no longer believe in.
2. Preserve the real technical assets as reusable modules or open-source projects.
3. Select your next project with a framework that optimizes for real meaning, not feature momentum.

---

## 1) Asset Decomposition Checklist

### 1.1 Module Inventory (Current Repo)

| Module | Key Paths | Reuse Value | Maturity | Action |
|---|---|---:|---:|---|
| Multi-source connectors | `backend/app/connectors/*` | High | Medium | Extract as pluggable connector SDK |
| Sync pipeline | `backend/app/sync.py` | High | Medium | Split into orchestration + adapter layers |
| Async sync jobs | `backend/app/services/sync_jobs.py` | High | Medium | Keep as standalone job runner package |
| Agent memory engine | `backend/app/services/agent_memory.py` | High | Medium | Extract as memory domain service |
| Tool execution layer | `backend/app/services/agent_tools.py` | Medium | Medium | Keep as optional module |
| LLM abstraction | `backend/app/services/llm.py` | Medium | Medium | Refactor to provider-agnostic interface |
| OAuth + account linking | `backend/app/services/oauth_clients.py`, `backend/app/routers/accounts.py` | High | High | Extract as auth/connect integration kit |
| Security + secret encryption | `backend/app/security.py`, `backend/app/services/encryption.py` | High | High | Keep as core shared package |
| Contact board UI system | `frontend/src/components/ContactGrid.tsx`, `frontend/src/components/ContactCard.tsx` | Medium | Medium | Extract as reusable React board package |
| Conversation drawer UI | `frontend/src/components/ConversationDrawer.tsx` | Medium | Medium | Keep as composable feed reader UI |
| Agent dashboard panels | `frontend/src/components/dashboard/*` | Medium | Medium | Keep as reference app, not first extraction |
| API contracts | `backend/app/schemas.py`, `frontend/src/api.ts` | High | High | Generate shared typed contract package |

### 1.2 Asset Target Repos (Suggested)

| New Repo | Contains | Purpose |
|---|---|---|
| `md-connectors-core` | Connector interfaces + common parsing + retries | Reusable ingestion toolkit |
| `md-sync-engine` | Sync orchestration, idempotency primitives, job state | Generic feed synchronization engine |
| `md-agent-memory` | Memory notes, focus extraction, layout memory | App-agnostic memory module |
| `md-oauth-kit` | OAuth provider configs, callback/state helpers | Fast integration starter for SaaS |
| `md-board-ui` | Draggable/resizable card canvas components | Reusable personal dashboard UI primitives |
| `mercurydesk-reference-app` | Current integrated app | Demo + example composition |

### 1.3 What to Archive (Do Not Expand Further)

| Scope | Reason |
|---|---|
| Product positioning copy tied to a direction you no longer believe in | Prevent sunk-cost narrative lock-in |
| Feature branches for speculative UX variants | Reduce cognitive drag |
| Experimental connectors with unclear long-term legal risk | Keep private until policy reviewed |

### 1.4 Immediate Repo Hygiene Tasks

1. Remove generated artifacts from version control (`dist`, `__pycache__`, local DB snapshots if present).
2. Ensure secrets never live in git history (`.env`, tokens, API keys, cookies).
3. Add/update `.env.example` with safe defaults.
4. Add `SECURITY.md` and `CONTRIBUTING.md`.
5. Create `ARCHITECTURE.md` with dependency boundaries.

---

## 2) Open-Source Packaging Plan (4-Week)

## Week 1: Stabilize and Define Boundaries

1. Freeze feature work on the monolith.
2. Define package boundaries and public APIs.
3. Add minimal test coverage around package seams.
4. Tag baseline commit (`v0-transition-base`).

**Exit criteria**
- Boundary diagram exists.
- Public APIs documented.
- Core smoke tests pass.

## Week 2: Extract Core Packages

1. Extract `md-connectors-core` and `md-sync-engine`.
2. Keep one integration example that uses both.
3. Add semantic versioning and changelog conventions.

**Exit criteria**
- Two packages build independently.
- One end-to-end sample sync run works.

## Week 3: Extract Memory + UI Primitives

1. Extract `md-agent-memory`.
2. Extract `md-board-ui` React primitives.
3. Publish docs for each with real examples.

**Exit criteria**
- Installable packages.
- Demo app renders and runs from package imports only.

## Week 4: Public Release Readiness

1. License decision (`MIT` or `Apache-2.0`).
2. Issue templates + PR template + code of conduct.
3. Add roadmap and “what this is / what this is not”.
4. Create launch assets: GIF demo, architecture diagram, quickstart.

**Exit criteria**
- Public repos can be cloned and run in <10 minutes.
- First external user can complete quickstart without your help.

---

## 3) Next Project Selection Framework (Meaning-First)

Use this to avoid building another technically strong but emotionally empty project.

### 3.1 Hard Gate (Must Pass All)

If any answer is "No", reject the idea before coding.

1. Would you still want to build this if no one praised it for 6 months?
2. Does this solve a pain you or a close user group repeatedly feel weekly?
3. Can the user measure a concrete life/work improvement in 30 days?
4. Can you access 10 target users for direct validation in 2 weeks?

### 3.2 Weighted Scoring Model

Score each item 1-5, compute weighted total.

| Dimension | Weight | Notes |
|---|---:|---|
| Pain intensity | 20 | How painful is status quo? |
| Frequency | 15 | Weekly/daily recurrence |
| Urgency | 10 | Cost of delay |
| Measurable outcome | 15 | Can success be objectively tracked? |
| Founder pull | 20 | Your genuine long-term motivation |
| User access | 10 | Can you interview and test quickly? |
| Build leverage | 10 | Can your existing assets accelerate delivery? |

**Decision thresholds**
- `>= 80`: Build now.
- `65-79`: Run validation sprint first.
- `< 65`: Drop.

### 3.3 14-Day Validation Sprint (No Heavy Build)

## Day 1-2
1. Write one-sentence value proposition.
2. Define one concrete before/after metric.

## Day 3-6
1. Interview 10 target users.
2. Capture current workaround, pain moments, willingness to switch.

## Day 7-9
1. Build landing page with promise + simple demo visuals.
2. Drive targeted traffic (communities/friends/users in niche).

## Day 10-12
1. Run concierge prototype manually (no full automation).
2. Deliver actual outcome to 3-5 users.

## Day 13-14
1. Ask for commitment (waitlist deposit / pre-order / pilot agreement).
2. Decide build/kill based on conversion and qualitative pull.

### 3.4 Kill Criteria (Use Ruthlessly)

Kill if any of the following happens after one full validation cycle:

1. Users describe it as “nice to have” repeatedly.
2. No one changes behavior even after trying it.
3. You need constant novelty to stay interested.
4. Success metric is hard to define or stays flat.

---

## 4) How to Reuse MercuryDesk Without Emotional Lock-In

1. Treat MercuryDesk as a technical platform, not your identity.
2. Reuse modules only when they create speed and confidence.
3. Do not inherit old positioning assumptions into the next idea.
4. Keep a clear “new thesis” document before writing code.

---

## 5) First 7 Actions You Can Execute Now

1. Declare transition state in root `README.md` (active productization paused).
2. Create branch `transition/asset-extraction`.
3. Add package boundary notes under `docs/architecture-status.md`.
4. Generate extraction TODOs per module owner.
5. Decide first package to extract (`md-sync-engine` recommended).
6. Run one 14-day validation sprint for the next idea.
7. Set a hard build/no-build decision date.

---

## 6) Output Artifacts You Should Have in 2 Weeks

1. One extracted package with docs and tests.
2. One validated next-project thesis (with score and interview evidence).
3. One decision memo: "continue extracting" or "re-focus on next product".

If you keep these outputs concrete, you avoid drifting back into feature-mode inertia.
