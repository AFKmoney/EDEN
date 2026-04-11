export type NodeType = 'UI' | 'Logic' | 'Data';
export type TernaryValue = 'TRUE' | 'FALSE' | 'UNKNOWN';

export interface EdenNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  metadata: {
    title?: string;
    content?: string;
    styles?: string;
    props?: Record<string, any>;
    gateType?: 'AND' | 'OR' | 'NOT'; // Used for Logic nodes to process ternary states
  };
  state?: Record<string, any>;
  ternaryState: TernaryValue; // The core of the new robust backend execution
}
