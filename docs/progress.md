# Progress log

**Append-only.** Add new entries at the bottom. Never edit, reorder or delete an
earlier entry; if something was wrong, add a new entry that corrects it. This is
the honest history of what happened, and git blame shows who wrote it.

## Entry format

```
### YYYY-MM-DD [HH:MM MST]: <name> (lane X)
- Done: what changed (link the PR or issue)
- Next: what is planned
- Blocked: what is in the way (or "nothing")
```

Keep entries short. Times are Arizona time (MST). Link to issues and PRs
instead of repeating them.

## Log

### 2026-11-14: Krishna (lane E)
- Done: created the working branch and the docs scaffold (requirements,
  architecture, decisions, tradeoffs, audits, this log). Content comes from the
  team design plan, Nov 14 revision. Nothing is implemented yet.
- Next: scaffold the Vite app and deploy it to Cloudflare Pages; write the
  decision entries; draft the read API contract with Koen (lane A).
- Blocked: `gh` CLI not installed locally; Cloudflare Pages access to the org repo not yet confirmed.

### 2026-11-14: Umang (lane C)
- Done: checked GitHub for a scaffold or schema (none yet). Started lane C with
  pure logic in `lane-c-logic/`: learning gain math, paired-item scoring,
  group summary, CSV export with formula-injection guard, 20 passing Vitest
  tests. Decisions: [ADR 0019](adr/0019-learning-gain-definition.md),
  [ADR 0020](adr/0020-lane-c-logic-folder.md). Audit entry added. Handoff
  notes for lane A in `docs/handoffs/lane-c.md`.
- Next: zod authoring schemas (question types, answer-key split, YouTube
  validation, assessment pairs), then `lane_c_proposal.sql` to sync with Koen.
- Blocked: nothing. Waiting on a Vite scaffold and lane A schema before any UI.
