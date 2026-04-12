# EDEN — Visual AI Graph IDE

Welcome to **EDEN**, the nexus of graphical programming and autonomous AI pipeline integration. EDEN is a Visual Graph IDE running on a Ternary Virtual Machine (Kleene logic) and deeply integrated with `qwen` and `gemini` CLIs to allow for complete autonomous generation.

## 🚀 Key Features

*   **Ternary Virtual Machine:** Execute logic based on TRUE, FALSE, and UNKNOWN values natively mapped to the UI.
*   **VFS (Virtual File System):** In-memory file storage allowing for full file uploads, downloads, exporting entirely as a JSON bundle, and drag-and-drop support.
*   **AI Integration (Qwen & Gemini):** Deep integration allowing models to completely write components, alter the UI, read from VFS, and manage edges and nodes directly via JSON mapping.
*   **Server-Side Execution & Hardening:** Includes a full SSR Node.js configuration to manage CLI sub-processes effectively without fear of injection, complete with SSE streaming capabilities.
*   **YOLO Mode:** Fully autonomous. The AI will make real-time decisions without waiting for confirmation.
*   **Glassmorphism Neon UI** Built with advanced Angular and pure CSS motion effects.

---

## 💻 Tech Stack

- **Angular 21 (SSR)**
- **Tailwind CSS v4** + Neon CSS Variables
- **Express Backend** `/api/cli`
- Node.js `child_process.spawn` for CLI Integration

---

## 🛠 Usage & Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Boot the Nexus
```bash
npm run dev
```

### 3. Open your browser
Go to `http://localhost:3000` to dive into the OS. 

From here, press `Ctrl+Space` to inject an intent or interact with the Terminal manually.

### 4. Running the CLIs

You can call the Qwen or Gemini agentic engines from the Terminal natively:
```bash
/qwen create a new node and connect it to a data node
/gemini analyze the current layout
```

---

## 🔒 Security Audit & Updates (v3.0.0)
EDEN has recently undergone a comprehensive architecture overhaul and audit:
1. Replaced vulnerable `npx` logic with direct `spawn` capabilities mapping natively to globally installed `qwen`/`gemini` tools.
2. Added comprehensive `setTimeout` killers at the backend level.
3. Isolated OS arguments from shell manipulation.
4. Added real-time SSE endpoints at `/api/cli/stream` for raw output viewing.
5. Allowed deep VFS sync so AI handles the backend files without affecting the OS itself.

---

**Developed for the ZMSFA Core**
