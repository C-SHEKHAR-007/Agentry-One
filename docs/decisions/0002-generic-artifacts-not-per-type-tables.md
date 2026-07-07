# ADR-0002: Generic `artifacts`/`artifact_versions` tables, not per-type tables

## Context

The original brainstorm proposed generic tables (`artifacts`) instead of type-specific ones (`video_jobs`, `sketch_jobs`), but didn't specify enough shape to actually implement it: a single job can produce multiple, differently-purposed outputs (e.g. Video Agent's `analyze` step produces both a `candidate_list` and a `transcript`), and one step's output can become another step's input (the `candidate_list` is consumed by the `render` step).

## Decision

The `artifacts` table carries a `kind` discriminator (`"candidate_list"`, `"transcript"`, `"video_clip"`, `"image"`, etc.), an `is_primary_output` flag distinguishing user-facing results from intermediate artifacts consumed only by a later step, and a separate `artifact_versions` table for regenerations of the same logical artifact (e.g. re-running `render` with a different candidate selection, or re-running Sketch with a different seed).

## Why

Without a `kind` discriminator, the platform couldn't tell a ranked-candidate JSON blob from a rendered video clip without inspecting file contents. Without `is_primary_output`, the UI couldn't distinguish "the thing the user actually wants to download" from "an intermediate artifact one step needed to hand to the next." Without `artifact_versions`, regenerating an output would mean either overwriting history or creating ambiguous duplicate rows.

## Consequences

- Every agent's outputs, regardless of type, are queryable and downloadable through the same three endpoints (see [06-api-surface.md](../06-api-surface.md)).
- The frontend's generic artifact viewer dispatches on `kind`/`mimeType` rather than needing agent-specific rendering logic in most cases (see [07-agent-implementation-guide.md](../07-agent-implementation-guide.md)).
- Adding a new agent never requires a new table, only new `kind` values.
