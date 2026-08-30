/**
 * Agent Model
 * MongoDB schema for AI agents
 */

import mongoose, { Document, Schema, Model, Types } from 'mongoose';

// Ternary state type - Extended for more granular states
export type TernaryState = 'TRUE' | 'FALSE' | 'UNKNOWN' | 'ERROR' | 'PROPAGATING' | 'EVALUATING' | 'BLOCKED';

// Execution state for nodes
export type ExecutionState = 'pending' | 'executing' | 'completed' | 'failed' | 'skipped';

// Node type type
export type NodeType = 'Data' | 'Logic' | 'UI' | 'IO' | 'Custom';

// Gate type type
export type GateType = 'AND' | 'OR' | 'XOR' | 'NAND' | 'NOR' | 'NOT';

// Position interface
export interface Position {
  x: number;
  y: number;
}

// Metadata interface
export interface AgentMetadata {
  title: string;
  content?: string;
  gateType?: GateType;
  [key: string]: any;
}

// Node interface
export interface INode {
  id: string;
  type: NodeType;
  position: Position;
  metadata: AgentMetadata;
  ternaryState: TernaryState;
  executionState?: ExecutionState;
  inputs: string[];
  outputs: string[];
  executionOrder?: number;
  lastExecution?: Date;
  executionTime?: number;
  error?: string;
  dependencies?: string[]; // Node dependencies for execution order
  executionCount?: number; // How many times this node has been executed
  successCount?: number; // How many times execution succeeded
  failureCount?: number; // How many times execution failed
}

// Connection interface
export interface IConnection {
  id: string;
  sourceId: string;
  sourcePort: string;
  targetId: string;
  targetPort: string;
  createdAt: Date;
}

// Agent interface
export interface IAgent extends Document {
  name: string;
  description?: string;
  author: Types.ObjectId;
  nodes: Record<string, INode>;
  connections: IConnection[];
  metadata: {
    version: string;
    tags: string[];
    category?: string;
    isPublic: boolean;
    isFeatured: boolean;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    estimatedTime: number; // in minutes
  };
  stats: {
    executionCount: number;
    totalExecutionTime: number;
    lastExecuted: Date;
    errorCount: number;
    successCount: number;
  };
  settings: {
    autoRun: boolean;
    timeout: number; // in ms
    maxIterations: number;
    parallelExecution: boolean;
  };
  isActive: boolean;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
  
  // Chain of Thought history
  chainOfThought?: {
    steps: Array<{
      step: number;
      thought: string;
      action: string;
      result: any;
      timestamp: number;
      nodeId?: string;
    }>;
    lastExecutionId?: string;
    totalExecutions: number;
  };

  // Methods
  getNodeCount(): number;
  getConnectionCount(): number;
  getExecutionStats(): { avgTime: number; successRate: number };
  clone(): Promise<IAgent>;
  addChainOfThoughtStep(step: {
    step: number;
    thought: string;
    action: string;
    result: any;
    timestamp: number;
    nodeId?: string;
  }): void;
}

