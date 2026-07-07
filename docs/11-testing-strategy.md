# 11 — Testing Strategy

Scoped to what Phase 1 actually needs to verify, following the pattern VSplitter already established successfully: pure-logic unit tests that need no heavy dependencies, plus a small number of slow, environment-gated integration tests that auto-skip when their prerequisites aren't available.

## Python workers

**Video Agent:** VSplitter's existing test suite (`test_ranker.py`, `test_reframe.py`, `test_captions.py`, `test_candidate_builder.py`, `test_highlight_scorer.py` — 28 tests, no ffmpeg/GPU/Ollama required) is reused **unchanged** as the test suite for the pipeline logic Video Agent wraps. On top of that, the wrapper itself gets new tests specific to the SDK integration:
- Manifest validates against the manifest JSON Schema.
- The stage-string → percentage lookup table (see [08-agent-video.md](08-agent-video.md)) handles every known stage string and falls back sensibly for unknown ones.
- The result envelope produced by `analyze`/`render` matches the shape defined in [03-agent-sdk-contract.md](03-agent-sdk-contract.md), using a stubbed `AgentJob` (no real Redis connection needed).

**Sketch Agent:** template/schema tests (manifest validity, input schema shape) require no model weights and run fast. One slow, environment-flag-gated integration test actually loads SD-Turbo and generates a real image, mirroring VSplitter's own `test_pipeline_smoke.py` pattern — skipped automatically if the model isn't cached and the flag isn't set, so it never blocks a normal test run.

## Node API

Route-level tests against a test Postgres instance (a real one, not mocked — schema correctness matters) with the BullMQ queue mocked or pointed at a test Redis instance, covering: workflow creation instantiates the right `workflow_steps` from a fixture manifest, the `advance` endpoint correctly rejects a step that isn't `awaiting_review`, artifact download streams the right bytes with the right content type.

## Frontend

Component-level tests for the generic job-submission form (renders correct controls for a range of representative JSON Schemas) and the generic artifact viewer (renders correctly per `mimeType`/`kind`, including the one Video-Agent-specific `candidate_list` checklist renderer).

## End-to-end

One scripted manual smoke flow per agent, run against a real local deployment before considering Phase 1 "done":
- **Video Agent:** submit a real local video, watch progress through `analyze`, verify ranked candidates render sensibly, select some, advance, watch `render` progress, download and inspect the resulting clips (vertical, captioned, correct duration — the same acceptance checks VSplitter's own `docs/ARCHITECTURE.md` §11 already documents).
- **Sketch Agent:** submit a prompt, verify an image comes back in a reasonable time window (validating the latency estimate from [09-agent-sketch.md](09-agent-sketch.md) against reality).

## CI scope

Lint, unit tests, and typecheck only for Phase 1 — no deployment pipeline, no automated integration-test running against real models/GPU in CI (those stay manual/local, consistent with how VSplitter's own `test_pipeline_smoke.py` is designed to be skipped in a bare CI sandbox). Deeper CI/CD maturity is explicit roadmap work (see [14-roadmap.md](14-roadmap.md)).
