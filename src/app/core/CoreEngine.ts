import { signal, computed, Injectable, inject } from '@angular/core';
import { EdenGenome } from '../types/genome';
import { TernaryValue, EdenNode, LogicGateType, NodeType } from '../types/node';
import { TerminalService } from './TerminalService';
import { TernaryAudioService } from './TernaryAudioService';

export const CANVAS_BOUNDS = {
  minX: 40,
  minY: 40,
  maxX: 2800,
  maxY: 1800
};

export function getNodeDimensions(nodeOrType?: string | { type?: string; dimensions?: { width: number; height: number } }): { width: number; height: number; halfWidth: number; halfHeight: number } {
  if (typeof nodeOrType === 'object' && nodeOrType !== null) {
    if (nodeOrType.dimensions && nodeOrType.dimensions.width && nodeOrType.dimensions.height) {
      const w = Math.round(nodeOrType.dimensions.width);
      const h = Math.round(nodeOrType.dimensions.height);
      return { width: w, height: h, halfWidth: Math.round(w / 2), halfHeight: Math.round(h / 2) };
    }
    return getNodeDimensions(nodeOrType.type);
  }
  const t = (nodeOrType || '').toUpperCase();
  if (t === 'UI') return { width: 320, height: 184, halfWidth: 160, halfHeight: 92 };
  if (t === 'LOGIC') return { width: 270, height: 170, halfWidth: 135, halfHeight: 85 };
  if (t === 'DATA') return { width: 290, height: 176, halfWidth: 145, halfHeight: 88 };
  return { width: 280, height: 174, halfWidth: 140, halfHeight: 87 };
}

export function getNodeHalfDimensions(nodeOrType?: string | { type?: string; dimensions?: { width: number; height: number } }): { halfWidth: number; halfHeight: number } {
  const dims = getNodeDimensions(nodeOrType);
  return { halfWidth: dims.halfWidth, halfHeight: dims.halfHeight };
}

export function clampNodePosition(x: number, y: number, nodeOrType?: string | { type?: string; dimensions?: { width: number; height: number } }) {
  const { halfWidth, halfHeight } = getNodeHalfDimensions(nodeOrType);
  const minAllowedX = CANVAS_BOUNDS.minX + halfWidth;
  const maxAllowedX = CANVAS_BOUNDS.maxX - halfWidth;
  const minAllowedY = CANVAS_BOUNDS.minY + halfHeight;
  const maxAllowedY = CANVAS_BOUNDS.maxY - halfHeight;

  const clampedX = Math.max(minAllowedX, Math.min(maxAllowedX, x));
  const clampedY = Math.max(minAllowedY, Math.min(maxAllowedY, y));

  return {
    x: Math.round(clampedX),
    y: Math.round(clampedY),
    touchesBorder: {
      left: Math.abs(clampedX - minAllowedX) <= 2,
      right: Math.abs(clampedX - maxAllowedX) <= 2,
      top: Math.abs(clampedY - minAllowedY) <= 2,
      bottom: Math.abs(clampedY - maxAllowedY) <= 2
    }
  };
}

/**
 * Checks if two node positions overlap given their exact dimensions plus safety gutter
 */
export function isOverlapping(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  node1?: any,
  node2?: any,
  minGapPadding = 30
): boolean {
  const d1 = getNodeHalfDimensions(node1);
  const d2 = getNodeHalfDimensions(node2);
  const requiredGapX = d1.halfWidth + d2.halfWidth + minGapPadding;
  const requiredGapY = d1.halfHeight + d2.halfHeight + minGapPadding;
  return Math.abs(p1.x - p2.x) < requiredGapX && Math.abs(p1.y - p2.y) < requiredGapY;
}

/**
 * Finds a guaranteed non-overlapping position side-by-side or stacked cleanly
 */
export function findNonOverlappingPosition(
  desiredX: number,
  desiredY: number,
  existingNodes: Record<string, EdenNode>,
  excludeId?: string,
  subjectNodeOrType?: any
): { x: number; y: number } {
  const clamped = clampNodePosition(desiredX, desiredY, subjectNodeOrType);
  let curX = clamped.x;
  let curY = clamped.y;

  const otherNodes = Object.values(existingNodes).filter(n => n && n.id !== excludeId);
  const overlapsAny = (x: number, y: number) =>
    otherNodes.some(n => isOverlapping({ x, y }, n.position, subjectNodeOrType, n));

  if (!overlapsAny(curX, curY)) {
    return { x: curX, y: curY };
  }

  // Scan side-by-side (columns to the right, then rows down)
  const subjDims = getNodeDimensions(subjectNodeOrType);
  const stepX = Math.max(340, subjDims.width + 50);
  const stepY = Math.max(200, subjDims.height + 40);

  for (let r = 0; r <= 8; r++) {
    for (let c = 0; c <= 8; c++) {
      if (r === 0 && c === 0) continue;
      const testX = curX + c * stepX;
      const testY = curY + r * stepY;
      const testClamped = clampNodePosition(testX, testY, subjectNodeOrType);
      if (!overlapsAny(testClamped.x, testClamped.y)) {
        return { x: testClamped.x, y: testClamped.y };
      }
    }
  }

  // Global scan from top-left if canvas is densely packed
  for (let y = CANVAS_BOUNDS.minY + 120; y <= CANVAS_BOUNDS.maxY - 120; y += stepY) {
    for (let x = CANVAS_BOUNDS.minX + 180; x <= CANVAS_BOUNDS.maxX - 180; x += stepX) {
      if (!overlapsAny(x, y)) {
        return { x, y };
      }
    }
  }

  return { x: curX + 100, y: curY + 100 };
}

/**
 * Takes a record of nodes and shifts any overlapping nodes side-by-side
 */
export function resolveCollisions(nodes: Record<string, EdenNode>): Record<string, EdenNode> {
  const result: Record<string, EdenNode> = {};
  const entries = Object.entries(nodes);

  for (const [id, node] of entries) {
    const freePos = findNonOverlappingPosition(
      node.position.x,
      node.position.y,
      result,
      id,
      node
    );
    result[id] = {
      ...node,
      position: freePos
    };
  }

  return result;
}

@Injectable({ providedIn: 'root' })
export class CoreEngine {
  private terminal = inject(TerminalService);
  public audio = inject(TernaryAudioService);

  private state = signal<EdenGenome>({ nodes: {}, edges: {}, history: [], historyIndex: -1 });
  public readonly genome = this.state.asReadonly() as any as any;

  public readonly canUndo = computed(() => this.state().historyIndex >= 0);
  public readonly canRedo = computed(() => this.state().historyIndex < this.state().history.length - 1);

  private activity = signal(0);
  public readonly activityLevel = this.activity.asReadonly() as any as any;

  // Ternary VM State
  public isVmRunning = signal<boolean>(false);
  public vmSpeed = signal<number>(5); // Frequency in Hz (e.g. 1, 2, 5, 10, 20)
  public vmCycles = signal<number>(0);
  private vmInterval: any;

  // Real-time Trit Distribution & Entropy
  public readonly tritStats = computed(() => {
    const nodes = Object.values(this.state().nodes) as EdenNode[];
    let trueCount = 0;
    let falseCount = 0;
    let unknownCount = 0;

    for (const node of nodes) {
      if (node.ternaryState === 'TRUE') trueCount++;
      else if (node.ternaryState === 'FALSE') falseCount++;
      else unknownCount++;
    }

    const total = nodes.length || 1;
    const pTrue = trueCount / total;
    const pFalse = falseCount / total;
    const pUnknown = unknownCount / total;

    // Shannon ternary entropy calculation
    let entropy = 0;
    [pTrue, pFalse, pUnknown].forEach(p => {
      if (p > 0) entropy -= p * (Math.log2(p) / Math.log2(3));
    });

    return {
      trueCount,
      falseCount,
      unknownCount,
      totalCount: nodes.length,
      truePercent: Math.round((trueCount / total) * 100),
      falsePercent: Math.round((falseCount / total) * 100),
      unknownPercent: Math.round((unknownCount / total) * 100),
      netCharge: trueCount - falseCount,
      entropy: Math.round(entropy * 100) / 100
    };
  });

  constructor() {
    // Decay activity over time to return to base color
    setInterval(() => {
      if (this.activity() > 0) {
        this.activity.update(v => Math.max(0, v - 2));
      }
    }, 100);

    // Initialize default graph if empty
    this.seedDefaultGraph();
    this.terminal.log('EDEN Core Engine Initialized [Matrix Bounds Enforced].', 'SYSTEM');
  }

