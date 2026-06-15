# ADR-0003: Use the official Python port of BullMQ, not a custom bridge

## Context

BullMQ is a Node.js library. The original brainstorm assumed a Node job queue without addressing how Python worker processes would actually consume jobs from it — a naive implementation would need a custom bridge (e.g. a small Node shim per worker, or a hand-rolled Redis protocol reimplementation) to let Python workers speak BullMQ's job format.

## Decision

Python workers use the **official Python port of BullMQ** (`pip install bullmq`), which implements the same Redis-based job protocol as the Node client natively. No custom bridge is built.

## Why

BullMQ's job protocol (queue structure, job state transitions, progress updates, retry/backoff bookkeeping) is nontrivial to reimplement correctly, and a custom bridge would be a maintenance burden with no upside once an official, protocol-compatible client exists. Using the same library family on both sides means the Node API's `QueueEvents` subscriber and the Python worker's `job.updateProgress()` calls are talking the same protocol without any translation layer in between.

## Consequences

- Every Python worker depends on the `bullmq` PyPI package, in addition to whatever ML/AI libraries it needs.
- Progress reporting, retries, and job completion all flow through one well-tested queue implementation instead of two independently-built ones that have to be kept in sync.
- If this package's maintenance status ever changes, revisit this decision — but as of this writing, it's the concrete, buildable answer to a cross-language queue that the original brainstorm left unresolved.
