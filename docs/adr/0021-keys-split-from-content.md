# 0021. Authored questions split into student content and answer key

Status: Accepted
Date: 2026-11-14

## Context
Answer keys must never reach a student or reviewer (plan, open question 2). The
studio edits a question and its answer together, which is where leaks happen.

## Decision
- A question is `{content, key}`. Content schemas are `.strict()`, so an
  answer field in content is rejected, not forwarded.
- `splitQuestion` and `splitModule` in `lane-c-logic/src/schemas.ts` are the only
  places a question is split. Content goes to `activities` / student payloads,
  keys go to `activity_keys`.
- Ordering questions are re-sorted in content so the displayed order is never
  the solved order.
- A test searches the student JSON for planted secret strings and key field names.
- Reading text is Markdown; the student app must render it without raw HTML.

## Alternatives considered
- One question object with an `answer` field and a UI "hide": one bug leaks it.
- Strip keys with a deny-list at send time: easy to forget a field.

## Consequences
The editor handles two shapes per question. The database still needs RLS on the
keys table (lane A); this ADR covers the app side only.
