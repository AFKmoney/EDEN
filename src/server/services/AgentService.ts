/**
 * Agent Service
 * Business logic for agent management with Autonomous Agentic Loop and Ternary VM
 */

import AgentModel, { IAgent, INode, IConnection, NodeType, GateType, TernaryState, ExecutionState } from '../models/Agent';
import TemplateModel from '../models/Template';
import { IUser } from '../models/User';
import { getRedisClient } from '../config/database';
import { NotFoundError, ValidationError, AuthorizationError } from '../middleware/errorHandler';

// Configuration
const AGENT_CACHE_PREFIX = 'agent:';
const AGENT_CACHE_TTL = parseInt(process.env.AGENT_CACHE_TTL || '300'); // 5 minutes
const MAX_EXECUTION_ITERATIONS = parseInt(process.env.MAX_EXECUTION_ITERATIONS || '50');
const EXECUTION_TIMEOUT_MS = parseInt(process.env.EXECUTION_TIMEOUT_MS || '60000');

// Extended types for execution
export interface ExecutionContext {
  agentId: string;
  input?: any;
  iteration: number;
  maxIterations: number;
  startTime: number;
  currentNodeId?: string;
  executionPath: string[];
  state: Record<string, any>;
  errors: string[];
  warnings: string[];
  completedNodes: Set<string>;
  skippedNodes: Set<string>;
  executionOrder: string[];
}

export interface ExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  executionTime: number;
  nodeResults: Record<string, {
    state: TernaryState;
    executionTime: number;
    error?: string;
    output?: any;
  }>;
  stats: {
    totalNodes: number;
    executedNodes: number;
    skippedNodes: number;
    failedNodes: number;
    totalExecutionTime: number;
  };
}

export interface AgenticLoopContext {
  objective: string;
  iterations: number;
  maxIterations: number;
  completedActions: string[];
  failedActions: string[];
  currentPlan: string[];
  contextSummary: string;
  reasoning: string;
  timestamp: number;
}

export interface ChainOfThoughtStep {
  step: number;
  thought: string;
  action: string;
  result: any;
  timestamp: number;
  nodeId?: string;
}

/**
 * Agent service interface
 */
export interface IAgentService {
  createAgent(data: { name: string; description?: string; nodes: Record<string, INode>; connections: IConnection[]; author: string; metadata?: any; settings?: any }): Promise<IAgent>;
  getAgentById(id: string): Promise<IAgent>;
  getAgentsByAuthor(author: string, query: { page?: number; limit?: number; search?: string; tags?: string[]; category?: string }): Promise<{ agents: IAgent[]; total: number; page: number; pages: number }>;
  updateAgent(id: string, author: string, data: Partial<IAgent>): Promise<IAgent>;
  deleteAgent(id: string, author: string, isAdmin: boolean): Promise<void>;
  cloneAgent(id: string, author: string): Promise<IAgent>;
  getPublicAgents(query: { page?: number; limit?: number; search?: string; tags?: string[]; category?: string; sort?: string }): Promise<{ agents: IAgent[]; total: number; page: number; pages: number }>;
  getFeaturedAgents(limit: number): Promise<IAgent[]>;
  getRecentAgents(limit: number): Promise<IAgent[]>;
  getPopularAgents(limit: number): Promise<IAgent[]>;
  toggleAgentVisibility(id: string, author: string, isPublic: boolean): Promise<IAgent>;
  executeAgent(id: string, input?: any): Promise<{ success: boolean; result?: any; error?: string; executionTime: number }>;
  getAgentStats(id: string): Promise<any>;
  incrementAgentStats(id: string, stats: { executionCount?: number; successCount?: number; errorCount?: number; totalExecutionTime?: number }): Promise<IAgent>;
}

/**
 * Agent Service Implementation
 */
export class AgentService implements IAgentService {
  /**
   * Create a new agent
   */
  async createAgent(data: { name: string; description?: string; nodes: Record<string, INode>; connections: IConnection[]; author: string; metadata?: any; settings?: any }): Promise<IAgent> {
    try {
      // Validate nodes
      if (!data.nodes || Object.keys(data.nodes).length === 0) {
        throw new ValidationError('At least one node is required');
      }

      // Create agent
      const agent = new AgentModel({
        name: data.name,
        description: data.description,
        author: data.author,
        nodes: data.nodes,
        connections: data.connections || [],
        metadata: {
          version: '1.0.0',
          tags: data.metadata?.tags || [],
          category: data.metadata?.category || 'other',
          isPublic: data.metadata?.isPublic || false,
          isFeatured: false,
          difficulty: data.metadata?.difficulty || 'beginner',
          estimatedTime: data.metadata?.estimatedTime || 10,
        },
        settings: {
          autoRun: false,
          timeout: 30000,
          maxIterations: 20,
          parallelExecution: false,
          ...data.settings,
        },
      });

      // Save agent
      await agent.save();

      // Clear cache
      await this.clearAgentCache(agent._id.toString());

      return agent;
    } catch (error: any) {
      if (error instanceof ValidationError) throw error;
      throw new ValidationError(error.message);
    }
  }

