import { Injectable, inject, signal } from '@angular/core';
import { CoreEngine, clampNodePosition } from './CoreEngine';
import { VfsService } from './VfsService';
import { TerminalService } from './TerminalService';
import { CliService } from './CliService';
import { AppUiService } from './AppUiService';
import { TasmCompilerService } from './TasmCompilerService';
import { TruthTableService } from './TruthTableService';
import { TernaryAudioService } from './TernaryAudioService';
import { AiProvider, AI_PROVIDERS } from '../types/provider';
import { LogicGateType, TernaryValue } from '../types/node';

export type AiMode = 'eden' | 'raw' | 'plan' | 'yolo';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  provider?: string;
  model?: string;
  text: string;
  reasoning?: string;
  timestamp: number;
  executedActions?: string[];
  nodesMutated?: number;
  edgesMutated?: number;
  filesMutated?: number;
  isStreaming?: boolean;
}

export interface AgentMemory {
  objective: string;
  iterations: number;
  completedActions: string[];
  failedActions: string[];
  currentPlan: string[];
  contextSummary: string;
  timestamp: number;
}

export interface AgentPlan {
  steps: string[];
  currentStepIndex: number;
  completedSteps: boolean[];
}

/**
 * EdenAiPipelineService — Centralized AI pipeline & Autonomous OS Controller.
 * 
 * Provides deep bidirectional control over the Ternary OS IDE:
 * - Mutates logic gates, ternary states, and circuit topologies
 * - Starts, stops, steps, and modulates the Ternary Virtual Machine
 * - Synthesizes full balanced ternary circuits (Adders, Oscillators, Benches)
 * - Manages chat dialogue, autonomous agentic loops, and UI views
 */
@Injectable({ providedIn: 'root' })
export class EdenAiPipelineService {
  private engine = inject(CoreEngine);
  private vfs = inject(VfsService);
  private terminal = inject(TerminalService);
  private cli = inject(CliService);
  private appUi = inject(AppUiService);
  public tasm = inject(TasmCompilerService);
  public truthTable = inject(TruthTableService);
  public audio = inject(TernaryAudioService);

  /** Active AI provider. Defaults to NVIDIA NIM flagship */
  public activeProvider = signal<AiProvider>('nvidia');

  /** Active model ID for the selected provider */
  public activeModel = signal<string>('meta/llama-3.1-70b-instruct');

  /** Current AI execution mode. YOLO by default. */
  public mode = signal<AiMode>('yolo');

  /** Whether a standard AI execution is in progress */
  public isExecuting = signal<boolean>(false);

  /** Chat message stream for the interactive OS Co-pilot */
  public chatMessages = signal<ChatMessage[]>([
    {
      id: 'msg_welcome',
      sender: 'assistant',
      provider: 'eden-os',
      model: 'Ternary OS Copilot v3.0',
      text: "Welcome to EDEN Ternary Development OS. I have full autonomous control over the node graph, balanced ternary logic gates (-1, 0, +1), the Ternary VM, and interface modules.\n\nTry asking me:\n- *\"Synthesize a balanced ternary Half-Adder circuit\"*\n- *\"Create a 3-stage odd ring oscillator and start the VM\"*\n- *\"Set up a CONSENSUS gate with two oscilloscope probes\"*\n- *\"Force all input trits to +1 and trigger auto-layout\"*",
      timestamp: Date.now(),
      executedActions: ['EDEN_KERNEL_READY', 'VM_READY', 'ZERO_OVERLAP_ACTIVE']
    }
  ]);

  // --- AGENTIC LOOP STATE ---
  public isAgenticLoopActive = signal<boolean>(false);
  public currentObjective = signal<string>('');
  public agenticIteration = signal<number>(0);
  public maxAgenticIterations = signal<number>(20);
  public currentReasoning = signal<string>('');
  
  // Agent Memory & Planning
  public agentMemory = signal<AgentMemory>({
    objective: '',
    iterations: 0,
    completedActions: [],
    failedActions: [],
    currentPlan: [],
    contextSummary: '',
    timestamp: Date.now()
  });

  public agentPlan = signal<AgentPlan>({
    steps: [],
    currentStepIndex: 0,
    completedSteps: []
  });
  
  private abortRequested = false;

  public setProvider(provider: AiProvider, model?: string) {
    this.activeProvider.set(provider);
    const config = AI_PROVIDERS[provider];
    if (config) {
      this.activeModel.set(model || config.defaultModel);
      this.terminal.log(`[AI HUB] Switched provider to ${config.name} (${this.activeModel()})`, 'SYSTEM');
    }
  }

  public setModel(model: string) {
    this.activeModel.set(model);
    this.terminal.log(`[AI HUB] Active model set to ${model}`, 'SYSTEM');
  }

