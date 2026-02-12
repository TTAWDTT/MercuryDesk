# Aelin PRD v1

## 1. Objective

Launch a working Chat-first Aelin experience on top of existing MercuryDesk capabilities.

## 2. Target User

Personal users who track updates across platforms and want deeper, evidence-based discussions over their long-term interests.

## 3. v1 Scope

### 3.1 Chat-first Home

- `/` route opens Aelin chat page.
- Legacy dashboard remains available at `/desk`.

### 3.2 Structured Chat Response

Each answer should include:

- `answer`: core response text
- `citations`: supporting signals from stored focus items
- `actions`: suggested next actions
- `memory_summary`: current high-level memory state

### 3.3 Context Panel

Right panel displays:

- Memory summary
- Recent focus signals
- Suggested follow-up actions

## 4. API Contracts (v1)

### `GET /api/v1/aelin/context`

Returns:

- `summary`
- `focus_items[]`
- `notes_count`
- `generated_at`

### `POST /api/v1/aelin/chat`

Request:

- `query`
- `max_citations` (optional)
- `use_memory` (optional)

Response:

- `answer`
- `citations[]`
- `actions[]`
- `memory_summary`
- `generated_at`

## 5. UX Requirements

- Chat as the default interaction surface.
- Fast-start quick prompts.
- Every answer should be inspectable via citations.
- Clear path to `/desk` for visual exploration.

## 6. v1 Exit Criteria

- `/` route fully functional as Aelin chat.
- `/desk` route still works.
- Aelin chat endpoint returns structured payload.
- Context endpoint returns memory + focus signals.
- Frontend and backend tests pass.