  /**
   * Get agent by ID
   */
  async getAgentById(id: string): Promise<IAgent> {
    try {
      // Try to get from cache first
      const redis = getRedisClient();
      const cachedAgent = await redis.get(`${AGENT_CACHE_PREFIX}${id}`);
      
      if (cachedAgent) {
        return JSON.parse(cachedAgent) as IAgent;
      }

      // Get from database
      const agent = await AgentModel.findById(id);
      if (!agent) {
        throw new NotFoundError('Agent not found');
      }

      // Cache the agent
      await redis.setEx(`${AGENT_CACHE_PREFIX}${id}`, JSON.stringify(agent.toJSON()), AGENT_CACHE_TTL);

      return agent;
    } catch (error: any) {
      if (error.name === 'CastError') {
        throw new ValidationError('Invalid agent ID');
      }
      throw error;
    }
  }

  /**
   * Get agents by author with pagination
   */
  async getAgentsByAuthor(author: string, query: { page?: number; limit?: number; search?: string; tags?: string[]; category?: string }): Promise<{ agents: IAgent[]; total: number; page: number; pages: number }> {
    try {
      const page = query.page || 1;
      const limit = Math.min(query.limit || 20, 100);
      const skip = (page - 1) * limit;

      // Build filter
      const filter: any = { author, isArchived: false };

      if (query.search) {
        const searchRegex = new RegExp(query.search, 'i');
        filter.$or = [
          { name: searchRegex },
          { description: searchRegex },
        ];
      }

      if (query.tags && query.tags.length > 0) {
        filter['metadata.tags'] = { $in: query.tags };
      }

      if (query.category) {
        filter['metadata.category'] = query.category;
      }

      // Get agents
      const [agents, total] = await Promise.all([
        AgentModel.find(filter)
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(limit),
        AgentModel.countDocuments(filter),
      ]);

      const pages = Math.ceil(total / limit);

      return {
        agents,
        total,
        page,
        pages,
      };
    } catch (error: any) {
      throw new ValidationError(error.message);
    }
  }

  /**
   * Update agent
   */
  async updateAgent(id: string, author: string, data: Partial<IAgent>): Promise<IAgent> {
    try {
      // Get agent and check ownership
      const agent = await AgentModel.findById(id);
      if (!agent) {
        throw new NotFoundError('Agent not found');
      }

      if (agent.author.toString() !== author) {
        throw new AuthorizationError('Not authorized to update this agent');
      }

      // Update agent
      const updatedAgent = await AgentModel.findByIdAndUpdate(
        id,
        { $set: data },
        { new: true, runValidators: true }
      );

      if (!updatedAgent) {
        throw new NotFoundError('Agent not found');
      }

      // Clear cache
      await this.clearAgentCache(id);

      return updatedAgent;
    } catch (error: any) {
      if (error.name === 'CastError') {
        throw new ValidationError('Invalid agent ID');
      }
      if (error instanceof AuthorizationError || error instanceof NotFoundError) throw error;
      throw new ValidationError(error.message);
    }
  }

  /**
   * Delete agent
   */
  async deleteAgent(id: string, author: string, isAdmin: boolean): Promise<void> {
    try {
      // Get agent and check ownership or admin
      const agent = await AgentModel.findById(id);
      if (!agent) {
        throw new NotFoundError('Agent not found');
      }

      if (agent.author.toString() !== author && !isAdmin) {
        throw new AuthorizationError('Not authorized to delete this agent');
      }

      // Soft delete (archive)
      agent.isArchived = true;
      await agent.save();

      // Hard delete (uncomment if you want permanent deletion)
      // await AgentModel.findByIdAndDelete(id);

      // Clear cache
      await this.clearAgentCache(id);
    } catch (error: any) {
      if (error.name === 'CastError') {
        throw new ValidationError('Invalid agent ID');
      }
      if (error instanceof AuthorizationError || error instanceof NotFoundError) throw error;
      throw new ValidationError(error.message);
    }
  }

  /**
   * Clone agent
   */
  async cloneAgent(id: string, author: string): Promise<IAgent> {
    try {
      // Get original agent
      const agent = await AgentModel.findById(id);
      if (!agent) {
        throw new NotFoundError('Agent not found');
      }

      // Clone the agent
      const clonedAgent = await agent.clone();
      clonedAgent.author = new mongoose.Types.ObjectId(author);
      await clonedAgent.save();

      return clonedAgent;
    } catch (error: any) {
      if (error.name === 'CastError') {
        throw new ValidationError('Invalid agent ID');
      }
      if (error instanceof NotFoundError) throw error;
      throw new ValidationError(error.message);
    }
  }

