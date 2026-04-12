# EDEN Technical Documentation

## 🏗 Architecture Overview

EDEN is a full-stack Node.js and Angular application built for high-performance visual logic editing and autonomous AI agent execution.

### Tech Stack Breakdown
- **Frontend**: Angular 21 (Standalone Components, SSR)
- **State Management**: Angular Signals (Centralized via `CoreEngine` and `AppUiService`)
- **Visuals**: Tailwind CSS v4 + Global Neon CSS Tokens
- **Backend**: Node.js + Express
- **Persistence**: Virtual File System (VFS) with `localStorage` sync.

---

## 💠 The Ternary Virtual Machine (Kleene Logic)

At the heart of EDEN is a virtual machine based on **Ternary Logic**. Unlike binary systems, every variable in EDEN can exist in one of three states:
- **TRUE** (1)
- **FALSE** (-1) 
- **UNKNOWN** (0)

### VM Execution Loop
The `CoreEngine` runs a visual tick (default 1.5s) that propagates states through edges. 
1. **Input Gathering**: Nodes collect ternary states from their incoming edges.
2. **Logic Evaluation**: Based on the `gateType` (AND, OR, NOT), the node evaluates its next state using Kleene logic tables.
3. **State Mutation**: The engine batches updates and triggers a visual ripple effect across the graph.

---

## 📂 Virtual File System (VFS)

The VFS provides a unified interface for file operations that are "shadowed" from the actual server file system for security.
- **Service**: `VfsService` manages an in-memory `Record<string, VfsFile>`.
- **Sync**: Persistent across reloads via browser `localStorage`.
- **AI Access**: The AI can read/write files directly into the VFS via the Pipeline JSON protocol.

---

## 🧠 AI Pipeline & Agentic Loop

The `EdenAiPipelineService` is a robust orchestration layer that handles communication between the UI and server-side CLI tools.

### Mutation Sync Protocol
When the AI generates a response, it is expected to return a strictly formatted JSON block:
```json
{
  "nodes": [...],
  "edges": [...],
  "files": [...],
  "reasoning": "Internal thought process..."
}
```
The pipeline parses this and executes a **batched mutation** on the graph and VFS simultaneously.

### Agentic Loop (Autonomous Evaluation)
The loop follows an **Observe-Orient-Decide-Act (OODA)** cycle:
1. **Observe**: The script builds a full context string representing nodes, edges, file contents, and ternary states.
2. **Orient**: The AI evaluates the current state against its "Objective".
3. **Decide**: The AI determines the next mutation required (or signals `completed: true`).
4. **Act**: The pipeline injects the mutation and triggers the next iteration until completion or iteration limit.

---

## 🔒 Security Hardening

- **CLI Isolation**: AI processes run via `child_process.spawn` with zero shell interpolation risk.
- **Process Killing**: Built-in 120s timeouts in `server.ts` prevent runaway AI loops from consuming server resources.
- **Sub-process Sanitization**: Mode mapping (`eden`, `raw`, `plan`, `yolo`) ensures only approved arguments are passed to the binaries.

---

*Verified by Vibecheck v3.1.0*
