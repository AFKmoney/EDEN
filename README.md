# EDEN — The Balanced Ternary OS & Visual Logic IDE

<div align="center">

![EDEN Hero Banner](public/screenshots/eden-ide-overview.svg)

[![Angular](https://img.shields.io/badge/Angular-21.0-DD0031?style=for-the-badge&logo=angular&logoColor=white)](https://angular.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.0-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Ternary Logic](https://img.shields.io/badge/Logic-Balanced_Ternary_(-1,_0,_+1)-06B6D4?style=for-the-badge)](#-the-ternary-virtual-machine)
[![Gemini 2.5](https://img.shields.io/badge/AI_Copilot-Gemini_2.5_&_Local_LLMs-10B981?style=for-the-badge&logo=google-gemini&logoColor=white)](#-ai-copilot--multi-provider-neural-hub)
[![Status](https://img.shields.io/badge/Release-v3.2.0_LTS-blueviolet?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/License-MIT-gray?style=for-the-badge)](LICENSE)

<p align="center">
  <b>A next-generation visual development environment and virtual operating system engineered for balanced ternary logic, autonomous AI copilot loops, real-time signal analysis, and hardware synthesis.</b>
</p>

[Explore Features](#-key-features) • [Circuit Canvas](#-interactive-circuit-canvas) • [Logic Analyzer](#-real-time-oscilloscope--logic-analyzer) • [TASM Studio](#-tasm-studio--hardware-transpiler) • [Quick Start](#-quick-start) • [Shortcuts](#-keyboard-shortcuts)

</div>

---

## 🌌 Overview

**EDEN** (Electrodynamic Discrete Emulation Network) is an integrated development environment built for **balanced ternary computing** (radix-3) and autonomous AI circuit orchestration. 

Traditional binary architectures restrict computation to two discrete states (`0` and `1`). EDEN embraces **balanced ternary** with values **`-1` (FALSE)**, **`0` (UNKNOWN / NEUTRAL)**, and **`+1` (TRUE)**. This mathematical foundation achieves the optimal theoretical **radix economy** ($e \approx 2.718$, with ternary having the lowest hardware component cost among integer radices), enables symmetric arithmetic without sign bits, and provides native representation for uncertainty, tri-state logic, and quantum-adjacent consensus algorithms.

EDEN provides a glassmorphic visual environment where engineers, researchers, and AI agents collaborate in real-time on visual node graphs, assembly routines, and formal proofs.

---

## 🚀 Key Features

### 1. 💠 Interactive Circuit Canvas & Non-Overlap Physics
- **Collision-Free Dragging**: Manipulate nodes with an iterative repulsion physics engine that guarantees zero overlap between components.
- **Independent Node Dragging**: Dragging a component moves only that node, keeping canvas panning strictly isolated to viewport navigation.
- **Dynamic Resizing**: Custom corner resize handles with smooth min/max boundaries (180px to 600px width, 120px to 450px height).
- **Dimension Presets**: Quick-scale buttons for **Compact (230px)**, **Standard (280px)**, **Large (350px)**, and **Maxi HD (440px)**.
- **Adaptive Context Menu**: Right-click any node, wire, or canvas area to toggle ternary states, invert signals, attach oscilloscope probes, auto-layout, or duplicate.

### 2. ⚡ The Ternary Virtual Machine (Kleene Algebra)
- **Three-State Trit Engine**: Every signal and register evaluates across `{-1, 0, +1}`.
- **Complete Gate Library**: Balanced Half-Adders, Full-Adders, Kleene AND (`min`), Kleene OR (`max`), Ternary Inverter (NOT- / `-x`), Consensus Gates, Multiplexers, Tri-flops, and Memory Latches.
- **Visual Signal Propagation**: Live visual pulses flow through directional wires with color-coded states (Cyan = `+1`, Emerald = `0`, Amber/Rose = `-1`).

### 3. 📊 Real-time Oscilloscope & Logic Analyzer
- **4-Channel Digital Waveform Viewer**: Sample and visualize continuous trit state transitions over time.
- **Sampling Rate Controls**: Adjustable clock frequencies from 0.1 Hz to 100 Hz with timescale zoom (10ms to 200ms per division).
- **Signal Probing**: Attach interactive probes directly to any component output pin from the context menu.
- **Waveform Export**: Freeze, rewind, and export CSV timing traces for diagnostic analysis.

### 4. 🔬 Formal Verification & Truth Table Matrix
- **Exhaustive $3^N$ State Evaluation**: Automatically test all permutations ($3^1=3$, $3^2=9$, $3^3=27$, $3^4=81$) for any selected circuit.
- **Kleene Algebraic Proofs**: Verify De Morgan duals, involution laws, and consensus completeness.
- **Counterexample Discovery**: Highlight invalid states or race conditions instantly with automated state badges.

### 5. 🛠 TASM Studio & Hardware Transpiler
- **Ternary Assembly (TASM)**: Write, assemble, and debug ternary machine code targeting balanced trit registers (`T0` through `T7`).
- **Verilog & VHDL Synthesis**: Transpile visual circuit graphs and TASM routines directly into synthesizable Verilog HDL modules.
- **Disassembly View**: Inspect opcodes, instruction pointers, clock cycles, and radix economy factors.

### 6. 🧠 Autonomous AI Copilot & Multi-Provider Hub
- **Chain-of-Thought (CoT) Reasoning**: Inspect the AI's internal technical monologue in real-time as it reasons about circuit topology.
- **Recursive Agentic Loop (`/agent`)**: Launch multi-turn OODA (Observe-Orient-Decide-Act) agents that autonomously synthesize, test, and correct circuits.
- **Multi-Provider Support**: Switch seamlessly between **Google Gemini**, **Local Ollama**, **OpenRouter**, **Anthropic Claude**, and custom inference endpoints.

### 7. 📂 Virtual File System (VFS) & Terminal REPL
- **In-Memory VFS**: Browser-persisted file system with drag-and-drop bundle imports and JSON project exports.
- **Interactive Terminal**: CLI console with commands for kernel control, logic benchmarking, automated routing, and package management.

---

## 📸 Screenshots & Architecture

### Interactive Circuit Canvas

The main visual canvas displays balanced ternary logic components with live trit badges, wire routing, and non-overlapping placement.

<div align="center">
  <img src="public/screenshots/circuit-canvas.svg" alt="EDEN Circuit Canvas" width="100%" referrerpolicy="no-referrer" />
  <p><i>Figure 1: Balanced Ternary Half-Adder connected to Trit Sources with active resize anchors and adaptive context menu.</i></p>
</div>

---

### Real-Time Oscilloscope & Formal Truth Table

Side-by-side view of the multi-channel digital logic analyzer sampling live trit waveforms alongside the formal $3^N$ verification matrix.

<div align="center">
  <img src="public/screenshots/logic-analyzer.svg" alt="EDEN Logic Analyzer & Truth Table" width="100%" referrerpolicy="no-referrer" />
  <p><i>Figure 2: 4-Channel real-time oscilloscope tracking CH1, CH2, and SUM alongside the 9-state exhaustive Kleene proof.</i></p>
</div>

---

### TASM Studio (Ternary Assembly) & Verilog Transpiler

Integrated assembly development environment showing syntax-highlighted TASM code, live trit register banks (`T0`–`T7`), and synthesizable Verilog HDL output.

<div align="center">
  <img src="public/screenshots/tasm-studio.svg" alt="EDEN TASM Studio" width="100%" referrerpolicy="no-referrer" />
  <p><i>Figure 3: TASM assembly editor with register telemetry and instant Verilog hardware synthesis.</i></p>
</div>

---

## ⌨️ Keyboard Shortcuts

EDEN is built for high-speed keyboard productivity:

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| <kbd>Space</kbd> | **Toggle VM** | Run or pause the ternary virtual machine clock |
| <kbd>Ctrl</kbd> + <kbd>K</kbd> | **AI Copilot** | Open the Ternary AI Copilot and reasoning console |
| <kbd>Ctrl</kbd> + <kbd>Space</kbd> | **Prompt Bar** | Trigger quick-command palette for single-shot mutations |
| <kbd>T</kbd> | **Truth Table** | Open the Formal Verification & Truth Table modal |
| <kbd>O</kbd> | **Oscilloscope** | Toggle the Digital Logic Analyzer and waveform viewer |
| <kbd>L</kbd> | **Auto-Layout** | Reorganize all canvas components with zero overlap |
| <kbd>Ctrl</kbd> + <kbd>0</kbd> | **Recenter Canvas** | Reset canvas viewport and zoom to origin (0, 0) |
| <kbd>F4</kbd> | **Terminal REPL** | Toggle the bottom system terminal and agent tracker |
| <kbd>Ctrl</kbd> + <kbd>D</kbd> | **Duplicate** | Duplicate the currently selected node |
| <kbd>Delete</kbd> / <kbd>Backspace</kbd> | **Remove** | Delete the selected node or wire connection |
| <kbd>Escape</kbd> | **Deselect / Close** | Close active modal panels or clear current selection |

---

## 📑 Balanced Ternary Logic Reference

In EDEN, all logic gates evaluate according to **Kleene strong 3-valued logic** and **balanced ternary arithmetic**:

### 1. Gate Truth Tables

#### Kleene AND Gate (`min(A, B)`)
| A \ B | **-1** | **0** | **+1** |
| :---: | :---: | :---: | :---: |
| **-1** | -1 | -1 | -1 |
| **0** | -1 | 0 | 0 |
| **+1** | -1 | 0 | +1 |

#### Kleene OR Gate (`max(A, B)`)
| A \ B | **-1** | **0** | **+1** |
| :---: | :---: | :---: | :---: |
| **-1** | -1 | 0 | +1 |
| **0** | 0 | 0 | +1 |
| **+1** | +1 | +1 | +1 |

#### Balanced Ternary Half-Adder (`A + B`)
| A | B | **SUM** | **CARRY** | Algebraic Equation |
| :---: | :---: | :---: | :---: | :--- |
| -1 | -1 | **+1** | **-1** | $(-1) + (-1) = -2 = (-1 \times 3) + (+1)$ |
| -1 | 0 | **-1** | **0** | $(-1) + (0) = -1 = (0 \times 3) + (-1)$ |
| -1 | +1 | **0** | **0** | $(-1) + (+1) = 0 = (0 \times 3) + (0)$ |
| 0 | -1 | **-1** | **0** | $(0) + (-1) = -1$ |
| 0 | 0 | **0** | **0** | $(0) + (0) = 0$ |
| 0 | +1 | **+1** | **0** | $(0) + (+1) = +1$ |
| +1 | -1 | **0** | **0** | $(+1) + (-1) = 0$ |
| +1 | 0 | **+1** | **0** | $(+1) + (0) = +1$ |
| +1 | +1 | **-1** | **+1** | $(+1) + (+1) = +2 = (+1 \times 3) + (-1)$ |

#### Simple Ternary Inverter (`NOT- / -X`)
| Input ($X$) | Output ($-X$) | Description |
| :---: | :---: | :--- |
| **-1** | **+1** | Negates FALSE to TRUE |
| **0** | **0** | Preserves UNKNOWN neutral state |
| **+1** | **-1** | Negates TRUE to FALSE |

---

## 💻 TASM Assembly Reference

The **TASM** (Ternary Assembly) language controls EDEN's virtual execution unit:

```assembly
; ================================================
; EDEN Kernel: Balanced 3-Trit Adder with Consensus
; ================================================
.arch kleene_core_v3
.trit_width 9

INIT:
    SET3  T0, +1          ; Set Register T0 = TRUE (+1)
    SET3  T1, 0           ; Set Register T1 = UNKNOWN (0)
    SET3  T2, -1          ; Set Register T2 = FALSE (-1)

PROCESS:
    ADD3  T3, T0, T1      ; Balanced sum: (+1) + (0) -> T3 = +1
    CARRY T4, T0, T1      ; Overflow carry: -> T4 = 0
    INV3  T5, T2          ; Negation: -(-1) -> T5 = +1
    CONS  T6, T3, T5      ; Kleene consensus resolution
    OUT3  PORT_ALU, T6    ; Send result to ALU output bus
    HALT                  ; Complete execution cycle
```

### Opcodes Summary
- `SET3 <reg>, <trit>`: Load a balanced trit value (`-1`, `0`, `+1`) into register.
- `ADD3 <dst>, <src1>, <src2>`: Perform balanced ternary addition.
- `CARRY <dst>, <src1>, <src2>`: Compute the ternary arithmetic carry trit.
- `MUL3 <dst>, <src1>, <src2>`: Multiply two ternary registers.
- `INV3 <dst>, <src>`: Compute the symmetric negative ($-x$).
- `CONS <dst>, <src1>, <src2>`: Evaluate Kleene consensus voter.
- `CMP3 <dst>, <src1>, <src2>`: Compare two trits, outputting `-1` ($<$), `0` ($=$), or `+1` ($>$).
- `JMPZ <label>, <reg>`: Jump if register equals `0` (UNKNOWN).
- `OUT3 <port>, <reg>`: Dispatch register value to external output bus.
- `HALT`: Suspend processor execution until next clock cycle.

---

## 🏁 Quick Start

### Prerequisites
- **Node.js**: `20.x` or later (LTS recommended)
- **Package Manager**: `npm`, `pnpm`, or `bun`

### 1. Installation
Clone the repository and install dependencies:

```bash
git clone https://github.com/AFKmoney/EDEN.git
cd EDEN
npm install
```

### 2. Environment Configuration
Create a `.env` file in the root directory (or copy from `.env.example`):

```env
# Google Gemini API Key (Server-Side Proxy)
GEMINI_API_KEY=your_gemini_api_key_here

# Optional: Local LLM Endpoint (e.g. Ollama)
LOCAL_LLM_URL=http://localhost:11434
```

### 3. Launch the Development Server
```bash
npm run dev
```

Open your browser and navigate to **`http://localhost:3000`** to enter the EDEN environment.

### 4. Build for Production
To generate a production-ready build:

```bash
npm run build
npm start
```

---

## 📁 Project Architecture

```
EDEN/
├── public/
│   ├── favicon.ico
│   └── screenshots/               # High-resolution vector documentation assets
│       ├── eden-ide-overview.svg   # Full desktop workspace diagram
│       ├── circuit-canvas.svg      # Circuit editor & non-overlap physics
│       ├── logic-analyzer.svg      # Oscilloscope & formal truth table
│       └── tasm-studio.svg         # TASM assembly & Verilog transpile
├── src/
│   ├── app/
│   │   ├── app.ts                  # Root application component
│   │   ├── app.config.ts           # Client configuration & providers
│   │   ├── app.config.server.ts    # SSR server configuration
│   │   ├── core/
│   │   │   ├── CoreEngine.ts       # Central VM kernel, signals & graph physics
│   │   │   ├── AppUiService.ts     # Modal & drawer visibility state manager
│   │   │   ├── CliUiService.ts     # Terminal & AI chat state manager
│   │   │   ├── EdenAiPipeline.ts   # CoT AI orchestration & agent loops
│   │   │   └── VfsService.ts       # In-memory Virtual File System
│   │   ├── types/
│   │   │   └── index.ts            # Ternary graph, node, edge & trit interfaces
│   │   └── ui/
│   │       ├── SurfaceRenderer.ts  # Canvas renderer, wire routing & drag physics
│   │       ├── Sidebar.ts          # Collapsible glassmorphic navigation bar
│   │       ├── LogicAnalyzerModal.ts # Oscilloscope multi-channel waveform viewer
│   │       ├── TruthTableModal.ts  # Exhaustive 3^N state formal verification
│   │       ├── TasmStudioModal.ts  # Ternary assembly editor & Verilog exporter
│   │       ├── TelemetryHud.ts     # System frequency & trit throughput stats
│   │       ├── ProviderHubPanel.ts # Multi-provider neural model manager
│   │       ├── ComponentPaletteModal.ts # Catalog of ternary gates & circuits
│   │       ├── CircuitLibraryModal.ts   # Pre-built circuit templates
│   │       ├── TerminalPanel.ts    # System terminal REPL console
│   │       └── ChatPanel.ts        # AI Copilot chat & reasoning stream
│   ├── main.ts                     # Client entry point
│   ├── main.server.ts              # SSR bootstrap entry point
│   └── server.ts                   # Express server & secure Gemini API proxy
├── docs/                           # Extended manuals & architectural specs
│   ├── MANUAL.md                   # Detailed user guide
│   ├── DOCUMENTATION.md            # Technical VM specifications
│   └── API.md                      # Backend API endpoint definitions
├── metadata.json                   # Application metadata & platform capabilities
├── package.json                    # Project dependencies & npm scripts
└── README.md                       # Main project documentation
```

---

## 🔒 Security & Sandboxing

EDEN adheres to strict security and architectural best practices:
1. **Server-Side API Keys**: The `GEMINI_API_KEY` is kept strictly within the Express server backend (`/src/server.ts`) and is never leaked to client bundles.
2. **Subprocess Isolation**: External CLI tools and local inference providers run within restricted timeouts (120s max) to prevent denial-of-service hanging.
3. **Input Sanitization**: All terminal commands and AI graph mutations are strictly validated against TypeScript type contracts and JSON schema parsers.
4. **Sandboxed Virtual File System**: The VFS operates entirely in-memory with local storage persistence, preventing arbitrary disk access.

---

## 📜 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

Developed with precision for the **EDEN Kernel & Balanced Ternary Architecture Research Group**.
