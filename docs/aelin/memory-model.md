# Aelin Memory Model (v1)

## Principle

Long-term memory is dynamic and boundary-driven, not static storage.

## Memory Layers

1. Session Memory
- Current chat turns and near-term context.

2. Long-term Preference Memory
- User interest tendencies and recurring attention patterns.

3. Signal Evidence Memory
- Persistent, timestamped, source-linked items used as citations.

## Update Rules

1. User Input Priority
- Explicit user inputs can raise or lower topic priority.

2. Context Boundary Trigger
- Signals inside active boundaries are weighted higher.

3. Recency Decay
- Older unreferenced items decay in ranking over time.

4. Evidence-first Answering
- Prefer answers backed by stored signal evidence before generic reasoning.

## Deletion and Control

- Users can delete manual memory notes.
- Users can narrow or broaden tracking boundaries.
- Future versions should add explicit memory section controls and export/delete workflows.