// Agent schema
const AgentSchema = new Schema<IAgent>(
  {
    chainOfThought: {
      type: {
        steps: {
          type: [{
            step: { type: Number, required: true },
            thought: { type: String, required: true },
            action: { type: String, required: true },
            result: { type: Schema.Types.Mixed },
            timestamp: { type: Number, required: true },
            nodeId: { type: String },
          }],
          default: [],
        },
        lastExecutionId: { type: String },
        totalExecutions: {
          type: Number,
          default: 0,
        },
      },
      default: undefined,
    },
    totalExecutions: {
      type: Number,
      default: 0,
    },
    name: {
      type: String,
      required: [true, 'Agent name is required'],
      trim: true,
      maxlength: [200, 'Agent name cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Author is required'],
    },
    nodes: {
      type: Map,
      of: {
        type: {
          id: { type: String, required: true },
          type: {
            type: String,
            enum: ['Data', 'Logic', 'UI', 'IO', 'Custom'] as NodeType[],
            required: true,
          },
          position: {
            x: { type: Number, required: true },
            y: { type: Number, required: true },
          },
          metadata: {
            type: Map,
            of: Schema.Types.Mixed,
            default: new Map(),
          },
          ternaryState: {
            type: String,
            enum: ['TRUE', 'FALSE', 'UNKNOWN', 'ERROR', 'PROPAGATING', 'EVALUATING', 'BLOCKED'] as TernaryState[],
            default: 'UNKNOWN',
          },
          executionState: {
            type: String,
            enum: ['pending', 'executing', 'completed', 'failed', 'skipped'] as ExecutionState[],
            default: 'pending',
          },
          inputs: {
            type: [String],
            default: [],
          },
          outputs: {
            type: [String],
            default: [],
          },
          dependencies: {
            type: [String],
            default: [],
          },
          executionOrder: { type: Number },
          lastExecution: { type: Date },
          executionTime: { type: Number },
          executionCount: {
            type: Number,
            default: 0,
          },
          successCount: {
            type: Number,
            default: 0,
          },
          failureCount: {
            type: Number,
            default: 0,
          },
          error: { type: String },
        },
        required: true,
      },
      default: new Map(),
    },
    connections: {
      type: [
        {
          id: { type: String, required: true },
          sourceId: { type: String, required: true },
          sourcePort: { type: String, required: true },
          targetId: { type: String, required: true },
          targetPort: { type: String, required: true },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    metadata: {
      type: {
        version: {
          type: String,
          default: '1.0.0',
        },
        tags: {
          type: [String],
          default: [],
        },
        category: {
          type: String,
          enum: [
            'automation',
            'data-processing',
            'ai-assistants',
            'web-scraping',
            'chatbots',
            'analysis',
            'creative',
            'productivity',
            'other',
          ],
          default: 'other',
        },
        isPublic: {
          type: Boolean,
          default: false,
        },
        isFeatured: {
          type: Boolean,
          default: false,
        },
        difficulty: {
          type: String,
          enum: ['beginner', 'intermediate', 'advanced'] as IAgent['metadata']['difficulty'][],
          default: 'beginner',
        },
        estimatedTime: {
          type: Number,
          default: 10,
        },
      },
      default: () => ({}),
    },
    stats: {
      type: {
        executionCount: {
          type: Number,
          default: 0,
        },
        totalExecutionTime: {
          type: Number,
          default: 0,
        },
        lastExecuted: {
          type: Date,
        },
        errorCount: {
          type: Number,
          default: 0,
        },
        successCount: {
          type: Number,
          default: 0,
        },
      },
      default: () => ({}),
    },
    settings: {
      type: {
        autoRun: {
          type: Boolean,
          default: false,
        },
        timeout: {
          type: Number,
          default: 30000,
        },
        maxIterations: {
          type: Number,
          default: 20,
        },
        parallelExecution: {
          type: Boolean,
          default: false,
        },
      },
      default: () => ({}),
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    totalExecutions: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        // Convert Map to plain object
        if (ret.nodes && ret.nodes instanceof Map) {
          ret.nodes = Object.fromEntries(ret.nodes);
        }
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (doc, ret) => {
        if (ret.nodes && ret.nodes instanceof Map) {
          ret.nodes = Object.fromEntries(ret.nodes);
        }
        return ret;
      },
    },
  }
);

// Method to get node count
AgentSchema.methods.getNodeCount = function (this: IAgent): number {
  return Object.keys(this.nodes as any).length;
};

// Method to get connection count
AgentSchema.methods.getConnectionCount = function (this: IAgent): number {
  return (this.connections || []).length;
};

// Method to get execution statistics
AgentSchema.methods.getExecutionStats = function (this: IAgent): {
  avgTime: number;
  successRate: number;
} {
  const total = this.stats.executionCount;
  const success = this.stats.successCount;
  const avgTime = total > 0 ? this.stats.totalExecutionTime / total : 0;
  const successRate = total > 0 ? (success / total) * 100 : 0;

  return {
    avgTime,
    successRate,
  };
};

// Method to clone an agent
AgentSchema.methods.clone = async function (this: IAgent): Promise<IAgent> {
  const clonedData = this.toObject();
  delete (clonedData as any)._id;
  delete (clonedData as any).createdAt;
  delete (clonedData as any).updatedAt;
  delete (clonedData as any).chainOfThought;
  delete (clonedData as any).lastExecutionId;

  // Add "Copy" to name
  clonedData.name = `${clonedData.name} (Copy)`;
  clonedData.totalExecutions = 0;

  // Create new agent
  const clonedAgent = new AgentModel(clonedData);
  await clonedAgent.save();

  return clonedAgent;
};

// Method to add Chain of Thought step
AgentSchema.methods.addChainOfThoughtStep = function (this: IAgent, step: {
  step: number;
  thought: string;
  action: string;
  result: any;
  timestamp: number;
  nodeId?: string;
}): void {
  if (!this.chainOfThought) {
    this.chainOfThought = { steps: [], lastExecutionId: undefined, totalExecutions: 0 };
  }
  
  this.chainOfThought.steps.push(step);
  this.markModified('chainOfThought');
};

// Indexes
AgentSchema.index({ author: 1, createdAt: -1 });
AgentSchema.index({ author: 1, name: 1 });
AgentSchema.index({ 'metadata.isPublic': 1 });
AgentSchema.index({ 'metadata.category': 1 });
AgentSchema.index({ 'metadata.tags': 1 });
AgentSchema.index({ 'metadata.isFeatured': 1 });
AgentSchema.index({ createdAt: -1 });
AgentSchema.index({ updatedAt: -1 });

// Virtual for node array (for easier querying)
AgentSchema.virtual('nodeArray').get(function (this: IAgent) {
  return Array.from((this.nodes as any).values());
});

// Virtual for public agent data
AgentSchema.virtual('publicData').get(function (this: IAgent) {
  const nodes = this.nodes as any;
  const publicNodes: Record<string, any> = {};

  // Create public versions of nodes (without sensitive data)
  for (const [key, node] of Object.entries(nodes)) {
    publicNodes[key] = {
      id: node.id,
      type: node.type,
      position: node.position,
      metadata: node.metadata,
      ternaryState: node.ternaryState,
    };
  }

  return {
    id: this._id.toString(),
    name: this.name,
    description: this.description,
    author: this.author.toString(),
    nodes: publicNodes,
    connections: this.connections,
    metadata: this.metadata,
    stats: this.stats,
    createdAt: this.createdAt,
  };
});

// Create and export model
const AgentModel: Model<IAgent> = mongoose.models.Agent || mongoose.model<IAgent>('Agent', AgentSchema);

export default AgentModel;
