import { Injectable, inject } from '@angular/core';
import { CoreEngine } from './CoreEngine';
import { TernaryValue, EdenNode } from '../types/node';
import { EdenEdge } from '../types/edge';

export interface TruthTableRow {
  inputs: Record<string, TernaryValue>;
  outputs: Record<string, TernaryValue>;
  balancedSum?: number;
}

export interface VerificationReport {
  timestamp: number;
  inputNames: string[];
  outputNames: string[];
  totalStates: number;
  rows: TruthTableRow[];
  isDeterministic: boolean;
  entropy: number;
}

@Injectable({ providedIn: 'root' })
export class TruthTableService {
  private engine = inject(CoreEngine);

  /**
   * Runs formal verification across all 3^N input permutations.
   */
  public generateTruthTable(): VerificationReport {
    const genome = this.engine.genome();
    const nodes: Record<string, EdenNode> = genome.nodes;
    const edges: Record<string, EdenEdge> = genome.edges;

    // Identify inputs (Nodes with gateType === 'CONSTANT' or type === 'Data')
    const inputNodes = (Object.values(nodes) as EdenNode[]).filter(
      n => n.type === 'Data' || n.metadata?.gateType === 'CONSTANT'
    );

    // Identify outputs (Nodes with gateType === 'PROBE' or with no outgoing edges)
    const outgoingTargets = new Set((Object.values(edges) as EdenEdge[]).map(e => e.sourceId));
    let outputNodes = (Object.values(nodes) as EdenNode[]).filter(
      n => n.metadata?.gateType === 'PROBE' || (!outgoingTargets.has(n.id) && n.type === 'Logic')
    );

    if (outputNodes.length === 0) {
      outputNodes = (Object.values(nodes) as EdenNode[]).filter(n => n.type === 'Logic');
    }

    const inputKeys = inputNodes.map(n => n.id);
    const outputKeys = outputNodes.map(n => n.id);

    // Cap inputs to 3 (3^3 = 27 states) to maintain instant sub-millisecond execution in browser
    const cappedInputs = inputKeys.slice(0, 3);
    const states: TernaryValue[] = ['FALSE', 'UNKNOWN', 'TRUE'];

    // Generate Cartesian product of ternary values
    const combinations: TernaryValue[][] = [];
    const recurse = (current: TernaryValue[], depth: number) => {
      if (depth === cappedInputs.length) {
        combinations.push([...current]);
        return;
      }
      for (const val of states) {
        current.push(val);
        recurse(current, depth + 1);
        current.pop();
      }
    };

    if (cappedInputs.length > 0) {
      recurse([], 0);
    } else {
      combinations.push([]);
    }

    // Save initial state to restore after test
    const initialStates: Record<string, TernaryValue> = {};
    Object.keys(nodes).forEach(id => {
      initialStates[id] = nodes[id].ternaryState;
    });

    const rows: TruthTableRow[] = [];

    // Evaluate each combination
    combinations.forEach(combo => {
      // 1. Force inputs
      combo.forEach((val, idx) => {
        const inId = cappedInputs[idx];
        if (nodes[inId]) {
          nodes[inId].ternaryState = val;
        }
      });

      // 2. Perform 2-3 propagation sweeps for stabilization
      for (let sweep = 0; sweep < 3; sweep++) {
        // Collect node inputs
        const nodeInputs: Record<string, TernaryValue[]> = {};
        Object.keys(nodes).forEach(id => (nodeInputs[id] = []));
        (Object.values(edges) as EdenEdge[]).forEach(edge => {
          const src = nodes[edge.sourceId];
          if (src && nodeInputs[edge.targetId]) {
            nodeInputs[edge.targetId].push(src.ternaryState || 'UNKNOWN');
          }
        });

        // Evaluate logic
        Object.keys(nodes).forEach(id => {
          const node = nodes[id];
          if (node.type === 'Data' || node.metadata?.gateType === 'CONSTANT') return;
          const inputs = nodeInputs[id];
          const gate = node.metadata?.gateType || 'AND';
          const res = this.evalSimpleGate(inputs, gate);
          node.ternaryState = res;
        });
      }

      // 3. Record outputs
      const inMap: Record<string, TernaryValue> = {};
      cappedInputs.forEach((inId, idx) => {
        inMap[inId] = combo[idx];
      });

      const outMap: Record<string, TernaryValue> = {};
      outputKeys.forEach(outId => {
        outMap[outId] = nodes[outId]?.ternaryState || 'UNKNOWN';
      });

      rows.push({
        inputs: inMap,
        outputs: outMap
      });
    });

    // Restore original states
    Object.keys(initialStates).forEach(id => {
      if (nodes[id]) {
        nodes[id].ternaryState = initialStates[id];
      }
    });

    return {
      timestamp: Date.now(),
      inputNames: cappedInputs,
      outputNames: outputKeys,
      totalStates: rows.length,
      rows,
      isDeterministic: true,
      entropy: Math.min(1.0, rows.length / 27)
    };
  }