  /**
   * Build the full EDEN context string for AI prompts with complete Ternary OS capabilities.
   */
  buildEdenContext(): string {
    const genome = this.engine.genome();
    const nodeCount = Object.keys(genome.nodes).length;
    const edgeCount = Object.keys(genome.edges).length;
    const vmRunning = this.engine.isVmRunning();
    const vmSpeed = this.engine.vmSpeed();
    const tritStats = this.engine.tritStats();
    const files = this.vfs.listFiles();

    const nodesCompact = Object.values(genome.nodes).map((n: any) => ({
      id: n.id,
      type: n.type,
      title: n.metadata?.title,
      ternary: n.ternaryState,
      gate: n.metadata?.gateType,
      pos: n.position
    }));

    const edgesCompact = Object.values(genome.edges).map((e: any) => ({
      id: e.id,
      src: e.sourceId,
      tgt: e.targetId
    }));

    const filesCompact = files.map(f => ({
      path: f.path,
      size: f.content.length,
      content: f.content.length > 300 ? f.content.substring(0, 300) + '...[TRUNCATED]' : f.content
    }));

    return `You are the EDEN TERNARY OS CO-PILOT with ABSOLUTE DIRECT CONTROL over the entire Ternary IDE and OS runtime.

OS STATUS:
- Virtual Machine: ${vmRunning ? 'RUNNING (ACTIVE TICK)' : 'STOPPED (PAUSED)'} (Clock Speed: ${vmSpeed}ms)
- Node Count: ${nodeCount} | Edge Count: ${edgeCount}
- Trit Distribution: True (+1): ${tritStats.trueCount} | Neutral (0): ${tritStats.unknownCount} | False (-1): ${tritStats.falseCount}
- Entropy: ${(tritStats.entropy * 100).toFixed(1)}%
- VFS Files: ${files.length} files

AVAILABLE TERNARY LOGIC GATES:
- 'AND' (Kleene Min: min(A, B))
- 'OR' (Kleene Max: max(A, B))
- 'NOT' (Inversion: -A, +1->-1, 0->0, -1->+1)
- 'XOR' (Balanced Modulo Sum: (A+B) mod 3 in {-1, 0, 1})
- 'CONSENSUS' (Equivalence: matches if all inputs equal, else 0)
- 'MUX' (Ternary Multiplexer: selector trit routes inputs)
- 'LATCH' (Trit Memory Register: stores trit state on clock signal)
- 'CLOCK' (Autonomous oscillator: cycles -1 -> 0 -> 1 -> -1)
- 'ADDER' (Balanced Half/Full Adder: calculates sum & carry trits)
- 'PROBE' (Oscilloscope trace probe: samples and graphs live signals)
- 'CONSTANT' (Trit Signal Source)

CURRENT GRAPH NODES: ${JSON.stringify(nodesCompact)}
CURRENT GRAPH EDGES: ${JSON.stringify(edgesCompact)}
VFS FILES: ${JSON.stringify(filesCompact)}

YOU HAVE FULL PRIVILEGED CONTROL. When asked to create, mutate, wire, run, or adjust the system, respond with a JSON block enclosed in \`\`\`json ... \`\`\`.
Format strictly as:
\`\`\`json
{
  "osActions": [
    { "action": "startVM" },
    { "action": "stopVM" },
    { "action": "stepVM" },
    { "action": "setVmSpeed", "speed": 100 },
    { "action": "synthesizeCircuit", "type": "halfAdder" | "oscillator" | "logicBench" },
    { "action": "setTrit", "nodeId": "string", "state": "TRUE" | "UNKNOWN" | "FALSE" },
    { "action": "setGate", "nodeId": "string", "gateType": "AND" | "OR" | "NOT" | "XOR" | "CONSENSUS" | "MUX" | "LATCH" | "CLOCK" | "ADDER" | "PROBE" },
    { "action": "deleteNode", "nodeId": "string" },
    { "action": "deleteEdge", "edgeId": "string" },
    { "action": "clearGraph" },
    { "action": "autoLayout" },
    { "action": "togglePanel", "panel": "codePreview" | "terminal" | "fileExplorer" | "packageManager" | "providerHub" }
  ],
  "nodes": [
    { 
      "id": "string", 
      "type": "UI" | "Logic" | "Data", 
      "position": { "x": number, "y": number }, 
      "metadata": { "title": "string", "content": "string", "gateType": "AND" | "OR" | "NOT" | "XOR" | "CONSENSUS" | "MUX" | "LATCH" | "CLOCK" | "ADDER" | "PROBE" | "CONSTANT" },
      "ternaryState": "TRUE" | "UNKNOWN" | "FALSE"
    }
  ],
  "edges": [
    { "sourceId": "id1", "targetId": "id2" }
  ],
  "files": [
    { "path": "/src/example.ts", "content": "string" }
  ],
  "reasoning": "Technical rationale for the actions taken",
  "message": "Human-friendly reply to display in the chat interface"
}
\`\`\`
If the user asks an informational question without requesting changes, you may reply with standard Markdown text.
`;
  }

  /**
   * Build the Evaluation context for the Agentic Loop.
   */
  buildAgenticContext(objective: string, previousError?: string): string {
    const baseContext = this.buildEdenContext();
    let errorContext = '';

    if (previousError) {
      errorContext = `\n[ANTI-BAD BEHAVIOUR WARNING]:
The previous iteration failed with: "${previousError}"
You MUST correct this and ensure your JSON conforms strictly to schema.`;
    }

    return `${baseContext}
AUTONOMOUS AGENT OBJECTIVE: "${objective}".${errorContext}

Evaluate whether the current graph and OS state fulfills this objective.
- If fully achieved: respond ONLY with \`\`\`json { "completed": true, "message": "Objective fully achieved", "reasoning": "Confirmation details" } \`\`\`
- If not yet achieved: output the next batch of osActions, nodes, edges, or files to advance toward the objective.`;
  }

