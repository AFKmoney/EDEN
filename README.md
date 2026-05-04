# EDEN — The Visual AI Graph IDE

![EDEN Banner](https://img.shields.io/badge/EDEN-Matrix-blueviolet?style=for-the-badge&logo=matrix)
![Angular 21](https://img.shields.io/badge/Angular-21+-DD0031?style=for-the-badge&logo=angular)
![Express](https://img.shields.io/badge/Express-Backend-000000?style=for-the-badge&logo=express)
![Status](https://img.shields.io/badge/Status-Hardened_v4.0.0-green?style=for-the-badge)

Welcome to **EDEN**, a next-generation Visual Graph IDE designed for autonomous AI pipeline integration and logic orchestration. EDEN runs on a custom **Ternary Virtual Machine** (Kleene logic) and provides a premium, glassmorphic environment where humans and AI agents collaborate in real-time.

![EDEN CLI Framework Interface Placeholder](docs/assets/cli_interface_placeholder.png)
*(Screenshot: The beautiful, glassmorphic EDEN UI featuring the AI CLI Framework and Agent Tracker)*

---

## 🚀 The AI Engine Architecture (v4.0.0 Update)

EDEN has been completely refactored to eliminate clunky, insecure CLI-tool dependencies. It now features a pure, high-performance API integration layer, delivering unparalleled speed, security, and developer experience.

### 🧠 Native API Integration
- **Local Models First:** EDEN seamlessly connects to any OpenAI-compatible local endpoint (e.g., Ollama running `qwen2.5-coder` on `http://127.0.0.1:11434`), ensuring complete data privacy and zero API costs for massive reasoning loops.
- **Gemini Native SDK:** Fully integrated with the official `@google/genai` SDK for blazing-fast, server-side stream resolution.

### 🛡️ Anti-Bad Behaviour Framework
Agents occasionally hallucinate or output malformed data. EDEN's proprietary **Anti-Bad Behaviour Framework** acts as an immune system during the Agentic Loop. If an AI generates invalid JSON or attempts an illegal graph mutation, the execution is instantly caught, parsed, and the exact error is injected back into the AI's context. This forces the model into immediate self-correction without user intervention.

### 💸 Token Cost Optimization Engine
The Virtual File System (VFS) context builder now dynamically analyzes and truncates large payloads before transmission. By sending optimized file headers and truncated bodies, EDEN slashes API token usage by up to 80% without sacrificing the agent's spatial awareness of the codebase.

---

## 🛠 Core Features

### 🔄 The Agentic Loop (CoT)
Harness the power of Local Models and Gemini in full autonomy. The **Agentic Loop** allows models to evaluate the current state, reason about their next moves (via a dedicated Chain-of-Thought UI module), and execute mutations on the graph or the VFS recursively until the objective is achieved.

### 💠 Ternary Virtual Machine
Beyond Binary. EDEN implements a **Ternary VM** executing logic across `TRUE`, `FALSE`, and `UNKNOWN` states. Design complex logic gates (AND, OR, NOT) that handle uncertainty natively.

### 🎨 Glassmorphism Neon UI
Built with **Angular 21** and **Tailwind CSS v4**, EDEN offers a stunning, professional-grade interface. Featuring deep backdrop blurs, reactive neon pulses that trigger on AI execution, and gradient typography, it is undeniably one of the most beautiful development environments created.

---

## 🏁 Quick Start

### 1. Installation
```bash
# Clone the nexus
git clone https://github.com/AFKmoney/EDEN.git
cd EDEN

# Install neural dependencies
npm install
```

### 2. Ignition
```bash
# Export API keys if using Gemini
export GEMINI_API_KEY="your-api-key"

# Start the engine
npm run dev
```
Navigate to `http://localhost:3000` to enter the EDEN Matrix.

### 3. Basic Commands
- `Ctrl + Space`: Open prompt bar.
- `F4`: Toggle CLI Panel / Agent Tracker.
- `/local <intent>`: Trigger a single-shot mutation using your local engine.
- `/agent local <objective>`: Launch an autonomous agentic loop.

---

## 📚 Documentation & Manual

- 📖 **[User Manual](docs/MANUAL.md)**: Master the interface and commands.

---

## 🔒 Security Audit (v4.0.0)
EDEN is hardened for autonomous operations:
1. **Zero Shell Execution**: Legacy spawn/exec CLI wrappers have been completely removed, nullifying command-injection vectors.
2. **Strict API Boundaries**: Frontend-to-backend communication flows through tightly validated proxy endpoints.
3. **Type-Safe Core**: Refined TypeScript architecture with rigorous linting coverage.

*Developed for the ZMSFA Core*