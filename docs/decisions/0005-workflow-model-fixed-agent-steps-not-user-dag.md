# ADR-0005: A "workflow" is one agent's own fixed step sequence, not a user-composable DAG

> **Status: partially superseded by [ADR-0008](0008-multi-agent-templates-supersede-0005.md).** The core model here (a workflow = one agent's fixed step sequence) still holds unchanged; what changed is that saved, sequential multi-step *templates* were built on top of it rather than deferred. Branching/conditional/parallel composition remains deferred as this ADR argued.

## Context

The original brainstorm's "Workflow Orchestrator" and workflow examples (upload → extract audio → speech → AI → ranking → render) read like a general DAG/BPM engine capable of composing arbitrary steps, potentially across different agents, with branching and conditionals.

## Decision

In Phase 1, a **workflow is always one agent's own fixed sequence of steps**, declared statically in that agent's manifest (`steps[]` — see [03-agent-sdk-contract.md](../03-agent-sdk-contract.md)). Video Agent's manifest declares two sequential steps with a human-approval gate between them; Sketch Agent's declares one step with no gate. There is no mechanism for a user to compose a workflow that spans two *different* agents, and no support for branching, conditionals, or parallel fan-out/fan-in within a workflow.

## Why

Neither current agent needs more expressiveness than a fixed, linear sequence — Video Agent's two-step, human-gated flow and Sketch Agent's one-step flow are both already fully described by this simpler model (see [04-workflow-and-job-execution.md](../04-workflow-and-job-execution.md)). Building a general DAG engine (with its own graph schema, cycle detection, conditional-edge evaluation, etc.) before a second, real cross-agent chaining use case exists would be substantial speculative complexity with no current requirement driving its design.

## Consequences

- The `workflow_steps` table is a simple ordered list (`sequence: int`) per workflow, not a graph structure.
- Adding a third agent with, say, three sequential steps and two human gates still fits this model without any orchestrator changes.
- Cross-agent composition (e.g. "feed OCR's output into Translation") is explicit, ordered future work (see [14-roadmap.md](../14-roadmap.md), item 2) — deferred specifically until a genuine use case for it exists, not because it's undesirable in principle.