  /**
   * Build enhanced agentic context with memory and planning capabilities
   */
  buildEnhancedAgenticContext(objective: string, previousError?: string, contextSummary?: string): string {
    const baseContext = this.buildEdenContext();
    const memory = this.agentMemory();
    let errorContext = '';

    if (previousError) {
      errorContext = `\n[ANTI-BAD BEHAVIOUR WARNING]:\n"${previousError}"`;
    }

    const memoryContext = `\n[AGENT MEMORY]:\n` +
      `Objective: ${memory.objective}\n` +
      `Iterations: ${memory.iterations}\n` +
      `Completed actions: ${memory.completedActions.length}\n` +
      `Last action: ${memory.completedActions.slice(-1)[0] || 'None'}\n` +
      (contextSummary ? `Context: ${contextSummary}\n` : '');

    return `${baseContext}\nOBJECTIVE: "${objective}".${errorContext}${memoryContext}\n\nEvaluate state and proceed with the next OS actions or declare "completed": true.`;
  }

  abortAgenticLoop() {
    if (this.isAgenticLoopActive()) {
      this.abortRequested = true;
      this.terminal.log('[AGENT] Stop requested by user. Aborting loop...', 'WARN');
    }
  }

  private updateAgentMemory(action: string, success: boolean, error?: string) {
    this.agentMemory.update(memory => {
      const newMemory = { ...memory };
      newMemory.iterations = this.agenticIteration();
      
      if (success) {
        newMemory.completedActions = [...memory.completedActions, action];
      } else {
        newMemory.failedActions = [...memory.failedActions, `${action}: ${error}`];
      }
      
      newMemory.timestamp = Date.now();
      return newMemory;
    });
  }

  private generateContextSummary(): string {
    const genome = this.engine.genome();
    const nodeCount = Object.keys(genome.nodes).length;
    const edgeCount = Object.keys(genome.edges).length;
    const files = this.vfs.listFiles();
    
    const memory = this.agentMemory();
    return `State: ${nodeCount} nodes, ${edgeCount} edges, ${files.length} files. VM: ${this.engine.isVmRunning() ? 'ON' : 'OFF'}. Completed: ${memory.completedActions.length}.`;
  }

  /**
   * Send a chat message and autonomously execute AI actions on the OS.
   */
  async sendChatMessage(userText: string, options?: { isAgentic?: boolean; maxIterations?: number }) {
    if (!userText || !userText.trim() || this.isExecuting()) return;

    const trimmed = userText.trim();
    const userMsgId = 'msg_user_' + Date.now();

    // Append user message
    this.chatMessages.update(msgs => [
      ...msgs,
      {
        id: userMsgId,
        sender: 'user',
        text: trimmed,
        timestamp: Date.now()
      }
    ]);

    // Create assistant placeholder
    const assistantMsgId = 'msg_ai_' + Date.now();
    this.chatMessages.update(msgs => [
      ...msgs,
      {
        id: assistantMsgId,
        sender: 'assistant',
        provider: this.activeProvider(),
        model: this.activeModel(),
        text: 'Analyse de la commande et contrôle de l\'OS ternaire...',
        timestamp: Date.now(),
        isStreaming: true
      }
    ]);

    if (options?.isAgentic) {
      await this.executeAgenticLoop(this.activeProvider(), trimmed, options.maxIterations || 5, assistantMsgId);
      return;
    }

    try {
      // First attempt fast local autonomous dispatch if user request matches direct OS commands
      const localIntent = this.dispatchAutonomousIntent(trimmed);
      if (localIntent) {
        this.chatMessages.update(msgs => msgs.map(m => {
          if (m.id === assistantMsgId) {
            return {
              ...m,
              text: localIntent.message,
              reasoning: 'Intention directe reconnue et exécutée immédiatement par le noyau EDEN OS.',
              executedActions: localIntent.actions,
              isStreaming: false
            };
          }
          return m;
        }));
        return;
      }

      const res = await this.execute(this.activeProvider(), trimmed);
      const out = res.stdout || '';

      const injectResult = this.tryInjectFromOutput(out);
      let displayText = injectResult.message || (out.length > 0 ? this.cleanOutputForDisplay(out) : 'Commande exécutée sur l\'OS.');

      // If remote returned an error or empty actions, check fallback
      if (injectResult.executedActions.length === 0 && !out.trim()) {
        const fallback = this.dispatchAutonomousIntent(trimmed);
        if (fallback) {
          displayText = fallback.message;
          injectResult.executedActions = fallback.actions;
        }
      }

      this.chatMessages.update(msgs => msgs.map(m => {
        if (m.id === assistantMsgId) {
          return {
            ...m,
            text: displayText,
            reasoning: injectResult.reasoning || this.currentReasoning(),
            executedActions: injectResult.executedActions,
            nodesMutated: injectResult.nodesCount,
            edgesMutated: injectResult.edgesCount,
            filesMutated: injectResult.filesCount,
            isStreaming: false
          };
        }
        return m;
      }));
    } catch (e: any) {
      // Graceful fallback to autonomous execution
      const fallback = this.dispatchAutonomousIntent(trimmed);
      if (fallback) {
        this.chatMessages.update(msgs => msgs.map(m => {
          if (m.id === assistantMsgId) {
            return {
              ...m,
              text: fallback.message,
              reasoning: 'Autonomous local execution dispatched due to offline/unreachable remote AI provider.',
              executedActions: fallback.actions,
              isStreaming: false
            };
          }
          return m;
        }));
        return;
      }

      this.chatMessages.update(msgs => msgs.map(m => {
        if (m.id === assistantMsgId) {
          return {
            ...m,
            text: `Execution error: ${e.message}`,
            isStreaming: false
          };
        }
        return m;
      }));
    }
  }

