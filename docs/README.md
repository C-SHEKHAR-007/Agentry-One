# Agentry — Documentation Index & Portal

Welcome to the documentation tree for **Agentry**, the AI Agent Platform. All technical documentation, architecture blueprints, operational guides, and user manuals are indexed and organized here.

---

## 🚀 Quick Starting Points

If you are new to the codebase or platform, start with these two documents:

1. **[00 — As-Built Handover Reference](00-handover.md)**  
   *The authoritative as-built system document.* Explains how the platform actually works today, covering all 38 REST endpoints, 19 database tables, environment configuration, runbooks, and verified verification status.
2. **[16 — End-User Step-by-Step Usage Guide](16-step-by-step-user-guide.md)**  
   *The practical operator and user manual.* Step-by-step walkthroughs for logging in, configuring BYOK model keys, exploring AI agents, launching workflows, chaining multi-step templates in the visual builder, and tracking costs.

---

## 🏛️ Part 1: Product Vision & System Architecture
*These foundational documents describe why Agentry was built as a platform and how its core subsystems interact.*

- **[01 — Product Vision](01-product-vision.md)**: Product scope, non-goals, and core platform value proposition.
- **[02 — Architecture Overview](02-architecture-overview.md)**: System topology, separation of Node API from Python workers, and data flow.
- **[03 — Agent SDK Contract](03-agent-sdk-contract.md)**: The core abstraction, `manifest.json` schema rules, and Python SDK wire protocol.
- **[04 — Workflow & Job Execution](04-workflow-and-job-execution.md)**: Request lifecycle, execution states, BullMQ queuing, and retry mechanics.
- **[05 — Database Schema](05-database-schema.md)**: Relational entity model and PostgreSQL table relationships.
- **[06 — API Surface](06-api-surface.md)**: Designed REST endpoint contracts and JSON payload examples.

---

## 🛠️ Part 2: Agent Implementation Guides & Specifications
*Guides and deep dives for developers building new specialized AI agents.*

- **[07 — Agent Implementation Guide](07-agent-implementation-guide.md)**: Step-by-step tutorial on building, testing, and registering a new Python agent worker.
- **[08 — Video Agent Specification](08-agent-video.md)**: Architectural design for video processing wrappers (wrapping standalone tools like VSplitter).
- **[09 — Sketch Agent Specification](09-agent-sketch.md)**: In-depth design of the reference text-to-image generation agent (local CPU SD-Turbo & Stability AI).

---

## ⚙️ Part 3: Operations, Deployment & Security
*Guides for self-hosting, container orchestration, testing, and monitoring.*

- **[10 — Deployment & Docker Guide](10-deployment.md)**: Containerization topology, Docker Compose services, networking, and storage volumes.
- **[11 — Testing Strategy](11-testing-strategy.md)**: Automated unit testing, integration smoke suites, and CLI agent scaffolding.
- **[12 — Security & Authentication](12-security-and-auth.md)**: Phase-1 authentication reality, static API keys, and AES-256-GCM provider key cryptography.
- **[13 — Observability & Operations](13-observability-and-ops.md)**: Aggregated KPI statistics, event audit logging, and system health monitoring.

---

## 📈 Part 4: Evolution & Architectural Decision Records (ADRs)
*Tracking how the system evolved from the initial blueprint to its final delivered state.*

- **[14 — Roadmap](14-roadmap.md)**: Prioritized forward-looking backlog for multi-user RBAC, GPU support, and graph engines.
- **[15 — As-Built Deltas vs. Blueprint](15-as-built-deltas.md)**: Explicit reconciliation between initial design specs and implemented reality.
- **[decisions/](decisions/)**: Architectural Decision Records (ADRs 0001 through 0009) explaining technical tradeoffs and design choices.

---

## Complete Numerical Index

| Number | Filename | Topic / Summary |
|---|---|---|
| **00** | [00-handover.md](00-handover.md) | **Master Handover Document (As-Built Reference & API Spec)** |
| **01** | [01-product-vision.md](01-product-vision.md) | Product Vision, Strategy & Core Principles |
| **02** | [02-architecture-overview.md](02-architecture-overview.md) | High-Level Technical Architecture & System Diagram |
| **03** | [03-agent-sdk-contract.md](03-agent-sdk-contract.md) | Agent SDK Wire Protocol & Manifest Contract |
| **04** | [04-workflow-and-job-execution.md](04-workflow-and-job-execution.md) | Workflow Lifecycle & BullMQ Job Execution |
| **05** | [05-database-schema.md](05-database-schema.md) | PostgreSQL Schema & Entity Relationship Diagram |
| **06** | [06-api-surface.md](06-api-surface.md) | HTTP API Design & Endpoint Contracts |
| **07** | [07-agent-implementation-guide.md](07-agent-implementation-guide.md) | Developer Guide: Adding a New AI Agent |
| **08** | [08-agent-video.md](08-agent-video.md) | Video Agent Specification (Deferred Implementation) |
| **09** | [09-agent-sketch.md](09-agent-sketch.md) | Sketch Agent Specification (Reference Implementation) |
| **10** | [10-deployment.md](10-deployment.md) | Deployment, Docker Compose Stack & Nginx Config |
| **11** | [11-testing-strategy.md](11-testing-strategy.md) | Test Suites, Vitest Architecture & CLI Scaffolding |
| **12** | [12-security-and-auth.md](12-security-and-auth.md) | Security Model, API Key Auth & BYOK Encryption |
| **13** | [13-observability-and-ops.md](13-observability-and-ops.md) | Observability, Analytics Aggregation & Event Logging |
| **14** | [14-roadmap.md](14-roadmap.md) | Future Development Roadmap & Backlog Priorities |
| **15** | [15-as-built-deltas.md](15-as-built-deltas.md) | Blueprint vs. Implemented Code Reconciliation |
| **16** | [16-step-by-step-user-guide.md](16-step-by-step-user-guide.md) | **End-User Step-by-Step Usage Guide & Operator Manual** |
| **—** | [decisions/](decisions/) | Architectural Decision Records (ADRs 0001–0009) |
