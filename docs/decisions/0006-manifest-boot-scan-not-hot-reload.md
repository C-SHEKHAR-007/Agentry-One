# ADR-0006: Manifest discovery is a boot-time scan, not live hot-reload

## Context

The original brainstorm's "drop a folder, restart server, agent appears" idea was close to right, but the phrase "no backend modification" invited an assumption of live hot-reload — a running API process noticing a new or changed `agents/*/manifest.json` without a restart.

## Decision

The registry module scans `agents/*/manifest.json` **once, at API process boot**, validates each manifest, and upserts into the `agents` table (see [05-database-schema.md](../05-database-schema.md)). Adding or changing an agent requires restarting the API process before the change is picked up. There is no file-watcher, no live reload endpoint, in Phase 1.

## Why

True hot-reload of a running registry is materially harder than it first appears: it has to handle partial file writes mid-scan, and — more seriously — in-flight workflows that were instantiated against one version of a manifest while a newer version is being hot-loaded underneath them. None of this complexity is justified while the platform operator and the agent author are the same person, who can simply restart their own server after adding a folder. This is the honest, Phase-1-appropriate version of the "zero-code plugin" promise: true, but with a restart in the loop.

## Consequences

- [07-agent-implementation-guide.md](../07-agent-implementation-guide.md) tells agent authors explicitly to restart the API after adding a new agent.
- Live hot-reload becomes worth building once agent authors are someone other than the operator restarting their own server — tracked as roadmap item 3 in [14-roadmap.md](../14-roadmap.md).
