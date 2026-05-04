# OpenSpec Instructions for AI Assistants

This project uses **OpenSpec-driven development**. Specs are the source of truth for *what* the system does. Code is the implementation. When the two diverge, fix the divergence — don't paper over it.

## Directory Layout

```
openspec/
├── project.md                # Project context, stack, conventions (read first)
├── AGENTS.md                 # This file
├── specs/                    # Current capability specs (the truth)
│   └── <capability>/
│       └── spec.md
└── changes/                  # Proposed/in-progress changes
    └── <change-id>/
        ├── proposal.md       # Why + what + impact
        ├── tasks.md          # Checklist of work
        ├── design.md         # Optional: design notes for non-trivial changes
        └── specs/
            └── <capability>/
                └── spec.md   # Delta against the current spec
```

## Workflow

### 1. Before writing any non-trivial code

1. Read `openspec/project.md` for context.
2. Read the relevant `openspec/specs/<capability>/spec.md`.
3. If the change is more than a small bug fix, create a change folder under `openspec/changes/<change-id>/` first:
   - `proposal.md` — Why are we doing this? What changes? What is the impact (breaking? new capability? migration needed?).
   - `tasks.md` — Concrete, ordered checklist. Tick items as you complete them.
   - `specs/<capability>/spec.md` — The delta. Show what requirements are added, modified, or removed.

### 2. While implementing

- Keep `tasks.md` honest — tick items as you finish them, not in advance.
- If the implementation forces a spec change you didn't anticipate, update the change's spec delta before continuing.

### 3. After merging

- Apply the change's spec delta into the canonical `openspec/specs/<capability>/spec.md`.
- Move or delete the `openspec/changes/<change-id>/` folder (archive somewhere if you want history; otherwise let git own it).

## Spec format

Each `spec.md` follows this structure:

```markdown
# <Capability> Specification

## Purpose
One paragraph: what this capability is responsible for and what it is *not*.

## Requirements

### Requirement: <Short imperative title>
The system SHALL/MUST <behaviour>.

#### Scenario: <Concrete situation>
- **GIVEN** <preconditions>
- **WHEN** <trigger>
- **THEN** <observable outcome>
```

Rules:
- One requirement = one testable behaviour. Split if "and" appears in the rule.
- Use SHALL for hard requirements; SHOULD for strong preferences; MAY for permitted-but-optional behaviour.
- Scenarios are concrete. They name actual fields, routes, statuses — not vague conditions.
- Keep requirements *outside-in*: describe observable behaviour, not implementation. (Implementation notes belong in `design.md`.)

## Change proposal format

`proposal.md`:

```markdown
# Change: <title>

## Why
<One paragraph stating the user/business motivation.>

## What
<Bulleted list of behavioural changes.>

## Impact
- Affected capabilities: <list>
- Breaking? <yes/no — if yes, describe migration>
- DB migration? <yes/no — if yes, describe>
- Config / env vars? <list any new or changed>
```

`tasks.md`:

```markdown
# Tasks

- [ ] Update spec delta in `openspec/changes/<id>/specs/<capability>/spec.md`
- [ ] <implementation task>
- [ ] <implementation task>
- [ ] Manually verify: <scenario>
- [ ] Apply spec delta into `openspec/specs/<capability>/spec.md`
```

## Conventions for AI assistants

- **Always look at the current spec before changing behaviour.** If the spec doesn't cover it, that itself is a finding — flag it and write the requirement.
- **Never silently broaden a requirement.** If a change relaxes a `SHALL` to a `SHOULD`, call it out in the proposal.
- **Prefer adding a new requirement over editing an existing one** when adding behaviour, so the diff is clear.
- **Don't create change folders for trivial work** (typos, formatting, dependency bumps that don't change behaviour). Just commit.
- **Don't write tests as the spec.** Specs describe behaviour; tests verify it. Both should exist eventually, but specs come first.
