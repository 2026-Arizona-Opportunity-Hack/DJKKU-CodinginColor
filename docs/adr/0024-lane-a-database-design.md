# 0024. Lane A database design: read through RLS, write through functions

Status: Accepted
Date: 2026-11-14

## Context
The first lane A drafts were two overlapping migrations (same tables, different shapes), a seed
for the older shape, and policies that let any author edit any draft or publish by setting
`status`. The player (lane B) and studio (lane C) already depend on a specific content shape and
on a set of RPC names. Rows with answer keys, login codes and API key hashes must never reach a
client, and minors' data is limited to name, school and class.

## Decision
- One consolidated schema (5 migrations + seed), shaped to lane C's content types: text concept
  ids, one key per question, test items carrying a `pair_key`.
- **Clients only read tables (through RLS). Every write is a security-definer function** that
  checks `auth.uid()` and role. Direct writes exist for four narrow cases only (own display name,
  class name and term, schools by an admin, mentor notes).
- Secrets live in their own tables with RLS on and no policy: answer keys, `member_login_codes`,
  `class_join_codes`, `api_key_secrets`. That keeps `select *` working on the public tables.
- Content columns have CHECK constraints that refuse answer-key field names, so a leak is
  impossible even through a buggy client.
- A module version is one `modules` row. Triggers freeze a published version and everything under it.
  Authors can only edit their own drafts; only an admin publishes; a class stays on the version it started with.
- The unlock engine (`_module_flow`, `_activity_flow`) is one place that computes locked,
  available and done; outline, next, get, submit and heartbeat all use it. Pre-tests are one-shot.
- Staff are invited by email and receive their role on a verified Google sign-in. Email sign-in is
  disabled in Supabase so an invited address cannot be claimed by a stranger.
- Learning gain is a view that follows ADR 0020. Class-level API views suppress groups under 5.

## Alternatives considered
- Table policies for every write (like the first draft): many more ways to get an author or
  instructor check subtly wrong; harder to test than one function per action.
- Keeping hash columns on `classes`, `class_members` and `api_keys` behind column grants:
  `select *` then errors for staff; easy to forget the grant on the next column.
- A snapshot-JSON copy of a module on publish: duplicates content and makes joins on `pair_key` harder.

## Consequences
Every new write needs a function (and a test). Lanes B, D and E call a documented RPC surface
(`docs/contracts/database-api.md`) instead of touching tables. Anonymous sign-ins stay on, so
`self_register` is limited only by Supabase's per-IP anonymous sign-in rate limit plus lane E's
Pages Function; login codes have 64 bits of entropy so guessing is not practical, but there is
no per-session lockout yet.
