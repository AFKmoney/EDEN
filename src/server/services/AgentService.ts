/**
 * Agent Service
 * Business logic for agent management
 */

import AgentModel, { IAgent, INode, IConnection, NodeType, GateType, TernaryState } from '../models/Agent';
import TemplateModel from '../models/Template';
import { IUser } from '../models/User';
import { getRedisClient } from '../config/database';
import { NotFoundError, ValidationError, AuthorizationError } from '../middleware/errorHandler';

// Configuration
const AGENT_CACHE_PREFIX = 'agent:';
const AGENT_CACHE_TTL = parseInt(process.env.AGENT_CACHE_TTL || '300'); // 5 minutes

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
   * Execute agent (mock implementation)
   */
  async executeAgent(id: string, input?: any): Promise<{ success: boolean; result?: any; error?: string; executionTime: number }> {
    try {
      const startTime = Date.now();

      // Get agent
      const agent = await AgentModel.findById(id);
      if (!agent) {
        throw new NotFoundError('Agent not found');
      }

      // Mock execution - in a real implementation, this would execute the agent graph
      // For now, we'll simulate a successful execution
      const executionTime = Date.now() - startTime;

      // Update stats
      await this.incrementAgentStats(id, {
        executionCount: 1,
        successCount: 1,
        totalExecutionTime: executionTime,
      });

      return {
        success: true,
        result: { message: 'Agent executed successfully', executionTime },
        executionTime,
      };
    } catch (error: any) {
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
        executionTime: Date.now() - Date.now(),
      };
    }
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
