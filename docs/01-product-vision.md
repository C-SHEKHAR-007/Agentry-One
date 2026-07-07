# 01 — Product Vision

## What Agentry is

Agentry is a platform for running self-contained AI capabilities — called **Agents** — behind one shared contract. A user submits a job to an agent (a video to clip, a prompt to render as an image), the platform runs it through a queue and a worker process, tracks its progress, and stores whatever it produces as a generic **artifact** the user can inspect or download.

The platform itself has no opinion about what an agent does. It only knows how to:
- discover agents that declare themselves via a manifest,
- accept a job for one of them, validate its input against that agent's schema,
- queue and run it, tracking progress and retries,
- store whatever comes back as one or more artifacts,
- show all of that in a UI that works the same way regardless of which agent produced it.

Everything that makes an agent *specific* — how it transcribes speech, how it generates an image, how it decides what's interesting in a video — lives entirely inside that agent. The platform never needs to know.

## What Agentry is not (yet)

Being explicit about scope prevents the platform from quietly becoming the 150-300 page, 50-table, Kubernetes-and-RBAC system that was the original brainstorm for this project. That system may be worth building eventually, but not before two real agents exist to prove the abstraction is right. Concretely, Agentry Phase 1 is **not**:

- **Not multi-tenant SaaS.** There's no user-facing signup, billing, or org/team model. Phase 1 assumes a single operator running the platform for themselves, with just enough of a `users` table shape to grow into multi-tenancy later without a schema rewrite (see [05-database-schema.md](05-database-schema.md)).
- **Not a workflow/DAG-builder product.** There is no drag-and-drop canvas for composing arbitrary chains of agents. Each agent declares its own fixed sequence of steps (one step for Sketch, two — with a human-approval gate — for Video). Cross-agent, user-composed workflows are real future value, but they're deferred until there's a second real use case that actually needs them (see [14-roadmap.md](14-roadmap.md)).
- **Not a plugin marketplace.** Adding an agent means dropping a folder into the `agents/` directory and restarting the API process so it can be discovered — not live hot-reloading of running workers, and not a marketplace of third-party agents installed at runtime.
- **Not multi-user secure by default.** Auth is a stub in Phase 1 (see [12-security-and-auth.md](12-security-and-auth.md)) — enough shape to add real auth later, not a working RBAC system today.

## Why a platform instead of another app

The immediate, narrow reason: the next capability after video clipping was going to be an image-generation tool ("Sketch"), and the one after that will be something else. Building each as its own app means re-solving job queuing, progress tracking, artifact storage, and UI scaffolding every time — the actual AI logic is a small fraction of the total work, and none of the plumbing gets reused.

The broader reason, stated plainly: this project exists partly to demonstrate systems-design ability — abstraction design, orchestration, job queues, schema versioning, and extensibility — in a way that a single-purpose tool, however well built, cannot. Video clipping alone shows "I can integrate Whisper and ffmpeg." A platform that lets a second, structurally different agent (image generation, with a completely different execution shape — single-step, no human gate, different resource profile) slot in cleanly, without touching the orchestrator, shows the design was right, not just the code.

## Personas

- **Solo operator (today):** the platform's only real user right now — runs it locally, submits jobs through the UI, uses both agents personally.
- **Agent author (future):** someone — possibly still the same person — who wants to add a new capability (OCR, PDF summarization, resume generation, voice cloning, translation) without touching the orchestrator, registry, queue, or frontend code. [07-agent-implementation-guide.md](07-agent-implementation-guide.md) is written for this persona specifically, since serving it well is the platform's entire reason for existing.

## Phase-1 success criteria

Concrete and testable, not aspirational:

1. **Both agents run end-to-end through the UI.** A user can submit a video (file or YouTube URL) to Video Agent, review ranked candidate clips, select some, and download rendered vertical clips with burned-in captions — exactly what VSplitter already does today, now running through the platform's job/queue/artifact machinery instead of a single Gradio script.
2. **A user can submit a text prompt to Sketch Agent** and receive a generated image as a downloadable artifact, accepting that CPU-only local generation is slow (see [09-agent-sketch.md](09-agent-sketch.md) for realistic latency expectations).
3. **A third, hypothetical agent could be added by following [07-agent-implementation-guide.md](07-agent-implementation-guide.md) alone** — without reading the orchestrator's internals and without modifying any file outside `agents/<new-agent>/` and one Docker Compose service entry. This is the test that proves the abstraction, not just the two agents that happen to exist.

## Explicit non-goals for Phase 1

These are deliberately deferred, not forgotten — see [14-roadmap.md](14-roadmap.md) for the full list and ordering rationale:

- Authentication/authorization beyond a stub
- A general event bus beyond what the job queue already provides
- Live plugin hot-reload
- User-composable multi-agent workflows (DAGs)
- A database schema beyond the 13 tables in [05-database-schema.md](05-database-schema.md)
- Kubernetes, autoscaling, multi-machine deployment
- A monitoring/alerting stack
- CI/CD maturity beyond lint + unit tests + typecheck