  public dispatchAutonomousIntent(input: string): { handled: boolean; message: string; actions: string[] } | null {
    const q = input.toLowerCase();

    // ALU
    if (q.includes('alu') || q.includes('arithm') || q.includes('calculator') || q.includes('calculat')) {
      this.engine.synthesizeTernaryAlu();
      return {
        handled: true,
        message: '### Balanced Ternary ALU Synthesized\nI have synthesized a complete **Balanced Ternary Arithmetic Logic Unit** featuring:\n- 2 operand inputs A (+1) and B (-1)\n- 1 Opcode selector (MUX)\n- Sub-units: T-Adder, 3-Way Comparator, and Modulo-3 XOR\n- 1 live oscilloscope probe monitor.',
        actions: ['SYNTHESIZE_BALANCED_ALU', 'START_TERNARY_VM']
      };
    }

    // Neuromorphic Neuron / Perceptron
    if (q.includes('neuron') || q.includes('perceptron') || q.includes('neuromorph')) {
      this.engine.synthesizeTernaryNeuron();
      return {
        handled: true,
        message: '### Neuromorphic Ternary Perceptron Layer Synthesized\nI have configured a **Neuromorphic Ternary Perceptron** with:\n- 3 synaptic dendrites: Excitatory (+1), Resting/Sparse (0), and Inhibitory (-1)\n- Activation soma computing weighted sum and ternary thresholding\n- Phase inverter axon and real-time spike train probe monitor.',
        actions: ['SYNTHESIZE_TERNARY_NEURON', 'START_TERNARY_VM']
      };
    }

    // RAM / Memory Word
    if (q.includes('ram') || q.includes('memory') || q.includes('register') || q.includes('latch')) {
      this.engine.synthesizeTernaryMemoryWord();
      return {
        handled: true,
        message: '### Static Ternary RAM Word (3-Trit) Synthesized\nI have assembled a **3-Trit Static Memory Word** featuring:\n- 1 synchronous clock strobe signal (Clock)\n- 3 data inputs D[0..2] (-1, 0, +1)\n- 3 tri-stable latch registers with an output bus.',
        actions: ['SYNTHESIZE_MEMORY_WORD', 'START_TERNARY_VM']
      };
    }

    // Decision Tree / State Machine
    if (q.includes('decision') || q.includes('tree') || q.includes('branch') || q.includes('state machine')) {
      this.engine.synthesizeTernaryDecisionTree();
      return {
        handled: true,
        message: '### Autonomous Ternary Decision Engine Synthesized\nI have created a **3-Way Ternary Decision Engine**:\n- Dynamic ternary condition trit (-1: Halt/Abort, 0: Idle/Wait, +1: Execute)\n- Instant conditional routing multiplexer\n- Real-time decision flow tracer.',
        actions: ['SYNTHESIZE_DECISION_TREE', 'START_TERNARY_VM']
      };
    }

    // LFSR
    if (q.includes('lfsr') || q.includes('pseudo-random') || q.includes('random') || q.includes('noise')) {
      this.engine.synthesizeTernaryLfsr();
      return {
        handled: true,
        message: '### Ternary LFSR Stream Generator Synthesized\nI have built a **Ternary Pseudo-Random LFSR Generator** featuring a mod-3 polynomial feedback loop, cyclic phase shift, and continuous probe logging.',
        actions: ['SYNTHESIZE_LFSR_STREAM', 'START_TERNARY_VM']
      };
    }

    // Half Adder
    if (q.includes('adder') || q.includes('sum') || q.includes('addition')) {
      this.engine.synthesizeHalfAdder();
      return {
        handled: true,
        message: '### Balanced Half-Adder Synthesized\nI have generated the balanced ternary half-adder with simultaneous Sum and Carry evaluation.',
        actions: ['SYNTHESIZE_HALF_ADDER', 'START_TERNARY_VM']
      };
    }

    // Oscillator
    if (q.includes('oscillat') || q.includes('clock') || q.includes('ring')) {
      this.engine.synthesizeRingOscillator();
      return {
        handled: true,
        message: '### 3-Stage Ternary Ring Oscillator Synthesized\nI have configured a 3-stage odd cascade ring oscillator producing an autonomous periodic square wave.',
        actions: ['SYNTHESIZE_RING_OSCILLATOR', 'START_TERNARY_VM']
      };
    }

    // Logic bench
    if (q.includes('bench') || q.includes('test') || q.includes('gates')) {
      this.engine.synthesizeLogicBench();
      return {
        handled: true,
        message: '### Ternary Logic Gates Bench Synthesized\nMulti-gate Kleene test bench (AND, OR, NOT) linked to inputs and oscilloscope probes.',
        actions: ['SYNTHESIZE_LOGIC_BENCH', 'START_TERNARY_VM']
      };
    }

    // Start VM
    if (q.includes('start vm') || q.includes('run vm') || q.includes('resume vm') || q.includes('start the vm')) {
      this.engine.startVM();
      return {
        handled: true,
        message: 'Ternary Virtual Machine started in continuous evaluation mode.',
        actions: ['START_TERNARY_VM']
      };
    }

    // Stop VM
    if (q.includes('stop') || q.includes('pause') || q.includes('halt')) {
      this.engine.stopVM();
      return {
        handled: true,
        message: 'Ternary Virtual Machine paused.',
        actions: ['STOP_TERNARY_VM']
      };
    }

    // Step VM
    if (q.includes('step') || q.includes('cycle') || q.includes('tick')) {
      this.engine.stepVM();
      return {
        handled: true,
        message: 'Single unit cycle evaluated across the ternary graph.',
        actions: ['STEP_TERNARY_VM']
      };
    }

    // Clear
    if (q.includes('clear') || q.includes('clean') || q.includes('reset canvas') || q.includes('empty')) {
      this.engine.clearCircuit();
      return {
        handled: true,
        message: 'Ternary canvas cleared. All nodes and edges removed.',
        actions: ['CLEAR_GRAPH']
      };
    }

    // Auto Layout
    if (q.includes('layout') || q.includes('align') || q.includes('arrange') || q.includes('matrix')) {
      this.engine.autoLayout();
      return {
        handled: true,
        message: 'Matrix auto-layout applied with zero-overlap and strict boundary enforcement.',
        actions: ['AUTO_LAYOUT_MATRIX']
      };
    }

    // Truth Table
    if (q.includes('truth table') || q.includes('table') || q.includes('verify') || q.includes('formal')) {
      const report = this.truthTable.generateTruthTable();
      this.appUi.isTruthTableOpen.set(true);
      return {
        handled: true,
        message: `### Formal Verification Result\nI have generated the exhaustive truth table across **${report.totalStates} input permutations**.\n\n${this.truthTable.formatReportAsText(report)}\n\n*The formal verification panel is now open on your screen.*`,
        actions: [`VERIFY_TRUTH_TABLE_${report.totalStates}_STATES`, 'TOGGLE_PANEL_TRUTHTABLE']
      };
    }

    // Audio sonification
    if (q.includes('audio') || q.includes('sound') || q.includes('mute') || q.includes('sonifi')) {
      const active = this.audio.toggleAudio();
      return {
        handled: true,
        message: `Ternary acoustic sonification **${active ? 'ENABLED' : 'DISABLED'}**. Each trit transition will emit a harmonic frequency tone.`,
        actions: [`AUDIO_SONIFICATION_${active ? 'ON' : 'OFF'}`]
      };
    }

    return null;
  }