  /**
   * Get public agents
   */
  async getPublicAgents(query: { page?: number; limit?: number; search?: string; tags?: string[]; category?: string; sort?: string }): Promise<{ agents: IAgent[]; total: number; page: number; pages: number }> {
    try {
      const page = query.page || 1;
      const limit = Math.min(query.limit || 20, 100);
      const skip = (page - 1) * limit;

      // Build filter
      const filter: any = { 'metadata.isPublic': true, isArchived: false, isActive: true };

      if (query.search) {
        const searchRegex = new RegExp(query.search, 'i');
        filter.$or = [
          { name: searchRegex },
          { description: searchRegex },
        ];
      }

      if (query.tags && query.tags.length > 0) {
        filter['metadata.tags'] = { $in: query.tags };
      }

      if (query.category) {
        filter['metadata.category'] = query.category;
      }

      // Build sort
      let sort: any = { createdAt: -1 };
      switch (query.sort) {
        case 'popular':
          sort = { 'stats.downloadCount': -1, 'stats.likeCount': -1 };
          break;
        case 'rating':
          // Would need to calculate rating from reviews
          sort = { 'stats.successCount': -1 };
          break;
        case 'recent':
          sort = { createdAt: -1 };
          break;
        case 'updated':
          sort = { updatedAt: -1 };
          break;
      }

      // Get agents
      const [agents, total] = await Promise.all([
        AgentModel.find(filter)
          .sort(sort)
          .skip(skip)
          .limit(limit),
        AgentModel.countDocuments(filter),
      ]);

      const pages = Math.ceil(total / limit);

      return {
        agents,
        total,
        page,
        pages,
      };
    } catch (error: any) {
      throw new ValidationError(error.message);
    }
  }

  /**
   * Get featured agents
   */
  async getFeaturedAgents(limit: number = 10): Promise<IAgent[]> {
    try {
      return await AgentModel.find({
        'metadata.isFeatured': true,
        'metadata.isPublic': true,
        isArchived: false,
        isActive: true,
      })
        .sort({ 'stats.successCount': -1, createdAt: -1 })
        .limit(limit);
    } catch (error: any) {
      throw new ValidationError(error.message);
    }
  }

  /**
   * Get recent agents
   */
  async getRecentAgents(limit: number = 10): Promise<IAgent[]> {
    try {
      return await AgentModel.find({
        'metadata.isPublic': true,
        isArchived: false,
        isActive: true,
      })
        .sort({ createdAt: -1 })
        .limit(limit);
    } catch (error: any) {
      throw new ValidationError(error.message);
    }
  }

  /**
   * Get popular agents
   */
  async getPopularAgents(limit: number = 10): Promise<IAgent[]> {
    try {
      return await AgentModel.find({
        'metadata.isPublic': true,
        isArchived: false,
        isActive: true,
      })
        .sort({ 'stats.downloadCount': -1, 'stats.likeCount': -1, 'stats.successCount': -1 })
        .limit(limit);
    } catch (error: any) {
      throw new ValidationError(error.message);
    }
  }

  /**
   * Toggle agent visibility
   */
  async toggleAgentVisibility(id: string, author: string, isPublic: boolean): Promise<IAgent> {
    try {
      // Get agent and check ownership
      const agent = await AgentModel.findById(id);
      if (!agent) {
        throw new NotFoundError('Agent not found');
      }

      if (agent.author.toString() !== author) {
        throw new AuthorizationError('Not authorized to update this agent');
      }

      // Update visibility
      (agent.metadata as any).isPublic = isPublic;
      await agent.save();

      // Clear cache
      await this.clearAgentCache(id);

      return agent;
    } catch (error: any) {
      if (error.name === 'CastError') {
        throw new ValidationError('Invalid agent ID');
      }
      if (error instanceof AuthorizationError || error instanceof NotFoundError) throw error;
      throw new ValidationError(error.message);
    }
  }