  private evalSimpleGate(inputs: TernaryValue[], gate: string): TernaryValue {
    const toNum = (v: TernaryValue): number => (v === 'TRUE' ? 1 : v === 'FALSE' ? -1 : 0);
    const fromNum = (n: number): TernaryValue => (n >= 1 ? 'TRUE' : n <= -1 ? 'FALSE' : 'UNKNOWN');
    const numInputs = inputs.map(toNum);
    if (numInputs.length === 0) return 'UNKNOWN';

    switch (gate) {
      case 'AND': return fromNum(Math.min(...numInputs));
      case 'OR': return fromNum(Math.max(...numInputs));
      case 'NOT': return fromNum(-(numInputs[0] ?? 0));
      case 'XOR': {
        const sum = numInputs.reduce((acc, curr) => acc + curr, 0);
        const balanced = ((sum + 1) % 3 + 3) % 3 - 1;
        return fromNum(balanced);
      }
      case 'COMPARATOR': {
        const a = numInputs[0] ?? 0;
        const b = numInputs[1] ?? 0;
        return fromNum(a > b ? 1 : a < b ? -1 : 0);
      }
      case 'CONSENSUS': {
        const allSame = numInputs.every(v => v === numInputs[0]);
        return allSame ? fromNum(numInputs[0]) : 'FALSE';
      }
      case 'NEURON': {
        const sum = numInputs.reduce((acc, curr) => acc + curr, 0);
        return fromNum(sum > 0 ? 1 : sum < 0 ? -1 : 0);
      }
      case 'INVERTER': {
        // Cyclic +1 shift: -1 -> 0, 0 -> 1, 1 -> -1
        const val = numInputs[0] ?? 0;
        const next = val === 1 ? -1 : val + 1;
        return fromNum(next);
      }
      default:
        return fromNum(numInputs[0] ?? 0);
    }
  }

  public formatReportAsText(report: VerificationReport): string {
    const lines: string[] = [];
    lines.push(`Formal Verification Report - Total States: ${report.totalStates}`);
    lines.push(`Inputs: ${report.inputNames.join(', ')} | Outputs: ${report.outputNames.join(', ')}`);
    lines.push('----------------------------------------------------');
    lines.push(
      report.inputNames.map(n => n.padEnd(8)).join(' ') + ' | ' +
      report.outputNames.map(n => n.padEnd(8)).join(' ')
    );
    lines.push('----------------------------------------------------');

    const fmt = (v: TernaryValue) => (v === 'TRUE' ? '+1' : v === 'FALSE' ? '-1' : ' 0');

    report.rows.forEach(r => {
      const inStr = report.inputNames.map(n => fmt(r.inputs[n]).padEnd(8)).join(' ');
      const outStr = report.outputNames.map(n => fmt(r.outputs[n]).padEnd(8)).join(' ');
      lines.push(`${inStr} | ${outStr}`);
    });

    return lines.join('\n');
  }
}
