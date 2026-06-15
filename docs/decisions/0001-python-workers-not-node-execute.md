# ADR-0001: Agents execute as Python worker processes, not a Node `execute()` function

## Context

The original brainstorm proposed a single TypeScript interface every agent implements, including `execute(input): Promise<Result>`. This assumes agents run as in-process TypeScript/Node functions.

## Decision

Every agent's actual logic runs in a **separate Python worker process**, communicating with the Node API only via BullMQ job payloads and result envelopes over Redis — never as a direct function call. The TypeScript `Agent` type is retained, but only as a Zod validation/registry type at the API boundary (validating manifests and requests), not as the executor.

## Why

Both current agents (video processing via Whisper/ffmpeg/MediaPipe, image generation via diffusers) and every plausible future agent (OCR, PDF summarization, voice cloning, translation) are fundamentally Python AI workloads. Reimplementing that logic in Node, or shelling out to Python scripts ad hoc from Node, would either duplicate work or produce an unsafe, unstructured integration. A declarative manifest + JSON Schema contract (see [`03-agent-sdk-contract.md`](../03-agent-sdk-contract.md)) plus a well-defined BullMQ wire protocol gives both sides a real, language-neutral contract without forcing either side to run code written for the other.

## Consequences

- Adding an agent never requires writing or modifying Node code beyond the generic registry/workflow/queue modules.
- Progress reporting must go through `job.updateProgress()` (Python) → BullMQ `QueueEvents` (Node) → SSE (browser), rather than a direct callback.
- The TypeScript `Agent` interface from the original brainstorm survives in spirit but not in its original one-shot `execute()` form.
