# ADR 0008 — OpenSpec-driven development

| | |
| --- | --- |
| Status | Accepted |
| Date | 2026-05-04 |
| Deciders | (me) |

## Context

The first 8 weeks of this project were built by vibe-coding — direct prompts, no specs, no formal review. The result is a working app, but the *what* of the app lives only in the code. As the product grows, two problems start to bite:

1. **Behaviour drift.** A change is shipped and the documented intent (if it existed) silently rots. Future-me has to re-derive what something is supposed to do from what it currently does.
2. **AI-assisted development at scale needs anchoring.** Coding agents do better work when they have a *spec to read* and a *delta to write* than when asked to infer intent from code. As I lean more on agents, the cost of not having specs grows.

The codebase is small enough now that retrofitting specs is cheap. It will only get more expensive.

## Decision

**Adopt OpenSpec-driven development.** Specs live under [`openspec/`](../../openspec/) — `project.md` for context, `AGENTS.md` for the workflow, `specs/<capability>/spec.md` for current truth, `changes/<id>/` for in-flight proposals with a delta against the relevant spec.

Non-trivial changes start with a change folder (proposal + tasks + spec delta) before code. Trivial changes (typos, formatting, dependency bumps) skip the formality.

## Consequences

**Accepted.**

- Behaviour has a written home. New work starts by reading the spec; the spec is updated as a deliberate step, not a side effect.
- Coding agents (and future-me) get a structured context for every change. The proposal forces the *why*; the delta forces the *what*; the tasks force the *how*.
- The spec set is also a portfolio piece. It demonstrates the kind of structured product thinking that PM-shaped roles want to see.
- The discipline of writing the spec delta first catches scope creep and unintended behaviour broadening.

**Trade-offs accepted.**

- **Process tax.** Every non-trivial change costs an extra 15–30 minutes of writing-before-coding. At 5 hours/week of capacity that's not free. Trivial-change escape hatch is critical for the model to survive.
- **Spec drift risk if discipline lapses.** Writing the spec but not updating it after the implementation diverged is the failure mode. Folding specs back into `openspec/specs/` *as part of the merge* is the only mitigation.
- **It's me-enforced.** With no team, there's no PR reviewer to catch a missed spec. Branch protection forces the CI gate but not the spec-update gate. Self-discipline is the only check.

## Alternatives considered

- **No formal spec process** (status quo). Working but rotting; rejected as the codebase grows.
- **Lightweight `docs/` folder with prose docs.** The unstructured cousin. Rejected because OpenSpec's *requirement + scenario* shape forces concrete, testable behaviour statements that prose docs let slide.
- **Tests as the spec.** Tempting; tests are executable. Rejected because tests are the *verification* of behaviour, not the *statement* of it. Tests are the natural follow-up to specs, not a replacement.
- **Full RFC process (e.g. Rust-style RFCs).** Heavier, more formal, more peer-review-shaped. Overkill for one engineer.

## Revisit if

- The process tax becomes a chronic source of friction (a written spec that I keep skipping). At that point either drop the formality or invest in tooling that makes it cheap.
- Team of 2+. The OpenSpec workflow scales fine, but the supporting tooling (lint for missing spec deltas, etc.) becomes worth building.
