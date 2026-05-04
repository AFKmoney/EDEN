# EDEN — The Visual AI Graph IDE

![EDEN Banner](https://img.shields.io/badge/EDEN-Matrix-blueviolet?style=for-the-badge&logo=matrix)
![Angular 21](https://img.shields.io/badge/Angular-21+-DD0031?style=for-the-badge&logo=angular)
![Express](https://img.shields.io/badge/Express-Backend-000000?style=for-the-badge&logo=express)
![Status](https://img.shields.io/badge/Status-Hardened_v3.1.0-green?style=for-the-badge)

Welcome to **EDEN**, a next-generation Visual Graph IDE designed for autonomous AI pipeline integration and logic orchestration. EDEN runs on a custom **Ternary Virtual Machine** (Kleene logic) and provides a premium, glassmorphic environment where humans and AI agents collaborate in real-time.

---

## 🚀 Key Features

### 🧠 Autonomous Agentic Loop (CoT)
Harness the power of `Local` and `Gemini` in full autonomy. The **Agentic Loop** allows models to evaluate the current state, reason about their next moves (via built-in Chain-of-Thought), and execute mutations on the graph or the file system recursively.

### 💠 Ternary Virtual Machine
Beyond Binary. EDEN implements a **Ternary VM** executing logic across `TRUE`, `FALSE`, and `UNKNOWN` states. Design complex logic gates (AND, OR, NOT) that handle uncertainty natively.

### 📂 Virtual File System (VFS)
A high-performance, in-memory file system with full persistence.
- Drag-and-drop file support.
- JSON bundle export/import.
- AI-driven file manipulation.

### 🎨 Glassmorphism Neon UI
Built with **Angular 21** and **Tailwind CSS v4**, EDEN offers a stunning, professional-grade interface with advanced motion effects, glass textures, and real-time visual feedback for AI reasoning.

---

## 🛠 Tech Stack

- **Frontend**: Angular 21 (Standalone Components, SSR), RxJS, Signals.
- **Styling**: Vanilla CSS + Tailwind CSS v4 (Neon Variables).
- **Backend**: Node.js / Express (Process hardening, SSE streaming).
- **Agents**: Integrated `local` and `gemini` CLI tools.

---

## 🏁 Quick Start

### 1. Installation
```bash
# Clone the nexus
git clone https://github.com/AFKmoney/EDEN.git
cd EDEN/EDEN

# Install neural dependencies
npm install
```

### 2. Ignition
```bash
# Start the engine
npm run dev
```
Navigate to `http://localhost:3000` to enter the EDEN Matrix.

### 3. Basic Commands
- `Ctrl + Space`: Open prompt bar.
- `F4`: Toggle CLI Panel / Agent Tracker.
- `/local <intent>`: Trigger a single-shot mutation.
- `/agent local <objective>`: Launch an autonomous agentic loop.

---

## 📚 Documentation & Manual

- 📖 **[User Manual](docs/MANUAL.md)**: Master the interface and commands.
- ⚙️ **[Technical Documentation](docs/DOCUMENTATION.md)**: Deep dive into the architecture and VM logic.

---

## 🔒 Security Audit (v3.1.0)
EDEN is hardened for autonomous operations:
1. **Isolated Execution**: All CLI tools run in hardened sub-processes with 120s timeout killers.
2. **Sanitized Inputs**: Zero-injection risk via strict argument mapping.
3. **Type-Safe Core**: Refined TypeScript architecture with "Zero-Error" linting coverage.

*Developed for the ZMSFA Core*
