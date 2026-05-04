# EDEN User Manual — Entering the Matrix

This manual provides the operational knowledge needed to manipulate the EDEN environment and its autonomous agents.

---

## 🏗 Basic Interactions

### Managing Nodes
- **Create**: Use the Prompt Bar (`Ctrl + Space`) or right-click on the surface (if implemented) / use CLI commands.
- **Move**: Left-click and drag any node to reposition it. Position state is saved in real-time.
- **Edit**: Double-click on a node title/content to enter edit mode (if active) or use AI `/mutate`.
- **Ternary State**: Use the state toggles on logic nodes to force `TRUE`, `FALSE`, or `UNKNOWN`.

### Connecting Synapses (Edges)
- **Drag Connection**: Click on a node's output port and drag to another node's input port to create a logical edge.
- **Delete**: Click an edge to select it, then press `Delete` (or use the trash icon).

### Virtual VM Control
- **Toggle VM**: Use the Play/Pause button in the Sidebar to start logic propagation.
- **Visual Feedback**: Nodes will glow or change color based on their Ternary state during execution.

---

## ⌨️ Command Line Interface (CLI)

The Terminal is your primary interface for commanding AI agents.

### Core Commands
- `/local <prompt>`: Single-shot mutation. The AI will analyze your intent and add nodes/edges/files once.
- `/gemini <prompt>`: Same as Local but uses the Gemini model.
- `/clear`: Wipes the terminal history.
- `/help`: Displays basic command syntax.

### Mode Selection
Before running a command, you can set the `AI Mode` in the sidebar or via the Prompt Bar:
- **EDEN**: Optimized for graph mutations with full context.
- **YOLO**: Fully autonomous execution (standard for agents).
- **RAW**: Direct terminal output without graph injection.

---

## 🤖 The Agentic Loop (Autonomous Mode)

The Agentic Loop is EDEN's most powerful feature. It allows the AI to work recursively until an objective is met.

### How to Start
Type `/agent <model> <objective>` in the Terminal.
*Example:* `/agent local Create a full authentication system with three UI nodes, two logic gates, and a README in the VFS.`

### Monitoring the Loop
Once started, the **CLI Panel** (Agentic Tracker) will open:
- **Iteration Count**: Tracks the loop progress.
- **Internal Monologue**: A dedicated section displays the AI's real-time reasoning (*Chain-of-Thought*).
- **Abort Button**: Press the red **STOP** button at any time to halt the autonomous agent.

---

## 📂 File Management

### The File Explorer
Toggle via the Sidebar.
- **Upload**: Drop files or use the upload button to add them to the VFS.
- **Download**: Export specific files from the VFS to your machine.
- **Export Matrix**: Use the "Export JSON" button to save your entire graph and VFS state as a single portable bundle.

---

## 🖱️ Keybindings

| Command | Action |
| :--- | :--- |
| `Ctrl + Space` | Trigger Neural Prompt Bar |
| `F4` | Toggle CLI Panel / Agent Tracker |
| `~` or `Alt+T` | Toggle Terminal visibility |
| `Delete` | Remove selected node/edge |

---

*Verified by Vibecheck v3.1.0*
