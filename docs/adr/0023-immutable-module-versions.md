# 0023. Module versions are rows; published versions are immutable

Status: Proposed (needs lane A agreement)
Date: 2026-11-14

## Context
Plan: instructors and staff draft, only CIC admin publishes, publishing makes an
immutable version, and a class stays on the version it started with.

## Decision
Each version is its own `modules` row (`unique(slug, version)`) with status
draft, submitted or published. RLS lets authors write lessons, activities and
tests only while the parent is not published, and only an admin may set
published. Editing a published module means creating version + 1 as a draft copy.
See `supabase/migrations/lane_c_proposal.sql`.

## Alternatives considered
- Snapshot JSON of the whole module on publish: simple to freeze but duplicates
  content and makes per-item gain joins harder.
- Mutable modules with an audit log: classes could change under students mid-term.

## Consequences
Copying a module for a new version needs a helper (not written yet). Old
versions stay in the database for classes that use them.