  /**
   * Execute agent with full Ternary VM and Chain of Thought
   */
  async executeAgent(id: string, input?: any): Promise<ExecutionResult> {
    const startTime = Date.now();
    const executionContext: ExecutionContext = {
      agentId: id,
      input,
      iteration: 0,
      maxIterations: MAX_EXECUTION_ITERATIONS,
      startTime,
      executionPath: [],
      state: {},
      errors: [],
      warnings: [],
      completedNodes: new Set(),
      skippedNodes: new Set(),
      executionOrder: [],
    };

    try {
      // Get agent
      const agent = await AgentModel.findById(id);
      if (!agent) {
        throw new NotFoundError('Agent not found');
      }

      // Build execution graph
      const executionGraph = this.buildExecutionGraph(agent);
      
      // Initialize node states
      const nodeResults: ExecutionResult['nodeResults'] = {};
      const nodes = agent.nodes as Record<string, any>;
      
      // Set initial states
      for (const nodeId of executionGraph.executionOrder) {
        nodeResults[nodeId] = {
          state: nodes[nodeId]?.ternaryState || 'UNKNOWN',
          executionTime: 0,
        };
      }

      // Execute nodes in order with dependency resolution
      const result = await this.executeGraph(
        agent,
        executionGraph,
        executionContext,
        nodeResults,
        input
      );

      const executionTime = Date.now() - startTime;

      // Update stats
      await this.incrementAgentStats(id, {
        executionCount: 1,
        successCount: result.success ? 1 : 0,
        errorCount: result.success ? 0 : 1,
        totalExecutionTime: executionTime,
      });

      return {
        success: result.success,
        result: result.output,
        error: result.error,
        executionTime,
        nodeResults,
        stats: {
          totalNodes: executionGraph.executionOrder.length,
          executedNodes: executionContext.completedNodes.size,
          skippedNodes: executionContext.skippedNodes.size,
          failedNodes: executionContext.errors.length,
          totalExecutionTime: executionTime,
        },
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      
      if (error.name === 'CastError') {
        throw new ValidationError('Invalid agent ID');
      }
      if (error instanceof NotFoundError) throw error;

      // Update error stats
      await this.incrementAgentStats(id, {
        executionCount: 1,
        errorCount: 1,
      });

      return {
        success: false,
        error: error.message,
        executionTime,
        nodeResults: {},
        stats: {
          totalNodes: 0,
          executedNodes: 0,
          skippedNodes: 0,
          failedNodes: 1,
          totalExecutionTime: executionTime,
        },
      };
    }
  }

  /**
   * Build execution graph with topological sort for dependency resolution
   */
  private buildExecutionGraph(agent: IAgent): {
    executionOrder: string[];
    dependencies: Record<string, string[]>;
    dependents: Record<string, string[]>;
    levels: Record<string, number>;
  } {
    const nodes = agent.nodes as Record<string, any>;
    const edges = agent.connections || [];
    
    // Build dependency graph
    const dependencies: Record<string, string[]> = {};
    const dependents: Record<string, string[]> = {};
    
    // Initialize all nodes
    for (const nodeId of Object.keys(nodes)) {
      dependencies[nodeId] = nodes[nodeId]?.dependencies || [];
      dependents[nodeId] = [];
    }
    
    // Add edge-based dependencies (source -> target means target depends on source)
    for (const edge of edges) {
      const sourceId = edge.sourceId;
      const targetId = edge.targetId;
      
      if (!dependencies[targetId]) {
        dependencies[targetId] = [];
      }
      if (!dependencies[targetId].includes(sourceId)) {
        dependencies[targetId].push(sourceId);
      }
      
      if (!dependents[sourceId]) {
        dependents[sourceId] = [];
      }
      if (!dependents[sourceId].includes(targetId)) {
        dependents[sourceId].push(targetId);
      }
    }
    
    // Topological sort using Kahn's algorithm
    const inDegree: Record<string, number> = {};
    const queue: string[] = [];
    const executionOrder: string[] = [];
    const levels: Record<string, number> = {};
    
    // Calculate in-degree for each node
    for (const nodeId of Object.keys(nodes)) {
      inDegree[nodeId] = dependencies[nodeId]?.filter(dep => Object.keys(nodes).includes(dep)).length || 0;
      if (inDegree[nodeId] === 0) {
        queue.push(nodeId);
        levels[nodeId] = 0;
      }
    }
    
    // Process nodes in topological order
    let currentLevel = 0;
    while (queue.length > 0) {
      const levelSize = queue.length;
      
      for (let i = 0; i < levelSize; i++) {
        const nodeId = queue.shift()!;
        executionOrder.push(nodeId);
        
        // Add dependents to queue
        for (const dependent of dependents[nodeId] || []) {
          inDegree[dependent]--;
          if (inDegree[dependent] === 0) {
            queue.push(dependent);
            levels[dependent] = currentLevel + 1;
          }
        }
      }
      
      currentLevel++;
    }
    
    // Check for cycles
    if (executionOrder.length !== Object.keys(nodes).length) {
      // Find nodes not in execution order (part of cycles)
      const missingNodes = Object.keys(nodes).filter(n => !executionOrder.includes(n));
      console.warn(`Cycle detected in agent graph: ${missingNodes.join(', ')}`);
      // Add them anyway at the end
      executionOrder.push(...missingNodes);
    }
    
    return {
      executionOrder,
      dependencies,
      dependents,
      levels,
    };
  }

  /**
   * Execute the agent graph with Ternary VM
   */
  private async executeGraph(
    agent: IAgent,
    graph: ReturnType<typeof this.buildExecutionGraph>,
    context: ExecutionContext,
    nodeResults: ExecutionResult['nodeResults'],
    input?: any
  ): Promise<{ success: boolean; output?: any; error?: string }> {
    const nodes = agent.nodes as Record<string, any>;
    const settings = agent.settings || {};
    const maxIterations = settings.maxIterations || MAX_EXECUTION_ITERATIONS;
    const timeout = settings.timeout || EXECUTION_TIMEOUT_MS;
    
    const startTime = Date.now();
    let iteration = 0;
    let hasChanges = true;
    
    // Chain of Thought tracking
    const chainOfThought: ChainOfThoughtStep[] = [];
    
    while (hasChanges && iteration < maxIterations) {
      iteration++;
      context.iteration = iteration;
      hasChanges = false;
      
      // Check timeout
      if (Date.now() - startTime > timeout) {
        throw new Error(`Execution timeout after ${timeout}ms`);
      }
      
      // Execute nodes in order
      for (const nodeId of graph.executionOrder) {
        const node = nodes[nodeId];
        
        // Skip already completed nodes (unless they have new inputs)
        if (context.completedNodes.has(nodeId) && !this.hasNewInputs(nodeId, graph, context)) {
          continue;
        }
        
        try {
          const nodeStartTime = Date.now();
          
          // Check if node can be executed (all dependencies satisfied)
          if (!this.canExecuteNode(nodeId, graph, context, nodeResults)) {
            context.skippedNodes.add(nodeId);
            nodeResults[nodeId] = {
              ...nodeResults[nodeId],
              state: 'BLOCKED',
              error: 'Waiting for dependencies',
            };
            continue;
          }
          
          // Execute the node
          const result = await this.executeNode(
            nodeId,
            node,
            graph,
            context,
            nodeResults,
            input,
            chainOfThought
          );
          
          const nodeExecutionTime = Date.now() - nodeStartTime;
          
          nodeResults[nodeId] = {
            state: result.state,
            executionTime: nodeExecutionTime,
            output: result.output,
            error: result.error,
          };
          
          context.completedNodes.add(nodeId);
          context.executionPath.push(nodeId);
          context.state[nodeId] = result.output;
          
          if (result.state !== node.ternaryState) {
            hasChanges = true;
          }
          
          // Update node stats in memory (would be saved later)
          nodes[nodeId] = {
            ...node,
            ternaryState: result.state,
            executionState: result.state === 'ERROR' ? 'failed' : 'completed',
            lastExecution: new Date(),
            executionTime: (node.executionTime || 0) + nodeExecutionTime,
            executionCount: (node.executionCount || 0) + 1,
            ...(result.state === 'ERROR' ? { error: result.error } : {}),
          };
          
          // Add to Chain of Thought
          chainOfThought.push({
            step: chainOfThought.length + 1,
            thought: `Executing ${node.metadata?.title || nodeId} (${node.type}) with state ${result.state}`,
            action: `node_execution`,
            result: {
              state: result.state,
              output: result.output,
              executionTime: nodeExecutionTime,
            },
            timestamp: Date.now(),
            nodeId,
          });
          
        } catch (error: any) {
          context.errors.push(`Node ${nodeId}: ${error.message}`);
          nodeResults[nodeId] = {
            ...nodeResults[nodeId],
            state: 'ERROR',
            executionTime: 0,
            error: error.message,
          };
          
          // Add to Chain of Thought
          chainOfThought.push({
            step: chainOfThought.length + 1,
            thought: `Error executing ${node.metadata?.title || nodeId}`,
            action: `node_error`,
            result: { error: error.message },
            timestamp: Date.now(),
            nodeId,
          });
        }
      }
      
      // If no changes after full pass, we're done
      if (!hasChanges) {
        break;
      }
    }
    
    // Check if we exceeded max iterations
    if (iteration >= maxIterations) {
      return {
        success: false,
        error: `Maximum iterations (${maxIterations}) reached`,
      };
    }
    
    // Determine overall success
    const hasErrors = context.errors.length > 0;
    const allNodesCompleted = context.completedNodes.size === graph.executionOrder.length;
    
    return {
      success: !hasErrors && allNodesCompleted,
      output: {
        state: nodeResults,
        chainOfThought,
        executionPath: context.executionPath,
        warnings: context.warnings,
      },
      error: hasErrors ? context.errors.join('; ') : undefined,
    };
  }

  /**
   * Execute a single node with Ternary logic
   */
  private async executeNode(
    nodeId: string,
    node: any,
    graph: ReturnType<typeof this.buildExecutionGraph>,
    context: ExecutionContext,
    nodeResults: ExecutionResult['nodeResults'],
    input?: any,
    chainOfThought?: ChainOfThoughtStep[]
  ): Promise<{ state: TernaryState; output?: any; error?: string }> {
    try {
      const nodeType = node.type;
      const metadata = node.metadata || {};
      const gateType = metadata.gateType || 'AND';
      
      // Get input values from dependencies
      const inputValues: TernaryState[] = [];
      const dependencyIds = graph.dependencies[nodeId] || [];
      
      for (const depId of dependencyIds) {
        if (nodeResults[depId]) {
          inputValues.push(nodeResults[depId].state);
        } else if (context.state[depId]) {
          // Check context state
          inputValues.push('UNKNOWN');
        }
      }
      
      // Add direct inputs from edges
      const edges = context.state.edges || [];
      for (const edge of edges) {
        if (edge.targetId === nodeId && nodeResults[edge.sourceId]) {
          inputValues.push(nodeResults[edge.sourceId].state);
        }
      }
      
      // If node has custom execution logic, use it
      if (nodeType === 'Custom' && metadata.customCode) {
        return await this.executeCustomNode(node, inputValues, context);
      }
      
      // Execute based on node type
      switch (nodeType) {
        case 'Data':
          return this.executeDataNode(node, inputValues, input);
        case 'Logic':
          return this.executeLogicNode(node, inputValues, gateType);
        case 'UI':
          return this.executeUINode(node, inputValues);
        case 'IO':
          return this.executeIONode(node, inputValues, context);
        default:
          return this.executeDataNode(node, inputValues, input);
      }
    } catch (error: any) {
      return {
        state: 'ERROR',
        error: error.message,
      };
    }
  }

  /**
   * Execute Data node
   */
  private executeDataNode(node: any, inputValues: TernaryState[], input?: any): { state: TernaryState; output?: any; error?: string } {
    const metadata = node.metadata || {};
    
    // If node has content, use it as output
    if (metadata.content) {
      return {
        state: 'TRUE',
        output: metadata.content,
      };
    }
    
    // If there are inputs, evaluate based on them
    if (inputValues.length > 0) {
      const gateType = metadata.gateType || 'AND';
      const result = this.evaluateTernary(inputValues, gateType);
      return {
        state: result,
        output: inputValues,
      };
    }
    
    // Default to UNKNOWN if no inputs or content
    return {
      state: 'UNKNOWN',
      output: null,
    };
  }

  /**
   * Execute Logic node with Ternary gates
   */
  private executeLogicNode(node: any, inputValues: TernaryState[], gateType: GateType): { state: TernaryState; output?: any; error?: string } {
    if (inputValues.length === 0) {
      return {
        state: 'UNKNOWN',
        output: null,
      };
    }
    
    const result = this.evaluateTernary(inputValues, gateType);
    
    return {
      state: result,
      output: {
        inputs: inputValues,
        gate: gateType,
        result,
      },
    };
  }

  /**
   * Execute UI node
   */
  private executeUINode(node: any, inputValues: TernaryState[]): { state: TernaryState; output?: any; error?: string } {
    // UI nodes typically represent visual output
    // Their state depends on inputs
    if (inputValues.length > 0) {
      const gateType = node.metadata?.gateType || 'OR';
      const result = this.evaluateTernary(inputValues, gateType);
      return {
        state: result,
        output: {
          type: 'UI',
          title: node.metadata?.title || 'UI Node',
          state: result,
        },
      };
    }
    
    return {
      state: 'UNKNOWN',
      output: null,
    };
  }

  /**
   * Execute IO node
   */
  private async executeIONode(node: any, inputValues: TernaryState[], context: ExecutionContext): Promise<{ state: TernaryState; output?: any; error?: string }> {
    // IO nodes can read/write external data
    // For now, just pass through or return input state
    if (inputValues.length > 0) {
      return {
        state: inputValues[0],
        output: inputValues[0],
      };
    }
    
    return {
      state: 'UNKNOWN',
      output: null,
    };
  }

  /**
   * Execute custom code node
   */
  private async executeCustomNode(node: any, inputValues: TernaryState[], context: ExecutionContext): Promise<{ state: TernaryState; output?: any; error?: string }> {
    // In a real implementation, this would execute custom JavaScript/TypeScript code
    // For security, this should be sandboxed
    const metadata = node.metadata || {};
    const customCode = metadata.customCode;
    
    if (!customCode) {
      return {
        state: 'ERROR',
        error: 'No custom code provided',
      };
    }
    
    try {
      // Create a safe execution context
      const executionContext = {
        inputs: inputValues,
        node: {
          id: node.id,
          type: node.type,
          metadata: node.metadata,
        },
        context: {
          iteration: context.iteration,
          maxIterations: context.maxIterations,
          timestamp: Date.now(),
        },
        // Helper functions
        ternary: {
          AND: (values: TernaryState[]) => this.evaluateTernary(values, 'AND'),
          OR: (values: TernaryState[]) => this.evaluateTernary(values, 'OR'),
          NOT: (value: TernaryState) => this.evaluateTernary([value], 'NOT'),
        },
      };
      
      // For now, just return UNKNOWN as custom code execution is complex
      // In production, use a sandboxed VM
      return {
        state: 'UNKNOWN',
        output: null,
        error: 'Custom code execution not yet implemented',
      };
    } catch (error: any) {
      return {
        state: 'ERROR',
        error: `Custom code execution failed: ${error.message}`,
      };
    }
  }

  /**
   * Check if node can be executed (all dependencies are satisfied)
   */
  private canExecuteNode(
    nodeId: string,
    graph: ReturnType<typeof this.buildExecutionGraph>,
    context: ExecutionContext,
    nodeResults: ExecutionResult['nodeResults']
  ): boolean {
    const dependencies = graph.dependencies[nodeId] || [];
    
    for (const depId of dependencies) {
      // Check if dependency is completed
      if (!context.completedNodes.has(depId)) {
        // Check if dependency has an error
        if (nodeResults[depId]?.state === 'ERROR') {
          return false;
        }
        return false;
      }
    }
    
    return true;
  }

  /**
   * Check if node has new inputs since last execution
   */
  private hasNewInputs(
    nodeId: string,
    graph: ReturnType<typeof this.buildExecutionGraph>,
    context: ExecutionContext
  ): boolean {
    const dependencies = graph.dependencies[nodeId] || [];
    
    for (const depId of dependencies) {
      if (context.completedNodes.has(depId) && !context.state[nodeId]) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Evaluate ternary logic with Kleene semantics
   */
  private evaluateTernary(inputs: TernaryState[], gate: GateType): TernaryState {
    const toNum = (v: TernaryState) => {
      switch (v) {
        case 'TRUE': return 1;
        case 'FALSE': return -1;
        case 'ERROR': return -2;
        default: return 0; // UNKNOWN, PROPAGATING, EVALUATING, BLOCKED
      }
    };
    
    const fromNum = (n: number): TernaryState => {
      if (n === 1) return 'TRUE';
      if (n === -1) return 'FALSE';
      if (n === -2) return 'ERROR';
      return 'UNKNOWN';
    };

    if (inputs.length === 0) return 'UNKNOWN';
    
    switch (gate) {
      case 'AND':
        return fromNum(Math.min(...inputs.map(toNum)));
      case 'OR':
        return fromNum(Math.max(...inputs.map(toNum)));
      case 'NOT':
        return fromNum(-toNum(inputs[0]));
      case 'NAND':
        return fromNum(-Math.min(...inputs.map(toNum)));
      case 'NOR':
        return fromNum(-Math.max(...inputs.map(toNum)));
      case 'XOR':
        // XOR: TRUE if odd number of TRUE inputs
        const trueCount = inputs.filter(v => v === 'TRUE').length;
        const falseOrErrorCount = inputs.filter(v => v === 'FALSE' || v === 'ERROR').length;
        if (trueCount > 0 && falseOrErrorCount === 0) {
          return fromNum(trueCount % 2 === 1 ? 1 : -1);
        }
        return 'UNKNOWN';
      default:
        return 'UNKNOWN';
    }
  }

  /**
   * Execute agentic loop with Chain of Thought
   */
  async executeAgenticLoop(
    agentId: string,
    objective: string,
    maxIterations: number = 20
  ): Promise<{
    success: boolean;
    iterations: number;
    chainOfThought: ChainOfThoughtStep[];
    finalState: any;
    error?: string;
  }> {
    const startTime = Date.now();
    const chainOfThought: ChainOfThoughtStep[] = [];
    let iteration = 0;
    let previousError: string | undefined;
    
    try {
      // Get agent
      const agent = await AgentModel.findById(agentId);
      if (!agent) {
        throw new NotFoundError('Agent not found');
      }
      
      const context: AgenticLoopContext = {
        objective,
        iterations: 0,
        maxIterations,
        completedActions: [],
        failedActions: [],
        currentPlan: [],
        contextSummary: `Starting agentic loop for: ${objective}`,
        reasoning: '',
        timestamp: Date.now(),
      };
      
      while (iteration < maxIterations) {
        iteration++;
        context.iterations = iteration;
        
        // Check timeout
        if (Date.now() - startTime > EXECUTION_TIMEOUT_MS) {
          throw new Error(`Agentic loop timeout after ${EXECUTION_TIMEOUT_MS}ms`);
        }
        
        // Build context for this iteration
        const currentContext = this.buildAgenticContext(agent, context, previousError);
        
        // Add to Chain of Thought
        chainOfThought.push({
          step: iteration,
          thought: `Evaluating state for objective: ${objective}`,
          action: 'evaluation',
          result: { context: currentContext.substring(0, 200) + '...' },
          timestamp: Date.now(),
        });
        
        // For now, execute the agent once per iteration
        // In a full implementation, this would use the CLI to get AI feedback
        const executionResult = await this.executeAgent(agentId);
        
        if (executionResult.success) {
          context.completedActions.push(`Iteration ${iteration}: Agent executed successfully`);
          context.reasoning = executionResult.result?.chainOfThought ?
            executionResult.result.chainOfThought.map((c: any) => c.thought).join(' ') :
            'Agent executed successfully';
          
          // Check if objective is complete
          // In a real implementation, we would ask the AI if the objective is met
          const isComplete = this.evaluateObjectiveCompletion(agent, objective, context);
          
          if (isComplete) {
            chainOfThought.push({
              step: iteration,
              thought: `Objective completed: ${objective}`,
              action: 'completion',
              result: { completed: true },
              timestamp: Date.now(),
            });
            
            return {
              success: true,
              iterations: iteration,
              chainOfThought,
              finalState: executionResult,
            };
          }
          
          previousError = undefined;
        } else {
          const errorMsg = executionResult.error || 'Unknown error';
          context.failedActions.push(`Iteration ${iteration}: ${errorMsg}`);
          previousError = errorMsg;
          
          chainOfThought.push({
            step: iteration,
            thought: `Error in iteration: ${errorMsg}`,
            action: 'error_handling',
            result: { error: errorMsg },
            timestamp: Date.now(),
          });
        }
        
        // Small delay between iterations
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      return {
        success: false,
        iterations: iteration,
        chainOfThought,
        finalState: null,
        error: `Maximum iterations (${maxIterations}) reached`,
      };
      
    } catch (error: any) {
      return {
        success: false,
        iterations: iteration,
        chainOfThought,
        finalState: null,
        error: error.message,
      };
    } finally {
      // Save Chain of Thought to agent
      if (chainOfThought.length > 0) {
        try {
          const agent = await AgentModel.findById(agentId);
          if (agent) {
            const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            for (const step of chainOfThought) {
              agent.addChainOfThoughtStep(step);
            }
            
            agent.chainOfThought = agent.chainOfThought || { steps: [], lastExecutionId: undefined, totalExecutions: 0 };
            agent.chainOfThought.lastExecutionId = executionId;
            agent.chainOfThought.totalExecutions = (agent.chainOfThought.totalExecutions || 0) + 1;
            agent.totalExecutions = (agent.totalExecutions || 0) + 1;
            
            await agent.save();
          }
        } catch (saveError) {
          // Don't fail the execution if we can't save CoT
          console.warn('Failed to save Chain of Thought:', saveError);
        }
      }
    }
  }

  /**
   * Build context for agentic loop
   */
  private buildAgenticContext(agent: IAgent, context: AgenticLoopContext, previousError?: string): string {
    const nodes = agent.nodes as Record<string, any>;
    const nodeCount = Object.keys(nodes).length;
    const edgeCount = (agent.connections || []).length;
    
    const nodeStates = Object.entries(nodes).map(([id, node]) => ({
      id,
      title: node.metadata?.title || id,
      type: node.type,
      state: node.ternaryState || 'UNKNOWN',
    }));
    
    let errorContext = '';
    if (previousError) {
      errorContext = `\n\n[ERROR CONTEXT]:\nPrevious error: ${previousError}\nPlease correct this in your next action.`;
    }
    
    return `Agentic Loop Context:
Objective: ${context.objective}
Iteration: ${context.iterations}/${context.maxIterations}
Completed Actions: ${context.completedActions.length}
Failed Actions: ${context.failedActions.length}

Current Graph State:
- Nodes: ${nodeCount}
- Edges: ${edgeCount}
- Node States: ${JSON.stringify(nodeStates)}

${errorContext}

Please evaluate if the objective has been achieved.
If YES, respond with: {"completed": true, "reasoning": "explanation"}
If NO, respond with the next mutation to achieve the objective.`;
  }

  /**
   * Evaluate if objective is complete (simplified for now)
   */
  private evaluateObjectiveCompletion(agent: IAgent, objective: string, context: AgenticLoopContext): boolean {
    // In a real implementation, this would use AI to evaluate completion
    // For now, we'll use some simple heuristics
    
    // If we've had too many failures, give up
    if (context.failedActions.length >= context.maxIterations / 2) {
      return false;
    }
    
    // If objective contains keywords that might be in node titles
    const lowerObjective = objective.toLowerCase();
    const nodes = agent.nodes as Record<string, any>;
    
    for (const node of Object.values(nodes)) {
      const title = (node.metadata?.title || '').toLowerCase();
      if (title.includes(lowerObjective) || lowerObjective.includes(title)) {
        return true;
      }
    }
    
    // If we've completed several actions successfully
    if (context.completedActions.length >= 3) {
      return true;
    }
    
    return false;
  }

  /**
   * Get Chain of Thought for an agent execution
   */
  async getChainOfThought(agentId: string, executionId?: string): Promise<ChainOfThoughtStep[]> {
    // In a real implementation, this would retrieve stored CoT from database
    // For now, return empty array
    return [];
  }

  /**
   * Save Chain of Thought for an execution
   */
  async saveChainOfThought(
    agentId: string,
    chainOfThought: ChainOfThoughtStep[],
    executionId?: string
  ): Promise<void> {
    // In a real implementation, this would save to database
    // For now, just a placeholder
  }

  /**
   * Get agent stats
   */
  async getAgentStats(id: string): Promise<any> {
    try {
      const agent = await AgentModel.findById(id);
      if (!agent) {
        throw new NotFoundError('Agent not found');
      }

      return {
        id: agent._id.toString(),
        name: agent.name,
        nodeCount: agent.getNodeCount(),
        connectionCount: agent.getConnectionCount(),
        ...agent.getExecutionStats(),
        lastExecuted: agent.stats.lastExecuted,
        createdAt: agent.createdAt,
        updatedAt: agent.updatedAt,
      };
    } catch (error: any) {
      if (error.name === 'CastError') {
        throw new ValidationError('Invalid agent ID');
      }
      throw error;
    }
  }

  /**
   * Increment agent stats
   */
  async incrementAgentStats(id: string, stats: { executionCount?: number; successCount?: number; errorCount?: number; totalExecutionTime?: number }): Promise<IAgent> {
    try {
      const updates: any = {};

      if (stats.executionCount !== undefined) {
        updates['stats.executionCount'] = stats.executionCount;
      }
      if (stats.successCount !== undefined) {
        updates['stats.successCount'] = stats.successCount;
      }
      if (stats.errorCount !== undefined) {
        updates['stats.errorCount'] = stats.errorCount;
      }
      if (stats.totalExecutionTime !== undefined) {
        updates['stats.totalExecutionTime'] = stats.totalExecutionTime;
      }

      // Use $inc for atomic increments
      const updateQuery: any = {};
      if (stats.executionCount !== undefined) {
        updateQuery['stats.executionCount'] = stats.executionCount;
      }
      if (stats.successCount !== undefined) {
        updateQuery['stats.successCount'] = stats.successCount;
      }
      if (stats.errorCount !== undefined) {
        updateQuery['stats.errorCount'] = stats.errorCount;
      }
      if (stats.totalExecutionTime !== undefined) {
        updateQuery['stats.totalExecutionTime'] = stats.totalExecutionTime;
      }

      const agent = await AgentModel.findByIdAndUpdate(
        id,
        { $inc: updateQuery },
        { new: true }
      );

      if (!agent) {
        throw new NotFoundError('Agent not found');
      }

      // Clear cache
      await this.clearAgentCache(id);

      return agent;
    } catch (error: any) {
      if (error.name === 'CastError') {
        throw new ValidationError('Invalid agent ID');
      }
      throw error;
    }
  }

  /**
   * Clear agent cache
   */
  private async clearAgentCache(id: string): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.del(`${AGENT_CACHE_PREFIX}${id}`);
    } catch {
      // Redis not available
    }
  }
}

// Singleton instance
import mongoose from 'mongoose';
export const agentService = new AgentService();
export default agentService;
