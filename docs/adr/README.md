# Architecture decision records

One short file per decision: what forced a choice, what we chose, what we rejected and what it costs.
The full numbered list of decisions (including the ones that do not have their own file yet) and the
template are in [../decisions.md](../decisions.md). An accepted ADR is never rewritten; if a decision
changes, a new ADR is added and the old one is marked superseded.

| ADR | Title | Status |
|---|---|---|
| [0020](0020-learning-gain-definition.md) | Learning gain definition | Accepted |
| [0021](0021-lane-c-logic-folder.md) | Lane C pure logic lives in its own folder until the app exists | Superseded (the code moved to `shared/authoring/`) |
| [0022](0022-keys-split-from-content.md) | Authored questions split into student content and answer key | Accepted |
| [0023](0023-immutable-module-versions.md) | Module versions are rows; published versions are immutable | Accepted |
| [0024](0024-lane-a-database-design.md) | Lane A database design: read through RLS, write through functions | Accepted |

Decisions 1 to 19 in [../decisions.md](../decisions.md) (the stack, auth, hosting, video, AI hints, CI,
free-only, repo structure) were agreed in the team plan and do not have separate files yet.
