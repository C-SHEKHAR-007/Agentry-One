# 12 — Security and Auth (Phase 1 stub)

## Phase-1 reality

There is no real authentication or authorization system in Phase 1. The platform is designed for a single operator running it on their own machine — the `users` table (see [`05-database-schema.md`](05-database-schema.md)) exists mainly to give downstream tables (`projects`, etc.) a stable `user_id` foreign key to reference, not to back a working login system today. In practice this means either no auth at all (trusted local network only) or, at most, a single static API key checked on every request — whichever is simpler to stand up first is fine, since neither is meant to be the final answer.

## Why this is acceptable for now

Building real multi-user auth (session management, password/OAuth handling, RBAC, per-resource authorization checks) is a substantial amount of work that has no payoff until there's a second real user of the platform. Doing it now, before either agent has been used end-to-end even once, would be solving a problem that doesn't exist yet at the expense of validating whether the core agent abstraction works at all — which is this project's actual open question.

## What's deferred, and why it's ordered where it is

See [`14-roadmap.md`](14-roadmap.md) for the full ordering rationale — in short, real auth/RBAC is the **first** roadmap item after Phase 1, specifically because it's a prerequisite for almost everything else that implies more than one user (a plugin marketplace, shared projects, per-agent access control). It is not being built now only because Phase 1 has exactly one operator and one machine.
