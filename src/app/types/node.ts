export type NodeType = 'UI' | 'Logic' | 'Data';
export type TernaryValue = 'TRUE' | 'FALSE' | 'UNKNOWN';

export type LogicGateType = 
  | 'AND'        // Kleene Min: min(A, B)
  | 'OR'         // Kleene Max: max(A, B)
  | 'NOT'        // Kleene Inverter: TRUE->FALSE, FALSE->TRUE, UNKNOWN->UNKNOWN
  | 'XOR'        // Balanced Ternary Sum: (A + B) mod 3 mapped to -1, 0, +1
  | 'CONSENSUS'  // Equivalence: TRUE if inputs match, FALSE if conflicting, UNKNOWN if indeterminate
  | 'MUX'        // Ternary Multiplexer: selects input based on control trit (-1, 0, +1)
  | 'LATCH'      // Trit Register/Memory cell with Clock strobe
  | 'CLOCK'      // Autonomous Trit pulse oscillator (-1 -> 0 -> +1)
  | 'CONSTANT'   // Signal Source toggleable between -1, 0, +1
  | 'ADDER'      // Balanced Ternary Half-Adder (computes Sum & Carry)
  | 'COMPARATOR' // Ternary 3-way branching: A > B -> +1, A == B -> 0, A < B -> -1
  | 'NEURON'     // Ternary Neuromorphic Perceptron (dot product + threshold activation)
  | 'INVERTER'   // Cyclic shift inverter (-1 -> 0 -> 1 -> -1)
  | 'MINMAX'     // Dual sorting gate: returns min or max
  | 'LFSR'       // Linear Feedback Shift Register (pseudo-random trit generator)
  | 'MULTIPLIER' // Balanced Ternary 2x1 Multiplier (A * B)
  | 'FULLADDER'  // Balanced Full-Adder with Carry-In (A + B + Cin)
  | 'PROBE';     // Oscilloscope / Signal monitor with historical waveform

export interface EdenNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  dimensions?: { width: number; height: number };
  metadata: {
    title?: string;
    content?: string;
    styles?: string;
    props?: Record<string, any>;
    gateType?: LogicGateType;
    memoryState?: TernaryValue; // For LATCH/Registers
    history?: TernaryValue[];   // For PROBE oscilloscopes
  };
  state?: Record<string, any>;
  ternaryState: TernaryValue;
  createdAt?: number;
  updatedAt?: number;
}

