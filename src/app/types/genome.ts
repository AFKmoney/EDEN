import { EdenNode } from './node';
import { EdenEdge } from './edge';

export interface EdenSnapshot {
  timestamp: number;
  nodes: Record<string, EdenNode>;
  edges: Record<string, EdenEdge>;
}

export interface EdenGenome {
  nodes: Record<string, EdenNode>;
  edges: Record<string, EdenEdge>;
  history: EdenSnapshot[];
  historyIndex: number;
}
