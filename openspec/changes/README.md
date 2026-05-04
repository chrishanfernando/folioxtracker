# In-Flight Changes

Each subfolder here is a **proposed or in-progress change** to one or more capability specs.

```
changes/
└── <change-id>/
    ├── proposal.md
    ├── tasks.md
    ├── design.md          # optional
    └── specs/
        └── <capability>/
            └── spec.md    # delta against ../../specs/<capability>/spec.md
```

When a change ships:

1. Apply its `specs/<capability>/spec.md` deltas into `openspec/specs/<capability>/spec.md`.
2. Delete the change folder (or move it into an `archived/` subfolder if you want history outside git log).

See `../AGENTS.md` for the full workflow.
