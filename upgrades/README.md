# Upgrades

Plans and change notes for each version of Agentry, newest first. Each plan
says what will change and how it's checked; its status block at the top
says how far it got.

| Version | What it is | Status | Branch | Documents |
|---|---|---|---|---|
| **v3** | Product and UI: recovery, automation, memory, teams; the remaining pages in the v2 look | In progress: v3.0 4 of 7 items | `feature/v3.0-quick-wins` | [plan](v3/plan.md) |
| **v2.2** | Web app architecture: Redux Toolkit + RTK Query, one axios client, routes and models in one place, feature folders | Done, 30 Sep 2026 | `feature/v2.2-architecture` | [plan](v2.2/plan.md) |
| **v2** | Orchestration experience: live run graphs, telemetry, Content Studio, the new look | Done | `feature/orchestration-experience` | [ideas](v2/ideas.md) · [changes (PR notes)](v2/changes.md) |

## Layout

```
upgrades/
├── README.md        this index
├── v2/
│   ├── ideas.md     the original v2 investigation (UI direction and feature ideas)
│   └── changes.md   what v2 changed, written for the pull request
├── v2.2/
│   └── plan.md      the architecture plan, with its final status
└── v3/
    └── plan.md      the v3 plan, with progress so far
```

A new version gets its own folder: `vX/plan.md` before work starts, and
`vX/changes.md` for the pull request when it's done.
