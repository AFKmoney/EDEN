# EDEN User Manual — Entering the Matrix

This manual provides the operational knowledge required to master the EDEN environment and its autonomous AI agents. Welcome to the premier Visual AI Graph IDE.

---

## 🏗 Basic Interactions

### Managing Nodes
- **Create**: Use the Prompt Bar (`Ctrl + Space`) to seamlessly inject nodes via AI intent, or use direct CLI commands.
- **Move**: Left-click and drag any node to reposition it. Spatial data is saved in real-time, providing immediate context to the AI.
- **Edit**: Double-click on a node title/content to enter edit mode, or leverage the AI to intelligently mutate contents.
- **Ternary State**: Use the state toggles on logic nodes to force execution states to `TRUE`, `FALSE`, or `UNKNOWN`.

### Connecting Synapses (Edges)
- **Drag Connection**: Click on a node's output port and drag to another node's input port to establish a logical edge.
- **Delete**: Select an edge and press `Delete` to severe the connection.

### Virtual VM Control
- **Toggle VM**: Use the Play/Pause button in the Sidebar to initiate logic propagation across the graph.
- **Visual Feedback**: The glassmorphic UI provides real-time visual feedback—nodes pulse and change color dynamically based on their Ternary state during active execution.

---

## ⌨️ Command Line Interface (CLI)

The System Terminal is your direct conduit to the underlying API-driven AI engines.

### Core Commands
- `/local <prompt>`: Triggers a single-shot mutation utilizing your configured local model (e.g., Ollama). The AI instantly analyzes the graph context and intelligently injects nodes, edges, or files.
- `/gemini <prompt>`: Executes the same single-shot mutation utilizing the high-speed Gemini API.
- `/clear`: Sanitizes the terminal history.

### Mode Selection
Control exactly how the AI processes your prompt by toggling modes in the CLI Panel:
- **YOLO (🔥)**: The default, rapid-execution mode. Bypasses secondary confirmations for pure speed. Highly recommended for the Agentic Loop.
- **EDEN (⚡)**: Highly optimized for graph mutations, enforcing strict structural awareness.
- **PLAN (📋)**: Formulates an architectural plan before attempting execution (Ideal for complex, multi-node requests).
- **RAW (⚙️)**: Direct terminal output mapping with zero graph injection. Best for general queries or debugging.

---

## 🤖 The Agentic Loop (Autonomous Mode)

The Agentic Loop is EDEN's most powerful architectural feature. It transitions the AI from a tool into a fully autonomous colleague that recursively works until complex objectives are achieved.

### Initiation
Type `/agent <model> <objective>` in the Terminal or Prompt Bar.
*Example:* `/agent local Engineer a complete JWT authentication flow with three UI components, validation logic gates, and output a configuration file to the VFS.`

### The Anti-Bad Behaviour Framework
While the Agentic Loop runs, EDEN actively monitors the AI's output. If the model hallucinates an invalid JSON structure or attempts an impossible graph mutation, the execution does not crash. Instead, EDEN intercepts the failure, generates a strict error report, and feeds it back to the AI on the next iteration, forcing rapid, autonomous self-correction.

### Monitoring the Loop
Upon initiation, the **CLI Panel** opens the Agentic Tracker:
- **Iteration Tracking**: Visually monitors progress against the maximum allowed iterations.
- **Chain-of-Thought Monologue**: A dedicated UI section exposes the AI's internal reasoning, allowing you to watch it "think" in real-time.
- **Emergency Halt**: Press the red **STOP** button at any time to instantly sever the loop and regain manual control.

---

## 📂 File Management

### The Virtual File System (VFS)
Toggle the File Explorer via the Sidebar to access the high-performance, in-memory VFS.
- **Token Optimization**: EDEN's VFS intelligently truncates large files before injecting them into the AI context, drastically reducing token consumption while maintaining complete architectural awareness.
- **Upload**: Drop files or use the upload button to ingest them into the matrix.
- **Export Matrix**: Use the "Export JSON" feature to bundle your entire graph, logic state, and VFS into a single, portable configuration file.

---

## 🖱️ Keybindings

| Command | Action |
| :--- | :--- |
| `Ctrl + Space` | Trigger Neural Prompt Bar |
| `F4` | Toggle CLI Panel & Agent Tracker |
| `~` or `Alt+T` | Toggle Terminal visibility |
| `Delete` | Remove selected node or edge |

---

*Verified by ZMSFA Core v4.0.0*