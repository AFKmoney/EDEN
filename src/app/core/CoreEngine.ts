import { signal, computed, Injectable, inject } from '@angular/core';
import { EdenGenome } from '../types/genome';
import { TernaryValue } from '../types/node';
import { TerminalService } from './TerminalService';

@Injectable({ providedIn: 'root' })
export class CoreEngine {
  private terminal = inject(TerminalService);

  private state = signal<EdenGenome>({ nodes: {}, edges: {}, history: [], historyIndex: -1 });
  public readonly genome = this.state.asReadonly();

  public readonly canUndo = computed(() => this.state().historyIndex >= 0);
  public readonly canRedo = computed(() => this.state().historyIndex < this.state().history.length - 1);

  private activity = signal(0);
  public readonly activityLevel = this.activity.asReadonly();

  // Ternary VM State
  public isVmRunning = signal<boolean>(false);
  private vmInterval: any;

  constructor() {
    // Decay activity over time to return to base color
    setInterval(() => {
      if (this.activity() > 0) {
        this.activity.update(v => Math.max(0, v - 2));
      }
    }, 100);
    this.terminal.log('EDEN Core Engine Initialized.', 'SYSTEM');
  }

  private bumpActivity() {
    this.activity.update(v => Math.min(100, v + 30));
  }

  // --- HISTORY MANAGEMENT ---

  private saveSnapshot() {
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
      clearInterval(this.vmInterval);
      this.isVmRunning.set(false);
      this.terminal.log('Ternary VM stopped.', 'SYSTEM');
    } else {
      this.isVmRunning.set(true);
      this.terminal.log('Ternary VM started. Quantum states active.', 'SYSTEM');
      this.vmInterval = setInterval(() => this.vmTick(), 1500); // 1.5s per tick for visual feedback
    }
  }

  public setNodeTernaryState(nodeId: string, state: TernaryValue) {
    this.saveSnapshot();
    this.state.update(current => {
      if (!current.nodes[nodeId]) return current;
      return {
        ...current,
        nodes: {
          ...current.nodes,
          [nodeId]: { ...current.nodes[nodeId], ternaryState: state }
        }
      };
    });
    this.terminal.log(`Node [${nodeId}] forced to ${state}`, 'TERNARY');
    this.bumpActivity();
  }

  private vmTick() {
    this.terminal.log('VM Tick: Propagating ternary states...', 'INFO');
    const current = this.state();
    const newNodes = { ...current.nodes };
    let stateChanged = false;

    // 1. Gather inputs for each node based on edges
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

    // 2. Evaluate Ternary logic (Kleene Logic)
    for (const nodeId of Object.keys(current.nodes)) {
      const node = current.nodes[nodeId];
      const inputs = nodeInputs[nodeId];
      
      // If no inputs, keep current state
      if (inputs.length === 0) continue;

      const gate = node.metadata.gateType || 'AND';
      const newState = this.evaluateTernary(inputs, gate);

      if (node.ternaryState !== newState) {
        newNodes[nodeId] = { ...node, ternaryState: newState };
        stateChanged = true;
        this.terminal.log(`Node [${node.metadata.title || nodeId}] evaluated to ${newState} via ${gate}`, 'TERNARY');
      }
    }

    // 3. Apply updates if any
    if (stateChanged) {
      this.state.update(state => ({ ...state, nodes: newNodes }));
      this.bumpActivity();
    }
  }

  private evaluateTernary(inputs: TernaryValue[], gate: 'AND' | 'OR' | 'NOT'): TernaryValue {
    const toNum = (v: TernaryValue) => v === 'TRUE' ? 1 : v === 'FALSE' ? -1 : 0;
    const fromNum = (n: number): TernaryValue => n === 1 ? 'TRUE' : n === -1 ? 'FALSE' : 'UNKNOWN';

    if (gate === 'AND') {
      return fromNum(Math.min(...inputs.map(toNum)));
    } else if (gate === 'OR') {
      return fromNum(Math.max(...inputs.map(toNum)));
    } else if (gate === 'NOT') {
      return fromNum(-toNum(inputs[0])); // Inverts the first input
    }
    return 'UNKNOWN';
  }

  // --- CORE MUTATIONS ---

  public mutate(mutation: Partial<EdenGenome>) {
    this.saveSnapshot();
    this.bumpActivity();
    this.state.update(current => {
      return {
        ...current,
        nodes: { ...current.nodes, ...mutation.nodes },
        edges: { ...current.edges, ...mutation.edges }
      };
    });
  }

  public moveNode(id: string, x: number, y: number) {
    this.bumpActivity();
    this.state.update(current => ({
      ...current,
      nodes: {
        ...current.nodes,
        [id]: { ...current.nodes[id], position: { x, y } }
      }
    }));
  }

  public saveMoveSnapshot() {
    this.saveSnapshot();
  }

  public addEdge(sourceId: string, targetId: string) {
    if (sourceId === targetId) return;
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
  }

  public deleteNode(nodeId: string) {
    this.saveSnapshot();
    this.bumpActivity();
    this.state.update(current => {
      const newNodes = { ...current.nodes };
      delete newNodes[nodeId];

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
            metadata: { ...current.nodes[nodeId].metadata, title }
          }
        }
      };
    });
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
            metadata: { ...current.nodes[nodeId].metadata, content }
          }
        }
      };
    });
  }

  public deleteEdge(edgeId: string) {
    this.saveSnapshot();
    this.bumpActivity();
    this.state.update(current => {
      const newEdges = { ...current.edges };
      delete newEdges[edgeId];
      return {
        ...current,
        edges: newEdges
      };
    });
  }

  public clear() {
    this.saveSnapshot();
    this.bumpActivity();
    this.state.set({ nodes: {}, edges: {}, history: [], historyIndex: -1 });
  }

  // --- LOCAL STORAGE ---

  public saveToLocalStorage() {
    const current = this.state();
    const dataToSave = {
      nodes: current.nodes,
      edges: current.edges
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
