## EDEN 1.0.0 — Kleene kernel

Snapshot of `main` after the 2026-09-19 code audit.
Docs and version badge now match `package.json` **1.0.0** (the old “v3.2.0 LTS” label is retired).

Previous public tag: `v0.1.1` (2026-05-02, empty notes).

### In this release

- Balanced ternary canvas VM (`CoreEngine`) — Kleene AND/OR/NOT, XOR mod-3, CONSENSUS, MUX, LATCH, CLOCK, ADDER/FULLADDER, synthesizers (half-adder, ALU, neuron, RAM word, LFSR, …)
- TASM compiler dialect that actually parses: `INPUT` / `GATE` / `PROBE` + decompile + dual-rail Verilog (AND/OR/NOT)
- 3^N truth table (cap 3 inputs) and oscilloscope UI
- AI copilot via EDEN API (`/api/cli`, `/api/cli/stream`) — provider-agnostic; local synthesizer fallback without a network
- API process `:4000` — auth, agents, templates, webhooks; `executeAgent` server VM with Jest AND/OR/NOT tests
- README + TIMELINE rewritten to the code; vendor-specific Gemini branding removed from public docs

### Two processes

| Command | Port | Role |
|---|---|---|
| `npm run dev` | 3000 | Angular SSR + canvas + AI proxy |
| `npm run server` | 4000 | Mongo/Redis API + ternary execute |

### Known gaps (see TIMELINE.md)

- Three gate evaluators not yet unified (CoreEngine / TruthTable / AgentService)
- No `SET3`/`ADD3` parser (README documents INPUT/GATE/PROBE only)
- Verilog XOR incomplete; C++ emit is a stub
- `/api/cli` still defaults `tool` to `gemini` in `src/server.ts`
- Missing root `LICENSE` file
- No unit tests on `CoreEngine` itself

Full audit: https://github.com/AFKmoney/EDEN/blob/main/TIMELINE.md
