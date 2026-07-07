# 16 — End-User Step-by-Step Usage Guide

Welcome to **Agentry**, an AI Agent Platform that allows you to run, manage, and chain specialized AI agents behind a single, cohesive interface. Instead of switching between dozens of standalone AI tools, Agentry gives you a unified workspace for BYOK (Bring Your Own Key) model management, single-step execution, real-time streaming progress, visual workflow template chaining, and centralized artifact storage.

This guide will walk you through using the platform end-to-end as an end user or workspace operator.

---

## Table of Contents
1. [Accessing the Workspace & Basic Navigation](#1-accessing-the-workspace--basic-navigation)
2. [Configuring AI Model Providers (BYOK)](#2-configuring-ai-model-providers-byok)
3. [Exploring the Agent Marketplace](#3-exploring-the-agent-marketplace)
4. [Creating Projects & Organizing Workflows](#4-creating-projects--organizing-workflows)
5. [Running Single-Step Agents & Monitoring Live Execution](#5-running-single-step-agents--monitoring-live-execution)
6. [Chaining Multi-Agent Pipelines in the Visual Template Builder](#6-chaining-multi-agent-pipelines-in-the-visual-template-builder)
7. [Managing System Prompts & Customizing Rules](#7-managing-system-prompts--customizing-rules)
8. [Monitoring Spend in the AI Cost Monitor & Analytics Dashboard](#8-monitoring-spend-in-the-ai-cost-monitor--analytics-dashboard)
9. [Browsing the Generated Media Gallery (Artifacts Explorer)](#9-browsing-the-generated-media-gallery-artifacts-explorer)

---

## 1. Accessing the Workspace & Basic Navigation

When you first launch Agentry in your browser (default local URL: `http://localhost:5173`), you will be greeted by the application shell.

### The Navigation Sidebar
On the left side of the screen, the navigation sidebar gives you one-click access to all platform capabilities:
- **Projects (`/projects`)**: The primary organization container for your AI generations and workflow runs.
- **Workflows (`/workflows`)**: A cross-project execution directory showing recent job activity, status, and duration.
- **Agents (`/agents`)**: The marketplace catalog of all installed and registered AI capabilities.
- **Providers (`/providers`)**: Secure configuration vault for your AI model API keys (OpenAI, Stability AI, Anthropic).
- **Prompts (`/prompts`)**: Reusable system instruction library for standardizing agent behaviors.
- **Analytics (`/analytics`)**: Executive KPI overview, queue latency gauges, and system health status.
- **Artifacts (`/artifacts`)**: Centralized media gallery displaying all images, JSON files, and downloads generated across all workspaces.
- **Cost Monitor (`/costs`)**: Detailed breakdown of token usage and financial cost by provider and model.
- **Team (`/team`)**: Invite workspace members and assign role-based permissions.
- **Settings (`/settings`)**: Global and project-scoped system parameter overrides.

> **💡 Pro Tip — Global Command Palette**: Press **`Cmd + K`** (macOS) or **`Ctrl + K`** (Windows/Linux) from any page to open the command palette. Type the name of any project, agent, or setting to jump directly to it in milliseconds!

---

## 2. Configuring AI Model Providers (BYOK)

Agentry operates on a **BYOK (Bring Your Own Key)** model. You retain total ownership of your API credentials. Before running cloud-based agents, you should configure your preferred model providers.

### Step-by-Step Provider Setup:
1. Navigate to **Providers** (`/providers`) from the sidebar.
2. Select the capability you wish to configure from the top tab bar (e.g., `image-generation` or `text-generation`).
   - *Note*: A default `sd_turbo_local` provider is pre-installed for free, CPU-based text-to-image generation that requires no API key.
3. Click the **"+ Add Provider"** button.
4. Fill in the provider configuration form:
   - **Provider Type**: Select the provider (e.g., `Stability AI`, `OpenAI Compatible`, `Anthropic`).
   - **Display Name**: Give your key an identifiable name (e.g., *"Prod Stability Ultra"*).
   - **Auth Mode**: Choose between `API Key` or `Bearer Token`.
   - **Secret Key**: Paste your API key. Once saved, your key is immediately encrypted at rest using military-grade **AES-256-GCM** authenticated encryption. It is never displayed in plain text again.
   - **Scope**: Choose **Global Default** (used across all projects) or attach it to a **Specific Project** to override the global default for that workspace.
5. Click **Save Provider**. You can click **"Make Default"** on any card to set it as the active engine for that capability.

---

## 3. Exploring the Agent Marketplace

Whenever a developer adds a new agent worker to the server, Agentry automatically discovers its capabilities and registers it in the marketplace.

### How to Explore Agents:
1. Navigate to **Agents** (`/agents`) to view the catalog of available agents.
2. Each card displays key metadata: the agent name, version, required capabilities (e.g., `image-generation`), estimated cost per run, and average latency.
3. Click on any agent card (e.g., **Sketch Agent**) to open its specification page (`/agents/sketch-agent`).
4. On the detail page, you can review:
   - **Overview & Documentation**: Instructions and best practices for prompting the agent.
   - **Input Schema**: The exact parameters accepted (e.g., `prompt`, `negative_prompt`, `steps`, `seed`).
   - **Output Schema**: What the agent generates (e.g., `image_url`, `width`, `height`, `seed_used`).
   - **Version History**: Track improvements and pin workflows to specific agent versions.

---

## 4. Creating Projects & Organizing Workflows

Projects act as collaborative workspaces where you group related experiments, template runs, and generated media.

### Step-by-Step Project Setup:
1. Click **Projects** (`/projects`) in the sidebar.
2. Click **"+ New Project"** in the top right corner.
3. Enter a descriptive title (e.g., *"Q3 Marketing Campaign Assets"*) and an optional description.
4. Click **Create Project**.
5. Once inside your project workspace, you will see tabs for its specific **Workflows**, **Templates**, **Artifacts**, and **Settings**.

---

## 5. Running Single-Step Agents & Monitoring Live Execution

You can run an AI agent directly from within any project workspace or from the agent's catalog page.

### Launching an Agent:
1. From inside your Project, click **"+ Run Agent"** and select an agent (e.g., **Sketch Agent**), or click **"Run Agent"** directly on the `/agents/sketch-agent` page.
2. You will be presented with a dynamic submission form generated automatically from the agent's JSON Schema:
   - **Prompt**: Enter your creative description (e.g., *"A futuristic cyberpunk city at sunset with glowing neon signs, photorealistic, 8k"*).
   - **Negative Prompt**: Enter elements to avoid (e.g., *"blurry, low quality, distorted"*).
   - **Inference Steps**: Adjust the slider for quality vs. speed (default: `2` for SD-Turbo).
   - **Seed**: Enter a number for reproducible generations, or leave at `0` for random.
3. *(Optional)* **Provider Selection**: Use the provider dropdown at the bottom of the form to switch between your local CPU engine (`sd_turbo_local`) and cloud APIs (`Stability AI`) on the fly.
4. Click **Submit Workflow**.

### Live Execution Tracking:
As soon as you submit, you will be taken to the live execution view:
- **Step Timeline**: Watch visual status indicators transition from `Queued` ➔ `Running` ➔ `Completed`.
- **Live Activity Feed**: Agentry streams real-time log events via **Server-Sent Events (SSE)** directly from the background Python worker to your browser. You can watch step-by-step progress bars and worker heartbeat diagnostics without refreshing the page.
- **Immediate Artifact Preview**: As soon as the worker completes, the generated image appears in the media preview pane. You can zoom in, inspect metadata, or click **Download Artifact** to save the checksummed PNG to your computer.

---

## 6. Chaining Multi-Agent Pipelines in the Visual Template Builder

For complex tasks, you can chain multiple AI agents together into sequential pipelines called **Workflow Templates**.

### Building a Template:
1. Navigate to **Templates** inside your project and click **"+ Create Template"**, or go to `/builder` from the command palette.
2. Give your template a title (e.g., *"Concept Art Generation Pipeline"*).
3. **Add Steps to the Canvas**:
   - Click **"+ Add Step"** and select your first agent (e.g., **Sketch Agent** - *Step 1: Base Sketch*).
   - Click **"+ Add Step"** again to add a subsequent agent (e.g., a refining or upscaling step - *Step 2: Refiner*).
4. **Using the Step Mapping Studio**:
   - For Step 1, set the inputs as normal or mark them as dynamic user variables (`{{run.input.prompt}}`).
   - For Step 2, open the **Step Mapping Panel**. Instead of typing static text, you can wire outputs from earlier steps directly into downstream inputs!
   - Example: Select `From Previous Step Output` ➔ set Target Step to `Step 1 (Sketch Agent)` ➔ select artifact field `image_url`. The platform performs strict schema validation to ensure the data types match before allowing you to save.
5. Click **Save Template**.

### Running a Template:
1. Open your saved template and click **"Run Template"**.
2. Enter the runtime prompts requested by the pipeline.
3. Watch the sequential execution studio as Step 1 runs to completion, automatically passes its generated artifact to Step 2, and produces the finalized output!

---

## 7. Managing System Prompts & Customizing Rules

If your team uses standard style guides or brand voice instructions, you can manage them centrally in the Prompt Library.

1. Navigate to **Prompts** (`/prompts`).
2. Click **"+ New Prompt Template"**.
3. Select the target agent and assign a prompt key (e.g., `brand_default_negative`).
4. Enter the standardized text (e.g., *"watermark, text, signature, ugly, bad anatomy"*).
5. When users run agents, they can pick from these pre-approved prompt templates with a single click, ensuring consistent quality across the team.

---

## 8. Monitoring Spend in the AI Cost Monitor & Analytics Dashboard

Agentry provides built-in financial and operational observability so you never get surprised by cloud API bills.

- **AI Cost Monitor (`/costs`)**: View detailed financial rollups. See your total estimated spend, token usage, and cost-per-job breakdowns filtered by provider (e.g., comparing local free generations vs. Stability AI paid calls). You can edit cost rates per call directly in the pricing editor table.
- **Analytics Dashboard (`/analytics`)**: View real-time executive KPI cards:
  - Total jobs processed over 24h, 7d, and 30d windows.
  - Overall platform success rate and average queue wait times.
  - **System Health Panel**: Real-time diagnostic indicators showing live ping latencies for PostgreSQL, Redis job queues, and active Python worker workers.

---

## 9. Browsing the Generated Media Gallery (Artifacts Explorer)

Every artifact generated across every workflow in your workspace is permanently indexed and saved.

1. Click **Artifacts** (`/artifacts`) in the sidebar.
2. Browse the visual grid of generated images and JSON outputs across all projects.
3. Filter by **Kind** (e.g., `image/png`, `application/json`), by **Project**, or by **Date**.
4. Click any card to open the lightroom inspector: view the exact generation seed, prompt used, execution duration, and download the original file with sha256 checksum verification.

---

## Summary Checklist for New Users
- [ ] Log in and explore the left navigation sidebar.
- [ ] Press **`Cmd + K`** / **`Ctrl + K`** to test the global command palette.
- [ ] Visit **Providers** (`/providers`) to ensure your AI model keys are configured.
- [ ] Create a new Project workspace in **Projects** (`/projects`).
- [ ] Submit a test generation using **Sketch Agent** and watch the live SSE streaming progress!