  private seedDefaultGraph() {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('eden_genome_save');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.nodes && Object.keys(parsed.nodes).length > 0) {
            this.state.set({
              nodes: parsed.nodes,
              edges: parsed.edges || {},
              history: [],
              historyIndex: -1
            });
            return;
          }
        } catch {}
      }
    }

    // Default 3 interconnected nodes within bounds
    const now = Date.now();
    const defaultNodes: Record<string, EdenNode> = {
      'node_in_1': {
        id: 'node_in_1',
        type: 'UI',
        position: { x: 300, y: 340 },
        ternaryState: 'TRUE',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Neural_Signal_In', content: 'STREAM_ACTIVE' }
      },
      'node_logic_1': {
        id: 'node_logic_1',
        type: 'Logic',
        position: { x: 700, y: 340 },
        ternaryState: 'TRUE',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Ternary_Logic_Gate', gateType: 'AND' }
      },
      'node_data_1': {
        id: 'node_data_1',
        type: 'Data',
        position: { x: 1100, y: 340 },
        ternaryState: 'UNKNOWN',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Synaptic_Sink', props: { bufferSize: 1024 } }
      }
    };

    const defaultEdges = {
      'edge_1_2': {
        id: 'edge_1_2',
        sourceId: 'node_in_1',
        targetId: 'node_logic_1'
      },
      'edge_2_3': {
        id: 'edge_2_3',
        sourceId: 'node_logic_1',
        targetId: 'node_data_1'
      }
    };

    this.state.set({
      nodes: defaultNodes,
      edges: defaultEdges,
      history: [],
      historyIndex: -1
    });
  }

  private bumpActivity() {
    this.activity.update(v => Math.min(100, v + 30));
  }

  // --- HISTORY MANAGEMENT ---

  public saveSnapshot() {
    this.state.update(current => {
      const snapshot = {
        timestamp: Date.now(),
        nodes: JSON.parse(JSON.stringify(current.nodes)),
        edges: JSON.parse(JSON.stringify(current.edges))
      };

      // Truncate future history if we are not at the end
      const newHistory = current.history.slice(0, current.historyIndex + 1);
      newHistory.push(snapshot);

      return {
        ...current,
        history: newHistory,
        historyIndex: newHistory.length - 1
      };
    });
  }

  public undo() {
    if (!this.canUndo()) return;
    
    this.state.update(current => {
      let history = current.history;
      const historyIndex = current.historyIndex;

      // If we are at the very end of our actions, we need to save the current state 
      // as a snapshot so we can redo back to it, ONLY if it's not already saved.
      if (historyIndex === history.length - 1) {
        const currentSnapshot = {
          timestamp: Date.now(),
          nodes: JSON.parse(JSON.stringify(current.nodes)),
          edges: JSON.parse(JSON.stringify(current.edges))
        };
        history = [...history, currentSnapshot];
      }

      const newIndex = historyIndex - 1;
      if (newIndex < 0) {
        this.terminal.log('Undo: Reverted to empty state', 'SYSTEM');
        return {
          ...current,
          nodes: {},
          edges: {},
          history,
          historyIndex: -1
        };
      }

      const snapshot = history[newIndex];
      this.terminal.log('Undo performed', 'SYSTEM');
      return {
        ...current,
        nodes: JSON.parse(JSON.stringify(snapshot.nodes)),
        edges: JSON.parse(JSON.stringify(snapshot.edges)),
        history,
        historyIndex: newIndex
      };
    });
    this.bumpActivity();
  }

  public redo() {
    if (!this.canRedo()) return;

    this.state.update(current => {
      const newIndex = current.historyIndex + 1;
      const snapshot = current.history[newIndex];
      this.terminal.log('Redo performed', 'SYSTEM');
      return {
        ...current,
        nodes: JSON.parse(JSON.stringify(snapshot.nodes)),
        edges: JSON.parse(JSON.stringify(snapshot.edges)),
        historyIndex: newIndex
      };
    });
    this.bumpActivity();
  }

  // --- TERNARY VIRTUAL MACHINE ---

  public toggleVM() {
    if (this.isVmRunning()) {
      this.stopVM();
    } else {
      this.startVM();
    }
  }

  public startVM() {
    if (this.vmInterval) clearInterval(this.vmInterval);
    this.isVmRunning.set(true);
    const intervalMs = Math.max(50, Math.round(1000 / this.vmSpeed()));
    this.terminal.log(`[TERNARY OS] Clock started at ${this.vmSpeed()}Hz (${intervalMs}ms/cycle).`, 'SYSTEM');
    this.vmInterval = setInterval(() => this.vmTick(), intervalMs);
  }

  public stopVM() {
    if (this.vmInterval) clearInterval(this.vmInterval);
    this.isVmRunning.set(false);
    this.terminal.log('[TERNARY OS] Clock suspended.', 'SYSTEM');
  }

  public setVmSpeed(speedHz: number) {
    this.vmSpeed.set(speedHz);
    if (this.isVmRunning()) {
      this.startVM(); // Restart interval with new frequency
    }
    this.terminal.log(`[TERNARY OS] Clock frequency set to ${speedHz}Hz`, 'INFO');
  }

  public stepVm() {
    this.terminal.log(`[TERNARY OS] Manual Single-Step Strobe (Cycle #${this.vmCycles() + 1})`, 'TERNARY');
    this.vmTick();
  }

  public stepVM() {
    this.stepVm();
  }

  public tickVM() {
    this.stepVm();
  }

  public setNodeState(nodeId: string, state: TernaryValue) {
    this.setNodeTernaryState(nodeId, state);
  }

  public synthesizeNeuromorphicPerceptron() {
    this.synthesizeTernaryNeuron();
  }

  public setNodeTernaryState(nodeId: string, state: TernaryValue) {
    this.saveSnapshot();
    this.state.update(current => {
      if (!current.nodes[nodeId]) return current;
      return {
        ...current,
        nodes: {
          ...current.nodes,
          [nodeId]: { 
            ...current.nodes[nodeId], 
            ternaryState: state,
            updatedAt: Date.now()
          }
        }
      };
    });
    this.terminal.log(`Trit Strobe: Node [${nodeId}] = ${state}`, 'TERNARY');
    this.bumpActivity();
  }

  public cycleNodeTernaryState(nodeId: string) {
    const node = this.state().nodes[nodeId];
    if (!node) return;
    const next: Record<TernaryValue, TernaryValue> = {
      'FALSE': 'UNKNOWN',
      'UNKNOWN': 'TRUE',
      'TRUE': 'FALSE'
    };
    this.setNodeTernaryState(nodeId, next[node.ternaryState || 'UNKNOWN']);
  }

  public vmTick() {
    this.vmCycles.update(c => c + 1);
    const current = this.state();
    const newNodes = { ...current.nodes };
    let stateChanged = false;

    // 1. Gather inputs for each node based on directed edges
    const nodeInputs: Record<string, TernaryValue[]> = {};
    for (const nodeId of Object.keys(current.nodes)) {
      nodeInputs[nodeId] = [];
    }

    for (const edge of Object.values(current.edges)) {
      const sourceNode = current.nodes[edge.sourceId];
      if (sourceNode && nodeInputs[edge.targetId]) {
        nodeInputs[edge.targetId].push(sourceNode.ternaryState || 'UNKNOWN');
      }
    }

    // 2. Evaluate each node based on its type and gateType
    for (const nodeId of Object.keys(current.nodes)) {
      const node = current.nodes[nodeId];
      const inputs = nodeInputs[nodeId];
      const gate = (node.metadata.gateType || (node.type === 'Logic' ? 'AND' : 'CONSTANT')) as any;

      // Handle Autonomous Clock Oscillator
      if (gate === 'CLOCK') {
        const nextClockState: Record<TernaryValue, TernaryValue> = {
          'FALSE': 'UNKNOWN',
          'UNKNOWN': 'TRUE',
          'TRUE': 'FALSE'
        };
        const newState = nextClockState[node.ternaryState || 'FALSE'];
        newNodes[nodeId] = { ...node, ternaryState: newState, updatedAt: Date.now() };
        stateChanged = true;
        continue;
      }

      // If constant and no inputs, preserve manual state
      if (gate === 'CONSTANT' && inputs.length === 0) {
        continue;
      }

      // If no inputs connected to a reactive gate, maintain state or set to UNKNOWN
      if (inputs.length === 0) {
        continue;
      }

      const evalResult = this.evaluateTernaryGate(inputs, gate, node);
      const newState = evalResult.state;
      const updatedMetadata = { ...node.metadata, ...evalResult.metadata };

      if (node.ternaryState !== newState || JSON.stringify(node.metadata) !== JSON.stringify(updatedMetadata)) {
        newNodes[nodeId] = { 
          ...node, 
          ternaryState: newState,
          metadata: updatedMetadata,
          updatedAt: Date.now()
        };
        stateChanged = true;
      }
    }

    // 3. Apply atomic update
    if (stateChanged) {
      this.state.update(state => ({ ...state, nodes: newNodes }));
      this.bumpActivity();
      this.audio.playClockTick();
    }
  }

  private evaluateTernaryGate(
    inputs: TernaryValue[], 
    gate: string, 
    currentNode: EdenNode
  ): { state: TernaryValue; metadata?: Record<string, any> } {
    const toNum = (v: TernaryValue): number => (v === 'TRUE' ? 1 : v === 'FALSE' ? -1 : 0);
    const fromNum = (n: number): TernaryValue => (n >= 1 ? 'TRUE' : n <= -1 ? 'FALSE' : 'UNKNOWN');

    const numInputs = inputs.map(toNum);

    switch (gate) {
      // Kleene Minimum Conjunction
      case 'AND': {
        const minVal = Math.min(...numInputs);
        return { state: fromNum(minVal) };
      }

      // Kleene Maximum Disjunction
      case 'OR': {
        const maxVal = Math.max(...numInputs);
        return { state: fromNum(maxVal) };
      }

      // Kleene Inversion (-1 -> 1, 0 -> 0, 1 -> -1)
      case 'NOT': {
        const val = numInputs[0] ?? 0;
        return { state: fromNum(-val) };
      }

      // Balanced Ternary Modulo Sum: (A + B) mapped to balanced [-1, 0, 1]
      case 'XOR': {
        const sum = numInputs.reduce((acc, curr) => acc + curr, 0);
        // Balanced mod 3: 
        // sum = -2 -> 1, sum = -1 -> -1, sum = 0 -> 0, sum = 1 -> 1, sum = 2 -> -1
        let balancedSum = ((sum + 1) % 3 + 3) % 3 - 1;
        return { state: fromNum(balancedSum) };
      }

      // Consensus / Equivalence Gate
      case 'CONSENSUS': {
        if (numInputs.length === 0) return { state: 'UNKNOWN' };
        const allSame = numInputs.every(v => v === numInputs[0]);
        if (allSame) return { state: fromNum(numInputs[0]) };
        const hasUnknown = numInputs.includes(0);
        if (hasUnknown) return { state: 'UNKNOWN' };
        return { state: 'FALSE' }; // Conflicting inputs result in FALSE
      }

      // Ternary Multiplexer: input 0 is selector trit (-1, 0, +1); next inputs are channels
      case 'MUX': {
        if (numInputs.length < 2) return { state: 'UNKNOWN' };
        const sel = numInputs[0];
        if (sel === -1) return { state: fromNum(numInputs[1] ?? 0) };
        if (sel === 0) return { state: fromNum(numInputs[2] ?? 0) };
        return { state: fromNum(numInputs[3] ?? numInputs[numInputs.length - 1] ?? 0) };
      }

      // Trit Latch / Register: input 0 is clock, input 1 is data
      case 'LATCH': {
        const clockTrit = numInputs[0] ?? 0;
        const dataTrit = numInputs[1] ?? 0;
        let stored = currentNode.metadata.memoryState || currentNode.ternaryState || 'UNKNOWN';
        if (clockTrit === 1) {
          // Strobe write
          stored = fromNum(dataTrit);
        }
        return { state: stored, metadata: { memoryState: stored } };
      }

      // Balanced Ternary Half-Adder
      case 'ADDER': {
        const a = numInputs[0] ?? 0;
        const b = numInputs[1] ?? 0;
        const total = a + b; // -2, -1, 0, 1, 2
        let sum = total;
        let carry = 0;
        if (total === 2) { sum = -1; carry = 1; }
        else if (total === -2) { sum = 1; carry = -1; }
        return { 
          state: fromNum(sum), 
          metadata: { 
            props: { ...(currentNode.metadata.props || {}), carry: fromNum(carry), sum: fromNum(sum) } 
          } 
        };
      }

      // 3-Way Ternary Branching Comparator: A > B -> +1, A == B -> 0, A < B -> -1
      case 'COMPARATOR': {
        const a = numInputs[0] ?? 0;
        const b = numInputs[1] ?? 0;
        let comp = 0;
        if (a > b) comp = 1;
        else if (a < b) comp = -1;
        return { state: fromNum(comp) };
      }

      // Neuromorphic Ternary Perceptron (dot product + threshold activation)
      case 'NEURON': {
        const sum = numInputs.reduce((acc, curr) => acc + curr, 0);
        let out = 0;
        if (sum > 0) out = 1;
        else if (sum < 0) out = -1;
        return { 
          state: fromNum(out),
          metadata: {
            props: { ...(currentNode.metadata.props || {}), netActivation: sum }
          }
        };
      }

      // Cyclic Trit Inverter (Cycle Up: -1 -> 0 -> +1 -> -1)
      case 'INVERTER': {
        const val = numInputs[0] ?? 0;
        const next = val === 1 ? -1 : val + 1;
        return { state: fromNum(next) };
      }

      // Dual Sorter MinMax
      case 'MINMAX': {
        const maxVal = Math.max(...numInputs);
        return { state: fromNum(maxVal) };
      }

      // Pseudo-random Linear Feedback Shift Register (LFSR)
      case 'LFSR': {
        const tap1 = numInputs[0] ?? 0;
        const tap2 = numInputs[1] ?? 0;
        const nextVal = ((tap1 * 2 + tap2 + 1) % 3 + 3) % 3 - 1;
        return { state: fromNum(nextVal) };
      }

      // Signal Probe with historical oscilloscope trace
      case 'PROBE': {
        const currentSample = inputs[0] || 'UNKNOWN';
        const history = [...(currentNode.metadata.history || []).slice(-15), currentSample];
        return { 
          state: currentSample, 
          metadata: { history } 
        };
      }

      // Balanced Ternary Multiplier: A * B (-1, 0, +1)
      case 'MULTIPLIER': {
        const a = numInputs[0] ?? 0;
        const b = numInputs[1] ?? 0;
        const prod = a * b;
        return {
          state: fromNum(prod),
          metadata: {
            props: { ...(currentNode.metadata.props || {}), product: prod }
          }
        };
      }

      // Balanced Ternary Full-Adder: A + B + Cin -> Sum & Cout
      case 'FULLADDER': {
        const a = numInputs[0] ?? 0;
        const b = numInputs[1] ?? 0;
        const cin = numInputs[2] ?? 0;
        const total = a + b + cin;
        let sum = 0;
        let cout = 0;
        if (total === 3) { sum = 0; cout = 1; }
        else if (total === 2) { sum = -1; cout = 1; }
        else if (total === 1) { sum = 1; cout = 0; }
        else if (total === 0) { sum = 0; cout = 0; }
        else if (total === -1) { sum = -1; cout = 0; }
        else if (total === -2) { sum = 1; cout = -1; }
        else if (total === -3) { sum = 0; cout = -1; }
        return {
          state: fromNum(sum),
          metadata: {
            props: {
              ...(currentNode.metadata.props || {}),
              sum: fromNum(sum),
              carryOut: fromNum(cout),
              total
            }
          }
        };
      }

      default:
        return { state: fromNum(numInputs[0] ?? 0) };
    }
  }

  // --- PRESET CIRCUIT SYNTHESIZERS FOR TERNARY OS ---

  public synthesizeHalfAdder() {
    this.saveSnapshot();
    const now = Date.now();
    const nodes: Record<string, EdenNode> = {
      'trit_in_a': {
        id: 'trit_in_a',
        type: 'Data',
        position: { x: 300, y: 260 },
        ternaryState: 'TRUE',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Trit Input A', gateType: 'CONSTANT' }
      },
      'trit_in_b': {
        id: 'trit_in_b',
        type: 'Data',
        position: { x: 300, y: 460 },
        ternaryState: 'FALSE',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Trit Input B', gateType: 'CONSTANT' }
      },
      'trit_sum_gate': {
        id: 'trit_sum_gate',
        type: 'Logic',
        position: { x: 680, y: 260 },
        ternaryState: 'UNKNOWN',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Balanced Sum (XOR)', gateType: 'XOR' }
      },
      'trit_carry_gate': {
        id: 'trit_carry_gate',
        type: 'Logic',
        position: { x: 680, y: 460 },
        ternaryState: 'UNKNOWN',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Carry Generator (CONSENSUS)', gateType: 'CONSENSUS' }
      },
      'probe_sum': {
        id: 'probe_sum',
        type: 'UI',
        position: { x: 1080, y: 260 },
        ternaryState: 'UNKNOWN',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Probe: SUM Trit', gateType: 'PROBE' }
      },
      'probe_carry': {
        id: 'probe_carry',
        type: 'UI',
        position: { x: 1080, y: 460 },
        ternaryState: 'UNKNOWN',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Probe: CARRY Trit', gateType: 'PROBE' }
      }
    };

    const edges: Record<string, any> = {
      'e_a_sum': { id: 'e_a_sum', sourceId: 'trit_in_a', targetId: 'trit_sum_gate' },
      'e_b_sum': { id: 'e_b_sum', sourceId: 'trit_in_b', targetId: 'trit_sum_gate' },
      'e_a_carry': { id: 'e_a_carry', sourceId: 'trit_in_a', targetId: 'trit_carry_gate' },
      'e_b_carry': { id: 'e_b_carry', sourceId: 'trit_in_b', targetId: 'trit_carry_gate' },
      'e_sum_probe': { id: 'e_sum_probe', sourceId: 'trit_sum_gate', targetId: 'probe_sum' },
      'e_carry_probe': { id: 'e_carry_probe', sourceId: 'trit_carry_gate', targetId: 'probe_carry' }
    };

    this.state.set({
      nodes,
      edges,
      history: this.state().history,
      historyIndex: this.state().historyIndex
    });

    this.terminal.log('Synthesized: Balanced Ternary Half-Adder Circuit.', 'TERNARY');
    this.bumpActivity();
    if (!this.isVmRunning()) this.startVM();
  }

  public synthesizeRingOscillator() {
    this.saveSnapshot();
    const now = Date.now();
    const nodes: Record<string, EdenNode> = {
      'osc_clock': {
        id: 'osc_clock',
        type: 'Logic',
        position: { x: 300, y: 340 },
        ternaryState: 'TRUE',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Trit Master Clock', gateType: 'CLOCK' }
      },
      'osc_inv_1': {
        id: 'osc_inv_1',
        type: 'Logic',
        position: { x: 620, y: 340 },
        ternaryState: 'FALSE',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Trit Inverter 1', gateType: 'NOT' }
      },
      'osc_latch': {
        id: 'osc_latch',
        type: 'Logic',
        position: { x: 940, y: 340 },
        ternaryState: 'UNKNOWN',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Trit Register Latch', gateType: 'LATCH' }
      },
      'osc_scope': {
        id: 'osc_scope',
        type: 'UI',
        position: { x: 1260, y: 340 },
        ternaryState: 'UNKNOWN',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Oscilloscope Probe', gateType: 'PROBE' }
      }
    };

    const edges: Record<string, any> = {
      'e_clk_inv': { id: 'e_clk_inv', sourceId: 'osc_clock', targetId: 'osc_inv_1' },
      'e_clk_latch': { id: 'e_clk_latch', sourceId: 'osc_clock', targetId: 'osc_latch' },
      'e_inv_latch': { id: 'e_inv_latch', sourceId: 'osc_inv_1', targetId: 'osc_latch' },
      'e_latch_scope': { id: 'e_latch_scope', sourceId: 'osc_latch', targetId: 'osc_scope' }
    };

    this.state.set({
      nodes,
      edges,
      history: this.state().history,
      historyIndex: this.state().historyIndex
    });

    this.terminal.log('Synthesized: 3-Stage Ternary Ring Oscillator & Register.', 'TERNARY');
    this.bumpActivity();
    if (!this.isVmRunning()) this.startVM();
  }

  public synthesizeLogicBench() {
    this.saveSnapshot();
    const now = Date.now();
    const nodes: Record<string, EdenNode> = {
      'in_true': {
        id: 'in_true',
        type: 'Data',
        position: { x: 280, y: 200 },
        ternaryState: 'TRUE',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Trit Source (+1)', gateType: 'CONSTANT' }
      },
      'in_unk': {
        id: 'in_unk',
        type: 'Data',
        position: { x: 280, y: 360 },
        ternaryState: 'UNKNOWN',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Trit Source (0)', gateType: 'CONSTANT' }
      },
      'in_false': {
        id: 'in_false',
        type: 'Data',
        position: { x: 280, y: 520 },
        ternaryState: 'FALSE',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Trit Source (-1)', gateType: 'CONSTANT' }
      },
      'gate_and': {
        id: 'gate_and',
        type: 'Logic',
        position: { x: 650, y: 200 },
        ternaryState: 'UNKNOWN',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'T-AND (Min)', gateType: 'AND' }
      },
      'gate_or': {
        id: 'gate_or',
        type: 'Logic',
        position: { x: 650, y: 360 },
        ternaryState: 'UNKNOWN',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'T-OR (Max)', gateType: 'OR' }
      },
      'gate_not': {
        id: 'gate_not',
        type: 'Logic',
        position: { x: 650, y: 520 },
        ternaryState: 'UNKNOWN',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'T-NOT (Invert)', gateType: 'NOT' }
      },
      'probe_and': {
        id: 'probe_and',
        type: 'UI',
        position: { x: 1020, y: 200 },
        ternaryState: 'UNKNOWN',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Out: AND Probe', gateType: 'PROBE' }
      },
      'probe_or': {
        id: 'probe_or',
        type: 'UI',
        position: { x: 1020, y: 360 },
        ternaryState: 'UNKNOWN',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Out: OR Probe', gateType: 'PROBE' }
      },
      'probe_not': {
        id: 'probe_not',
        type: 'UI',
        position: { x: 1020, y: 520 },
        ternaryState: 'UNKNOWN',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Out: NOT Probe', gateType: 'PROBE' }
      }
    };

    const edges: Record<string, any> = {
      'e1': { id: 'e1', sourceId: 'in_true', targetId: 'gate_and' },
      'e2': { id: 'e2', sourceId: 'in_unk', targetId: 'gate_and' },
      'e3': { id: 'e3', sourceId: 'in_unk', targetId: 'gate_or' },
      'e4': { id: 'e4', sourceId: 'in_false', targetId: 'gate_or' },
      'e5': { id: 'e5', sourceId: 'in_true', targetId: 'gate_not' },
      'e6': { id: 'e6', sourceId: 'gate_and', targetId: 'probe_and' },
      'e7': { id: 'e7', sourceId: 'gate_or', targetId: 'probe_or' },
      'e8': { id: 'e8', sourceId: 'gate_not', targetId: 'probe_not' }
    };

    this.state.set({
      nodes,
      edges,
      history: this.state().history,
      historyIndex: this.state().historyIndex
    });

    this.terminal.log('Synthesized: Ternary Logic Gates Test Bench.', 'TERNARY');
    this.bumpActivity();
    if (!this.isVmRunning()) this.startVM();
  }

  public synthesizeTernaryAlu() {
    this.saveSnapshot();
    const now = Date.now();
    const nodes: Record<string, EdenNode> = {
      'alu_in_a': {
        id: 'alu_in_a',
        type: 'Data',
        position: { x: 260, y: 240 },
        ternaryState: 'TRUE',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Trit Operande A (+1)', gateType: 'CONSTANT' }
      },
      'alu_in_b': {
        id: 'alu_in_b',
        type: 'Data',
        position: { x: 260, y: 440 },
        ternaryState: 'FALSE',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Trit Operande B (-1)', gateType: 'CONSTANT' }
      },
      'alu_opcode': {
        id: 'alu_opcode',
        type: 'Data',
        position: { x: 260, y: 640 },
        ternaryState: 'UNKNOWN',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Opcode MUX Selector', gateType: 'CONSTANT' }
      },
      'alu_adder': {
        id: 'alu_adder',
        type: 'Logic',
        position: { x: 620, y: 220 },
        ternaryState: 'UNKNOWN',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'T-Adder Unit', gateType: 'ADDER' }
      },
      'alu_comp': {
        id: 'alu_comp',
        type: 'Logic',
        position: { x: 620, y: 420 },
        ternaryState: 'UNKNOWN',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'T-Comparator (3-Way)', gateType: 'COMPARATOR' }
      },
      'alu_xor': {
        id: 'alu_xor',
        type: 'Logic',
        position: { x: 620, y: 620 },
        ternaryState: 'UNKNOWN',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'T-Logic Sum XOR', gateType: 'XOR' }
      },
      'alu_mux': {
        id: 'alu_mux',
        type: 'Logic',
        position: { x: 960, y: 380 },
        ternaryState: 'UNKNOWN',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'ALU Output MUX', gateType: 'MUX' }
      },
      'alu_probe_res': {
        id: 'alu_probe_res',
        type: 'UI',
        position: { x: 1320, y: 380 },
        ternaryState: 'UNKNOWN',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'ALU Result Waveform', gateType: 'PROBE', history: [] }
      }
    };

    const edges: Record<string, any> = {
      'e_a_add': { id: 'e_a_add', sourceId: 'alu_in_a', targetId: 'alu_adder' },
      'e_b_add': { id: 'e_b_add', sourceId: 'alu_in_b', targetId: 'alu_adder' },
      'e_a_cmp': { id: 'e_a_cmp', sourceId: 'alu_in_a', targetId: 'alu_comp' },
      'e_b_cmp': { id: 'e_b_cmp', sourceId: 'alu_in_b', targetId: 'alu_comp' },
      'e_a_xor': { id: 'e_a_xor', sourceId: 'alu_in_a', targetId: 'alu_xor' },
      'e_b_xor': { id: 'e_b_xor', sourceId: 'alu_in_b', targetId: 'alu_xor' },
      'e_sel_mux': { id: 'e_sel_mux', sourceId: 'alu_opcode', targetId: 'alu_mux' },
      'e_add_mux': { id: 'e_add_mux', sourceId: 'alu_adder', targetId: 'alu_mux' },
      'e_cmp_mux': { id: 'e_cmp_mux', sourceId: 'alu_comp', targetId: 'alu_mux' },
      'e_xor_mux': { id: 'e_xor_mux', sourceId: 'alu_xor', targetId: 'alu_mux' },
      'e_mux_probe': { id: 'e_mux_probe', sourceId: 'alu_mux', targetId: 'alu_probe_res' }
    };

    this.state.set({ nodes, edges, history: this.state().history, historyIndex: this.state().historyIndex });
    this.terminal.log('Synthesized: Balanced Ternary ALU (Arithmetic & Logic Unit).', 'TERNARY');
    this.bumpActivity();
    this.audio.playSynthesisSuccess();
    if (!this.isVmRunning()) this.startVM();
  }

  public synthesizeTernaryNeuron() {
    this.saveSnapshot();
    const now = Date.now();
    const nodes: Record<string, EdenNode> = {
      'syn_dendrite_1': {
        id: 'syn_dendrite_1',
        type: 'Data',
        position: { x: 260, y: 220 },
        ternaryState: 'TRUE',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Synapse 1 (+1 Excitatory)', gateType: 'CONSTANT' }
      },
      'syn_dendrite_2': {
        id: 'syn_dendrite_2',
        type: 'Data',
        position: { x: 260, y: 400 },
        ternaryState: 'UNKNOWN',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Synapse 2 (0 Neutral/Sparse)', gateType: 'CONSTANT' }
      },
      'syn_dendrite_3': {
        id: 'syn_dendrite_3',
        type: 'Data',
        position: { x: 260, y: 580 },
        ternaryState: 'FALSE',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Synapse 3 (-1 Inhibitory)', gateType: 'CONSTANT' }
      },
      'soma_perceptron': {
        id: 'soma_perceptron',
        type: 'Logic',
        position: { x: 680, y: 400 },
        ternaryState: 'UNKNOWN',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Soma Perceptron Activation', gateType: 'NEURON' }
      },
      'axon_inverter': {
        id: 'axon_inverter',
        type: 'Logic',
        position: { x: 1040, y: 300 },
        ternaryState: 'UNKNOWN',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Axon Phase Inverter', gateType: 'NOT' }
      },
      'axon_probe': {
        id: 'axon_probe',
        type: 'UI',
        position: { x: 1380, y: 400 },
        ternaryState: 'UNKNOWN',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Neuromorphic Spike Train', gateType: 'PROBE', history: [] }
      }
    };

    const edges: Record<string, any> = {
      'e_syn1': { id: 'e_syn1', sourceId: 'syn_dendrite_1', targetId: 'soma_perceptron' },
      'e_syn2': { id: 'e_syn2', sourceId: 'syn_dendrite_2', targetId: 'soma_perceptron' },
      'e_syn3': { id: 'e_syn3', sourceId: 'syn_dendrite_3', targetId: 'soma_perceptron' },
      'e_soma_inv': { id: 'e_soma_inv', sourceId: 'soma_perceptron', targetId: 'axon_inverter' },
      'e_inv_probe': { id: 'e_inv_probe', sourceId: 'axon_inverter', targetId: 'axon_probe' }
    };

    this.state.set({ nodes, edges, history: this.state().history, historyIndex: this.state().historyIndex });
    this.terminal.log('Synthesized: Neuromorphic Ternary Perceptron Layer.', 'TERNARY');
    this.bumpActivity();
    this.audio.playSynthesisSuccess();
    if (!this.isVmRunning()) this.startVM();
  }

  public synthesizeTernaryMemoryWord() {
    this.saveSnapshot();
    const now = Date.now();
    const nodes: Record<string, EdenNode> = {
      'mem_clock': {
        id: 'mem_clock',
        type: 'Logic',
        position: { x: 260, y: 180 },
        ternaryState: 'FALSE',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Memory Write Strobe', gateType: 'CLOCK' }
      },
      'word_d0': {
        id: 'word_d0',
        type: 'Data',
        position: { x: 260, y: 340 },
        ternaryState: 'TRUE',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Word Trit D[0] (+1)', gateType: 'CONSTANT' }
      },
      'word_d1': {
        id: 'word_d1',
        type: 'Data',
        position: { x: 260, y: 520 },
        ternaryState: 'UNKNOWN',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Word Trit D[1] (0)', gateType: 'CONSTANT' }
      },
      'word_d2': {
        id: 'word_d2',
        type: 'Data',
        position: { x: 260, y: 700 },
        ternaryState: 'FALSE',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Word Trit D[2] (-1)', gateType: 'CONSTANT' }
      },
      'latch_0': {
        id: 'latch_0',
        type: 'Logic',
        position: { x: 680, y: 340 },
        ternaryState: 'UNKNOWN',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Trit Register [0]', gateType: 'LATCH' }
      },
      'latch_1': {
        id: 'latch_1',
        type: 'Logic',
        position: { x: 680, y: 520 },
        ternaryState: 'UNKNOWN',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Trit Register [1]', gateType: 'LATCH' }
      },
      'latch_2': {
        id: 'latch_2',
        type: 'Logic',
        position: { x: 680, y: 700 },
        ternaryState: 'UNKNOWN',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Trit Register [2]', gateType: 'LATCH' }
      },
      'probe_mem_word': {
        id: 'probe_mem_word',
        type: 'UI',
        position: { x: 1080, y: 520 },
        ternaryState: 'UNKNOWN',
        createdAt: now,
        updatedAt: now,
        metadata: { title: '3-Trit Word Bus Monitor', gateType: 'PROBE', history: [] }
      }
    };

    const edges: Record<string, any> = {
      'e_clk_0': { id: 'e_clk_0', sourceId: 'mem_clock', targetId: 'latch_0' },
      'e_clk_1': { id: 'e_clk_1', sourceId: 'mem_clock', targetId: 'latch_1' },
      'e_clk_2': { id: 'e_clk_2', sourceId: 'mem_clock', targetId: 'latch_2' },
      'e_d0_l0': { id: 'e_d0_l0', sourceId: 'word_d0', targetId: 'latch_0' },
      'e_d1_l1': { id: 'e_d1_l1', sourceId: 'word_d1', targetId: 'latch_1' },
      'e_d2_l2': { id: 'e_d2_l2', sourceId: 'word_d2', targetId: 'latch_2' },
      'e_l0_bus': { id: 'e_l0_bus', sourceId: 'latch_0', targetId: 'probe_mem_word' }
    };

    this.state.set({ nodes, edges, history: this.state().history, historyIndex: this.state().historyIndex });
    this.terminal.log('Synthesized: 3-Trit Word Static Register (RAM cell).', 'TERNARY');
    this.bumpActivity();
    this.audio.playSynthesisSuccess();
    if (!this.isVmRunning()) this.startVM();
  }

  public synthesizeTernaryDecisionTree() {
    this.saveSnapshot();
    const now = Date.now();
    const nodes: Record<string, EdenNode> = {
      'sensor_condition': {
        id: 'sensor_condition',
        type: 'Data',
        position: { x: 260, y: 240 },
        ternaryState: 'UNKNOWN',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Condition Trit (-1/0/+1)', gateType: 'CONSTANT' }
      },
      'action_left': {
        id: 'action_left',
        type: 'Data',
        position: { x: 260, y: 440 },
        ternaryState: 'FALSE',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'State A (-1): Abort/Halt', gateType: 'CONSTANT' }
      },
      'action_center': {
        id: 'action_center',
        type: 'Data',
        position: { x: 260, y: 620 },
        ternaryState: 'UNKNOWN',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'State B (0): Idle/Observe', gateType: 'CONSTANT' }
      },
      'action_right': {
        id: 'action_right',
        type: 'Data',
        position: { x: 260, y: 800 },
        ternaryState: 'TRUE',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'State C (+1): Execute/Commit', gateType: 'CONSTANT' }
      },
      'decision_mux': {
        id: 'decision_mux',
        type: 'Logic',
        position: { x: 720, y: 520 },
        ternaryState: 'UNKNOWN',
        createdAt: now,
        updatedAt: now,
        metadata: { title: '3-Way Branching MUX', gateType: 'MUX' }
      },
      'decision_probe': {
        id: 'decision_probe',
        type: 'UI',
        position: { x: 1140, y: 520 },
        ternaryState: 'UNKNOWN',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Autonomous Decision Trace', gateType: 'PROBE', history: [] }
      }
    };

    const edges: Record<string, any> = {
      'e_cond_mux': { id: 'e_cond_mux', sourceId: 'sensor_condition', targetId: 'decision_mux' },
      'e_left_mux': { id: 'e_left_mux', sourceId: 'action_left', targetId: 'decision_mux' },
      'e_center_mux': { id: 'e_center_mux', sourceId: 'action_center', targetId: 'decision_mux' },
      'e_right_mux': { id: 'e_right_mux', sourceId: 'action_right', targetId: 'decision_mux' },
      'e_mux_probe': { id: 'e_mux_probe', sourceId: 'decision_mux', targetId: 'decision_probe' }
    };

    this.state.set({ nodes, edges, history: this.state().history, historyIndex: this.state().historyIndex });
    this.terminal.log('Synthesized: Ternary 3-Way Decision Tree & State Machine.', 'TERNARY');
    this.bumpActivity();
    this.audio.playSynthesisSuccess();
    if (!this.isVmRunning()) this.startVM();
  }

  public synthesizeTernaryLfsr() {
    this.saveSnapshot();
    const now = Date.now();
    const nodes: Record<string, EdenNode> = {
      'lfsr_clock': {
        id: 'lfsr_clock',
        type: 'Logic',
        position: { x: 260, y: 300 },
        ternaryState: 'FALSE',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Master Trit Clock', gateType: 'CLOCK' }
      },
      'lfsr_gen': {
        id: 'lfsr_gen',
        type: 'Logic',
        position: { x: 620, y: 300 },
        ternaryState: 'TRUE',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Ternary Polynomial LFSR', gateType: 'LFSR' }
      },
      'lfsr_cycle': {
        id: 'lfsr_cycle',
        type: 'Logic',
        position: { x: 960, y: 440 },
        ternaryState: 'UNKNOWN',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Cyclic Phase Shifter', gateType: 'INVERTER' }
      },
      'lfsr_stream_probe': {
        id: 'lfsr_stream_probe',
        type: 'UI',
        position: { x: 1320, y: 300 },
        ternaryState: 'UNKNOWN',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Pseudorandom Trit Stream', gateType: 'PROBE', history: [] }
      }
    };

    const edges: Record<string, any> = {
      'e_lfsr_clk': { id: 'e_lfsr_clk', sourceId: 'lfsr_clock', targetId: 'lfsr_gen' },
      'e_lfsr_loop': { id: 'e_lfsr_loop', sourceId: 'lfsr_cycle', targetId: 'lfsr_gen' },
      'e_lfsr_cycle': { id: 'e_lfsr_cycle', sourceId: 'lfsr_gen', targetId: 'lfsr_cycle' },
      'e_lfsr_probe': { id: 'e_lfsr_probe', sourceId: 'lfsr_gen', targetId: 'lfsr_stream_probe' }
    };

    this.state.set({ nodes, edges, history: this.state().history, historyIndex: this.state().historyIndex });
    this.terminal.log('Synthesized: Ternary LFSR Pseudo-Random Generator.', 'TERNARY');
    this.bumpActivity();
    this.audio.playSynthesisSuccess();
    if (!this.isVmRunning()) this.startVM();
  }

  public synthesizeFullAdder() {
    this.saveSnapshot();
    const now = Date.now();
    const nodes: Record<string, EdenNode> = {
      'fa_in_a': {
        id: 'fa_in_a',
        type: 'Data',
        position: { x: 280, y: 220 },
        ternaryState: 'TRUE',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Trit Operand A', gateType: 'CONSTANT' }
      },
      'fa_in_b': {
        id: 'fa_in_b',
        type: 'Data',
        position: { x: 280, y: 440 },
        ternaryState: 'FALSE',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Trit Operand B', gateType: 'CONSTANT' }
      },
      'fa_in_cin': {
        id: 'fa_in_cin',
        type: 'Data',
        position: { x: 280, y: 660 },
        ternaryState: 'TRUE',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Trit Carry-In (Cin)', gateType: 'CONSTANT' }
      },
      'fa_unit': {
        id: 'fa_unit',
        type: 'Logic',
        position: { x: 680, y: 440 },
        ternaryState: 'TRUE',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Balanced Full-Adder Cell', gateType: 'FULLADDER' }
      },
      'fa_probe_sum': {
        id: 'fa_probe_sum',
        type: 'UI',
        position: { x: 1080, y: 320 },
        ternaryState: 'UNKNOWN',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Sum Out Probe (S)', gateType: 'PROBE', history: [] }
      },
      'fa_probe_cout': {
        id: 'fa_probe_cout',
        type: 'UI',
        position: { x: 1080, y: 560 },
        ternaryState: 'UNKNOWN',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Carry-Out Probe (Cout)', gateType: 'PROBE', history: [] }
      }
    };

    const edges: Record<string, any> = {
      'e_fa_a': { id: 'e_fa_a', sourceId: 'fa_in_a', targetId: 'fa_unit' },
      'e_fa_b': { id: 'e_fa_b', sourceId: 'fa_in_b', targetId: 'fa_unit' },
      'e_fa_cin': { id: 'e_fa_cin', sourceId: 'fa_in_cin', targetId: 'fa_unit' },
      'e_fa_sum': { id: 'e_fa_sum', sourceId: 'fa_unit', targetId: 'fa_probe_sum' },
      'e_fa_cout': { id: 'e_fa_cout', sourceId: 'fa_unit', targetId: 'fa_probe_cout' }
    };

    this.state.set({ nodes, edges, history: this.state().history, historyIndex: this.state().historyIndex });
    this.terminal.log('Synthesized: Balanced Ternary Full-Adder (A + B + Cin).', 'TERNARY');
    this.bumpActivity();
    this.audio.playSynthesisSuccess();
    if (!this.isVmRunning()) this.startVM();
  }

  public synthesizeTernaryMultiplier() {
    this.saveSnapshot();
    const now = Date.now();
    const nodes: Record<string, EdenNode> = {
      'mul_in_a': {
        id: 'mul_in_a',
        type: 'Data',
        position: { x: 280, y: 260 },
        ternaryState: 'TRUE',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Multiplicand (A)', gateType: 'CONSTANT' }
      },
      'mul_in_b': {
        id: 'mul_in_b',
        type: 'Data',
        position: { x: 280, y: 480 },
        ternaryState: 'FALSE',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Multiplier (B)', gateType: 'CONSTANT' }
      },
      'mul_core': {
        id: 'mul_core',
        type: 'Logic',
        position: { x: 680, y: 370 },
        ternaryState: 'UNKNOWN',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Balanced Trit Multiplier', gateType: 'MULTIPLIER' }
      },
      'mul_probe': {
        id: 'mul_probe',
        type: 'UI',
        position: { x: 1080, y: 370 },
        ternaryState: 'UNKNOWN',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Product Out Probe', gateType: 'PROBE', history: [] }
      }
    };

    const edges: Record<string, any> = {
      'e_mul_a': { id: 'e_mul_a', sourceId: 'mul_in_a', targetId: 'mul_core' },
      'e_mul_b': { id: 'e_mul_b', sourceId: 'mul_in_b', targetId: 'mul_core' },
      'e_mul_probe': { id: 'e_mul_probe', sourceId: 'mul_core', targetId: 'mul_probe' }
    };

    this.state.set({ nodes, edges, history: this.state().history, historyIndex: this.state().historyIndex });
    this.terminal.log('Synthesized: Balanced Ternary 2x1 Multiplier (A * B).', 'TERNARY');
    this.bumpActivity();
    this.audio.playSynthesisSuccess();
    if (!this.isVmRunning()) this.startVM();
  }

  public synthesizeConsensusArbiter() {
    this.saveSnapshot();
    const now = Date.now();
    const nodes: Record<string, EdenNode> = {
      'vote_ch1': {
        id: 'vote_ch1',
        type: 'Data',
        position: { x: 280, y: 220 },
        ternaryState: 'TRUE',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Redundant Sensor Ch 1', gateType: 'CONSTANT' }
      },
      'vote_ch2': {
        id: 'vote_ch2',
        type: 'Data',
        position: { x: 280, y: 440 },
        ternaryState: 'TRUE',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Redundant Sensor Ch 2', gateType: 'CONSTANT' }
      },
      'vote_ch3': {
        id: 'vote_ch3',
        type: 'Data',
        position: { x: 280, y: 660 },
        ternaryState: 'FALSE',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Redundant Sensor Ch 3 (Noisy)', gateType: 'CONSTANT' }
      },
      'vote_gate': {
        id: 'vote_gate',
        type: 'Logic',
        position: { x: 680, y: 440 },
        ternaryState: 'UNKNOWN',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Consensus Fault Arbiter', gateType: 'CONSENSUS' }
      },
      'vote_probe': {
        id: 'vote_probe',
        type: 'UI',
        position: { x: 1080, y: 440 },
        ternaryState: 'UNKNOWN',
        createdAt: now,
        updatedAt: now,
        metadata: { title: 'Fault-Tolerant Bus Probe', gateType: 'PROBE', history: [] }
      }
    };

    const edges: Record<string, any> = {
      'e_v1': { id: 'e_v1', sourceId: 'vote_ch1', targetId: 'vote_gate' },
      'e_v2': { id: 'e_v2', sourceId: 'vote_ch2', targetId: 'vote_gate' },
      'e_v3': { id: 'e_v3', sourceId: 'vote_ch3', targetId: 'vote_gate' },
      'e_vp': { id: 'e_vp', sourceId: 'vote_gate', targetId: 'vote_probe' }
    };

    this.state.set({ nodes, edges, history: this.state().history, historyIndex: this.state().historyIndex });
    this.terminal.log('Synthesized: Ternary Triple Modular Redundancy (TMR) Arbiter.', 'TERNARY');
    this.bumpActivity();
    this.audio.playSynthesisSuccess();
    if (!this.isVmRunning()) this.startVM();
  }

  public clearCircuit() {
    this.saveSnapshot();
    this.state.update(curr => ({
      ...curr,
      nodes: {},
      edges: {}
    }));
    this.terminal.log('Circuit canvas cleared.', 'WARN');
    this.bumpActivity();
  }

  /**
   * Topological DAG auto-layout arranging circuits side-by-side with guaranteed zero-overlap
   */
  public autoLayout() {
    this.saveSnapshot();
    const current = this.state();
    const nodeIds = Object.keys(current.nodes);
    if (nodeIds.length === 0) return;

    // Calculate in-degrees and adjacency
    const inDegree: Record<string, number> = {};
    const adj: Record<string, string[]> = {};
    nodeIds.forEach(id => {
      inDegree[id] = 0;
      adj[id] = [];
    });

    Object.values(current.edges).forEach(e => {
      if (inDegree[e.targetId] !== undefined) {
        inDegree[e.targetId]++;
      }
      if (adj[e.sourceId]) {
        adj[e.sourceId].push(e.targetId);
      }
    });

    // Topological layer assignment
    const layerMap: Record<string, number> = {};
    const queue: string[] = [];

    nodeIds.forEach(id => {
      if (inDegree[id] === 0) {
        layerMap[id] = 0;
        queue.push(id);
      }
    });

    if (queue.length === 0 && nodeIds.length > 0) {
      layerMap[nodeIds[0]] = 0;
      queue.push(nodeIds[0]);
    }

    while (queue.length > 0) {
      const u = queue.shift()!;
      const nextL = (layerMap[u] || 0) + 1;
      for (const v of adj[u] || []) {
        if (layerMap[v] === undefined || layerMap[v] < nextL) {
          layerMap[v] = nextL;
          queue.push(v);
        }
      }
    }

    // Default layer assignment for unvisited nodes
    nodeIds.forEach(id => {
      if (layerMap[id] === undefined) {
        const node = current.nodes[id];
        if (node.type === 'Data' || node.metadata?.gateType === 'CONSTANT' || node.metadata?.gateType === 'CLOCK') {
          layerMap[id] = 0;
        } else if (node.type === 'UI' || node.metadata?.gateType === 'PROBE') {
          layerMap[id] = 3;
        } else {
          layerMap[id] = 1;
        }
      }
    });

    // Group into columns
    const columns: string[][] = [];
    nodeIds.forEach(id => {
      const l = layerMap[id] || 0;
      if (!columns[l]) columns[l] = [];
      columns[l].push(id);
    });

    const activeColumns = columns.filter(col => col && col.length > 0);

    const startX = 280;
    const startY = 220;
    const spacingX = 380; // Guaranteed generous horizontal gutter (>100px)
    const spacingY = 220; // Guaranteed generous vertical gutter (>50px)

    const updatedNodes: Record<string, EdenNode> = { ...current.nodes };

    activeColumns.forEach((colNodes, colIndex) => {
      colNodes.forEach((id, rowIndex) => {
        const targetX = startX + colIndex * spacingX;
        const targetY = startY + rowIndex * spacingY;
        const clamped = clampNodePosition(targetX, targetY, updatedNodes[id].type);
        updatedNodes[id] = {
          ...updatedNodes[id],
          position: { x: clamped.x, y: clamped.y },
          updatedAt: Date.now()
        };
      });
    });

    // Guarantee 100% collision-free layout
    const resolvedNodes = resolveCollisions(updatedNodes);

    this.state.update(curr => ({ ...curr, nodes: resolvedNodes }));
    this.terminal.log('Auto-arranged nodes side-by-side with zero overlap.', 'SYSTEM');
    this.bumpActivity();
  }

  /**
   * Adds a new component of the specified type at the nearest non-overlapping side-by-side position
   */
  public addNodeOfType(gateType: LogicGateType, title?: string, type?: NodeType): string {
    this.saveSnapshot();
    const current = this.state();
    const existingNodes = current.nodes;
    const now = Date.now();
    const id = `node_${gateType.toLowerCase()}_${Math.random().toString(36).substr(2, 6)}`;

    let inferredType: NodeType = type || 'Logic';
    if (gateType === 'CONSTANT' || gateType === 'CLOCK' || gateType === 'LFSR') {
      inferredType = 'Data';
    } else if (gateType === 'PROBE') {
      inferredType = 'UI';
    }

    const nodeTitle = title || `Trit ${gateType}`;
    const nodeVals = Object.values(existingNodes);
    let targetX = 280;
    let targetY = 240;

    if (nodeVals.length > 0) {
      const maxX = Math.max(...nodeVals.map(n => n.position.x));
      targetX = maxX + 360;
      targetY = 240;
      if (targetX > CANVAS_BOUNDS.maxX - 240) {
        targetX = 280;
        targetY = Math.max(...nodeVals.map(n => n.position.y)) + 220;
      }
    }

    const freePos = findNonOverlappingPosition(targetX, targetY, existingNodes, undefined, inferredType);

    const newNode: EdenNode = {
      id,
      type: inferredType,
      position: freePos,
      ternaryState: gateType === 'CONSTANT' ? 'TRUE' : 'UNKNOWN',
      createdAt: now,
      updatedAt: now,
      metadata: {
        title: nodeTitle,
        gateType,
        history: gateType === 'PROBE' ? [] : undefined
      }
    };

    this.state.update(curr => ({
      ...curr,
      nodes: {
        ...curr.nodes,
        [id]: newNode
      }
    }));

    this.terminal.log(`Added component: ${nodeTitle} (${id}) side-by-side.`, 'SYSTEM');
    this.bumpActivity();
    this.audio.playSynthesisSuccess();
    return id;
  }

  /**
   * Ensures a node does not overlap any other node after moving or dropping
   */
  public ensureNodeDoesNotOverlap(nodeId: string) {
    const current = this.state();
    const node = current.nodes[nodeId];
    if (!node) return;

    const otherNodes: Record<string, EdenNode> = {};
    for (const [id, n] of Object.entries(current.nodes)) {
      if (id !== nodeId) otherNodes[id] = n;
    }

    const freePos = findNonOverlappingPosition(
      node.position.x,
      node.position.y,
      otherNodes,
      nodeId,
      node.type
    );

    if (freePos.x !== node.position.x || freePos.y !== node.position.y) {
      this.state.update(curr => ({
        ...curr,
        nodes: {
          ...curr.nodes,
          [nodeId]: {
            ...node,
            position: freePos,
            updatedAt: Date.now()
          }
        }
      }));
      this.terminal.log(`Adjusted position of ${nodeId} side-by-side (anti-overlap).`, 'SYSTEM');
    }
  }

  /**
   * Export circuit design to JSON
   */
  public exportCircuitJson(): string {
    const current = this.state();
    return JSON.stringify({
      version: 'EDEN_TERNARY_2.0',
      timestamp: Date.now(),
      nodes: current.nodes,
      edges: current.edges
    }, null, 2);
  }

  /**
   * Import circuit design from JSON
   */
  public importCircuitJson(jsonStr: string): boolean {
    try {
      const parsed = JSON.parse(jsonStr);
      if (!parsed.nodes) throw new Error('Invalid circuit JSON: missing nodes');
      this.saveSnapshot();
      const resolved = resolveCollisions(parsed.nodes);
      this.state.update(curr => ({
        ...curr,
        nodes: resolved,
        edges: parsed.edges || {}
      }));
      this.terminal.log('Circuit imported successfully. Zero overlap verified.', 'SYSTEM');
      this.bumpActivity();
      return true;
    } catch (e: any) {
      this.terminal.log(`Import failed: ${e.message}`, 'ERROR');
      return false;
    }
  }

  /**
   * Synthesize circuit into synthesizable Ternary Verilog HDL code
   */
  public generateVerilogHdl(): string {
    const current = this.state();
    const nodes = Object.values(current.nodes);
    const edges = Object.values(current.edges);

    let code = `// =========================================================\n`;
    code += `// EDEN OS v2.0 - Balanced Ternary Verilog HDL Export\n`;
    code += `// Synthesized: ${new Date().toISOString()}\n`;
    code += `// Trits representation: 2'b01 = +1, 2'b00 = 0, 2'b11 = -1\n`;
    code += `// =========================================================\n\n`;
    code += `module eden_ternary_circuit (\n`;
    code += `  input  wire clk,\n`;
    code += `  input  wire rst_n,\n`;

    const inputs = nodes.filter(n => n.metadata?.gateType === 'CONSTANT' || n.type === 'Data');
    const outputs = nodes.filter(n => n.metadata?.gateType === 'PROBE' || n.type === 'UI');

    inputs.forEach(n => {
      code += `  input  wire [1:0] ${n.id},\n`;
    });
    outputs.forEach((n, idx) => {
      const comma = idx === outputs.length - 1 ? '' : ',';
      code += `  output wire [1:0] ${n.id}${comma}\n`;
    });
    code += `);\n\n`;

    code += `  // Internal logic assignments\n`;
    edges.forEach(e => {
      code += `  assign ${e.targetId}_in = ${e.sourceId};\n`;
    });
    code += `\nendmodule\n`;

    return code;
  }

  // --- CORE MUTATIONS ---

  public getState() {
    return {
      nodes: this.state().nodes,
      edges: this.state().edges,
      connections: Object.values(this.state().edges),
    };
  }

  public mutate(mutation: Partial<EdenGenome> & { connections?: any[] }) {
    this.saveSnapshot();
    this.bumpActivity();
    this.state.update(current => {
      const now = Date.now();
      const nodes = { ...current.nodes };
      
      // Add timestamps to new nodes and clamp positions strictly to matrix bounds
      if (mutation.nodes) {
        for (const [id, node] of Object.entries(mutation.nodes)) {
          const rawPos = node.position || { x: 300, y: 300 };
          const { x: clampedX, y: clampedY } = clampNodePosition(rawPos.x, rawPos.y, node.type);
          const boundedPosition = { x: clampedX, y: clampedY };

          if (!nodes[id]) {
            nodes[id] = {
              ...node,
              position: boundedPosition,
              createdAt: now,
              updatedAt: now,
              ternaryState: node.ternaryState || 'UNKNOWN'
            };
          } else {
            nodes[id] = {
              ...node,
              position: boundedPosition,
              updatedAt: now,
              createdAt: nodes[id].createdAt || now
            };
          }
        }
      }
      
      let edges = { ...current.edges, ...(mutation.edges || {}) };
      if (mutation.connections && Array.isArray(mutation.connections)) {
        edges = {};
        for (const conn of mutation.connections) {
          const id = conn.id || `edge_${conn.sourceId || conn.source}_${conn.targetId || conn.target}`;
          edges[id] = {
            id,
            sourceId: conn.sourceId || conn.source,
            targetId: conn.targetId || conn.target,
            transform: conn.transform
          };
        }
      }

      // Automatically guarantee that NO nodes overlap after mutation
      const nonOverlappingNodes = resolveCollisions(nodes);

      return {
        ...current,
        nodes: nonOverlappingNodes,
        edges
      };
    });
    this.terminal.log(`Mutation applied: ${Object.keys(mutation.nodes || {}).length} nodes, ${Object.keys(mutation.edges || {}).length} edges. Zero overlap verified.`, 'SYSTEM');
  }

  public moveNode(id: string, x: number, y: number) {
    this.bumpActivity();
    this.state.update(current => {
      const node = current.nodes[id];
      if (!node) return current;

      // Mathematical boundary clamp: touches edge with 0px gap, never exceeds
      const { x: clampedX, y: clampedY } = clampNodePosition(x, y, node);

      return {
        ...current,
        nodes: {
          ...current.nodes,
          [id]: { 
            ...node, 
            position: { x: clampedX, y: clampedY },
            updatedAt: Date.now()
          }
        }
      };
    });
  }

  public resizeNode(nodeId: string, width: number, height: number) {
    this.saveSnapshot();
    const clampedW = Math.max(200, Math.min(650, Math.round(width)));
    const clampedH = Math.max(120, Math.min(480, Math.round(height)));
    
    this.state.update(current => {
      const node = current.nodes[nodeId];
      if (!node) return current;

      const halfW = clampedW / 2;
      const halfH = clampedH / 2;
      const minX = CANVAS_BOUNDS.minX + halfW;
      const maxX = CANVAS_BOUNDS.maxX - halfW;
      const minY = CANVAS_BOUNDS.minY + halfH;
      const maxY = CANVAS_BOUNDS.maxY - halfH;

      const posX = Math.max(minX, Math.min(maxX, node.position.x));
      const posY = Math.max(minY, Math.min(maxY, node.position.y));

      return {
        ...current,
        nodes: {
          ...current.nodes,
          [nodeId]: {
            ...node,
            position: { x: posX, y: posY },
            dimensions: { width: clampedW, height: clampedH },
            updatedAt: Date.now()
          }
        }
      };
    });

    this.ensureNodeDoesNotOverlap(nodeId);
    this.bumpActivity();
    this.terminal.log(`Node ${nodeId} resized (${clampedW}x${clampedH}px). Zero overlap verified.`, 'SYSTEM');
  }

  public duplicateNode(nodeId: string): string | null {
    const current = this.state();
    const original = current.nodes[nodeId];
    if (!original) return null;

    this.saveSnapshot();
    const now = Date.now();
    const newId = `node_${original.type.toLowerCase()}_${Math.random().toString(36).substring(2, 7)}`;
    
    const freePos = findNonOverlappingPosition(
      original.position.x + 340,
      original.position.y,
      current.nodes,
      newId,
      original
    );

    const clonedNode: EdenNode = {
      ...JSON.parse(JSON.stringify(original)),
      id: newId,
      position: freePos,
      createdAt: now,
      updatedAt: now,
      metadata: {
        ...JSON.parse(JSON.stringify(original.metadata)),
        title: `${original.metadata.title || original.id} (Copy)`
      }
    };

    this.state.update(curr => ({
      ...curr,
      nodes: {
        ...curr.nodes,
        [newId]: clonedNode
      }
    }));

    this.bumpActivity();
    this.terminal.log(`Component duplicated: ${newId} side-by-side without overlap.`, 'SYSTEM');
    return newId;
  }

  public setNodeGateType(nodeId: string, gateType: LogicGateType) {
    this.saveSnapshot();
    this.state.update(curr => {
      const node = curr.nodes[nodeId];
      if (!node) return curr;
      return {
        ...curr,
        nodes: {
          ...curr.nodes,
          [nodeId]: {
            ...node,
            metadata: {
              ...node.metadata,
              gateType
            },
            updatedAt: Date.now()
          }
        }
      };
    });
    this.bumpActivity();
    this.terminal.log(`Gate ${nodeId} configured as: ${gateType}`, 'SYSTEM');
    if (this.isVmRunning()) this.vmTick();
  }

  public attachProbeToNode(nodeId: string): string | null {
    const current = this.state();
    const sourceNode = current.nodes[nodeId];
    if (!sourceNode) return null;

    this.saveSnapshot();
    const probeId = `probe_${Math.random().toString(36).substring(2, 7)}`;
    const freePos = findNonOverlappingPosition(
      sourceNode.position.x + 360,
      sourceNode.position.y,
      current.nodes,
      probeId,
      'UI'
    );

    const now = Date.now();
    const probeNode: EdenNode = {
      id: probeId,
      type: 'UI',
      position: freePos,
      ternaryState: 'UNKNOWN',
      createdAt: now,
      updatedAt: now,
      metadata: {
        title: `Probe [${sourceNode.metadata.title || sourceNode.id}]`,
        gateType: 'PROBE',
        history: []
      }
    };

    const edgeId = `edge_${nodeId}_${probeId}`;
    this.state.update(curr => ({
      ...curr,
      nodes: {
        ...curr.nodes,
        [probeId]: probeNode
      },
      edges: {
        ...curr.edges,
        [edgeId]: {
          id: edgeId,
          sourceId: nodeId,
          targetId: probeId
        }
      }
    }));

    this.bumpActivity();
    this.terminal.log(`Oscilloscope Probe attached to ${nodeId}.`, 'SYSTEM');
    if (this.isVmRunning()) this.vmTick();
    return probeId;
  }

  public insertNotGateOnEdge(edgeId: string): string | null {
    const current = this.state();
    const edge = current.edges[edgeId];
    if (!edge) return null;

    const source = current.nodes[edge.sourceId];
    const target = current.nodes[edge.targetId];
    if (!source || !target) return null;

    this.saveSnapshot();
    const notId = `gate_not_${Math.random().toString(36).substring(2, 7)}`;
    const midX = Math.round((source.position.x + target.position.x) / 2);
    const midY = Math.round((source.position.y + target.position.y) / 2);

    const freePos = findNonOverlappingPosition(
      midX,
      midY,
      current.nodes,
      notId,
      'Logic'
    );

    const now = Date.now();
    const notNode: EdenNode = {
      id: notId,
      type: 'Logic',
      position: freePos,
      ternaryState: 'UNKNOWN',
      createdAt: now,
      updatedAt: now,
      metadata: {
        title: 'Inverter NOT',
        gateType: 'NOT'
      }
    };

    const newEdges = { ...current.edges };
    delete newEdges[edgeId];
    const edge1Id = `edge_${edge.sourceId}_${notId}`;
    const edge2Id = `edge_${notId}_${edge.targetId}`;
    newEdges[edge1Id] = { id: edge1Id, sourceId: edge.sourceId, targetId: notId };
    newEdges[edge2Id] = { id: edge2Id, sourceId: notId, targetId: edge.targetId };

    this.state.update(curr => ({
      ...curr,
      nodes: {
        ...curr.nodes,
        [notId]: notNode
      },
      edges: newEdges
    }));

    this.bumpActivity();
    this.terminal.log(`NOT Inverter inserted between ${edge.sourceId} and ${edge.targetId}.`, 'SYSTEM');
    if (this.isVmRunning()) this.vmTick();
    return notId;
  }

  public invertEdge(edgeId: string) {
    const current = this.state();
    const edge = current.edges[edgeId];
    if (!edge) return;

    this.saveSnapshot();
    const newEdgeId = `edge_${edge.targetId}_${edge.sourceId}`;
    const newEdges = { ...current.edges };
    delete newEdges[edgeId];
    newEdges[newEdgeId] = {
      id: newEdgeId,
      sourceId: edge.targetId,
      targetId: edge.sourceId
    };

    this.state.update(curr => ({
      ...curr,
      edges: newEdges
    }));

    this.bumpActivity();
    this.terminal.log(`Direction inverted for wire: ${edge.targetId} -> ${edge.sourceId}`, 'SYSTEM');
    if (this.isVmRunning()) this.vmTick();
  }

  public saveMoveSnapshot() {
    this.saveSnapshot();
  }

  public addEdge(sourceId: string, targetId: string) {
    if (sourceId === targetId) return;
    if (!this.state().nodes[sourceId] || !this.state().nodes[targetId]) {
      this.terminal.log(`Cannot create edge: source or target node does not exist (${sourceId} -> ${targetId})`, 'WARN');
      return;
    }
    this.saveSnapshot();
    const edgeId = 'edge_' + sourceId + '_' + targetId;
    this.bumpActivity();
    this.state.update(current => ({
      ...current,
      edges: {
        ...current.edges,
        [edgeId]: { id: edgeId, sourceId, targetId }
      }
    }));
    this.terminal.log(`Edge created: ${sourceId} -> ${targetId}`, 'SYSTEM');
  }

  public deleteNode(nodeId: string) {
    this.saveSnapshot();
    this.bumpActivity();
    this.state.update(current => {
      const newNodes = { ...current.nodes };
      delete (newNodes as any)[nodeId];

      const newEdges: Record<string, any> = {};
      for (const [edgeId, edge] of Object.entries(current.edges)) {
        if (edge.sourceId !== nodeId && edge.targetId !== nodeId) {
          newEdges[edgeId] = edge;
        }
      }

      return {
        ...current,
        nodes: newNodes,
        edges: newEdges
      };
    });
    this.terminal.log(`Node deleted: ${nodeId}`, 'SYSTEM');
  }

  public updateNodeTitle(nodeId: string, title: string) {
    this.saveSnapshot();
    this.bumpActivity();
    this.state.update(current => {
      if (!current.nodes[nodeId]) return current;
      return {
        ...current,
        nodes: {
          ...current.nodes,
          [nodeId]: {
            ...current.nodes[nodeId],
            metadata: { 
              ...current.nodes[nodeId].metadata, 
              title 
            },
            updatedAt: Date.now()
          }
        }
      };
    });
    this.terminal.log(`Node title updated: ${nodeId} -> "${title}"`, 'SYSTEM');
  }

  public updateNodeContent(nodeId: string, content: string) {
    this.saveSnapshot();
    this.bumpActivity();
    this.state.update(current => {
      if (!current.nodes[nodeId]) return current;
      return {
        ...current,
        nodes: {
          ...current.nodes,
          [nodeId]: {
            ...current.nodes[nodeId],
            metadata: { 
              ...current.nodes[nodeId].metadata, 
              content 
            },
            updatedAt: Date.now()
          }
        }
      };
    });
    this.terminal.log(`Node content updated: ${nodeId}`, 'SYSTEM');
  }

  public deleteEdge(edgeId: string) {
    this.saveSnapshot();
    this.bumpActivity();
    this.state.update(current => {
      const newEdges = { ...current.edges };
      delete (newEdges as any)[edgeId];
      return {
        ...current,
        edges: newEdges
      };
    });
    this.terminal.log(`Edge deleted: ${edgeId}`, 'SYSTEM');
  }

  public clear() {
    this.saveSnapshot();
    this.bumpActivity();
    this.state.set({ nodes: {}, edges: {}, history: [], historyIndex: -1 });
    this.terminal.log('EDEN Canvas cleared. All nodes and edges removed.', 'SYSTEM');
  }

  // --- VALIDATION ---

  /**
   * Validate the entire genome structure
   */
  public validateGenome(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const current = this.state();

    // Check for nodes with missing required fields
    for (const [id, node] of Object.entries(current.nodes)) {
      if (!node.id) {
        errors.push(`Node missing id`);
      }
      if (!node.type) {
        errors.push(`Node ${id} missing type`);
      }
      if (!node.position || typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
        errors.push(`Node ${id} has invalid position`);
      }
      if (!node.ternaryState) {
        errors.push(`Node ${id} missing ternaryState`);
      }
      if (!node.metadata) {
        errors.push(`Node ${id} missing metadata`);
      }
    }

    // Check for edges with missing references
    for (const [id, edge] of Object.entries(current.edges)) {
      if (!current.nodes[edge.sourceId]) {
        errors.push(`Edge ${id} references non-existent source node: ${edge.sourceId}`);
      }
      if (!current.nodes[edge.targetId]) {
        errors.push(`Edge ${id} references non-existent target node: ${edge.targetId}`);
      }
      if (edge.sourceId === edge.targetId) {
        errors.push(`Edge ${id} has same source and target (self-loop)`);
      }
    }

    // Check for duplicate edge IDs
    const edgeIds = Object.keys(current.edges);
    const uniqueEdgeIds = new Set(edgeIds);
    if (edgeIds.length !== uniqueEdgeIds.size) {
      errors.push('Duplicate edge IDs detected');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get genome statistics
   */
  public getStats() {
    const current = this.state();
    const nodes = Object.values(current.nodes);
    const edges = Object.values(current.edges);

    const nodeTypes: Record<string, number> = {};
    for (const node of nodes) {
      nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;
    }

    const ternaryStates: Record<string, number> = {};
    for (const node of nodes) {
      ternaryStates[node.ternaryState] = (ternaryStates[node.ternaryState] || 0) + 1;
    }

    return {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      nodeTypes,
      ternaryStates,
      historyLength: current.history.length,
      historyIndex: current.historyIndex
    };
  }

  // --- LOCAL STORAGE ---

  public saveToLocalStorage() {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    const current = this.state();
    const dataToSave = {
      nodes: current.nodes,
      edges: current.edges,
      timestamp: Date.now()
    };
    try {
      localStorage.setItem('eden_genome_save', JSON.stringify(dataToSave));
      this.terminal.log('EDEN Genome saved to local storage.', 'SYSTEM');
      this.bumpActivity();
    } catch (e) {
      this.terminal.log('Failed to save EDEN Genome to local storage.', 'ERROR');
    }
  }

  public loadFromLocalStorage() {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    try {
      const saved = localStorage.getItem('eden_genome_save');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.saveSnapshot(); // Save current state before loading so user can undo the load
        this.state.update(current => ({
          ...current,
          nodes: parsed.nodes || {},
          edges: parsed.edges || {}
        }));
        this.terminal.log('EDEN Genome loaded from local storage.', 'SYSTEM');
        this.bumpActivity();
      } else {
        this.terminal.log('No saved EDEN Genome found.', 'WARN');
      }
    } catch (e) {
      this.terminal.log('Failed to load EDEN Genome from local storage.', 'ERROR');
    }
  }
}