  private cleanOutputForDisplay(raw: string): string {
    // If output has a clean markdown or message, extract it
    const jsonMatch = raw.match(/```(?:json)?\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed.message) return parsed.message;
      } catch {}
      return raw.replace(/```(?:json)?\n[\s\S]*?\n```/g, '').trim() || 'Modifications appliquées à l\'OS ternaire.';
    }
    return raw;
  }

  async executeAgenticLoop(
    engineName?: AiProvider | string, 
    objective: string = '', 
    maxIterations = 5,
    chatMessageId?: string
  ) {
    if (this.isAgenticLoopActive() || this.isExecuting()) return;

    const provider = (engineName || this.activeProvider()) as AiProvider;
    this.isAgenticLoopActive.set(true);
    this.currentObjective.set(objective);
    this.maxAgenticIterations.set(maxIterations);
    this.abortRequested = false;
    this.terminal.log(`[AGENT] Starting autonomous evaluation loop with ${provider.toUpperCase()} (${this.activeModel()}) for objective: "${objective}"`, 'SYSTEM');

    let iteration = 0;
    let previousError = '';
    const allActions: string[] = [];

    try {
      this.agentMemory.set({
        objective,
        iterations: 0,
        completedActions: [],
        failedActions: [],
        currentPlan: [],
        contextSummary: this.generateContextSummary(),
        timestamp: Date.now()
      });

      while (iteration < maxIterations && !this.abortRequested) {
        iteration++;
        this.agenticIteration.set(iteration);
        this.terminal.log(`[AGENT] Iteration ${iteration}/${maxIterations} - Analyzing state...`, 'INFO');

        if (chatMessageId) {
          this.chatMessages.update(msgs => msgs.map(m => {
            if (m.id === chatMessageId) {
              return {
                ...m,
                text: `Autonomous loop - Step ${iteration}/${maxIterations}: Analyzing state and mutating OS...`,
                isStreaming: true
              };
            }
            return m;
          }));
        }

        const contextSummary = this.generateContextSummary();
        const prompt = this.buildEnhancedAgenticContext(objective, previousError, contextSummary);
        previousError = '';

        const res = await this.cli.execute(provider, prompt, 'yolo', this.activeModel());

        if (this.abortRequested) break;

        if (res.error) {
          this.terminal.log(`[AGENT] Error: ${res.error}. Aborting loop.`, 'ERROR');
          this.updateAgentMemory(`Iteration ${iteration}: API Error`, false, res.error);
          break;
        }

        const out = res.stdout || '';
        const isCompletedMatch = out.match(/"completed"\s*:\s*true/);
        
        const injectRes = this.tryInjectFromOutput(out);
        if (injectRes.executedActions) {
          allActions.push(...injectRes.executedActions);
        }

        if (isCompletedMatch) {
          this.terminal.log(`[AGENT] Evaluation result: COMPLETED. Objective achieved!`, 'SYSTEM');
          this.updateAgentMemory(`Objective completed: ${objective}`, true);
          if (chatMessageId) {
            this.chatMessages.update(msgs => msgs.map(m => {
              if (m.id === chatMessageId) {
                return {
                  ...m,
                  text: injectRes.message || `Autonomous objective achieved in ${iteration} iteration(s)!`,
                  executedActions: allActions,
                  isStreaming: false
                };
              }
              return m;
            }));
          }
          break;
        } else {
          this.terminal.log(`[AGENT] Iteration ${iteration}: Applied state mutations. Continuing...`, 'INFO');
          await new Promise(r => setTimeout(r, 600));
        }
      }

      if (iteration >= maxIterations && !this.abortRequested) {
        this.terminal.log(`[AGENT] Max iterations (${maxIterations}) reached.`, 'WARN');
        if (chatMessageId) {
          this.chatMessages.update(msgs => msgs.map(m => {
            if (m.id === chatMessageId) {
              return {
                ...m,
                text: `Autonomous cycle completed after ${iteration} iterations. OS is synchronized.`,
                executedActions: allActions,
                isStreaming: false
              };
            }
            return m;
          }));
        }
      }
    } catch (e: any) {
      this.terminal.log(`[AGENT] Fatal error: ${e.message}`, 'ERROR');
    } finally {
      this.isAgenticLoopActive.set(false);
      this.currentObjective.set('');
      this.agenticIteration.set(0);
      this.currentReasoning.set('');
      this.abortRequested = false;
    }
  }

  // --- STANDARD EXECUTION ---

  async execute(engineName?: AiProvider | string, userPrompt: string = ''): Promise<{ stdout: string; stderr: string; error: string }> {
    const provider = (engineName || this.activeProvider()) as AiProvider;
    this.isExecuting.set(true);
    this.terminal.log(`[EDEN Pipeline] Starting ${provider.toUpperCase()} (${this.activeModel()}) in ${this.mode()} mode...`, 'SYSTEM');

    const result = { stdout: '', stderr: '', error: '' };

    try {
      const mode = this.mode();
      let finalArgs = userPrompt;

      if (mode === 'eden' || mode === 'yolo') {
        if (!userPrompt.startsWith('-')) {
          finalArgs = this.buildEdenContext() + "\nUser request: " + userPrompt;
        }
      }

      const res = await this.cli.execute(provider, finalArgs, mode, this.activeModel());

      if (res.stdout) {
        result.stdout = res.stdout;
        this.terminal.log(result.stdout, 'INFO');
        if (mode !== 'raw') {
          this.tryInjectFromOutput(res.stdout);
        }
      }
      if (res.stderr) {
        result.stderr = res.stderr;
        this.terminal.log(res.stderr, 'WARN');
      }
      if (res.error) {
        result.error = res.error;
        this.terminal.log(res.error, 'ERROR');
      }
    } catch (error: unknown) {
      const err = error as Error;
      result.error = err.message || 'Unknown error';
      this.terminal.log(result.error, 'ERROR');
    } finally {
      this.isExecuting.set(false);
    }

    return result;
  }

  async executeRaw(engineName?: AiProvider | string, args: string = ''): Promise<{ stdout: string; stderr: string; error: string }> {
    const provider = (engineName || this.activeProvider()) as AiProvider;
    this.isExecuting.set(true);
    this.terminal.log(`[CLI Raw] ${provider.toUpperCase()} ${args}`, 'SYSTEM');

    const result = { stdout: '', stderr: '', error: '' };

    try {
      const res = await this.cli.execute(provider, args, 'raw', this.activeModel());
      result.stdout = res.stdout || '';
      result.stderr = res.stderr || '';
      result.error = res.error || '';
      if (result.stdout) this.terminal.log(result.stdout, 'INFO');
      if (result.stderr) this.terminal.log(result.stderr, 'WARN');
      if (result.error) this.terminal.log(result.error, 'ERROR');
    } catch (error: unknown) {
      const err = error as Error;
      result.error = err.message || 'Unknown error';
      this.terminal.log(result.error, 'ERROR');
    } finally {
      this.isExecuting.set(false);
    }

    return result;
  }

  /**
   * Parses JSON mutations and executes privileged OS Actions:
   * VM controls, circuit synthesis, node/edge mutations, trit strobing, and panel toggles.
   */
  tryInjectFromOutput(output: string): { 
    success: boolean; 
    nodesCount: number; 
    edgesCount: number; 
    filesCount: number; 
    executedActions: string[];
    reasoning?: string;
    message?: string;
  } {
    const res = {
      success: false,
      nodesCount: 0,
      edgesCount: 0,
      filesCount: 0,
      executedActions: [] as string[],
      reasoning: undefined as string | undefined,
      message: undefined as string | undefined
    };

    try {
      const jsonMatch = output.match(/```(?:json)?\n([\s\S]*?)\n```/) || output.match(/\{([\s\S]*)\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : output;

      const startIndex = jsonStr.indexOf('{');
      const endIndex = jsonStr.lastIndexOf('}');

      if (startIndex === -1 || endIndex === -1) {
        return res;
      }

      const cleanJson = jsonStr.substring(startIndex, endIndex + 1);
      const parsed = JSON.parse(cleanJson) as { 
        osActions?: any[],
        nodes?: any[], 
        edges?: any[], 
        files?: any[], 
        reasoning?: string,
        message?: string,
        completed?: boolean 
      };

      if (!parsed) return res;

      if (parsed.reasoning) {
        res.reasoning = parsed.reasoning;
        this.currentReasoning.set(parsed.reasoning);
        this.terminal.log(`[AI Copilot] Reasoning: ${parsed.reasoning}`, 'INFO');
      }

      if (parsed.message) {
        res.message = parsed.message;
      }

      // 1. EXECUTE PRIVILEGED OS ACTIONS
      if (parsed.osActions && Array.isArray(parsed.osActions)) {
        for (const act of parsed.osActions) {
          const aType = act.action;
          switch (aType) {
            case 'startVM':
              this.engine.startVM();
              res.executedActions.push('START_TERNARY_VM');
              break;

            case 'stopVM':
              this.engine.stopVM();
              res.executedActions.push('STOP_TERNARY_VM');
              break;

            case 'stepVM':
              this.engine.stepVM();
              res.executedActions.push('STEP_TERNARY_VM');
              break;

            case 'setVmSpeed':
              if (act.speed && typeof act.speed === 'number') {
                this.engine.setVmSpeed(act.speed);
                res.executedActions.push(`SET_VM_SPEED_${act.speed}MS`);
              }
              break;

            case 'synthesizeCircuit':
              if (act.type === 'halfAdder') {
                this.engine.synthesizeHalfAdder();
                res.executedActions.push('SYNTHESIZE_HALF_ADDER');
              } else if (act.type === 'oscillator') {
                this.engine.synthesizeRingOscillator();
                res.executedActions.push('SYNTHESIZE_RING_OSCILLATOR');
              } else if (act.type === 'logicBench') {
                this.engine.synthesizeLogicBench();
                res.executedActions.push('SYNTHESIZE_LOGIC_BENCH');
              } else if (act.type === 'alu') {
                this.engine.synthesizeTernaryAlu();
                res.executedActions.push('SYNTHESIZE_BALANCED_ALU');
              } else if (act.type === 'neuron') {
                this.engine.synthesizeTernaryNeuron();
                res.executedActions.push('SYNTHESIZE_TERNARY_NEURON');
              } else if (act.type === 'memoryWord' || act.type === 'ram') {
                this.engine.synthesizeTernaryMemoryWord();
                res.executedActions.push('SYNTHESIZE_MEMORY_WORD');
              } else if (act.type === 'decisionTree') {
                this.engine.synthesizeTernaryDecisionTree();
                res.executedActions.push('SYNTHESIZE_DECISION_TREE');
              } else if (act.type === 'lfsr') {
                this.engine.synthesizeTernaryLfsr();
                res.executedActions.push('SYNTHESIZE_LFSR_STREAM');
              }
              break;

            case 'compileTasm':
              if (act.code) {
                const comp = this.tasm.compile(act.code);
                if (comp.success) {
                  this.engine.saveSnapshot();
                  this.engine.mutate({ nodes: comp.nodes, edges: comp.edges });
                  res.executedActions.push(`COMPILE_TASM_${comp.nodeCount}_NODES`);
                } else {
                  this.terminal.log(`[TASM Error] ${comp.error}`, 'ERROR');
                }
              }
              break;

            case 'verifyTruthTable': {
              const report = this.truthTable.generateTruthTable();
              res.executedActions.push(`VERIFY_TRUTH_TABLE_${report.totalStates}_STATES`);
              break;
            }

            case 'toggleAudio': {
              const audioState = this.audio.toggleAudio();
              res.executedActions.push(`AUDIO_SONIFICATION_${audioState ? 'ON' : 'OFF'}`);
              break;
            }

            case 'setTrit':
              if (act.nodeId && act.state) {
                this.engine.setNodeTernaryState(act.nodeId, act.state as TernaryValue);
                res.executedActions.push(`SET_TRIT_${act.nodeId}_${act.state}`);
              }
              break;

            case 'setGate':
              if (act.nodeId && act.gateType) {
                const currentN = this.engine.genome().nodes[act.nodeId];
                if (currentN) {
                  this.engine.mutate({
                    nodes: {
                      [act.nodeId]: {
                        ...currentN,
                        metadata: { ...currentN.metadata, gateType: act.gateType }
                      }
                    }
                  });
                  res.executedActions.push(`SET_GATE_${act.nodeId}_${act.gateType}`);
                }
              }
              break;

            case 'deleteNode':
              if (act.nodeId) {
                this.engine.deleteNode(act.nodeId);
                res.executedActions.push(`DELETE_NODE_${act.nodeId}`);
              }
              break;

            case 'deleteEdge':
              if (act.edgeId) {
                this.engine.deleteEdge(act.edgeId);
                res.executedActions.push(`DELETE_EDGE_${act.edgeId}`);
              }
              break;

            case 'clearGraph':
              this.engine.clearCircuit();
              res.executedActions.push('CLEAR_GRAPH');
              break;

            case 'autoLayout':
              this.engine.autoLayout();
              res.executedActions.push('AUTO_LAYOUT_MATRIX');
              break;

            case 'togglePanel':
              if (act.panel === 'codePreview') this.appUi.toggleCodePreview();
              else if (act.panel === 'terminal') this.appUi.toggleTerminal();
              else if (act.panel === 'fileExplorer') this.appUi.toggleFileExplorer();
              else if (act.panel === 'packageManager') this.appUi.togglePackageManager();
              else if (act.panel === 'providerHub') this.appUi.toggleProviderHub();
              else if (act.panel === 'truthTable') this.appUi.toggleTruthTable();
              else if (act.panel === 'tasmStudio') this.appUi.toggleTasmStudio();
              else if (act.panel === 'telemetryHud') this.appUi.toggleTelemetryHud();
              res.executedActions.push(`TOGGLE_PANEL_${act.panel.toUpperCase()}`);
              break;
          }
        }
      }

      // 2. INJECT OR UPDATE NODES
      if (parsed.nodes && Array.isArray(parsed.nodes) && parsed.nodes.length > 0) {
        const nodesToInject: Record<string, any> = {};
        const edgesToInject: Record<string, any> = {};

        const baseX = 260 + Math.floor(Math.random() * 150);
        const baseY = 200 + Math.floor(Math.random() * 100);

        parsed.nodes.forEach((n: any, index: number) => {
          const id = n.id || 'node_' + Math.random().toString(36).substr(2, 9);
          const type = (n as any).type || 'Logic';
          const rawX = n.position?.x ?? (baseX + (index % 3) * 320);
          const rawY = n.position?.y ?? (baseY + Math.floor(index / 3) * 180);
          const clamped = clampNodePosition(rawX, rawY, type);

          nodesToInject[id] = {
            id,
            type,
            position: {
              x: clamped.x,
              y: clamped.y
            },
            metadata: (n as any).metadata || { title: 'Ternary Gate', gateType: 'AND' },
            ternaryState: (n as any).ternaryState || 'UNKNOWN'
          };
          res.nodesCount++;
        });

        parsed.edges?.forEach((e: any) => {
          const edgeId = 'edge_' + (e as any).sourceId + '_' + (e as any).targetId;
          edgesToInject[edgeId] = {
            id: edgeId,
            sourceId: (e as any).sourceId,
            targetId: (e as any).targetId
          };
          res.edgesCount++;
        });

        this.engine.mutate({ nodes: nodesToInject, edges: edgesToInject });
        res.executedActions.push(`MUTATED_${res.nodesCount}_NODES`);
      }

      // 3. INJECT FILES TO VFS
      if (parsed.files && Array.isArray(parsed.files)) {
        parsed.files.forEach((f: any) => {
          if (f.path && f.content !== undefined) {
            this.vfs.writeFile(f.path, f.content);
            res.filesCount++;
          }
        });
        if (res.filesCount > 0) {
          res.executedActions.push(`SAVED_${res.filesCount}_FILES`);
        }
      }

      if (res.nodesCount > 0 || res.edgesCount > 0 || res.filesCount > 0 || res.executedActions.length > 0) {
        res.success = true;
        this.terminal.log(
          `[EDEN OS Controller] Actions executed: ${res.executedActions.join(', ')}`,
          'SYSTEM'
        );
      }

      return res;
    } catch (e) {
      return res;
    }
  }

  createFallbackNode(engineName: string, output: string) {
    const id = 'node_cli_' + Math.random().toString(36).substr(2, 9);
    const x = Math.floor(Math.random() * 800) + 260;
    const y = Math.floor(Math.random() * 500) + 200;

    this.engine.mutate({
      nodes: {
        [id]: {
          id,
          type: 'Data',
          position: { x, y },
          metadata: {
            title: engineName.toUpperCase() + ' Output',
            content: output.substring(0, 500) + (output.length > 500 ? '...' : '')
          },
          ternaryState: 'UNKNOWN'
        }
      },
      edges: {}
    });
    this.terminal.log('CLI output injected as fallback node.', 'SYSTEM');
  }
}

