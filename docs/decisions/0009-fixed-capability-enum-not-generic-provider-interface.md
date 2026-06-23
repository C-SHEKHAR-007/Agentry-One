# ADR-0009: Fixed capability enum + per-capability provider configs, not a generic pluggable provider interface

**Status: implemented** (`capabilities`/`provider_configs` tables, `apps/api/src/modules/providers/`, `python/sdk/providers.py`).

## Context

The BYOK requirement — "I can add any API key of any model, local or premium" — could be met two ways: a fully generic pluggable provider interface where agents can declare novel capability types the platform never anticipated, or a small closed set of platform-known capabilities with swappable provider configs behind each. The simpler option was chosen explicitly.

## Decision

- **`capability` is a closed, code-defined enum**, seeded at boot: `image-generation` and `text-generation`. Adding a genuinely new capability type (e.g. `speech-to-text`) is a platform code change (a new adapter + seed row), not an operator UI action.
- An agent manifest step declares `requiresCapability`; the operator configures any number of `provider_configs` per capability (provider type, base URL, encrypted API key, config), with global/project scoping and one default per scope — the same precedence idiom the `settings` table uses.
- **Node resolves the provider at enqueue time** (explicit per-submission choice → project default → global default; `422` if none) and attaches a decrypted `providerContext` to the job payload, preserving ADR-0001's "workers never query Postgres" boundary. Secrets are AES-256-GCM encrypted at rest; jobs are removed from Redis on settle so plaintext exposure is bounded to the job's active lifetime.
- The Python `CapabilityClient` gives agents one call per capability (`generate_image(...)`); the provider-type dispatch lives entirely inside it, so agent step code never branches on provider.

## Consequences

- Swapping local SD-Turbo for a premium image API is purely a UI/config action — verified with a real Stability AI dispatch, zero changes to Sketch's own code.
- Adapters implemented: `sd_turbo_local`, `stability_ai`. Other provider types (`openai_compatible`, `anthropic`, `replicate`) are modeled but adapter-less; Replicate additionally needs an async submit-then-poll adapter and was explicitly scoped out.
- `text-generation` is schema-ready but has no adapter or consumer until an agent (e.g. the designed Video Agent) needs it.
- If a future reader wonders why a new capability type needs a code change: that was the deliberate boundary of the "simpler option" — revisit only when agent authors are third parties who can't ship platform code.
